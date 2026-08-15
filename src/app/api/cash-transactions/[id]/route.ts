import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashTransactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const txId = parseInt(id);

    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only allow deleting manual entries
    const existing = await db.query.cashTransactions.findFirst({
      where: eq(cashTransactions.id, txId),
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    if (existing.sourceType !== "manual") {
      return NextResponse.json(
        { error: "Entri otomatis (dari penjualan/restock) tidak bisa dihapus manual." },
        { status: 403 }
      );
    }

    await db.delete(cashTransactions).where(eq(cashTransactions.id, txId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE cash-transaction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
