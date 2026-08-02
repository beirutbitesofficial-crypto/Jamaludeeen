const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'store.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    name_ar TEXT,
    type TEXT NOT NULL DEFAULT 'western' CHECK(type IN ('western','khaleeji')),
    logo_path TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    category TEXT NOT NULL CHECK(category IN ('men','women','unisex')),
    brand TEXT NOT NULL DEFAULT 'Other',
    price REAL,
    image_path TEXT,
    description_en TEXT,
    description_ar TEXT,
    type TEXT NOT NULL DEFAULT 'local' CHECK(type IN ('local','brand')),
    in_stock INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_city TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cod','whish')),
    subtotal REAL NOT NULL DEFAULT 0,
    delivery_fee REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','confirmed','shipped','delivered','cancelled')),
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS brand_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    image_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// Default settings
const setSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
[
  ['whish_number', process.env.WHISH_NUMBER || ''],
  ['store_phone', process.env.STORE_PHONE || ''],
  ['store_whatsapp', process.env.STORE_WHATSAPP || ''],
  ['store_address', process.env.STORE_ADDRESS || 'Lebanon'],
  ['delivery_fee', '0'],
  ['hero_title_en', 'Discover Your Signature Scent'],
  ['hero_title_ar', 'اكتشف عطرك المميز'],
  ['hero_sub_en', 'Premium perfumes delivered all over Lebanon'],
  ['hero_sub_ar', 'عطور فاخرة توصل لجميع أنحاء لبنان'],
].forEach(([k, v]) => setSetting.run(k, v));

module.exports = db;

try {
  db.exec(`ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'local' CHECK(type IN ('local','brand'))`);
} catch (_) { /* column already exists */ }

// ── Runtime migrations (safe, idempotent) ─────────────────────────────────────
try {
  db.exec(`ALTER TABLE products ADD COLUMN brand_category_id INTEGER REFERENCES brand_categories(id) ON DELETE SET NULL`);
} catch (_) { /* column already exists */ }
