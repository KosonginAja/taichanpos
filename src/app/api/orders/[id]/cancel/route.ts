import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, ingredients, stockMovements, productRecipes, products, cashTransactions, pocketTransactions, productStockMovements } from "@/db/schema";
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

      // 2. For each item, return stock (MTS to products, MTO to ingredients)
      for (const item of items) {
        if (!item.productId) continue; // Skip if no product ID

        const prod = await tx.query.products.findFirst({
          where: eq(products.id, item.productId),
        });

        if (!prod) continue; // Skip if product completely deleted from DB

        const orderQtyVal = parseFloat(item.qty.toString());
        const isMakeToOrder = (prod.fulfillmentType || "make_to_order") === "make_to_order";

        if (!isMakeToOrder) {
          const currentStock = parseFloat(prod.currentStock.toString());
          const newStock = currentStock + orderQtyVal;

          // Update products stock
          await tx
            .update(products)
            .set({
              currentStock: newStock.toString(),
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));

          // Log product stock movement return (positive quantity)
          await tx.insert(productStockMovements).values({
            productId: item.productId,
            type: "return",
            qty: orderQtyVal.toString(),
            refId: `CANCEL-${order.orderNumber}`,
            userId: session.id,
          });
        } else {
          // Return raw ingredients for MTO product
          const recipes = await tx
            .select({
              ingredientId: productRecipes.ingredientId,
              qty: productRecipes.qty,
              stock: ingredients.stock,
            })
            .from(productRecipes)
            .innerJoin(ingredients, eq(productRecipes.ingredientId, ingredients.id))
            .where(eq(productRecipes.productId, prod.id));

          const yieldQty = parseFloat(prod.yieldQty.toString()) || 1;
          for (const r of recipes) {
            const returnIngQty = (parseFloat(r.qty.toString()) / yieldQty) * orderQtyVal;
            const currentIngStock = parseFloat(r.stock.toString());
            await tx
              .update(ingredients)
              .set({
                stock: (currentIngStock + returnIngQty).toString(),
                updatedAt: new Date(),
              })
              .where(eq(ingredients.id, r.ingredientId));

            await tx.insert(stockMovements).values({
              ingredientId: r.ingredientId,
              type: "return",
              qty: returnIngQty.toString(),
              refId: `CANCEL-${order.orderNumber}`,
              reason: `Retur pembatalan pesanan MTO ${order.orderNumber}`,
              userId: session.id,
            });
          }
        }
      }

      // 3. Insert pembalik kas & pockets ONLY if order was already paid
      if (order.status === "paid") {
        await tx.insert(cashTransactions).values({
          type: "out",
          category: "Retur Penjualan",
          isOperational: false,
          description: `Pembatalan Order ${order.orderNumber}`,
          amount: (parseFloat(order.grandTotal?.toString() || "0") > 0 ? order.grandTotal : order.revenueTotal).toString(),
          date: new Date(),
          sourceType: "order",
          sourceRefId: order.orderNumber,
          paymentGroup: order.paymentMethod === "cash" ? "tunai" : "non_tunai",
          createdBy: session.id,
        });

        // 4. Reverse pocket_transactions dari order ini
        const prevPocketTxs = await tx
          .select()
          .from(pocketTransactions)
          .where(eq(pocketTransactions.sourceRefId, order.orderNumber));

        for (const ptx of prevPocketTxs) {
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
