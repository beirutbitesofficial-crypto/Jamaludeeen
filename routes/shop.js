const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { getSettingsMap, applyLocalRulesToProduct, applyLocalRulesToProducts } = require('../helpers/localProductRules');

const PAGE_SIZE = 24;
const VALID_CATEGORIES = ['men', 'women', 'unisex'];

function renderCategoryShop(req, res, category) {
  const { q } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const settings = getSettingsMap(db);

  let where = ["p.type = 'local'", 'p.category = ?'];
  const params = [category];
  if (q && q.trim() && q !== 'undefined') {
    where.push('(p.name_en LIKE ? OR p.brand LIKE ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }

  const whereStr = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) as c FROM products p WHERE ${whereStr}`)
                  .get(...params).c;

  const rawProducts = db.prepare(`
    SELECT * FROM products p WHERE ${whereStr}
    ORDER BY p.name_en ASC
    LIMIT ? OFFSET ?
  `).all(...params, PAGE_SIZE, offset);
  const products = applyLocalRulesToProducts(rawProducts, settings);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filters = { category };
  if (q && q.trim() && q !== 'undefined') filters.q = q.trim();

  res.render('shop', {
    title: 'Shop',
    products,
    filters,
    pagination: { page, totalPages, total },
  });
}

// GET /shop — keep only explicit Men/Women/Unisex pages
router.get('/', (req, res) => {
  res.redirect('/shop/men');
});

// GET /shop/men|women|unisex
router.get('/:category(men|women|unisex)', (req, res) => {
  renderCategoryShop(req, res, req.params.category);
});

// Legacy brands URL
router.get('/brands', (req, res) => {
  res.redirect('/collections');
});

// GET /shop/item/:id — product detail
router.get('/item/:id(\\d+)', (req, res) => {
  const settings = getSettingsMap(db);
  const baseProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
  const product = applyLocalRulesToProduct(baseProduct, settings);
  if (!product) return res.status(404).render('404', { title: '404' });

  // Related products (same category, same brand, not self)
  const rawRelated = db.prepare(`
    SELECT * FROM products
    WHERE type = ? AND (brand = ? OR category = ?) AND id != ? AND in_stock = 1
    ORDER BY (brand = ?) DESC, RANDOM()
    LIMIT 4
  `).all(product.type, product.brand, product.category, product.id, product.brand);
  const related = applyLocalRulesToProducts(rawRelated, settings);

  res.render('product', { title: product.name_en, product, related });
});

// Legacy product URL
router.get('/:id(\\d+)', (req, res) => {
  res.redirect(`/shop/item/${req.params.id}`);
});

module.exports = router;
