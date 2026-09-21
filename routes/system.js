const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database/store-system');
const { normalizeSize, salePrice, saleUnitCost, stockDeduction } = require('../helpers/inventory');

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
  res.render('system/login', { title: 'Store System Login', error: req.flash('error') });
});
router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    req.session.systemUser = { id: null, name: username, username, role: 'owner', owner: true };
    return res.redirect('/system');
  }
  const staff = db.prepare('SELECT * FROM staff_users WHERE username=? AND active=1').get(username);
  if (staff && bcrypt.compareSync(password, staff.password)) {
    req.session.systemUser = { id: staff.id, name: staff.full_name, username: staff.username, role: staff.role, owner: false };
    return res.redirect('/system');
  }
  req.flash('error', 'Invalid username or password.');
  res.redirect('/system/login');
});
router.post('/logout', (req, res) => {
  req.session.systemUser = null;
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.redirect('/system/login');
});

router.get('/', requireSystem, (req, res) => {
  res.render('system/app', {
    title: 'Store System',
    currentUser: req.systemUser,
    systemSettings: settings()
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
  res.json({
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
  if (low) where.push('track_stock=1 AND stock_qty <= low_stock_threshold');
  if (tracked) where.push('track_stock=1');
  const ws = where.join(' AND ');
  const total = db.prepare('SELECT COUNT(*) c FROM products WHERE ' + ws).get(...params).c;
  const rows = db.prepare(`
    SELECT id,name_en,name_ar,brand,category,type,price,price_50ml,price_100ml,cost_price,cost_50ml,cost_100ml,sku,barcode,stock_qty,low_stock_threshold,track_stock,in_stock,image_path
    FROM products WHERE ${ws}
    ORDER BY name_en LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const safeRows = req.systemUser.role === 'cashier'
    ? rows.map(({ cost_price, ...product }) => product)
    : rows;
  res.json({ products: safeRows, total, page, pages: Math.ceil(total/limit) });
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
      num(req.body.price, p.price || 0),
      req.body.price_50ml === '' || req.body.price_50ml == null ? null : Math.max(0,num(req.body.price_50ml)),
      req.body.price_100ml === '' || req.body.price_100ml == null ? null : Math.max(0,num(req.body.price_100ml)),
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
  const exchangeRate = Math.max(1,num(req.body.exchange_rate, num(settings().system_exchange_rate,89500)));
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
        const p = db.prepare('SELECT * FROM products WHERE id=?').get(parseInt(raw.product_id,10));
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
  const rate=Math.max(1,num(req.body.exchange_rate,89500));
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
  res.json({from,to,sales,cogs,expenses,gross_profit:sales.revenue-cogs,net_profit:sales.revenue-cogs-expenses,top,payments});
});

router.get('/api/users', requireOwner, (req,res) => res.json({ users:db.prepare('SELECT id,full_name,username,role,active,created_at FROM staff_users ORDER BY full_name').all() }));
router.post('/api/users', requireOwner, (req,res) => {
  const fullName=String(req.body.full_name||'').trim();
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  const role=req.body.role==='manager'?'manager':'cashier';
  if(!fullName||!username||password.length<4) return res.status(400).json({error:'Name, username and a password of at least 4 characters are required.'});
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
  const rate=Math.max(1,num(req.body.exchange_rate,89500));
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('system_exchange_rate',?)").run(String(rate));
  res.json({ok:true,exchange_rate:rate});
});

module.exports = router;
