// New brand items from the owner's photos. Each is added once, at the price of an
// existing sibling listing (`ref`) as a default; the owner sets real prices in the admin.
const BRAND_ADDITIONS = [
  { brand: 'RASASI', name: 'HAWAS ELIXIR', name_ar: 'هوس إليكسير', image: '/images/brands/rasasi/hawas-elixir.webp', ref: 'HAWAS FOR HIM' },
  { brand: 'RASASI', name: 'HAWAS KOBRA', name_ar: 'هوس كوبرا', image: '/images/brands/rasasi/hawas-kobra.webp', ref: 'HAWAS FOR HIM' },
  { brand: 'RASASI', name: 'DAAREJ PASSIONE POUR FEMME', name_ar: 'دارج باسيوني للنساء', image: '/images/brands/rasasi/daarej-passione-pour-femme.webp', ref: 'DAAREJ POUR FEMME' },
  { brand: 'RASASI', name: 'HAWAS PINK', name_ar: 'هوس بينك', image: '/images/brands/rasasi/hawas-pink.webp', ref: 'HAWAS FOR HER' },
  { brand: 'RASASI', name: 'DAAREJ EXTRAIT POUR HOMME', name_ar: 'دارج إكستريت للرجال', image: '/images/brands/rasasi/daarej-extrait-pour-homme.webp', ref: 'DAAREJ POUR HOMME' },
];

function addBrandItems(db, items = BRAND_ADDITIONS) {
  const brandRow = db.prepare(`SELECT id, name FROM brands WHERE UPPER(TRIM(name)) = ?`);
  const lineOf = db.prepare(`SELECT id FROM brand_categories WHERE brand_id = ? ORDER BY sort_order, id LIMIT 1`);
  const exists = db.prepare(`SELECT 1 FROM products WHERE type = 'brand' AND UPPER(TRIM(brand)) = ? AND UPPER(TRIM(name_en)) = ?`);
  const refPrice = db.prepare(`SELECT price FROM products WHERE type = 'brand' AND UPPER(TRIM(brand)) = ? AND UPPER(TRIM(name_en)) = ?`);
  const insert = db.prepare(`
    INSERT INTO products
      (name_en, name_ar, brand, category, type, price, image_path,
       description_en, description_ar, brand_category_id, in_stock, featured)
    VALUES (?, ?, ?, 'unisex', 'brand', ?, ?, '', '', ?, 1, 0)
  `);
  let added = 0;
  for (const item of items) {
    const brand = brandRow.get(item.brand);
    if (!brand || exists.get(item.brand, item.name)) continue;
    const ref = item.ref ? refPrice.get(item.brand, item.ref) : null;
    const line = lineOf.get(brand.id);
    insert.run(item.name, item.name_ar || '', brand.name.trim(), ref ? ref.price : null, item.image, line ? line.id : null);
    added++;
  }
  return added;
}

module.exports = { BRAND_ADDITIONS, addBrandItems };
