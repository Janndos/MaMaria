import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByPhone } from "@/lib/db";
import { normalizePhone, createSession } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { phone, password } = await req.json();
    const raw = String(phone ?? "").trim();

    // 10 attempts / 5 min per IP+identifier — slows credential stuffing/brute force.
    const rl = rateLimit(`login:${clientIp(req)}:${raw.toLowerCase()}`, 10, 5 * 60_000);
    if (!rl.ok) return jsonError(429, `Prea multe încercări. Reîncercați peste ${rl.retryAfterS} secunde.`);

    // MVP/demo: the literal identifier "admin" maps to the seeded staff account
    // (stored with phone="admin"). Replace with proper admin credentials +
    // rate limiting before production.
    let lookup: string | null;
    if (raw.toLowerCase() === "admin") {
      lookup = "admin";
    } else {
      lookup = normalizePhone(raw);
      if (!lookup) return jsonError(400, "Număr de telefon invalid.");
    }

    const user = findUserByPhone(lookup);
    if (!user || !(await bcrypt.compare(String(password ?? ""), user.password_hash)))
      return jsonError(401, "Date de autentificare incorecte.");
    if (!user.phone_verified)
      return NextResponse.json({ ok: false, needsVerification: true, phone: lookup });
    await createSession(user.id, user.role);
    return NextResponse.json({ ok: true, role: user.role });
  });
}
