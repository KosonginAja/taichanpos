import { cookies } from "next/headers";
import { decryptToken, encryptToken } from "./crypto";

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string; // "admin" | "kasir"
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return null;
    return decryptToken<SessionUser>(token);
  } catch (e) {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const token = encryptToken(user);
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
}
