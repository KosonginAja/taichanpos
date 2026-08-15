import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockMovements, ingredients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ingredientId = searchParams.get("ingredientId");
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const conditions = [];

    if (ingredientId) {
      conditions.push(eq(stockMovements.ingredientId, parseInt(ingredientId)));
    }
    if (type) {
      conditions.push(eq(stockMovements.type, type));
    }
    if (startDate) {
      conditions.push(gte(stockMovements.createdAt, new Date(startDate)));
    }
    if (endDate) {
      // Append end of day time
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(stockMovements.createdAt, end));
    }

    const data = await db
      .select({
        id: stockMovements.id,
        ingredientId: stockMovements.ingredientId,
        ingredientName: ingredients.name,
        unit: ingredients.unit,
        type: stockMovements.type,
        qty: stockMovements.qty,
        refId: stockMovements.refId,
        reason: stockMovements.reason,
        userName: users.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(ingredients, eq(stockMovements.ingredientId, ingredients.id))
      .leftJoin(users, eq(stockMovements.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockMovements.createdAt));

    const mapped = data.map((item) => ({
      ...item,
      qty: parseFloat(item.qty.toString()),
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("GET movements error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/ingredients/movements - Delete old stock movements
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const cutoffDate = searchParams.get("cutoffDate");

    if (!cutoffDate) {
      return NextResponse.json({ error: "cutoffDate (YYYY-MM-DD) is required." }, { status: 400 });
    }

    const cutoff = new Date(cutoffDate);
    if (isNaN(cutoff.getTime())) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    const deleted = await db
      .delete(stockMovements)
      .where(lte(stockMovements.createdAt, cutoff))
      .returning({ id: stockMovements.id });

    return NextResponse.json({ success: true, deletedCount: deleted.length });
  } catch (error: any) {
    console.error("DELETE movements error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
