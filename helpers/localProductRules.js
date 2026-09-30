function parsePrice(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = parseFloat(value);
  return !Number.isNaN(n) && n >= 0 ? n : null;
}

function getSettingsMap(db) {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function applyLocalRulesToProduct(product, settings = {}) {
  if (!product) return product;
  if (product.type !== 'local') return product;

  const category = product.category;
  const sharedImage = settings[`${category}_image`];

  // Jamaludeen refill perfumes use one fixed USD price list everywhere.
  const price50 = 7;
  const price100 = 13;

  return {
    ...product,
    // A product's own photo wins; the category image is only a fallback.
    image_path: product.image_path || sharedImage || null,
    price: price50,
    price_50ml: price50,
    price_100ml: price100,
    currency: 'USD',
  };
}

function applyLocalRulesToProducts(products, settings = {}) {
  return (products || []).map(p => applyLocalRulesToProduct(p, settings));
}

module.exports = {
  getSettingsMap,
  applyLocalRulesToProduct,
  applyLocalRulesToProducts,
};
