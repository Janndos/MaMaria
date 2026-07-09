/* ============================================================================
 *  Production reset — wipe all demo/seed data, keep only what a real launch needs.
 *  ----------------------------------------------------------------------------
 *  KEEPS:   the admin account, app settings, and the permanent products
 *           (stable_items — the real "Bucate la comandă" catalogue). If the
 *           permanent-products table is empty (e.g. a fresh Railway volume), the
 *           default catalogue is seeded so the site is never left without it.
 *  DELETES: demo customers, all orders, OTP codes, news posts, every daily menu
 *           + its items, and menu categories.
 *
 *  Safe to run on a brand-new empty DATA_DIR: the schema is created if missing.
 *
 *  Usage:
 *    node scripts/prod-reset.mjs                       # keep permanent products
 *    node scripts/prod-reset.mjs --wipe-stable         # also remove permanent products
 *    ADMIN_PHONE=admin ADMIN_PASSWORD=... node scripts/prod-reset.mjs
 *                                                      # (re)set the admin login
 * ========================================================================== */
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { seedStableDefaults } from "./stable-defaults.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const dbPath = path.join(dataDir, "mamaria.db");

// Create the data dir + schema if this is a fresh volume so the reset can run
// before the app has ever booted (mirrors lib/db.ts / scripts/seed.mjs).
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const freshDb = !fs.existsSync(dbPath);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(root, "scripts", "schema.sql"), "utf-8"));
if (freshDb) console.log("Created new database with schema:", dbPath);

const wipeStable = process.argv.includes("--wipe-stable");
const ADMIN_PHONE = process.env.ADMIN_PHONE || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const tx = db.transaction(() => {
  // Transactional / demo data — always removed.
  db.prepare("DELETE FROM order_items").run();
  db.prepare("DELETE FROM orders").run();
  db.prepare("DELETE FROM otp_codes").run();
  db.prepare("DELETE FROM news_posts").run();
  db.prepare("DELETE FROM menu_items").run();
  db.prepare("DELETE FROM menus").run();
  db.prepare("DELETE FROM menu_categories").run();

  // Everyone except admin accounts.
  db.prepare("DELETE FROM users WHERE role <> 'admin'").run();

  if (wipeStable) {
    db.prepare("DELETE FROM stable_items").run();
  } else {
    // Fresh volume (or otherwise empty) → seed the default permanent products so
    // "Bucate la comandă" is never empty on a real deployment.
    const seeded = seedStableDefaults(db);
    if (seeded.inserted) console.log(`Seeded ${seeded.inserted} default permanent products.`);
  }

  // Ensure exactly one admin exists and is phone-verified.
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  if (ADMIN_PASSWORD) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    if (admin) {
      db.prepare("UPDATE users SET phone = ?, password_hash = ?, phone_verified = 1 WHERE id = ?")
        .run(ADMIN_PHONE, hash, admin.id);
    } else {
      db.prepare("INSERT INTO users (full_name, phone, password_hash, role, phone_verified) VALUES (?,?,?,'admin',1)")
        .run("Administrator", ADMIN_PHONE, hash);
    }
  } else if (!admin) {
    console.error("\n⚠ No admin account exists and ADMIN_PASSWORD was not provided. Aborting.");
    throw new Error("no-admin");
  }

  // Sensible production defaults if settings are missing.
  for (const [k, v] of [["order_cutoff", "10:30"], ["orders_enabled", "true"]]) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run(k, v);
  }
});

try {
  tx();
} catch (e) {
  if (e.message !== "no-admin") console.error(e);
  process.exit(1);
}

const counts = {
  users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
  admins: db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c,
  orders: db.prepare("SELECT COUNT(*) c FROM orders").get().c,
  menus: db.prepare("SELECT COUNT(*) c FROM menus").get().c,
  news: db.prepare("SELECT COUNT(*) c FROM news_posts").get().c,
  stable_items: db.prepare("SELECT COUNT(*) c FROM stable_items").get().c,
};
console.log("✓ Production reset complete.");
console.table(counts);
if (!ADMIN_PASSWORD) console.log("Note: admin password unchanged. Set ADMIN_PASSWORD to rotate it.");
console.log(wipeStable ? "Permanent products were WIPED." : "Permanent products (stable_items) were kept.");
