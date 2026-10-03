// Scent trail: a ribbon of perfume that leaves the open hero bottle and flows,
// with the scroll, into each collection card (Men → Women → Unisex).
// The path is rebuilt every frame from live element positions, so it follows
// pinned sections, parallax and every responsive layout without extra maths.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function ScentTrail(opts) {
    this.source = opts.source;          // element at the bottle neck
    this.targets = opts.targets;        // collection cards, in order
    this.onArrive = opts.onArrive || (() => {});
    this.progress = 0;                  // 0 … targets.length
    this.reached = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.parts = [];
    this.running = false;
    this.lastHead = null;
    this.build();
    this.tick = this.tick.bind(this);
  }

  ScentTrail.prototype.build = function () {
    const wrap = document.createElement('div');
    wrap.className = 'scent';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <svg class="scent__svg">
        <defs>
          <linearGradient id="scentGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f3dfae"/><stop offset=".5" stop-color="#d4a85a"/><stop offset="1" stop-color="#9c6b2e"/>
          </linearGradient>
          <mask id="scentMask" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="30000" height="30000"><path class="scent__maskpath" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round"/></mask>
          <radialGradient id="scentHead"><stop offset="0" stop-color="#fffaf0"/><stop offset=".35" stop-color="#f1d398"/><stop offset="1" stop-color="rgba(212,168,90,0)"/></radialGradient>
        </defs>
        <path class="scent__haze"/>
        <path class="scent__body"/>
        <path class="scent__core"/>
        <path class="scent__drops" mask="url(#scentMask)"/>
        <circle class="scent__head" r="22" fill="url(#scentHead)"/>
      </svg>
      <canvas class="scent__mist"></canvas>`;
    document.body.appendChild(wrap);
    this.el = wrap;
    this.svg = wrap.querySelector('svg');
    this.paths = [...wrap.querySelectorAll('.scent__haze, .scent__body, .scent__core')];
    this.drops = wrap.querySelector('.scent__drops');
    this.maskPath = wrap.querySelector('.scent__maskpath');
    this.head = wrap.querySelector('.scent__head');
    this.canvas = wrap.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.measure = document.createElementNS(NS, 'path'); // off-DOM path for segment lengths
    this.resize();
  };

  ScentTrail.prototype.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  };

  // Point where the perfume leaves the bottle / lands in a card (viewport coordinates).
  ScentTrail.prototype.points = function () {
    const s = this.source.getBoundingClientRect();
    const pts = [{ x: s.left + s.width / 2, y: s.top + s.height * .3 }];
    this.targets.forEach(t => {
      const r = t.getBoundingClientRect();
      pts.push({ x: r.left + r.width / 2, y: r.top + r.height * (window.innerWidth <= 720 ? .3 : .42) });
    });
    return pts;
  };

  // Elegant curves: the first leg rises out of the neck before falling to the card;
  // the following legs swing in a soft S between cards (works for rows or stacks).
  ScentTrail.prototype.segments = function (p) {
    const vh = window.innerHeight, vw = window.innerWidth;
    if (vw <= 720) return this.marginSegments(p, vw);
    const segs = [];
    const a = p[0], b = p[1];
    const side = b.x >= a.x ? 1 : -1;
    if (vw <= 1024) segs.push(this.marginSegments([a, b], vw)[0]); // tablet: keep the hero copy clear
    else segs.push(`M${a.x},${a.y} C${a.x + side * vw * .2},${a.y - vh * .28} ${b.x - side * vw * .32},${b.y - Math.max(vh * .45, (b.y - a.y) * .38)} ${b.x},${b.y}`);
    for (let i = 1; i < p.length - 1; i++) {
      const s = p[i], e = p[i + 1];
      const dx = e.x - s.x, dy = e.y - s.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, amp = Math.min(160, len * .28);
      segs.push(`M${s.x},${s.y} C${s.x + dx * .3 + nx * amp},${s.y + dy * .3 + ny * amp} ${s.x + dx * .7 - nx * amp},${s.y + dy * .7 - ny * amp} ${e.x},${e.y}`);
    }
    return segs;
  };

  // Phones: content is full width, so the trail runs down the right-hand margin
  // and only swings in to each card's image — it never crosses a line of text.
  ScentTrail.prototype.marginSegments = function (p, vw) {
    const R = vw - 12;
    const segs = [];
    const a = p[0], b = p[1];
    segs.push(`M${a.x},${a.y} C${a.x + 30},${a.y - 70} ${R},${a.y - 30} ${R},${a.y + 90} L${R},${b.y - 150} C${R},${b.y - 60} ${b.x + 70},${b.y - 50} ${b.x},${b.y}`);
    for (let i = 1; i < p.length - 1; i++) {
      const s = p[i], e = p[i + 1];
      const inner = R - 22;
      segs.push(`M${s.x},${s.y} C${s.x + 60},${s.y + 30} ${inner},${s.y + 20} ${inner},${s.y + 110} L${inner},${e.y - 130} C${inner},${e.y - 50} ${e.x + 60},${e.y - 40} ${e.x},${e.y}`);
    }
    return segs;
  };

  ScentTrail.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    window.gsap.ticker.add(this.tick);
  };
  ScentTrail.prototype.stop = function () {
    this.running = false;
    window.gsap.ticker.remove(this.tick);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.parts.length = 0;
  };

  ScentTrail.prototype.burst = function (x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 140;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0, max: .9 + Math.random() * .9, s: 1.5 + Math.random() * 3.5 });
    }
  };

  ScentTrail.prototype.tick = function () {
    const now = performance.now();
    const dt = Math.min(.05, (now - this.last) / 1000);
    this.last = now;
    const g = this.progress;
    const n = this.targets.length;

    // Path & drawn length.
    const segs = this.segments(this.points());
    const d = segs.join(' ');
    let drawn = 0, total = 0;
    segs.forEach((seg, i) => {
      this.measure.setAttribute('d', seg);
      const L = this.measure.getTotalLength();
      total += L;
      drawn += L * clamp01(g - i);
    });
    [...this.paths, this.maskPath].forEach(p => {
      p.setAttribute('d', d);
      p.style.strokeDasharray = `${drawn} ${total + 10}`;
    });
    this.drops.setAttribute('d', d);
    this.drops.style.strokeDashoffset = String(-now / 22);

    const visible = g > .002;
    this.el.classList.toggle('is-on', visible);
    let head = null;
    if (visible) {
      const pt = this.paths[1].getPointAtLength(Math.max(0, drawn - .5));
      head = { x: pt.x, y: pt.y };
      this.head.setAttribute('cx', pt.x);
      this.head.setAttribute('cy', pt.y);
      this.head.style.opacity = g >= n - .001 ? '0' : '1';
    }

    // Arrivals (reversible when scrolling back).
    const reached = Math.min(n, Math.floor(g + .001));
    if (reached !== this.reached) {
      if (reached > this.reached && head) this.burst(head.x, head.y, 46);
      this.reached = reached;
      this.onArrive(reached);
    }

    // Perfume mist shed by the moving head.
    const ctx = this.ctx, k = this.dpr;
    if (head && this.lastHead && g < n) {
      const moved = Math.hypot(head.x - this.lastHead.x, head.y - this.lastHead.y);
      const count = Math.min(6, 1 + moved / 6);
      for (let i = 0; i < count; i++) {
        this.parts.push({
          x: head.x + (Math.random() - .5) * 10, y: head.y + (Math.random() - .5) * 10,
          vx: (Math.random() - .5) * 40, vy: -10 - Math.random() * 30,
          life: 0, max: .7 + Math.random() * .9, s: 1 + Math.random() * 3,
        });
      }
    }
    this.lastHead = head;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= .96; p.vy = p.vy * .96 - 6 * dt;
      const t = p.life / p.max, a = (1 - t) * (t < .15 ? t / .15 : 1);
      ctx.globalAlpha = a * .85;
      ctx.fillStyle = '#f0cf8a';
      ctx.beginPath();
      ctx.arc(p.x * k, p.y * k, p.s * k * (1 - t * .4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  window.JM = window.JM || {};
  window.JM.ScentTrail = ScentTrail;
})();
