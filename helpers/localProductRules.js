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

  return {
    ...product,
    image_path: sharedImage || product.image_path || null,
    price: sharedPrice !== null ? sharedPrice : product.price,
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
