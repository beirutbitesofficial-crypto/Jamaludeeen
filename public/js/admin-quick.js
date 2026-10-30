// Admin › Quick edit: change a product's price, photo or availability in place.
// Every change saves on its own (no Save button), which suits a phone.
(function () {
  const list = document.getElementById('quickList');
  if (!list) return;
  const rate = Number(list.dataset.rate) || 90000;
  const t = JSON.parse(list.dataset.i18n || '{}');

  function status(item, text, kind) {
    const el = item.querySelector('.qe-status');
    el.textContent = text;
    el.className = 'qe-status' + (kind ? ' is-' + kind : '');
    clearTimeout(el._t);
    if (kind === 'ok') el._t = setTimeout(() => { el.textContent = ''; el.className = 'qe-status'; }, 2200);
  }

  // A JSON reply means the request reached the API; anything else (the login page
  // after a redirect) means the session has expired.
  async function send(url, options) {
    const res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { accept: 'application/json' } }, options));
    const type = res.headers.get('content-type') || '';
    if (res.redirected || !type.includes('application/json')) throw new Error(t.expired);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.failed);
    return data;
  }
  const postJson = (url, body) => send(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) });

  // ── Price: type in USD or LBP; the other field follows, then it saves. ──
  list.querySelectorAll('.qe-item').forEach(item => {
    const usd = item.querySelector('[data-qe-usd]');
    const lbp = item.querySelector('[data-qe-lbp]');
    if (!usd || !lbp) return;
    let saved = lbp.value;
    usd.addEventListener('input', () => { lbp.value = usd.value === '' ? '' : Math.round(Number(usd.value) * rate); });
    lbp.addEventListener('input', () => { usd.value = lbp.value === '' ? '' : Math.round(Number(lbp.value) / rate * 100) / 100; });
    const save = async () => {
      if (lbp.value === saved) return;
      status(item, t.saving, 'busy');
      try {
        const data = await postJson('/admin/api/products/' + item.dataset.id + '/price', { price: lbp.value });
        saved = data.price == null ? '' : String(data.price);
        lbp.value = saved;
        status(item, '✓ ' + t.saved.replace(/\.$/, ''), 'ok');
      } catch (e) { status(item, e.message || t.failed, 'error'); }
    };
    [usd, lbp].forEach(input => {
      input.addEventListener('change', save);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    });
  });

  // ── Availability ──
  list.addEventListener('change', async e => {
    const box = e.target.closest('[data-qe-stock]');
    if (!box) return;
    const item = box.closest('.qe-item');
    status(item, t.saving, 'busy');
    try {
      await postJson('/admin/api/products/' + item.dataset.id + '/stock', { in_stock: box.checked });
      status(item, '✓ ' + t.saved.replace(/\.$/, ''), 'ok');
    } catch (err) { box.checked = !box.checked; status(item, err.message || t.failed, 'error'); }
  });

  // ── Photo: shrink phone photos in the browser (max 1600px JPEG) before upload. ──
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(r, 'image/jpeg', .88));
    } catch (_) {
      return null; // the browser can't read it; send the original and let the server decide
    } finally { URL.revokeObjectURL(url); }
  }

  list.addEventListener('change', async e => {
    const input = e.target.closest('[data-qe-photo]');
    if (!input || !input.files.length) return;
    const item = input.closest('.qe-item');
    const frame = input.closest('.qe-photo');
    const file = input.files[0];
    frame.classList.add('is-busy');
    status(item, t.saving, 'busy');
    try {
      const blob = (await shrink(file)) || file;
      if (blob.size > 5 * 1024 * 1024) throw new Error(t.tooBig);
      const form = new FormData();
      form.append('image', blob, blob === file ? file.name : 'photo.jpg');
      const data = await send('/admin/api/products/' + item.dataset.id + '/image', { method: 'POST', body: form });
      let img = frame.querySelector('img');
      if (!img) { img = document.createElement('img'); frame.querySelector('.monogram')?.remove(); frame.prepend(img); }
      img.src = data.image_path;
      status(item, '✓ ' + t.photo, 'ok');
    } catch (err) {
      status(item, err.message || t.failed, 'error');
    } finally {
      frame.classList.remove('is-busy');
      input.value = '';
    }
  });
})();
