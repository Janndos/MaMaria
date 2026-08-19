/* ============================================================================
 *  Product price list ("Lista de prețuri") — shared loader/seeder.
 *  ----------------------------------------------------------------------------
 *  The catalogue lives in scripts/products-data.txt (one `name|price` per line)
 *  so it stays reviewable in a diff. Used by:
 *    scripts/seed-products.mjs  — standalone re-sync (npm run seed:products)
 *    scripts/seed.mjs           — local dev seed
 *    scripts/prod-reset.mjs     — never leave a fresh volume without the catalogue
 *
 *  The list carries name + price only: no category, no gram weight. The admin
 *  fills those in when picking a product in the manual menu builder.
 * ========================================================================== */
import path from "path";
import fs from "fs";

/** Rows per multi-row INSERT (2 bound params each) — comfortably under SQLite's
 *  bound-parameter limit, which is only 999 on older builds. */
const BATCH = 300;

/** Parse scripts/products-data.txt → [[name, price], …]. Throws on a malformed file. */
export function parseProductsFile(root) {
  const file = path.join(root, "scripts", "products-data.txt");
  const rows = [];
  const problems = [];
  fs.readFileSync(file, "utf-8").split(/\r?\n/).forEach((line, i) => {
    const text = line.trim();
    if (!text || text.startsWith("#")) return;
    // lastIndexOf: a product name may legitimately contain no "|", but be safe
    // if one ever does — the price is always the final field.
    const sep = text.lastIndexOf("|");
    if (sep === -1) { problems.push(`linia ${i + 1}: lipsește separatorul "|" → ${text}`); return; }
    const name = text.slice(0, sep).trim();
    const priceText = text.slice(sep + 1).trim();
    const price = Number(priceText);
    if (!name) problems.push(`linia ${i + 1}: denumire goală`);
    else if (!Number.isFinite(price) || price < 0) problems.push(`linia ${i + 1}: preț invalid „${priceText}" (${name})`);
    else rows.push([name, price]);
  });
  if (problems.length) {
    throw new Error(`${path.relative(root, file)} conține ${problems.length} problemă(e):\n  ✗ ${problems.join("\n  ✗ ")}`);
  }
  return rows;
}

/**
 * Replace the whole `products` table with the catalogue file, in one transaction
 * and with batched multi-row INSERTs. Idempotent — re-running syncs rather than
 * duplicating. Nothing references products by id (menu_items copy name/grams/
 * price at publish time), so replacing rows is safe.
 */
export function seedProducts(db, root) {
  const rows = parseProductsFile(root);
  const before = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  db.transaction(() => {
    db.prepare("DELETE FROM products").run();
    // Restart ids at 1 on a re-seed (no-op when the sequence row doesn't exist).
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'products'").run();
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const sql = `INSERT INTO products (name, price) VALUES ${chunk.map(() => "(?,?)").join(",")}`;
      db.prepare(sql).run(...chunk.flat());
    }
  })();
  const after = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  if (after !== rows.length) throw new Error(`Inserate ${after} rânduri, se așteptau ${rows.length}.`);
  return { before, after, expected: rows.length };
}

/** Seed only when the table is empty (for the fresh-volume paths). */
export function seedProductsIfEmpty(db, root) {
  const count = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  if (count > 0) return { inserted: 0, existing: count };
  const { after } = seedProducts(db, root);
  return { inserted: after, existing: 0 };
}
