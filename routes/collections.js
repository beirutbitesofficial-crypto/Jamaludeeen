const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { PRODUCT_IMAGES } = require('../database/product-images');
const { EXTRA_PRODUCT_IMAGES } = require('../database/product-images-batch-05');

const PAGE_SIZE = 24;
const ALL_PRODUCT_IMAGES = [...PRODUCT_IMAGES, ...EXTRA_PRODUCT_IMAGES];

// Apply curated image mappings to the existing production catalog without
// recreating products or changing their IDs. This is safe to run at startup.
try {
  const updateImage = db.prepare(`
    UPDATE products
    SET image_path = ?
    WHERE type = 'brand'
      AND UPPER(TRIM(brand)) = UPPER(TRIM(?))
      AND UPPER(TRIM(name_en)) = UPPER(TRIM(?))
  `);
  const syncImages = db.transaction(() => {
    for (const item of ALL_PRODUCT_IMAGES) {
      updateImage.run(item.image, item.brand, item.name);
    }
  });
  syncImages();
  console.log(`Curated product images synchronized: ${ALL_PRODUCT_IMAGES.length}`);
} catch (error) {
  console.error('Product image synchronization failed:', error.message);
}

// GET /collections — brand list page (clean grid, no filters)
router.get('/', (req, res) => {
  const western  = db.prepare(`SELECT * FROM brands WHERE type='western'  ORDER BY name ASC`).all();
  const khaleeji = db.prepare(`SELECT * FROM brands WHERE type='khaleeji' ORDER BY name ASC`).all();
  res.render('collections', { title: 'Brands', western, khaleeji });
});

// GET /collections/:brandId — if the brand has one category, go straight to products.
// Only show the category chooser when a brand genuinely has multiple categories.
router.get('/:brandId(\\d+)', (req, res) => {
  const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.brandId);
  if (!brand) return res.status(404).render('404', { title: '404' });

  const categories = db.prepare(`
    SELECT bc.*, COUNT(p.id) as product_count
    FROM brand_categories bc
    LEFT JOIN products p ON p.brand_category_id = bc.id
    WHERE bc.brand_id = ?
    GROUP BY bc.id
    ORDER BY bc.sort_order ASC, bc.name_en ASC
  `).all(brand.id);

  if (categories.length === 1) {
    return res.redirect(`/collections/${brand.id}/category/${categories[0].id}`);
  }

  res.render('brand-detail', { title: brand.name, brand, categories });
});

// GET /collections/:brandId/category/:catId — products in a brand category
router.get('/:brandId(\\d+)/category/:catId(\\d+)', (req, res) => {
  const brand    = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.brandId);
  const category = db.prepare(`SELECT * FROM brand_categories WHERE id = ? AND brand_id = ?`).get(req.params.catId, req.params.brandId);
  if (!brand || !category) return res.status(404).render('404', { title: '404' });

  const { q, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * PAGE_SIZE;

  let where = ['p.brand_category_id = ?'];
  const params = [category.id];
  if (q && q.trim()) {
    where.push('(p.name_en LIKE ? OR p.name_ar LIKE ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  const whereStr = where.join(' AND ');

  const total    = db.prepare(`SELECT COUNT(*) as c FROM products p WHERE ${whereStr}`).get(...params).c;
  const products = db.prepare(`SELECT * FROM products p WHERE ${whereStr} ORDER BY p.name_en ASC LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, offset);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  res.render('brand-category', {
    title: `${brand.name} — ${category.name_en}`,
    brand, category, products,
    filters: { q: q?.trim() || '' },
    pagination: { page: parseInt(page), totalPages, total },
  });
});

module.exports = router;
