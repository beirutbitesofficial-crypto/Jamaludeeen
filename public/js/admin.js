// Close alerts
document.querySelectorAll('.alert button').forEach(btn => {
  btn.addEventListener('click', () => btn.parentElement.remove());
});

// Modal close on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
});

// ── Live Order Notifications ──────────────────────────────────────────────────
(function () {
  const LAST_ID_KEY = 'jm_lastOrderId';
  let lastId = parseInt(localStorage.getItem(LAST_ID_KEY) || '0');
  let initialized = false;

  function playAlert() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1100, 880].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.3);
        o.start(ctx.currentTime + i * 0.18);
        o.stop(ctx.currentTime + i * 0.18 + 0.3);
      });
    } catch (e) {}
  }

  function showBrowserNotif(order) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('🛍️ طلب جديد / New Order!', {
        body: `${order.customer_name} — ${(order.total || 0).toLocaleString()} LBP`,
        icon: '/images/logo.png',
        tag: 'jm-new-order'
      });
    }
  }

  function updateBadges(pending) {
    ['pendingCount', 'pendingBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = pending;
    });
    const badge = document.getElementById('pendingNavBadge');
    if (badge) { badge.textContent = pending > 0 ? pending : ''; badge.style.display = pending > 0 ? 'inline-flex' : 'none'; }
  }

  function checkOrders() {
    fetch('/admin/api/orders/stats')
      .then(r => r.json())
      .then(data => {
        updateBadges(data.pending);
        const latestId = data.latest?.id || 0;

        if (!initialized) {
          // First poll — just set baseline, don't alert
          initialized = true;
          if (lastId === 0) lastId = latestId;
          localStorage.setItem(LAST_ID_KEY, lastId);
          return;
        }

        if (latestId > lastId) {
          // New order!
          lastId = latestId;
          localStorage.setItem(LAST_ID_KEY, lastId);
          playAlert();
          showBrowserNotif(data.latest);
          const banner = document.getElementById('newOrderAlert');
          if (banner) { banner.style.display = 'block'; }
        }
      })
      .catch(() => {});
  }

  // Request notification permission on first admin visit
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Poll every 30s, first check after 3s
  setTimeout(checkOrders, 3000);
  setInterval(checkOrders, 30000);
})();

