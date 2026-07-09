import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "mamaria.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema (mirrors lib/db.ts so the seed can run before the app boots)
db.exec(fs.readFileSync(path.join(root, "scripts", "schema.sql"), "utf-8"));

const today = new Date().toISOString().slice(0, 10);

/* Users */
const upsertUser = (name, phone, pass, role) => {
  const hash = bcrypt.hashSync(pass, 10);
  db.prepare(`
    INSERT INTO users (full_name, phone, password_hash, role, phone_verified)
    VALUES (?,?,?,?,1)
    ON CONFLICT(phone) DO UPDATE SET full_name=excluded.full_name, password_hash=excluded.password_hash, role=excluded.role, phone_verified=1
  `).run(name, phone, hash, role);
};
// MVP/demo admin: logs in with the literal identifier "admin" (stored in the phone
// column). The default password is for LOCAL DEV ONLY — set ADMIN_PASSWORD for
// anything real, and use scripts/prod-reset.mjs before going to production.
const DEV_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ma2026maria";
upsertUser("Administrator Ma'Maria", "admin", DEV_ADMIN_PASSWORD, "admin");
upsertUser("Ion Client", "+37369111111", "client1234", "customer");

/* Categories + today's menu (from the Ma'Maria printed sheet) */
const MENU = [
  ["Felul întâi", [
    ["Ciorbă cu varză murată", 300, 24],
  ]],
  ["Garnituri", [
    ["Mămăligă cu unt", 250, 14],
    ["Fasole în sos de roșii", 250, 18],
    ["Cartofi copți în sos alb", 200, 20],
  ]],
  ["Fel de bază", [
    ["Chiftele de casă", 100, 25],
    ["Tocăniță din file de pui", 100, 32],
    ["Pipote de pui cu legume", 100, 22],
  ]],
  ["Salate", [
    ["Salată bulgărească din legume cu brânză", 100, 18],
    ["Salată Caesar cu file de pui", 100, 24],
  ]],
  ["Desert și panificație", [
    ["Baba neagră", 100, 15],
    ["Pâine albă de casă", 50, 3],
    ["Pâine de casă cu semințe", 50, 3],
  ]],
  ["Băuturi și lactate", [
    ["Compot din fructe", 200, 5],
    ["Chefir la pahar", 200, 6],
    ["Smântână", 50, 5],
  ]],
];

const ensureCat = db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order");
const getCat = db.prepare("SELECT id FROM menu_categories WHERE name = ?");

let menu = db.prepare("SELECT * FROM menus WHERE date = ?").get(today);
if (!menu) {
  db.prepare("INSERT INTO menus (date, title, published) VALUES (?,?,1)").run(today, "Meniul zilei");
  menu = db.prepare("SELECT * FROM menus WHERE date = ?").get(today);
  const insItem = db.prepare("INSERT INTO menu_items (menu_id, category_id, name, grams, price_mdl, sort_order) VALUES (?,?,?,?,?,?)");
  let catOrder = 0, itemOrder = 0;
  for (const [cat, items] of MENU) {
    ensureCat.run(cat, ++catOrder);
    const catId = getCat.get(cat).id;
    for (const [name, grams, price] of items) insItem.run(menu.id, catId, name, grams, price, ++itemOrder);
  }
  console.log(`Meniu publicat pentru ${today} (${itemOrder} produse).`);
} else {
  console.log(`Meniul pentru ${today} există deja — nu a fost modificat.`);
}

/* Stable everyday items — "Bucate la comandă" (from BUCATE LA COMANDA MM.pdf).
   Managed manually from the admin panel afterwards; seeded once, idempotently. */
const STABLE = [
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
const stableCount = db.prepare("SELECT COUNT(*) c FROM stable_items").get().c;
if (stableCount === 0) {
  const insStable = db.prepare(
    "INSERT INTO stable_items (category, name, grams, unit, price_mdl, sort_order) VALUES ('Bucate la comandă',?,?,?,?,?)"
  );
  STABLE.forEach(([name, grams, unit, price], i) => insStable.run(name, grams, unit, price, i + 1));
  console.log(`Produse permanente adăugate (${STABLE.length}).`);
} else {
  console.log(`Produse permanente există deja (${stableCount}) — nu au fost modificate.`);
}

/* News */
const newsCount = db.prepare("SELECT COUNT(*) c FROM news_posts").get().c;
if (newsCount === 0) {
  const ins = db.prepare("INSERT INTO news_posts (title, body, tg_url, posted_at) VALUES (?,?,?,datetime('now', ?))");
  ins.run("Meniul zilei, acum online", "De azi puteți vedea meniul și plasa comenzi direct de pe telefon. Ridicarea rămâne la tejghea, plata numerar sau card.", "https://t.me/mamaria_md", "-2 days");
  ins.run("Catering pentru evenimente", "Preluăm comenzi de catering pentru evenimente de familie și birouri. Sunați-ne pentru un meniu personalizat.", "https://t.me/mamaria_md", "-6 days");
  console.log("Noutăți demonstrative adăugate.");
}

for (const [k, v] of [["order_cutoff", "10:30"], ["orders_enabled", "true"], ["telegram_url", "https://t.me/mamaria_md"]]) {
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run(k, v);
}

console.log("\nConturi demo:");
console.log(`  Admin:  admin / ${DEV_ADMIN_PASSWORD}`);
console.log("  Client: +373 69 111 111 / client1234");
