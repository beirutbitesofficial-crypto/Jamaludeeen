// Split an element's text into masked words for line-by-line reveals.
// Keeps inline markup (e.g. <em>) and works for Arabic, since it only splits on spaces.
(function () {
  function splitWords(el) {
    if (!el || el.dataset.split) return el ? el.querySelectorAll('.w__in') : [];
    el.dataset.split = '1';
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.className = 'w__in';
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    return el.querySelectorAll('.w__in');
  }
  window.JM = window.JM || {};
  window.JM.splitWords = splitWords;
})();
