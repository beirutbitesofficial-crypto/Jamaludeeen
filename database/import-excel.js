/**
 * Import products from TAHA.xlsx
 * - Brand = column C ("Category Name*")
 * - Product name = column B ("Name*")
 * - Price = column D ("Price 1") in USD → converted to LBP at 90,000/USD
 * - Category (men/women/unisex) auto-detected from product name keywords
 * - Replaces ALL existing products and brands
 */

const path = require('path');
const XLSX  = require('xlsx');
const db    = require('./db');

const RATE     = 90000; // LBP per $1
const XLSX_FILE = path.join(__dirname, '..', 'TAHA.xlsx');

// ── Category detection ─────────────────────────────────────────────────────
const WOMEN_RE = /\b(FOR HER|POUR FEMME|WOMEN|WOMAN|FEMME|LADIES|LADY|HER CONFESSION)\b|(\bHER\b)/i;
const MEN_RE   = /\b(FOR HIM|POUR HOMME|FOR MEN|FOR MAN|HOMME|MASCULIN|HIS CONFESSION)\b|(\bHIM\b|\bMAN\b|\bMEN\b)/i;

function detectCategory(name) {
  if (WOMEN_RE.test(name)) return 'women';
  if (MEN_RE.test(name))   return 'men';
  return 'unisex';
}

// ── Khaleeji brand list ────────────────────────────────────────────────────
const KHALEEJI = new Set([
  'LATTAFA', 'LATTAFA PRIDE', 'RASASI', 'ARD AL ZAAFARAN TRADING',
  'ASDAAF', 'MAISON ALHAMBRA', 'AFNAN', 'FRAGRANCE WORLD',
  'RIFFS', 'SHAYKH ALKAR', 'AJMAL', 'ARABIAN OUD',
]);

// ── Read Excel ─────────────────────────────────────────────────────────────
const wb   = XLSX.readFile(XLSX_FILE);
const ws   = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header

// Filter out empty rows
const valid = rows.filter(r => r[1] && r[2] && r[3] !== undefined && r[3] !== '');

console.log(`Read ${valid.length} valid rows from Excel`);

// ── Wipe existing data ─────────────────────────────────────────────────────
db.prepare('DELETE FROM order_items').run();
db.prepare('DELETE FROM orders').run();
db.prepare('DELETE FROM products').run();
db.prepare('DELETE FROM brands').run();
console.log('Cleared existing products, brands, orders');

// ── Insert brands & products ───────────────────────────────────────────────
const insertBrand = db.prepare(`
  INSERT OR IGNORE INTO brands (name, type) VALUES (?, ?)
`);

const insertProduct = db.prepare(`
  INSERT INTO products (name_en, name_ar, brand, category, price, in_stock, featured)
  VALUES (?, '', ?, ?, ?, 1, 0)
`);

let inserted = 0;
let skipped  = 0;
const categoryCount = { men: 0, women: 0, unisex: 0 };

const importAll = db.transaction(() => {
  for (const row of valid) {
    const name     = String(row[1]).trim();
    const brand    = String(row[2]).trim();
    const priceUsd = parseFloat(row[3]);

    if (!name || !brand || isNaN(priceUsd)) { skipped++; continue; }

    // Price: USD → LBP, round to nearest 1,000
    const priceLBP = Math.round(priceUsd * RATE / 1000) * 1000;

    const category = detectCategory(name);
    const type     = KHALEEJI.has(brand.toUpperCase()) ? 'khaleeji' : 'western';

    insertBrand.run(brand, type);

    insertProduct.run(name, brand, category, priceLBP);
    categoryCount[category]++;
    inserted++;
  }
});

importAll();

console.log(`\n✓ Imported ${inserted} products (${skipped} skipped)`);
console.log(`  Men:    ${categoryCount.men}`);
console.log(`  Women:  ${categoryCount.women}`);
console.log(`  Unisex: ${categoryCount.unisex}`);

// Show unique brands imported
const brands = db.prepare('SELECT name, type FROM brands ORDER BY name').all();
console.log(`\n✓ ${brands.length} brands:`);
brands.forEach(b => console.log(`  [${b.type}] ${b.name}`));
