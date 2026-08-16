import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  products,
  ingredients,
  productRecipes,
  stockMovements,
  productStockMovements,
  productProductions,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, unitsProduced, note } = await req.json();

    if (!productId || !unitsProduced || unitsProduced <= 0) {
      return NextResponse.json({ error: "Data produksi tidak valid." }, { status: 400 });
    }

    // Eksekusi dalam transaksi
    const result = await db.transaction(async (tx) => {
      // 1. Ambil data produk
      const product = await tx.query.products.findFirst({
        where: eq(products.id, productId),
      });

      if (!product) {
        throw new Error("Produk tidak ditemukan.");
      }

      // 2. Ambil resep
      const recipes = await tx.query.productRecipes.findMany({
        where: eq(productRecipes.productId, productId),
        with: {
          ingredient: true,
        },
      });

      if (recipes.length === 0) {
        throw new Error("Produk ini belum memiliki resep bahan baku.");
      }

      // 3. Hitung kebutuhan bahan baku & validasi stok
      const yieldQty = parseFloat(product.yieldQty.toString());
      if (yieldQty <= 0) {
        throw new Error("Yield quantity (hasil per resep) pada produk tidak valid.");
      }

      const multiplier = unitsProduced / yieldQty;
      const stockErrors: string[] = [];
      let totalHpp = 0;

      const ingredientUpdates = [];

      for (const recipe of recipes) {
        const requiredQty = parseFloat(recipe.qty.toString()) * multiplier;
        const currentStock = parseFloat(recipe.ingredient.stock.toString());
        
        if (currentStock < requiredQty) {
          const shortage = requiredQty - currentStock;
          stockErrors.push(`Stok ${recipe.ingredient.name} kurang: butuh ${requiredQty.toFixed(2)} ${recipe.ingredient.unit}, tersedia ${currentStock.toFixed(2)} ${recipe.ingredient.unit}.`);
        } else {
          ingredientUpdates.push({
            ingredientId: recipe.ingredient.id,
            newStock: currentStock - requiredQty,
            deductedQty: requiredQty,
          });
          
          // Tambahkan ke HPP
          const pricePerUnit = parseFloat(recipe.ingredient.price.toString());
          totalHpp += requiredQty * pricePerUnit;
        }
      }

      if (stockErrors.length > 0) {
        throw new Error(stockErrors.join(" "));
      }

      const hppPerUnit = totalHpp / unitsProduced;

      // 4. Update stok bahan baku & insert stock_movements
      for (const update of ingredientUpdates) {
        await tx
          .update(ingredients)
          .set({
            stock: update.newStock.toString(),
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, update.ingredientId));
      }

      // 5. Catat Produksi
      const [productionRecord] = await tx
        .insert(productProductions)
        .values({
          productId,
          unitsProduced: unitsProduced.toString(),
          hppPerUnit: hppPerUnit.toString(),
          hppTotal: totalHpp.toString(),
          producedBy: session.id,
          note: note || null,
        })
        .returning();

      // 6. Insert stock_movements untuk bahan baku dengan refId = productionRecord.id
      for (const update of ingredientUpdates) {
        await tx.insert(stockMovements).values({
          ingredientId: update.ingredientId,
          type: "production",
          qty: (-update.deductedQty).toString(),
          refId: productionRecord.id.toString(),
          userId: session.id,
        });
      }

      // 7. Tambah stok produk jadi
      const newProductStock = parseFloat(product.currentStock.toString()) + unitsProduced;
      await tx
        .update(products)
        .set({
          currentStock: newProductStock.toString(),
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));

      // 8. Insert product_stock_movements
      await tx.insert(productStockMovements).values({
        productId,
        type: "production",
        qty: unitsProduced.toString(),
        refId: productionRecord.id.toString(),
        userId: session.id,
      });

      return {
        success: true,
        productionId: productionRecord.id,
        unitsProduced,
        newStock: newProductStock,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memproduksi produk." }, { status: 400 });
  }
}
