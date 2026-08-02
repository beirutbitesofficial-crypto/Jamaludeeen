// ── Wishlist (localStorage) ───────────────────────────────────────────────────
const WISHLIST_KEY = 'jm_wishlist';

function getWishlist() {
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
  catch { return []; }
}
function saveWishlist(ids) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
}
window.isWishlisted = function(id) {
  return getWishlist().includes(String(id));
};
window.toggleWishlist = function(id) {
  const ids = getWishlist();
  const str = String(id);
  const idx = ids.indexOf(str);
  if (idx === -1) ids.push(str);
  else ids.splice(idx, 1);
  saveWishlist(ids);
  return idx === -1; // true = added
};

function updateWishlistCount() {
  const count = getWishlist().length;
  document.querySelectorAll('.wishlist-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function initWishlistButtons() {
  document.querySelectorAll('.btn-wishlist').forEach(btn => {
    const id = btn.dataset.id;
    if (isWishlisted(id)) btn.classList.add('active');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleWishlist(id);
      btn.classList.toggle('active', added);
      updateWishlistCount();
      btn.style.transform = 'scale(1.4)';
      setTimeout(() => btn.style.transform = '', 200);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateWishlistCount();
  initWishlistButtons();
});
