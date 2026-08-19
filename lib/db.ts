import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import path from "path";
import fs from "fs";
import { STABLE_DESCRIPTIONS } from "./bucate-defaults";

/** Fill in the standard product descriptions on any stable item that has none yet
 *  (idempotent; never overwrites an admin-edited description). Runs at init so
 *  existing deployments get the copy automatically. */
function backfillStableDescriptions(database: DatabaseType): void {
  try {
    const upd = database.prepare(
      "UPDATE stable_items SET description = ? WHERE name = ? AND (description IS NULL OR description = '')"
    );
    for (const [name, desc] of Object.entries(STABLE_DESCRIPTIONS)) upd.run(desc, name);
  } catch { /* table may not exist yet during a partial init — safe to skip */ }
}

/** Locate the product price list that ships with the app. Read from disk (rather
 *  than bundled) so the catalogue stays a plain, diffable text file; the same
 *  cwd-relative mechanism already serves public/fonts and public/logo.png in
 *  production. An env override is provided for unusual deployments. */
function readProductCatalogFile(): [string, number][] {
  const candidates = [
    process.env.PRODUCTS_CATALOG_PATH,
    path.join(process.cwd(), "scripts", "products-data.txt"),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const rows: [string, number][] = [];
      for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
        const text = line.trim();
        if (!text || text.startsWith("#")) continue;
        const sep = text.lastIndexOf("|");
        if (sep === -1) continue;
        const name = text.slice(0, sep).trim();
        const price = Number(text.slice(sep + 1).trim());
        if (name && Number.isFinite(price) && price >= 0) rows.push([name, price]);
      }
      if (rows.length) return rows;
    } catch { /* try the next candidate */ }
  }
  return [];
}

/** Populate the price list on a database that has never been seeded — a fresh
 *  Railway volume, for instance. Without this the table exists but is empty, and
 *  the admin's "Alege din catalogul de prețuri" picker opens onto nothing, because
 *  nothing runs scripts/seed-products.mjs on a deploy. Idempotent: only ever fills
 *  an EMPTY table, so admin edits and re-seeds are never clobbered. */
function seedProductsIfEmpty(database: DatabaseType): void {
  try {
    const { c } = database.prepare("SELECT COUNT(*) c FROM products").get() as { c: number };
    if (c > 0) return;

    const rows = readProductCatalogFile();
    if (!rows.length) {
      console.error(
        "[products] catalogue file not found or empty (expected scripts/products-data.txt) — " +
          "the price list will be empty until `npm run seed:products` is run.",
      );
      return;
    }
    database.transaction(() => {
      // Batched multi-row INSERTs (2 bound params each) stay under SQLite's limit.
      for (let i = 0; i < rows.length; i += 300) {
        const chunk = rows.slice(i, i + 300);
        database
          .prepare(`INSERT INTO products (name, price) VALUES ${chunk.map(() => "(?,?)").join(",")}`)
          .run(...chunk.flat());
      }
    })();
    console.log(`[products] seeded ${rows.length} catalogue products into an empty price list.`);
  } catch (e) {
    console.error("[products] auto-seed failed:", e);
  }
}

/** Older DBs created the users table with `CHECK (role IN ('customer','admin'))`,
 *  which rejects the "tehno" role and makes promoting a user fail with a 500.
 *  SQLite can't ALTER a CHECK, so rebuild the table once (data preserved). */
function migrateUserRoleCheck(database: DatabaseType): void {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("tehno")) return; // fresh schema already allows it

  // foreign_keys must be toggled outside the transaction (orders.user_id → users).
  // The transaction is atomic: if anything fails the original table is untouched,
  // and we swallow the error so a migration hiccup can never brick startup.
  database.pragma("foreign_keys = OFF");
  try {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL UNIQUE,
          email TEXT,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin','tehno')),
          phone_verified INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO users_new (id, full_name, phone, email, password_hash, role, phone_verified, created_at)
          SELECT id, full_name, phone, email, password_hash, role, phone_verified, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    })();
  } catch (e) {
    console.error("migrateUserRoleCheck failed (users table left unchanged):", e);
  } finally {
    database.pragma("foreign_keys = ON");
  }
}

/* ---------------------------------------------------------------------------
 * Lazy database initialization.
 *
 * The connection, schema creation and migrations are performed the first time
 * the database is actually used at RUNTIME — never at module import time.
 * This matters because `next build` imports every route/page to collect page
 * data; opening the SQLite file and running writes/migrations at import time
 * caused `SQLITE_BUSY` ("database is locked") when several routes were imported
 * concurrently. Deferring the work keeps the build from ever touching the DB.
 * ------------------------------------------------------------------------- */

let _db: DatabaseType | null = null;

function initDb(): DatabaseType {
  // DB location is configurable so production can point it at a persistent volume
  // (e.g. DATA_DIR=/data on Railway/Fly/VPS). Defaults to ./data for local dev.
  const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const database = new Database(path.join(DATA_DIR, "mamaria.db"));
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  // Wait up to 5s for a competing writer instead of failing immediately with
  // SQLITE_BUSY when the WAL file is briefly locked.
  database.pragma("busy_timeout = 5000");

  database.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin','tehno')),
  phone_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'verify',
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Meniul zilei',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  grams INTEGER NOT NULL,
  price_mdl REAL NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','preparing','ready','completed','cancelled')),
  total_mdl REAL NOT NULL,
  pickup_time TEXT NOT NULL,
  pickup_date TEXT,
  pickup_location TEXT,
  comment TEXT,
  cancellation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER,
  source_type TEXT NOT NULL DEFAULT 'daily',
  name TEXT NOT NULL,
  grams INTEGER NOT NULL,
  unit TEXT,
  price_mdl REAL NOT NULL,
  qty INTEGER NOT NULL
);
-- Stable "everyday" catalogue (Bucate la comanda). Managed manually in the admin
-- panel and NEVER touched by the daily Excel menu upload.
CREATE TABLE IF NOT EXISTS stable_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'Bucate la comandă',
  name TEXT NOT NULL,
  grams INTEGER,
  unit TEXT NOT NULL DEFAULT 'buc',
  price_mdl REAL NOT NULL,
  min_qty INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  image_url TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS news_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- The title is optional: posts without one are stored with an empty string and
  -- rendered as text-only announcements.
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  tg_url TEXT,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Product price list ("Lista de preturi"). A reference catalogue of every dish the
-- kitchen sells with its price — NOT an orderable table. The admin picks from it
-- when building a daily menu by hand, then fills in the category and gram weight,
-- which this list does not carry. Seeded by scripts/seed-products.mjs.
-- NOTE: no UNIQUE on name — the same dish legitimately appears at two prices
-- (e.g. "Snitel Vienez MM" at 75 and at 200).
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
`);

  /* ---------- lightweight migrations (existing DBs) ----------
   * CREATE TABLE IF NOT EXISTS never alters an existing table, so add any columns
   * introduced after the first release here. Each guarded so re-runs are no-ops. */
  const addColumn = (table: string, column: string, decl: string) => {
    const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
  };
  addColumn("orders", "pickup_location", "TEXT");
  addColumn("orders", "cancellation_reason", "TEXT");
  addColumn("orders", "pickup_date", "TEXT");
  addColumn("order_items", "source_type", "TEXT NOT NULL DEFAULT 'daily'");
  addColumn("order_items", "unit", "TEXT");
  addColumn("stable_items", "min_qty", "INTEGER NOT NULL DEFAULT 1");
  addColumn("stable_items", "description", "TEXT");
  addColumn("stable_items", "image_url", "TEXT");
  addColumn("news_posts", "video_url", "TEXT");
  migrateUserRoleCheck(database);
  backfillStableDescriptions(database);
  seedProductsIfEmpty(database);

  return database;
}

/** Open (once) and return the underlying connection. Runtime-only. */
export function getDb(): DatabaseType {
  if (!_db) _db = initDb();
  return _db;
}

/**
 * Default export kept as a `db`-shaped object so existing `db.prepare(...)`,
 * `db.exec(...)`, `db.transaction(...)` call sites work unchanged — but the real
 * connection is opened lazily on first property access, never at import time.
 */
const db = new Proxy({} as DatabaseType, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export default db;

/* ---------- types ---------- */
export type User = {
  id: number; full_name: string; phone: string; email: string | null;
  password_hash: string; role: "customer" | "admin" | "tehno";
  phone_verified: number; created_at: string;
};
export type MenuItem = {
  id: number; menu_id: number; category_id: number | null; name: string;
  grams: number; price_mdl: number; available: number; sort_order: number;
  category?: string;
};
export type Menu = { id: number; date: string; title: string; published: number; created_at: string };
export type StableItem = {
  id: number; category: string; name: string; grams: number | null; unit: string;
  price_mdl: number; min_qty: number; description: string | null; image_url: string | null;
  available: number; sort_order: number;
  created_at: string; updated_at: string;
};
export type Order = {
  id: number; user_id: number; status: string; total_mdl: number;
  pickup_time: string; pickup_date: string | null; pickup_location: string | null; comment: string | null;
  cancellation_reason: string | null; created_at: string;
};
/** A row of the reference price list. Carries no category and no gram weight —
 *  the admin supplies those when pulling one into a daily menu. */
export type Product = { id: number; name: string; price: number };
export type NewsPost = {
  id: number; title: string; body: string; image_url: string | null; video_url: string | null;
  tg_url: string | null; posted_at: string; created_at: string;
};

/* ---------- helpers ---------- */
export function getSetting(key: string, fallback: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}
export function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}

/* ---------- order retention ----------
 * Orders are kept for a fixed window then removed automatically. order_items are
 * removed via `ON DELETE CASCADE` (foreign_keys pragma is ON). */
export const ORDER_RETENTION_DAYS = 60; // ~2 months

/** Delete orders (and their items, via cascade) older than `days`. Returns count. */
export function pruneOldOrders(days = ORDER_RETENTION_DAYS): number {
  const info = db.prepare("DELETE FROM orders WHERE created_at < datetime('now', ?)").run(`-${days} days`);
  return info.changes;
}

/** Run pruneOldOrders at most once per 24h (triggered opportunistically by admin
 *  traffic, so no external cron is needed). Failures are swallowed — never block a request. */
export function maybePruneOldOrders(days = ORDER_RETENTION_DAYS): void {
  try {
    const last = Number(getSetting("orders_pruned_at", "0"));
    const now = Date.now();
    if (Number.isFinite(last) && now - last < 24 * 60 * 60 * 1000) return;
    const removed = pruneOldOrders(days);
    setSetting("orders_pruned_at", String(now));
    if (removed > 0) console.log(`[retention] pruned ${removed} order(s) older than ${days} days`);
  } catch (e) {
    console.error("[retention] pruneOldOrders failed:", e);
  }
}

export function findUserByPhone(phone: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as User | undefined;
}
export function findUserById(id: number): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function ensureCategory(name: string): number {
  const clean = name.trim();
  const existing = db.prepare("SELECT id FROM menu_categories WHERE name = ? COLLATE NOCASE").get(clean) as { id: number } | undefined;
  if (existing) return existing.id;
  const max = db.prepare("SELECT COALESCE(MAX(sort_order),0) m FROM menu_categories").get() as { m: number };
  return Number(db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?,?)").run(clean, max.m + 1).lastInsertRowid);
}

export function getMenuByDate(date: string): Menu | undefined {
  return db.prepare("SELECT * FROM menus WHERE date = ?").get(date) as Menu | undefined;
}

/**
 * Items of one menu, grouped by category and in the order the admin entered them.
 *
 * Sections are ordered by where each category FIRST APPEARS IN THIS MENU, not by
 * `menu_categories.sort_order` — that column is global and reflects the order in
 * which categories were ever first created across the whole database, so it put
 * the printed sheet in an arbitrary order (Salate before Felul întâi, etc.) once
 * more than one menu existed. Items keep their own `sort_order` inside a section.
 */
export function getMenuItems(menuId: number): MenuItem[] {
  return db.prepare(`
    SELECT mi.*, mc.name AS category
    FROM menu_items mi LEFT JOIN menu_categories mc ON mc.id = mi.category_id
    WHERE mi.menu_id = ?
    ORDER BY (
      SELECT MIN(m2.sort_order) FROM menu_items m2
      WHERE m2.menu_id = mi.menu_id
        AND IFNULL(m2.category_id, -1) = IFNULL(mi.category_id, -1)
    ), mi.sort_order, mi.id
  `).all(menuId) as MenuItem[];
}

/** Stable everyday items ("Produse disponibile zilnic"). Pass availableOnly for
 *  the customer-facing menu; admin sees everything. */
export function getStableItems(availableOnly = false): StableItem[] {
  return db.prepare(`
    SELECT * FROM stable_items
    ${availableOnly ? "WHERE available = 1" : ""}
    ORDER BY sort_order, id
  `).all() as StableItem[];
}

export function getStableItemById(id: number): StableItem | undefined {
  return db.prepare("SELECT * FROM stable_items WHERE id = ?").get(id) as StableItem | undefined;
}

/** Search the price list by name. Empty query returns the head of the catalogue.
 *  Names that START with the query rank first, then the rest alphabetically. */
export function searchProducts(q: string, limit = 50): Product[] {
  const term = q.trim();
  if (!term) {
    return db.prepare("SELECT id, name, price FROM products ORDER BY name LIMIT ?").all(limit) as Product[];
  }
  return db.prepare(`
    SELECT id, name, price FROM products
    WHERE name LIKE '%' || ? || '%'
    ORDER BY (CASE WHEN name LIKE ? || '%' THEN 0 ELSE 1 END), name
    LIMIT ?
  `).all(term, term, limit) as Product[];
}

/** Total number of rows in the price list (shown as a hint in the picker). */
export function countProducts(): number {
  return (db.prepare("SELECT COUNT(*) c FROM products").get() as { c: number }).c;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
