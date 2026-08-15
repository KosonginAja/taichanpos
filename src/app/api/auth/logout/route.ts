import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}

export async function GET() {
  await destroySession();
  // Redirect to login page
  return NextResponse.redirect(new URL("/login", process.env.BETTER_AUTH_URL || "http://localhost:3000"));
}
