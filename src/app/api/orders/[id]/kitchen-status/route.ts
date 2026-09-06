import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PATCH /api/orders/[id]/kitchen-status - Update kitchen ticket status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await req.json();
    const { kitchenStatus } = body;

    const validStatuses = ["pending", "preparing", "ready", "served"];
    if (!validStatuses.includes(kitchenStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await db
      .update(orders)
      .set({ kitchenStatus })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: `Status dapur berhasil diupdate menjadi ${kitchenStatus}`,
      kitchenStatus,
    });
  } catch (error: any) {
    console.error("Error updating kitchen status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update kitchen status" },
      { status: 500 }
    );
  }
}
