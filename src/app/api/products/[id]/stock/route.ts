import { NextResponse } from "next/server";
import { db } from "@/db";
import { productStockMovements, products, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc, gte, lte, and } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type");

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    let conditions = [eq(productStockMovements.productId, productId)];
    
    if (startDate) {
      conditions.push(gte(productStockMovements.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(productStockMovements.createdAt, end));
    }
    if (type && type !== "all") {
      conditions.push(eq(productStockMovements.type, type));
    }

    const movements = await db
      .select({
        id: productStockMovements.id,
        type: productStockMovements.type,
        qty: productStockMovements.qty,
        refId: productStockMovements.refId,
        reason: productStockMovements.reason,
        userId: productStockMovements.userId,
        createdAt: productStockMovements.createdAt,
      })
      .from(productStockMovements)
      .where(and(...conditions))
      .orderBy(desc(productStockMovements.createdAt))
      .limit(200);

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        currentStock: parseFloat(product.currentStock?.toString() || "0"),
        minStock: parseFloat(product.minStock?.toString() || "0"),
      },
      movements: movements.map((m) => ({
        ...m,
        qty: parseFloat(m.qty.toString()),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
