import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, cashTransactions } from "@/db/schema";
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

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Rentang tanggal diperlukan." }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch paid orders for revenue & HPP
    const ordersData = await db
      .select()
      .from(orders)
      .where(and(gte(orders.date, start), lte(orders.date, end), eq(orders.status, "paid")));

    let grossRevenue = 0;
    let totalHpp = 0;
    let totalTax = 0;
    let totalServiceCharge = 0;
    let totalRoundingAdjustment = 0;

    for (const o of ordersData) {
      grossRevenue += parseFloat(o.grandTotal?.toString() || o.revenueTotal.toString());
      totalHpp += parseFloat(o.hppTotal.toString());
      totalTax += parseFloat(o.taxAmount.toString());
      totalServiceCharge += parseFloat(o.serviceChargeAmount.toString());
      totalRoundingAdjustment += parseFloat(o.roundingAdjustment?.toString() || "0");
    }

    const grossProfit = grossRevenue - totalHpp;

    // Fetch operational expenses from cash_transactions (type='out', isOperational=true)
    const expenseTxs = await db
      .select()
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.type, "out"),
          eq(cashTransactions.isOperational, true),
          gte(cashTransactions.date, start),
          lte(cashTransactions.date, end)
        )
      );

    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    for (const t of expenseTxs) {
      const amt = parseFloat(t.amount.toString());
      // Skip "Pembelian Bahan Baku" from P&L since already counted via HPP
      if (t.category === "Pembelian Bahan Baku") continue;
      totalExpenses += amt;
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + amt;
    }

    const netProfit = grossProfit - totalExpenses;

    return NextResponse.json({
      summary: {
        grossRevenue,
        totalHpp,
        grossProfit,
        totalTax,
        totalServiceCharge,
        totalRoundingAdjustment,
        totalExpenses,
        netProfit,
      },
      expensesByCategory,
    });
  } catch (error: any) {
    console.error("GET profit-loss error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
