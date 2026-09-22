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
  const sharedPrice = parsePrice(settings[`local_price_${category}`]);
  const basePrice = parsePrice(product.price);
  const price50 = parsePrice(product.price_50ml) ?? sharedPrice ?? basePrice;
  const price100 = parsePrice(product.price_100ml) ?? sharedPrice ?? basePrice;

  return {
    ...product,
    image_path: sharedImage || product.image_path || null,
    price: price50,
    price_50ml: price50,
    price_100ml: price100,
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
