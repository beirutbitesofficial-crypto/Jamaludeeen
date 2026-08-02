const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { getSettingsMap, applyLocalRulesToProduct } = require('../helpers/localProductRules');

// GET /cart
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  const settings = getSettingsMap(db);
  const items = cart.map(item => {
    const rawProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.productId);
    const product = applyLocalRulesToProduct(rawProduct, settings);
    return product ? { ...product, qty: item.qty } : null;
  }).filter(Boolean);

  const deliveryFee = parseFloat(
    db.prepare(`SELECT value FROM settings WHERE key = 'delivery_fee'`).get()?.value || 0
  );

  const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);

  res.render('cart', { title: 'Cart', items, subtotal, deliveryFee, total });
});

// POST /cart/add
router.post('/add', (req, res) => {
  const productId = parseInt(req.body.productId);
  const qty = Math.max(1, parseInt(req.body.qty) || 1);
  const settings = getSettingsMap(db);

  const rawProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
  const product = applyLocalRulesToProduct(rawProduct, settings);
  if (!product || !product.in_stock) {
    req.flash('error', 'Product not available.');
    return res.redirect('back');
  }
  if (!product.price) {
    req.flash('error', req.session.lang === 'ar' ? 'لم يُحدَّد سعر هذا المنتج بعد.' : 'Price not set yet for this product.');
    return res.redirect('back');
  }

  if (!req.session.cart) req.session.cart = [];
  const existing = req.session.cart.find(i => i.productId === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    req.session.cart.push({ productId, qty });
  }

  req.flash('success', req.session.lang === 'ar' ? 'تمت الإضافة للسلة!' : 'Added to cart!');
  res.redirect('back');
});

// POST /cart/update
router.post('/update', (req, res) => {
  const productId = parseInt(req.body.productId);
  const qty = parseInt(req.body.qty);
  if (!req.session.cart) return res.redirect('/cart');

  if (qty <= 0) {
    req.session.cart = req.session.cart.filter(i => i.productId !== productId);
  } else {
    const item = req.session.cart.find(i => i.productId === productId);
    if (item) item.qty = qty;
  }
  res.redirect('/cart');
});

// POST /cart/remove
router.post('/remove', (req, res) => {
  const productId = parseInt(req.body.productId);
  req.session.cart = (req.session.cart || []).filter(i => i.productId !== productId);
  res.redirect('/cart');
});

// POST /cart/clear
router.post('/clear', (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
});

module.exports = router;
