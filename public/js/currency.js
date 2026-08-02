// ── Currency Toggle (LBP ↔ USD) ───────────────────────────────────────────────
(function () {
  const KEY = 'jm_currency';
  const btn = document.getElementById('currencyToggle');
  const rate = btn ? parseFloat(btn.dataset.rate) || 89500 : 89500;

  function get()       { return localStorage.getItem(KEY) || 'LBP'; }
  function set(c)      { localStorage.setItem(KEY, c); }

  function fmtLBP(n)   { return n.toLocaleString() + ' LBP'; }
  function fmtUSD(n)   { return '$' + (n / rate).toFixed(0); }
  function fmt(n)      { return get() === 'USD' ? fmtUSD(n) : fmtLBP(n); }

  window.currencyFmt = fmt; // expose for wishlist page

  function applyAll() {
    const cur = get();
    // All static price elements
    document.querySelectorAll('[data-lbp]').forEach(el => {
      const lbp = parseFloat(el.dataset.lbp);
      if (!isNaN(lbp) && lbp > 0) el.textContent = fmt(lbp);
    });
    // Toggle button label
    const label = document.getElementById('currencyLabel');
    if (label) label.textContent = cur;
    if (btn) btn.classList.toggle('active', cur === 'USD');
    // Show/hide LBP vs USD hint
    document.querySelectorAll('.currency-hint').forEach(el => {
      el.textContent = cur === 'USD' ? '(prices in USD, rate: ' + rate.toLocaleString() + ' LBP/$)' : '';
    });
  }

  if (btn) {
    btn.addEventListener('click', () => {
      set(get() === 'USD' ? 'LBP' : 'USD');
      applyAll();
    });
  }

  document.addEventListener('DOMContentLoaded', applyAll);
})();
