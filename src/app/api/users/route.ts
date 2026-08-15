import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, ne } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    // Get all users except current admin to prevent self-modifications
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
        isApproved: users.isApproved,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(ne(users.id, session.id))
      .orderBy(desc(users.createdAt));

    return NextResponse.json(allUsers);
  } catch (error: any) {
    console.error("GET users error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
