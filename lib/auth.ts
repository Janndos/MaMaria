import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { findUserById, User } from "./db";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-in-production");
const COOKIE = "mamaria_session";

/** Normalize a Moldovan phone number to +373XXXXXXXX, or return null if invalid. */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  const m = compact.match(/^(?:\+373|373|0)?(\d{8})$/);
  if (!m) return null;
  if (!compact.startsWith("+373") && !compact.startsWith("373") && !compact.startsWith("0") && compact.length !== 8) return null;
  return "+373" + m[1];
}

/** Format +373XXXXXXXX as +373 XX XXX XXX for display. */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+373(\d{2})(\d{3})(\d{3})$/);
  return m ? `+373 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

export async function createSession(userId: number, role: string) {
  const token = await new SignJWT({ uid: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  cookies().set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, path: "/",
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function verifyToken(token: string): Promise<{ uid: number; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { uid: Number(payload.uid), role: String(payload.role) };
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return findUserById(payload.uid) ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new AuthError(401, "Autentificare necesară.");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") throw new AuthError(403, "Acces doar pentru administrator.");
  return u;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export const SESSION_COOKIE = COOKIE;
