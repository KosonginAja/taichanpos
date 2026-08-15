import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashTransactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, gte, lte, eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const openingBalance = parseFloat(searchParams.get("openingBalance") || "0");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Rentang tanggal diperlukan." }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const txs = await db
      .select()
      .from(cashTransactions)
      .where(and(gte(cashTransactions.date, start), lte(cashTransactions.date, end)));

    let totalIn = 0;
    let totalOut = 0;
    const inByCategory: Record<string, number> = {};
    const outByCategory: Record<string, number> = {};
    const inBySource: Record<string, number> = { manual: 0, order: 0, restock: 0 };
    const outBySource: Record<string, number> = { manual: 0, order: 0, restock: 0 };

    const txList = txs.map((t) => ({ ...t, amount: parseFloat(t.amount.toString()) }));

    for (const t of txList) {
      if (t.type === "in") {
        totalIn += t.amount;
        inByCategory[t.category] = (inByCategory[t.category] || 0) + t.amount;
        inBySource[t.sourceType] = (inBySource[t.sourceType] || 0) + t.amount;
      } else {
        totalOut += t.amount;
        outByCategory[t.category] = (outByCategory[t.category] || 0) + t.amount;
        outBySource[t.sourceType] = (outBySource[t.sourceType] || 0) + t.amount;
      }
    }

    const closingBalance = openingBalance + totalIn - totalOut;

    return NextResponse.json({
      summary: {
        openingBalance,
        totalIn,
        totalOut,
        closingBalance,
      },
      inByCategory,
      outByCategory,
      inBySource,
      outBySource,
      transactions: txList,
    });
  } catch (error: any) {
    console.error("GET cashflow error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
