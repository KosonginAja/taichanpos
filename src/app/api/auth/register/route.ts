import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/crypto";
import { eq, or } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { name, username, email, password } = await req.json();

    if (!name || !username || !email || !password) {
      return NextResponse.json({ error: "Nama, username, email, dan password wajib diisi." }, { status: 400 });
    }

    // Validasi format username: huruf kecil, angka, underscore saja, min 3 karakter
    const usernameRegex = /^[a-z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json({
        error: "Username hanya boleh mengandung huruf kecil, angka, dan underscore (_), minimal 3 karakter.",
      }, { status: 400 });
    }

    // Cek apakah email atau username sudah ada
    const existingUser = await db.query.users.findFirst({
      where: or(
        eq(users.email, email.toLowerCase()),
        eq(users.username, username.toLowerCase())
      ),
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 400 });
      }
      return NextResponse.json({ error: "Username sudah digunakan, coba yang lain." }, { status: 400 });
    }

    // Cek apakah ini user pertama — jika ya, otomatis jadi admin & approved
    const allUsers = await db.select().from(users).limit(1);
    const isFirstUser = allUsers.length === 0;
    const assignedRole = isFirstUser ? "admin" : "kasir";
    const isApproved = isFirstUser;

    const passwordHash = hashPassword(password);

    const [newUser] = await db.insert(users).values({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      isApproved,
    }).returning({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
      isApproved: users.isApproved,
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
