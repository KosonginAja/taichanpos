import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, cashTransactions, profitAllocations, profitAllocationItems } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET — list all allocation history
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allocations = await db
      .select()
      .from(profitAllocations)
      .orderBy(profitAllocations.createdAt);

    const result = await Promise.all(
      allocations.map(async (alloc) => {
        const items = await db
          .select()
          .from(profitAllocationItems)
          .where(eq(profitAllocationItems.profitAllocationId, alloc.id));

        return {
          ...alloc,
          netProfit: parseFloat(alloc.netProfit.toString()),
          items: items.map((i) => ({
            ...i,
            percentage: parseFloat(i.percentage.toString()),
            amount: parseFloat(i.amount.toString()),
          })),
        };
      })
    );

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
