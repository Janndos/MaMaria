"use client";
import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from "react";

/** Six-box OTP entry, mobile-first: numeric keyboard, auto-advance, backspace
 *  navigation, full-code paste, and one-time-code autofill on the first box.
 *  Calls onComplete when all six digits are present (enables auto-submit). */
export function OtpInput({
  value, onChange, onComplete, disabled, invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setAt(i: number, d: string) {
    const arr = value.padEnd(6, " ").slice(0, 6).split("");
    arr[i] = d || " ";
    const next = arr.join("").replace(/\s+$/g, "").replace(/\s/g, "");
    onChange(next);
    if (next.length === 6 && !next.includes(" ")) onComplete?.(next);
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setAt(i, ""); return; }
    // Typing/pasting into one box: fill forward from here.
    const chars = raw.split("");
    const arr = value.padEnd(6, " ").split("");
    let idx = i;
    for (const c of chars) { if (idx > 5) break; arr[idx] = c; idx++; }
    const next = arr.join("").replace(/\s/g, "");
    onChange(next);
    const focusTo = Math.min(idx, 5);
    refs.current[focusTo]?.focus();
    if (next.length === 6) onComplete?.(next);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) onComplete?.(text);
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Cod de verificare din 6 cifre">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d.trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Cifra ${i + 1}`}
          className={`h-14 w-full min-w-0 rounded-xl border-2 bg-white text-center font-display text-2xl font-bold tabular-nums text-ink transition
            focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50
            ${invalid ? "border-red-300 focus:border-red-400" : "border-brand-200 focus:border-brand-500"}`}
        />
      ))}
    </div>
  );
}
