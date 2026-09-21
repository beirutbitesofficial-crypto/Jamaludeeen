const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jamaludeen-smoke-'));
const backupDir = path.join(dataDir, 'backups');
const port = 3199;
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  DATA_DIR: dataDir,
  BACKUP_DIR: backupDir,
  DISABLE_AUTO_BACKUP: '1',
  SESSION_SECRET: 'smoke-test-session-secret-that-is-long-enough',
  ADMIN_USERNAME: 'smokeowner',
  ADMIN_PASSWORD: 'SmokePassword123!',
};

let child;
let cookie = '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(base + url, { redirect: 'manual', ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return response;
}

async function json(url, body) {
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(`${url} failed (${response.status}): ${data.error || 'unknown error'}`);
  return data;
}

async function form(url, body) {
  return request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

function startServer() {
  child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => process.stdout.write('[server] ' + chunk));
  child.stderr.on('data', chunk => process.stderr.write('[server] ' + chunk));
}

async function stopServer() {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 2000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function waitReady() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base + '/system/login', { redirect: 'manual' });
      if (r.status === 200 || r.status === 302) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Server did not become ready.');
}

async function main() {
  try {
    startServer();
    await waitReady();

    let response = await form('/system/login', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
    assert(response.status === 302, 'System login failed.');

    const dbPath = path.join(dataDir, 'store.db');
    const db = new Database(dbPath);
    const product = db.prepare(`
      INSERT INTO products(name_en,name_ar,category,brand,price,price_50ml,price_100ml,cost_price,
        stock_qty,low_stock_threshold,track_stock,type,in_stock)
      VALUES ('Smoke Perfume',NULL,'unisex','Smoke',50000,50000,90000,500,1000,100,1,'local',1)
    `).run();
    const productId = Number(product.lastInsertRowid);

    await json('/system/api/shift/open', { opening_lbp: 100000, opening_usd: 20 });

    const sale50 = await json('/system/api/sales', {
      items: [{ product_id: productId, quantity: 1, size_ml: 50 }],
      payment_method: 'cash_lbp',
      exchange_rate: 89500,
      tendered_lbp: 60000,
      tendered_usd: 0,
    });
    assert(db.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 950, '50ml sale did not deduct 50ml.');
    let saleItem = db.prepare('SELECT * FROM sale_items WHERE sale_id=?').get(sale50.saleId);
    assert(saleItem.size_ml === 50 && saleItem.stock_deduction === 50, '50ml sale item stock deduction is wrong.');
    assert(saleItem.unit_cost === 25000, '50ml COGS is wrong.');

    const sale100 = await json('/system/api/sales', {
      items: [{ product_id: productId, quantity: 1, size_ml: 100 }],
      payment_method: 'whish',
      exchange_rate: 89500,
    });
    assert(db.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 850, '100ml sale did not deduct 100ml.');
    saleItem = db.prepare('SELECT * FROM sale_items WHERE sale_id=?').get(sale100.saleId);
    assert(saleItem.unit_cost === 50000, '100ml COGS is wrong.');

    await json('/system/api/sales/' + sale50.saleId + '/refund', {});
    assert(db.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 900, 'Refund did not restore 50ml.');

    await json('/system/api/expenses', {
      category: 'Supplies',
      description: 'Smoke expense',
      amount_lbp: 10000,
      amount_usd: 0,
      exchange_rate: 89500,
      from_drawer: true,
    });

    const close = await json('/system/api/shift/close', { closing_lbp: 90000, closing_usd: 20 });
    assert(close.difference_lbp === 0 && Math.abs(close.difference_usd) < 0.000001, 'Shift reconciliation is not exact.');

    await json('/system/api/purchases', {
      supplier_name: 'Smoke Supplier',
      invoice_number: 'SMOKE-1',
      items: [{ product_id: productId, quantity: 200, unit_cost: 400 }],
    });
    assert(db.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 1100, 'Purchase did not add ml stock.');
    assert(db.prepare('SELECT cost_price FROM products WHERE id=?').get(productId).cost_price === 400, 'Purchase did not update cost per ml.');

    db.close();
    await stopServer();

    // Restart with the same DATA_DIR. The same session cookie must remain valid.
    startServer();
    await waitReady();
    response = await request('/system/api/dashboard');
    assert(response.status === 200, 'Persistent session did not survive restart.');

    const db2 = new Database(dbPath);
    assert(db2.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 1100, 'Database did not persist across restart.');

    response = await form('/cart/add', { productId: String(productId), qty: '1', size_ml: '100' });
    assert(response.status === 302, 'Could not add 100ml product to website cart.');
    response = await form('/checkout', {
      name: 'Smoke Customer',
      phone: '70000000',
      address: 'Smoke Street',
      city: 'Beirut',
      payment_method: 'whish',
      notes: 'integration test',
    });
    assert(response.status === 302, 'Online checkout failed.');
    const order = db2.prepare("SELECT * FROM orders WHERE customer_name='Smoke Customer' ORDER BY id DESC LIMIT 1").get();
    assert(order && order.stock_reserved === 1, 'Online order did not reserve stock.');
    const orderItem = db2.prepare('SELECT * FROM order_items WHERE order_id=?').get(order.id);
    assert(orderItem.size_ml === 100 && orderItem.stock_deduction === 100, 'Online order size/stock deduction is wrong.');
    assert(db2.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 1000, 'Online order did not deduct 100ml.');

    response = await form('/admin/login', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
    assert(response.status === 302, 'Admin login failed.');

    response = await form('/admin/orders/' + order.id + '/status', { status: 'delivered' });
    assert(response.status === 302, 'Could not mark online order delivered.');
    const delivered = db2.prepare('SELECT * FROM orders WHERE id=?').get(order.id);
    assert(delivered.sales_id, 'Delivered online order was not added to sales ledger.');
    const onlineSale = db2.prepare('SELECT * FROM sales WHERE id=?').get(delivered.sales_id);
    assert(onlineSale.source === 'online' && onlineSale.status === 'completed', 'Online sale ledger entry is wrong.');

    response = await form('/admin/orders/' + order.id + '/status', { status: 'cancelled' });
    assert(response.status === 302, 'Could not cancel delivered online order.');
    const cancelled = db2.prepare('SELECT * FROM orders WHERE id=?').get(order.id);
    assert(cancelled.stock_reserved === 0, 'Cancellation did not release reserved stock.');
    assert(db2.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId).stock_qty === 1100, 'Cancellation did not restore 100ml.');
    assert(db2.prepare('SELECT status FROM sales WHERE id=?').get(delivered.sales_id).status === 'refunded', 'Cancelled delivered order did not reverse sales ledger.');

    db2.close();
    console.log('PRODUCTION SMOKE OK');
  } finally {
    await stopServer();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
