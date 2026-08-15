import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashPockets } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const pockets = await db.query.cashPockets.findMany({
      orderBy: [asc(cashPockets.sortOrder)],
    });
    return NextResponse.json(pockets);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { label, type, percentage, sortOrder } = body;

    const newPocket = await db.insert(cashPockets).values({
      label,
      type,
      percentage: type === "profit_share" ? (percentage || 0) : null,
      sortOrder: sortOrder || 0,
      isActive: true,
    }).returning();

    return NextResponse.json(newPocket[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
