﻿// ── Navbar scroll effect ──────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ── Mobile burger / drawer ────────────────────────────────
const burger  = document.getElementById('navBurger');
const links   = document.getElementById('navLinks');
const overlay = document.getElementById('navOverlay');

function openMenu() {
  if (!links) return;
  links.classList.add('open');
  burger && burger.classList.add('open');
  burger && burger.setAttribute('aria-expanded', 'true');
  links.setAttribute('aria-hidden', 'false');
  overlay && overlay.classList.add('open');
  document.body.classList.add('nav-open');
}
function closeMenu() {
  if (!links) return;
  links.classList.remove('open');
  burger && burger.classList.remove('open');
  burger && burger.setAttribute('aria-expanded', 'false');
  links.setAttribute('aria-hidden', 'true');
  overlay && overlay.classList.remove('open');
  document.body.classList.remove('nav-open');
}

if (burger) {
  burger.addEventListener('click', () => {
    links && links.classList.contains('open') ? closeMenu() : openMenu();
  });
}
if (overlay) overlay.addEventListener('click', closeMenu);

// Close on any nav link tap (mobile)
if (links) {
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMenu();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeMenu();
});

// Subtle reveal transitions, disabled for visitors who prefer reduced motion.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealItems = document.querySelectorAll('.section, .product-card, .brand-card, .reveal');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px' });
  revealItems.forEach(item => {
    item.classList.add('reveal-ready');
    revealObserver.observe(item);
  });
}

// Instant filtering for the brand directory.
const brandSearch = document.getElementById('brandSearch');
if (brandSearch) {
  brandSearch.addEventListener('input', () => {
    const query = brandSearch.value.trim().toLocaleLowerCase();
    document.querySelectorAll('[data-brand-name]').forEach(card => {
      card.hidden = Boolean(query) && !card.dataset.brandName.includes(query);
    });
  });
}

// ── Shop sidebar filter toggle (mobile) ──────────────────
const filterToggle = document.getElementById('filterToggle');
const sidebar      = document.getElementById('shopSidebar');
if (filterToggle && sidebar) {
  const arabic = document.documentElement.lang === 'ar';
  filterToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    filterToggle.textContent = isOpen
      ? (arabic ? '✕  إغلاق الفلاتر' : '✕  Close Filters')
      : (arabic ? '☰  فلترة' : '☰  Filter');
  });
}

// ── Auto-dismiss flash messages ───────────────────────────
setTimeout(() => {
  document.querySelectorAll('.flash').forEach(el => {
    el.style.transition = 'opacity .4s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  });
}, 4000);
