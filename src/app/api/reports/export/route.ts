import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, gte, lte, eq, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date are required." }, { status: 400 });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Fetch orders in range
    const ordersData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        date: orders.date,
        subtotal: orders.subtotal,
        discount: orders.discount,
        hppTotal: orders.hppTotal,
        revenueTotal: orders.revenueTotal,
        grandTotal: orders.grandTotal,
        roundingAdjustment: orders.roundingAdjustment,
        profitTotal: orders.profitTotal,
        paymentMethod: orders.paymentMethod,
        customerName: orders.customerName,
        status: orders.status,
        cashierName: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(orders.cashierId, users.id))
      .where(and(gte(orders.date, start), lte(orders.date, end)));

    // 2. Fetch order items in range
    const orderIds = ordersData.map((o) => o.id);
    let itemsData: any[] = [];
    if (orderIds.length > 0) {
      itemsData = await db
        .select({
          orderNumber: orders.orderNumber,
          date: orders.date,
          productName: orderItems.productName,
          qty: orderItems.qty,
          sellPrice: orderItems.sellPrice,
          hppPerUnit: orderItems.hppPerUnit,
          hppTotal: orderItems.hppTotal,
          revenueTotal: orderItems.revenueTotal,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(inArray(orderItems.orderId, orderIds));
    }

    // 3. Compile daily summary
    const dailyMap: {
      [dateStr: string]: {
        date: string;
        ordersCount: number;
        revenue: number;
        hpp: number;
        profit: number;
      };
    } = {};

    for (const o of ordersData) {
      if (o.status === "cancelled") continue; // Skip cancelled in financial summary
      const d = new Date(o.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = {
          date: dateStr,
          ordersCount: 0,
          revenue: 0,
          hpp: 0,
          profit: 0,
        };
      }
      dailyMap[dateStr].ordersCount += 1;
      dailyMap[dateStr].revenue += parseFloat(o.grandTotal?.toString() || o.revenueTotal.toString());
      dailyMap[dateStr].hpp += parseFloat(o.hppTotal.toString());
      dailyMap[dateStr].profit += parseFloat(o.grandTotal?.toString() || o.revenueTotal.toString()) - parseFloat(o.hppTotal.toString());
    }

    const dailySummary = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Map output
    const ordersList = ordersData.map((o) => ({
      orderNumber: o.orderNumber,
      date: new Date(o.date).toISOString().replace("T", " ").substring(0, 19),
      customerName: o.customerName || "-",
      cashierName: o.cashierName || "-",
      paymentMethod: o.paymentMethod.toUpperCase(),
      status: o.status,
      subtotal: parseFloat(o.subtotal.toString()),
      discount: parseFloat(o.discount.toString()),
      revenueTotal: parseFloat(o.grandTotal?.toString() || o.revenueTotal.toString()),
      hppTotal: parseFloat(o.hppTotal.toString()),
      profitTotal: parseFloat(o.grandTotal?.toString() || o.revenueTotal.toString()) - parseFloat(o.hppTotal.toString()),
    }));

    const itemsList = itemsData.map((i) => ({
      orderNumber: i.orderNumber,
      date: new Date(i.date).toISOString().replace("T", " ").substring(0, 19),
      productName: i.productName,
      qty: parseFloat(i.qty.toString()),
      sellPrice: parseFloat(i.sellPrice.toString()),
      hppPerUnit: parseFloat(i.hppPerUnit.toString()),
      revenueTotal: parseFloat(i.revenueTotal.toString()),
      hppTotal: parseFloat(i.hppTotal.toString()),
    }));

    return NextResponse.json({
      dailySummary,
      ordersList,
      itemsList,
    });
  } catch (error: any) {
    console.error("Export report error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
