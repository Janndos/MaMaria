"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui";

/** The five sections of the printed Ma'Maria menu sheet, in sheet order. */
export const MENU_CATEGORIES = [
  "Felul întâi",
  "Garnitură",
  "Bucate din carne",
  "Salate",
  "Altele",
] as const;

export const CUSTOM = "__custom__";

/**
 * Pure view-state for the picker — extracted so it can be unit-tested without a
 * browser.
 *
 *  extras      other categories already used in this menu, offered under their
 *              own heading (standard ones filtered out, de-duplicated, sorted)
 *  showCustom  whether the free-text box is visible
 *  selectValue what the <select> should show
 */
export function categoryState(value: string, used: string[], customMode: boolean) {
  const std = new Set<string>(MENU_CATEGORIES);
  const seen = new Set<string>();
  const extras: string[] = [];
  for (const u of used) {
    const t = u.trim();
    if (t && !std.has(t) && !seen.has(t)) { seen.add(t); extras.push(t); }
  }
  extras.sort((a, b) => a.localeCompare(b, "ro"));

  const trimmed = value.trim();
  const known = trimmed !== "" && std.has(trimmed);
  const inExtras = trimmed !== "" && extras.includes(trimmed);
  // Show the free-text box while in custom mode, or for a value the dropdown
  // cannot represent (shouldn't happen, but never hide a value from the admin).
  const showCustom = customMode || (trimmed !== "" && !known && !inExtras);
  const selectValue = showCustom ? CUSTOM : (known || inExtras ? trimmed : "");
  return { extras, showCustom, selectValue };
}

export function CategorySelect({
  value, onChange, used = [], invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Categories already present in the table — offered under their own heading. */
  used?: string[];
  invalid?: boolean;
}) {
  // Sticky once the admin picks "Altă categorie…", so the text box does not
  // disappear the moment what they typed also becomes a known option.
  const [customMode, setCustomMode] = useState(false);

  const { extras, showCustom, selectValue } = useMemo(
    () => categoryState(value, used, customMode),
    [value, used, customMode],
  );

  const base =
    "w-full rounded-xl border bg-white px-3 py-1.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div className="space-y-1">
      <select
        aria-label="Categorie"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CUSTOM) { setCustomMode(true); onChange(""); }
          else { setCustomMode(false); onChange(v); }
        }}
        className={`${base} ${invalid ? "border-amber-400" : "border-brand-200"}`}
      >
        <option value="">— alege categoria —</option>
        <optgroup label="Categorii standard">
          {MENU_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </optgroup>
        {extras.length > 0 && (
          <optgroup label="Folosite în acest meniu">
            {extras.map((c) => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        )}
        <option value={CUSTOM}>✎ Altă categorie…</option>
      </select>

      {showCustom && (
        <Input
          autoFocus
          aria-label="Denumirea categoriei"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scrie categoria"
          className={`!py-1.5 !text-sm ${invalid ? "!border-amber-400" : ""}`}
        />
      )}
    </div>
  );
}
