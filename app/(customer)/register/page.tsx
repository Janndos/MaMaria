"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Field, Input, PasswordInput, PhoneField, Spinner } from "@/components/ui";
import { Logo } from "@/components/logo";

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  // `phone` holds the 8-digit national number; +373 is added on submit.
  const [form, setForm] = useState({ fullName: "", phone: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = "Introduceți numele complet.";
    if (form.phone.length !== 8) e.phone = "Introduceți cele 8 cifre ale numărului.";
    if (form.password.length < 8) e.password = "Minim 8 caractere.";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Parolele nu coincid.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phone: `+373${form.phone}` }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setServerError(data.error || "Eroare la înregistrare."); return; }
    const next = params.get("next");
    const q = new URLSearchParams({
      phone: data.phone,
      ...(data.devCode ? { devCode: data.devCode } : {}),
      ...(next && next.startsWith("/") ? { next } : {}),
    });
    router.push(`/verify?${q.toString()}`);
  }

  return (
    <div>
      <div className="mb-5 flex justify-center"><Logo className="h-24" /></div>
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-2xl font-black text-brand-800">Creează cont</h1>
        <p className="mt-1 text-sm text-slate-500">Comanzi mai repede și primești noutățile Ma&rsquo;Maria.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Nume complet" error={errors.fullName}>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Maria Popescu" autoComplete="name" />
          </Field>
          <PhoneField label="Telefon (Moldova)" value={form.phone} error={errors.phone}
            onChange={(digits) => setForm({ ...form, phone: digits })} />
          <Field label="Parolă" error={errors.password}>
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" placeholder="Minim 8 caractere" />
          </Field>
          <Field label="Confirmă parola" error={errors.confirmPassword}>
            <PasswordInput value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} autoComplete="new-password" />
          </Field>
          {serverError && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{serverError}</p>}
          <Button type="submit" full disabled={loading}>{loading ? "Se creează contul..." : "Continuă — primești un cod SMS"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Ai deja cont?{" "}
          <Link href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
            className="font-semibold text-brand-600 underline">Intră în cont</Link>
        </p>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<Spinner />}><RegisterInner /></Suspense>;
}
