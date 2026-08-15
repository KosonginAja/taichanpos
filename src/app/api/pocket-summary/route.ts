import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashPockets, pocketTransactions } from "@/db/schema";
import { asc, eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const pockets = await db.select().from(cashPockets).orderBy(asc(cashPockets.sortOrder));

    const result = [];
    for (const pocket of pockets) {
      const txs = await db
        .select()
        .from(pocketTransactions)
        .where(eq(pocketTransactions.pocketId, pocket.id))
        .orderBy(desc(pocketTransactions.createdAt));

      const balance = txs.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount.toString());
        return tx.direction === "credit" ? sum + amount : sum - amount;
      }, 0);

      result.push({
        ...pocket,
        percentage: pocket.percentage ? parseFloat(pocket.percentage.toString()) : null,
        balance,
        transactions: txs.slice(0, 50).map((tx) => ({
          ...tx,
          amount: parseFloat(tx.amount.toString()),
        })),
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
