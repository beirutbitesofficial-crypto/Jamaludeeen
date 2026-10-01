const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../database/store-system');
const { saleUnitCost } = require('../helpers/inventory');
const adminAuth = require('../middleware/adminAuth');
const { loginRateLimit, clearLoginAttempts } = require('../middleware/loginRateLimit');
const { uploadsDir: persistentUploadsDir } = require('../database/runtime-paths');
const { translator } = require('../helpers/back-office-i18n');
const { SECTION_KEYS, refillPricesUsd, sectionWhere, sectionCounts, brandList, collectionCovers } = require('../helpers/catalog');
const { exchangeRate } = require('../helpers/pricing');

const tr = req => translator(req.session.lang);
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

// ── Uploads (all kept in the persistent uploads directory) ───────────────────
function imageUploader(subdir, prefix, maxMb) {
  const dir = path.join(persistentUploadsDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => cb(null, `${prefix(req)}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => (IMAGE_EXT.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG or WebP images are allowed.'))),
  });
}
const upload = imageUploader('products', req => `product-${req.params.id || 'new'}`, 5);
const uploadBrand = imageUploader('brands', req => `brand-${req.params.id}`, 2);
const uploadBrandCat = imageUploader('brands', req => `line-${req.params.brandId}`, 5);
const uploadSettings = imageUploader('settings', req => req.params.type, 10);

// Turn multer errors into a friendly message instead of a crash page.
const withUpload = (mw, back) => (req, res, next) => mw(req, res, err => {
  if (!err) return next();
  req.flash('error', err.message);
  res.redirect(typeof back === 'function' ? back(req) : back);
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function getSettings() {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value]));
}
function managedFilePath(urlPath) {
  if (!urlPath) return null;
  if (String(urlPath).startsWith('/uploads/')) return path.join(persistentUploadsDir, String(urlPath).slice('/uploads/'.length));
  return null; // bundled images under /images are never deleted from the admin
}
function removeManagedFile(urlPath) {
  const file = managedFilePath(urlPath);
  if (file && fs.existsSync(file)) fs.unlinkSync(file);
}
const back = (req, fallback) => req.get('Referrer') || fallback;
const pageOf = v => Math.max(1, parseInt(v, 10) || 1);

// ── Login ───────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { title: tr(req)('login') });
});

router.post('/login', loginRateLimit('admin'), (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (admin && bcrypt.compareSync(String(password || ''), admin.password)) {
    clearLoginAttempts(req, 'admin');
    req.session.isAdmin = true;
    req.session.adminUsername = admin.username;
    return res.redirect('/admin/dashboard');
  }
  req.flash('error', tr(req)('invalid_login'));
  res.redirect('/admin/login');
});

router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  req.session.adminUsername = null;
  res.redirect('/admin/login');
});

// ── Dashboard ───────────────────────────────────────────────────────────────
router.get('/', adminAuth, (req, res) => res.redirect('/admin/dashboard'));

router.get('/dashboard', adminAuth, (req, res) => {
  const rate = exchangeRate(getSettings());
  const revenue = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN currency = 'USD' THEN total * ? ELSE total END), 0) AS s
    FROM orders WHERE status != 'cancelled'
  `).get(rate).s;
  const stats = {
    products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
    orders: db.prepare('SELECT COUNT(*) AS c FROM orders').get().c,
    pending: db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='pending'").get().c,
    revenue,
  };
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all();
  const counts = sectionCounts(db);
  const missingPhotos = db.prepare("SELECT COUNT(*) AS c FROM products WHERE COALESCE(image_path, '') = ''").get().c;
  res.render('admin/dashboard', { title: tr(req)('dashboard'), stats, recentOrders, counts, missingPhotos });
});

// ── Catalog overview (same four sections as the website) ────────────────────
router.get('/catalog', adminAuth, (req, res) => {
  const settings = getSettings();
  res.render('admin/catalog', {
    title: tr(req)('catalog'),
    counts: sectionCounts(db),
    brands: brandList(db),
    covers: collectionCovers(settings),
    refill: refillPricesUsd(settings),
  });
});

// ── Products ────────────────────────────────────────────────────────────────
router.get('/products', adminAuth, (req, res) => {
  const section = SECTION_KEYS.includes(req.query.section) ? req.query.section : 'men';
  const brand = section === 'brands' ? String(req.query.brand || '') : '';
  const q = String(req.query.q || '').trim();
  const photo = ['with', 'without'].includes(req.query.photo) ? req.query.photo : '';
  const page = pageOf(req.query.page);
  const PAGE = 36;

  const { where, params } = sectionWhere(section, brand);
  if (q) { where.push('(name_en LIKE ? OR name_ar LIKE ? OR brand LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (photo === 'with') where.push("COALESCE(image_path, '') <> ''");
  if (photo === 'without') where.push("COALESCE(image_path, '') = ''");
  const ws = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) AS c FROM products WHERE ${ws}`).get(...params).c;
  const products = db.prepare(`SELECT * FROM products WHERE ${ws} ORDER BY brand = '' , name_en LIMIT ? OFFSET ?`)
    .all(...params, PAGE, (page - 1) * PAGE);

  res.render('admin/products', {
    title: tr(req)('products'),
    products,
    counts: sectionCounts(db),
    brands: brandList(db),
    refill: refillPricesUsd(getSettings()),
    filters: { section, brand, q, photo },
    pagination: { page, totalPages: Math.ceil(total / PAGE), total },
  });
});

router.post('/products/new', adminAuth, (req, res) => {
  const a = tr(req);
  const name = String(req.body.name_en || '').trim();
  const section = SECTION_KEYS.includes(req.body.section) ? req.body.section : '';
  if (!name || !section) {
    req.flash('error', a('fill_required'));
    return res.redirect(back(req, '/admin/products'));
  }
  let info;
  if (section === 'brands') {
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(parseInt(req.body.brand_id, 10));
    if (!brand) { req.flash('error', a('choose_brand')); return res.redirect(back(req, '/admin/products')); }
    // Keep the brand's line structure: put new products in its first line.
    const line = db.prepare('SELECT id FROM brand_categories WHERE brand_id = ? ORDER BY sort_order, id LIMIT 1').get(brand.id);
    info = db.prepare(`INSERT INTO products (name_en, category, brand, type, brand_category_id, in_stock)
                       VALUES (?, 'unisex', ?, 'brand', ?, 1)`).run(name, brand.name, line ? line.id : null);
  } else {
    const house = String(req.body.house || '').trim() || 'Jamaludeen';
    info = db.prepare(`INSERT INTO products (name_en, category, brand, type, price, in_stock)
                       VALUES (?, ?, ?, 'local', 0, 1)`).run(name, section, house);
  }
  req.flash('success', a('product_created'));
  res.redirect(`/admin/products/${info.lastInsertRowid}/edit`);
});

router.get('/products/:id(\\d+)/edit', adminAuth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).render('404', { title: '404' });
  res.render('admin/product-edit', {
    title: tr(req)('edit_product'),
    product,
    brands: brandList(db),
    refill: refillPricesUsd(getSettings()),
  });
});

// Saving a product only ever changes that one product.
router.post('/products/:id(\\d+)', adminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).render('404', { title: '404' });
  const text = v => String(v || '').trim() || null;
  const name = String(req.body.name_en || '').trim() || product.name_en;

  const cols = {
    name_en: name,
    name_ar: text(req.body.name_ar),
    description_en: text(req.body.description_en),
    description_ar: text(req.body.description_ar),
    in_stock: req.body.in_stock === '1' ? 1 : 0,
    featured: req.body.featured === '1' ? 1 : 0,
    updated_at: new Date().toISOString(),
  };
  if (product.type === 'brand') {
    const price = parseFloat(req.body.price);
    cols.price = Number.isFinite(price) && price >= 0 ? price : null;
  } else {
    cols.brand = String(req.body.house || '').trim() || product.brand;
    if (SECTION_KEYS.includes(req.body.section) && req.body.section !== 'brands') cols.category = req.body.section;
  }
  const set = Object.keys(cols).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE products SET ${set} WHERE id = ?`).run(...Object.values(cols), id);
  req.flash('success', tr(req)('product_saved'));
  res.redirect(`/admin/products/${id}/edit`);
});

router.post('/products/:id(\\d+)/image', adminAuth, withUpload(upload.single('image'), req => back(req, '/admin/products')), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT image_path FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).render('404', { title: '404' });
  if (!req.file) { req.flash('error', tr(req)('fill_required')); return res.redirect(back(req, '/admin/products')); }
  removeManagedFile(product.image_path);
  db.prepare('UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?')
    .run(`/uploads/products/${req.file.filename}`, new Date().toISOString(), id);
  req.flash('success', tr(req)('photo_updated'));
  res.redirect(back(req, `/admin/products/${id}/edit`));
});

router.post('/products/:id(\\d+)/delete-image', adminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT image_path FROM products WHERE id = ?').get(id);
  if (product?.image_path) {
    removeManagedFile(product.image_path);
    db.prepare('UPDATE products SET image_path = NULL, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }
  req.flash('success', tr(req)('photo_removed'));
  res.redirect(`/admin/products/${id}/edit`);
});

// ── Prices ──────────────────────────────────────────────────────────────────
router.get('/prices', adminAuth, (req, res) => {
  const brand = String(req.query.brand || '');
  const q = String(req.query.q || '').trim();
  const { where, params } = sectionWhere('brands', brand);
  if (q) { where.push('(name_en LIKE ? OR brand LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const products = db.prepare(`SELECT id, name_en, brand, price, image_path FROM products WHERE ${where.join(' AND ')} ORDER BY brand, name_en LIMIT 400`).all(...params);
  const settings = getSettings();
  res.render('admin/prices', {
    title: tr(req)('prices'),
    products,
    brands: brandList(db),
    refill: refillPricesUsd(settings),
    rate: exchangeRate(settings),
    filters: { brand, q },
  });
});

router.post('/prices/refill', adminAuth, (req, res) => {
  const val = v => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? String(n) : null; };
  const p50 = val(req.body.price_50), p100 = val(req.body.price_100);
  if (!p50 || !p100) { req.flash('error', tr(req)('fill_required')); return res.redirect('/admin/prices'); }
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(() => { upsert.run('refill_price_50ml_usd', p50); upsert.run('refill_price_100ml_usd', p100); })();
  req.flash('success', tr(req)('refill_prices_saved'));
  res.redirect('/admin/prices');
});

router.post('/prices/bulk', adminAuth, (req, res) => {
  const prices = req.body.prices || {};
  const update = db.prepare("UPDATE products SET price = ?, updated_at = ? WHERE id = ? AND type = 'brand'");
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const [id, value] of Object.entries(prices)) {
      const p = parseFloat(value);
      update.run(String(value).trim() === '' ? null : (Number.isFinite(p) && p >= 0 ? p : null), now, parseInt(id, 10));
    }
  })();
  req.flash('success', tr(req)('prices_updated'));
  res.redirect('/admin/prices' + (req.body._qs ? '?' + req.body._qs : ''));
});

// ── Images ──────────────────────────────────────────────────────────────────
router.get('/images', adminAuth, (req, res) => {
  const section = SECTION_KEYS.includes(req.query.section) ? req.query.section : 'brands';
  const brand = section === 'brands' ? String(req.query.brand || '') : '';
  const photo = ['with', 'without'].includes(req.query.photo) ? req.query.photo : '';
  const page = pageOf(req.query.page);
  const PAGE = 48;
  const { where, params } = sectionWhere(section, brand);
  if (photo === 'with') where.push("COALESCE(image_path, '') <> ''");
  if (photo === 'without') where.push("COALESCE(image_path, '') = ''");
  const ws = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM products WHERE ${ws}`).get(...params).c;
  const products = db.prepare(`SELECT id, name_en, brand, image_path FROM products WHERE ${ws} ORDER BY name_en LIMIT ? OFFSET ?`)
    .all(...params, PAGE, (page - 1) * PAGE);
  res.render('admin/images', {
    title: tr(req)('images'),
    products,
    counts: sectionCounts(db),
    brands: brandList(db),
    settings: getSettings(),
    filters: { section, brand, photo },
    pagination: { page, totalPages: Math.ceil(total / PAGE), total },
  });
});

// ── Orders ──────────────────────────────────────────────────────────────────
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

router.get('/orders', adminAuth, (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
  const q = String(req.query.q || '').trim();
  const page = pageOf(req.query.page);
  const PAGE = 25;
  const where = ['1=1'];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (q) { where.push('(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const ws = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE ${ws}`).get(...params).c;
  const orders = db.prepare(`SELECT * FROM orders WHERE ${ws} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, PAGE, (page - 1) * PAGE);
  const statusCounts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all().map(r => [r.status, r.c]));
  res.render('admin/orders', {
    title: tr(req)('orders'),
    orders, statusCounts,
    filters: { status, q },
    pagination: { page, totalPages: Math.ceil(total / PAGE), total },
  });
});

router.get('/orders/:id(\\d+)', adminAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).render('404', { title: '404' });
  const items = db.prepare(`
    SELECT oi.*, p.image_path FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ? ORDER BY oi.id
  `).all(order.id);
  res.render('admin/order-detail', { title: `${tr(req)('order')} ${order.order_number}`, order, items });
});

router.post('/orders/:id(\\d+)/status', adminAuth, (req, res) => {
  const { status } = req.body;
  const orderId = parseInt(req.params.id, 10);
  if (!ORDER_STATUSES.includes(status)) return res.redirect(`/admin/orders/${orderId}`);
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if (!order) return res.status(404).render('404', { title: '404' });
  if (order.status === status) return res.redirect(`/admin/orders/${orderId}`);

  try {
    db.transaction(() => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId);

      // Re-activate a cancelled order by reserving its stock again.
      if (order.status === 'cancelled' && status !== 'cancelled' && !order.stock_reserved) {
        for (const item of items) {
          if (!item.product_id || !Number(item.stock_deduction)) continue;
          const p = db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
          if (!p || !p.track_stock) continue;
          if (Number(item.stock_deduction) > Number(p.stock_qty || 0)) throw new Error(`Not enough stock to reactivate ${item.product_name}.`);
        }
        for (const item of items) {
          if (!item.product_id || !Number(item.stock_deduction)) continue;
          const p = db.prepare('SELECT track_stock FROM products WHERE id=?').get(item.product_id);
          if (!p?.track_stock) continue;
          db.prepare('UPDATE products SET stock_qty=stock_qty-?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.stock_deduction, item.product_id);
          db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
            VALUES (?,'sale',?,'online_order',?,'Order reactivated','Website Admin')`).run(item.product_id, -Number(item.stock_deduction), orderId);
        }
        db.prepare('UPDATE orders SET stock_reserved=1 WHERE id=?').run(orderId);
      }

      // Cancelling a reserved order returns exactly what was reserved.
      if (status === 'cancelled' && order.status !== 'cancelled' && order.stock_reserved) {
        for (const item of items) {
          if (!item.product_id || !Number(item.stock_deduction)) continue;
          const p = db.prepare('SELECT track_stock FROM products WHERE id=?').get(item.product_id);
          if (!p?.track_stock) continue;
          db.prepare('UPDATE products SET stock_qty=stock_qty+?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.stock_deduction, item.product_id);
          db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
            VALUES (?,'return',?,'online_order',?,'Online order cancelled','Website Admin')`).run(item.product_id, Number(item.stock_deduction), orderId);
        }
        db.prepare('UPDATE orders SET stock_reserved=0 WHERE id=?').run(orderId);
      }

      let salesId = order.sales_id;
      if (status === 'delivered') {
        if (!salesId) {
          // The sales ledger is in LBP; convert USD website orders at the current rate.
          const rate = exchangeRate(getSettings());
          const k = order.currency === 'USD' ? rate : 1;
          const saleInfo = db.prepare(`
            INSERT INTO sales(sale_number,customer_name,customer_phone,subtotal,discount,total,payment_method,
              exchange_rate,tendered_lbp,tendered_usd,change_lbp,change_usd,shift_id,cashier_name,notes,status,source)
            VALUES (?,?,?,?,0,?,?,?,0,0,0,0,NULL,'Online Store',?,'completed','online')
          `).run('WEB-' + order.order_number, order.customer_name, order.customer_phone,
            Math.round(order.subtotal * k), Math.round(order.total * k), order.payment_method, rate,
            `Website order ${order.order_number}`);
          salesId = saleInfo.lastInsertRowid;
          const insertSaleItem = db.prepare(`
            INSERT INTO sale_items(sale_id,product_id,product_name,quantity,size_ml,stock_deduction,unit_price,unit_cost,line_total,note)
            VALUES (?,?,?,?,?,?,?,?,?,?)
          `);
          for (const item of items) {
            const p = item.product_id ? db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id) : null;
            const cost = p ? saleUnitCost(p, item.size_ml) : 0;
            const unit = Math.round(item.price * k);
            insertSaleItem.run(salesId, item.product_id, item.product_name, item.quantity, item.size_ml, item.stock_deduction, unit, cost, unit * item.quantity, 'Online order');
          }
          db.prepare('UPDATE orders SET sales_id=? WHERE id=?').run(salesId, orderId);
        } else {
          db.prepare("UPDATE sales SET status='completed', refunded_at=NULL WHERE id=?").run(salesId);
        }
      } else if (salesId && order.status === 'delivered') {
        db.prepare("UPDATE sales SET status=?, refunded_at=CASE WHEN ?='refunded' THEN CURRENT_TIMESTAMP ELSE refunded_at END WHERE id=?")
          .run(status === 'cancelled' ? 'refunded' : 'voided', status === 'cancelled' ? 'refunded' : 'voided', salesId);
      } else if (salesId && status === 'cancelled') {
        db.prepare("UPDATE sales SET status='refunded', refunded_at=CURRENT_TIMESTAMP WHERE id=?").run(salesId);
      }

      db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, orderId);
    })();
    req.flash('success', tr(req)('status_updated'));
  } catch (error) {
    req.flash('error', error.message);
  }
  res.redirect(`/admin/orders/${orderId}`);
});

router.get('/api/orders/stats', adminAuth, (req, res) => {
  const pending = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='pending'").get().c;
  const latest = db.prepare('SELECT id, order_number, customer_name, total, currency FROM orders ORDER BY id DESC LIMIT 1').get();
  res.json({ pending, latest: latest || null });
});

// ── Settings ────────────────────────────────────────────────────────────────
router.get('/settings', adminAuth, (req, res) => {
  const settings = getSettings();
  res.render('admin/settings', { title: tr(req)('settings'), settings, rate: exchangeRate(settings) });
});

router.post('/settings', adminAuth, (req, res) => {
  const allowed = ['whish_number', 'store_phone', 'store_whatsapp', 'store_address', 'delivery_fee', 'instagram', 'tiktok'];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const key of allowed) if (req.body[key] !== undefined) upsert.run(key, String(req.body[key]).trim());
    const rate = parseFloat(req.body.exchange_rate);
    if (Number.isFinite(rate) && rate > 0) {
      // Website and Store System share one exchange rate.
      upsert.run('usd_rate', String(rate));
      upsert.run('system_exchange_rate', String(rate));
    }
  })();
  req.flash('success', tr(req)('settings_saved'));
  res.redirect('/admin/settings');
});

router.post('/change-password', adminAuth, (req, res) => {
  const a = tr(req);
  const { current, newPass, confirm } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(req.session.adminUsername);
  if (!admin || !bcrypt.compareSync(String(current || ''), admin.password)) { req.flash('error', a('pw_wrong')); return res.redirect('/admin/settings'); }
  if (newPass !== confirm) { req.flash('error', a('pw_mismatch')); return res.redirect('/admin/settings'); }
  if (String(newPass || '').length < 8) { req.flash('error', a('pw_short')); return res.redirect('/admin/settings'); }
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPass, 10), admin.id);
  req.flash('success', a('pw_changed'));
  res.redirect('/admin/settings');
});

const SITE_IMAGES = ['banner', 'men', 'women', 'unisex'];
router.post('/settings/upload-image/:type', adminAuth, (req, res, next) => {
  if (!SITE_IMAGES.includes(req.params.type)) return res.status(400).send('Invalid type');
  next();
}, withUpload(uploadSettings.single('image'), req => back(req, '/admin/images')), (req, res) => {
  if (!req.file) { req.flash('error', tr(req)('fill_required')); return res.redirect(back(req, '/admin/images')); }
  const key = `${req.params.type}_image`;
  const old = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  removeManagedFile(old?.value);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, `/uploads/settings/${req.file.filename}`);
  req.flash('success', tr(req)('photo_updated'));
  res.redirect(back(req, '/admin/images'));
});

router.post('/settings/delete-image/:type', adminAuth, (req, res) => {
  if (!SITE_IMAGES.includes(req.params.type)) return res.status(400).send('Invalid type');
  const key = `${req.params.type}_image`;
  const old = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  removeManagedFile(old?.value);
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  req.flash('success', tr(req)('photo_removed'));
  res.redirect(back(req, '/admin/images'));
});

// ── Brands ──────────────────────────────────────────────────────────────────
router.get('/brands', adminAuth, (req, res) => {
  const brands = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM brand_categories bc WHERE bc.brand_id = b.id) AS line_count,
      (SELECT COUNT(*) FROM products p WHERE p.type = 'brand' AND p.brand = b.name) AS product_count
    FROM brands b ORDER BY b.name
  `).all();
  res.render('admin/brands', { title: tr(req)('brands'), brands });
});

router.post('/brands/new', adminAuth, (req, res) => {
  const a = tr(req);
  const name = String(req.body.name || '').trim();
  if (!name) { req.flash('error', a('fill_required')); return res.redirect('/admin/brands'); }
  const type = ['western', 'khaleeji'].includes(req.body.type) ? req.body.type : 'western';
  try {
    const info = db.prepare('INSERT INTO brands (name, name_ar, type) VALUES (?, ?, ?)').run(name, String(req.body.name_ar || '').trim() || null, type);
    // Every brand gets a first line so its page on the website works immediately.
    db.prepare("INSERT INTO brand_categories (brand_id, name_en, name_ar, sort_order) VALUES (?, ?, '', 0)").run(info.lastInsertRowid, name);
    req.flash('success', a('brand_created'));
    return res.redirect(`/admin/brands/${info.lastInsertRowid}/categories`);
  } catch (_) {
    req.flash('error', a('brand_exists'));
    res.redirect('/admin/brands');
  }
});

router.post('/brands/:id(\\d+)/logo', adminAuth, withUpload(uploadBrand.single('logo'), '/admin/brands'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!req.file) { req.flash('error', tr(req)('fill_required')); return res.redirect('/admin/brands'); }
  const old = db.prepare('SELECT logo_path FROM brands WHERE id = ?').get(id);
  removeManagedFile(old?.logo_path);
  db.prepare('UPDATE brands SET logo_path = ? WHERE id = ?').run(`/uploads/brands/${req.file.filename}`, id);
  req.flash('success', tr(req)('photo_updated'));
  res.redirect('/admin/brands');
});

router.post('/brands/:id(\\d+)/edit', adminAuth, (req, res) => {
  const a = tr(req);
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!brand) return res.redirect('/admin/brands');
  const name = String(req.body.name || '').trim() || brand.name;
  const type = ['western', 'khaleeji'].includes(req.body.type) ? req.body.type : brand.type;
  try {
    db.transaction(() => {
      db.prepare('UPDATE brands SET name = ?, name_ar = ?, type = ? WHERE id = ?').run(name, String(req.body.name_ar || '').trim() || null, type, brand.id);
      // Products reference their brand by name; keep them attached after a rename.
      if (name !== brand.name) db.prepare("UPDATE products SET brand = ? WHERE type = 'brand' AND brand = ?").run(name, brand.name);
    })();
    req.flash('success', a('brand_updated'));
  } catch (_) {
    req.flash('error', a('brand_exists'));
  }
  res.redirect('/admin/brands');
});

router.post('/brands/:id(\\d+)/delete', adminAuth, (req, res) => {
  const brand = db.prepare('SELECT logo_path FROM brands WHERE id = ?').get(req.params.id);
  removeManagedFile(brand?.logo_path);
  db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  req.flash('success', tr(req)('brand_deleted'));
  res.redirect('/admin/brands');
});

// ── Brand lines (brand_categories) ──────────────────────────────────────────
router.get('/brands/:brandId(\\d+)/categories', adminAuth, (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.brandId);
  if (!brand) return res.status(404).render('404', { title: '404' });
  const categories = db.prepare(`
    SELECT bc.*, COUNT(p.id) AS product_count
    FROM brand_categories bc LEFT JOIN products p ON p.brand_category_id = bc.id
    WHERE bc.brand_id = ? GROUP BY bc.id ORDER BY bc.sort_order, bc.name_en
  `).all(brand.id);
  res.render('admin/brand-categories', { title: brand.name, brand, categories });
});

router.post('/brands/:brandId(\\d+)/categories/new', adminAuth, (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.brandId);
  if (!brand) return res.status(404).render('404', { title: '404' });
  const name = String(req.body.name_en || '').trim();
  if (!name) { req.flash('error', tr(req)('fill_required')); return res.redirect(`/admin/brands/${brand.id}/categories`); }
  const info = db.prepare('INSERT INTO brand_categories (brand_id, name_en, name_ar, sort_order) VALUES (?, ?, ?, ?)')
    .run(brand.id, name, String(req.body.name_ar || '').trim() || null, parseInt(req.body.sort_order, 10) || 0);
  req.flash('success', tr(req)('line_saved'));
  res.redirect(`/admin/brands/${brand.id}/categories/${info.lastInsertRowid}/products`);
});

router.post('/brands/:brandId(\\d+)/categories/:catId(\\d+)/edit', adminAuth,
  withUpload(uploadBrandCat.single('image'), req => `/admin/brands/${req.params.brandId}/categories`), (req, res) => {
    const { brandId, catId } = req.params;
    const cat = db.prepare('SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?').get(catId, brandId);
    if (!cat) return res.status(404).render('404', { title: '404' });
    const cols = {
      name_en: String(req.body.name_en || '').trim() || cat.name_en,
      name_ar: String(req.body.name_ar || '').trim() || null,
      sort_order: parseInt(req.body.sort_order, 10) || 0,
    };
    if (req.file) { removeManagedFile(cat.image_path); cols.image_path = `/uploads/brands/${req.file.filename}`; }
    db.prepare(`UPDATE brand_categories SET ${Object.keys(cols).map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(cols), catId);
    req.flash('success', tr(req)('line_saved'));
    res.redirect(`/admin/brands/${brandId}/categories`);
  });

router.post('/brands/:brandId(\\d+)/categories/:catId(\\d+)/delete', adminAuth, (req, res) => {
  const { brandId, catId } = req.params;
  const cat = db.prepare('SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?').get(catId, brandId);
  removeManagedFile(cat?.image_path);
  db.prepare('UPDATE products SET brand_category_id = NULL WHERE brand_category_id = ?').run(catId);
  db.prepare('DELETE FROM brand_categories WHERE id = ? AND brand_id = ?').run(catId, brandId);
  req.flash('success', tr(req)('line_deleted'));
  res.redirect(`/admin/brands/${brandId}/categories`);
});

router.get('/brands/:brandId(\\d+)/categories/:catId(\\d+)/products', adminAuth, (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.brandId);
  const category = db.prepare('SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?').get(req.params.catId, req.params.brandId);
  if (!brand || !category) return res.status(404).render('404', { title: '404' });
  const assigned = db.prepare("SELECT * FROM products WHERE type='brand' AND brand_category_id = ? ORDER BY name_en").all(category.id);
  const unassigned = db.prepare("SELECT * FROM products WHERE type='brand' AND brand = ? AND brand_category_id IS NULL ORDER BY name_en").all(brand.name);
  res.render('admin/brand-category-products', { title: `${brand.name} · ${category.name_en}`, brand, category, assigned, unassigned });
});

router.post('/brands/:brandId(\\d+)/categories/:catId(\\d+)/products/new', adminAuth,
  withUpload(upload.single('image'), req => `/admin/brands/${req.params.brandId}/categories/${req.params.catId}/products`), (req, res) => {
    const { brandId, catId } = req.params;
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
    const line = db.prepare('SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?').get(catId, brandId);
    if (!brand || !line) return res.status(404).render('404', { title: '404' });
    const name = String(req.body.name_en || '').trim();
    if (!name) {
      if (req.file) fs.unlinkSync(req.file.path);
      req.flash('error', tr(req)('fill_required'));
      return res.redirect(`/admin/brands/${brandId}/categories/${catId}/products`);
    }
    const price = parseFloat(req.body.price);
    const info = db.prepare(`
      INSERT INTO products (name_en, name_ar, category, brand, type, price, image_path, brand_category_id, description_en, description_ar, in_stock)
      VALUES (?, ?, 'unisex', ?, 'brand', ?, ?, ?, ?, ?, 1)
    `).run(name, String(req.body.name_ar || '').trim() || null, brand.name,
      Number.isFinite(price) && price >= 0 ? price : null,
      req.file ? `/uploads/products/${req.file.filename}` : null, line.id,
      String(req.body.description_en || '').trim() || null, String(req.body.description_ar || '').trim() || null);
    req.flash('success', tr(req)('product_created'));
    res.redirect(`/admin/products/${info.lastInsertRowid}/edit`);
  });

router.post('/brands/:brandId(\\d+)/categories/:catId(\\d+)/products/add', adminAuth, (req, res) => {
  const { brandId, catId } = req.params;
  const line = db.prepare('SELECT id FROM brand_categories WHERE id = ? AND brand_id = ?').get(catId, brandId);
  const brand = db.prepare('SELECT name FROM brands WHERE id = ?').get(brandId);
  if (!line || !brand) return res.status(404).render('404', { title: '404' });
  const ids = [].concat(req.body.product_ids || []).map(id => parseInt(id, 10)).filter(Number.isFinite);
  const update = db.prepare("UPDATE products SET brand_category_id = ? WHERE id = ? AND type='brand' AND brand = ?");
  db.transaction(() => ids.forEach(id => update.run(catId, id, brand.name)))();
  req.flash('success', tr(req)('products_added'));
  res.redirect(`/admin/brands/${brandId}/categories/${catId}/products`);
});

router.post('/brands/:brandId(\\d+)/categories/:catId(\\d+)/products/remove', adminAuth, (req, res) => {
  const { brandId, catId } = req.params;
  db.prepare('UPDATE products SET brand_category_id = NULL WHERE id = ? AND brand_category_id = ?').run(parseInt(req.body.product_id, 10), catId);
  req.flash('success', tr(req)('product_removed_line'));
  res.redirect(`/admin/brands/${brandId}/categories/${catId}/products`);
});

module.exports = router;
