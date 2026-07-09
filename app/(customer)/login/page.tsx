"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Field, Input, PasswordInput, Spinner } from "@/components/ui";
import { Logo } from "@/components/logo";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Autentificare eșuată."); return; }
    if (data.needsVerification) {
      const send = await fetch("/api/auth/otp/send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: data.phone }),
      });
      const sendData = await send.json();
      const q = new URLSearchParams({ phone: data.phone, ...(sendData.devCode ? { devCode: sendData.devCode } : {}) });
      router.push(`/verify?${q.toString()}`);
      return;
    }
    const next = params.get("next");
    router.push(next && next.startsWith("/") ? next : data.role === "admin" ? "/gestiune" : "/menu");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex justify-center"><Logo className="h-24" /></div>
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-2xl font-black text-brand-800">Intră în cont</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Telefon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+373 69 123 456" inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Parolă">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" full disabled={loading}>{loading ? "Se conectează..." : "Intră în cont"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Nu ai cont?{" "}
          <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
            className="font-semibold text-brand-600 underline">
            Înregistrează-te
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Spinner />}><LoginInner /></Suspense>;
}
