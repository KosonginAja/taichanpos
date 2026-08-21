import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, products } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, gte, lte, eq, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Rentang tanggal diperlukan." }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Fetch all active products to act as base (so we include products with 0 sales)
    const activeProducts = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true));

    // 2. Fetch aggregated sales from paid orders in the date range
    const salesData = await db
      .select({
        productId: orderItems.productId,
        productName: orderItems.productName,
        qtySold: sql<string>`sum(${orderItems.qty})`,
        totalRevenue: sql<string>`sum(${orderItems.revenueTotal})`,
        totalHpp: sql<string>`sum(${orderItems.hppTotal})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.status, "paid"),
          gte(orders.date, start),
          lte(orders.date, end)
        )
      )
      .groupBy(orderItems.productId, orderItems.productName);

    // Create a map of sales data
    const salesMap = new Map<number, typeof salesData[0]>();
    salesData.forEach((s) => {
      if (s.productId !== null) {
        salesMap.set(s.productId, s);
      }
    });

    const resultList: any[] = [];

    // Add all active products (with sales details or 0)
    activeProducts.forEach((p) => {
      const sales = salesMap.get(p.id);
      const qtySold = sales ? parseFloat(sales.qtySold) : 0;
      const totalRevenue = sales ? parseFloat(sales.totalRevenue) : 0;
      const totalHpp = sales ? parseFloat(sales.totalHpp) : 0;
      const profitContribution = totalRevenue - totalHpp;
      const marginPerUnit = qtySold > 0 ? (totalRevenue - totalHpp) / qtySold : (parseFloat(p.sellPrice.toString()) - (p.hppToday ? parseFloat(p.hppToday.toString()) : 0));

      resultList.push({
        id: p.id,
        name: p.name,
        sellPrice: parseFloat(p.sellPrice.toString()),
        qtySold,
        totalRevenue,
        totalHpp,
        profitContribution,
        marginPerUnit,
      });
    });

    // Also check if there are sales for products that are now inactive/deleted
    salesData.forEach((s) => {
      if (s.productId !== null && !activeProducts.some((p) => p.id === s.productId)) {
        const qtySold = parseFloat(s.qtySold);
        const totalRevenue = parseFloat(s.totalRevenue);
        const totalHpp = parseFloat(s.totalHpp);
        const profitContribution = totalRevenue - totalHpp;
        const marginPerUnit = qtySold > 0 ? profitContribution / qtySold : 0;

        resultList.push({
          id: s.productId,
          name: s.productName + " (Nonaktif)",
          sellPrice: qtySold > 0 ? totalRevenue / qtySold : 0,
          qtySold,
          totalRevenue,
          totalHpp,
          profitContribution,
          marginPerUnit,
        });
      }
    });

    // Sort by qtySold descending by default
    resultList.sort((a, b) => b.qtySold - a.qtySold);

    // Calculate Best Seller threshold (top 20% of sold quantities)
    const maxQtySold = resultList.length > 0 ? Math.max(...resultList.map((r) => r.qtySold)) : 0;
    
    const formattedResult = resultList.map((item) => {
      let badge = "Aman"; // default / regular product
      if (item.qtySold === 0) {
        badge = "Tidak Laku";
      } else if (maxQtySold > 0 && item.qtySold >= maxQtySold * 0.7) {
        // Top sellers (70% or more of the top selling product's volume)
        badge = "Best Seller";
      } else if (item.qtySold < 5) {
        badge = "Kurang Laris";
      }

      return {
        ...item,
        badge,
      };
    });

    return NextResponse.json(formattedResult);
  } catch (error: any) {
    console.error("GET menu-analysis error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
