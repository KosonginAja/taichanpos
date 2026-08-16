import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productRecipes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { name, sellPrice, yieldQty, isActive, minStock, recipes } = await req.json();

    // Check if product exists
    const current = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!current) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (sellPrice !== undefined) {
        if (parseFloat(sellPrice) < 0) throw new Error("Sell price cannot be negative");
        updateData.sellPrice = sellPrice.toString();
      }
      if (yieldQty !== undefined) {
        if (parseFloat(yieldQty) <= 0) throw new Error("Yield must be greater than zero");
        updateData.yieldQty = yieldQty.toString();
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      if (minStock !== undefined) updateData.minStock = minStock.toString();
      updateData.updatedAt = new Date();

      // Update product info
      const [updated] = await tx
        .update(products)
        .set(updateData)
        .where(eq(products.id, productId))
        .returning();

      // Update recipes if provided
      if (recipes && Array.isArray(recipes)) {
        // Delete current recipes
        await tx.delete(productRecipes).where(eq(productRecipes.productId, productId));

        // Insert new recipes
        for (const recipeItem of recipes) {
          const { ingredientId, qty } = recipeItem;
          if (!ingredientId || qty === undefined || parseFloat(qty) <= 0) {
            throw new Error("Invalid recipe item");
          }
          await tx.insert(productRecipes).values({
            productId: productId,
            ingredientId,
            qty: qty.toString(),
          });
        }
      }

      return updated;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("PUT product error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const current = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!current) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    try {
      await db.delete(products).where(eq(products.id, productId));
      return NextResponse.json({ success: true, message: "Produk berhasil dihapus permanen" });
    } catch (e: any) {
      // If foreign key constraint violation (e.g. used in orders)
      if (e.code === '23503' || e.message.includes('foreign key')) {
        await db.update(products).set({ isActive: false }).where(eq(products.id, productId));
        return NextResponse.json({ success: true, message: "Produk dinonaktifkan (soft delete) karena memiliki riwayat transaksi" });
      }
      throw e;
    }
  } catch (error: any) {
    console.error("DELETE product error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
