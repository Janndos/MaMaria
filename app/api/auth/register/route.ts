import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db, { findUserByPhone } from "@/lib/db";
import { normalizePhone } from "@/lib/auth";
import { sendOtp, devCodeForClient } from "@/lib/otp";
import { handle, jsonError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000);
    if (!rl.ok) return jsonError(429, `Prea multe încercări. Reîncercați peste ${rl.retryAfterS} secunde.`);

    const { fullName, phone, password, confirmPassword } = await req.json();
    if (!fullName || String(fullName).trim().length < 3)
      return jsonError(400, "Introduceți numele complet (minim 3 caractere).");
    const normPhone = normalizePhone(String(phone ?? ""));
    if (!normPhone)
      return jsonError(400, "Număr de telefon invalid. Format acceptat: +373 XX XXX XXX.");
    if (!password || String(password).length < 8)
      return jsonError(400, "Parola trebuie să aibă minim 8 caractere.");
    if (password !== confirmPassword)
      return jsonError(400, "Parolele nu coincid.");

    const existing = findUserByPhone(normPhone);
    if (existing && existing.phone_verified)
      return jsonError(409, "Există deja un cont cu acest număr. Autentificați-vă.");

    const hash = await bcrypt.hash(String(password), 10);
    if (existing) {
      db.prepare("UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?")
        .run(String(fullName).trim(), hash, existing.id);
    } else {
      db.prepare("INSERT INTO users (full_name, phone, password_hash) VALUES (?,?,?)")
        .run(String(fullName).trim(), normPhone, hash);
    }
    const sent = await sendOtp(normPhone);
    if (!sent.ok) return jsonError(429, sent.error);
    return NextResponse.json({ ok: true, phone: normPhone, devCode: devCodeForClient(sent.devCode) });
  });
}
