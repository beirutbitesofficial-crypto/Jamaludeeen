const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database/store-system');
const { normalizeSize, salePrice, saleUnitCost, stockDeduction } = require('../helpers/inventory');
const { loginRateLimit, clearLoginAttempts } = require('../middleware/loginRateLimit');
const { SECTION_KEYS, sectionWhere, sectionCounts, brandList, refillPricesUsd } = require('../helpers/catalog');
const { exchangeRate: rateOf } = require('../helpers/pricing');
const { translator, STRINGS } = require('../helpers/back-office-i18n');
const { updateOrderStatus, ORDER_STATUSES } = require('../helpers/orders');

// Arabic versions of API error messages (the English text stays the key).
const AR_ERRORS = [
  [/^Login required$/, 'يجب تسجيل الدخول'],
  [/^Owner access required$/, 'هذه الصلاحية للمالك فقط'],
  [/^Manager access required$/, 'هذه الصلاحية للمدير فقط'],
  [/^Product not found$/, 'المنتج غير موجود'],
  [/^SKU or barcode is already used\.$/, 'رمز المنتج أو الباركود مستخدم مسبقاً.'],
  [/^Adjustment quantity cannot be zero\.$/, 'كمية التعديل لا يمكن أن تكون صفراً.'],
  [/^Adjustment would make stock negative\.$/, 'هذا التعديل يجعل المخزون سالباً.'],
  [/^Customer name is required\.$/, 'اسم الزبون مطلوب.'],
  [/^This phone number already exists\.$/, 'رقم الهاتف موجود مسبقاً.'],
  [/^Sale not found$/, 'عملية البيع غير موجودة'],
  [/^Cart is empty\.$/, 'السلة فارغة.'],
  [/^One product no longer exists\.$/, 'أحد المنتجات لم يعد موجوداً.'],
  [/^(.+) is marked unavailable\.$/, '$1 غير متوفر حالياً.'],
  [/^Invalid quantity for (.+)$/, 'كمية غير صحيحة لـ $1'],
  [/^Not enough stock for (.+)\. Need ([\d.]+) (ml|units), available ([\d.-]+)\.$/, 'لا يوجد مخزون كافٍ لـ $1. المطلوب $2، المتوفر $4.'],
  [/^Choose 50ml or 100ml for (.+)\.$/, 'اختر 50 مل أو 100 مل لـ $1.'],
  [/^Quantity must be positive\.$/, 'الكمية يجب أن تكون أكبر من صفر.'],
  [/^Open a shift before completing a POS sale\.$/, 'افتح وردية قبل إتمام البيع.'],
  [/^Invalid payment method\.$/, 'طريقة دفع غير صحيحة.'],
  [/^Cash LBP sale cannot include USD tender\.$/, 'البيع النقدي بالليرة لا يقبل دولارات.'],
  [/^Tendered LBP is less than the sale total\.$/, 'المبلغ المدفوع بالليرة أقل من المجموع.'],
  [/^Cash USD sale cannot include LBP tender\.$/, 'البيع النقدي بالدولار لا يقبل ليرات.'],
  [/^Tendered USD is less than the sale total\.$/, 'المبلغ المدفوع بالدولار أقل من المجموع.'],
  [/^Completed sale not found\.$/, 'عملية البيع غير موجودة.'],
  [/^Online orders must be cancelled/, 'طلبات الموقع تُلغى من لوحة الإدارة حتى يبقى المخزون متطابقاً.'],
  [/^Open a shift before refunding a cash sale\.$/, 'افتح وردية قبل استرجاع بيع نقدي.'],
  [/^Description is required\.$/, 'الوصف مطلوب.'],
  [/^Expense amount is required\.$/, 'قيمة المصروف مطلوبة.'],
  [/^Open a shift or mark the expense/, 'افتح وردية أو ألغِ خيار الدفع من الصندوق.'],
  [/^Supplier name is required\.$/, 'اسم المورد مطلوب.'],
  [/^Purchase has no items\.$/, 'لا يوجد منتجات في المشتريات.'],
  [/^Purchase contains a missing product\.$/, 'المشتريات تحتوي على منتج غير موجود.'],
  [/^Purchase quantity must be positive\.$/, 'كمية الشراء يجب أن تكون أكبر من صفر.'],
  [/^Name, username and a password/, 'الاسم واسم المستخدم وكلمة مرور من 8 أحرف على الأقل مطلوبة.'],
  [/^Username already exists\.$/, 'اسم المستخدم موجود مسبقاً.'],
  [/^A shift is already open\.$/, 'يوجد وردية مفتوحة مسبقاً.'],
  [/^No open shift\.$/, 'لا يوجد وردية مفتوحة.'],
  [/^Invalid exchange rate\.$/, 'سعر صرف غير صحيح.'],
  [/^Invalid status\.$/, 'حالة غير صحيحة.'],
  [/^Order not found\.$/, 'الطلب غير موجود.'],
  [/^Invalid percentage\.$/, 'نسبة غير صحيحة.'],
  [/^Not enough stock to reactivate (.+)\.$/, 'لا يوجد مخزون كافٍ لإعادة تفعيل $1.'],
];
function translateError(message, lang) {
  if (lang !== 'ar' || !message) return message;
  for (const [re, ar] of AR_ERRORS) if (re.test(message)) return message.replace(re, ar);
  return message;
}
router.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => {
    if (body && typeof body.error === 'string') body = { ...body, error: translateError(body.error, req.session.lang) };
    return json(body);
  };
  next();
});

// POS prices follow the website: refills use the USD refill list × exchange rate,
// brand products use their LBP price.
function withPosPrices(p, s) {
  if (!p || p.type !== 'local') return p;
  const usd = refillPricesUsd(s);
  const rate = rateOf(s);
  const p50 = Math.round(usd[50] * rate), p100 = Math.round(usd[100] * rate);
  return { ...p, price: p50, price_50ml: p50, price_100ml: p100, usd_50ml: usd[50], usd_100ml: usd[100] };
}

function settings() {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value]));
}
function user(req) {
  if (req.session.systemUser?.owner) return req.session.systemUser;
  if (req.session.systemUser?.id) {
    const staff = db.prepare('SELECT id, full_name, username, role, active FROM staff_users WHERE id=?').get(req.session.systemUser.id);
    if (staff?.active) {
      req.session.systemUser = { id: staff.id, name: staff.full_name, username: staff.username, role: staff.role, owner: false };
      return req.session.systemUser;
    }
    req.session.systemUser = null;
  }
  if (req.session.isAdmin) return { id: null, name: req.session.adminUsername || 'Owner', username: req.session.adminUsername || 'admin', role: 'owner', owner: true };
  return null;
}
function requireSystem(req, res, next) {
  const u = user(req);
  if (!u) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Login required' });
    return res.redirect('/system/login');
  }
  req.systemUser = u;
  next();
}
function requireOwner(req, res, next) {
  const u = user(req);
  if (!u) return res.status(401).json({ error: 'Login required' });
  if (u.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
  req.systemUser = u;
  next();
}
function requireManager(req, res, next) {
  const u = user(req);
  if (!u) return res.status(401).json({ error: 'Login required' });
  if (!['owner','manager'].includes(u.role)) return res.status(403).json({ error: 'Manager access required' });
  req.systemUser = u;
  next();
}
function currentShift(req) {
  const u = user(req);
  if (!u) return null;
  if (u.owner) return db.prepare("SELECT * FROM shifts WHERE status='open' AND staff_name=? ORDER BY id DESC LIMIT 1").get(u.name);
  return db.prepare("SELECT * FROM shifts WHERE status='open' AND staff_id=? ORDER BY id DESC LIMIT 1").get(u.id);
}
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function saleNumber() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return 'POS-' + stamp + '-' + Math.floor(100 + Math.random() * 900);
}
function dateRange(query) {
  const today = new Date().toISOString().slice(0,10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from || '') ? query.from : today;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.to || '') ? query.to : today;
  return { from, to };
}

router.get('/login', (req, res) => {
  if (user(req)) return res.redirect('/system');
  res.render('system/login', { title: translator(req.session.lang)('store_system'), error: req.flash('error') });
});
router.post('/login', loginRateLimit('system'), (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    clearLoginAttempts(req, 'system');
    req.session.systemUser = { id: null, name: username, username, role: 'owner', owner: true };
    return res.redirect('/system');
  }
  const staff = db.prepare('SELECT * FROM staff_users WHERE username=? AND active=1').get(username);
  if (staff && bcrypt.compareSync(password, staff.password)) {
    clearLoginAttempts(req, 'system');
    req.session.systemUser = { id: staff.id, name: staff.full_name, username: staff.username, role: staff.role, owner: false };
    return res.redirect('/system');
  }
  req.flash('error', translator(req.session.lang)('invalid_login'));
  res.redirect('/system/login');
});
router.post('/logout', (req, res) => {
  req.session.systemUser = null;
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.redirect('/system/login');
});

router.get('/', requireSystem, (req, res) => {
  const s = settings();
  const a = translator(req.session.lang);
  res.render('system/app', {
    dict: Object.fromEntries(Object.keys(STRINGS).map(k => [k, a(k)])),
    title: translator(req.session.lang)('store_system'),
    currentUser: req.systemUser,
    systemRate: rateOf(s),
    counts: sectionCounts(db),
    brands: brandList(db),
  });
});

router.get('/api/dashboard', requireSystem, (req, res) => {
  const today = db.prepare(`
    SELECT COUNT(*) sales_count, COALESCE(SUM(total),0) sales_total
    FROM sales WHERE status='completed' AND date(created_at,'localtime')=date('now','localtime')
  `).get();
  const expense = db.prepare(`
    SELECT COALESCE(SUM(amount_lbp + amount_usd * exchange_rate),0) total
    FROM expenses WHERE date(created_at,'localtime')=date('now','localtime')
  `).get().total;
  const cogs = db.prepare(`
    SELECT COALESCE(SUM(si.unit_cost * si.quantity),0) total
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    WHERE s.status='completed' AND date(s.created_at,'localtime')=date('now','localtime')
  `).get().total;
  const lowStock = db.prepare(`
    SELECT COUNT(*) c FROM products WHERE track_stock=1 AND stock_qty <= low_stock_threshold
  `).get().c;
  const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const recent = db.prepare(`
    SELECT id, sale_number, customer_name, total, payment_method, cashier_name, created_at
    FROM sales ORDER BY id DESC LIMIT 8
  `).all();
  const canManage = ['owner','manager'].includes(req.systemUser.role);
  const online = db.prepare(`
    SELECT COUNT(*) count, COALESCE(SUM(total),0) total FROM sales
    WHERE status='completed' AND source='online' AND date(created_at,'localtime')=date('now','localtime')
  `).get();
  const onlinePending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('pending','confirmed','shipped')").get().c;
  res.json({
    online: { ...online, open_orders: onlinePending },
    today: canManage
      ? { ...today, cogs, expenses: expense, gross_profit: today.sales_total - cogs, net_profit: today.sales_total - cogs - expense }
      : { ...today },
    lowStock, products, recent, shift: currentShift(req), user: req.systemUser
  });
});

router.get('/api/products', requireSystem, (req, res) => {
  const q = String(req.query.q || '').trim();
  const low = req.query.low === '1';
  const tracked = req.query.tracked === '1';
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(200, Math.max(20, parseInt(req.query.limit || '80', 10)));
  const where = ['1=1'];
  const params = [];
  if (q) {
    where.push('(name_en LIKE ? OR name_ar LIKE ? OR brand LIKE ? OR sku LIKE ? OR barcode LIKE ?)');
    const like = '%' + q + '%';
    params.push(like, like, like, like, like);
  }
  const section = SECTION_KEYS.includes(req.query.section) ? req.query.section : '';
  if (section) {
    const f = sectionWhere(section, section === 'brands' ? String(req.query.brand || '') : '');
    where.push(...f.where); params.push(...f.params);
  }
  if (low) where.push('track_stock=1 AND stock_qty <= low_stock_threshold');
  if (tracked) where.push('track_stock=1');
  const ws = where.join(' AND ');
  const s = settings();
  const total = db.prepare('SELECT COUNT(*) c FROM products WHERE ' + ws).get(...params).c;
  const rows = db.prepare(`
    SELECT id,name_en,name_ar,brand,category,type,price,price_50ml,price_100ml,cost_price,cost_50ml,cost_100ml,sku,barcode,stock_qty,low_stock_threshold,track_stock,in_stock,image_path
    FROM products WHERE ${ws}
    ORDER BY in_stock DESC, name_en LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit).map(p => withPosPrices(p, s));
  const safeRows = req.systemUser.role === 'cashier'
    ? rows.map(({ cost_price, cost_50ml, cost_100ml, ...product }) => product)
    : rows;
  res.json({ products: safeRows, total, page, pages: Math.ceil(total/limit) });
});

router.get('/api/catalog', requireSystem, (req, res) => {
  const s = settings();
  res.json({ counts: sectionCounts(db), brands: brandList(db), refill_usd: refillPricesUsd(s), exchange_rate: rateOf(s) });
});

router.post('/api/products/:id/inventory', requireManager, (req, res) => {
  const id = parseInt(req.params.id,10);
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const sku = String(req.body.sku || '').trim() || null;
  const barcode = String(req.body.barcode || '').trim() || null;
  try {
    db.prepare(`
      UPDATE products SET sku=?, barcode=?, price=?, price_50ml=?, price_100ml=?, cost_price=?, cost_50ml=?, cost_100ml=?, stock_qty=?,
        low_stock_threshold=?, track_stock=?, in_stock=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      sku, barcode,
      // Refill prices are managed centrally (Admin → Prices), so they are left untouched here.
      p.type === 'local' ? p.price : Math.max(0, num(req.body.price, p.price || 0)),
      p.type === 'local' ? p.price_50ml : (req.body.price_50ml === '' || req.body.price_50ml == null ? null : Math.max(0,num(req.body.price_50ml))),
      p.type === 'local' ? p.price_100ml : (req.body.price_100ml === '' || req.body.price_100ml == null ? null : Math.max(0,num(req.body.price_100ml))),
      Math.max(0,num(req.body.cost_price,p.cost_price)),
      req.body.cost_50ml === '' || req.body.cost_50ml == null ? null : Math.max(0,num(req.body.cost_50ml)),
      req.body.cost_100ml === '' || req.body.cost_100ml == null ? null : Math.max(0,num(req.body.cost_100ml)),
      num(req.body.stock_qty,p.stock_qty), Math.max(0,num(req.body.low_stock_threshold,p.low_stock_threshold)),
      req.body.track_stock ? 1 : 0, req.body.in_stock === false ? 0 : 1, id
    );
  } catch (e) {
    return res.status(400).json({ error: e.message.includes('UNIQUE') ? 'SKU or barcode is already used.' : e.message });
  }
  res.json({ ok: true, product: db.prepare('SELECT * FROM products WHERE id=?').get(id) });
});

router.post('/api/products/:id/adjust', requireManager, (req, res) => {
  const id = parseInt(req.params.id,10);
  const qty = num(req.body.quantity);
  if (!qty) return res.status(400).json({ error: 'Adjustment quantity cannot be zero.' });
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  if (num(p.stock_qty) + qty < 0) return res.status(400).json({ error: 'Adjustment would make stock negative.' });
  db.transaction(() => {
    db.prepare('UPDATE products SET stock_qty=stock_qty+?, track_stock=1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(qty,id);
    db.prepare(`
      INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,note,staff_name)
      VALUES (?,'adjustment',?,'manual',?,?)
    `).run(id,qty,String(req.body.note||'Manual adjustment'),req.systemUser.name);
  })();
  res.json({ ok:true, stock_qty: db.prepare('SELECT stock_qty FROM products WHERE id=?').get(id).stock_qty });
});

router.get('/api/customers', requireSystem, (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = q
    ? db.prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY updated_at DESC LIMIT 100").all('%'+q+'%','%'+q+'%')
    : db.prepare('SELECT * FROM customers ORDER BY updated_at DESC LIMIT 100').all();
  res.json({ customers: rows });
});
router.post('/api/customers', requireSystem, (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim() || null;
  if (!name) return res.status(400).json({ error:'Customer name is required.' });
  try {
    const info = db.prepare('INSERT INTO customers(name,phone,email,notes) VALUES (?,?,?,?)')
      .run(name,phone,String(req.body.email||'').trim()||null,String(req.body.notes||'').trim()||null);
    res.json({ ok:true, customer: db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid) });
  } catch(e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'This phone number already exists.' : e.message }); }
});

router.get('/api/sales', requireSystem, (req,res) => {
  const { from, to } = dateRange(req.query);
  const rows = db.prepare(`
    SELECT * FROM sales WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?)
    ORDER BY id DESC LIMIT 300
  `).all(from,to);
  res.json({ sales:rows, from,to });
});
router.get('/api/sales/:id', requireSystem, (req,res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(req.params.id);
  if (!sale) return res.status(404).json({ error:'Sale not found' });
  let items = db.prepare('SELECT * FROM sale_items WHERE sale_id=? ORDER BY id').all(sale.id);
  if (req.systemUser.role === 'cashier') items = items.map(({ unit_cost, ...item }) => item);
  res.json({ sale,items });
});
router.post('/api/sales', requireSystem, (req,res) => {
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];
  if (!incoming.length) return res.status(400).json({ error:'Cart is empty.' });
  const canOverride = ['owner','manager'].includes(req.systemUser.role);
  const S = settings();
  const exchangeRate = rateOf(S);
  const discount = canOverride ? Math.max(0,num(req.body.discount)) : 0;
  try {
    const result = db.transaction(() => {
      let customerId = req.body.customer_id ? parseInt(req.body.customer_id,10) : null;
      let customerName = String(req.body.customer_name || '').trim() || null;
      let customerPhone = String(req.body.customer_phone || '').trim() || null;
      if (customerId) {
        const c = db.prepare('SELECT * FROM customers WHERE id=?').get(customerId);
        if (c) { customerName=c.name; customerPhone=c.phone; } else customerId=null;
      } else if (customerPhone) {
        let c = db.prepare('SELECT * FROM customers WHERE phone=?').get(customerPhone);
        if (!c && customerName) {
          const info=db.prepare('INSERT INTO customers(name,phone) VALUES (?,?)').run(customerName,customerPhone);
          c=db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid);
        }
        if (c) { customerId=c.id; customerName=c.name; }
      }
      const items = incoming.map(raw => {
        const p = withPosPrices(db.prepare('SELECT * FROM products WHERE id=?').get(parseInt(raw.product_id,10)), S);
        if (!p) throw new Error('One product no longer exists.');
        if (!p.in_stock) throw new Error(p.name_en + ' is marked unavailable.');
        const qty = num(raw.quantity);
        if (qty <= 0) throw new Error('Invalid quantity for ' + p.name_en);
        const sizeMl = p.type === 'local' ? normalizeSize(p, raw.size_ml) : null;
        const needed = stockDeduction(p, qty, sizeMl);
        if (p.track_stock && needed > num(p.stock_qty)) {
          const unit = p.type === 'local' ? 'ml' : 'units';
          throw new Error(`Not enough stock for ${p.name_en}. Need ${needed} ${unit}, available ${num(p.stock_qty)}.`);
        }
        const basePrice = salePrice(p, sizeMl);
        const unitPrice = canOverride && raw.unit_price !== undefined ? Math.max(0,num(raw.unit_price,basePrice)) : basePrice;
        const unitCost = saleUnitCost(p, sizeMl);
        return { p, qty, sizeMl, needed, unitPrice, unitCost, note:String(raw.note||'').trim()||null, total:qty*unitPrice };
      });
      const subtotal = items.reduce((s,i)=>s+i.total,0);
      const appliedDiscount = Math.min(discount,subtotal);
      const total = subtotal-appliedDiscount;
      const shift=currentShift(req);
      if (!shift) throw new Error('Open a shift before completing a POS sale.');
      const number=saleNumber();
      const paymentMethod=String(req.body.payment_method||'cash_lbp');
      if (!['cash_lbp','cash_usd','whish','card'].includes(paymentMethod)) throw new Error('Invalid payment method.');
      let tenderedLbp=Math.max(0,num(req.body.tendered_lbp));
      let tenderedUsd=Math.max(0,num(req.body.tendered_usd));
      let changeLbp=0, changeUsd=0, cashLbp=0, cashUsd=0;
      if (paymentMethod === 'cash_lbp') {
        if (tenderedUsd > 0) throw new Error('Cash LBP sale cannot include USD tender.');
        if (tenderedLbp <= 0) tenderedLbp=total;
        if (tenderedLbp < total) throw new Error('Tendered LBP is less than the sale total.');
        changeLbp=tenderedLbp-total;
        cashLbp=total;
      } else if (paymentMethod === 'cash_usd') {
        if (tenderedLbp > 0) throw new Error('Cash USD sale cannot include LBP tender.');
        const usdTotal=total/exchangeRate;
        if (tenderedUsd <= 0) tenderedUsd=usdTotal;
        if (tenderedUsd + 0.000001 < usdTotal) throw new Error('Tendered USD is less than the sale total.');
        changeUsd=tenderedUsd-usdTotal;
        cashUsd=usdTotal;
      } else {
        tenderedLbp=0;
        tenderedUsd=0;
      }
      const info=db.prepare(`
        INSERT INTO sales(sale_number,customer_id,customer_name,customer_phone,subtotal,discount,total,
          payment_method,exchange_rate,tendered_lbp,tendered_usd,change_lbp,change_usd,shift_id,cashier_name,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(number,customerId,customerName,customerPhone,subtotal,appliedDiscount,total,
        paymentMethod,exchangeRate,tenderedLbp,tenderedUsd,changeLbp,changeUsd,
        shift.id,req.systemUser.name,String(req.body.notes||'').trim()||null);
      const saleId=info.lastInsertRowid;
      const insertItem=db.prepare(`
        INSERT INTO sale_items(sale_id,product_id,product_name,sku,quantity,size_ml,stock_deduction,unit_price,unit_cost,line_total,note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `);
      const movement=db.prepare(`
        INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
        VALUES (?,'sale',?,'sale',?,?,?)
      `);
      for (const i of items) {
        insertItem.run(saleId,i.p.id,i.p.name_en,i.p.sku,i.qty,i.sizeMl,i.needed,i.unitPrice,i.unitCost,i.total,i.note);
        if (i.p.track_stock) {
          db.prepare('UPDATE products SET stock_qty=stock_qty-?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(i.needed,i.p.id);
          movement.run(i.p.id,-i.needed,saleId,`${number}${i.sizeMl ? ' · '+i.sizeMl+'ml' : ''}`,req.systemUser.name);
        }
      }
      if (cashLbp || cashUsd) {
        db.prepare(`INSERT INTO cash_movements(shift_id,movement_type,reference_type,reference_id,amount_lbp,amount_usd,note,staff_name)
          VALUES (?,'sale','sale',?,?,?,?,?)`).run(shift.id,saleId,cashLbp,cashUsd,number,req.systemUser.name);
      }
      if (customerId) db.prepare('UPDATE customers SET total_spent=total_spent+?, visits=visits+1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(total,customerId);
      return { saleId, number, total, change_lbp: changeLbp, change_usd: changeUsd };
    })();
    res.json({ ok:true, ...result });
  } catch(e) { res.status(400).json({ error:e.message }); }
});

router.post('/api/sales/:id/refund', requireManager, (req,res) => {
  const id=parseInt(req.params.id,10);
  const sale=db.prepare("SELECT * FROM sales WHERE id=? AND status='completed'").get(id);
  if (!sale) return res.status(404).json({ error:'Completed sale not found.' });
  if (sale.source === 'online') {
    return res.status(400).json({ error:'Online orders must be cancelled/refunded from Website Admin so stock stays synchronized.' });
  }
  const refundShift=currentShift(req);
  if (['cash_lbp','cash_usd'].includes(sale.payment_method) && !refundShift) {
    return res.status(400).json({ error:'Open a shift before refunding a cash sale.' });
  }
  db.transaction(() => {
    const items=db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(id);
    for (const item of items) {
      const p=db.prepare('SELECT track_stock,type FROM products WHERE id=?').get(item.product_id);
      if (p?.track_stock) {
        const restore=num(item.stock_deduction, p.type==='local' ? num(item.size_ml)*num(item.quantity) : num(item.quantity));
        db.prepare('UPDATE products SET stock_qty=stock_qty+?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(restore,item.product_id);
        db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
          VALUES (?,'return',?,'sale',?,'Full sale refund',?)`).run(item.product_id,restore,id,req.systemUser.name);
      }
    }
    db.prepare("UPDATE sales SET status='refunded', refunded_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    if (sale.customer_id) db.prepare('UPDATE customers SET total_spent=MAX(0,total_spent-?), visits=MAX(0,visits-1), updated_at=CURRENT_TIMESTAMP WHERE id=?').run(sale.total,sale.customer_id);
    if (sale.payment_method === 'cash_lbp') {
      db.prepare(`INSERT INTO cash_movements(shift_id,movement_type,reference_type,reference_id,amount_lbp,amount_usd,note,staff_name)
        VALUES (?,'refund','sale',?, ?,0,?,?)`).run(refundShift.id,id,-num(sale.total),'Refund '+sale.sale_number,req.systemUser.name);
    } else if (sale.payment_method === 'cash_usd') {
      db.prepare(`INSERT INTO cash_movements(shift_id,movement_type,reference_type,reference_id,amount_lbp,amount_usd,note,staff_name)
        VALUES (?,'refund','sale',?,0,?,?,?)`).run(refundShift.id,id,-(num(sale.total)/Math.max(1,num(sale.exchange_rate,1))),'Refund '+sale.sale_number,req.systemUser.name);
    }
  })();
  res.json({ ok:true });
});

router.get('/api/expenses', requireManager, (req,res) => {
  const {from,to}=dateRange(req.query);
  const rows=db.prepare("SELECT * FROM expenses WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?) ORDER BY id DESC").all(from,to);
  res.json({ expenses:rows,from,to });
});
router.post('/api/expenses', requireManager, (req,res) => {
  const description=String(req.body.description||'').trim();
  const category=String(req.body.category||'Other').trim();
  if (!description) return res.status(400).json({ error:'Description is required.' });
  const amountLbp=Math.max(0,num(req.body.amount_lbp));
  const amountUsd=Math.max(0,num(req.body.amount_usd));
  const rate=rateOf(settings());
  if (!amountLbp && !amountUsd) return res.status(400).json({ error:'Expense amount is required.' });
  const shift=currentShift(req);
  const fromDrawer=req.body.from_drawer !== false && String(req.body.from_drawer) !== 'false';
  if (fromDrawer && !shift) return res.status(400).json({ error:'Open a shift or mark the expense as not paid from the drawer.' });
  const result=db.transaction(() => {
    const info=db.prepare('INSERT INTO expenses(category,description,amount_lbp,amount_usd,exchange_rate,shift_id,staff_name) VALUES (?,?,?,?,?,?,?)')
      .run(category,description,amountLbp,amountUsd,rate,fromDrawer ? shift.id : null,req.systemUser.name);
    if (fromDrawer) {
      db.prepare(`INSERT INTO cash_movements(shift_id,movement_type,reference_type,reference_id,amount_lbp,amount_usd,note,staff_name)
        VALUES (?,'expense','expense',?,?,?,?,?)`).run(shift.id,info.lastInsertRowid,-amountLbp,-amountUsd,description,req.systemUser.name);
    }
    return info.lastInsertRowid;
  })();
  res.json({ ok:true,id:result });
});

router.get('/api/suppliers', requireManager, (req,res) => res.json({ suppliers:db.prepare('SELECT * FROM suppliers ORDER BY name').all() }));
router.post('/api/suppliers', requireManager, (req,res) => {
  const name=String(req.body.name||'').trim();
  if (!name) return res.status(400).json({ error:'Supplier name is required.' });
  const info=db.prepare('INSERT INTO suppliers(name,phone,notes) VALUES (?,?,?)').run(name,String(req.body.phone||'').trim()||null,String(req.body.notes||'').trim()||null);
  res.json({ ok:true,id:info.lastInsertRowid });
});
router.get('/api/purchases', requireManager, (req,res) => {
  const rows=db.prepare('SELECT * FROM purchases ORDER BY id DESC LIMIT 200').all();
  res.json({ purchases:rows });
});
router.post('/api/purchases', requireManager, (req,res) => {
  const incoming=Array.isArray(req.body.items)?req.body.items:[];
  if (!incoming.length) return res.status(400).json({ error:'Purchase has no items.' });
  try {
    const result=db.transaction(() => {
      const supplierId=req.body.supplier_id?parseInt(req.body.supplier_id,10):null;
      const supplier=supplierId?db.prepare('SELECT * FROM suppliers WHERE id=?').get(supplierId):null;
      const items=incoming.map(raw=>{
        const p=db.prepare('SELECT * FROM products WHERE id=?').get(parseInt(raw.product_id,10));
        if (!p) throw new Error('Purchase contains a missing product.');
        const qty=num(raw.quantity); const cost=Math.max(0,num(raw.unit_cost));
        if(qty<=0) throw new Error('Purchase quantity must be positive.');
        return {p,qty,cost,total:qty*cost};
      });
      const total=items.reduce((s,i)=>s+i.total,0);
      const info=db.prepare('INSERT INTO purchases(supplier_id,supplier_name,invoice_number,total_cost_lbp,notes,staff_name) VALUES (?,?,?,?,?,?)')
        .run(supplier?.id||null,supplier?.name||String(req.body.supplier_name||'').trim()||null,String(req.body.invoice_number||'').trim()||null,total,String(req.body.notes||'').trim()||null,req.systemUser.name);
      const purchaseId=info.lastInsertRowid;
      for(const i of items){
        db.prepare('INSERT INTO purchase_items(purchase_id,product_id,product_name,quantity,unit_cost,line_total) VALUES (?,?,?,?,?,?)')
          .run(purchaseId,i.p.id,i.p.name_en,i.qty,i.cost,i.total);
        db.prepare('UPDATE products SET stock_qty=stock_qty+?, cost_price=?, track_stock=1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(i.qty,i.cost,i.p.id);
        db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
          VALUES (?,'purchase',?,'purchase',?,'Stock purchase',?)`).run(i.p.id,i.qty,purchaseId,req.systemUser.name);
      }
      return {purchaseId,total};
    })();
    res.json({ok:true,...result});
  } catch(e){ res.status(400).json({error:e.message}); }
});

// ── Website (online) orders ────────────────────────────────────────────────
function orderLbp(order, rate) {
  const k = order.currency === 'USD' ? rate : 1;
  return Math.round(Number(order.total || 0) * k);
}
router.get('/api/online-orders', requireManager, (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
  const q = String(req.query.q || '').trim();
  const where = ['1=1'], params = [];
  if (status) { where.push('status=?'); params.push(status); }
  if (q) { where.push('(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
  const rate = rateOf(settings());
  const orders = db.prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 200`).all(...params)
    .map(o => ({ ...o, total_lbp: orderLbp(o, rate) }));
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all().map(r => [r.status, r.c]));
  const open = db.prepare("SELECT * FROM orders WHERE status IN ('pending','confirmed','shipped')").all();
  res.json({ orders, counts, open_value_lbp: open.reduce((sum, o) => sum + orderLbp(o, rate), 0) });
});
router.get('/api/online-orders/:id', requireManager, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const items = db.prepare(`SELECT oi.*, p.image_path FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY oi.id`).all(order.id);
  res.json({ order: { ...order, total_lbp: orderLbp(order, rateOf(settings())) }, items });
});
router.post('/api/online-orders/:id/status', requireManager, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  try {
    updateOrderStatus(db, order, String(req.body.status || ''), req.systemUser.name);
    res.json({ ok: true, order: db.prepare('SELECT * FROM orders WHERE id=?').get(order.id) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/api/settings/online-share', requireOwner, (req, res) => {
  const pct = num(req.body.percent, -1);
  if (pct < 0 || pct > 100) return res.status(400).json({ error: 'Invalid percentage.' });
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('online_partner_share',?)").run(String(pct));
  res.json({ ok: true, percent: pct });
});

router.get('/api/reports', requireManager, (req,res) => {
  const {from,to}=dateRange(req.query);
  const sales=db.prepare(`
    SELECT COUNT(*) count, COALESCE(SUM(total),0) revenue
    FROM sales WHERE status='completed' AND date(created_at,'localtime') BETWEEN date(?) AND date(?)
  `).get(from,to);
  const cogs=db.prepare(`
    SELECT COALESCE(SUM(si.unit_cost*si.quantity),0) cogs
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    WHERE s.status='completed' AND date(s.created_at,'localtime') BETWEEN date(?) AND date(?)
  `).get(from,to).cogs;
  const expenses=db.prepare(`
    SELECT COALESCE(SUM(amount_lbp+amount_usd*exchange_rate),0) total
    FROM expenses WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?)
  `).get(from,to).total;
  const top=db.prepare(`
    SELECT si.product_name, SUM(si.quantity) qty, SUM(si.line_total) revenue
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    WHERE s.status='completed' AND date(s.created_at,'localtime') BETWEEN date(?) AND date(?)
    GROUP BY si.product_name ORDER BY revenue DESC LIMIT 15
  `).all(from,to);
  const payments=db.prepare(`
    SELECT payment_method, COUNT(*) count, SUM(total) total FROM sales
    WHERE status='completed' AND date(created_at,'localtime') BETWEEN date(?) AND date(?)
    GROUP BY payment_method ORDER BY total DESC
  `).all(from,to);
  // Split by channel: in-store (POS) vs website (online).
  const byChannel = {};
  for (const ch of ['pos','online']) {
    const rev = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(total),0) revenue FROM sales
      WHERE status='completed' AND (CASE WHEN source='online' THEN 'online' ELSE 'pos' END)=? AND date(created_at,'localtime') BETWEEN date(?) AND date(?)`).get(ch,from,to);
    const c = db.prepare(`SELECT COALESCE(SUM(si.unit_cost*si.quantity),0) cogs FROM sale_items si JOIN sales s ON s.id=si.sale_id
      WHERE s.status='completed' AND (CASE WHEN s.source='online' THEN 'online' ELSE 'pos' END)=? AND date(s.created_at,'localtime') BETWEEN date(?) AND date(?)`).get(ch,from,to).cogs;
    byChannel[ch] = { count: rev.count, revenue: rev.revenue, cogs: c, gross_profit: rev.revenue - c };
  }
  const share = Math.min(100, Math.max(0, num(settings().online_partner_share, 0)));
  byChannel.online.partner_share_pct = share;
  byChannel.online.partner_share = Math.round(byChannel.online.gross_profit * share / 100);
  res.json({from,to,sales,cogs,expenses,gross_profit:sales.revenue-cogs,net_profit:sales.revenue-cogs-expenses,top,payments,channels:byChannel});
});

router.get('/api/users', requireOwner, (req,res) => res.json({ users:db.prepare('SELECT id,full_name,username,role,active,created_at FROM staff_users ORDER BY full_name').all() }));
router.post('/api/users', requireOwner, (req,res) => {
  const fullName=String(req.body.full_name||'').trim();
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  const role=req.body.role==='manager'?'manager':'cashier';
  if(!fullName||!username||password.length<8) return res.status(400).json({error:'Name, username and a password of at least 8 characters are required.'});
  try{
    const hash=bcrypt.hashSync(password,10);
    const info=db.prepare('INSERT INTO staff_users(full_name,username,password,role) VALUES (?,?,?,?)').run(fullName,username,hash,role);
    res.json({ok:true,id:info.lastInsertRowid});
  }catch(e){res.status(400).json({error:e.message.includes('UNIQUE')?'Username already exists.':e.message});}
});
router.post('/api/users/:id/toggle', requireOwner, (req,res) => {
  db.prepare('UPDATE staff_users SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

router.get('/api/shift', requireSystem, (req,res) => res.json({ shift:currentShift(req) }));
router.post('/api/shift/open', requireSystem, (req,res) => {
  if(currentShift(req)) return res.status(400).json({error:'A shift is already open.'});
  const u=req.systemUser;
  const info=db.prepare('INSERT INTO shifts(staff_id,staff_name,opening_lbp,opening_usd) VALUES (?,?,?,?)')
    .run(u.owner?null:u.id,u.name,Math.max(0,num(req.body.opening_lbp)),Math.max(0,num(req.body.opening_usd)));
  res.json({ok:true,id:info.lastInsertRowid});
});
router.post('/api/shift/close', requireSystem, (req,res) => {
  const shift=currentShift(req);
  if(!shift) return res.status(400).json({error:'No open shift.'});
  const cash=db.prepare(`
    SELECT COALESCE(SUM(amount_lbp),0) lbp, COALESCE(SUM(amount_usd),0) usd
    FROM cash_movements WHERE shift_id=?
  `).get(shift.id);
  const expectedLbp=num(shift.opening_lbp)+num(cash.lbp);
  const expectedUsd=num(shift.opening_usd)+num(cash.usd);
  const closingLbp=Math.max(0,num(req.body.closing_lbp));
  const closingUsd=Math.max(0,num(req.body.closing_usd));
  db.prepare(`UPDATE shifts SET status='closed',closed_at=CURRENT_TIMESTAMP,closing_lbp=?,closing_usd=?,
    expected_lbp=?,expected_usd=?,difference_lbp=?,difference_usd=?,notes=? WHERE id=?`)
    .run(closingLbp,closingUsd,expectedLbp,expectedUsd,closingLbp-expectedLbp,closingUsd-expectedUsd,String(req.body.notes||'').trim()||null,shift.id);
  res.json({ok:true,expected_lbp:expectedLbp,expected_usd:expectedUsd,difference_lbp:closingLbp-expectedLbp,difference_usd:closingUsd-expectedUsd});
});

router.post('/api/settings/exchange-rate', requireManager, (req,res) => {
  const rate=num(req.body.exchange_rate,0);
  if (!(rate > 0)) return res.status(400).json({ error:'Invalid exchange rate.' });
  // Website and Store System share one exchange rate.
  const upsert=db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)');
  db.transaction(() => { upsert.run('usd_rate',String(rate)); upsert.run('system_exchange_rate',String(rate)); })();
  res.json({ok:true,exchange_rate:rate});
});

module.exports = router;
