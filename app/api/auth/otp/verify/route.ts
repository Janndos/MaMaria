import { NextRequest, NextResponse } from "next/server";
import db, { findUserByPhone } from "@/lib/db";
import { normalizePhone, createSession } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp";
import { handle, jsonError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { phone, code } = await req.json();
    const normPhone = normalizePhone(String(phone ?? ""));
    if (!normPhone) return jsonError(400, "Număr de telefon invalid.");
    const rl = rateLimit(`otp-verify:${clientIp(req)}:${normPhone}`, 15, 15 * 60_000);
    if (!rl.ok) return jsonError(429, `Prea multe încercări. Reîncercați peste ${rl.retryAfterS} secunde.`);
    const user = findUserByPhone(normPhone);
    if (!user) return jsonError(404, "Nu există un cont cu acest număr.");
    const result = await verifyOtp(normPhone, String(code ?? ""));
    if (!result.ok) return jsonError(400, result.error);
    db.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").run(user.id);
    await createSession(user.id, user.role);
    return NextResponse.json({ ok: true, role: user.role });
  });
}
