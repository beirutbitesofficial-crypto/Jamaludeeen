// Shared cart pricing. Local refill perfumes are priced in USD, brand products in LBP.
// A cart is shown in USD only when every item is a local refill; otherwise every
// line is converted to LBP so the subtotal never adds dollars to pounds.

const DEFAULT_RATE = 89500;
const STORE_WHATSAPP = '96176927146';

function exchangeRate(settings = {}) {
  const rate = parseFloat(settings.usd_rate || settings.system_exchange_rate);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE;
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

// Mutates nothing: returns items with `price` expressed in the cart currency.
function priceCart(items, settings = {}) {
  const rate = exchangeRate(settings);
  const currency = items.length && items.every(i => i.type === 'local') ? 'USD' : 'LBP';
  const priced = items.map(item => {
    const base = Number(item.price || 0);
    const price = currency === 'LBP' && item.type === 'local' ? Math.round(base * rate) : base;
    return { ...item, price };
  });
  const feeLbp = Math.max(0, parseFloat(settings.delivery_fee || 0) || 0);
  const deliveryFee = currency === 'USD' ? roundUsd(feeLbp / rate) : feeLbp;
  const subtotal = priced.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);
  return { items: priced, currency, rate, subtotal, deliveryFee, total };
}

function formatMoney(amount, currency) {
  const value = Number(amount || 0);
  return currency === 'USD'
    ? `$${value.toFixed(2).replace(/\.00$/, '')}`
    : `${Math.round(value).toLocaleString('en-US')} LBP`;
}

// wa.me needs the full international number without "+" or a leading 0.
function whatsappNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return STORE_WHATSAPP;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('961')) return digits;
  return '961' + digits.replace(/^0+/, '');
}

module.exports = { exchangeRate, priceCart, formatMoney, whatsappNumber, STORE_WHATSAPP };
