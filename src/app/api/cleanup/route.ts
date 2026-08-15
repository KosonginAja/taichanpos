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
    
    // 3. Delete Cash Transactions
    const deletedCash = await db.delete(cashTransactions).where(lt(cashTransactions.date, cutoffDate)).returning({ id: cashTransactions.id });
    
    // 4. Delete Pocket Transactions
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
