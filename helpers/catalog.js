// One catalog structure shared by the website, the Store System (POS) and the admin.
// Sections mirror the website navigation: Men, Women, Unisex (signature refills) and Brands.

const SECTIONS = [
  { key: 'men', en: 'Men', ar: 'رجال', type: 'local' },
  { key: 'women', en: 'Women', ar: 'نساء', type: 'local' },
  { key: 'unisex', en: 'Unisex', ar: 'للجنسين', type: 'local' },
  { key: 'brands', en: 'Brands', ar: 'الماركات', type: 'brand' },
];
const SECTION_KEYS = SECTIONS.map(s => s.key);

const DEFAULT_REFILL_USD = { 50: 7, 100: 13 };

function num(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Signature refill prices (USD) — one list used everywhere.
function refillPricesUsd(settings = {}) {
  return {
    50: num(settings.refill_price_50ml_usd, DEFAULT_REFILL_USD[50]),
    100: num(settings.refill_price_100ml_usd, DEFAULT_REFILL_USD[100]),
  };
}

// SQL filter for a section (and optional brand) on the products table.
function sectionWhere(section, brand) {
  const where = [];
  const params = [];
  if (['men', 'women', 'unisex'].includes(section)) {
    where.push("type = 'local'", 'category = ?');
    params.push(section);
  } else if (section === 'brands') {
    where.push("type = 'brand'");
    if (brand) { where.push('brand = ?'); params.push(brand); }
  }
  return { where, params };
}

function sectionOf(product) {
  return product && product.type === 'brand' ? 'brands' : product && product.category;
}

function sectionCounts(db) {
  const counts = Object.fromEntries(SECTION_KEYS.map(k => [k, 0]));
  db.prepare("SELECT category, COUNT(*) c FROM products WHERE type='local' GROUP BY category").all()
    .forEach(r => { if (r.category in counts) counts[r.category] = r.c; });
  counts.brands = db.prepare("SELECT COUNT(*) c FROM products WHERE type='brand'").get().c;
  return counts;
}

function brandList(db) {
  return db.prepare(`
    SELECT b.id, b.name, b.name_ar, COUNT(p.id) AS count
    FROM brands b LEFT JOIN products p ON p.type = 'brand' AND p.brand = b.name
    GROUP BY b.id ORDER BY b.name
  `).all();
}

module.exports = { SECTIONS, SECTION_KEYS, refillPricesUsd, sectionWhere, sectionOf, sectionCounts, brandList };
