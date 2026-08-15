import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, ingredients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, gte, lte, desc, not } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Fetch today's orders
    const todayOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          gte(orders.date, startOfToday),
          lte(orders.date, endOfToday),
          eq(orders.status, "paid")
        )
      );

    const totalOrdersToday = todayOrders.length;
    const revenueToday = todayOrders.reduce((sum, o) => sum + parseFloat(o.grandTotal.toString()), 0);
    const profitToday = todayOrders.reduce((sum, o) => sum + (parseFloat(o.grandTotal.toString()) - parseFloat(o.hppTotal.toString())), 0);

    // 2. Fetch low stock count
    const allActiveIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.isActive, true));

    const lowStockIngredients = allActiveIngredients
      .map((item) => {
        const stock = parseFloat(item.stock.toString());
        const minStock = parseFloat(item.minStock.toString());
        return {
          ...item,
          stock,
          minStock,
          status: stock <= 0 ? "Habis" : stock <= minStock ? "Menipis" : "Aman",
        };
      })
      .filter((item) => item.status !== "Aman");

    const lowStockCount = lowStockIngredients.length;

    // 3. Recent orders (last 5)
    const recent = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.date))
      .limit(5);

    const recentOrders = recent.map((o) => ({
      ...o,
      subtotal: parseFloat(o.subtotal.toString()),
      discount: parseFloat(o.discount.toString()),
      revenueTotal: parseFloat(o.grandTotal.toString()),
      profitTotal: (parseFloat(o.grandTotal.toString()) - parseFloat(o.hppTotal.toString())),
    }));

    // 4. Daily chart data (last 30 days)
    const chartDays = 30;
    const chartData = [];
    const dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - chartDays + 1);
    dateRangeStart.setHours(0, 0, 0, 0);

    const periodOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          gte(orders.date, dateRangeStart),
          eq(orders.status, "paid")
        )
      );

    // Map orders by date key "YYYY-MM-DD"
    const orderMap: { [dateStr: string]: { revenue: number; profit: number } } = {};
    for (const o of periodOrders) {
      const d = new Date(o.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!orderMap[dateStr]) {
        orderMap[dateStr] = { revenue: 0, profit: 0 };
      }
      orderMap[dateStr].revenue += parseFloat(o.grandTotal.toString());
      orderMap[dateStr].profit += (parseFloat(o.grandTotal.toString()) - parseFloat(o.hppTotal.toString()));
    }

    for (let i = 0; i < chartDays; i++) {
      const tempDate = new Date();
      tempDate.setDate(tempDate.getDate() - chartDays + 1 + i);
      const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, "0")}-${String(tempDate.getDate()).padStart(2, "0")}`;
      
      // Short label format (e.g., "06 Aug")
      const label = tempDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

      chartData.push({
        date: dateStr,
        label,
        revenue: orderMap[dateStr]?.revenue || 0,
        profit: orderMap[dateStr]?.profit || 0,
      });
    }

    return NextResponse.json({
      summary: {
        totalOrdersToday,
        revenueToday,
        profitToday,
        lowStockCount,
      },
      lowStockIngredients: lowStockIngredients.slice(0, 5),
      recentOrders,
      chartData,
    });
  } catch (error: any) {
    console.error("GET dashboard report error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
