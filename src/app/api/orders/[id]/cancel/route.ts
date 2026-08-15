import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, ingredients, stockMovements, productRecipes, products, cashTransactions, pocketTransactions } from "@/db/schema";
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

    if (order.status === "cancelled") {
      return NextResponse.json({ error: "Pesanan sudah dibatalkan sebelumnya." }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch items for this order before deleting
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // 2. For each item, look up recipe and return stock
      for (const item of items) {
        if (!item.productId) continue; // Skip if no product ID

        const prod = await tx.query.products.findFirst({
          where: eq(products.id, item.productId),
        });

        if (!prod) continue; // Skip if product completely deleted from DB

        const recipes = await tx
          .select()
          .from(productRecipes)
          .where(eq(productRecipes.productId, item.productId));

        const yieldQty = parseFloat(prod.yieldQty.toString());
        const orderQtyVal = parseFloat(item.qty.toString());

        for (const r of recipes) {
          const recQtyVal = parseFloat(r.qty.toString());

          // calculate quantity to return: (orderQty * recipeQty) / yieldQty
          const returnQty = yieldQty > 0 ? (orderQtyVal * recQtyVal) / yieldQty : 0;

          if (returnQty <= 0) continue;

          // Fetch current ingredient stock
          const ing = await tx.query.ingredients.findFirst({
            where: eq(ingredients.id, r.ingredientId),
          });

          if (ing) {
            const currentStock = parseFloat(ing.stock.toString());
            const newStock = currentStock + returnQty;

            // Update ingredients stock
            await tx
              .update(ingredients)
              .set({
                stock: newStock.toString(),
                updatedAt: new Date(),
              })
              .where(eq(ingredients.id, r.ingredientId));

            // Log stock movement return (positive quantity)
            await tx.insert(stockMovements).values({
              ingredientId: r.ingredientId,
              type: "return",
              qty: returnQty.toString(),
              refId: `CANCEL-${order.orderNumber}`,
              userId: session.id,
            });
          }
        }
      }

      // 3. Insert pembalik kas (retur penjualan) ke cash_transactions
      await tx.insert(cashTransactions).values({
        type: "out",
        category: "Retur Penjualan",
        isOperational: false,
        description: `Pembatalan Order ${order.orderNumber}`,
        amount: (parseFloat(order.grandTotal?.toString() || "0") > 0 ? order.grandTotal : order.revenueTotal).toString(),
        date: new Date(),
        sourceType: "order",
        sourceRefId: order.orderNumber,
        createdBy: session.id,
      });

      // 4. Reverse pocket_transactions dari order ini
      const prevPocketTxs = await tx
        .select()
        .from(pocketTransactions)
        .where(eq(pocketTransactions.sourceRefId, order.orderNumber));

      for (const ptx of prevPocketTxs) {
        // Only reverse credits (money that came in from the order)
        if (ptx.direction === 'credit') {
          await tx.insert(pocketTransactions).values({
            pocketId: ptx.pocketId,
            direction: 'debit',
            amount: ptx.amount,
            sourceType: 'order',
            sourceRefId: `CANCEL-${order.orderNumber}`,
            note: `Reversal pembatalan Order ${order.orderNumber}`,
          });
        }
      }

      // 5. Delete order completely from DB (cascades to orderItems)
      const [deletedOrder] = await tx
        .delete(orders)
        .where(eq(orders.id, orderId))
        .returning();

      return { ...deletedOrder, status: "deleted" };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Cancel order error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
