import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients, ingredientRecipes, stockMovements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ingredientId, unitsProduced } = await req.json();

    if (!ingredientId || !unitsProduced || parseFloat(unitsProduced) <= 0) {
      return NextResponse.json({ error: "Data produksi tidak valid." }, { status: 400 });
    }

    const qtyToProduce = parseFloat(unitsProduced);

    const result = await db.transaction(async (tx) => {
      // 1. Fetch the target ingredient
      const parentIng = await tx.query.ingredients.findFirst({
        where: eq(ingredients.id, ingredientId),
        with: {
          parentRecipes: {
            with: {
              childIngredient: true,
            },
          },
        },
      });

      if (!parentIng) {
        throw new Error("Bahan baku tidak ditemukan.");
      }

      if (parentIng.type !== "intermediate") {
        throw new Error("Bahan baku ini bukan tipe setengah jadi.");
      }

      const recipes = parentIng.parentRecipes || [];
      if (recipes.length === 0) {
        throw new Error("Resep bahan baku setengah jadi belum dikonfigurasi.");
      }

      // 2. Calculate child ingredients needed
      const yieldQtyVal = parseFloat(parentIng.yieldQty.toString());
      if (yieldQtyVal <= 0) {
        throw new Error("Yield quantity (hasil resep) tidak valid.");
      }

      const multiplier = qtyToProduce / yieldQtyVal;
      const stockErrors: string[] = [];
      let totalHppCost = 0;
      const childDeductions: { id: number; newStock: number; deductedQty: number }[] = [];

      for (const recipe of recipes) {
        const requiredQty = parseFloat(recipe.qty.toString()) * multiplier;
        const currentStock = parseFloat(recipe.childIngredient.stock.toString());

        if (currentStock < requiredQty) {
          const shortage = requiredQty - currentStock;
          stockErrors.push(
            `Stok ${recipe.childIngredient.name} kurang: butuh ${requiredQty.toFixed(2)} ${recipe.childIngredient.unit}, tersedia ${currentStock.toFixed(2)} ${recipe.childIngredient.unit} (kurang ${(requiredQty - currentStock).toFixed(2)}).`
          );
        } else {
          childDeductions.push({
            id: recipe.childIngredientId,
            newStock: currentStock - requiredQty,
            deductedQty: requiredQty,
          });
          const priceVal = parseFloat(recipe.childIngredient.price.toString());
          totalHppCost += requiredQty * priceVal;
        }
      }

      if (stockErrors.length > 0) {
        throw new Error(stockErrors.join(" "));
      }

      // 3. Deduct stock for child ingredients & write movements
      for (const update of childDeductions) {
        await tx
          .update(ingredients)
          .set({
            stock: update.newStock.toString(),
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, update.id));

        await tx.insert(stockMovements).values({
          ingredientId: update.id,
          type: "production",
          qty: (-update.deductedQty).toString(),
          reason: `Dibuat menjadi ${parentIng.name}`,
          userId: session.id,
        });
      }

      // 4. Calculate new HPP cost per unit of intermediate ingredient
      const newPricePerUnit = totalHppCost / qtyToProduce;

      // 5. Add stock for the intermediate ingredient
      const oldStock = parseFloat(parentIng.stock.toString());
      const newStock = oldStock + qtyToProduce;

      await tx
        .update(ingredients)
        .set({
          stock: newStock.toString(),
          price: newPricePerUnit.toFixed(2), // Auto-update price (HPP)
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, parentIng.id));

      // 6. Log stock movement for the intermediate ingredient
      await tx.insert(stockMovements).values({
        ingredientId: parentIng.id,
        type: "production",
        qty: qtyToProduce.toString(),
        reason: `Produksi ${qtyToProduce} ${parentIng.unit}`,
        userId: session.id,
      });

      return {
        success: true,
        ingredientId: parentIng.id,
        name: parentIng.name,
        qtyProduced: qtyToProduce,
        newStock,
        newHpp: newPricePerUnit,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Produce ingredient error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
