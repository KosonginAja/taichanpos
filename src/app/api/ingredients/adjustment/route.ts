import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients, stockMovements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { ingredientId, qty, reason } = await req.json();

    if (!ingredientId || qty === undefined || !reason) {
      return NextResponse.json({ error: "Invalid parameters. Reason and Qty are required." }, { status: 400 });
    }

    const adjustedQty = parseFloat(qty);
    if (adjustedQty === 0) {
      return NextResponse.json({ error: "Adjustment quantity cannot be zero." }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // Get current stock
      const ing = await tx.query.ingredients.findFirst({
        where: eq(ingredients.id, ingredientId),
      });

      if (!ing || !ing.isActive) {
        throw new Error("Ingredient not found or inactive");
      }

      const currentStock = parseFloat(ing.stock.toString());
      const newStock = currentStock + adjustedQty;

      if (newStock < 0) {
        throw new Error(`Adjustment failed. Stock level cannot be negative (current: ${currentStock}, adjustment: ${adjustedQty})`);
      }

      // Update stock
      const [updated] = await tx
        .update(ingredients)
        .set({
          stock: newStock.toString(),
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, ingredientId))
        .returning();

      // Log movement
      await tx.insert(stockMovements).values({
        ingredientId,
        type: "adjustment",
        qty: adjustedQty.toString(),
        reason, // 'waste', 'expired', 'correction', etc.
        userId: session.id,
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Adjustment error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
