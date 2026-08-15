import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, orderCounters, ingredients, stockMovements, products, productRecipes, cashTransactions, businessSettings, cashPockets, pocketTransactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// GET /api/orders - Fetch order history
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const conditions = [];
    if (status) {
      conditions.push(eq(orders.status, status));
    }
    if (startDate) {
      conditions.push(gte(orders.date, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(orders.date, end));
    }

    const data = await db
      .select()
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.date));

    const result = [];
    for (const order of data) {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        subtotal: parseFloat(order.subtotal.toString()),
        discount: parseFloat(order.discount.toString()),
        taxAmount: parseFloat(order.taxAmount.toString()),
        serviceChargeAmount: parseFloat(order.serviceChargeAmount.toString()),
        hppTotal: parseFloat(order.hppTotal.toString()),
        revenueTotal: parseFloat(order.revenueTotal.toString()),
        roundingAdjustment: parseFloat(order.roundingAdjustment?.toString() || "0"),
        grandTotal: parseFloat(order.grandTotal?.toString() || "0") > 0 ? parseFloat(order.grandTotal.toString()) : parseFloat(order.revenueTotal.toString()),
        profitTotal: parseFloat(order.profitTotal.toString()),
        amountReceived: order.amountReceived ? parseFloat(order.amountReceived.toString()) : null,
        changeAmount: order.changeAmount ? parseFloat(order.changeAmount.toString()) : null,
        items: items.map((i) => ({
          ...i,
          qty: parseFloat(i.qty.toString()),
          hppPerUnit: parseFloat(i.hppPerUnit.toString()),
          hppTotal: parseFloat(i.hppTotal.toString()),
          sellPrice: parseFloat(i.sellPrice.toString()),
          revenueTotal: parseFloat(i.revenueTotal.toString()),
        })),
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET orders error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders - Checkout pesanan (Atomic transaction)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, discount, paymentMethod, amountReceived, customerName, taxAmount, serviceChargeAmount } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0 || !paymentMethod) {
      return NextResponse.json({ error: "Keranjang kosong atau metode pembayaran tidak valid." }, { status: 400 });
    }

    const discountVal = parseFloat(discount || 0);
    const taxAmountVal = parseFloat(taxAmount || 0);
    const serviceChargeAmountVal = parseFloat(serviceChargeAmount || 0);
    const amountReceivedVal = amountReceived ? parseFloat(amountReceived) : null;

    // Checkout transaction
    const finalOrder = await db.transaction(async (tx) => {
      // 1. Gather all recipe ingredients and calculate required stock
      const combinedRequiredIngredients: { [ingId: number]: { qty: number; name: string } } = {};
      const productHpps: { [prodId: number]: number } = {};

      for (const item of items) {
        const prod = await tx.query.products.findFirst({
          where: eq(products.id, item.productId),
        });

        if (!prod || !prod.isActive) {
          throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan atau sudah tidak aktif.`);
        }

        const recipes = await tx
          .select({
            ingredientId: productRecipes.ingredientId,
            qty: productRecipes.qty,
            name: ingredients.name,
            price: ingredients.price,
          })
          .from(productRecipes)
          .innerJoin(ingredients, eq(productRecipes.ingredientId, ingredients.id))
          .where(eq(productRecipes.productId, prod.id));

        let productHppCost = 0;
        const yieldQty = parseFloat(prod.yieldQty.toString());

        for (const r of recipes) {
          const recQty = parseFloat(r.qty.toString());
          const ingPrice = parseFloat(r.price.toString());

          // HPP contribution for 1 batch = qty * price. HPP per porsi = contribution / yieldQty
          const hppContributionPerPorsi = yieldQty > 0 ? (recQty * ingPrice) / yieldQty : 0;
          productHppCost += hppContributionPerPorsi;

          // Combined ingredient calculation: required = item.qty * recQty / yieldQty
          const requiredQty = yieldQty > 0 ? (parseFloat(item.qty) * recQty) / yieldQty : 0;

          if (!combinedRequiredIngredients[r.ingredientId]) {
            combinedRequiredIngredients[r.ingredientId] = { qty: 0, name: r.name };
          }
          combinedRequiredIngredients[r.ingredientId].qty += requiredQty;
        }

        productHpps[prod.id] = productHppCost;
      }

      // 2. Validate ingredients stock
      const stockErrors: string[] = [];
      const updatedIngredients: { id: number; newStock: number }[] = [];

      for (const ingIdStr of Object.keys(combinedRequiredIngredients)) {
        const ingId = parseInt(ingIdStr);
        const reqInfo = combinedRequiredIngredients[ingId];

        const ing = await tx.query.ingredients.findFirst({
          where: eq(ingredients.id, ingId),
        });

        if (!ing) {
          throw new Error(`Bahan baku dengan ID ${ingId} tidak ditemukan.`);
        }

        const currentStock = parseFloat(ing.stock.toString());
        if (currentStock < reqInfo.qty) {
          const shortage = reqInfo.qty - currentStock;
          stockErrors.push(`Stok ${reqInfo.name} kurang: butuh ${reqInfo.qty.toFixed(2)} ${ing.unit}, tersedia ${currentStock.toFixed(2)} ${ing.unit} (kurang ${shortage.toFixed(2)}).`);
        } else {
          updatedIngredients.push({ id: ingId, newStock: currentStock - reqInfo.qty });
        }
      }

      if (stockErrors.length > 0) {
        throw new Error(stockErrors.join(" "));
      }

      // 3. Generate receipt invoice number atomically
      const now = new Date();
      const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      // Insert or Update the sequence counter
      const [counter] = await tx
        .insert(orderCounters)
        .values({ dateKey, lastSeq: 1 })
        .onConflictDoUpdate({
          target: orderCounters.dateKey,
          set: { lastSeq: sql`${orderCounters.lastSeq} + 1` },
        })
        .returning();

      const seq = String(counter.lastSeq).padStart(3, "0");
      const orderNumber = `INV-${dateKey}-${seq}`;

      // 4. Update stock and write movements
      for (const update of updatedIngredients) {
        const reqQty = combinedRequiredIngredients[update.id].qty;

        await tx
          .update(ingredients)
          .set({
            stock: update.newStock.toString(),
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, update.id));

        await tx.insert(stockMovements).values({
          ingredientId: update.id,
          type: "order",
          qty: (-reqQty).toString(),
          refId: orderNumber,
          userId: session.id,
        });
      }

      // 5. Calculate order totals
      let subtotal = 0;
      let hppTotal = 0;

      for (const item of items) {
        const prod = await tx.query.products.findFirst({
          where: eq(products.id, item.productId),
        });
        if (!prod) throw new Error("Product missing");
        subtotal += parseFloat(item.qty) * parseFloat(prod.sellPrice.toString());
        hppTotal += parseFloat(item.qty) * productHpps[item.productId];
      }

      const revenueTotal = subtotal - discountVal + taxAmountVal + serviceChargeAmountVal;
      const profitTotal = revenueTotal - hppTotal;

      const bs = await tx.query.businessSettings.findFirst();
      const roundingEnabled = bs?.roundingEnabled || false;
      const roundingNearest = parseFloat(bs?.roundingNearest?.toString() || "100");
      let grandTotal = revenueTotal;
      let roundingAdjustment = 0;

      if (roundingEnabled) {
        grandTotal = Math.round(revenueTotal / roundingNearest) * roundingNearest;
        roundingAdjustment = grandTotal - revenueTotal;
      }

      const changeAmount = amountReceivedVal !== null ? amountReceivedVal - grandTotal : null;

      if (paymentMethod === "cash" && amountReceivedVal !== null && changeAmount !== null && changeAmount < 0) {
        throw new Error("Uang yang diterima kurang dari total pembayaran.");
      }

      // 6. Insert Order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          subtotal: subtotal.toString(),
          discount: discountVal.toString(),
          taxAmount: taxAmountVal.toString(),
          serviceChargeAmount: serviceChargeAmountVal.toString(),
          hppTotal: hppTotal.toString(),
          revenueTotal: revenueTotal.toString(),
          roundingAdjustment: roundingAdjustment.toString(),
          grandTotal: grandTotal.toString(),
          profitTotal: profitTotal.toString(),
          paymentMethod,
          amountReceived: amountReceivedVal ? amountReceivedVal.toString() : null,
          changeAmount: changeAmount !== null ? changeAmount.toString() : null,
          customerName: customerName || null,
          status: "paid",
          cashierId: session.id,
        })
        .returning();

      // 7. Insert Order Items
      for (const item of items) {
        const prod = await tx.query.products.findFirst({
          where: eq(products.id, item.productId),
        });
        if (!prod) throw new Error("Product missing");

        const qtyVal = parseFloat(item.qty);
        const sellPriceVal = parseFloat(prod.sellPrice.toString());
        const hppPerUnitVal = productHpps[item.productId];
        const itemHppTotal = qtyVal * hppPerUnitVal;
        const itemRevenueTotal = qtyVal * sellPriceVal;

        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: prod.id,
          productName: prod.name,
          qty: qtyVal.toString(),
          hppPerUnit: hppPerUnitVal.toString(),
          hppTotal: itemHppTotal.toString(),
          sellPrice: sellPriceVal.toString(),
          revenueTotal: itemRevenueTotal.toString(),
        });
      }

      // 8. Auto-insert kas masuk dari penjualan
      await tx.insert(cashTransactions).values({
        type: "in",
        category: "Penjualan",
        isOperational: false, // Revenue is tracked separately via orders, not double-counted in P&L expenses
        description: `Penjualan Order ${orderNumber}`,
        amount: grandTotal.toString(),
        date: now,
        sourceType: "order",
        sourceRefId: orderNumber,
        createdBy: session.id,
      });

      // 9. Auto-split kas masuk ke pocket_transactions (Kantong Kas)
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
          sourceRefId: orderNumber,
          note: `HPP dari Pesanan ${orderNumber}`,
        });
      }

      if (profitPockets.length > 0) {
        for (const pocket of profitPockets) {
          const pct = parseFloat(pocket.percentage?.toString() || '0');
          if (pct > 0) {
            let amount = (profitTotal * pct) / 100;
            if (pocket.id === companyPocket?.id) {
              amount += roundingAdjustment;
            }
            if (amount !== 0) {
              await tx.insert(pocketTransactions).values({
                pocketId: pocket.id,
                direction: 'credit',
                amount: amount.toString(),
                sourceType: 'order',
                sourceRefId: orderNumber,
                note: `Profit Share dari Pesanan ${orderNumber} (${pct}%)`,
              });
            }
          }
        }
      }

      return {
        ...newOrder,
        orderNumber,
      };
    });

    return NextResponse.json(finalOrder, { status: 201 });
  } catch (error: any) {
    console.error("Checkout transaction error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
