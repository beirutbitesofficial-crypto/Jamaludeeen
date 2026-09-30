(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // Mobile sidebar
  const side = $('#boSide'), scrim = $('#boScrim');
  const setMenu = open => { side?.classList.toggle('open', open); scrim?.classList.toggle('open', open); };
  $('#boBurger')?.addEventListener('click', () => setMenu(!side.classList.contains('open')));
  scrim?.addEventListener('click', () => setMenu(false));

  // Flash messages
  $$('.flash__close').forEach(b => b.addEventListener('click', () => b.parentElement.remove()));

  // Modals: <button data-open="id"> / <button data-close>
  const openModal = id => document.getElementById(id)?.classList.add('open');
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('open'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $$('.modal.open').forEach(m => m.classList.remove('open')); setMenu(false); }
  });
  window.openModal = openModal;

  // Confirm before destructive actions: <form data-confirm="…">
  $$('form[data-confirm]').forEach(f => f.addEventListener('submit', e => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));

  // Auto-submit file inputs: <input type="file" data-autosubmit>
  $$('input[type=file][data-autosubmit]').forEach(i => i.addEventListener('change', () => i.files.length && i.form.submit()));

  // Live new-order alerts
  const I18N = window.ADMIN_I18N || {};
  const KEY = 'jm_lastOrderId';
  let lastId = 0, first = true;
  try { lastId = parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (_) {}
  function chime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175, 1480].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = f;
        g.gain.setValueAtTime(.2, ctx.currentTime + i * .16);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .16 + .3);
        o.start(ctx.currentTime + i * .16); o.stop(ctx.currentTime + i * .16 + .3);
      });
    } catch (_) {}
  }
  function toast(msg, href) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); t.style.pointerEvents = href ? 'auto' : 'none'; t.style.cursor = href ? 'pointer' : '';
    t.onclick = href ? () => { location.href = href; } : null;
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 9000);
  }
  function check() {
    fetch('/admin/api/orders/stats', { headers: { accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      const badge = $('#pendingNavBadge'); if (badge) badge.textContent = d.pending > 0 ? d.pending : '';
      $$('[data-pending-count]').forEach(el => { el.textContent = d.pending; });
      const id = d.latest ? d.latest.id : 0;
      if (first) { first = false; if (!lastId) lastId = id; }
      else if (id > lastId) {
        lastId = id; chime(); toast(I18N.newOrder || 'New order', '/admin/orders/' + id);
        if ('Notification' in window && Notification.permission === 'granted') new Notification(I18N.newOrder || 'New order', { body: d.latest.customer_name });
      }
      try { localStorage.setItem(KEY, String(lastId)); } catch (_) {}
    }).catch(() => {});
  }
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  setTimeout(check, 1500);
  setInterval(check, 30000);
})();
