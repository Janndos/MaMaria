/* ============================================================================
 *  Twilio Verify integration (server-only)
 *  ----------------------------------------------------------------------------
 *  Twilio Verify is a managed OTP service: Twilio generates the code, sends the
 *  SMS, enforces code expiry (~10 min) and its own max-check-attempts. We never
 *  see or store the code — we only ask Twilio to (a) start a verification and
 *  (b) check a user-entered code. All calls happen here, on the backend, using
 *  credentials from environment variables — nothing Twilio-related is ever sent
 *  to the browser.
 *
 *  Env:
 *    TWILIO_ACCOUNT_SID          ACxxx…
 *    TWILIO_AUTH_TOKEN           (secret)
 *    TWILIO_VERIFY_SERVICE_SID   VAxxx…
 * ========================================================================== */

const BASE = "https://verify.twilio.com/v2";

/** Real Twilio is used ONLY when explicitly enabled (OTP_PROVIDER=twilio_verify)
 *  AND all three credentials are present. This prevents accidentally sending real
 *  SMS just because credentials happen to be in the environment. */
export function twilioVerifyConfigured(): boolean {
  return (
    process.env.OTP_PROVIDER === "twilio_verify" &&
    Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
    )
  );
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

function serviceUrl(path: string): string {
  return `${BASE}/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/${path}`;
}

/** Start a verification: Twilio generates a code and delivers it by SMS to `phone`
 *  (E.164, e.g. +37379123456). Returns ok:false with a friendly RO message on error. */
export async function startVerification(phone: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(serviceUrl("Verifications"), {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Channel: "sms" }),
    });
    if (res.ok) return { ok: true };

    const data = await res.json().catch(() => ({}));
    // Twilio 60200 = invalid phone; 60203 = max send attempts reached;
    // 21608/21211 = trial account can only send to verified numbers / invalid To.
    if (data?.code === 60200 || data?.code === 21211) return { ok: false, error: "Număr de telefon invalid pentru SMS." };
    if (data?.code === 60203) return { ok: false, error: "Prea multe coduri trimise. Reîncercați mai târziu." };
    if (data?.code === 21608) return { ok: false, error: "Acest număr nu poate primi SMS (cont Twilio de test — numărul trebuie verificat în consola Twilio)." };
    console.error("Twilio Verify start error:", res.status, data);
    return { ok: false, error: "Nu am putut trimite codul prin SMS. Încercați din nou." };
  } catch (e) {
    console.error("Twilio Verify start exception:", e);
    return { ok: false, error: "Serviciul SMS nu este disponibil momentan." };
  }
}

/** Check a user-entered code against Twilio Verify. `approved` === success.
 *  Twilio enforces expiry and max attempts; a 404 means no pending verification
 *  (expired or already used). */
export async function checkVerification(phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(serviceUrl("VerificationCheck"), {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Code: code }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.status === "approved") return { ok: true };
      return { ok: false, error: "Cod incorect. Verificați și încercați din nou." };
    }

    if (res.status === 404) {
      return { ok: false, error: "Codul a expirat sau nu mai este valid. Solicitați un cod nou." };
    }
    const data = await res.json().catch(() => ({}));
    // 60202 = max check attempts reached for this verification.
    if (data?.code === 60202) return { ok: false, error: "Prea multe încercări. Solicitați un cod nou." };
    console.error("Twilio Verify check error:", res.status, data);
    return { ok: false, error: "Nu am putut verifica codul. Încercați din nou." };
  } catch (e) {
    console.error("Twilio Verify check exception:", e);
    return { ok: false, error: "Serviciul SMS nu este disponibil momentan." };
  }
}
