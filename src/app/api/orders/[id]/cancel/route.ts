import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  orderItems,
  ingredients,
  stockMovements,
  productRecipes,
  products,
  cashTransactions,
  pocketTransactions,
  productStockMovements,
  wasteLogs,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let isPrepared = false;
    let cancelReason = "";
    try {
      const body = await req.json();
      isPrepared = Boolean(body.isPrepared);
      cancelReason = body.cancelReason || "";
    } catch {
      // Body may be empty if called without json payload
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
      // 1. Fetch items for this order
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      if (isPrepared) {
        // Industry Standard: If food was already prepared, DO NOT return raw stock!
        // Record each item in waste_logs as operational food waste
        for (const item of items) {
          const itemLoss = parseFloat(item.hppTotal?.toString() || "0");
          await tx.insert(wasteLogs).values({
            productId: item.productId || null,
            itemName: item.productName,
            qty: item.qty.toString(),
            unit: "porsi",
            costPerUnit: item.hppPerUnit.toString(),
            totalLoss: itemLoss.toString(),
            reason: "burnt", // closest match for prep loss
            note: `Batal Order ${order.orderNumber}: ${cancelReason || "Makanan sudah terlanjur dimasak"}`,
            loggedBy: session.id,
          });
        }
      } else {
        // Food was NOT prepared: Safely restore raw ingredients / finished goods stock
        for (const item of items) {
          if (!item.productId) continue;

          const prod = await tx.query.products.findFirst({
            where: eq(products.id, item.productId),
          });

          if (!prod) continue;

          const orderQtyVal = parseFloat(item.qty.toString());
          const isMakeToOrder = (prod.fulfillmentType || "make_to_order") === "make_to_order";

          if (!isMakeToOrder) {
            // Restore MTS product stock
            const currentStock = parseFloat(prod.currentStock.toString());
            const newStock = currentStock + orderQtyVal;

            await tx
              .update(products)
              .set({
                currentStock: newStock.toString(),
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));

            await tx.insert(productStockMovements).values({
              productId: item.productId,
              type: "return",
              qty: orderQtyVal.toString(),
              refId: `CANCEL-${order.orderNumber}`,
              userId: session.id,
            });
          } else {
            // Restore MTO raw/prep ingredients from recipe
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
                reason: `Retur pembatalan pesanan MTO ${order.orderNumber}${cancelReason ? ` (${cancelReason})` : ""}`,
                userId: session.id,
              });
            }
          }
        }
      }

      // 2. Reverse cash & pockets ONLY if order was already paid
      if (order.status === "paid") {
        const orderAmount = parseFloat(order.grandTotal?.toString() || "0") > 0
          ? order.grandTotal
          : order.revenueTotal;

        await tx.insert(cashTransactions).values({
          type: "out",
          category: "Retur Penjualan",
          isOperational: false,
          description: `Pembatalan Order ${order.orderNumber}${cancelReason ? `: ${cancelReason}` : ""}`,
          amount: orderAmount.toString(),
          date: new Date(),
          sourceType: "order",
          sourceRefId: order.orderNumber,
          paymentGroup: order.paymentMethod === "cash" ? "tunai" : "non_tunai",
          createdBy: session.id,
        });

        // Reverse pocket_transactions from this order
        const prevPocketTxs = await tx
          .select()
          .from(pocketTransactions)
          .where(eq(pocketTransactions.sourceRefId, order.orderNumber));

        for (const ptx of prevPocketTxs) {
          if (ptx.direction === "credit") {
            await tx.insert(pocketTransactions).values({
              pocketId: ptx.pocketId,
              direction: "debit",
              amount: ptx.amount,
              sourceType: "order",
              sourceRefId: `CANCEL-${order.orderNumber}`,
              note: `Reversal pembatalan Order ${order.orderNumber}`,
            });
          }
        }
      }

      // 3. Non-destructive cancellation: Update order status to 'cancelled' (preserve for audit)
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: "cancelled",
          kitchenStatus: "served", // close from kitchen queue
        })
        .where(eq(orders.id, orderId))
        .returning();

      return {
        ...updatedOrder,
        isPrepared,
        message: isPrepared
          ? `Pesanan ${order.orderNumber} dibatalkan. Makanan telah dicatat sebagai limbah/waste.`
          : `Pesanan ${order.orderNumber} dibatalkan. Stok bahan baku/produk telah dikembalikan.`,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Cancel order error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
