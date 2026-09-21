function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSize(product, sizeMl) {
  if (!product || product.type !== 'local') return null;
  const size = parseInt(sizeMl, 10);
  if (![50, 100].includes(size)) {
    throw new Error(`Choose 50ml or 100ml for ${product.name_en || 'this perfume'}.`);
  }
  return size;
}

function salePrice(product, sizeMl) {
  if (!product) return 0;
  if (product.type !== 'local') return Math.max(0, num(product.price));
  const size = normalizeSize(product, sizeMl);
  const sized = size === 100 ? product.price_100ml : product.price_50ml;
  return Math.max(0, num(sized, num(product.price)));
}

function saleUnitCost(product, sizeMl) {
  if (!product) return 0;
  if (product.type !== 'local') return Math.max(0, num(product.cost_price));
  const size = normalizeSize(product, sizeMl);
  const direct = size === 100 ? product.cost_100ml : product.cost_50ml;
  if (direct !== null && direct !== undefined && String(direct) !== '') return Math.max(0, num(direct));
  return Math.max(0, num(product.cost_price)) * size;
}

function stockDeduction(product, quantity, sizeMl) {
  const qty = num(quantity);
  if (qty <= 0) throw new Error('Quantity must be positive.');
  if (!product || !product.track_stock) return 0;
  if (product.type === 'local') return normalizeSize(product, sizeMl) * qty;
  return qty;
}

function stockLabel(product) {
  return product && product.type === 'local' ? 'ml' : 'units';
}

module.exports = { normalizeSize, salePrice, saleUnitCost, stockDeduction, stockLabel };
