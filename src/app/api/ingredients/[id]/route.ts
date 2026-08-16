import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients, productRecipes, products } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// PUT /api/ingredients/[id] - Update or soft delete an ingredient
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ingredientId = parseInt(id);

    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { name, unit, price, minStock, isActive } = await req.json();

    // Check if ingredient exists
    const current = await db.query.ingredients.findFirst({
      where: eq(ingredients.id, ingredientId),
    });

    if (!current) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    // Validation: If setting to inactive (soft-delete), check if still used in active recipes
    if (isActive === false || isActive === "false") {
      // Find active products referencing this ingredient
      const activeRecipeUsage = await db
        .select({
          productName: products.name,
        })
        .from(productRecipes)
        .innerJoin(products, eq(productRecipes.productId, products.id))
        .where(
          and(
            eq(productRecipes.ingredientId, ingredientId),
            eq(products.isActive, true)
          )
        );

      if (activeRecipeUsage.length > 0) {
        const productNames = activeRecipeUsage.map((r) => r.productName).join(", ");
        return NextResponse.json(
          {
            error: `Bahan baku ini tidak bisa dinonaktifkan karena sedang digunakan pada resep produk aktif: ${productNames}`,
          },
          { status: 400 }
        );
      }
    }

    // Perform update
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (unit !== undefined) updateData.unit = unit;
    if (price !== undefined) {
      if (parseFloat(price) < 0) return NextResponse.json({ error: "Price cannot be negative" }, { status: 400 });
      updateData.price = price.toString();
    }
    if (minStock !== undefined) {
      if (parseFloat(minStock) < 0) return NextResponse.json({ error: "Min stock cannot be negative" }, { status: 400 });
      updateData.minStock = minStock.toString();
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(ingredients)
      .set(updateData)
      .where(eq(ingredients.id, ingredientId))
      .returning();

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT ingredient error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ingredientId = parseInt(id);

    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const current = await db.query.ingredients.findFirst({
      where: eq(ingredients.id, ingredientId),
    });

    if (!current) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    // Validation: Check if still used in active recipes before deleting/soft-deleting
    const activeRecipeUsage = await db
      .select({
        productName: products.name,
      })
      .from(productRecipes)
      .innerJoin(products, eq(productRecipes.productId, products.id))
      .where(
        and(
          eq(productRecipes.ingredientId, ingredientId),
          eq(products.isActive, true)
        )
      );

    if (activeRecipeUsage.length > 0) {
      const productNames = activeRecipeUsage.map((r) => r.productName).join(", ");
      return NextResponse.json(
        {
          error: `Bahan baku ini tidak bisa dihapus karena sedang digunakan pada resep produk aktif: ${productNames}`,
        },
        { status: 400 }
      );
    }

    try {
      await db.delete(ingredients).where(eq(ingredients.id, ingredientId));
      return NextResponse.json({ success: true, message: "Bahan baku berhasil dihapus permanen" });
    } catch (e: any) {
      // If foreign key constraint violation (e.g. has stock movements)
      if (e.code === '23503' || e.message.includes('foreign key')) {
        await db.update(ingredients).set({ isActive: false }).where(eq(ingredients.id, ingredientId));
        return NextResponse.json({ success: true, message: "Bahan baku dinonaktifkan (soft delete) karena memiliki riwayat stok" });
      }
      throw e;
    }
  } catch (error: any) {
    console.error("DELETE ingredient error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
