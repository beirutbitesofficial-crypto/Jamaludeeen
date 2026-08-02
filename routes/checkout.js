const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { applyLocalRulesToProduct } = require('../helpers/localProductRules');

function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function generateOrderNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `JM-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// GET /checkout
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');

  const settings = getSettings();

  const items = cart.map(item => {
    const rawProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.productId);
    const product = applyLocalRulesToProduct(rawProduct, settings);
    return product ? { ...product, qty: item.qty } : null;
  }).filter(Boolean);

  const deliveryFee = parseFloat(settings.delivery_fee || 0);
  const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const total = subtotal + deliveryFee;

  res.render('checkout', { title: 'Checkout', items, subtotal, deliveryFee, total, settings });
});

// POST /checkout
router.post('/', (req, res) => {
  const { name, phone, address, city, payment_method, notes } = req.body;
  const lang = req.session.lang || 'en';

  if (!name || !phone || !address || !city || !payment_method) {
    req.flash('error', lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields.');
    return res.redirect('/checkout');
  }

  const cart = req.session.cart || [];
  if (!cart.length) {
    req.flash('error', lang === 'ar' ? 'سلتك فارغة.' : 'Your cart is empty.');
    return res.redirect('/cart');
  }

  const settings = getSettings();

  const items = cart.map(item => {
    const rawProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.productId);
    const product = applyLocalRulesToProduct(rawProduct, settings);
    return product ? { ...product, qty: item.qty } : null;
  }).filter(Boolean);

  const deliveryFee = parseFloat(settings.delivery_fee || 0);
  const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const total = subtotal + deliveryFee;
  const orderNumber = generateOrderNumber();

  // Insert order
  const insertOrder = db.prepare(`
    INSERT INTO orders
      (order_number, customer_name, customer_phone, customer_address, customer_city,
       payment_method, subtotal, delivery_fee, total, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
    VALUES (?, ?, ?, ?, ?)
  `);

  const placeOrder = db.transaction(() => {
    const info = insertOrder.run(
      orderNumber, name.trim(), phone.trim(), address.trim(), city.trim(),
      payment_method, subtotal, deliveryFee, total, notes?.trim() || null
    );
    for (const item of items) {
      insertItem.run(info.lastInsertRowid, item.id, item.name_en, item.qty, item.price || 0);
    }
    return info.lastInsertRowid;
  });

  const orderId = placeOrder();
  req.session.cart = [];
  req.session.lastOrder = { orderNumber, orderId, paymentMethod: payment_method, total, whishNumber: settings.whish_number };

  res.redirect('/checkout/success');
});

// GET /checkout/success
router.get('/success', (req, res) => {
  const order = req.session.lastOrder;
  if (!order) return res.redirect('/');
  const settings = getSettings();
  res.render('order-success', { title: 'Order Confirmed', order, settings });
});

module.exports = router;
