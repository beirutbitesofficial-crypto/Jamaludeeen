// ── Header shadow on scroll ───────────────────────────────
const siteHeader = document.getElementById('siteHeader');
if (siteHeader) {
  const onScroll = () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── Mobile drawer ─────────────────────────────────────────
const burger = document.getElementById('navBurger');
const drawer = document.getElementById('navDrawer');
const scrim = document.getElementById('navOverlay');
const drawerClose = document.getElementById('navClose');

function setMenu(open) {
  if (!drawer) return;
  drawer.classList.toggle('is-open', open);
  scrim && scrim.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  burger && burger.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('no-scroll', open);
  if (open) drawer.querySelector('a')?.focus();
}
burger && burger.addEventListener('click', () => setMenu(!drawer.classList.contains('is-open')));
scrim && scrim.addEventListener('click', () => setMenu(false));
drawerClose && drawerClose.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (window.innerWidth > 1024) setMenu(false); });

// ── Reveal on scroll (content is visible without JS) ──────
(function () {
  const items = document.querySelectorAll('.reveal');
  const showAll = () => items.forEach(el => el.classList.add('is-visible'));
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return showAll();
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -20px' });
  items.forEach((el, i) => {
    el.style.setProperty('--d', (i % 4) * 70 + 'ms');
    io.observe(el);
  });
  // Never leave anything hidden (print, very tall pages, full-page captures).
  window.addEventListener('beforeprint', showAll);
})();

// ── Brand directory filter ────────────────────────────────
const brandSearch = document.getElementById('brandSearch');
if (brandSearch) {
  brandSearch.addEventListener('input', () => {
    const q = brandSearch.value.trim().toLocaleLowerCase();
    let shown = 0;
    document.querySelectorAll('[data-brand-group]').forEach(group => {
      let groupShown = 0;
      group.querySelectorAll('[data-brand-name]').forEach(card => {
        const match = !q || card.dataset.brandName.includes(q);
        card.hidden = !match;
        if (match) groupShown++;
      });
      group.hidden = groupShown === 0;
      shown += groupShown;
    });
    const empty = document.getElementById('brandEmpty');
    if (empty) empty.hidden = shown > 0;
  });
}

// ── Quantity steppers ─────────────────────────────────────
document.querySelectorAll('[data-stepper]').forEach(stepper => {
  const input = stepper.querySelector('input');
  stepper.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const min = parseInt(input.min, 10) || 1;
      const max = parseInt(input.max, 10) || 99;
      const next = (parseInt(input.value, 10) || min) + parseInt(btn.dataset.step, 10);
      input.value = Math.min(max, Math.max(min, next));
    });
  });
});

// ── Product size → live price ─────────────────────────────
const pdpPrice = document.getElementById('pdpPrice');
if (pdpPrice) {
  const unit = document.getElementById('pdpUnit');
  document.querySelectorAll('input[name="size_ml"]').forEach(radio => {
    radio.addEventListener('change', () => {
      pdpPrice.textContent = '$' + radio.dataset.price;
      if (unit) unit.textContent = radio.value + ' ml';
      const barPrice = document.getElementById('buyBarPrice');
      if (barPrice) barPrice.innerHTML = '$' + radio.dataset.price + ' · <small>' + radio.value + ' ml</small>';
    });
  });
}

// ── Sticky buy bar: appears on phones once the main "Add to bag" scrolls out of view ──
const buyBar = document.getElementById('buyBar');
const mainBuy = document.querySelector('.pdp__buy');
if (buyBar && mainBuy && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting;
    buyBar.classList.toggle('is-on', show);
    buyBar.setAttribute('aria-hidden', String(!show));
    buyBar.querySelector('button').tabIndex = show ? 0 : -1;
    document.body.classList.toggle('has-buybar', show);
  }, { threshold: 0 }).observe(mainBuy);
}

// ── Order confirmation → hand over to WhatsApp once ───────
const sendOrder = document.getElementById('sendOrder');
if (sendOrder && sendOrder.dataset.order) {
  const key = 'jm_sent_' + sendOrder.dataset.order;
  let sent = false;
  try { sent = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch (_) {}
  if (!sent) setTimeout(() => { window.location.href = sendOrder.href; }, 1800);
}

// ── Toasts ────────────────────────────────────────────────
document.querySelectorAll('.toast').forEach(toast => {
  const dismiss = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 350);
  };
  toast.querySelector('.toast__close')?.addEventListener('click', dismiss);
  setTimeout(dismiss, 4500);
});

// ── Broken product photos → monogram placeholder ─────────
function productImageFallback(img) {
  if (!img.hasAttribute('data-fallback') || img.dataset.failed) return;
  img.dataset.failed = '1';
  const ph = document.createElement('div');
  ph.className = 'card__placeholder';
  ph.innerHTML = '<span class="card__monogram">J</span>';
  if (img.alt) {
    const name = document.createElement('span');
    name.className = 'card__ph-name';
    name.textContent = img.alt;
    ph.appendChild(name);
  }
  if (img.dataset.fallback) {
    const house = document.createElement('span');
    house.className = 'card__ph-house';
    house.textContent = img.dataset.fallback;
    ph.appendChild(house);
  }
  img.replaceWith(ph);
}
document.addEventListener('error', e => {
  if (e.target instanceof HTMLImageElement) productImageFallback(e.target);
}, true);
document.querySelectorAll('img[data-fallback]').forEach(img => {
  if (img.complete && img.naturalWidth === 0) productImageFallback(img);
});
