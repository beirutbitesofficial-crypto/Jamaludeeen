const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { applyLocalRulesToProducts } = require('../helpers/localProductRules');

// Home page
router.get('/', (req, res) => {
  const settings = {};
  db.prepare(`SELECT key, value FROM settings`).all().forEach(r => settings[r.key] = r.value);

  const rawFeatured = db.prepare(`
    SELECT * FROM products WHERE featured = 1 AND in_stock = 1 LIMIT 8
  `).all();
  const featured = applyLocalRulesToProducts(rawFeatured, settings);

  const stats = {
    men:    db.prepare(`SELECT COUNT(*) as c FROM products WHERE category='men'   AND type='local'`).get().c,
    women:  db.prepare(`SELECT COUNT(*) as c FROM products WHERE category='women' AND type='local'`).get().c,
    unisex: db.prepare(`SELECT COUNT(*) as c FROM products WHERE category='unisex' AND type='local'`).get().c,
    brands: db.prepare(`SELECT COUNT(*) as c FROM products WHERE type='brand'`).get().c,
  };

  const brands = db.prepare(`SELECT DISTINCT brand FROM products WHERE type='brand' ORDER BY brand ASC`).all().map(r => r.brand);

  const rawBestSellers = db.prepare(`
    SELECT p.*, SUM(oi.quantity) as total_sold
    FROM products p
    JOIN order_items oi ON p.id = oi.product_id
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 8
  `).all();
  const bestSellers = applyLocalRulesToProducts(rawBestSellers, settings);

  res.render('index', { title: 'Home', featured, stats, settings, brands, bestSellers });
});

// Contact / About
router.get('/contact', (req, res) => {
  const settings = {};
  db.prepare(`SELECT key, value FROM settings`).all().forEach(r => settings[r.key] = r.value);
  res.render('contact', { title: 'Contact', settings });
});

// Wishlist page (data loaded client-side from localStorage)
router.get('/wishlist', (req, res) => {
  res.render('wishlist', { title: 'Wishlist' });
});

// API: fetch products by IDs (used by wishlist page)
router.get('/api/products', (req, res) => {
  const ids = (req.query.ids || '').split(',')
    .map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (!ids.length) return res.json([]);
  const placeholders = ids.map(() => '?').join(',');
  const settings = {};
  db.prepare(`SELECT key, value FROM settings`).all().forEach(r => settings[r.key] = r.value);

  const rawProducts = db.prepare(
    `SELECT id, name_en, brand, category, type, price, in_stock, image_path FROM products WHERE id IN (${placeholders})`
  ).all(...ids);
  const products = applyLocalRulesToProducts(rawProducts, settings);
  res.json(products);
});

module.exports = router;
