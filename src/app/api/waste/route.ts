import { NextResponse } from "next/server";
import { db } from "@/db";
import { wasteLogs, ingredients, products, productRecipes, stockMovements, productStockMovements, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc, and, gte, lte } from "drizzle-orm";

// GET /api/waste - Fetch waste logs and summary
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const conditions = [];
    if (startDate) {
      conditions.push(gte(wasteLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(wasteLogs.createdAt, end));
    }

    const logs = await db
      .select({
        id: wasteLogs.id,
        itemName: wasteLogs.itemName,
        qty: wasteLogs.qty,
        unit: wasteLogs.unit,
        costPerUnit: wasteLogs.costPerUnit,
        totalLoss: wasteLogs.totalLoss,
        reason: wasteLogs.reason,
        note: wasteLogs.note,
        createdAt: wasteLogs.createdAt,
        ingredientId: wasteLogs.ingredientId,
        productId: wasteLogs.productId,
        loggedBy: wasteLogs.loggedBy,
        userName: users.name,
      })
      .from(wasteLogs)
      .leftJoin(users, eq(wasteLogs.loggedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(wasteLogs.createdAt));

    let totalLossAmount = 0;
    const reasonCounts: { [key: string]: number } = {};

    const formattedLogs = logs.map((log) => {
      const loss = parseFloat(log.totalLoss.toString());
      totalLossAmount += loss;
      reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;

      return {
        ...log,
        qty: parseFloat(log.qty.toString()),
        costPerUnit: parseFloat(log.costPerUnit.toString()),
        totalLoss: loss,
      };
    });

    return NextResponse.json({
      logs: formattedLogs,
      summary: {
        totalLossAmount,
        totalCount: formattedLogs.length,
        reasonBreakdown: reasonCounts,
      },
    });
  } catch (error: any) {
    console.error("GET waste error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/waste - Record a new waste entry and deduct stock
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ingredientId, productId, qty, reason, note } = await req.json();

    const qtyVal = parseFloat(qty);
    if (!qtyVal || qtyVal <= 0) {
      return NextResponse.json({ error: "Jumlah waste harus lebih dari 0." }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: "Alasan waste wajib dipilih." }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      let itemName = "";
      let unit = "";
      let costPerUnit = 0;
      let totalLoss = 0;

      if (ingredientId) {
        const ing = await tx.query.ingredients.findFirst({
          where: eq(ingredients.id, ingredientId),
        });

        if (!ing) throw new Error("Bahan baku tidak ditemukan.");

        itemName = ing.name;
        unit = ing.unit;
        costPerUnit = parseFloat(ing.price.toString());
        totalLoss = qtyVal * costPerUnit;

        const currentStock = parseFloat(ing.stock.toString());
        const newStock = currentStock - qtyVal;

        // Update ingredient stock
        await tx
          .update(ingredients)
          .set({
            stock: newStock.toString(),
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, ingredientId));

        // Audit stock movement
        await tx.insert(stockMovements).values({
          ingredientId,
          type: "adjustment",
          qty: (-qtyVal).toString(),
          reason: `Waste (${reason}): ${note || "-"}`,
          userId: session.id,
        });

      } else if (productId) {
        const prod = await tx.query.products.findFirst({
          where: eq(products.id, productId),
        });

        if (!prod) throw new Error("Produk tidak ditemukan.");

        itemName = prod.name;
        unit = "porsi";

        // Calculate HPP cost per unit from recipes
        const recipes = await tx
          .select({
            qty: productRecipes.qty,
            price: ingredients.price,
          })
          .from(productRecipes)
          .innerJoin(ingredients, eq(productRecipes.ingredientId, ingredients.id))
          .where(eq(productRecipes.productId, prod.id));

        const yieldQty = parseFloat(prod.yieldQty.toString()) || 1;
        let batchHpp = 0;
        for (const r of recipes) {
          batchHpp += parseFloat(r.qty.toString()) * parseFloat(r.price.toString());
        }
        costPerUnit = yieldQty > 0 ? batchHpp / yieldQty : 0;
        totalLoss = qtyVal * costPerUnit;

        const currentStock = parseFloat(prod.currentStock.toString());
        const newStock = currentStock - qtyVal;

        // Update product stock
        await tx
          .update(products)
          .set({
            currentStock: newStock.toString(),
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));

        // Audit product stock movement
        await tx.insert(productStockMovements).values({
          productId,
          type: "adjustment",
          qty: (-qtyVal).toString(),
          reason: `Waste (${reason}): ${note || "-"}`,
          userId: session.id,
        });

      } else {
        throw new Error("Pilih bahan baku atau produk yang mengalami waste.");
      }

      // Record in wasteLogs
      const [wasteEntry] = await tx
        .insert(wasteLogs)
        .values({
          ingredientId: ingredientId || null,
          productId: productId || null,
          itemName,
          qty: qtyVal.toString(),
          unit,
          costPerUnit: costPerUnit.toFixed(2),
          totalLoss: totalLoss.toFixed(2),
          reason,
          note: note || null,
          loggedBy: session.id,
        })
        .returning();

      return wasteEntry;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST waste error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
