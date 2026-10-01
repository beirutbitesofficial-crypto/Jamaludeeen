(() => {
  const SYS = window.SYS || { user: { role: 'cashier' }, rate: 89500, refill: { 50: 7, 100: 13 }, lang: 'en', T: {} };
  const t = k => SYS.T[k] || k;
  const isMgr = ['owner', 'manager'].includes(SYS.user.role);
  let rate = Number(SYS.rate || 89500);
  let cart = [];
  let payMethod = 'cash_lbp';
  let purchaseCart = [];
  let pendingSize = null;
  const productCache = new Map();

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lbp = n => Math.round(Number(n || 0)).toLocaleString('en-US') + ' LBP';
  const usd = n => '$' + Number(n || 0).toFixed(2).replace(/\.00$/, '');
  const locale = SYS.lang === 'ar' ? 'ar-LB' : 'en-GB';
  const when = d => d ? new Date(String(d).replace(' ', 'T') + (/Z|\+/.test(d) ? '' : 'Z')).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const payLabel = m => t(m) || m;
  const statusPill = s => `<span class="pill ${s === 'completed' ? 'pill--green' : 'pill--red'}">${esc(t('s_' + s))}</span>`;
  const empty = (msg, cols) => cols ? `<tr><td colspan="${cols}" class="empty">${esc(msg)}</td></tr>` : `<div class="empty-block"><p>${esc(msg)}</p></div>`;
  const icon = name => {
    const P = {
      plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
      edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>', print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
      refund: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    };
    return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
  };

  function toast(message, error = false) {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.className = 'toast show' + (error ? ' error' : '');
    clearTimeout(el._t); el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }
  async function api(url, options = {}) {
    const opts = { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } };
    if (opts.body && typeof opts.body !== 'string') { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
    const res = await fetch(url, opts);
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (res.status === 401) { location.href = '/system/login'; throw new Error(data.error || 'Login required'); }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ── Shell: sidebar, modals, tabs ─────────────────────────────
  const side = $('#boSide'), scrim = $('#boScrim');
  const setMenu = open => { side?.classList.toggle('open', open); scrim?.classList.toggle('open', open && true); };
  $('#boBurger')?.addEventListener('click', () => setMenu(!side.classList.contains('open')));
  scrim?.addEventListener('click', () => { setMenu(false); setCart(false); });
  const openModal = id => $('#' + id)?.classList.add('open');
  const closeModal = id => $('#' + id)?.classList.remove('open');
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('open'); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $$('.modal.open').forEach(m => m.classList.remove('open')); setMenu(false); setCart(false); } });

  const TAB_KEY = 'jm_sys_tab';
  const tabTitle = { online: 'online_orders', dashboard: 'dashboard', pos: 'pos', inventory: 'inventory', sales: 'sales', customers: 'customers', purchases: 'purchases', expenses: 'expenses', reports: 'reports', team: 'team' };
  function setTab(name) {
    if (!$('#tab-' + name)) name = 'dashboard';
    $$('.sys-tab').forEach(x => x.classList.toggle('active', x.id === 'tab-' + name));
    $$('#nav [data-tab]').forEach(x => x.classList.toggle('is-active', x.dataset.tab === name));
    $('#topTitle').textContent = t(tabTitle[name]);
    setMenu(false);
    try { localStorage.setItem(TAB_KEY, name); } catch (_) {}
    ({ online: loadOnline, dashboard: loadDashboard, pos: () => { loadPos(); loadShift(); }, inventory: loadInventory, sales: loadSales, customers: loadCustomers,
       purchases: loadPurchases, expenses: loadExpenses, reports: loadReports, team: loadUsers })[name]?.();
    window.scrollTo(0, 0);
  }
  $$('#nav [data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.go)));

  // ── Section tabs + brand chips (same structure as the website) ──
  const filters = { pos: { section: 'men', brand: '' }, inv: { section: 'men', brand: '' } };
  function bindSections(id, onChange) {
    const tabs = $(`[data-sections="${id}"]`), chips = $(`[data-brands="${id}"]`);
    if (!tabs) return;
    const paint = () => {
      const f = filters[id];
      $$(`[data-sections="${id}"] [data-section]`).forEach(b => b.classList.toggle('is-active', b.dataset.section === f.section));
      chips.hidden = f.section !== 'brands';
      $$(`[data-brands="${id}"] [data-brand]`).forEach(b => b.classList.toggle('is-active', b.dataset.brand === f.brand));
    };
    tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-section]'); if (!b) return;
      filters[id] = { section: b.dataset.section, brand: '' }; paint(); onChange();
    });
    chips.addEventListener('click', e => {
      const b = e.target.closest('[data-brand]'); if (!b) return;
      filters[id].brand = b.dataset.brand; paint(); onChange();
    });
    paint();
  }

  // ── Dashboard ────────────────────────────────────────────────
  const stat = (label, value, cls = '') => `<div class="card stat ${cls}"><span class="stat__label">${esc(label)}</span><span class="stat__value num" dir="ltr">${esc(value)}</span></div>`;
  async function loadDashboard() {
    try {
      const d = await api('/system/api/dashboard');
      const s = d.today;
      $('#dashboardMetrics').innerHTML = isMgr
        ? stat(t('today_sales'), lbp(s.sales_total)) + stat(t('online_today'), lbp(d.online.total)) +
          stat(t('net_profit'), lbp(s.net_profit), s.net_profit >= 0 ? 'stat--good' : 'stat--bad') +
          `<button type="button" class="card stat ${d.online.open_orders ? 'stat--alert' : ''}" data-go-online style="text-align:start;cursor:pointer;font:inherit"><span class="stat__label">${esc(t('open_orders'))}</span><span class="stat__value num">${d.online.open_orders}</span></button>`
        : stat(t('today_sales'), lbp(s.sales_total)) + stat(t('transactions'), s.sales_count) +
          stat(t('low_stock'), d.lowStock, d.lowStock > 0 ? 'stat--alert' : '') + stat(t('catalog_items'), d.products);
      $('#recentSales').innerHTML = d.recent.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>${t('sale')}</th><th>${t('customer')}</th><th>${t('cashier')}</th><th>${t('payment')}</th><th>${t('total')}</th></tr></thead><tbody>${
          d.recent.map(s => `<tr data-sale="${s.id}" style="cursor:pointer"><td class="num" dir="ltr"><b>${esc(s.sale_number)}</b></td><td>${esc(s.customer_name || t('walk_in'))}</td><td>${esc(s.cashier_name)}</td><td>${esc(payLabel(s.payment_method))}</td><td class="num" dir="ltr"><b>${lbp(s.total)}</b></td></tr>`).join('')}</tbody></table></div>`
        : empty(t('no_sales'));
      $$('#recentSales [data-sale]').forEach(r => r.onclick = () => showSale(Number(r.dataset.sale)));
      $('[data-go-online]')?.addEventListener('click', () => setTab('online'));
      renderShift(d.shift);
    } catch (e) { toast(e.message, true); }
  }
  $('#refreshDashboard')?.addEventListener('click', loadDashboard);

  // ── Shift ────────────────────────────────────────────────────
  function renderShift(shift) {
    $('#shiftBadge').innerHTML = shift ? `<span class="pill pill--green">${t('shift_open')}</span>` : `<button type="button" class="pill pill--red" id="shiftBadgeBtn" style="border:0">${t('no_shift')}</button>`;
    $('#shiftBadgeBtn')?.addEventListener('click', () => openShiftModal(false));
    const box = $('#shiftBox'), btn = $('#shiftActionBtn');
    if (!box || !btn) return;
    if (!shift) {
      box.innerHTML = `<p class="muted">${t('no_shift_hint')}</p>`;
      btn.textContent = t('open_shift'); btn.onclick = () => openShiftModal(false);
    } else {
      box.innerHTML = `<dl class="kv"><dt>${t('opened_at')}</dt><dd>${when(shift.opened_at)}</dd><dt>${t('opening_lbp')}</dt><dd class="num" dir="ltr">${lbp(shift.opening_lbp)}</dd><dt>${t('opening_usd')}</dt><dd class="num" dir="ltr">${usd(shift.opening_usd)}</dd></dl>`;
      btn.textContent = t('close_shift'); btn.onclick = () => openShiftModal(true);
    }
  }
  async function loadShift() { try { renderShift((await api('/system/api/shift')).shift); } catch (_) {} }
  function openShiftModal(closing) {
    $('#shiftTitle').textContent = closing ? t('close_shift') : t('open_shift');
    $('#shiftModalContent').innerHTML = closing
      ? `<form id="shiftForm" class="form"><label class="field"><span>${t('counted_lbp')}</span><input name="closing_lbp" type="number" min="0" step="1000" required dir="ltr"></label><label class="field"><span>${t('counted_usd')}</span><input name="closing_usd" type="number" min="0" step="0.01" required dir="ltr"></label><label class="field"><span>${t('notes')}</span><textarea name="notes" rows="2"></textarea></label><button class="btn btn--dark btn--block">${t('close_reconcile')}</button></form>`
      : `<form id="shiftForm" class="form"><label class="field"><span>${t('opening_lbp')}</span><input name="opening_lbp" type="number" min="0" step="1000" value="0" dir="ltr"></label><label class="field"><span>${t('opening_usd')}</span><input name="opening_usd" type="number" min="0" step="0.01" value="0" dir="ltr"></label><button class="btn btn--dark btn--block">${t('open_register')}</button></form>`;
    openModal('shiftModal');
    $('#shiftForm').onsubmit = async ev => {
      ev.preventDefault();
      try {
        const r = await api('/system/api/shift/' + (closing ? 'close' : 'open'), { method: 'POST', body: Object.fromEntries(new FormData(ev.target)) });
        toast(closing ? `${t('shift_closed')} ${lbp(r.difference_lbp)} / ${usd(r.difference_usd)}` : t('shift_opened'));
        closeModal('shiftModal'); loadShift(); if ($('#tab-dashboard').classList.contains('active')) loadDashboard();
      } catch (e) { toast(e.message, true); }
    };
  }

  $('#exchangeForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const value = Number(new FormData(e.target).get('exchange_rate'));
    try {
      const r = await api('/system/api/settings/exchange-rate', { method: 'POST', body: { exchange_rate: value } });
      rate = r.exchange_rate; $('#rateLabel').textContent = Number(rate).toLocaleString('en-US');
      productCache.clear(); cart = []; renderCart();
      toast(t('exchange_saved'));
    } catch (err) { toast(err.message, true); }
  });

  // ── POS catalog ──────────────────────────────────────────────
  let posPage = 1, posQuery = '', posTimer;
  function productQuery(f, q, page, limit) {
    const p = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (q) p.set('q', q); else { p.set('section', f.section); if (f.brand) p.set('brand', f.brand); }
    return p.toString();
  }
  function priceLine(p) {
    return p.type === 'local'
      ? `<span class="pos-item__price num" dir="ltr">50 ml ${usd(p.usd_50ml)} <em>·</em> 100 ml ${usd(p.usd_100ml)}</span>`
      : `<span class="pos-item__price num" dir="ltr">${p.price ? lbp(p.price) : '—'}</span>`;
  }
  function inCart(id) { return cart.filter(x => x.product_id === id).reduce((s, x) => s + x.quantity, 0); }
  function productCard(p) {
    const out = !p.in_stock || (p.track_stock && Number(p.stock_qty) <= 0) || (p.type !== 'local' && !p.price);
    const n = inCart(p.id);
    return `<button type="button" class="pos-item" data-add="${p.id}" ${out ? 'disabled' : ''}>
      <span class="pos-item__img">${p.image_path ? `<img src="${esc(p.image_path)}" alt="" loading="lazy">` : '<span>J</span>'}</span>
      ${n ? `<span class="pos-item__qty num">${n}</span>` : ''}
      ${out ? `<span class="pos-item__badge pill pill--red">${t('unavailable')}</span>` : (p.track_stock && Number(p.stock_qty) <= Number(p.low_stock_threshold) ? `<span class="pos-item__badge pill pill--amber">${t('low_stock')}</span>` : '')}
      <span class="pos-item__body"><small>${esc(p.brand || '')}</small><strong>${esc(p.name_en)}</strong>${priceLine(p)}</span>
    </button>`;
  }
  async function loadPos(append = false) {
    const host = $('#posProducts'); if (!host) return;
    if (!append) posPage = 1;
    try {
      const d = await api('/system/api/products?' + productQuery(filters.pos, posQuery, posPage, 60));
      d.products.forEach(p => productCache.set(p.id, p));
      const html = d.products.map(productCard).join('');
      host.innerHTML = append ? host.innerHTML + html : (html || empty(t('no_results')));
      $('#posMore').hidden = posPage >= d.pages;
      return d.products;
    } catch (e) { toast(e.message, true); return []; }
  }
  $('#posProducts')?.addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) addToCart(Number(b.dataset.add)); });
  $('#posMore button')?.addEventListener('click', () => { posPage += 1; loadPos(true); });
  $('#posSearch')?.addEventListener('input', e => { clearTimeout(posTimer); posTimer = setTimeout(() => { posQuery = e.target.value.trim(); loadPos(); }, 250); });
  $('#posSearch')?.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); clearTimeout(posTimer);
    posQuery = e.target.value.trim();
    const list = await loadPos();
    const exact = list.find(p => p.barcode === posQuery || p.sku === posQuery);
    if (exact) { addToCart(exact.id); e.target.value = ''; posQuery = ''; }
  });
  bindSections('pos', () => { $('#posSearch').value = ''; posQuery = ''; loadPos(); });

  // ── Cart ─────────────────────────────────────────────────────
  function addToCart(id, size = null) {
    const p = productCache.get(id); if (!p) return;
    if (!p.in_stock || (p.track_stock && Number(p.stock_qty) <= 0)) return toast(t('unavailable'), true);
    if (p.type === 'local' && ![50, 100].includes(size)) {
      pendingSize = id;
      $('#sizeProductName').textContent = p.name_en;
      $('#size50Price').textContent = `${usd(p.usd_50ml)} · ${lbp(p.price_50ml)}`;
      $('#size100Price').textContent = `${usd(p.usd_100ml)} · ${lbp(p.price_100ml)}`;
      return openModal('sizeModal');
    }
    const sizeMl = p.type === 'local' ? size : null;
    const per = p.type === 'local' ? sizeMl : 1;
    const used = cart.filter(x => x.product_id === id).reduce((s, x) => s + x.quantity * x.per, 0);
    if (p.track_stock && used + per > Number(p.stock_qty || 0)) return toast(t('not_enough_stock'), true);
    const price = p.type === 'local' ? (sizeMl === 100 ? p.price_100ml : p.price_50ml) : Number(p.price || 0);
    const row = cart.find(x => x.product_id === id && x.size_ml === sizeMl);
    if (row) row.quantity += 1;
    else cart.push({ product_id: id, name: p.name_en, brand: p.brand, image: p.image_path, size_ml: sizeMl, price, quantity: 1, per, stock: Number(p.stock_qty || 0), tracked: !!p.track_stock });
    closeModal('sizeModal'); pendingSize = null;
    renderCart(); refreshBadges();
  }
  $$('[data-size]').forEach(b => b.addEventListener('click', () => { if (pendingSize) addToCart(pendingSize, Number(b.dataset.size)); }));
  function refreshBadges() {
    $$('#posProducts [data-add]').forEach(b => {
      const p = productCache.get(Number(b.dataset.add)); if (p) b.outerHTML = productCard(p);
    });
  }
  function totals() {
    const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
    const discount = Math.min(Math.max(0, Number($('#saleDiscount')?.value || 0)), subtotal);
    return { subtotal, discount, total: subtotal - discount };
  }
  function renderCart() {
    const host = $('#cartItems'); if (!host) return;
    host.innerHTML = cart.length ? cart.map((x, i) => `
      <div class="cart-line">
        ${x.image ? `<img class="thumb" src="${esc(x.image)}" alt="">` : '<span class="thumb thumb--empty">J</span>'}
        <div><strong>${esc(x.name)}</strong><small>${x.size_ml ? x.size_ml + ' ml · ' : ''}<span dir="ltr">${lbp(x.price)}</span></small></div>
        <div class="cart-line__end">
          <span class="num" dir="ltr">${lbp(x.price * x.quantity)}</span>
          <span class="qty"><button type="button" data-dec="${i}">${x.quantity > 1 ? icon('minus') : icon('x')}</button><b class="num">${x.quantity}</b><button type="button" data-inc="${i}">${icon('plus')}</button></span>
        </div>
      </div>`).join('') : `<div class="empty-block"><p>${t('cart_empty')}</p></div>`;
    const { subtotal, discount, total } = totals();
    let changeRow = '';
    if (payMethod === 'cash_lbp' && Number($('#tenderedLbp')?.value) > total && total > 0) changeRow = `<div class="change"><span>${t('change_due')}</span><span class="num" dir="ltr">${lbp(Number($('#tenderedLbp').value) - total)}</span></div>`;
    if (payMethod === 'cash_usd' && Number($('#tenderedUsd')?.value) > total / rate && total > 0) changeRow = `<div class="change"><span>${t('change_due')}</span><span class="num" dir="ltr">${usd(Number($('#tenderedUsd').value) - total / rate)} ≈ ${lbp(Number($('#tenderedUsd').value) * rate - total)}</span></div>`;
    $('#cartTotals').innerHTML = `<div><span>${t('subtotal')}</span><span class="num" dir="ltr">${lbp(subtotal)}</span></div>
      ${discount ? `<div><span>${t('discount')}</span><span class="num" dir="ltr">− ${lbp(discount)}</span></div>` : ''}
      <div class="grand"><span>${t('total')}</span><span class="num" dir="ltr">${lbp(total)}</span></div>
      <div><span>${t('usd_approx')}</span><span class="num" dir="ltr">${usd(total / rate)}</span></div>${changeRow}`;
    const count = cart.reduce((s, x) => s + x.quantity, 0);
    $('#cartCount').textContent = count;
    $('#cartBarCount').textContent = count;
    $('#cartBarTotal').textContent = lbp(total);
    $('#completeSale').disabled = !cart.length;
  }
  $('#cartItems')?.addEventListener('click', e => {
    const dec = e.target.closest('[data-dec]'), inc = e.target.closest('[data-inc]');
    if (dec) { const i = +dec.dataset.dec; cart[i].quantity -= 1; if (cart[i].quantity <= 0) cart.splice(i, 1); }
    if (inc) {
      const i = +inc.dataset.inc, x = cart[i];
      const used = cart.filter(y => y.product_id === x.product_id).reduce((s, y) => s + y.quantity * y.per, 0);
      if (x.tracked && used + x.per > x.stock) return toast(t('not_enough_stock'), true);
      x.quantity += 1;
    }
    if (dec || inc) { renderCart(); refreshBadges(); }
  });
  ['#saleDiscount', '#tenderedLbp', '#tenderedUsd'].forEach(s => $(s)?.addEventListener('input', renderCart));
  $('#paymentMethod')?.addEventListener('click', e => {
    const b = e.target.closest('[data-pay]'); if (!b) return;
    payMethod = b.dataset.pay;
    $$('#paymentMethod [data-pay]').forEach(x => x.classList.toggle('is-active', x === b));
    $('#tenderedLbpWrap').hidden = payMethod !== 'cash_lbp';
    $('#tenderedUsdWrap').hidden = payMethod !== 'cash_usd';
    renderCart();
  });
  $('#clearCart')?.addEventListener('click', () => { cart = []; renderCart(); refreshBadges(); });
  function setCart(open) { $('#cartPanel')?.classList.toggle('open', open); if (window.innerWidth <= 980) scrim?.classList.toggle('open', open); }
  $('#cartBar')?.addEventListener('click', () => setCart(true));
  $('#cartClose')?.addEventListener('click', () => setCart(false));

  $('#completeSale')?.addEventListener('click', async () => {
    if (!cart.length) return toast(t('cart_empty'), true);
    const { discount, total } = totals();
    let tl = Number($('#tenderedLbp').value || 0), tu = Number($('#tenderedUsd').value || 0);
    if (payMethod === 'cash_lbp' && tl <= 0) tl = total;
    if (payMethod === 'cash_usd' && tu <= 0) tu = total / rate;
    const btn = $('#completeSale'); btn.disabled = true;
    try {
      const r = await api('/system/api/sales', { method: 'POST', body: {
        items: cart.map(x => ({ product_id: x.product_id, quantity: x.quantity, size_ml: x.size_ml })),
        customer_name: $('#customerName').value, customer_phone: $('#customerPhone').value,
        discount, payment_method: payMethod,
        tendered_lbp: payMethod === 'cash_lbp' ? tl : 0, tendered_usd: payMethod === 'cash_usd' ? tu : 0,
        notes: $('#saleNotes').value,
      } });
      toast(`${t('sale_completed')} · ${r.number}`);
      cart = [];
      ['#customerName', '#customerPhone', '#tenderedLbp', '#tenderedUsd', '#saleNotes'].forEach(s => { $(s).value = ''; });
      if ($('#saleDiscount').type !== 'hidden') $('#saleDiscount').value = '0';
      renderCart(); setCart(false); loadPos();
      showSale(r.saleId);
    } catch (e) {
      toast(e.message, true);
      if (/shift|وردية/i.test(e.message)) openShiftModal(false);
    } finally { btn.disabled = !cart.length; }
  });

  // ── Sale receipt ─────────────────────────────────────────────
  async function showSale(id) {
    try {
      const { sale: s, items } = await api('/system/api/sales/' + id);
      const canRefund = isMgr && s.status === 'completed' && s.source !== 'online';
      $('#saleTitle').textContent = s.sale_number;
      $('#saleDetail').innerHTML = `<div class="receipt">
        <div class="receipt__head"><b>JAMALUDEEN</b><div class="muted">${when(s.created_at)}</div></div>
        <dl class="kv"><dt>${t('customer')}</dt><dd>${esc(s.customer_name || t('walk_in'))} <span dir="ltr">${esc(s.customer_phone || '')}</span></dd>
          <dt>${t('cashier')}</dt><dd>${esc(s.cashier_name)}</dd><dt>${t('payment')}</dt><dd>${esc(payLabel(s.payment_method))}</dd><dt>${t('status')}</dt><dd>${statusPill(s.status)}</dd></dl>
        <div class="table-wrap" style="margin:14px 0"><table class="table"><thead><tr><th>${t('product')}</th><th>${t('quantity')}</th><th>${t('price')}</th><th>${t('total')}</th></tr></thead><tbody>${
          items.map(i => `<tr><td>${esc(i.product_name)}${i.size_ml ? ' · ' + i.size_ml + ' ml' : ''}</td><td class="num">${i.quantity}</td><td class="num" dir="ltr">${lbp(i.unit_price)}</td><td class="num" dir="ltr">${lbp(i.line_total)}</td></tr>`).join('')}</tbody></table></div>
        <dl class="kv" style="max-width:340px;margin-inline-start:auto"><dt>${t('subtotal')}</dt><dd class="num" dir="ltr">${lbp(s.subtotal)}</dd>
          ${s.discount ? `<dt>${t('discount')}</dt><dd class="num" dir="ltr">− ${lbp(s.discount)}</dd>` : ''}
          <dt><b>${t('total')}</b></dt><dd class="num" dir="ltr"><b>${lbp(s.total)}</b> <span class="muted">(${usd(s.total / (s.exchange_rate || rate))})</span></dd>
          ${s.change_lbp ? `<dt>${t('change_due')}</dt><dd class="num" dir="ltr">${lbp(s.change_lbp)}</dd>` : ''}
          ${s.change_usd ? `<dt>${t('change_due')}</dt><dd class="num" dir="ltr">${usd(s.change_usd)}</dd>` : ''}</dl>
        <p class="muted" style="text-align:center;margin-top:16px">${t('receipt_thanks')}</p>
        <div class="receipt__actions"><button class="btn btn--dark" onclick="window.print()">${icon('print')}${t('print_receipt')}</button>${canRefund ? `<button class="btn btn--ghost btn--danger" id="refundSale">${icon('refund')}${t('refund_sale')}</button>` : ''}</div></div>`;
      openModal('saleModal');
      $('#refundSale')?.addEventListener('click', async () => {
        if (!confirm(t('refund_confirm'))) return;
        try { await api('/system/api/sales/' + id + '/refund', { method: 'POST', body: {} }); toast(t('sale_refunded')); closeModal('saleModal'); loadSales(); }
        catch (e) { toast(e.message, true); }
      });
    } catch (e) { toast(e.message, true); }
  }

  // ── Inventory ────────────────────────────────────────────────
  let invPage = 1, invTimer;
  async function loadInventory() {
    const host = $('#inventoryRows'); if (!host) return;
    const q = $('#inventorySearch').value.trim();
    const qs = productQuery(filters.inv, q, invPage, 60) + ($('#lowStockOnly').checked ? '&low=1' : '');
    try {
      const d = await api('/system/api/products?' + qs);
      d.products.forEach(p => productCache.set(p.id, p));
      host.innerHTML = d.products.length ? d.products.map(p => {
        const low = p.track_stock && Number(p.stock_qty) <= Number(p.low_stock_threshold);
        const unit = p.type === 'local' ? 'ml' : '';
        return `<tr>
          <td><span class="prod-cell">${p.image_path ? `<img class="thumb" src="${esc(p.image_path)}" alt="" loading="lazy">` : '<span class="thumb thumb--empty">J</span>'}<span><strong>${esc(p.name_en)}</strong><small>${esc(p.brand || '')}</small></span></span></td>
          <td class="num" dir="ltr">${p.type === 'local' ? `${usd(p.usd_50ml)} / ${usd(p.usd_100ml)}` : (p.price ? lbp(p.price) : '—')}</td>
          <td class="num" dir="ltr">${p.type === 'local' ? `${lbp(p.cost_50ml ?? Number(p.cost_price || 0) * 50)}<br><small class="muted">${lbp(p.cost_100ml ?? Number(p.cost_price || 0) * 100)}</small>` : lbp(p.cost_price)}</td>
          <td>${p.track_stock ? `<span class="pill ${low ? 'pill--red' : 'pill--green'} num" dir="ltr">${esc(p.stock_qty)} ${unit}</span>` : `<span class="muted">${t('not_tracked')}</span>`}</td>
          <td class="num" dir="ltr">${esc(p.sku || '—')}<br><small class="muted">${esc(p.barcode || '')}</small></td>
          <td class="actions"><button class="btn btn--sm" data-edit-inv="${p.id}">${icon('edit')}${t('edit')}</button></td></tr>`;
      }).join('') : empty(t('no_results'), 6);
      const pager = $('#invPager');
      pager.hidden = d.pages <= 1;
      pager.innerHTML = `<span class="num">${t('page')} ${d.page} ${t('of')} ${d.pages} · ${d.total}</span><span class="pager__links">${d.page > 1 ? `<button class="btn btn--sm" data-inv-page="${d.page - 1}">${t('prev')}</button>` : ''}${d.page < d.pages ? `<button class="btn btn--sm" data-inv-page="${d.page + 1}">${t('next')}</button>` : ''}</span>`;
    } catch (e) { toast(e.message, true); }
  }
  if ($('#inventoryRows')) {
    bindSections('inv', () => { invPage = 1; $('#inventorySearch').value = ''; loadInventory(); });
    $('#inventorySearch').addEventListener('input', () => { clearTimeout(invTimer); invTimer = setTimeout(() => { invPage = 1; loadInventory(); }, 250); });
    $('#lowStockOnly').addEventListener('change', () => { invPage = 1; loadInventory(); });
    $('#invPager').addEventListener('click', e => { const b = e.target.closest('[data-inv-page]'); if (b) { invPage = +b.dataset.invPage; loadInventory(); } });
    $('#inventoryRows').addEventListener('click', e => { const b = e.target.closest('[data-edit-inv]'); if (b) openInventory(+b.dataset.editInv); });
  }
  function openInventory(id) {
    const p = productCache.get(id); if (!p) return;
    const f = $('#inventoryForm');
    f.id.value = p.id; $('#inventoryProductName').textContent = p.name_en;
    f.price.value = p.price ?? ''; f.cost_price.value = p.cost_price ?? 0;
    f.cost_50ml.value = p.cost_50ml ?? ''; f.cost_100ml.value = p.cost_100ml ?? '';
    f.stock_qty.value = p.stock_qty ?? 0; f.low_stock_threshold.value = p.low_stock_threshold ?? 5;
    f.sku.value = p.sku || ''; f.barcode.value = p.barcode || '';
    f.track_stock.checked = !!p.track_stock; f.in_stock.checked = !!p.in_stock;
    const local = p.type === 'local';
    $$('#inventoryForm [data-brand-only]').forEach(el => { el.hidden = local; });
    $$('#inventoryForm [data-local-only]').forEach(el => { el.hidden = !local; });
    $('#inventoryUnitHint').textContent = local ? t('local_unit_hint') : t('brand_unit_hint');
    const note = $('#invRefillNote'); note.hidden = !local;
    if (local) note.querySelector('span').textContent = `${t('refill_price_pos')} 50 ml ${usd(p.usd_50ml)} · 100 ml ${usd(p.usd_100ml)}`;
    const a = $('#adjustForm'); a.id.value = p.id; a.quantity.value = ''; a.note.value = '';
    openModal('inventoryModal');
  }
  $('#inventoryForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    try {
      await api('/system/api/products/' + f.id.value + '/inventory', { method: 'POST', body: {
        price: f.price.value, cost_price: f.cost_price.value, cost_50ml: f.cost_50ml.value, cost_100ml: f.cost_100ml.value,
        stock_qty: f.stock_qty.value, low_stock_threshold: f.low_stock_threshold.value, sku: f.sku.value, barcode: f.barcode.value,
        track_stock: f.track_stock.checked, in_stock: f.in_stock.checked,
      } });
      toast(t('inventory_saved')); closeModal('inventoryModal'); loadInventory();
    } catch (err) { toast(err.message, true); }
  });
  $('#adjustForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    try { await api('/system/api/products/' + f.id.value + '/adjust', { method: 'POST', body: { quantity: f.quantity.value, note: f.note.value } }); toast(t('stock_adjusted')); closeModal('inventoryModal'); loadInventory(); }
    catch (err) { toast(err.message, true); }
  });

  // ── Sales ────────────────────────────────────────────────────
  function initDates() { ['salesFrom', 'salesTo', 'reportFrom', 'reportTo'].forEach(id => { const el = $('#' + id); if (el && !el.value) el.value = today(); }); }
  async function loadSales() {
    initDates(); const host = $('#salesRows'); if (!host) return;
    try {
      const d = await api(`/system/api/sales?from=${$('#salesFrom').value}&to=${$('#salesTo').value}`);
      host.innerHTML = d.sales.length ? d.sales.map(s => `<tr>
        <td class="num" dir="ltr"><b>${esc(s.sale_number)}</b></td><td class="muted">${when(s.created_at)}</td><td>${esc(s.customer_name || t('walk_in'))}</td>
        <td>${s.source === 'online' ? `<span class="pill pill--blue">${t('source_online')}</span>` : esc(s.cashier_name)}</td><td>${esc(payLabel(s.payment_method))}</td><td class="num" dir="ltr"><b>${lbp(s.total)}</b></td><td>${statusPill(s.status)}</td>
        <td class="actions"><button class="btn btn--sm" data-sale="${s.id}">${t('view')}</button></td></tr>`).join('') : empty(t('no_sales'), 8);
    } catch (e) { toast(e.message, true); }
  }
  $('#salesFilterBtn')?.addEventListener('click', loadSales);
  $('#salesRows')?.addEventListener('click', e => { const b = e.target.closest('[data-sale]'); if (b) showSale(+b.dataset.sale); });

  // ── Online (website) orders ──────────────────────────────────
  let oStatus = '', oTimer;
  const ostPill = st => `<span class="pill st-${st}">${esc(t('st_' + st))}</span>`;
  const NEXT = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
  async function loadOnline() {
    const host = $('#onlineRows'); if (!host) return;
    try {
      const d = await api(`/system/api/online-orders?status=${oStatus}&q=${encodeURIComponent($('#onlineSearch').value.trim())}`);
      const c = d.counts, all = Object.values(c).reduce((a, b) => a + b, 0);
      $$('[data-ocount]').forEach(el => { el.textContent = el.dataset.ocount === 'all' ? all : (c[el.dataset.ocount] || 0); });
      const open = (c.pending || 0) + (c.confirmed || 0) + (c.shipped || 0);
      $('#onlineStats').innerHTML = stat(t('open_orders'), open, open ? 'stat--alert' : '') + stat(t('open_value'), lbp(d.open_value_lbp)) + stat(t('st_delivered'), c.delivered || 0, 'stat--good');
      host.innerHTML = d.orders.length ? d.orders.map(o => `<tr>
        <td class="num" dir="ltr"><b>${esc(o.order_number)}</b></td><td class="muted">${when(o.created_at)}</td>
        <td><b>${esc(o.customer_name)}</b><br><small class="muted" dir="ltr">${esc(o.customer_phone)}</small></td><td>${esc(o.customer_city)}</td>
        <td><span class="pill pill--plain">${esc(t(o.payment_method))}</span></td>
        <td class="num" dir="ltr"><b>${o.currency === 'USD' ? usd(o.total) : lbp(o.total)}</b>${o.currency === 'USD' ? `<br><small class="muted">${lbp(o.total_lbp)}</small>` : ''}</td>
        <td>${ostPill(o.status)}</td>
        <td class="actions" style="white-space:nowrap">${NEXT[o.status] ? `<button class="btn btn--sm btn--dark" data-oset="${o.id}" data-to="${NEXT[o.status]}">${t('st_' + NEXT[o.status])}</button> ` : ''}<button class="btn btn--sm" data-order="${o.id}">${t('view')}</button></td></tr>`).join('')
        : empty(t('no_orders'), 8);
    } catch (e) { toast(e.message, true); }
  }
  async function setOrderStatus(id, status) {
    try { await api(`/system/api/online-orders/${id}/status`, { method: 'POST', body: { status } }); toast(t('status_updated')); closeModal('orderModal'); loadOnline(); }
    catch (e) { toast(e.message, true); }
  }
  async function showOrder(id) {
    try {
      const { order: o, items } = await api('/system/api/online-orders/' + id);
      const cur = v => o.currency === 'USD' ? usd(v) : lbp(v);
      const wa = String(o.customer_phone || '').replace(/\D/g, '').replace(/^0/, '961');
      $('#orderTitle').textContent = o.order_number;
      $('#orderDetail').innerHTML = `<div class="receipt">
        <dl class="kv"><dt>${t('date')}</dt><dd>${when(o.created_at)}</dd><dt>${t('customer')}</dt><dd><b>${esc(o.customer_name)}</b> · <a dir="ltr" href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></dd>
          <dt>${t('address')}</dt><dd>${esc(o.customer_city)} — ${esc(o.customer_address)}</dd><dt>${t('payment')}</dt><dd>${esc(t(o.payment_method))}</dd>
          ${o.notes ? `<dt>${t('notes')}</dt><dd>${esc(o.notes)}</dd>` : ''}<dt>${t('status')}</dt><dd>${ostPill(o.status)}</dd></dl>
        <div class="table-wrap" style="margin:14px 0"><table class="table"><thead><tr><th>${t('product')}</th><th>${t('quantity')}</th><th>${t('price')}</th><th>${t('total')}</th></tr></thead><tbody>${
          items.map(i => `<tr><td><span class="prod-cell">${i.image_path ? `<img class="thumb" src="${esc(i.image_path)}" alt="">` : '<span class="thumb thumb--empty">J</span>'}<span><strong>${esc(i.product_name)}</strong>${i.size_ml ? `<small>${i.size_ml} ml</small>` : ''}</span></span></td><td class="num">${i.quantity}</td><td class="num" dir="ltr">${cur(i.price)}</td><td class="num" dir="ltr">${cur(i.price * i.quantity)}</td></tr>`).join('')}</tbody></table></div>
        <dl class="kv" style="max-width:340px;margin-inline-start:auto"><dt>${t('subtotal')}</dt><dd class="num" dir="ltr">${cur(o.subtotal)}</dd><dt>${t('delivery')}</dt><dd class="num" dir="ltr">${o.delivery_fee ? cur(o.delivery_fee) : t('free')}</dd>
          <dt><b>${t('total')}</b></dt><dd class="num" dir="ltr"><b>${cur(o.total)}</b>${o.currency === 'USD' ? ` <span class="muted">(${lbp(o.total_lbp)})</span>` : ''}</dd></dl>
        <div class="receipt__actions">
          <a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>
          <select id="orderStatusSel" class="input" style="width:auto">${['pending','confirmed','shipped','delivered','cancelled'].map(st => `<option value="${st}" ${st === o.status ? 'selected' : ''}>${t('st_' + st)}</option>`).join('')}</select>
          <button class="btn btn--dark" id="orderStatusBtn">${t('update_status')}</button>
        </div></div>`;
      openModal('orderModal');
      $('#orderStatusBtn').onclick = () => { const st = $('#orderStatusSel').value; if (st !== o.status) setOrderStatus(o.id, st); };
    } catch (e) { toast(e.message, true); }
  }
  $('#onlineTabs')?.addEventListener('click', e => {
    const b = e.target.closest('[data-ostatus]'); if (!b) return;
    oStatus = b.dataset.ostatus; $$('#onlineTabs [data-ostatus]').forEach(x => x.classList.toggle('is-active', x === b)); loadOnline();
  });
  $('#onlineSearch')?.addEventListener('input', () => { clearTimeout(oTimer); oTimer = setTimeout(loadOnline, 250); });
  $('#onlineRows')?.addEventListener('click', e => {
    const v = e.target.closest('[data-order]'), s2 = e.target.closest('[data-oset]');
    if (v) showOrder(+v.dataset.order);
    if (s2) setOrderStatus(+s2.dataset.oset, s2.dataset.to);
  });

  // ── Customers ────────────────────────────────────────────────
  let custTimer;
  async function loadCustomers() {
    const host = $('#customerRows'); if (!host) return;
    try {
      const d = await api('/system/api/customers?q=' + encodeURIComponent($('#customerSearch').value));
      host.innerHTML = d.customers.length ? d.customers.map(c => `<tr><td><b>${esc(c.name)}</b></td><td class="num" dir="ltr">${esc(c.phone || '—')}</td><td class="num">${c.visits}</td><td class="num" dir="ltr">${lbp(c.total_spent)}</td></tr>`).join('') : empty(t('no_customers'), 4);
    } catch (e) { toast(e.message, true); }
  }
  $('#customerSearch')?.addEventListener('input', () => { clearTimeout(custTimer); custTimer = setTimeout(loadCustomers, 250); });
  $('#customerForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/system/api/customers', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast(t('customer_added')); loadCustomers(); }
    catch (err) { toast(err.message, true); }
  });

  // ── Purchases ────────────────────────────────────────────────
  async function loadSuppliers() {
    const d = await api('/system/api/suppliers');
    $('#purchaseSupplier').innerHTML = `<option value="">${t('no_supplier')}</option>` + d.suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('#supplierList').innerHTML = d.suppliers.length ? d.suppliers.map(s => `<div class="list-row"><b>${esc(s.name)}</b><span class="muted num" dir="ltr">${esc(s.phone || '')}</span></div>`).join('') : empty(t('no_suppliers'));
  }
  async function loadPurchases() {
    if (!$('#purchaseHistory')) return;
    try {
      await loadSuppliers();
      const d = await api('/system/api/purchases');
      $('#purchaseHistory').innerHTML = d.purchases.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>${t('date')}</th><th>${t('supplier')}</th><th>${t('invoice_no')}</th><th>${t('total_cost')}</th><th>${t('by')}</th></tr></thead><tbody>${
          d.purchases.map(p => `<tr><td class="muted">${when(p.created_at)}</td><td>${esc(p.supplier_name || '—')}</td><td class="num" dir="ltr">${esc(p.invoice_number || '—')}</td><td class="num" dir="ltr">${lbp(p.total_cost_lbp)}</td><td>${esc(p.staff_name || '')}</td></tr>`).join('')}</tbody></table></div>`
        : empty(t('no_purchases'));
      renderPurchaseCart();
    } catch (e) { toast(e.message, true); }
  }
  $('#supplierForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/system/api/suppliers', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast(t('supplier_added')); loadSuppliers(); }
    catch (err) { toast(err.message, true); }
  });
  let purTimer;
  $('#purchaseProductSearch')?.addEventListener('input', e => {
    clearTimeout(purTimer);
    purTimer = setTimeout(async () => {
      const q = e.target.value.trim(), box = $('#purchaseProductResults');
      if (!q) { box.hidden = true; return; }
      try {
        const d = await api('/system/api/products?limit=30&q=' + encodeURIComponent(q));
        d.products.forEach(p => productCache.set(p.id, p));
        box.hidden = false;
        box.innerHTML = d.products.length ? d.products.map(p => `<button type="button" data-purchase-add="${p.id}"><span><b>${esc(p.name_en)}</b><br><small class="muted">${esc(p.brand || '')} · ${p.type === 'local' ? 'ml' : t('items')}</small></span>${icon('plus')}</button>`).join('') : empty(t('no_results'));
      } catch (err) { toast(err.message, true); }
    }, 250);
  });
  $('#purchaseProductResults')?.addEventListener('click', e => {
    const b = e.target.closest('[data-purchase-add]'); if (!b) return;
    const p = productCache.get(+b.dataset.purchaseAdd); if (!p) return;
    const found = purchaseCart.find(x => x.product_id === p.id);
    if (found) found.quantity += p.type === 'local' ? 100 : 1;
    else purchaseCart.push({ product_id: p.id, name: p.name_en, type: p.type, quantity: p.type === 'local' ? 100 : 1, unit_cost: Number(p.cost_price || 0) });
    $('#purchaseProductResults').hidden = true; $('#purchaseProductSearch').value = '';
    renderPurchaseCart();
  });
  function renderPurchaseCart() {
    const host = $('#purchaseItems'); if (!host) return;
    host.innerHTML = purchaseCart.length
      ? purchaseCart.map((x, i) => `<div class="purchase-line"><div><b>${esc(x.name)}</b><br><small class="muted">${x.type === 'local' ? t('qty_ml') : t('qty_units')}</small></div>
          <input type="number" min=".01" step=".01" value="${x.quantity}" data-pq="${i}" dir="ltr"><input type="number" min="0" step=".01" value="${x.unit_cost}" data-pc="${i}" dir="ltr">
          <button type="button" class="btn btn--sm btn--ghost" data-pr="${i}">${icon('x')}</button></div>`).join('') +
        `<div class="cart-total" style="margin-top:10px;border-radius:10px"><div class="grand"><span>${t('total_cost')}</span><span class="num" dir="ltr">${lbp(purchaseCart.reduce((s, x) => s + x.quantity * x.unit_cost, 0))}</span></div></div>`
      : empty(t('add_products_hint'));
  }
  $('#purchaseItems')?.addEventListener('change', e => {
    const q = e.target.closest('[data-pq]'), c = e.target.closest('[data-pc]');
    if (q) purchaseCart[+q.dataset.pq].quantity = Number(q.value || 0);
    if (c) purchaseCart[+c.dataset.pc].unit_cost = Number(c.value || 0);
    renderPurchaseCart();
  });
  $('#purchaseItems')?.addEventListener('click', e => { const r = e.target.closest('[data-pr]'); if (r) { purchaseCart.splice(+r.dataset.pr, 1); renderPurchaseCart(); } });
  $('#savePurchase')?.addEventListener('click', async () => {
    if (!purchaseCart.length) return toast(t('add_one_product'), true);
    try {
      await api('/system/api/purchases', { method: 'POST', body: { supplier_id: $('#purchaseSupplier').value || null, invoice_number: $('#purchaseInvoice').value, items: purchaseCart } });
      purchaseCart = []; $('#purchaseInvoice').value = ''; toast(t('purchase_saved')); loadPurchases();
    } catch (e) { toast(e.message, true); }
  });

  // ── Expenses ─────────────────────────────────────────────────
  const expKey = c => ({ Rent: 'exp_rent', Salary: 'exp_salary', Delivery: 'exp_delivery', Marketing: 'exp_marketing', Utilities: 'exp_utilities', Supplies: 'exp_supplies', Other: 'exp_other' }[c]);
  async function loadExpenses() {
    const host = $('#expenseList'); if (!host) return;
    try {
      const d = await api('/system/api/expenses');
      host.innerHTML = d.expenses.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>${t('date')}</th><th>${t('category')}</th><th>${t('description')}</th><th>${t('amount')}</th></tr></thead><tbody>${
          d.expenses.map(x => `<tr><td class="muted">${when(x.created_at)}</td><td><span class="pill pill--plain">${esc(expKey(x.category) ? t(expKey(x.category)) : x.category)}</span></td><td>${esc(x.description)}</td><td class="num" dir="ltr">${lbp(Number(x.amount_lbp) + Number(x.amount_usd) * Number(x.exchange_rate))}</td></tr>`).join('')}</tbody></table></div>`
        : empty(t('no_expenses'));
    } catch (e) { toast(e.message, true); }
  }
  $('#expenseForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.from_drawer = !!e.target.from_drawer.checked;
    try { await api('/system/api/expenses', { method: 'POST', body }); e.target.reset(); toast(t('expense_saved')); loadExpenses(); }
    catch (err) { toast(err.message, true); }
  });

  // ── Reports ──────────────────────────────────────────────────
  async function loadReports() {
    initDates(); if (!$('#reportMetrics')) return;
    try {
      const d = await api(`/system/api/reports?from=${$('#reportFrom').value}&to=${$('#reportTo').value}`);
      $('#reportMetrics').innerHTML = stat(t('revenue'), lbp(d.sales.revenue)) + stat(t('cogs'), lbp(d.cogs)) +
        stat(t('gross_profit'), lbp(d.gross_profit), d.gross_profit >= 0 ? 'stat--good' : 'stat--bad') +
        stat(t('expenses'), lbp(d.expenses)) + stat(t('net_profit'), lbp(d.net_profit), d.net_profit >= 0 ? 'stat--good' : 'stat--bad');
      const ch = d.channels, isOwner = SYS.user.role === 'owner';
      const chCard = (label, c, extra = '') => `<div class="card stat"><span class="stat__label">${esc(label)} · <span class="num">${c.count}</span> ${t('sales_word')}</span>
        <span class="stat__value num" dir="ltr">${lbp(c.revenue)}</span>
        <span class="stat__sub">${t('cogs')}: <span dir="ltr">${lbp(c.cogs)}</span></span>
        <span class="stat__sub">${t('gross_profit')}: <b dir="ltr" style="color:var(--${c.gross_profit >= 0 ? 'green' : 'red'})">${lbp(c.gross_profit)}</b></span>${extra}</div>`;
      const shareExtra = `<span class="stat__sub" style="margin-top:6px">${t('partner_share')} (<span class="num">${ch.online.partner_share_pct}%</span>): <b dir="ltr">${lbp(ch.online.partner_share)}</b></span>` +
        (isOwner ? `<form id="shareForm" style="display:flex;gap:6px;margin-top:8px"><span class="input-affix" style="max-width:140px"><input type="number" name="percent" min="0" max="100" step="0.5" value="${ch.online.partner_share_pct}" dir="ltr"><span>%</span></span><button class="btn btn--sm">${t('save')}</button></form>` : '');
      $('#channelReport').innerHTML = `<div class="grid grid--2">${chCard(t('in_store'), ch.pos)}${chCard(t('online'), ch.online, shareExtra)}</div>`;
      $('#shareForm')?.addEventListener('submit', async ev => {
        ev.preventDefault();
        try { await api('/system/api/settings/online-share', { method: 'POST', body: { percent: Number(new FormData(ev.target).get('percent')) } }); toast(t('partner_saved')); loadReports(); }
        catch (e) { toast(e.message, true); }
      });
      $('#topProducts').innerHTML = d.top.map((x, i) => `<div class="list-row"><span><span class="muted num">${i + 1}.</span> <b>${esc(x.product_name)}</b> <small class="muted">×${x.qty}</small></span><span class="num" dir="ltr">${lbp(x.revenue)}</span></div>`).join('') || empty(t('no_sales'));
      $('#paymentReport').innerHTML = d.payments.map(x => `<div class="list-row"><span><b>${esc(payLabel(x.payment_method))}</b> <small class="muted">· ${x.count} ${t('sales_word')}</small></span><span class="num" dir="ltr">${lbp(x.total)}</span></div>`).join('') || empty(t('no_sales'));
    } catch (e) { toast(e.message, true); }
  }
  $('#reportBtn')?.addEventListener('click', loadReports);

  // ── Team ─────────────────────────────────────────────────────
  async function loadUsers() {
    const host = $('#userList'); if (!host) return;
    try {
      const d = await api('/system/api/users');
      host.innerHTML = d.users.length ? d.users.map(u => `<div class="list-row"><span><b>${esc(u.full_name)}</b><br><small class="muted"><span dir="ltr">${esc(u.username)}</span> · ${t('role_' + u.role)}</small></span>
        <span style="display:flex;gap:8px;align-items:center">${u.active ? '' : `<span class="pill pill--red">${t('unavailable')}</span>`}<button class="btn btn--sm" data-toggle-user="${u.id}">${u.active ? t('disable') : t('enable')}</button></span></div>`).join('') : empty(t('no_staff'));
    } catch (e) { toast(e.message, true); }
  }
  $('#userList')?.addEventListener('click', async e => {
    const b = e.target.closest('[data-toggle-user]'); if (!b) return;
    try { await api('/system/api/users/' + b.dataset.toggleUser + '/toggle', { method: 'POST', body: {} }); loadUsers(); } catch (err) { toast(err.message, true); }
  });
  $('#userForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/system/api/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast(t('user_created')); loadUsers(); }
    catch (err) { toast(err.message, true); }
  });

  // ── Start ────────────────────────────────────────────────────
  initDates();
  renderCart();
  let start = 'pos';
  try { start = localStorage.getItem(TAB_KEY) || 'pos'; } catch (_) {}
  setTab(start);
  loadShift();
})();
