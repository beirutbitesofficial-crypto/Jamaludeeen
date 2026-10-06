/**
 * Brand-catalog corrections taken from the shop's POS price list (October 2026).
 * POS prices are in USD; brand products are stored in LBP, so each price is
 * converted with the store exchange rate at the time the sync runs.
 *
 * PRICE_UPDATES: [brand, website product name, USD]
 * ADDITIONS:     [brand, product name, USD, Arabic name?] — inserted only when missing.
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
  // Third batch
  ['RIFFS', 'MYSTERE WOMEN', 20],
  ['LATTAFA', 'NAJDIA', 20],
  ['LATTAFA', 'NAJDIA INTENSE', 20],
  ['LATTAFA', 'NAJDIA TRIBUTE', 20],
  ['ASDAAF', 'AMEER AL ARAB -BLACK', 22],
  ['ASDAAF', 'AMEER AL ARAD IMPERIUM -BLUE', 22],
  ['ASDAAF', 'AMEERAT AL ARAB PRIVE ROSE-PINK', 22],
  ['ASDAAF', 'AMEERAT AL ARAB -RED', 22],
  ['LATTAFA', 'AMEER AL OUDH INTENSE OUD', 26],
  ['LATTAFA', 'ANA AL ABIYEDH-WHITE', 20],
  ['LATTAFA', 'ANA AL ABYAD CORAL', 20],
  ['LATTAFA', 'ANA AL ABIYEDH POUDREE', 20],
  ['LATTAFA', 'ANA AL ABYAD ROUGE', 20],
  ['LATTAFA', 'ANA AL ABYAD SARLET', 20],
  ['LATTAFA', 'CONFIDENTIAL PLATINUM', 20],
  ['LATTAFA', 'AL NOBLE', 24],
  ['LATTAFA', 'AL QIAM-SILVER', 37],
  ['LATTAFA', 'SAKEENA', 30],
  ['LATTAFA', 'LIAM -BLACK', 27],
  ['LATTAFA', 'LIAM BLUE SHINE-BLUE', 27],
  ['LATTAFA', 'OUD 24 HOURS MAJESTIC', 20],
  ['LATTAFA', 'OUD NAJDIA', 20],
  ['LATTAFA', 'SHEIKH AL SHUYUKH FINAL EDITION-BLACK', 20],
  ['LATTAFA', 'SHEIKH AL SHUYUKH LUXE EDITION-GOLG', 20],
  ['LATTAFA', 'SHEIKH AL SHUYUKH SUPREME-BLUE', 20],
  ['LATTAFA PRIDE', 'HAPPY BRUSH', 20],
  ['LATTAFA PRIDE', 'HAPPY TIME', 20],
  ['ARD AL ZAAFARAN TRADING', 'HAREEM AL SULTAN', 20],
  ['ARD AL ZAAFARAN TRADING', 'SHAMS AL EMARAT KHUSUSI', 20],
  ['AFNAN', 'CHERRY BOUQUET', 54],
  ['AFNAN', 'ORNAMENT PURPLE ALLURE', 47],
  ['AFNAN', 'SUPREMACY POUR FEMME', 49],
  ['AFNAN', 'SUPREMACY POUR HOMME', 62],
  ['AFNAN', 'TURATHI ELECTRIC', 49],
  ['FRAGRANCE WORLD', 'CLASSY CHIC GIRL', 20],
  ['TUBBEES', 'CHERRY LUXE', 11],
  ['TUBBEES', 'CHOCOLATE FUDGE', 11],
  ['TUBBEES', 'COOKIES & CREAM', 11],
  ['TUBBEES', 'STRAWBERRY CHEESECAKE', 11],
  ['TUBBEES', 'SWEET CARAMEL', 11],
  ['TUBBEES', 'UNICORN VANILLA', 11],
  ['TUBBEES', 'JAR BLUEBERRY SORBET', 12],
  ['TUBBEES', 'JAR MATCHA MADE IN HEAVEN', 12],
  ['TUBBEES', 'JAR PASSION FRUIT MOJITO', 12],
  ['TUBBEES', 'JAR SWEET MANGO MELODY', 12],
  ['TUBBEES', 'JAR TIRA-MISS-YOU', 12],
  ['TUBBEES', 'JAR TRES LECHES', 12],
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
  // Second batch — houses confirmed by web search; anything unconfirmed goes to OTHER.
  ['LATTAFA', 'MIST FAKHAR LATTAFA PINK', 8],
  ['LATTAFA', 'MISHLAH', 30],
  ['LATTAFA', 'MALLOW MADNESS', 30],
  ['MAISON ALHAMBRA', 'MEGARA', 35],
  ['FRAGRANCE WORLD', 'MEMORIES', 22],
  ['ASSAF', 'FRANKEL BLACK ELIXIR', 65],
  ['ASSAF', 'WILD COLT ELIXIR', 55],
  ['ASSAF', 'ARROGATE PINK', 55],
  ['BORN IN FRANCE', 'FLOWER KISS', 22],
  ['BORN IN FRANCE', 'BARRÓN', 22],
  ['BORN IN FRANCE', 'IRIS OUD', 22],
  ['REYANE TRADITION', 'ELSATYS DEDICATION', 24],
  ['REYANE TRADITION', 'VIVRE ELSATYS', 24],
  ['OTHER', 'VICTORIUS MEN', 20],
  ['OTHER', 'VICTORIUS WOMEN', 20],
  ['OTHER', 'AROMA DIFFUSER WOOD', 25, 'فواحة عطرية خشب'],
  ['OTHER', 'AROMA DIFFUSER BLACK', 25, 'فواحة عطرية سوداء'],
  ['OTHER', 'AROMA DIFFUSER SMALL', 15, 'فواحة عطرية صغيرة'],
  ['OTHER', 'WATERFALL INCENSE BURNER', 12, 'مباخر شلال'],
  ['OTHER', 'WATERFALL INCENSE BURNER LARGE', 14, 'مباخر شلال كبير'],
  ['OTHER', 'CHARCOAL BURNER', 12, 'مبخرة الفحم'],
  ['OTHER', 'CHARCOAL BURNER LARGE', 15, 'مبخرة عالفحم'],
  ['OTHER', 'GOLD INCENSE BURNER', 10, 'مبخرة ذهبية'],
  ['OTHER', 'SILVER INCENSE BURNER', 12, 'مبخرة فضية'],
  ['OTHER', 'CANDLE BURNER', 3, 'مبخرة شمع'],
  ['OTHER', 'MUSK AL TAHARA SOAP', 3.15, 'صابون مسك الطهارة'],
  ['OTHER', 'GARDENIA', 1],
  ['OTHER', 'VIOLET', 1],
  ['OTHER', 'WISAL', 2],
  ['OTHER', 'DAMASCUS JASMINE', 2],
  ['OTHER', 'DOVE', 2],
  // Third batch
  ['LATTAFA', 'ATHEERI', 35],
  ['LATTAFA', 'AL DUR AL MAKNOON', 22],
  ['LATTAFA', 'AL QIAM GOLD', 37],
  ['LATTAFA', 'VANILLA FREAK', 30],
  ['ASDAAF', 'ANDALEEB', 24],
  ['RASASI', 'HAWAS ELIXIR', 47],
  ['BORN IN FRANCE', 'MÉTÉORITE', 22],
  ['BORN IN FRANCE', 'U BEAST', 22],
  ['BORN IN FRANCE', 'OSLO BLUE', 22],
  ['LATTAFA', 'DEO AMEERAT AL ARAB PRIVE ROSE', 2.5],
  ['LATTAFA', 'DEO AMEERAT AL ARAB RED', 2.5],
  ['LATTAFA', 'DEO ANA AL ABIYEDH WHITE', 2.5],
  ['LATTAFA', 'DEO ANA AL ABYAD POUDREE', 2.5],
  ['LATTAFA', 'DEO ANA AL ABYAD ROUGE', 2.5],
  ['LATTAFA', 'DEO ART OF UNIVERSE', 2.5],
  ['LATTAFA', 'DEO ASAD BOURBON', 2.5],
  ['LATTAFA', 'DEO SHAHD', 2.5],
  ['JAMALUDEEN', 'HOME SPRAY AL SULTAN', 5],
  ['JAMALUDEEN', 'HOME SPRAY LEMON', 5],
  ['JAMALUDEEN', 'HOME SPRAY LILAC', 5],
  ['JAMALUDEEN', 'HOME SPRAY LOTUS', 5],
  ['JAMALUDEEN', 'HOME SPRAY MUSK SULTAN', 5],
  ['JAMALUDEEN', 'HOME SPRAY MUSKMELON', 5],
  ['JAMALUDEEN', 'HOME SPRAY OUD & AMBAR', 5],
  ['JAMALUDEEN', 'HOME SPRAY RUBY RUSH', 5],
  ['JAMALUDEEN', 'HOME SPRAY TUTTI FRUTTI', 5],
  ['OTHER', 'CLEAN ALL', 18],
  ['OTHER', 'AL HARAM GOLD', 2],
  ['OTHER', 'JASMINE', 2],
  ['OTHER', 'LAVENDER', 2],
  ['OTHER', 'LILAC', 2],
  ['OTHER', 'OUD & AMBER', 2],
  ['OTHER', 'SULTAN', 2],
  ['OTHER', 'SULTAN MUSK', 2],
  ['OTHER', 'VANILLA', 2],
  ['OTHER', 'SAFFRON', 1],
  ['OTHER', 'OUD SAFFRON', 1],
];

// Houses that may not exist yet in the brands table.
const NEW_BRANDS = { 'ASSAF': 'khaleeji', 'BORN IN FRANCE': 'western', 'REYANE TRADITION': 'western', 'OTHER': 'western' };

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
    VALUES (?, ?, ?, 'unisex', 'brand', ?, NULL, '', '', ?, 1, 0)
  `);
  const insertBrand = db.prepare(`INSERT INTO brands (name, type) VALUES (?, ?)`);
  const insertCategory = db.prepare(`INSERT INTO brand_categories (brand_id, name_en, name_ar, sort_order) VALUES (?, ?, '', 0)`);

  let updated = 0, added = 0;
  const missing = [];
  db.transaction(() => {
    for (const [brand, name, usd] of PRICE_UPDATES) {
      const changes = update.run(toLbp(usd), brand, name).changes;
      if (changes) updated += changes; else missing.push(`${brand} / ${name}`);
    }
    for (const [brand, name, usd, nameAr] of ADDITIONS) {
      if (exists.get(brand, name)) continue;
      let b = brandRow.get(brand);
      if (!b && NEW_BRANDS[brand]) {
        const id = Number(insertBrand.run(brand, NEW_BRANDS[brand]).lastInsertRowid);
        insertCategory.run(id, brand);
        b = { id, name: brand };
      }
      if (!b) { missing.push(`${brand} (brand) / ${name}`); continue; }
      const category = categoryRow.get(b.id);
      insert.run(name, nameAr || '', b.name.trim(), toLbp(usd), category ? category.id : null);
      added++;
    }
  })();
  return { updated, added, missing };
}

module.exports = { PRICE_UPDATES, ADDITIONS, synchronizePosCatalog };
