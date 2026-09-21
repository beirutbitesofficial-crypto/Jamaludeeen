const db = require('./db');

function addColumn(table, definition) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`); }
  catch (_) { /* already exists */ }
}

// Extend the existing storefront products instead of duplicating the catalog.
addColumn('products', 'sku TEXT');
addColumn('products', 'barcode TEXT');
addColumn('products', 'cost_price REAL NOT NULL DEFAULT 0');
addColumn('products', 'stock_qty REAL NOT NULL DEFAULT 0');
addColumn('products', 'low_stock_threshold REAL NOT NULL DEFAULT 5');
addColumn('products', 'track_stock INTEGER NOT NULL DEFAULT 0');
addColumn('products', 'price_50ml REAL');
addColumn('products', 'price_100ml REAL');
addColumn('products', 'cost_50ml REAL');
addColumn('products', 'cost_100ml REAL');

addColumn('sale_items', 'size_ml INTEGER');
addColumn('sale_items', 'stock_deduction REAL NOT NULL DEFAULT 0');
addColumn('sales', 'change_usd REAL NOT NULL DEFAULT 0');
addColumn('expenses', 'shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL');
addColumn('order_items', 'size_ml INTEGER');
addColumn('order_items', 'stock_deduction REAL NOT NULL DEFAULT 0');
addColumn('orders', 'stock_reserved INTEGER NOT NULL DEFAULT 0');
addColumn('orders', 'sales_id INTEGER REFERENCES sales(id) ON DELETE SET NULL');

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
    ON products(sku) WHERE sku IS NOT NULL AND sku <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique
    ON products(barcode) WHERE barcode IS NOT NULL AND barcode <> '';

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    notes TEXT,
    total_spent REAL NOT NULL DEFAULT 0,
    visits INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS staff_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK(role IN ('manager','cashier')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL,
    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT,
    opening_lbp REAL NOT NULL DEFAULT 0,
    opening_usd REAL NOT NULL DEFAULT 0,
    closing_lbp REAL,
    closing_usd REAL,
    expected_lbp REAL,
    expected_usd REAL,
    difference_lbp REAL,
    difference_usd REAL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash_lbp',
    exchange_rate REAL NOT NULL DEFAULT 89500,
    tendered_lbp REAL NOT NULL DEFAULT 0,
    tendered_usd REAL NOT NULL DEFAULT 0,
    change_lbp REAL NOT NULL DEFAULT 0,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
    cashier_name TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','refunded','voided')),
    source TEXT NOT NULL DEFAULT 'pos' CHECK(source IN ('pos','online','manual')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    refunded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0,
    line_discount REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('sale','purchase','adjustment','return','opening')),
    quantity REAL NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    note TEXT,
    staff_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_lbp REAL NOT NULL DEFAULT 0,
    amount_usd REAL NOT NULL DEFAULT 0,
    exchange_rate REAL NOT NULL DEFAULT 89500,
    staff_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('sale','refund','expense','paid_in','paid_out')),
    reference_type TEXT,
    reference_id INTEGER,
    amount_lbp REAL NOT NULL DEFAULT 0,
    amount_usd REAL NOT NULL DEFAULT 0,
    note TEXT,
    staff_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    invoice_number TEXT,
    total_cost_lbp REAL NOT NULL DEFAULT 0,
    notes TEXT,
    staff_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    line_total REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
  CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id, created_at);
`);

const setSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
[
  ['system_exchange_rate', '89500'],
  ['system_store_name', 'JAMALUDEEN'],
  ['system_receipt_footer', 'Thank you for shopping with JAMALUDEEN'],
].forEach(([key, value]) => setSetting.run(key, value));

module.exports = db;
