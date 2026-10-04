// Perfume pour: when the hero bottle tips over, amber perfume drops pour from its neck.
// One lead drop then travels down the page with the scroll (it stays in view while the
// page moves past it), and finally falls onto the "Jamaludeen" word in the footer.
(function () {
  const clamp01 = v => Math.max(0, Math.min(1, v));

  // Glossy amber teardrop, pre-rendered once (tip up, round belly down).
  function teardrop() {
    const c = document.createElement('canvas');
    c.width = 72; c.height = 104;
    const x = c.getContext('2d');
    x.shadowColor = 'rgba(240, 190, 90, .75)';
    x.shadowBlur = 14;
    x.beginPath();
    x.moveTo(36, 10);
    x.bezierCurveTo(40, 30, 60, 50, 60, 68);
    x.bezierCurveTo(60, 84, 49, 94, 36, 94);
    x.bezierCurveTo(23, 94, 12, 84, 12, 68);
    x.bezierCurveTo(12, 50, 32, 30, 36, 10);
    x.closePath();
    const g = x.createRadialGradient(30, 64, 2, 36, 66, 34);
    g.addColorStop(0, '#fff4d2');
    g.addColorStop(.3, '#f2c46a');
    g.addColorStop(.75, '#b9802c');
    g.addColorStop(1, '#6f4413');
    x.fillStyle = g;
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.beginPath();
    x.ellipse(28, 62, 5, 9, -.35, 0, Math.PI * 2);
    x.fill();
    return c;
  }
  function bead() {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(9, 9, 1, 12, 12, 12);
    g.addColorStop(0, '#fff2cc');
    g.addColorStop(.45, '#e9b55c');
    g.addColorStop(.85, 'rgba(160,105,35,.9)');
    g.addColorStop(1, 'rgba(160,105,35,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(12, 12, 12, 0, Math.PI * 2);
    x.fill();
    return c;
  }

  function PerfumePour(opts) {
    this.bottle = opts.bottle;   // the tipping bottle (outer element)
    this.neck = opts.neck;       // element at the bottle's mouth
    this.target = opts.target;   // footer word
    this.onLand = opts.onLand || (() => {});
    this.pour = 0;               // 0 … 1, driven by the hero scroll
    this.released = false;       // lead drop has left the bottle
    this.landed = false;
    this.parts = [];
    this.lead = { x: 0, y: 0 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.drop = teardrop();
    this.bead = bead();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pour';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.lastScroll = window.scrollY;
    this.vel = 0;
    this.resize();
    this.tick = this.tick.bind(this);
  }

  PerfumePour.prototype.resize = function () {
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  };
  PerfumePour.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    window.gsap.ticker.add(this.tick);
  };
  PerfumePour.prototype.stop = function () {
    this.running = false;
    window.gsap.ticker.remove(this.tick);
  };

  PerfumePour.prototype.spawn = function (x, y, vx, vy, s, life, g) {
    if (this.parts.length > 260) return;
    this.parts.push({ x, y, vx, vy, s, life: 0, max: life, g });
  };

  PerfumePour.prototype.splash = function (x, y) {
    for (let i = 0; i < 34; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, v = 120 + Math.random() * 320;
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, 2 + Math.random() * 4, .7 + Math.random() * .6, 1500);
    }
  };

  PerfumePour.prototype.tick = function () {
    const now = performance.now();
    const dt = Math.min(.05, (now - this.last) / 1000);
    this.last = now;
    const vw = window.innerWidth, vh = window.innerHeight;
    const sy = window.scrollY;
    const v = (sy - this.lastScroll) / Math.max(dt, .001);
    this.lastScroll = sy;
    this.vel += (v - this.vel) * Math.min(1, dt * 10);

    const nr = this.neck.getBoundingClientRect();
    const br = this.bottle.getBoundingClientRect();
    const mouth = { x: nr.left + nr.width / 2, y: nr.top + nr.height / 2 };
    const dx = mouth.x - (br.left + br.width / 2), dy = mouth.y - (br.top + br.height / 2);
    const dl = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / dl, y: dy / dl };
    const mouthOnScreen = mouth.y > -40 && mouth.y < vh + 40;

    // 1 — the stream pouring from the tipped bottle.
    if (this.pour > .4 && mouthOnScreen && dir.y > 0) {
      const rate = 46 * this.pour * dt;
      const n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.spawn(mouth.x + dir.x * 6 + (Math.random() - .5) * 6, mouth.y + dir.y * 6,
          dir.x * (140 + Math.random() * 60) + (Math.random() - .5) * 30, dir.y * 120 + Math.random() * 40,
          2.2 + Math.random() * 3.2, 1.6, 1700);
      }
    }

    // 2 — the lead drop.
    if (this.pour > .7 && !this.released) {
      this.released = true;
      this.lead.x = mouth.x;
      this.lead.y = mouth.y;
    }
    if (this.pour < .3 && this.released) { this.released = false; this.setLanded(false); }

    let showLead = false, stretch = 1;
    if (this.released) {
      const tr = this.target.getBoundingClientRect();
      const anchor = vh * .46;
      // As the footer word rises into view, the drop descends onto it; it lands at the
      // very bottom of the page (the furthest anyone can scroll).
      const maxScroll = document.documentElement.scrollHeight - vh;
      const topAtMax = tr.top + sy - maxScroll;
      const k = clamp01((vh - tr.top) / Math.max(1, vh - topAtMax));
      const landY = tr.top + tr.height * .18;
      let y = Math.max(anchor, mouthOnScreen ? mouth.y + 34 : -Infinity);
      y = y + (landY - y) * (k * k);
      // Stay inside the stream while the bottle is on screen, then glide to the centre.
      const lane = vw <= 720 ? vw - 18 : vw / 2; // phones: travel in the margin, clear of text
      const tx = mouthOnScreen ? mouth.x + dir.x * 40 : (k > .15 ? tr.left + tr.width / 2 : lane);
      this.lead.x += (tx - this.lead.x) * Math.min(1, dt * (mouthOnScreen ? 6 : .9));
      this.lead.y += (y - this.lead.y) * Math.min(1, dt * 8);

      const landedNow = k > .94;
      if (landedNow !== this.landed) {
        if (landedNow) this.splash(this.lead.x, landY);
        this.setLanded(landedNow);
      }
      showLead = !this.landed;
      stretch = 1 + Math.min(1.1, Math.abs(this.vel) / 1600);

      // Tiny beads shed behind the falling drop (they rise as the page moves past it).
      if (showLead && Math.abs(this.vel) > 40 && Math.random() < Math.min(.9, Math.abs(this.vel) / 900)) {
        this.spawn(this.lead.x + (Math.random() - .5) * 8, this.lead.y - 14,
          (Math.random() - .5) * 20, -Math.sign(this.vel) * (60 + Math.random() * 80), 1.2 + Math.random() * 2, .55, -40);
      }
    }

    // Render.
    const ctx = this.ctx, k = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= p.max || p.y > vh + 30 || p.y < -60) { this.parts.splice(i, 1); continue; }
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, (1 - t) * 1.6);
      const s = p.s * k * 2;
      ctx.drawImage(this.bead, p.x * k - s / 2, p.y * k - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    if (showLead) {
      const w = 32 * k / Math.sqrt(stretch), h = 46 * k * stretch;
      const wob = Math.sin(now / 160) * .06;
      ctx.save();
      ctx.translate(this.lead.x * k, this.lead.y * k);
      ctx.scale(1 + wob, 1 - wob);
      ctx.drawImage(this.drop, -w / 2, -h * .62, w, h);
      ctx.restore();
    }
    this.canvas.style.opacity = showLead || this.parts.length ? '1' : '0';
  };

  PerfumePour.prototype.setLanded = function (on) {
    if (this.landed === on) return;
    this.landed = on;
    this.onLand(on);
  };

  window.JM = window.JM || {};
  window.JM.PerfumePour = PerfumePour;
})();
