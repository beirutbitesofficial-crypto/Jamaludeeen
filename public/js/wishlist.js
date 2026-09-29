// ── Wishlist (localStorage) ───────────────────────────────────────────────────
(function () {
  const KEY = 'jm_wishlist';

  function getWishlist() {
    try {
      const ids = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(ids) ? ids.map(String) : [];
    } catch (_) { return []; }
  }
  function saveWishlist(ids) {
    try { localStorage.setItem(KEY, JSON.stringify([...new Set(ids.map(String))])); } catch (_) {}
  }
  function isWishlisted(id) { return getWishlist().includes(String(id)); }
  function toggleWishlist(id) {
    const ids = getWishlist();
    const str = String(id);
    const idx = ids.indexOf(str);
    if (idx === -1) ids.push(str); else ids.splice(idx, 1);
    saveWishlist(ids);
    return idx === -1; // true = added
  }
  function updateWishlistCount() {
    const count = getWishlist().length;
    document.querySelectorAll('.wishlist-count').forEach(el => {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  Object.assign(window, { getWishlist, saveWishlist, isWishlisted, toggleWishlist, updateWishlistCount });

  function init() {
    updateWishlistCount();
    document.querySelectorAll('.btn-wishlist').forEach(btn => {
      btn.classList.toggle('is-active', isWishlisted(btn.dataset.id));
      btn.setAttribute('aria-pressed', String(btn.classList.contains('is-active')));
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggleWishlist(btn.dataset.id);
        btn.classList.toggle('is-active', added);
        btn.setAttribute('aria-pressed', String(added));
        btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop');
        updateWishlistCount();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
