import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import path from "path";
import fs from "fs";

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
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
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
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS news_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  tg_url TEXT,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
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
  addColumn("order_items", "source_type", "TEXT NOT NULL DEFAULT 'daily'");
  addColumn("order_items", "unit", "TEXT");

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
  password_hash: string; role: "customer" | "admin";
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
  price_mdl: number; available: number; sort_order: number;
  created_at: string; updated_at: string;
};
export type Order = {
  id: number; user_id: number; status: string; total_mdl: number;
  pickup_time: string; pickup_location: string | null; comment: string | null;
  cancellation_reason: string | null; created_at: string;
};
export type NewsPost = {
  id: number; title: string; body: string; image_url: string | null;
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

export function getMenuItems(menuId: number): MenuItem[] {
  return db.prepare(`
    SELECT mi.*, mc.name AS category
    FROM menu_items mi LEFT JOIN menu_categories mc ON mc.id = mi.category_id
    WHERE mi.menu_id = ?
    ORDER BY COALESCE(mc.sort_order, 999), mi.sort_order, mi.id
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
