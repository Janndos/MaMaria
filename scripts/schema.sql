
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
