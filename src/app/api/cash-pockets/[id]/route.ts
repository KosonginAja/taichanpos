import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashPockets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const { label, isActive, percentage, sortOrder } = body;

    const pocket = await db.select().from(cashPockets).where(eq(cashPockets.id, id));
    if (pocket.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.update(cashPockets)
      .set({
        label: label !== undefined ? label : pocket[0].label,
        isActive: isActive !== undefined ? isActive : pocket[0].isActive,
        percentage: pocket[0].type === "profit_share" && percentage !== undefined ? percentage : pocket[0].percentage,
        sortOrder: sortOrder !== undefined ? sortOrder : pocket[0].sortOrder,
      })
      .where(eq(cashPockets.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const pocket = await db.select().from(cashPockets).where(eq(cashPockets.id, id));
    if (pocket.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pocket[0].type === "cost") return NextResponse.json({ error: "Cannot delete cost pocket" }, { status: 400 });

    await db.delete(cashPockets).where(eq(cashPockets.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
