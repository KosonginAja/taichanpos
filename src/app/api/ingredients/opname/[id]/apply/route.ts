import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stockOpnameSessions,
  stockOpnameItems,
  ingredients,
  stockMovements,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/ingredients/opname/[id]/apply - Apply draft session reconciliation
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const targetSession = await db.query.stockOpnameSessions.findFirst({
      where: eq(stockOpnameSessions.id, sessionId),
      with: {
        items: true,
      },
    });

    if (!targetSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (targetSession.status === "applied") {
      return NextResponse.json(
        { error: "Sesi opname ini sudah pernah direkonsiliasi sebelumnya." },
        { status: 400 }
      );
    }

    // Apply reconciliation in transaction
    await db.transaction(async (tx) => {
      for (const item of targetSession.items) {
        const diffQty = parseFloat(item.differenceQty.toString());
        if (diffQty !== 0 && item.ingredientId) {
          // Update physical stock into ingredient
          await tx
            .update(ingredients)
            .set({
              stock: item.physicalStock.toString(),
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, item.ingredientId));

          // Record stock movement audit
          await tx.insert(stockMovements).values({
            ingredientId: item.ingredientId,
            type: "adjustment",
            qty: item.differenceQty.toString(),
            refId: targetSession.sessionNumber,
            reason: item.note || (diffQty < 0 ? "Opname: Susut Fisik" : "Opname: Surplus Fisik"),
            userId: session.id,
          });
        }
      }

      // Mark session as applied
      await tx
        .update(stockOpnameSessions)
        .set({
          status: "applied",
          appliedAt: new Date(),
        })
        .where(eq(stockOpnameSessions.id, sessionId));
    });

    return NextResponse.json({
      success: true,
      message: `Rekonsiliasi sesi ${targetSession.sessionNumber} berhasil diterapkan ke stok gudang!`,
    });
  } catch (error: any) {
    console.error("Apply opname error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to apply reconciliation" },
      { status: 500 }
    );
  }
}
