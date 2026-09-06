import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stockOpnameSessions,
  stockOpnameItems,
  ingredients,
  stockMovements,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";

// Helper to generate Session Number: OPN-YYYYMMDD-seq
function generateOpnameNumber(seq: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seqStr = String(seq).padStart(3, "0");
  return `OPN-${yyyy}${mm}${dd}-${seqStr}`;
}

// GET /api/ingredients/opname
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (idParam) {
      const sessionId = parseInt(idParam, 10);
      if (isNaN(sessionId)) {
        return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
      }

      const foundSession = await db.query.stockOpnameSessions.findFirst({
        where: eq(stockOpnameSessions.id, sessionId),
        with: {
          user: {
            columns: { id: true, name: true, email: true },
          },
          items: {
            with: {
              ingredient: {
                columns: { id: true, name: true, unit: true, type: true },
              },
            },
          },
        },
      });

      if (!foundSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      return NextResponse.json(foundSession);
    }

    // List all sessions
    const sessionsList = await db.query.stockOpnameSessions.findMany({
      orderBy: [desc(stockOpnameSessions.createdAt)],
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
        items: true,
      },
    });

    const result = sessionsList.map((s) => ({
      id: s.id,
      sessionNumber: s.sessionNumber,
      notes: s.notes,
      status: s.status,
      totalDiscrepancyCost: parseFloat(s.totalDiscrepancyCost.toString()),
      conductedBy: s.user?.name || "Staff",
      itemCount: s.items.length,
      discrepancyCount: s.items.filter((i) => parseFloat(i.differenceQty.toString()) !== 0).length,
      appliedAt: s.appliedAt,
      createdAt: s.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET stock opname error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch stock opname" },
      { status: 500 }
    );
  }
}

// POST /api/ingredients/opname
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notes, applyImmediately, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Daftar item audit stok fisik tidak boleh kosong" },
        { status: 400 }
      );
    }

    // Fetch active ingredients to cross-verify system stock and unit costs
    const allIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.isActive, true));

    const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]));

    // Generate unique session number
    const countToday = await db
      .select()
      .from(stockOpnameSessions);
    const sessionNumber = generateOpnameNumber(countToday.length + 1);

    // Compute totals and prepare item data
    let totalDiscrepancyCost = 0;
    const preparedItems: Array<{
      ingredientId: number;
      systemStock: number;
      physicalStock: number;
      differenceQty: number;
      unitCost: number;
      discrepancyCost: number;
      note?: string;
    }> = [];

    for (const item of items) {
      const ing = ingredientMap.get(item.ingredientId);
      if (!ing) continue;

      const systemStock = parseFloat(ing.stock.toString());
      const physicalStock = parseFloat(item.physicalStock.toString());
      if (isNaN(physicalStock) || physicalStock < 0) {
        return NextResponse.json(
          { error: `Jumlah fisik untuk ${ing.name} tidak valid` },
          { status: 400 }
        );
      }

      const differenceQty = Math.round((physicalStock - systemStock) * 1000) / 1000;
      const unitCost = parseFloat(ing.price.toString());
      const discrepancyCost = Math.round(differenceQty * unitCost * 100) / 100;

      totalDiscrepancyCost += discrepancyCost;

      preparedItems.push({
        ingredientId: ing.id,
        systemStock,
        physicalStock,
        differenceQty,
        unitCost,
        discrepancyCost,
        note: item.note || null,
      });
    }

    if (preparedItems.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada item bahan baku valid yang diaudit" },
        { status: 400 }
      );
    }

    // Execute within database transaction
    const newSession = await db.transaction(async (tx) => {
      // 1. Insert session record
      const [insertedSession] = await tx
        .insert(stockOpnameSessions)
        .values({
          sessionNumber,
          notes: notes || null,
          status: applyImmediately ? "applied" : "draft",
          totalDiscrepancyCost: totalDiscrepancyCost.toString(),
          conductedBy: session.id,
          appliedAt: applyImmediately ? new Date() : null,
        })
        .returning();

      // 2. Insert items
      for (const pItem of preparedItems) {
        await tx.insert(stockOpnameItems).values({
          sessionId: insertedSession.id,
          ingredientId: pItem.ingredientId,
          systemStock: pItem.systemStock.toString(),
          physicalStock: pItem.physicalStock.toString(),
          differenceQty: pItem.differenceQty.toString(),
          unitCost: pItem.unitCost.toString(),
          discrepancyCost: pItem.discrepancyCost.toString(),
          note: pItem.note,
        });

        // 3. If apply immediately, update ingredients.stock & insert stock movements
        if (applyImmediately && pItem.differenceQty !== 0) {
          await tx
            .update(ingredients)
            .set({
              stock: pItem.physicalStock.toString(),
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, pItem.ingredientId));

          await tx.insert(stockMovements).values({
            ingredientId: pItem.ingredientId,
            type: "adjustment",
            qty: pItem.differenceQty.toString(),
            refId: sessionNumber,
            reason: pItem.note || (pItem.differenceQty < 0 ? "Opname: Susut Fisik" : "Opname: Surplus Fisik"),
            userId: session.id,
          });
        }
      }

      return insertedSession;
    });

    return NextResponse.json({
      success: true,
      session: newSession,
      totalDiscrepancyCost,
      message: applyImmediately
        ? "Stock Opname berhasil disimpan dan stok gudang telah direkonsiliasi!"
        : "Stock Opname berhasil disimpan sebagai draf!",
    });
  } catch (error: any) {
    console.error("POST stock opname error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process stock opname" },
      { status: 500 }
    );
  }
}
