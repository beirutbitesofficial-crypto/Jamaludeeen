const express = require('express');
const router = express.Router();
const db = require('../database/store-system');
const { applyLocalRulesToProduct } = require('../helpers/localProductRules');
const { normalizeSize, salePrice, stockDeduction } = require('../helpers/inventory');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function generateOrderNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `JM-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const ORDER_WHATSAPP_NUMBER = '96176927146';

function formatAmount(amount, currency) {
  const value = Number(amount || 0);
  return currency === 'USD'
    ? '({ orderNumber, name, phone, address, city, paymentMethod, notes, items, subtotal, deliveryFee, total }) {
  const paymentLabel = paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid / Whish Money';
  const lines = [
    'NEW ORDER - JAMALUDEEN',
    `Order: ${orderNumber}`,
    '',
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `Address: ${address}, ${city}`,
    `Payment: ${paymentLabel}`,
    '',
    'Products:',
    ...items.map((item, index) => {
      const size = item.size_ml ? ` · ${item.size_ml}ml` : '';
      return `${index + 1}. ${item.name_en}${size} x${item.qty} - ${formatAmount((item.price || 0) * item.qty, item.type === 'local' ? 'USD' : 'LBP')}`;
    }),
    '',
    `Subtotal: ${formatAmount(subtotal, currency)}`,
    `Delivery: ${deliveryFee > 0 ? formatAmount(deliveryFee, currency) : 'Free'}`,
    `TOTAL: ${formatAmount(total, currency)}`,
  ];
  if (notes?.trim()) lines.push('', `Notes: ${notes.trim()}`);
  return lines.join('\n');
}

function cartItems(cart, settings, { strict = false } = {}) {
  return (cart || []).map(item => {
    const rawProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    const product = applyLocalRulesToProduct(rawProduct, settings);
    if (!product) {
      if (strict) throw new Error('A product in your cart is no longer available.');
      return null;
    }

    let sizeMl = null;
    if (product.type === 'local') {
      try {
        sizeMl = normalizeSize(product, item.size_ml);
      } catch (error) {
        if (strict) throw error;
        sizeMl = 50;
      }
    }

    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    return {
      ...product,
      qty,
      size_ml: sizeMl,
      price: salePrice(product, sizeMl),
      stock_deduction: stockDeduction(product, qty, sizeMl),
    };
  }).filter(Boolean);
}

// GET /checkout
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');

  const settings = getSettings();
  const items = cartItems(cart, settings);
  const deliveryFee = parseFloat(settings.delivery_fee || 0);
  const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const total = subtotal + deliveryFee;
  const currency = items.length && items.every(i => i.type === 'local') ? 'USD' : 'LBP';

  res.render('checkout', { title: 'Checkout', items, subtotal, deliveryFee, total, settings, currency });
});

// POST /checkout
router.post('/', (req, res) => {
  const { name, phone, address, city, payment_method, notes } = req.body;
  const lang = req.session.lang || 'en';

  if (!name || !phone || !address || !city || !payment_method) {
    req.flash('error', lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields.');
    return res.redirect('/checkout');
  }
  if (!['cod','whish'].includes(payment_method)) {
    req.flash('error', lang === 'ar' ? 'طريقة الدفع غير صالحة.' : 'Invalid payment method.');
    return res.redirect('/checkout');
  }

  const cart = req.session.cart || [];
  if (!cart.length) {
    req.flash('error', lang === 'ar' ? 'سلتك فارغة.' : 'Your cart is empty.');
    return res.redirect('/cart');
  }

  const settings = getSettings();
  const deliveryFee = Math.max(0, parseFloat(settings.delivery_fee || 0) || 0);
  const orderNumber = generateOrderNumber();

  try {
    const result = db.transaction(() => {
      // Re-read products and prices inside the transaction so the website and POS
      // cannot oversell the same tracked stock.
      const items = cartItems(cart, settings, { strict: true });
      if (!items.length) throw new Error('Your cart is empty.');

      for (const item of items) {
        if (!item.in_stock) throw new Error(`${item.name_en} is no longer available.`);
        if (item.track_stock && item.stock_deduction > Number(item.stock_qty || 0)) {
          const unit = item.type === 'local' ? 'ml' : 'units';
          throw new Error(`Not enough stock for ${item.name_en}. Need ${item.stock_deduction} ${unit}.`);
        }
      }

      const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
      const total = subtotal + deliveryFee;
      const info = db.prepare(`
        INSERT INTO orders
          (order_number, customer_name, customer_phone, customer_address, customer_city,
           payment_method, subtotal, delivery_fee, total, notes, stock_reserved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        orderNumber, name.trim(), phone.trim(), address.trim(), city.trim(),
        payment_method, subtotal, deliveryFee, total, notes?.trim() || null
      );

      const orderId = info.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, size_ml, stock_deduction, price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const movement = db.prepare(`
        INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
        VALUES (?,'sale',?,'online_order',?,?, 'Online Store')
      `);

      for (const item of items) {
        insertItem.run(orderId, item.id, item.name_en, item.qty, item.size_ml, item.stock_deduction, item.price || 0);
        if (item.track_stock) {
          db.prepare('UPDATE products SET stock_qty=stock_qty-?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(item.stock_deduction, item.id);
          movement.run(item.id, -item.stock_deduction, orderId, `${orderNumber}${item.size_ml ? ' · '+item.size_ml+'ml' : ''}`);
        }
      }

      return { orderId, items, subtotal, total };
    })();

    req.session.cart = [];
    req.session.lastOrder = {
      orderNumber,
      orderId: result.orderId,
      paymentMethod: payment_method,
      total: result.total,
      whishNumber: settings.whish_number,
      currency: result.items.length && result.items.every(i => i.type === 'local') ? 'USD' : 'LBP'
    };

    const whatsappMessage = buildWhatsAppOrderMessage({
      orderNumber,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      paymentMethod: payment_method,
      notes,
      items: result.items,
      subtotal: result.subtotal,
      deliveryFee,
      total: result.total,
    });
    const whatsappUrl = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    res.redirect(whatsappUrl);
  } catch (error) {
    req.flash('error', lang === 'ar' ? 'تعذر إتمام الطلب بسبب المخزون. راجع السلة وحاول مجدداً.' : error.message);
    res.redirect('/cart');
  }
});

// GET /checkout/success
router.get('/success', (req, res) => {
  const order = req.session.lastOrder;
  if (!order) return res.redirect('/');
  const settings = getSettings();
  res.render('order-success', { title: 'Order Confirmed', order, settings });
});

module.exports = router;
 + value.toFixed(2).replace(/\.00$/, '')
    : value.toLocaleString() + ' LBP';
}

function buildWhatsAppOrderMessage({ orderNumber, name, phone, address, city, paymentMethod, notes, items, subtotal, deliveryFee, total }) {
  const paymentLabel = paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid / Whish Money';
  const currency = items.length && items.every(item => item.type === 'local') ? 'USD' : 'LBP';
  const lines = [
    'NEW ORDER - JAMALUDEEN',
    `Order: ${orderNumber}`,
    '',
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `Address: ${address}, ${city}`,
    `Payment: ${paymentLabel}`,
    '',
    'Products:',
    ...items.map((item, index) => {
      const size = item.size_ml ? ` · ${item.size_ml}ml` : '';
      return `${index + 1}. ${item.name_en}${size} x${item.qty} - ${((item.price || 0) * item.qty).toLocaleString()} LBP`;
    }),
    '',
    `Subtotal: ${subtotal.toLocaleString()} LBP`,
    `Delivery: ${deliveryFee > 0 ? deliveryFee.toLocaleString() + ' LBP' : 'Free'}`,
    `TOTAL: ${total.toLocaleString()} LBP`,
  ];
  if (notes?.trim()) lines.push('', `Notes: ${notes.trim()}`);
  return lines.join('\n');
}

function cartItems(cart, settings, { strict = false } = {}) {
  return (cart || []).map(item => {
    const rawProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    const product = applyLocalRulesToProduct(rawProduct, settings);
    if (!product) {
      if (strict) throw new Error('A product in your cart is no longer available.');
      return null;
    }

    let sizeMl = null;
    if (product.type === 'local') {
      try {
        sizeMl = normalizeSize(product, item.size_ml);
      } catch (error) {
        if (strict) throw error;
        sizeMl = 50;
      }
    }

    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    return {
      ...product,
      qty,
      size_ml: sizeMl,
      price: salePrice(product, sizeMl),
      stock_deduction: stockDeduction(product, qty, sizeMl),
    };
  }).filter(Boolean);
}

// GET /checkout
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');

  const settings = getSettings();
  const items = cartItems(cart, settings);
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
  if (!['cod','whish'].includes(payment_method)) {
    req.flash('error', lang === 'ar' ? 'طريقة الدفع غير صالحة.' : 'Invalid payment method.');
    return res.redirect('/checkout');
  }

  const cart = req.session.cart || [];
  if (!cart.length) {
    req.flash('error', lang === 'ar' ? 'سلتك فارغة.' : 'Your cart is empty.');
    return res.redirect('/cart');
  }

  const settings = getSettings();
  const deliveryFee = Math.max(0, parseFloat(settings.delivery_fee || 0) || 0);
  const orderNumber = generateOrderNumber();

  try {
    const result = db.transaction(() => {
      // Re-read products and prices inside the transaction so the website and POS
      // cannot oversell the same tracked stock.
      const items = cartItems(cart, settings, { strict: true });
      if (!items.length) throw new Error('Your cart is empty.');

      for (const item of items) {
        if (!item.in_stock) throw new Error(`${item.name_en} is no longer available.`);
        if (item.track_stock && item.stock_deduction > Number(item.stock_qty || 0)) {
          const unit = item.type === 'local' ? 'ml' : 'units';
          throw new Error(`Not enough stock for ${item.name_en}. Need ${item.stock_deduction} ${unit}.`);
        }
      }

      const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
      const total = subtotal + deliveryFee;
      const info = db.prepare(`
        INSERT INTO orders
          (order_number, customer_name, customer_phone, customer_address, customer_city,
           payment_method, subtotal, delivery_fee, total, notes, stock_reserved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        orderNumber, name.trim(), phone.trim(), address.trim(), city.trim(),
        payment_method, subtotal, deliveryFee, total, notes?.trim() || null
      );

      const orderId = info.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, size_ml, stock_deduction, price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const movement = db.prepare(`
        INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
        VALUES (?,'sale',?,'online_order',?,?, 'Online Store')
      `);

      for (const item of items) {
        insertItem.run(orderId, item.id, item.name_en, item.qty, item.size_ml, item.stock_deduction, item.price || 0);
        if (item.track_stock) {
          db.prepare('UPDATE products SET stock_qty=stock_qty-?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(item.stock_deduction, item.id);
          movement.run(item.id, -item.stock_deduction, orderId, `${orderNumber}${item.size_ml ? ' · '+item.size_ml+'ml' : ''}`);
        }
      }

      return { orderId, items, subtotal, total };
    })();

    req.session.cart = [];
    req.session.lastOrder = {
      orderNumber,
      orderId: result.orderId,
      paymentMethod: payment_method,
      total: result.total,
      whishNumber: settings.whish_number
    };

    const whatsappMessage = buildWhatsAppOrderMessage({
      orderNumber,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      paymentMethod: payment_method,
      notes,
      items: result.items,
      subtotal: result.subtotal,
      deliveryFee,
      total: result.total,
    });
    const whatsappUrl = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    res.redirect(whatsappUrl);
  } catch (error) {
    req.flash('error', lang === 'ar' ? 'تعذر إتمام الطلب بسبب المخزون. راجع السلة وحاول مجدداً.' : error.message);
    res.redirect('/cart');
  }
});

// GET /checkout/success
router.get('/success', (req, res) => {
  const order = req.session.lastOrder;
  if (!order) return res.redirect('/');
  const settings = getSettings();
  res.render('order-success', { title: 'Order Confirmed', order, settings });
});

module.exports = router;
