import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/crypto";
import { setSession } from "@/lib/auth";
import { eq, or } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username/email dan password wajib diisi." }, { status: 400 });
    }

    // Cari user berdasarkan username ATAU email
    const user = await db.query.users.findFirst({
      where: or(
        eq(users.email, identifier.toLowerCase()),
        eq(users.username, identifier.toLowerCase())
      ),
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Username/email atau password salah." }, { status: 401 });
    }

    if (!user.isApproved) {
      return NextResponse.json({
        error: "Akun Anda belum disetujui oleh Admin. Silakan hubungi Admin.",
      }, { status: 403 });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    await setSession(sessionUser);

    return NextResponse.json({ user: sessionUser });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
