import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, cashTransactions, cashPockets, pocketTransactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    if (order.status !== "open") {
      return NextResponse.json({ error: `Pesanan ini tidak dalam status open (status saat ini: ${order.status}).` }, { status: 400 });
    }

    const { paymentMethod, amountReceived } = await req.json();

    if (!paymentMethod) {
      return NextResponse.json({ error: "Metode pembayaran wajib dipilih." }, { status: 400 });
    }

    const grandTotal = parseFloat(order.grandTotal?.toString() || order.revenueTotal.toString());
    const amountReceivedVal = amountReceived ? parseFloat(amountReceived) : null;
    const changeAmount = amountReceivedVal !== null ? amountReceivedVal - grandTotal : null;

    if (paymentMethod === "cash" && amountReceivedVal !== null && changeAmount !== null && changeAmount < 0) {
      return NextResponse.json({ error: "Uang yang diterima kurang dari total tagihan." }, { status: 400 });
    }

    const updatedOrder = await db.transaction(async (tx) => {
      const now = new Date();

      // 1. Update order status to paid
      const [updated] = await tx
        .update(orders)
        .set({
          status: "paid",
          paymentMethod,
          amountReceived: amountReceivedVal ? amountReceivedVal.toString() : null,
          changeAmount: changeAmount !== null ? changeAmount.toString() : null,
          cashierId: session.id,
        })
        .where(eq(orders.id, orderId))
        .returning();

      // 2. Insert cash_transactions
      await tx.insert(cashTransactions).values({
        type: "in",
        category: "Penjualan",
        isOperational: false,
        description: `Pelunasan Meja ${order.tableNo || ''} (Order ${order.orderNumber})`.trim(),
        amount: grandTotal.toString(),
        date: now,
        sourceType: "order",
        sourceRefId: order.orderNumber,
        paymentGroup: paymentMethod === "cash" ? "tunai" : "non_tunai",
        createdBy: session.id,
      });

      // 3. Split to cash pockets
      const hppTotal = parseFloat(order.hppTotal.toString());
      const profitTotal = parseFloat(order.profitTotal.toString());
      const roundingAdjustment = parseFloat(order.roundingAdjustment?.toString() || "0");

      const activePockets = await tx.select().from(cashPockets).where(eq(cashPockets.isActive, true));
      const hppPocket = activePockets.find(p => p.type === 'cost' && p.label.includes('HPP'));
      const profitPockets = activePockets.filter(p => p.type === 'profit_share').sort((a, b) => a.sortOrder - b.sortOrder);
      const companyPocket = profitPockets.find(p => p.label === 'Kas Perusahaan') || profitPockets[0];

      if (hppPocket && hppTotal > 0) {
        await tx.insert(pocketTransactions).values({
          pocketId: hppPocket.id,
          direction: 'credit',
          amount: hppTotal.toString(),
          sourceType: 'order',
          sourceRefId: order.orderNumber,
          note: `HPP dari Pelunasan Pesanan ${order.orderNumber}`,
        });
      }

      if (profitPockets.length > 0) {
        let totalRounded = 0;
        let pocketDistributions: Array<{id: number, rounded: number, pct: number}> = [];
        
        for (const pocket of profitPockets) {
          const pct = parseFloat(pocket.percentage?.toString() || '0');
          if (pct > 0) {
            let exact = (profitTotal * pct) / 100;
            let rounded = Math.round(exact / 100) * 100;
            totalRounded += rounded;
            pocketDistributions.push({ id: pocket.id, rounded, pct });
          }
        }

        const expectedTotal = profitTotal + roundingAdjustment;
        const diff = expectedTotal - totalRounded;

        for (const p of pocketDistributions) {
          let finalAmount = p.rounded;
          if (p.id === companyPocket?.id) {
            finalAmount += diff;
          }
          if (finalAmount !== 0) {
            await tx.insert(pocketTransactions).values({
              pocketId: p.id,
              direction: finalAmount >= 0 ? 'credit' : 'debit',
              amount: Math.abs(finalAmount).toString(),
              sourceType: 'order',
              sourceRefId: order.orderNumber,
              note: `Profit Share dari Pelunasan Pesanan ${order.orderNumber} (${p.pct}%)`,
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Pay order error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
