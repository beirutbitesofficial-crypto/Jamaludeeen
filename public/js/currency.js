// ── Currency Toggle (LBP ↔ USD) for LBP-priced brand products ─────────────────
(function () {
  const KEY = 'jm_currency';
  const btn = document.getElementById('currencyToggle');
  const rate = btn ? parseFloat(btn.dataset.rate) || 89500 : 89500;

  function get() { try { return localStorage.getItem(KEY) === 'USD' ? 'USD' : 'LBP'; } catch (_) { return 'LBP'; } }
  function set(c) { try { localStorage.setItem(KEY, c); } catch (_) {} }

  function fmtLBP(n) { return Math.round(n).toLocaleString('en-US') + ' LBP'; }
  function fmtUSD(n) { const v = n / rate; return '$' + (v >= 100 ? Math.round(v) : v.toFixed(2).replace(/\.00$/, '')); }
  function fmt(n) { return get() === 'USD' ? fmtUSD(n) : fmtLBP(n); }

  window.currencyFmt = fmt;

  function applyAll() {
    const cur = get();
    document.querySelectorAll('[data-lbp]').forEach(el => {
      const lbp = parseFloat(el.dataset.lbp);
      if (!isNaN(lbp) && lbp > 0) el.textContent = fmt(lbp);
    });
    const label = document.getElementById('currencyLabel');
    if (label) label.textContent = cur;
    if (btn) btn.classList.toggle('is-active', cur === 'USD');
  }

  if (btn) btn.addEventListener('click', () => { set(get() === 'USD' ? 'LBP' : 'USD'); applyAll(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAll);
  else applyAll();
})();
