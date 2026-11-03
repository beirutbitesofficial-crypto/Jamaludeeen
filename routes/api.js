// Read-only product API for other apps and partners: name, description, price, stock, photo.
// Every request needs the store's API key (Admin → Settings → API).
const express = require('express');
const crypto = require('crypto');
const db = require('../database/store-system');
const { SECTION_KEYS, refillPricesUsd, sectionWhere, sectionOf } = require('../helpers/catalog');
const { exchangeRate } = require('../helpers/pricing');
const { isAvailable } = require('../helpers/inventory');

const router = express.Router();

function settings() {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value]));
}

router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'X-API-Key, Authorization');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// X-API-Key header, "Authorization: Bearer <key>", or ?key=
router.use((req, res, next) => {
  const expected = settings().api_key || '';
  const bearer = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const given = String(req.get('X-API-Key') || bearer || req.query.key || '');
  const ok = expected && given.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: expected ? 'Invalid or missing API key' : 'API is not enabled' });
  next();
});

function toItem(p, s, base) {
  const rate = exchangeRate(s);
  const usd = v => Math.round(v / rate * 100) / 100;
  let price;
  if (p.type === 'local') {
    const r = refillPricesUsd(s);
    price = {
      currency: 'LBP',
      sizes: [50, 100].map(ml => ({ size_ml: ml, lbp: Math.round(r[ml] * rate), usd: r[ml] })),
    };
  } else {
    price = p.price ? { currency: 'LBP', lbp: p.price, usd: usd(p.price) } : null;
  }
  return {
    id: p.id,
    name: p.name_en,
    name_ar: p.name_ar || null,
    description: p.description_en || null,
    description_ar: p.description_ar || null,
    brand: p.brand,
    section: sectionOf(p),
    price,
    stock: {
      available: isAvailable(p),
      quantity: p.track_stock ? Number(p.stock_qty) : null,
      unit: p.type === 'local' ? 'ml' : 'units',
    },
    photo: p.image_path ? (/^https?:/.test(p.image_path) ? p.image_path : base + p.image_path) : null,
    url: `${base}/shop/item/${p.id}`,
    updated_at: p.updated_at,
  };
}

const base = req => `${req.protocol}://${req.get('host')}`;

router.get('/products', (req, res) => {
  const where = ['1=1'], params = [];
  const section = String(req.query.section || '');
  if (SECTION_KEYS.includes(section)) {
    const f = sectionWhere(section, section === 'brands' ? String(req.query.brand || '') : '');
    where.push(...f.where); params.push(...f.params);
  } else if (req.query.brand) { where.push('brand = ?'); params.push(String(req.query.brand)); }
  if (req.query.q) {
    const like = '%' + String(req.query.q).trim() + '%';
    where.push('(name_en LIKE ? OR name_ar LIKE ? OR brand LIKE ?)'); params.push(like, like, like);
  }
  if (req.query.available === '1') where.push('in_stock = 1 AND NOT (track_stock = 1 AND stock_qty <= 0)');
  if (req.query.updated_since) { where.push('updated_at >= ?'); params.push(String(req.query.updated_since)); }
  const ws = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) c FROM products WHERE ${ws}`).get(...params).c;
  // ?all=1 returns every product in one response (one link for the delivery app).
  const all = req.query.all === '1' || req.query.limit === 'all';
  const limit = all ? Math.max(1, total) : Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const page = all ? 1 : Math.max(1, parseInt(req.query.page, 10) || 1);
  const rows = db.prepare(`SELECT * FROM products WHERE ${ws} ORDER BY id LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
  const s = settings(), b = base(req);
  res.json({ page, limit, total, pages: Math.ceil(total / limit), items: rows.map(p => toItem(p, s, b)) });
});

router.get('/products/:id(\\d+)', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(toItem(p, settings(), base(req)));
});

router.use((req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = router;
