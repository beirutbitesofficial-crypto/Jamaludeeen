const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

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

// Ensure a fresh production database always has an administrator.
// Hostinger deployments do not run the seed script automatically.
const adminCount = db.prepare(`SELECT COUNT(*) AS count FROM admins`).get().count;
if (adminCount === 0) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO admins (username, password) VALUES (?, ?)`).run(username, passwordHash);
  console.log(`Initial administrator created: ${username}`);
}

module.exports = db;

try {
  db.exec(`ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'local' CHECK(type IN ('local','brand'))`);
} catch (_) { /* column already exists */ }

// ── Runtime migrations (safe, idempotent) ─────────────────────────────────────
try {
  db.exec(`ALTER TABLE products ADD COLUMN brand_category_id INTEGER REFERENCES brand_categories(id) ON DELETE SET NULL`);
} catch (_) { /* column already exists */ }

// One-time production synchronization for local Men inventory only.
const MEN_CATALOG_VERSION = '2026-08-05-v1';
const menCatalogVersion = db.prepare(`SELECT value FROM settings WHERE key='men_catalog_version'`).get()?.value;
if (menCatalogVersion !== MEN_CATALOG_VERSION) {
  const { MEN } = require('./replace-men');
  const configuredPrice = db.prepare(`SELECT value FROM settings WHERE key='local_price_men'`).get()?.value;
  const sharedPrice = configuredPrice !== undefined && configuredPrice !== '' ? Number(configuredPrice) : 50000;
  const synchronizeMen = db.transaction(() => {
    db.prepare(`DELETE FROM products WHERE category='men' AND type='local'`).run();
    const insert = db.prepare(`
      INSERT INTO products
        (name_en, category, brand, type, price, image_path, brand_category_id, in_stock, featured)
      VALUES (?, 'men', ?, 'local', ?, NULL, NULL, 1, 0)
    `);
    for (const product of MEN) insert.run(product.n, product.brand, sharedPrice);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('men_catalog_version', ?)`).run(MEN_CATALOG_VERSION);
  });
  synchronizeMen();
  console.log(`Men catalog synchronized: ${MEN.length} local products.`);
}

// One-time production synchronization for local Women inventory only.
const WOMEN_CATALOG_VERSION = '2026-08-05-v1';
const womenCatalogVersion = db.prepare(`SELECT value FROM settings WHERE key='women_catalog_version'`).get()?.value;
if (womenCatalogVersion !== WOMEN_CATALOG_VERSION) {
  const { WOMEN } = require('./replace-women');
  const configuredPrice = db.prepare(`SELECT value FROM settings WHERE key='local_price_women'`).get()?.value;
  const sharedPrice = configuredPrice !== undefined && configuredPrice !== '' ? Number(configuredPrice) : 50000;
  const synchronizeWomen = db.transaction(() => {
    db.prepare(`DELETE FROM products WHERE category='women' AND type='local'`).run();
    const insert = db.prepare(`
      INSERT INTO products
        (name_en, category, brand, type, price, image_path, brand_category_id, in_stock, featured)
      VALUES (?, 'women', ?, 'local', ?, NULL, NULL, 1, 0)
    `);
    for (const product of WOMEN) insert.run(product.n, product.brand, sharedPrice);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('women_catalog_version', ?)`).run(WOMEN_CATALOG_VERSION);
  });
  synchronizeWomen();
  console.log(`Women catalog synchronized: ${WOMEN.length} local products.`);
}
