import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/ingredients - Fetch active/all ingredients
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await db.select().from(ingredients).where(eq(ingredients.isActive, true)).orderBy(desc(ingredients.createdAt));

    // Map ingredients with low stock status
    const mapped = data.map((item) => {
      const stockVal = parseFloat(item.stock.toString());
      const minStockVal = parseFloat(item.minStock.toString());
      let status = "Aman";
      if (stockVal <= 0) {
        status = "Habis";
      } else if (stockVal <= minStockVal) {
        status = "Menipis";
      }
      return {
        ...item,
        status,
        price: parseFloat(item.price.toString()),
        stock: stockVal,
        minStock: minStockVal,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("GET ingredients error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/ingredients - Create new ingredient (Admin only)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { name, unit, price, minStock, stock } = await req.json();

    if (!name || !unit || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (parseFloat(price) < 0 || parseFloat(minStock || 0) < 0 || parseFloat(stock || 0) < 0) {
      return NextResponse.json({ error: "Values cannot be negative" }, { status: 400 });
    }

    const [newIngredient] = await db.insert(ingredients).values({
      name,
      unit,
      price: price.toString(),
      minStock: (minStock || 0).toString(),
      stock: (stock || 0).toString(),
    }).returning();

    // If initial stock is > 0, log a restock movement automatically
    if (parseFloat(stock || 0) > 0) {
      const { stockMovements } = require("@/db/schema");
      await db.insert(stockMovements).values({
        ingredientId: newIngredient.id,
        type: "restock",
        qty: stock.toString(),
        reason: "Initial Stock Setup",
        userId: session.id,
      });
    }

    return NextResponse.json(newIngredient, { status: 201 });
  } catch (error: any) {
    console.error("POST ingredients error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
