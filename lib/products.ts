/** Shared parsing/validation for the product price list (`products`).
 *
 *  Pure TypeScript with no server-only imports, so the Catalog screen imports the
 *  same helpers and validates as you type — one source of truth for what counts
 *  as a valid price or gramaj.
 *
 *  `grams` is 0 when the portion weight has not been filled in yet; the imported
 *  catalogue carries no weights. `price` may legitimately be 0 too — several
 *  catalogue entries are components (dough, sauce) priced at 0.
 */

export type ProductInput = { name: string; price: number; grams: number };

/** Round to 2 decimals for NUMERIC(10,2). The epsilon nudge matters: 1.005 * 100
 *  is 100.49999999999999 in binary floating point, which would round DOWN to 1.00. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const MAX_PRICE = 1_000_000;
export const MAX_GRAMS = 100_000;
export const MAX_NAME = 255;

/**
 * Parse a number typed by a human.
 *
 * Accepts a decimal comma ("12,5") because that is what a Romanian keyboard and
 * locale produce, tolerates surrounding spaces and thousands spaces, and treats
 * an empty value as 0 ("not filled in"). Returns null for anything that is not a
 * plain non-negative number — "abc", "250 g", "-5", "1e9" — so the caller can
 * reject it instead of silently storing 0, which is what used to happen when
 * NaN was serialised to JSON null.
 */
export function parseNumeric(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".");
  if (!s) return 0;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Human-readable reason a price field is unusable, or null when it is fine. */
export function priceError(v: unknown): string | null {
  const n = parseNumeric(v);
  if (n === null) return "Prețul este invalid — scrie doar cifre (ex.: 12 sau 12,5).";
  if (n > MAX_PRICE) return `Prețul este prea mare (max. ${MAX_PRICE}).`;
  return null;
}

/** Human-readable reason a gramaj field is unusable, or null when it is fine. */
export function gramsError(v: unknown): string | null {
  const n = parseNumeric(v);
  if (n === null) return "Gramajul este invalid — scrie doar cifre (ex.: 250).";
  if (n > MAX_GRAMS) return `Gramajul este prea mare (max. ${MAX_GRAMS} g).`;
  return null;
}

/**
 * Validate a create/update payload.
 *
 * `existing` supplies the current values for a PATCH: a key ABSENT from the body
 * keeps its stored value, while a key present but empty ("") is an explicit reset
 * to 0. Distinguishing the two matters — merging with `??` treated a rejected
 * number as "field not sent" and silently kept the old price.
 *
 * Returns the cleaned values, or an error message.
 */
export function readProductBody(body: unknown, existing?: ProductInput): ProductInput | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  const name = has("name") ? String(b.name ?? "").trim() : (existing?.name ?? "");
  if (!name) return "Denumirea este obligatorie.";
  if (name.length > MAX_NAME) return `Denumirea este prea lungă (max. ${MAX_NAME} de caractere).`;

  let price = existing?.price ?? 0;
  if (has("price")) {
    const err = priceError(b.price);
    if (err) return err;
    price = round2(parseNumeric(b.price) as number);
  }

  let grams = existing?.grams ?? 0;
  if (has("grams")) {
    const err = gramsError(b.grams);
    if (err) return err;
    grams = Math.round(parseNumeric(b.grams) as number);
  }

  return { name, price, grams };
}
