// Gold particle helix around the hero bottle. Two canvases give real depth:
// particles on the far side of the swirl are drawn behind the bottle, near ones in front.
(function () {
  function makeSprite(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,244,214,1)');
    g.addColorStop(.25, 'rgba(236,206,140,.85)');
    g.addColorStop(.6, 'rgba(212,170,92,.25)');
    g.addColorStop(1, 'rgba(212,170,92,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    return c;
  }

  function Sparks(opts) {
    this.back = opts.back;
    this.front = opts.front;
    this.anchor = opts.anchor;
    this.count = opts.count || 60;
    this.intensity = 0; // 0 → 1 during the intro
    this.spread = 1;    // widened by scroll
    this.sprite = makeSprite(32);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.running = false;
    this.parts = [];
    this.time = 0;
    for (let i = 0; i < this.count; i++) {
      this.parts.push({
        u: i / this.count + Math.random() * .02,     // position along the spiral ribbon (0 = neck)
        v: .05 + Math.random() * .03,                // travel speed along the ribbon
        j: (Math.random() - .5) * .5,                // angular jitter → ribbon thickness
        d: (Math.random() - .5) * .16,               // radial jitter
        s: .3 + Math.random() * .9,                  // size factor
        t: Math.random() * Math.PI * 2,              // twinkle phase
      });
    }
    this.resize();
    this.tick = this.tick.bind(this);
  }

  Sparks.prototype.resize = function () {
    [this.back, this.front].forEach(c => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width * this.dpr));
      c.height = Math.max(1, Math.round(r.height * this.dpr));
    });
  };

  Sparks.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    window.gsap.ticker.add(this.tick);
  };
  Sparks.prototype.stop = function () {
    this.running = false;
    window.gsap.ticker.remove(this.tick);
  };

  Sparks.prototype.tick = function () {
    const now = performance.now();
    const dt = Math.min(.05, (now - this.last) / 1000);
    this.last = now;
    const bc = this.back.getContext('2d'), fc = this.front.getContext('2d');
    const W = this.back.width, H = this.back.height;
    bc.clearRect(0, 0, W, H);
    fc.clearRect(0, 0, W, H);
    if (this.intensity <= .001) return;

    const cr = this.back.getBoundingClientRect();
    const br = this.anchor.getBoundingClientRect();
    const k = this.dpr * (W / this.dpr / cr.width || 1);
    const cx = (br.left + br.width / 2 - cr.left) * k;
    const top = (br.top - br.height * .04 - cr.top) * k;     // above the cap
    const bottom = (br.top + br.height * .52 - cr.top) * k;
    const R = br.width * 1.05 * k * this.spread;
    bc.globalCompositeOperation = fc.globalCompositeOperation = 'lighter';
    this.time += dt;

    for (const p of this.parts) {
      p.u += p.v * dt;
      if (p.u > 1) p.u -= 1;
      p.t += dt * 4;
      // A rising helix that opens up as it leaves the bottle, slowly turning.
      const u = p.u;
      const ang = u * Math.PI * 3.2 + this.time * .55 + p.j;
      const rad = R * (.28 + u * .95) * (1 + p.d);
      const x = cx + Math.cos(ang) * rad;
      const y = bottom - (bottom - top) * (.15 + u * 1.25) + Math.sin(ang) * rad * .26;
      const z = Math.sin(ang);
      const fade = Math.min(1, u * 8) * Math.min(1, (1 - u) * 2.5);
      const alpha = this.intensity * fade * (.55 + .45 * Math.abs(Math.sin(p.t))) * (.5 + .5 * (z + 1) / 2);
      if (alpha < .02) continue;
      const size = (4 + p.s * 11) * (.6 + .4 * (z + 1) / 2) * this.dpr;
      const ctx = z < 0 ? bc : fc;
      ctx.globalAlpha = Math.min(1, alpha * 1.2);
      ctx.drawImage(this.sprite, x - size / 2, y - size / 2, size, size);
    }
    bc.globalAlpha = fc.globalAlpha = 1;
  };

  window.JM = window.JM || {};
  window.JM.Sparks = Sparks;
})();
