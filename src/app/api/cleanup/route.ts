import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  stockMovements,
  cashTransactions,
  pocketTransactions,
  profitAllocations,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { lt } from "drizzle-orm";

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const cutoffDateStr = searchParams.get("cutoffDate");

    if (!cutoffDateStr) {
      return NextResponse.json({ error: "cutoffDate (YYYY-MM-DD) wajib diisi." }, { status: 400 });
    }

    const cutoffDate = new Date(cutoffDateStr);
    if (isNaN(cutoffDate.getTime())) {
      return NextResponse.json({ error: "Format tanggal tidak valid." }, { status: 400 });
    }

    // Eksekusi penghapusan (menggunakan transaction jika perlu, tapi karena beda tabel dan query mandiri, kita jalan parallel atau sekuensial)
    
    // 1. Delete Orders (will cascade delete order_items)
    const deletedOrders = await db.delete(orders).where(lt(orders.date, cutoffDate)).returning({ id: orders.id });
    
    // 2. Delete Stock Movements
    const deletedStocks = await db.delete(stockMovements).where(lt(stockMovements.createdAt, cutoffDate)).returning({ id: stockMovements.id });
    
    // 3. Handle Cash Transactions Carry-Forward
    const oldCash = await db.select().from(cashTransactions).where(lt(cashTransactions.date, cutoffDate));
    let netCash = 0;
    oldCash.forEach(tx => {
      const amt = parseFloat(tx.amount.toString());
      if (tx.type === "in") netCash += amt;
      else netCash -= amt;
    });

    if (netCash !== 0) {
      await db.insert(cashTransactions).values({
        type: netCash >= 0 ? "in" : "out",
        category: "Penyesuaian Saldo",
        isOperational: false,
        description: `Saldo pindahan sebelum ${cutoffDateStr} (Pembersihan Data)`,
        amount: Math.abs(netCash).toString(),
        date: cutoffDate,
        createdBy: session.id,
      });
    }
    const deletedCash = await db.delete(cashTransactions).where(lt(cashTransactions.date, cutoffDate)).returning({ id: cashTransactions.id });
    
    // 4. Handle Pocket Transactions Carry-Forward
    const oldPockets = await db.select().from(pocketTransactions).where(lt(pocketTransactions.createdAt, cutoffDate));
    const pocketBalances: Record<number, number> = {};
    oldPockets.forEach(tx => {
      const amt = parseFloat(tx.amount.toString());
      if (!pocketBalances[tx.pocketId]) pocketBalances[tx.pocketId] = 0;
      if (tx.direction === "credit") pocketBalances[tx.pocketId] += amt;
      else pocketBalances[tx.pocketId] -= amt;
    });

    for (const [pocketIdStr, net] of Object.entries(pocketBalances)) {
      if (net !== 0) {
        await db.insert(pocketTransactions).values({
          pocketId: parseInt(pocketIdStr),
          direction: net >= 0 ? "credit" : "debit",
          amount: Math.abs(net).toString(),
          sourceType: "manual",
          note: `Saldo pindahan sebelum ${cutoffDateStr}`,
          createdAt: cutoffDate,
        });
      }
    }
    const deletedPocketTx = await db.delete(pocketTransactions).where(lt(pocketTransactions.createdAt, cutoffDate)).returning({ id: pocketTransactions.id });
    
    // 5. Delete Profit Allocations (will cascade delete items)
    const deletedAllocations = await db.delete(profitAllocations).where(lt(profitAllocations.createdAt, cutoffDate)).returning({ id: profitAllocations.id });

    return NextResponse.json({
      message: "Data berhasil dibersihkan.",
      deletedCount: {
        orders: deletedOrders.length,
        stockMovements: deletedStocks.length,
        cashTransactions: deletedCash.length,
        pocketTransactions: deletedPocketTx.length,
        profitAllocations: deletedAllocations.length,
      }
    });

  } catch (e: any) {
    console.error("Cleanup error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
