"use client";
import { ReactNode, useState } from "react";

export function fmtMdl(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(2)} MDL`;
}

export function Button({
  children, onClick, type = "button", variant = "primary", disabled, full, small,
}: {
  children: ReactNode; onClick?: () => void; type?: "button" | "submit";
  variant?: "primary" | "outline" | "ghost" | "danger"; disabled?: boolean; full?: boolean; small?: boolean;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-45 disabled:cursor-not-allowed";
  const size = small ? "px-3.5 py-1.5 text-sm" : "px-5 py-2.5 text-sm";
  const variants = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700",
    outline: "border-2 border-brand-500 text-brand-600 hover:bg-brand-50",
    ghost: "text-brand-600 hover:bg-brand-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${size} ${variants[variant]} ${full ? "w-full" : ""}`}>
      {children}
    </button>
  );
}

export function Field({
  label, error, children,
}: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-brand-800">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className={`w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${props.className ?? ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-paper shadow-card ${className}`}>{children}</div>;
}

/** 24-hour time picker (HH:MM) using native selects — always shows Moldovan-style
 *  24h time (15:00, 17:00, 00:00…), never AM/PM, on every browser/OS locale.
 *  Emits "" when the hour is cleared so callers can enforce "required". */
export function TimeSelect({
  value, onChange, minuteStep = 5, className = "",
}: { value: string; onChange: (v: string) => void; minuteStep?: number; className?: string }) {
  const [hh, mm] = /^\d{1,2}:\d{2}$/.test(value) ? value.split(":") : ["", ""];
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, "0"));
  const set = (h: string, m: string) => onChange(h === "" ? "" : `${h}:${m || "00"}`);
  const sel = "rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-lg font-semibold tabular-nums text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select aria-label="Ora" value={hh} onChange={(e) => set(e.target.value, mm)} className={sel}>
        <option value="">--</option>
        {hours.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-lg font-bold text-brand-700">:</span>
      <select aria-label="Minute" value={mm || "00"} onChange={(e) => set(hh || "00", e.target.value)} className={sel}>
        {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

/** Moldova phone field with a fixed, non-editable "+373" prefix. Holds the 8-digit
 *  national number; the caller composes the full E.164 value as `+373${value}`. */
export function PhoneField({
  value, onChange, error, label = "Telefon",
}: { value: string; onChange: (digits: string) => void; error?: string; label?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-brand-800">{label}</span>
      <div className={`flex items-center overflow-hidden rounded-xl border bg-white transition
        ${error ? "border-red-300" : "border-brand-200"} focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100`}>
        <span className="select-none border-r border-brand-100 bg-brand-50/60 px-3.5 py-2.5 font-semibold text-brand-800">+373</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="69 123 456"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 tabular-nums text-ink outline-none placeholder:text-slate-400"
        />
      </div>
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

/** Password input with a show/hide toggle (keeps the 44px touch target). */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"}
        className={`w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 pr-12 text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${props.className ?? ""}`} />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
        aria-label={show ? "Ascunde parola" : "Arată parola"}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-brand-600">
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.5 18.5 0 0 0 2 12s3 8 10 8a9.1 9.1 0 0 0 5.4-1.6M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "gold" | "gray" | "red" | "green" }) {
  const tones = {
    brand: "bg-brand-100 text-brand-800",
    gold: "bg-amber-100 text-amber-800",
    gray: "bg-slate-100 text-slate-600",
    red: "bg-red-100 text-red-700",
    green: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export const ORDER_STATUS_RO: Record<string, { label: string; tone: "brand" | "gold" | "gray" | "red" | "green" }> = {
  pending: { label: "În așteptare", tone: "gold" },
  confirmed: { label: "Confirmată", tone: "brand" },
  preparing: { label: "Se pregătește", tone: "brand" },
  ready: { label: "Gata de ridicare", tone: "green" },
  completed: { label: "Finalizată", tone: "gray" },
  cancelled: { label: "Anulată", tone: "red" },
};

export function Spinner({ label = "Se încarcă..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-brand-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border-2 border-dashed border-brand-200 bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-brand-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Modal({
  open, title, children, onClose,
}: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 p-4 sm:items-center" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold text-brand-800">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
