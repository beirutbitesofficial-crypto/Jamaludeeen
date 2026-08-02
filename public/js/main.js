// ── Navbar scroll effect ──────────────────────────────────
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

// ── Shop sidebar filter toggle (mobile) ──────────────────
const filterToggle = document.getElementById('filterToggle');
const sidebar      = document.getElementById('shopSidebar');
if (filterToggle && sidebar) {
  filterToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    filterToggle.textContent = isOpen ? '✕  Close Filters' : '☰  Filter';
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
