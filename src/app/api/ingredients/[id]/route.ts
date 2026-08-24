import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients, productRecipes, products, ingredientRecipes } from "@/db/schema";
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

    const { name, unit, price, minStock, isActive, type, yieldQty, recipes } = await req.json();

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

    // Perform update in a transaction to handle recipes
    const updated = await db.transaction(async (tx) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (unit !== undefined) updateData.unit = unit;
      if (price !== undefined) {
        if (parseFloat(price) < 0) throw new Error("Price cannot be negative");
        updateData.price = price.toString();
      }
      if (minStock !== undefined) {
        if (parseFloat(minStock) < 0) throw new Error("Min stock cannot be negative");
        updateData.minStock = minStock.toString();
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      if (type !== undefined) updateData.type = type;
      if (yieldQty !== undefined) {
        if (parseFloat(yieldQty) <= 0) throw new Error("Yield quantity must be greater than zero");
        updateData.yieldQty = yieldQty.toString();
      }
      updateData.updatedAt = new Date();

      const [updatedIng] = await tx
        .update(ingredients)
        .set(updateData)
        .where(eq(ingredients.id, ingredientId))
        .returning();

      // Handle recipes update if it is an intermediate ingredient
      const activeType = type !== undefined ? type : current.type;
      if (activeType === "intermediate" && recipes !== undefined && Array.isArray(recipes)) {
        // Delete old recipes
        await tx.delete(ingredientRecipes).where(eq(ingredientRecipes.parentIngredientId, ingredientId));
        
        // Insert new recipes
        for (const recipe of recipes) {
          if (recipe.childIngredientId && parseFloat(recipe.qty) > 0) {
            await tx.insert(ingredientRecipes).values({
              parentIngredientId: ingredientId,
              childIngredientId: recipe.childIngredientId,
              qty: recipe.qty.toString(),
            });
          }
        }
      } else if (activeType === "raw") {
        // If changed to raw, delete any existing recipes
        await tx.delete(ingredientRecipes).where(eq(ingredientRecipes.parentIngredientId, ingredientId));
      }

      return updatedIng;
    });

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
