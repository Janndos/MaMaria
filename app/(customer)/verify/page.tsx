"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Spinner } from "@/components/ui";
import { OtpInput } from "@/components/otp-input";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get("phone") ?? "";
  const [devCode, setDevCode] = useState(params.get("devCode") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const verify = useCallback(async (submitted: string) => {
    if (loading || done) return;
    setError("");
    if (!/^\d{6}$/.test(submitted)) { setError("Introduceți cele 6 cifre din SMS."); return; }
    setLoading(true);
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code: submitted }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setCode("");
      setError(data.error || "Cod incorect.");
      return;
    }
    // Brief success confirmation before routing on.
    setDone(true);
    const next = params.get("next");
    setTimeout(() => {
      router.push(next && next.startsWith("/") ? next : data.role === "admin" ? "/gestiune" : "/menu");
      router.refresh();
    }, 850);
  }, [loading, done, phone, params, router]);

  async function resend() {
    if (cooldown > 0 || resending) return;
    setError(""); setResending(true);
    const res = await fetch("/api/auth/otp/send", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setResending(false);
    if (!res.ok) { setError(data.error || "Nu am putut retrimite codul."); return; }
    if (data.devCode) setDevCode(data.devCode);
    setCode("");
    setCooldown(60);
  }

  return (
    <div className="mx-auto max-w-sm pt-4">
      <Card className="p-6 sm:p-8">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h1 className="font-display text-xl font-black text-brand-800">Număr confirmat!</h1>
              <p className="mt-1 text-sm text-slate-500">Te ducem mai departe…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8.5A2.5 2.5 0 0 1 4.5 6h15A2.5 2.5 0 0 1 22 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 15.5z" />
                  <path d="m3 8 9 6 9-6" />
                </svg>
              </span>
              <h1 className="mt-3 font-display text-2xl font-black text-brand-800">Confirmă numărul</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Am trimis un cod de 6 cifre prin SMS la<br />
                <span className="font-semibold text-ink">{phone}</span>
              </p>
            </div>

            {devCode && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
                <strong>Mod demo (SMS simulat):</strong> codul este{" "}
                <span className="font-mono text-base font-bold tracking-widest">{devCode}</span>
              </p>
            )}

            <div className="mt-6">
              <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={loading} invalid={!!error} />
              {error && (
                <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-center text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5">
              <Button full onClick={() => verify(code)} disabled={loading || code.length < 6}>
                {loading ? "Se verifică…" : "Confirmă"}
              </Button>
            </div>

            <div className="mt-4 text-center text-sm text-slate-500">
              {cooldown > 0 ? (
                <span>Poți retrimite codul în <span className="font-semibold tabular-nums text-ink">{cooldown}s</span></span>
              ) : (
                <button onClick={resend} disabled={resending}
                  className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700 disabled:opacity-50">
                  {resending ? "Se retrimite…" : "Retrimite codul"}
                </button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={<Spinner />}><VerifyInner /></Suspense>;
}
