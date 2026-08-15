import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients, stockMovements, cashTransactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { ingredientId, qty, refId, purchaseCost } = await req.json();

    if (!ingredientId || qty === undefined || parseFloat(qty) <= 0) {
      return NextResponse.json({ error: "Invalid parameters. Qty must be greater than 0." }, { status: 400 });
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
      const addedQty = parseFloat(qty);
      const newStock = currentStock + addedQty;

      // Update stock
      const [updated] = await tx
        .update(ingredients)
        .set({
          stock: newStock.toString(),
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, ingredientId))
        .returning();

      // Log stock movement
      const [movement] = await tx.insert(stockMovements).values({
        ingredientId,
        type: "restock",
        qty: addedQty.toString(),
        refId: refId || null,
        userId: session.id,
      }).returning();

      // Auto-insert kas keluar jika purchaseCost diisi
      if (purchaseCost && parseFloat(purchaseCost) > 0) {
        await tx.insert(cashTransactions).values({
          type: "out",
          category: "Pembelian Bahan Baku",
          isOperational: true,
          description: `Restock ${ing.name} ${addedQty} ${ing.unit}`,
          amount: parseFloat(purchaseCost).toString(),
          date: new Date(),
          sourceType: "restock",
          sourceRefId: movement.id.toString(),
          createdBy: session.id,
        });
      }

      return updated;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Restock error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
