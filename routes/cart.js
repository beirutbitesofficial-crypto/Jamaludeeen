const express = require('express');
const router = express.Router();
const db = require('../database/store-system');
const { getSettingsMap, applyLocalRulesToProduct } = require('../helpers/localProductRules');
const { normalizeSize, salePrice, stockDeduction } = require('../helpers/inventory');

function back(req, fallback = '/cart') {
  return req.get('Referrer') || fallback;
}

function resolveCartProduct(item, settings) {
  const rawProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
  const product = applyLocalRulesToProduct(rawProduct, settings);
  if (!product) return null;
  const sizeMl = product.type === 'local' ? normalizeSize(product, item.size_ml) : null;
  return {
    ...product,
    qty: Math.max(1, parseInt(item.qty, 10) || 1),
    size_ml: sizeMl,
    price: salePrice(product, sizeMl),
  };
}

// GET /cart
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  const settings = getSettingsMap(db);
  const items = [];
  for (const item of cart) {
    try {
      const product = resolveCartProduct(item, settings);
      if (product) items.push(product);
    } catch (_) {
      // Invalid legacy size entries are ignored instead of breaking the whole cart.
    }
  }

  const deliveryFee = parseFloat(
    db.prepare("SELECT value FROM settings WHERE key = 'delivery_fee'").get()?.value || 0
  );
  const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);

  res.render('cart', { title: 'Cart', items, subtotal, deliveryFee, total });
});

// POST /cart/add
router.post('/add', (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const settings = getSettingsMap(db);

  const rawProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  const product = applyLocalRulesToProduct(rawProduct, settings);
  if (!product || !product.in_stock) {
    req.flash('error', 'Product not available.');
    return res.redirect(back(req));
  }

  let sizeMl = null;
  try {
    sizeMl = product.type === 'local' ? normalizeSize(product, req.body.size_ml) : null;
  } catch (error) {
    req.flash('error', req.session.lang === 'ar' ? 'اختار 50ml أو 100ml.' : error.message);
    return res.redirect(back(req));
  }

  const price = salePrice(product, sizeMl);
  if (!price) {
    req.flash('error', req.session.lang === 'ar' ? 'لم يُحدَّد سعر هذا المنتج بعد.' : 'Price not set yet for this product.');
    return res.redirect(back(req));
  }

  if (!req.session.cart) req.session.cart = [];
  const matches = item => item.productId === productId && Number(item.size_ml || 0) === Number(sizeMl || 0);
  const existing = req.session.cart.find(matches);
  const nextQty = (existing?.qty || 0) + qty;

  try {
    const needed = stockDeduction(product, nextQty, sizeMl);
    if (product.track_stock && needed > Number(product.stock_qty || 0)) {
      req.flash('error', req.session.lang === 'ar' ? 'الكمية المطلوبة غير متوفرة.' : 'Not enough stock for this selection.');
      return res.redirect(back(req));
    }
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect(back(req));
  }

  if (existing) existing.qty = nextQty;
  else req.session.cart.push({ productId, qty, size_ml: sizeMl });

  req.flash('success', req.session.lang === 'ar' ? 'تمت الإضافة للسلة!' : 'Added to cart!');
  res.redirect(back(req));
});

// POST /cart/update
router.post('/update', (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const qty = parseInt(req.body.qty, 10);
  const sizeMl = req.body.size_ml ? parseInt(req.body.size_ml, 10) : null;
  if (!req.session.cart) return res.redirect('/cart');

  const matches = item => item.productId === productId && Number(item.size_ml || 0) === Number(sizeMl || 0);
  if (qty <= 0) {
    req.session.cart = req.session.cart.filter(item => !matches(item));
    return res.redirect('/cart');
  }

  const item = req.session.cart.find(matches);
  if (!item) return res.redirect('/cart');

  const settings = getSettingsMap(db);
  const rawProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  const product = applyLocalRulesToProduct(rawProduct, settings);
  if (!product) return res.redirect('/cart');

  try {
    const normalizedSize = product.type === 'local' ? normalizeSize(product, sizeMl) : null;
    const needed = stockDeduction(product, qty, normalizedSize);
    if (product.track_stock && needed > Number(product.stock_qty || 0)) {
      req.flash('error', req.session.lang === 'ar' ? 'الكمية المطلوبة غير متوفرة.' : 'Not enough stock.');
      return res.redirect('/cart');
    }
    item.qty = qty;
  } catch (error) {
    req.flash('error', error.message);
  }
  res.redirect('/cart');
});

// POST /cart/remove
router.post('/remove', (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const sizeMl = req.body.size_ml ? parseInt(req.body.size_ml, 10) : null;
  req.session.cart = (req.session.cart || []).filter(
    item => !(item.productId === productId && Number(item.size_ml || 0) === Number(sizeMl || 0))
  );
  res.redirect('/cart');
});

// POST /cart/clear
router.post('/clear', (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
});

module.exports = router;
