/* ============================================================================
 *  Default permanent products — "Bucate la comandă" (from BUCATE LA COMANDA MM.pdf).
 *  Shared by scripts/seed.mjs (local dev) and scripts/prod-reset.mjs (production),
 *  so a fresh Railway DB (DATA_DIR=/data) is never left without permanent products.
 *  Each entry: [name, grams|null, unit, price_mdl].
 * ========================================================================== */
export const STABLE_DEFAULTS = [
  ["GĂINĂ MARINATĂ COAPTĂ LA CUPTOR", null, "buc", 99],
  ["IEPURE CU LEGUME ȘI MIRODENII LA CUPTOR", null, "kg", 350],
  ["BĂTUTE DE PORC SAU PUI", null, "kg", 200],
  ["PÂRJOALE DE CASĂ DIN CARNE DE PORC ȘI VITĂ", null, "kg", 200],
  ["MICI COPȚI DIN AMESTEC DE VITĂ ȘI PORC", null, "kg", 200],
  ["CÂRNĂCIORI DIN AMESTEC DE VITĂ ȘI PORC", null, "kg", 180],
  ["LEBERKASE", null, "kg", 250],
  ["PIEPT DE PUI LA CUPTOR CU CAȘCAVAL DORBLUE", null, "kg", 200],
  ["BABA NEAGRĂ", null, "kg", 150],
];

/** Insert the defaults only when the stable_items table is empty (idempotent). */
export function seedStableDefaults(db) {
  const count = db.prepare("SELECT COUNT(*) c FROM stable_items").get().c;
  if (count > 0) return { inserted: 0, existing: count };
  const ins = db.prepare(
    "INSERT INTO stable_items (category, name, grams, unit, price_mdl, sort_order) VALUES ('Bucate la comandă',?,?,?,?,?)"
  );
  STABLE_DEFAULTS.forEach(([name, grams, unit, price], i) => ins.run(name, grams, unit, price, i + 1));
  return { inserted: STABLE_DEFAULTS.length, existing: 0 };
}
