/* ============================================================================
 *  Re-sync the product price list (`products`) from scripts/products-data.txt
 *  and print a count check.
 *
 *  Usage:
 *    npm run seed:products                 # local ./data
 *    DATA_DIR=/data npm run seed:products  # production volume
 * ========================================================================== */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { seedProducts } from "./products-catalog.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "mamaria.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// Create the schema if the app has never booted against this volume.
db.exec(fs.readFileSync(path.join(root, "scripts", "schema.sql"), "utf-8"));

let result;
try {
  result = seedProducts(db, root);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}

console.log(`Catalog produse: ${result.before} → ${result.after} rânduri.`);
console.log(`SELECT COUNT(*) FROM products; → ${result.after}`);

const dupes = db.prepare(
  "SELECT name, COUNT(*) c FROM products GROUP BY name HAVING c > 1 ORDER BY name"
).all();
if (dupes.length) {
  console.log("Denumiri care apar de mai multe ori (așteptat — fără UNIQUE pe name):");
  for (const d of dupes) {
    const prices = db.prepare("SELECT price FROM products WHERE name = ? ORDER BY price").all(d.name).map((r) => r.price);
    console.log(`  • ${d.name} ×${d.c} (${prices.join(", ")} lei)`);
  }
}
