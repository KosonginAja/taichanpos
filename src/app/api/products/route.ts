import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productRecipes, ingredients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/products - Fetch all active products with dynamic HPP and recipes
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch active products
    const activeProducts = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt));

    const result = [];

    for (const prod of activeProducts) {
      // Fetch recipe ingredients for this product
      const recipes = await db
        .select({
          id: productRecipes.id,
          ingredientId: productRecipes.ingredientId,
          qty: productRecipes.qty,
          name: ingredients.name,
          unit: ingredients.unit,
          price: ingredients.price,
        })
        .from(productRecipes)
        .innerJoin(ingredients, eq(productRecipes.ingredientId, ingredients.id))
        .where(eq(productRecipes.productId, prod.id));

      let totalRecipeCost = 0;
      const mappedRecipes = recipes.map((r) => {
        const qtyVal = parseFloat(r.qty.toString());
        const priceVal = parseFloat(r.price.toString());
        const cost = qtyVal * priceVal;
        totalRecipeCost += cost;
        return {
          id: r.id,
          ingredientId: r.ingredientId,
          name: r.name,
          unit: r.unit,
          qty: qtyVal,
          price: priceVal,
          cost,
        };
      });

      const yieldQtyVal = parseFloat(prod.yieldQty.toString());
      const sellPriceVal = parseFloat(prod.sellPrice.toString());
      const hppPerPorsi = yieldQtyVal > 0 ? totalRecipeCost / yieldQtyVal : 0;
      const margin = sellPriceVal - hppPerPorsi;
      const marginPercent = sellPriceVal > 0 ? (margin / sellPriceVal) * 100 : 0;

      result.push({
        id: prod.id,
        name: prod.name,
        sellPrice: sellPriceVal,
        yieldQty: yieldQtyVal,
        isActive: prod.isActive,
        createdAt: prod.createdAt,
        updatedAt: prod.updatedAt,
        recipes: mappedRecipes,
        hppPerPorsi,
        margin,
        marginPercent,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET products error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/products - Create product and recipes (Admin only)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { name, sellPrice, yieldQty, recipes } = await req.json();

    if (!name || sellPrice === undefined || yieldQty === undefined || !recipes || !Array.isArray(recipes)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (parseFloat(sellPrice) < 0 || parseFloat(yieldQty) <= 0) {
      return NextResponse.json({ error: "Sell price cannot be negative and yield must be greater than zero" }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Insert product
      const [newProduct] = await tx
        .insert(products)
        .values({
          name,
          sellPrice: sellPrice.toString(),
          yieldQty: yieldQty.toString(),
        })
        .returning();

      // 2. Insert recipes
      for (const recipeItem of recipes) {
        const { ingredientId, qty } = recipeItem;
        if (!ingredientId || qty === undefined || parseFloat(qty) <= 0) {
          throw new Error("Invalid recipe item");
        }
        await tx.insert(productRecipes).values({
          productId: newProduct.id,
          ingredientId,
          qty: qty.toString(),
        });
      }

      return newProduct;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST product error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
