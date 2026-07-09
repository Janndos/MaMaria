import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth";
import { findUserByPhone } from "@/lib/db";
import { sendOtp, devCodeForClient } from "@/lib/otp";
import { handle, jsonError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { phone } = await req.json();
    const normPhone = normalizePhone(String(phone ?? ""));
    if (!normPhone) return jsonError(400, "Număr de telefon invalid.");
    const rl = rateLimit(`otp-send:${clientIp(req)}:${normPhone}`, 5, 15 * 60_000);
    if (!rl.ok) return jsonError(429, `Prea multe coduri solicitate. Reîncercați peste ${rl.retryAfterS} secunde.`);
    if (!findUserByPhone(normPhone)) return jsonError(404, "Nu există un cont cu acest număr.");
    const sent = await sendOtp(normPhone);
    if (!sent.ok) return jsonError(429, sent.error);
    return NextResponse.json({ ok: true, devCode: devCodeForClient(sent.devCode), expiresInMinutes: sent.expiresInMinutes });
  });
}
