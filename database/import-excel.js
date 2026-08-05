/**
 * Synchronize the Brand catalog from TAHA.xlsx.
 *
 * Excel "Category Name*" becomes both the Brand name and that Brand's
 * single category name. These products are type="brand", so they never
 * appear in the local Men, Women, or Unisex collections.
 */

const path = require('path');
const XLSX = require('xlsx');

const RATE = 90000;
const DEFAULT_FILE = path.join(__dirname, '..', 'TAHA.xlsx');

const KHALEEJI = new Set([
  'LATTAFA', 'LATTAFA PRIDE', 'RASASI', 'ARD AL ZAAFARAN TRADING',
  'ASDAAF', 'MAISON ALHAMBRA', 'AFNAN', 'FRAGRANCE WORLD',
  'RIFFS', 'SHAYKH ALKAR', 'AJMAL', 'ARABIAN OUD',
]);

function readCatalog(file = DEFAULT_FILE) {
  const workbook = XLSX.readFile(file);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }).slice(1);

  return rows.flatMap((row) => {
    const name = String(row[1] || '').trim();
    const brand = String(row[2] || '').trim();
    const priceUsd = Number(row[3]);
    if (!name || !brand || !Number.isFinite(priceUsd)) return [];

    return [{
      name,
      brand,
      price: Math.round(priceUsd * RATE / 1000) * 1000,
    }];
  });
}

function synchronizeBrandCatalog(db, file = DEFAULT_FILE) {
  const products = readCatalog(file);
  const brandNames = [...new Set(products.map((product) => product.brand))];

  const synchronize = db.transaction(() => {
    // Brand data is authoritative from Excel. Local catalog and orders remain intact.
    db.prepare(`DELETE FROM products WHERE type = 'brand'`).run();
    db.prepare(`DELETE FROM brand_categories`).run();
    db.prepare(`DELETE FROM brands`).run();

    const insertBrand = db.prepare(`
      INSERT INTO brands (name, type) VALUES (?, ?)
    `);
    const insertCategory = db.prepare(`
      INSERT INTO brand_categories (brand_id, name_en, name_ar, sort_order)
      VALUES (?, ?, '', 0)
    `);
    const insertProduct = db.prepare(`
      INSERT INTO products
        (name_en, name_ar, brand, category, type, price, image_path,
         description_en, description_ar, brand_category_id, in_stock, featured)
      VALUES (?, '', ?, 'unisex', 'brand', ?, NULL, '', '', ?, 1, 0)
    `);

    const categoryByBrand = new Map();
    for (const brand of brandNames) {
      const brandType = KHALEEJI.has(brand.toUpperCase()) ? 'khaleeji' : 'western';
      const brandId = Number(insertBrand.run(brand, brandType).lastInsertRowid);
      const categoryId = Number(insertCategory.run(brandId, brand).lastInsertRowid);
      categoryByBrand.set(brand, categoryId);
    }

    for (const product of products) {
      insertProduct.run(product.name, product.brand, product.price, categoryByBrand.get(product.brand));
    }
  });

  synchronize();
  return { products: products.length, brands: brandNames.length };
}

module.exports = { readCatalog, synchronizeBrandCatalog };

if (require.main === module) {
  const db = require('./db');
  const result = synchronizeBrandCatalog(db);
  console.log(`Brand catalog synchronized: ${result.products} products in ${result.brands} brands.`);
}

