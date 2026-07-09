import crypto from "crypto";
import db from "./db";
import { twilioVerifyConfigured, startVerification, checkVerification } from "./twilio-verify";

export const OTP_TTL_MINUTES = 5;
export const OTP_RESEND_COOLDOWN_S = 60;
export const OTP_MAX_ATTEMPTS = 5;

// When Twilio Verify credentials are present we delegate code generation, SMS
// delivery, expiry and attempt-limiting to Twilio's managed service. Otherwise
// we fall back to the local simulated provider (dev/testing, no cost).
const TWILIO_VERIFY_TTL_MINUTES = 10; // Twilio Verify default code lifetime

/* ---------- SMS provider abstraction ----------
 * MVP runs with the simulated provider (code is logged and, in dev,
 * returned to the client so the flow is fully testable without cost).
 * To go live: implement send() with Twilio/Vonage and set SMS_PROVIDER=twilio
 * plus the provider credentials in the environment.
 */
export interface SmsProvider {
  name: string;
  send(phone: string, message: string): Promise<{ ok: boolean; devCode?: string }>;
}

class SimulatedProvider implements SmsProvider {
  name = "simulated";
  async send(phone: string, message: string) {
    console.log(`[SMS SIMULAT] către ${phone}: ${message}`);
    return { ok: true };
  }
}

class TwilioProvider implements SmsProvider {
  name = "twilio";
  async send(phone: string, message: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) throw new Error("Twilio credentials missing");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: from, Body: message }),
    });
    return { ok: res.ok };
  }
}

export function getSmsProvider(): SmsProvider {
  return process.env.SMS_PROVIDER === "twilio" ? new TwilioProvider() : new SimulatedProvider();
}

/** In production we never echo the OTP back to the client, even with the simulated
 *  provider — the code should only ever travel by SMS. In dev it powers the demo banner. */
export function devCodeForClient(devCode?: string | null): string | null {
  return process.env.NODE_ENV === "production" ? null : devCode ?? null;
}

/* ---------- OTP lifecycle ---------- */
function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export type SendResult =
  | { ok: true; devCode?: string; expiresInMinutes: number }
  | { ok: false; error: string; retryAfterS?: number };

export async function sendOtp(phone: string): Promise<SendResult> {
  // Local resend cooldown — protects the user (and our Twilio bill) from rapid
  // re-sends, regardless of which provider actually delivers the SMS.
  const last = db.prepare(
    "SELECT created_at FROM otp_codes WHERE phone = ? ORDER BY id DESC LIMIT 1"
  ).get(phone) as { created_at: string } | undefined;

  if (last) {
    const elapsed = (Date.now() - new Date(last.created_at + "Z").getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_S) {
      const retryAfterS = Math.ceil(OTP_RESEND_COOLDOWN_S - elapsed);
      return { ok: false, error: `Așteptați ${retryAfterS} secunde înainte de a retrimite codul.`, retryAfterS };
    }
  }

  // ---- Twilio Verify path (production) --------------------------------------
  if (twilioVerifyConfigured()) {
    const started = await startVerification(phone);
    if (!started.ok) return { ok: false, error: started.error };
    // Track the send time only (no code stored — Twilio owns the code) so the
    // resend cooldown above keeps working.
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0").run(phone);
    db.prepare(
      "INSERT INTO otp_codes (phone, code_hash, purpose, expires_at) VALUES (?,?, 'twilio', datetime('now', ?))"
    ).run(phone, "twilio-verify", `+${TWILIO_VERIFY_TTL_MINUTES} minutes`);
    return { ok: true, expiresInMinutes: TWILIO_VERIFY_TTL_MINUTES };
  }

  // ---- Simulated local provider (dev) ---------------------------------------
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare("UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0").run(phone);
  db.prepare(
    "INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES (?,?, datetime('now', ?))"
  ).run(phone, hashCode(code), `+${OTP_TTL_MINUTES} minutes`);

  const provider = getSmsProvider();
  await provider.send(phone, `Ma'Maria: codul dvs. de verificare este ${code}. Expiră în ${OTP_TTL_MINUTES} minute.`);

  const devCode = provider.name === "simulated" ? code : undefined;
  return { ok: true, devCode, expiresInMinutes: OTP_TTL_MINUTES };
}

export async function verifyOtp(phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // ---- Twilio Verify path ---------------------------------------------------
  if (twilioVerifyConfigured()) {
    const checked = await checkVerification(phone, code.trim());
    if (checked.ok) {
      db.prepare("UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0").run(phone);
    }
    return checked;
  }

  // ---- Simulated local provider (dev) ---------------------------------------
  const row = db.prepare(
    "SELECT * FROM otp_codes WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1"
  ).get(phone) as { id: number; code_hash: string; attempts: number; expires_at: string } | undefined;

  if (!row) return { ok: false, error: "Nu există un cod activ. Solicitați un cod nou." };
  if (new Date(row.expires_at + "Z").getTime() < Date.now()) {
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Codul a expirat. Solicitați un cod nou." };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Prea multe încercări. Solicitați un cod nou." };
  }
  if (hashCode(code.trim()) !== row.code_hash) {
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Cod incorect. Verificați și încercați din nou." };
  }
  db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);
  return { ok: true };
}
