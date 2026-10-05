// Homepage motion: cinematic hero intro, idle life, scroll choreography and section reveals.
// Layers are split so every element is owned by one kind of animation:
//   .bottle (outer)        → intro y/x, scroll scale/xPercent/yPercent/opacity
//   .bottle__float (inner) → intro opacity/scale/blur, idle y float
//   [data-cap] (wrapper)   → scroll lift      · its <img> → intro lift
//   [data-bloom] (wrapper) → scroll parallax  · its <img> → intro bloom + idle breathing
//   [data-petals] (group)  → scroll           · each petal → intro burst + idle drift
(function () {
  const root = document.documentElement;
  const done = () => { root.classList.remove('cine-pending'); root.classList.add('cine-ready'); };
  const hero = document.querySelector('[data-hero]');
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!hero || !gsap || !ScrollTrigger) { done(); return; }
  gsap.registerPlugin(ScrollTrigger);
  // Phones: the address bar showing/hiding must not re-measure (and jump) pinned scenes.
  ScrollTrigger.config({ ignoreMobileResize: true });

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const headerH = () => (document.getElementById('siteHeader')?.offsetHeight || 0);

  const els = {
    copy: $('[data-hero-copy]', hero),
    lines: $$('[data-hero-title] .tline__in', hero),
    copyBits: $$('[data-hero-copy] > [data-cine]', hero),
    visual: $('[data-hero-visual]', hero),
    stage: $('[data-stage]', hero),
    arch: $('[data-arch]', hero),
    backdrop: $('.stage__backdrop', hero),
    smoke: $('[data-smoke]', hero),
    hero: $('.bottle--hero', hero),
    heroFloat: $('.bottle--hero .bottle__float', hero),
    reflect: $('.bottle--hero .bottle__reflect', hero),
    cap: $('.bottle--hero [data-cap]', hero),
    capImg: $('.bottle--hero [data-cap] img', hero),
    women: $('.bottle--women', hero),
    unisex: $('.bottle--unisex', hero),
    sideFloats: $$('.bottle--side .bottle__float', hero),
    bloomBack: $('[data-bloom="back"]', hero),
    bloomFront: $('[data-bloom="front"]', hero),
    petalsGroup: $('[data-petals]', hero),
    petals: $$('[data-petal]', hero),
    badge: $('[data-badge]', hero),
    meta: $('[data-hero-meta]', hero),
    metaItems: $$('[data-hero-meta] > div', hero),
    glow: $('[data-glow]', hero),
    aura: $('[data-aura]', hero),
  };

  if (reduce.matches) { done(); return; }

  // ── Sparks (gold particle helix) ──────────────────────────
  const small = window.matchMedia('(max-width: 720px)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || navigator.connection?.saveData;
  const sparks = window.JM?.Sparks ? new window.JM.Sparks({
    back: $('[data-sparks="back"]', hero),
    front: $('[data-sparks="front"]', hero),
    anchor: els.hero,
    count: small || lowPower ? 60 : 130,
  }) : null;

  // Only render the hero's continuous effects while it is on screen.
  const idle = [];
  const setLive = on => {
    idle.forEach(t => (on ? t.resume() : t.pause()));
    if (sparks) (on && !document.hidden ? sparks.start() : sparks.stop());
  };
  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: self => setLive(self.isActive) });
  document.addEventListener('visibilitychange', () => setLive(!document.hidden && ScrollTrigger.isInViewport(hero)));

  // ── 1. Intro timeline ─────────────────────────────────────
  function intro() {
    const stageBox = els.stage.getBoundingClientRect();
    const capBox = els.cap.getBoundingClientRect();
    const neck = { x: capBox.left + capBox.width / 2, y: capBox.top + capBox.height * .8 };

    gsap.set([els.glow, els.aura], { opacity: 0 });
    gsap.set(els.arch, { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(els.backdrop, { scale: 1.25 });
    gsap.set(els.smoke, { yPercent: 18, opacity: 0 });
    gsap.set(els.hero, { y: () => stageBox.height * .14 });
    gsap.set(els.heroFloat, { opacity: 0, scale: .84, filter: 'blur(10px)' });
    gsap.set(els.women, { x: -stageBox.width * .08 });
    gsap.set(els.unisex, { x: stageBox.width * .08 });
    gsap.set(els.sideFloats, { opacity: 0, scale: .92 });
    gsap.set([els.bloomBack.firstElementChild], { opacity: 0, scale: .35, rotation: -28, transformOrigin: '50% 60%' });
    gsap.set([els.bloomFront.firstElementChild], { opacity: 0, scale: .45, rotation: 24, yPercent: 18, transformOrigin: '60% 60%' });
    els.petals.forEach(p => {
      const r = p.getBoundingClientRect();
      gsap.set(p, {
        x: neck.x - (r.left + r.width / 2), y: neck.y - (r.top + r.height / 2),
        scale: 0, rotation: 0, opacity: 0,
      });
    });
    gsap.set(els.lines, { yPercent: 112 });
    gsap.set(els.copyBits, { opacity: 0, y: 26 });
    gsap.set(els.badge, { clipPath: 'inset(0% 0% 0% 100%)', x: 24 });
    gsap.set(els.metaItems, { opacity: 0, y: 18 });
    done(); // initial states are applied — reveal the (now hidden by GSAP) layers

    const S = { v: 0 };
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: startIdle });
    tl.to([els.glow, els.aura], { opacity: 1, duration: 2.4, ease: 'sine.out' }, 0)
      .to(els.arch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' }, 0)
      .to(els.backdrop, { scale: 1.05, duration: 2.6, ease: 'power2.out' }, .2)
      .to(els.smoke, { yPercent: 0, opacity: .3, duration: 2.4, ease: 'sine.out' }, .5)
      // The bottle rises into the light and comes into focus.
      .to(els.hero, { y: 0, duration: 1.9, ease: 'expo.out' }, .35)
      .to(els.heroFloat, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' }, .35)
      .to([els.women, els.unisex], { x: 0, duration: 1.8, ease: 'expo.out' }, .8)
      .to(els.sideFloats, { opacity: 1, scale: 1, duration: 1.4, stagger: .12 }, .8)
      // The cap lifts, the bloom opens and petals escape the bottle…
      .to(els.capImg, { yPercent: -70, xPercent: 8, rotation: -14, duration: .9, ease: 'power2.out' }, 1.15)
      .to(els.bloomBack.firstElementChild, { opacity: .92, scale: 1, rotation: 0, duration: 2.4, ease: 'expo.out' }, 1.25)
      .to(els.bloomFront.firstElementChild, { opacity: 1, scale: 1, rotation: 0, yPercent: 0, duration: 2.4, ease: 'expo.out' }, 1.4)
      .to(els.petals, {
        x: 0, y: 0, opacity: 1, duration: 2, ease: 'expo.out',
        scale: i => parseFloat(els.petals[i].style.getPropertyValue('--s')) || 1,
        rotation: i => parseFloat(els.petals[i].style.getPropertyValue('--r')) || 0,
        stagger: { each: .07, from: 'random' },
      }, 1.3)
      .to(S, { v: 1, duration: 2.2, ease: 'sine.inOut', onUpdate: () => { if (sparks) sparks.intensity = S.v; } }, 1.2)
      // …and the cap settles back while the scene holds.
      .to(els.capImg, { yPercent: 0, xPercent: 0, rotation: 0, duration: 1.3, ease: 'power3.inOut' }, 2.5)
      // Copy arrives once the visual has established itself.
      .to(els.copyBits[0], { opacity: 1, y: 0, duration: 1 }, .9)
      .to(els.lines, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: .12 }, 1.0)
      .to(els.copyBits.slice(1), { opacity: 1, y: 0, duration: 1.1, stagger: .12 }, 1.55)
      .to(els.badge, { clipPath: 'inset(0% 0% 0% 0%)', x: 0, duration: 1.3, ease: 'expo.inOut' }, 2.0)
      .to(els.metaItems, { opacity: 1, y: 0, duration: 1, stagger: .1 }, 2.2);
    return tl;
  }

  // ── 2. Idle life (paused off-screen) ──────────────────────
  function startIdle() {
    const sine = { ease: 'sine.inOut', yoyo: true, repeat: -1 };
    idle.push(
      gsap.to(els.heroFloat, { y: -9, duration: 3.4, ...sine }),
      gsap.to(els.sideFloats[0], { y: -7, duration: 4.1, delay: .6, ...sine }),
      gsap.to(els.sideFloats[1], { y: -6, duration: 3.8, delay: 1.1, ...sine }),
      gsap.to(els.bloomFront.firstElementChild, { rotation: 3, scale: 1.035, duration: 6.5, ...sine }),
      gsap.to(els.bloomBack.firstElementChild, { rotation: -4, scale: 1.04, duration: 7.5, delay: 1, ...sine }),
      gsap.to(els.smoke, { yPercent: -6, opacity: .2, duration: 8, ...sine }),
      gsap.to(els.glow, { scale: 1.08, opacity: .75, duration: 9, ...sine }),
    );
    els.petals.forEach((p, i) => {
      idle.push(gsap.to(p, {
        yPercent: gsap.utils.random(-70, 70), xPercent: gsap.utils.random(-45, 45),
        rotation: '+=' + gsap.utils.random(-30, 30),
        duration: gsap.utils.random(4.5, 7.5), delay: i * .2, ...sine,
      }));
    });
    if (!ScrollTrigger.isInViewport(hero)) setLive(false);
  }

  // ── 3. Scroll choreography ────────────────────────────────
  const mm = gsap.matchMedia();
  const Pour = { v: 0 };
  let pour = null;
  const syncPour = () => { if (pour) pour.pour = Pour.v; };

  // Desktop: pin the hero briefly and dolly into the product.
  mm.add('(min-width: 1025px)', () => {
    const toCenter = () => {
      const r = els.visual.getBoundingClientRect();
      const current = gsap.getProperty(els.visual, 'x');
      return window.innerWidth / 2 - (r.left - current + r.width / 2);
    };
    const S = { v: 1 };
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: () => 'top top+=' + headerH(),
        end: '+=75%',
        pin: true,
        scrub: .9,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });
    tl.to(els.copy, { y: -90, opacity: 0, duration: .55, ease: 'power1.in' }, 0)
      .to(els.meta, { y: 40, opacity: 0, duration: .4 }, 0)
      .to(els.badge, { opacity: 0, y: 30, duration: .35 }, 0)
      .to(els.visual, { x: toCenter, duration: 1, ease: 'power2.inOut' }, 0)
      .to(els.hero, { scale: 1.16, yPercent: -3, duration: 1, ease: 'power1.inOut' }, 0)
      // The bottle opens (cap flies off), tips over and starts to pour.
      .to(els.cap, { yPercent: -260, xPercent: 60, rotation: -40, opacity: 0, duration: .4, ease: 'power2.in' }, .08)
      .to(els.reflect, { opacity: 0, duration: .15 }, .3)
      .to(els.hero, { rotation: 132, xPercent: -10, duration: .5, ease: 'power2.inOut' }, .32)
      .to(Pour, { v: 1, duration: .3, onUpdate: syncPour }, .62)
      .to(els.women, { xPercent: -70, scale: .9, opacity: .45, duration: 1 }, 0)
      .to(els.unisex, { xPercent: 70, scale: .9, opacity: .45, duration: 1 }, 0)
      .to(els.bloomFront, { yPercent: -38, xPercent: -14, scale: 1.3, duration: 1 }, 0)
      .to(els.bloomBack, { yPercent: 16, xPercent: 8, scale: 1.12, rotation: 10, duration: 1 }, 0)
      .to(els.arch, { scale: 1.07, duration: 1 }, 0)
      .to(els.backdrop, { yPercent: 8, duration: 1 }, 0)
      .to(els.petalsGroup, { scale: 1.3, yPercent: -10, duration: 1 }, 0)
      .to([els.glow, els.aura], { scale: 1.3, duration: 1 }, 0)
      .to(S, { v: 1.55, duration: 1, onUpdate: () => { if (sparks) sparks.spread = S.v; } }, 0);
    return () => { if (sparks) sparks.spread = 1; };
  });

  // Tablet & phone: no pinning — light parallax as the hero scrolls away.
  mm.add('(min-width: 721px) and (max-width: 1024px)', () => {
    const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: .6 };
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: st })
      .to(els.bloomFront, { yPercent: -30, scale: 1.12, duration: 1 }, 0)
      .to(els.bloomBack, { yPercent: 14, duration: 1 }, 0)
      .to(els.hero, { yPercent: -5, scale: 1.05, duration: 1 }, 0)
      .to(els.cap, { yPercent: -260, xPercent: 50, rotation: -40, opacity: 0, duration: .25 }, 0)
      .to(els.reflect, { opacity: 0, duration: .1 }, .1)
      .to(els.hero, { rotation: 132, duration: .35, ease: 'power2.inOut' }, .12)
      .to(Pour, { v: 1, duration: .2, onUpdate: syncPour }, .4)
      .to(els.women, { xPercent: -18, duration: 1 }, 0)
      .to(els.unisex, { xPercent: 18, duration: 1 }, 0)
      .to(els.petalsGroup, { yPercent: -16, duration: 1 }, 0)
      .to(els.backdrop, { yPercent: 10, duration: 1 }, 0);
  });

  // Phones: the stage is the first thing on screen, so hold it in place briefly
  // (short pin) while the bottle opens, tips over and pours — then scroll on.
  mm.add('(max-width: 720px)', () => {
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: () => 'top top+=' + headerH(),
        end: '+=65%',
        pin: true,
        scrub: .5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    })
      .to(els.cap, { yPercent: -260, xPercent: 50, rotation: -40, opacity: 0, duration: .22, ease: 'power2.in' }, 0)
      .to(els.reflect, { opacity: 0, duration: .1 }, .1)
      .to(els.badge, { opacity: 0, y: 20, duration: .2 }, 0)
      .to(els.hero, { rotation: 132, scale: 1.08, duration: .4, ease: 'power2.inOut' }, .14)
      .to(els.women, { xPercent: -30, opacity: .5, duration: 1 }, 0)
      .to(els.unisex, { xPercent: 30, opacity: .5, duration: 1 }, 0)
      .to(els.bloomFront, { yPercent: -20, scale: 1.1, duration: 1 }, 0)
      .to(els.bloomBack, { yPercent: 10, duration: 1 }, 0)
      .to(els.petalsGroup, { yPercent: -12, scale: 1.15, duration: 1 }, 0)
      .to(Pour, { v: 1, duration: .25, onUpdate: syncPour }, .5);
  });

  // ── 4. Perfume pour → the footer signature lights up in gold neon ──
  function perfume() {
    const word = $('.site-footer__giant');
    if (!window.JM?.PerfumePour || !word) return;
    gsap.set(word, { '--fill': '0%' });
    let fill;
    pour = new window.JM.PerfumePour({
      bottle: els.hero,
      neck: $('.bottle--hero .bottle__neck', hero),
      target: word,
      onLand: landed => {
        if (fill) fill.kill();
        if (landed) {
          // The letters fill with perfume, then switch on like a neon sign.
          fill = gsap.timeline()
            .to(word, { '--fill': '100%', duration: 1.8, ease: 'power2.inOut' })
            .add(() => word.classList.add('is-lit'), '-=.25');
        } else {
          word.classList.remove('is-lit');
          fill = gsap.to(word, { '--fill': '0%', duration: .6, ease: 'power2.out' });
        }
      },
    });
    syncPour();
    pour.start();
    document.addEventListener('visibilitychange', () => (document.hidden ? pour.stop() : pour.start()));
  }

  // ── 5. Sections ───────────────────────────────────────────
  function sections() {
    // Headings: masked word reveal, eyebrow + link follow.
    $$('[data-head]').forEach(head => {
      const title = $('.display', head);
      const words = window.JM?.splitWords ? window.JM.splitWords(title) : [];
      const extras = $$('.eyebrow, .link-arrow, p:not(.eyebrow), .btn', head);
      gsap.set(words, { yPercent: 110 });
      gsap.set(extras, { opacity: 0, y: 18 });
      gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 86%', once: true } })
        .to(words, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: .045 })
        .to(extras, { opacity: 1, y: 0, duration: .9, ease: 'power2.out', stagger: .08 }, .15);
    });

    // Collection cards: curtain reveal, image settles from a slow zoom, then parallax.
    const cats = $$('[data-cat]');
    if (cats.length) {
      cats.forEach(c => gsap.set(c, { clipPath: 'inset(100% 0% 0% 0%)' }));
      gsap.set(cats.map(c => $('.cat__media', c)), { scale: 1.3 });
      gsap.set(cats.map(c => $('.cat__body', c)), { opacity: 0, y: 30 });
      ScrollTrigger.batch(cats, {
        start: 'top 88%', once: true,
        onEnter: batch => {
          gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', stagger: .15 });
          gsap.to(batch.map(c => $('.cat__media', c)), { scale: 1.08, duration: 2.2, ease: 'expo.out', stagger: .15 });
          gsap.to(batch.map(c => $('.cat__body', c)), { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .15, delay: .6 });
        },
      });
      cats.forEach(c => gsap.fromTo($('.cat__media', c), { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true },
      }));
    }

    // Product grids: soft staggered rise.
    $$('[data-cards]').forEach(grid => {
      const cards = [...grid.children];
      gsap.set(cards, { opacity: 0, y: 50 });
      ScrollTrigger.batch(cards, {
        start: 'top 90%', once: true,
        onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .09 }),
      });
    });

    // Story: monogram drifts against the scroll; stats count up.
    const mark = $('[data-story-mark]');
    if (mark) gsap.fromTo(mark, { yPercent: 18 }, {
      yPercent: -18, ease: 'none',
      scrollTrigger: { trigger: mark.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    const stats = $('[data-stats]');
    if (stats) {
      const rows = [...stats.children];
      gsap.set(rows, { opacity: 0, x: 40 });
      ScrollTrigger.create({
        trigger: stats, start: 'top 82%', once: true,
        onEnter: () => {
          gsap.to(rows, { opacity: 1, x: 0, duration: 1.1, ease: 'power3.out', stagger: .12 });
          rows.forEach((row, i) => {
            const strong = $('strong', row);
            const m = strong && strong.textContent.match(/^(\D*)(\d+)(.*)$/);
            if (!m) return;
            const o = { n: 0 }, target = +m[2];
            gsap.to(o, {
              n: target, duration: 1.8, delay: i * .12, ease: 'power2.out',
              onUpdate: () => { strong.textContent = m[1] + Math.round(o.n) + m[3]; },
            });
          });
        },
      });
    }
  }

  // ── Boot ──────────────────────────────────────────────────
  const boot = () => {
    try {
      intro();
      perfume();
      sections();
      if (sparks) { sparks.resize(); setLive(true); }
    } catch (e) {
      done();
      gsap.set('[data-hero] [data-cine], [data-stage] > *', { clearProps: 'all' });
      console.error(e);
    }
  };
  // Start once the hero bottle is decoded so the entrance never shows a half-loaded image.
  const img = $('.bottle--hero .bottle__body', hero);
  const ready = img && !img.complete ? new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }) : Promise.resolve();
  Promise.race([ready, new Promise(r => setTimeout(r, 1800))]).then(boot);

  window.addEventListener('load', () => ScrollTrigger.refresh());
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (sparks) sparks.resize(); if (pour) pour.resize(); }, 150); });
})();
