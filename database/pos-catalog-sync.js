/**
 * Brand-catalog corrections taken from the shop's POS price list (October 2026).
 * POS prices are in USD; brand products are stored in LBP, so each price is
 * converted with the store exchange rate at the time the sync runs.
 *
 * PRICE_UPDATES: [brand, website product name, USD]
 * ADDITIONS:     [brand, product name, USD] — inserted only when missing.
 */

const PRICE_UPDATES = [
  ['LATTAFA', '24 QIRAT PURE GOLD', 22],
  ['LATTAFA', '24 QIRAT WHITE GOLD', 22],
  ['LATTAFA', 'ANGHAM', 35],
  ['LATTAFA', 'BADEE AL OUD OUD FOR GLORY -BLACK', 30],
  ['LATTAFA', 'BADEE AL OUD SUBLIME-RED', 30],
  ['LATTAFA', 'ECLAIRE', 32],
  ['LATTAFA', 'ECLAIRE BANOFFI', 32],
  ['LATTAFA', 'ECLAIRE PISTACHE', 32],
  ['LATTAFA', 'EJAAZI', 20],
  ['LATTAFA', 'EMAAN', 30],
  ['LATTAFA', 'FAKHAR LATTAFA WHITE', 27],
  ['LATTAFA', 'KHALIS MUSK-PURE MUSK', 20],
  ['LATTAFA', 'KHALIS OUD-PURE OUDI', 20],
  ['LATTAFA', 'MAYAR CHERRY INTENSE-RED', 27],
  ['LATTAFA', 'MAYAR NATURAT INTENSE-BLUE', 27],
  ['LATTAFA', 'MAYAR PINK', 27],
  ['LATTAFA', 'QAED AL FORSAN UNLIMITED -WHITE', 20],
  ['LATTAFA', 'QAED AL FORSAN-BLACK', 20],
  ['LATTAFA', 'QAED AL FURSAN UNTAMED-GOLD', 20],
  ['LATTAFA', 'QIMMAH WOMEN', 20],
  ['LATTAFA', 'QUIMMA MAN', 20],
  ['LATTAFA', 'RAGHBA FOR MAN-BLACK', 20],
  ['LATTAFA', 'RAGHBA-GOLD', 20],
  ['LATTAFA', 'RAMZ LATTAFA-GOLD', 20],
  ['LATTAFA', 'WASHWASHAH', 20],
  ['AFNAN', '9 AM DIVE', 52],
  ['AFNAN', '9 AM POUR FEMME', 47],
  ['AFNAN', '9 PM', 52],
  ['AFNAN', '9 PM NIGHT OUT', 52],
  ['AFNAN', '9 PM REBEL', 52],
  ['AFNAN', '9PM ELIXIR', 52],
  ['AFNAN', 'HISTORIC OLMEDA', 49],
  ['AFNAN', 'HISTORIC SAHARA', 49],
  ['AFNAN', 'VIOLET BOUQUET', 54],
  ['FRAGRANCE WORLD', 'BAVARIA MAN INTENSE', 20],
  ['FRAGRANCE WORLD', 'DECOSTA NOIR-20', 20],
  ['FRAGRANCE WORLD', "FU L'UOMO THE NIGHT EDITION", 20],
  ['FRAGRANCE WORLD', 'RAGE BLACK FOR MAN', 20],
  ['RIFFS', 'BLUE ABSOLU', 20],
  ['TUBBEES', 'BERRY BLAST', 11],
  ['TUBBEES', 'COTTON CANDY', 11],
  ['TUBBEES', 'DREAMY TREATS', 11],
  ['TUBBEES', 'MIST BERRY EXPLOSION', 4],
  ['TUBBEES', 'MIST GOLDEN PRALINE BLISS', 4],
];

const ADDITIONS = [
  ['LATTAFA', 'ANGHAM SECOND SONG', 35],
  ['LATTAFA', 'DEO ANGHAM', 2.5],
  ['LATTAFA', 'DEO ECLAIRE', 2.5],
  ['LATTAFA', 'DEO MAYAR PINK', 2.5],
  ['RASASI', 'DAAREJ EXTRAIT', 27],
  ['RASASI', 'DAAREJ PASSIONE', 27],
  ['JAMALUDEEN', 'HOME SPRAY COTTON FLOWERS', 5],
  ['JAMALUDEEN', 'HOME SPRAY MANGO & PAPAYA', 5],
  ['JAMALUDEEN', 'HOME SPRAY MEDINA', 5],
  ['JAMALUDEEN', 'HOME SPRAY WISAL', 5],
];

function synchronizePosCatalog(db, rate) {
  const toLbp = usd => Math.round(usd * rate / 1000) * 1000;
  const update = db.prepare(`
    UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP
    WHERE type = 'brand' AND UPPER(TRIM(brand)) = ? AND UPPER(TRIM(name_en)) = ?
  `);
  const exists = db.prepare(`
    SELECT 1 FROM products WHERE type = 'brand' AND UPPER(TRIM(brand)) = ? AND UPPER(TRIM(name_en)) = ?
  `);
  const brandRow = db.prepare(`SELECT id, name FROM brands WHERE UPPER(TRIM(name)) = ?`);
  const categoryRow = db.prepare(`SELECT id FROM brand_categories WHERE brand_id = ? ORDER BY sort_order, id LIMIT 1`);
  const insert = db.prepare(`
    INSERT INTO products
      (name_en, name_ar, brand, category, type, price, image_path,
       description_en, description_ar, brand_category_id, in_stock, featured)
    VALUES (?, '', ?, 'unisex', 'brand', ?, NULL, '', '', ?, 1, 0)
  `);

  let updated = 0, added = 0;
  const missing = [];
  db.transaction(() => {
    for (const [brand, name, usd] of PRICE_UPDATES) {
      const changes = update.run(toLbp(usd), brand, name).changes;
      if (changes) updated += changes; else missing.push(`${brand} / ${name}`);
    }
    for (const [brand, name, usd] of ADDITIONS) {
      if (exists.get(brand, name)) continue;
      const b = brandRow.get(brand);
      if (!b) { missing.push(`${brand} (brand) / ${name}`); continue; }
      const category = categoryRow.get(b.id);
      insert.run(name, b.name.trim(), toLbp(usd), category ? category.id : null);
      added++;
    }
  })();
  return { updated, added, missing };
}

module.exports = { PRICE_UPDATES, ADDITIONS, synchronizePosCatalog };
