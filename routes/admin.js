const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../database/db');
const adminAuth = require('../middleware/adminAuth');

// ── Multer setup ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${req.params.id}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only jpg/png/webp images are allowed.'));
  }
});

// Brand logo uploader
const brandUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'brands');
if (!fs.existsSync(brandUploadsDir)) fs.mkdirSync(brandUploadsDir, { recursive: true });

const brandStorage = multer.diskStorage({
  destination: brandUploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `brand-${req.params.id}-${Date.now()}${ext}`);
  }
});
const uploadBrand = multer({ storage: brandStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// Settings images uploader (banner, category images)
const settingsUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'settings');
if (!fs.existsSync(settingsUploadsDir)) fs.mkdirSync(settingsUploadsDir, { recursive: true });

const uploadSettings = multer({
  storage: multer.diskStorage({
    destination: settingsUploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.params.type}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'];
    ok.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Only jpg/png/webp'));
  }
});

// Helpers
function getSettings() {
  return Object.fromEntries(
    db.prepare(`SELECT key, value FROM settings`).all().map(r => [r.key, r.value])
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { title: 'Admin Login', layout: false });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    req.session.isAdmin = true;
    req.session.adminUsername = admin.username;
    return res.redirect('/admin/dashboard');
  }
  req.flash('error', 'Invalid username or password.');
  res.redirect('/admin/login');
});

router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  req.session.adminUsername = null;
  res.redirect('/admin/login');
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/', adminAuth, (req, res) => res.redirect('/admin/dashboard'));

router.get('/dashboard', adminAuth, (req, res) => {
  const stats = {
    products: db.prepare(`SELECT COUNT(*) as c FROM products`).get().c,
    orders:   db.prepare(`SELECT COUNT(*) as c FROM orders`).get().c,
    pending:  db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pending'`).get().c,
    revenue:  db.prepare(`SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelled'`).get().s,
  };
  const recentOrders = db.prepare(`
    SELECT * FROM orders ORDER BY created_at DESC LIMIT 10
  `).all();
  res.render('admin/dashboard', { title: 'Dashboard', stats, recentOrders });
});

// Four-section catalog overview
router.get('/catalog', adminAuth, (req, res) => {
  const settings = getSettings();
  const categories = ['men', 'women', 'unisex'].map(category => ({
    key: category,
    count: db.prepare(`SELECT COUNT(*) AS c FROM products WHERE type='local' AND category=?`).get(category).c,
    price: settings[`local_price_${category}`] || '',
    image: settings[`${category}_image`] || null,
  }));
  const brandStats = {
    count: db.prepare(`SELECT COUNT(*) AS c FROM products WHERE type='brand'`).get().c,
    brands: db.prepare(`SELECT COUNT(*) AS c FROM brands`).get().c,
  };
  res.render('admin/catalog', { title: 'Catalog Categories', categories, brandStats });
});

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/products', adminAuth, (req, res) => {
  const { q, category, brand, type, page = 1 } = req.query;
  const PAGE = 30;
  const offset = (parseInt(page) - 1) * PAGE;

  let where = ['1=1'];
  const params = [];
  if (q) { where.push('(name_en LIKE ? OR brand LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (category) { where.push('category = ?'); params.push(category); }
  if (brand) { where.push('brand = ?'); params.push(brand); }
  if (type === 'local' || type === 'brand') { where.push('type = ?'); params.push(type); }

  const ws = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM products WHERE ${ws}`).get(...params).c;
  const products = db.prepare(`SELECT * FROM products WHERE ${ws} ORDER BY name_en LIMIT ? OFFSET ?`)
                    .all(...params, PAGE, offset);

  const brandsList = db.prepare(`SELECT DISTINCT brand FROM products ORDER BY brand`).all().map(r => r.brand);
  const totalPages = Math.ceil(total / PAGE);

  res.render('admin/products', {
    title: 'Products',
    products, brandsList,
    filters: { q, category, brand, type },
    pagination: { page: parseInt(page), totalPages, total }
  });
});

// GET edit page
router.get('/products/:id(\\d+)/edit', adminAuth, (req, res) => {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
  if (!product) return res.status(404).send('Not found');
  res.render('admin/product-edit', { title: 'Edit Product', product });
});

// POST save product
router.post('/products/:id(\\d+)', adminAuth, upload.single('image'), (req, res) => {
  const { price, name_ar, description_en, description_ar, in_stock, featured } = req.body;
  const id = req.params.id;

  const updates = {
    price: price !== '' && !isNaN(parseFloat(price)) ? parseFloat(price) : null,
    name_ar: name_ar?.trim() || null,
    description_en: description_en?.trim() || null,
    description_ar: description_ar?.trim() || null,
    in_stock: in_stock === '1' ? 1 : 0,
    featured: featured === '1' ? 1 : 0,
    updated_at: new Date().toISOString(),
  };

  if (req.file) {
    // Remove old image if exists
    const old = db.prepare(`SELECT image_path FROM products WHERE id = ?`).get(id);
    if (old?.image_path) {
      const oldPath = path.join(__dirname, '..', 'public', old.image_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    updates.image_path = `/uploads/products/${req.file.filename}`;
  }

  const setCols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(updates), id];

  db.prepare(`UPDATE products SET ${setCols} WHERE id = ?`).run(...vals);
  const saved = db.prepare(`SELECT type, category, price, image_path FROM products WHERE id = ?`).get(id);
  if (saved?.type === 'local') {
    const sync = db.transaction(() => {
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(`local_price_${saved.category}`, saved.price === null ? '' : String(saved.price));
      if (saved.image_path) db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(`${saved.category}_image`, saved.image_path);
      db.prepare(`UPDATE products SET price = ?, image_path = COALESCE(?, image_path), updated_at = ? WHERE type='local' AND category = ?`)
        .run(saved.price, saved.image_path, new Date().toISOString(), saved.category);
    });
    sync();
  }
  req.flash('success', 'Product updated successfully.');
  res.redirect(`/admin/products/${id}/edit`);
});

// POST update product image only
router.post('/products/:id(\\d+)/image', adminAuth, upload.single('image'), (req, res) => {
  const id = parseInt(req.params.id);
  if (!req.file) {
    req.flash('error', 'Please choose an image first.');
    return res.redirect('back');
  }

  const old = db.prepare(`SELECT image_path FROM products WHERE id = ?`).get(id);
  if (old?.image_path) {
    const oldPath = path.join(__dirname, '..', 'public', old.image_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.prepare(`UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?`)
    .run(`/uploads/products/${req.file.filename}`, new Date().toISOString(), id);
  const saved = db.prepare(`SELECT type, category, image_path FROM products WHERE id = ?`).get(id);
  if (saved?.type === 'local') {
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(`${saved.category}_image`, saved.image_path);
    db.prepare(`UPDATE products SET image_path = ?, updated_at = ? WHERE type='local' AND category = ?`)
      .run(saved.image_path, new Date().toISOString(), saved.category);
  }

  req.flash('success', 'Image updated successfully.');
  res.redirect('back');
});

// POST delete product image
router.post('/products/:id(\\d+)/delete-image', adminAuth, (req, res) => {
  const product = db.prepare(`SELECT image_path, type, category FROM products WHERE id = ?`).get(req.params.id);
  if (product?.image_path) {
    const imgPath = path.join(__dirname, '..', 'public', product.image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    db.prepare(`UPDATE products SET image_path = NULL WHERE id = ?`).run(req.params.id);
  }
  if (product?.type === 'local') {
    db.prepare(`DELETE FROM settings WHERE key = ?`).run(`${product.category}_image`);
    db.prepare(`UPDATE products SET image_path = NULL WHERE type='local' AND category = ?`).run(product.category);
  }
  req.flash('success', 'Image removed.');
  res.redirect(`/admin/products/${req.params.id}/edit`);
});

// POST add new product
router.post('/products/new', adminAuth, (req, res) => {
  const { name_en, category, brand, type } = req.body;
  if (!name_en || !category || !brand) {
    req.flash('error', 'Name, category, and brand are required.');
    return res.redirect('/admin/products');
  }
  const validType = type === 'brand' ? 'brand' : 'local';
  const info = db.prepare(`INSERT INTO products (name_en, category, brand, type) VALUES (?, ?, ?, ?)`)
                  .run(name_en.trim(), category, brand.trim(), validType);
  res.redirect(`/admin/products/${info.lastInsertRowid}/edit`);
});

// POST apply local category defaults from one product (price + image)
router.post('/products/:id(\\d+)/apply-local-default', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const product = db.prepare(`SELECT id, category, type, price, image_path FROM products WHERE id = ?`).get(id);

  if (!product) {
    req.flash('error', 'Product not found.');
    return res.redirect('/admin/products');
  }
  if (product.type !== 'local' || !['men', 'women', 'unisex'].includes(product.category)) {
    req.flash('error', 'This action is only available for local Men/Women/Unisex products.');
    return res.redirect('/admin/products');
  }
  if (product.price === null || !product.image_path) {
    req.flash('error', 'Selected product must have both a price and an image.');
    return res.redirect('/admin/products');
  }

  const upsertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  const updateCategory = db.prepare(`
    UPDATE products
    SET price = ?, image_path = ?, updated_at = ?
    WHERE type = 'local' AND category = ?
  `);

  const run = db.transaction(() => {
    upsertSetting.run(`local_price_${product.category}`, String(product.price));
    upsertSetting.run(`${product.category}_image`, product.image_path);
    updateCategory.run(product.price, product.image_path, new Date().toISOString(), product.category);
  });

  run();
  req.flash('success', `Applied ${product.category} shared price and image to all local ${product.category} products.`);
  res.redirect('/admin/products');
});

// ── Orders ────────────────────────────────────────────────────────────────────
router.get('/orders', adminAuth, (req, res) => {
  const { status, page = 1 } = req.query;
  const PAGE = 20;
  const offset = (parseInt(page) - 1) * PAGE;

  let where = '1=1';
  const params = [];
  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE ${where}`).get(...params).c;
  const orders = db.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
                   .all(...params, PAGE, offset);

  res.render('admin/orders', {
    title: 'Orders',
    orders,
    filters: { status },
    pagination: { page: parseInt(page), totalPages: Math.ceil(total / PAGE), total }
  });
});

router.get('/orders/:id', adminAuth, (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).send('Not found');
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(order.id);
  res.render('admin/order-detail', { title: `Order ${order.order_number}`, order, items });
});

router.post('/orders/:id/status', adminAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['pending','confirmed','shipped','delivered','cancelled'];
  if (!valid.includes(status)) return res.redirect(`/admin/orders/${req.params.id}`);
  db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, req.params.id);
  req.flash('success', 'Order status updated.');
  res.redirect(`/admin/orders/${req.params.id}`);
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings', adminAuth, (req, res) => {
  const settings = getSettings();
  res.render('admin/settings', { title: 'Settings', settings });
});

router.post('/settings', adminAuth, (req, res) => {
  const allowed = ['whish_number','store_phone','store_whatsapp','store_address',
                   'delivery_fee','hero_title_en','hero_title_ar','hero_sub_en','hero_sub_ar',
                   'usd_rate'];
  const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  const save = db.transaction(() => {
    for (const key of allowed) {
      if (req.body[key] !== undefined) upsert.run(key, req.body[key].trim());
    }
  });
  save();
  req.flash('success', 'Settings saved.');
  res.redirect('/admin/settings');
});

// ── Admin password change ─────────────────────────────────────────────────────
router.post('/change-password', adminAuth, (req, res) => {
  const { current, newPass, confirm } = req.body;
  const admin = db.prepare(`SELECT * FROM admins WHERE username = ?`).get(req.session.adminUsername);
  if (!admin || !bcrypt.compareSync(current, admin.password)) {
    req.flash('error', 'Current password is incorrect.');
    return res.redirect('/admin/settings');
  }
  if (newPass !== confirm) {
    req.flash('error', 'New passwords do not match.');
    return res.redirect('/admin/settings');
  }
  if (newPass.length < 6) {
    req.flash('error', 'Password must be at least 6 characters.');
    return res.redirect('/admin/settings');
  }
  const hash = bcrypt.hashSync(newPass, 10);
  db.prepare(`UPDATE admins SET password = ? WHERE id = ?`).run(hash, admin.id);
  req.flash('success', 'Password changed successfully.');
  res.redirect('/admin/settings');
});

// ── Settings — Image Uploads ───────────────────────────────────────────────────
const VALID_IMG_TYPES = ['banner', 'men', 'women', 'unisex'];

router.post('/settings/upload-image/:type', adminAuth, (req, res, next) => {
  if (!VALID_IMG_TYPES.includes(req.params.type)) return res.status(400).send('Invalid type');
  uploadSettings.single('image')(req, res, next);
}, (req, res) => {
  if (!req.file) { req.flash('error', 'No file received.'); return res.redirect('/admin/settings'); }
  const key = `${req.params.type}_image`;
  const old = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  if (old?.value) {
    const p = path.join(__dirname, '..', 'public', old.value);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, `/uploads/settings/${req.file.filename}`);
  req.flash('success', `${req.params.type} image updated.`);
  res.redirect('/admin/settings');
});

router.post('/settings/delete-image/:type', adminAuth, (req, res) => {
  if (!VALID_IMG_TYPES.includes(req.params.type)) return res.status(400).send('Invalid type');
  const key = `${req.params.type}_image`;
  const old = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  if (old?.value) {
    const p = path.join(__dirname, '..', 'public', old.value);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    db.prepare(`UPDATE settings SET value = NULL WHERE key = ?`).run(key);
  }
  req.flash('success', 'Image removed.');
  res.redirect('/admin/settings');
});

// ── Bulk Price Editor ─────────────────────────────────────────────────────────
router.get('/prices', adminAuth, (req, res) => {
  const { category = '', brand = '', q = '' } = req.query;
  let where = ['1=1'];
  const params = [];
  where.push("type = 'brand'");
  if (category) { where.push('category = ?'); params.push(category); }
  if (brand)    { where.push('brand = ?');    params.push(brand); }
  if (q)        { where.push('(name_en LIKE ? OR brand LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const products = db.prepare(
    `SELECT id, name_en, brand, category, type, price FROM products WHERE ${where.join(' AND ')} ORDER BY brand, name_en LIMIT 300`
  ).all(...params);
  const brandsList = db.prepare(`SELECT DISTINCT brand FROM products WHERE type='brand' ORDER BY brand`).all().map(r => r.brand);
  const localPriceSettings = getSettings();
  const localPrices = {
    men: localPriceSettings.local_price_men || '',
    women: localPriceSettings.local_price_women || '',
    unisex: localPriceSettings.local_price_unisex || '',
  };

  res.render('admin/prices', { title: 'Bulk Prices', products, brandsList, localPrices, filters: { category, brand, q } });
});

router.post('/prices/local', adminAuth, (req, res) => {
  const parsePrice = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return null;
    const n = parseFloat(v);
    return !isNaN(n) && n >= 0 ? n : null;
  };

  const values = {
    men: parsePrice(req.body.men),
    women: parsePrice(req.body.women),
    unisex: parsePrice(req.body.unisex),
  };

  const upsertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  const updateLocalCategory = db.prepare(`UPDATE products SET price = ?, updated_at = ? WHERE type = 'local' AND category = ?`);

  const save = db.transaction(() => {
    for (const category of ['men', 'women', 'unisex']) {
      const price = values[category];
      upsertSetting.run(`local_price_${category}`, price === null ? '' : String(price));
      updateLocalCategory.run(price, new Date().toISOString(), category);
    }
  });

  save();
  req.flash('success', 'Standard prices updated for Men, Women, and Unisex sections.');
  res.redirect('/admin/prices');
});

router.post('/prices/bulk', adminAuth, (req, res) => {
  const prices = req.body.prices || {};
  const qs = req.body._qs || '';
  const update = db.prepare(`UPDATE products SET price = ?, updated_at = ? WHERE id = ? AND type = 'brand'`);
  const now = new Date().toISOString();
  let updatedCount = 0;
  const run = db.transaction(() => {
    for (const [id, price] of Object.entries(prices)) {
      const p = price === '' ? null : parseFloat(price);
      const info = update.run(!isNaN(p) && p >= 0 ? p : null, now, parseInt(id));
      updatedCount += info.changes;
    }
  });
  run();
  req.flash('success', `Updated ${updatedCount} brand product prices.`);
  res.redirect('/admin/prices' + (qs ? '?' + qs : ''));
});

// ── Order Stats API (for live notifications) ──────────────────────────────────
router.get('/api/orders/stats', adminAuth, (req, res) => {
  const pending = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pending'`).get().c;
  const latest  = db.prepare(`SELECT id, order_number, customer_name, total FROM orders ORDER BY id DESC LIMIT 1`).get();
  res.json({ pending, latest: latest || null });
});

// ── Product Images (quick-upload, mobile-friendly) ────────────────────────────
router.get('/images', adminAuth, (req, res) => {
  const { brand } = req.query;
  const params = brand ? [brand] : [];
  const where = brand ? `WHERE type='brand' AND brand = ?` : `WHERE type='brand'`;
  const products = db.prepare(`SELECT id, name_en, brand, image_path FROM products ${where} ORDER BY brand, name_en`).all(...params);
  const brandsList = db.prepare(`SELECT DISTINCT brand FROM products WHERE type='brand' ORDER BY brand`).all().map(r => r.brand);
  const settings = getSettings();
  res.render('admin/images', { title: 'Product Images', products, brandsList, settings, filters: { brand: brand || '' } });
});

// ── Brands ────────────────────────────────────────────────────────────────────
router.get('/brands', adminAuth, (req, res) => {
  const brands = db.prepare(`
    SELECT b.*, COUNT(bc.id) as cat_count
    FROM brands b
    LEFT JOIN brand_categories bc ON bc.brand_id = b.id
    GROUP BY b.id ORDER BY b.name ASC
  `).all();
  res.render('admin/brands', { title: 'Brands', brands });
});

router.post('/brands/new', adminAuth, (req, res) => {
  const { name, name_ar, type } = req.body;
  if (!name?.trim()) { req.flash('error', 'Brand name required.'); return res.redirect('/admin/brands'); }
  const validType = ['western','khaleeji'].includes(type) ? type : 'western';
  try {
    db.prepare(`INSERT INTO brands (name, name_ar, type) VALUES (?, ?, ?)`).run(name.trim(), name_ar?.trim() || null, validType);
    req.flash('success', 'Brand added.');
  } catch (e) {
    req.flash('error', 'Brand name already exists.');
  }
  res.redirect('/admin/brands');
});

router.post('/brands/:id/logo', adminAuth, uploadBrand.single('logo'), (req, res) => {
  const id = parseInt(req.params.id);
  if (!req.file) { req.flash('error', 'Please choose a logo.'); return res.redirect('/admin/brands'); }
  const old = db.prepare(`SELECT logo_path FROM brands WHERE id = ?`).get(id);
  if (old?.logo_path) { const p = path.join(__dirname,'..','public',old.logo_path); if (fs.existsSync(p)) fs.unlinkSync(p); }
  db.prepare(`UPDATE brands SET logo_path = ? WHERE id = ?`).run(`/uploads/brands/${req.file.filename}`, id);
  req.flash('success', 'Logo updated.');
  res.redirect('/admin/brands');
});

router.post('/brands/:id/edit', adminAuth, (req, res) => {
  const { name, name_ar, type } = req.body;
  const validType = ['western','khaleeji'].includes(type) ? type : 'western';
  db.prepare(`UPDATE brands SET name = ?, name_ar = ?, type = ? WHERE id = ?`).run(name?.trim() || '', name_ar?.trim() || null, validType, req.params.id);
  req.flash('success', 'Brand updated.');
  res.redirect('/admin/brands');
});

router.post('/brands/:id/delete', adminAuth, (req, res) => {
  const brand = db.prepare(`SELECT logo_path FROM brands WHERE id = ?`).get(req.params.id);
  if (brand?.logo_path) { const p = path.join(__dirname,'..','public',brand.logo_path); if (fs.existsSync(p)) fs.unlinkSync(p); }
  db.prepare(`DELETE FROM brands WHERE id = ?`).run(req.params.id);
  req.flash('success', 'Brand deleted.');
  res.redirect('/admin/brands');
});

// ── Brand Categories ──────────────────────────────────────────────────────────

// Multer for brand-category images
const brandCatUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'brands');
const uploadBrandCat = multer({
  storage: multer.diskStorage({
    destination: brandCatUploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `cat-${req.params.brandId}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg','.jpeg','.png','.webp'];
    ok.includes(path.extname(file.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('Images only'));
  }
});

// GET /admin/brands/:brandId/categories
router.get('/brands/:brandId/categories', adminAuth, (req, res) => {
  const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.brandId);
  if (!brand) return res.status(404).send('Brand not found');
  const categories = db.prepare(`
    SELECT bc.*, COUNT(p.id) as product_count
    FROM brand_categories bc
    LEFT JOIN products p ON p.brand_category_id = bc.id
    WHERE bc.brand_id = ?
    GROUP BY bc.id
    ORDER BY bc.sort_order ASC, bc.name_en ASC
  `).all(brand.id);
  res.render('admin/brand-categories', { title: `${brand.name} — Categories`, brand, categories });
});

// POST /admin/brands/:brandId/categories/new
router.post('/brands/:brandId/categories/new', adminAuth, (req, res) => {
  const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.brandId);
  if (!brand) return res.status(404).send('Brand not found');
  const { name_en, name_ar, sort_order } = req.body;
  if (!name_en?.trim()) {
    req.flash('error', 'Category name is required.');
    return res.redirect(`/admin/brands/${brand.id}/categories`);
  }
  db.prepare(`INSERT INTO brand_categories (brand_id, name_en, name_ar, sort_order) VALUES (?, ?, ?, ?)`)
    .run(brand.id, name_en.trim(), name_ar?.trim() || null, parseInt(sort_order) || 0);
  req.flash('success', 'Category created.');
  res.redirect(`/admin/brands/${brand.id}/categories`);
});

// POST /admin/brands/:brandId/categories/:catId/edit
router.post('/brands/:brandId/categories/:catId/edit', adminAuth, uploadBrandCat.single('image'), (req, res) => {
  const { brandId, catId } = req.params;
  const cat = db.prepare(`SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?`).get(catId, brandId);
  if (!cat) return res.status(404).send('Not found');

  const { name_en, name_ar, sort_order } = req.body;
  const updates = {
    name_en: name_en?.trim() || cat.name_en,
    name_ar: name_ar?.trim() || null,
    sort_order: parseInt(sort_order) || 0,
  };

  if (req.file) {
    if (cat.image_path) {
      const old = path.join(__dirname, '..', 'public', cat.image_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    updates.image_path = `/uploads/brands/${req.file.filename}`;
  }

  const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE brand_categories SET ${cols} WHERE id = ?`).run(...Object.values(updates), catId);
  req.flash('success', 'Category updated.');
  res.redirect(`/admin/brands/${brandId}/categories`);
});

// POST /admin/brands/:brandId/categories/:catId/delete
router.post('/brands/:brandId/categories/:catId/delete', adminAuth, (req, res) => {
  const { brandId, catId } = req.params;
  const cat = db.prepare(`SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?`).get(catId, brandId);
  if (cat?.image_path) {
    const p = path.join(__dirname, '..', 'public', cat.image_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  // Unlink products from this category
  db.prepare(`UPDATE products SET brand_category_id = NULL WHERE brand_category_id = ?`).run(catId);
  db.prepare(`DELETE FROM brand_categories WHERE id = ? AND brand_id = ?`).run(catId, brandId);
  req.flash('success', 'Category deleted.');
  res.redirect(`/admin/brands/${brandId}/categories`);
});

// ── Product Category Assignment ───────────────────────────────────────────────
// GET /admin/brands/:brandId/categories/:catId/products — manage products in a category
router.get('/brands/:brandId/categories/:catId/products', adminAuth, (req, res) => {
  const brand    = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.brandId);
  const category = db.prepare(`SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?`).get(req.params.catId, req.params.brandId);
  if (!brand || !category) return res.status(404).send('Not found');

  // Products already in this category
  const assigned = db.prepare(`SELECT * FROM products WHERE type='brand' AND brand_category_id = ? ORDER BY name_en`).all(category.id);
  // Products not yet in any category (brand_category_id IS NULL) — available to add
  const unassigned = db.prepare(`SELECT * FROM products WHERE type='brand' AND brand = ? AND brand_category_id IS NULL ORDER BY name_en`).all(brand.name);

  res.render('admin/brand-category-products', { title: `${brand.name} / ${category.name_en} — Products`, brand, category, assigned, unassigned });
});

// POST /admin/brands/:brandId/categories/:catId/products/add
// Create a brand product directly inside a brand category.
router.post('/brands/:brandId/categories/:catId/products/new', adminAuth, upload.single('image'), (req, res) => {
  const { brandId, catId } = req.params;
  const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(brandId);
  const categoryRow = db.prepare(`SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?`).get(catId, brandId);
  if (!brand || !categoryRow) return res.status(404).send('Brand category not found');

  const name = req.body.name_en?.trim();
  const gender = ['men', 'women', 'unisex'].includes(req.body.category) ? req.body.category : 'unisex';
  const price = req.body.price !== '' && !Number.isNaN(Number(req.body.price)) ? Number(req.body.price) : null;
  if (!name) {
    if (req.file) fs.unlinkSync(req.file.path);
    req.flash('error', 'Product name is required.');
    return res.redirect(`/admin/brands/${brandId}/categories/${catId}/products`);
  }

  const imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;
  const info = db.prepare(`
    INSERT INTO products
      (name_en, name_ar, category, brand, type, price, image_path, brand_category_id, in_stock)
    VALUES (?, ?, ?, ?, 'brand', ?, ?, ?, ?)
  `).run(name, req.body.name_ar?.trim() || null, gender, brand.name, price, imagePath, categoryRow.id, req.body.in_stock === '0' ? 0 : 1);

  req.flash('success', `${name} was added to ${categoryRow.name_en}.`);
  res.redirect(`/admin/products/${info.lastInsertRowid}/edit`);
});

router.post('/brands/:brandId/categories/:catId/products/add', adminAuth, (req, res) => {
  const { brandId, catId } = req.params;
  const category = db.prepare(`SELECT id FROM brand_categories WHERE id = ? AND brand_id = ?`).get(catId, brandId);
  if (!category) return res.status(404).send('Not found');

  const ids = [].concat(req.body.product_ids || []).map(id => parseInt(id)).filter(n => !isNaN(n));
  const brand = db.prepare(`SELECT name FROM brands WHERE id = ?`).get(brandId);
  const update = db.prepare(`UPDATE products SET brand_category_id = ? WHERE id = ? AND type='brand' AND brand = ?`);
  const run = db.transaction(() => ids.forEach(id => update.run(catId, id, brand.name)));
  run();
  req.flash('success', `${ids.length} product(s) added to category.`);
  res.redirect(`/admin/brands/${brandId}/categories/${catId}/products`);
});

// POST /admin/brands/:brandId/categories/:catId/products/remove
router.post('/brands/:brandId/categories/:catId/products/remove', adminAuth, (req, res) => {
  const { brandId, catId } = req.params;
  const productId = parseInt(req.body.product_id);
  db.prepare(`UPDATE products SET brand_category_id = NULL WHERE id = ? AND brand_category_id = ?`).run(productId, catId);
  req.flash('success', 'Product removed from category.');
  res.redirect(`/admin/brands/${brandId}/categories/${catId}/products`);
});

module.exports = router;
