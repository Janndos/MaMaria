/** Validation shared by the price-list create/update endpoints.
 *
 *  `grams` is optional everywhere and defaults to 0, meaning "portion weight not
 *  filled in yet" — the imported catalogue carries no weights, so the admin fills
 *  them in gradually from the Catalog screen. Price may legitimately be 0 too
 *  (several catalogue entries are components priced at 0).
 *
 *  Returns the cleaned values, or an error message string. */
export function readProductBody(body: unknown): { name: string; price: number; grams: number } | string {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = String(b.name ?? "").trim();
  if (!name) return "Denumirea este obligatorie.";
  if (name.length > 255) return "Denumirea este prea lungă (max. 255 de caractere).";

  const blank = (v: unknown) => v === "" || v === null || v === undefined;

  const price = blank(b.price) ? 0 : Number(b.price);
  if (!Number.isFinite(price) || price < 0) return "Prețul este invalid.";

  const grams = blank(b.grams) ? 0 : Math.round(Number(b.grams));
  if (!Number.isFinite(grams) || grams < 0) return "Gramajul este invalid.";

  return { name, price, grams };
}
