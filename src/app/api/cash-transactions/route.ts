import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashTransactions, users, pocketTransactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // 'in' | 'out' | null (all)
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sourceType = searchParams.get("sourceType");

    const conditions = [];
    if (type) conditions.push(eq(cashTransactions.type, type));
    if (category) conditions.push(eq(cashTransactions.category, category));
    if (sourceType) conditions.push(eq(cashTransactions.sourceType, sourceType));
    if (startDate) conditions.push(gte(cashTransactions.date, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(cashTransactions.date, end));
    }

    const data = await db
      .select({
        id: cashTransactions.id,
        type: cashTransactions.type,
        category: cashTransactions.category,
        isOperational: cashTransactions.isOperational,
        description: cashTransactions.description,
        amount: cashTransactions.amount,
        date: cashTransactions.date,
        note: cashTransactions.note,
        sourceType: cashTransactions.sourceType,
        sourceRefId: cashTransactions.sourceRefId,
        createdAt: cashTransactions.createdAt,
        creatorName: users.name,
      })
      .from(cashTransactions)
      .leftJoin(users, eq(cashTransactions.createdBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cashTransactions.date));

    return NextResponse.json(
      data.map((t) => ({ ...t, amount: parseFloat(t.amount.toString()) }))
    );
  } catch (error: any) {
    console.error("GET cash-transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { type, category, isOperational, description, amount, date, note, pocketId, paymentGroup } = body;

    if (!type || !category || !description || !amount || !date) {
      return NextResponse.json({ error: "Kolom wajib: type, category, description, amount, date" }, { status: 400 });
    }

    const [newTx] = await db.insert(cashTransactions).values({
      type,
      category,
      isOperational: isOperational !== undefined ? isOperational : true,
      description,
      amount: amount.toString(),
      date: new Date(date),
      note: note || null,
      sourceType: "manual",
      sourceRefId: null,
      pocketId: pocketId || null,
      paymentGroup: paymentGroup || null,
      createdBy: session.id,
    }).returning();

    // If a pocket is selected and this is kas keluar, record a pocket debit
    if (pocketId && type === "out") {
      await db.insert(pocketTransactions).values({
        pocketId,
        direction: "debit",
        amount: amount.toString(),
        sourceType: "cash_transaction",
        sourceRefId: newTx.id.toString(),
        note: description,
      });
    }

    return NextResponse.json({ ...newTx, amount: parseFloat(newTx.amount.toString()) });
  } catch (error: any) {
    console.error("POST cash-transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
