// ════════════════════════════════════════════════════════════════
//  HALO — Ouverture après connexion (« la pièce s'allume »)
//  1. Lumières floues + logo ARTEMIS (pendant le chargement des données)
//  2. Une pièce baignée de soleil se dévoile en se défloutant
//  3. L'application apparaît par un cercle qui s'agrandit et se défloute
//  Joué uniquement juste après une connexion (pas au simple rechargement),
//  désactivé si « Animations » est coupé ou si le système demande moins d'animations.
// ════════════════════════════════════════════════════════════════
(function () {
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const MIN_ROOM_MS = 1900;     // durée minimale avant la révélation
  const MAX_WAIT_MS = 9000;     // sécurité : révélation forcée si le chargement traîne
  let ov = null, t0 = 0, revealAsked = false, revealed = false, safety = null;

  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animOn = () => { try { return haloUI().anim !== false; } catch (e) { return true; } };

  // ── La pièce : intérieur baigné de soleil, dessiné (aucune image à charger) ──
  function drawRoom(cv) {
    const W = cv.width = Math.min(1600, innerWidth), H = cv.height = Math.round(W * innerHeight / innerWidth);
    const c = cv.getContext('2d');
    const X = f => f * W, Y = f => f * H;
    // Murs et plafond
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#24150f'); g.addColorStop(.5, '#3a2219'); g.addColorStop(1, '#1d110c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // Baie vitrée : ciel de fin de journée
    const wx0 = X(.06), wx1 = X(.94), wy0 = Y(.16), wy1 = Y(.64);
    g = c.createLinearGradient(0, wy0, 0, wy1);
    g.addColorStop(0, '#d9a58a'); g.addColorStop(.4, '#f6c79c'); g.addColorStop(.72, '#ffc98f'); g.addColorStop(.8, '#e9a07a'); g.addColorStop(.84, '#9d7c86'); g.addColorStop(1, '#6f5a63');
    c.fillStyle = g; c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    // Soleil bas sur l'horizon
    g = c.createRadialGradient(X(.6), Y(.5), 0, X(.6), Y(.5), X(.38));
    g.addColorStop(0, 'rgba(255,252,238,1)'); g.addColorStop(.08, 'rgba(255,240,205,1)'); g.addColorStop(.3, 'rgba(255,214,160,.7)'); g.addColorStop(1, 'rgba(255,190,120,0)');
    c.fillStyle = g; c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    // Montants de la baie
    // Collines au loin
    c.fillStyle = 'rgba(120,88,96,.55)'; c.beginPath(); c.moveTo(wx0, Y(.555));
    for (let i = 0; i <= 20; i++) { const x = wx0 + (wx1 - wx0) * i / 20; c.lineTo(x, Y(.555) - Math.sin(i * 1.3) * Y(.012) - Math.sin(i * .45) * Y(.018)); }
    c.lineTo(wx1, wy1); c.lineTo(wx0, wy1); c.closePath(); c.fill();
    c.fillStyle = '#2a1912';
    for (let i = 0; i <= 10; i++) { const x = wx0 + (wx1 - wx0) * i / 10; c.fillRect(x - X(.003), wy0, X(.006), wy1 - wy0); }
    c.fillRect(wx0, Y(.27) - Y(.004), wx1 - wx0, Y(.008));
    // Plafond en perspective
    g = c.createLinearGradient(0, 0, 0, wy0);
    g.addColorStop(0, '#1a0f0b'); g.addColorStop(1, '#3d2519');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(wx1, wy0); c.lineTo(wx0, wy0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,200,150,.08)'; c.lineWidth = 2;
    for (let i = 1; i < 8; i++) { const f = i / 8; c.beginPath(); c.moveTo(X(f), 0); c.lineTo(wx0 + (wx1 - wx0) * f, wy0); c.stroke(); }
    // Sol : parquet chaud avec reflets de la baie
    g = c.createLinearGradient(0, wy1, 0, H);
    g.addColorStop(0, '#7a4a33'); g.addColorStop(.35, '#4a2b1e'); g.addColorStop(1, '#1e110c');
    c.fillStyle = g; c.beginPath(); c.moveTo(wx0, wy1); c.lineTo(wx1, wy1); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    for (let i = 0; i < 10; i++) {
      const xa = wx0 + (wx1 - wx0) * (i + .15) / 10, xb = wx0 + (wx1 - wx0) * (i + .85) / 10;
      const sp = (x) => W / 2 + (x - W / 2) * 1.9;
      g = c.createLinearGradient(0, wy1, 0, H);
      g.addColorStop(0, 'rgba(255,214,160,.2)'); g.addColorStop(1, 'rgba(255,214,160,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(xa, wy1); c.lineTo(xb, wy1); c.lineTo(sp(xb), H); c.lineTo(sp(xa), H); c.closePath(); c.fill();
    }
    // Rayons de lumière dans l'air
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = X(.3 + i * .14);
      g = c.createLinearGradient(x, wy0, x - X(.2), H);
      g.addColorStop(0, 'rgba(255,200,140,.10)'); g.addColorStop(1, 'rgba(255,200,140,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, wy0); c.lineTo(x + X(.05), wy0); c.lineTo(x - X(.12), H); c.lineTo(x - X(.26), H); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // Silhouettes du mobilier
    c.fillStyle = 'rgba(23,13,9,.82)';
    const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); };
    rr(X(.10), Y(.70), X(.30), Y(.09), X(.012));      // canapé
    rr(X(.08), Y(.66), X(.05), Y(.13), X(.01));
    rr(X(.52), Y(.71), X(.36), Y(.025), X(.004));     // grande table
    for (let i = 0; i < 5; i++) rr(X(.54 + i * .07), Y(.735), X(.03), Y(.08), X(.006));  // chaises
    rr(X(.86), Y(.40), X(.035), Y(.36), X(.012));     // plante / lampe
    // Vignettage
    g = c.createRadialGradient(W / 2, H * .5, Math.min(W, H) * .25, W / 2, H * .5, Math.max(W, H) * .75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,3,.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function build() {
    const el = document.createElement('div');
    el.id = 'hintro';
    el.innerHTML =
      '<div class="hi-bokeh"><i></i><i></i><i></i><i></i><i></i></div>' +
      '<canvas class="hi-room"></canvas>' +
      '<div class="hi-brand"><img src="icon-192.png" alt=""><b>ARTEMIS</b></div>';
    document.body.appendChild(el);
    drawRoom(el.querySelector('.hi-room'));
    return el;
  }

  // Appelé au clic sur « Connexion », avant même la réponse de Firebase
  window.haloIntroStart = function () {
    if (ov || reduced() || !animOn()) return;
    revealAsked = revealed = false;
    t0 = performance.now();
    ov = build();
    const room = ov.querySelector('.hi-room'), bokeh = ov.querySelector('.hi-bokeh'), brand = ov.querySelector('.hi-brand');
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'forwards' });
    brand.animate([{ opacity: 0, transform: 'translateY(8px) scale(.96)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 700, delay: 120, easing: EASE, fill: 'both' });
    // La pièce s'allume
    room.animate([
      { opacity: 0, filter: 'blur(40px) brightness(.35)', transform: 'scale(1.1)' },
      { opacity: 1, filter: 'blur(9px) brightness(1.05)', transform: 'scale(1.02)' },
    ], { duration: 1600, delay: 350, easing: EASE, fill: 'both' });
    bokeh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1100, delay: 700, easing: 'ease-in-out', fill: 'both' });
    safety = setTimeout(() => { revealAsked = true; reveal(); }, MAX_WAIT_MS);
  };

  // Identifiants refusés : on retire l'ouverture
  window.haloIntroCancel = function () {
    clearTimeout(safety);
    if (!ov) return;
    const el = ov; ov = null;
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).onfinish = () => el.remove();
  };

  // Appelé quand l'application est prête (données chargées, première page affichée)
  window.haloIntroReveal = function () {
    if (!ov || revealAsked) return;
    revealAsked = true;
    const wait = Math.max(0, MIN_ROOM_MS - (performance.now() - t0));
    setTimeout(reveal, wait);
  };

  function reveal() {
    if (!ov || revealed) return;
    revealed = true; clearTimeout(safety);
    const el = ov, app = document.getElementById('mainContent');
    el.querySelector('.hi-brand').animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.04)', filter: 'blur(6px)' }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    if (!app) { finish(el, null); return; }
    app.classList.add('hi-reveal');
    // Les animations d'arrivée de la page se jouent pendant la révélation
    try { if (window._haloRoute === 'home') haloRenderHome(true); else haloAnimateRoute(window._haloRoute); } catch (e) {}
    const a = app.animate([
      { clipPath: 'circle(0% at 50% 50%)', filter: 'blur(22px)' },
      { clipPath: 'circle(80% at 50% 50%)', filter: 'blur(0px)' },
    ], { duration: 1500, delay: 180, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both' });
    // Pendant que le cercle s'ouvre, la pièce s'éclaire et se fond dans le fond du site (pas de coupure à la fin)
    const room = el.querySelector('.hi-room');
    room.getAnimations().forEach(x => { try { x.commitStyles(); } catch (e) {} x.cancel(); });
    room.animate([
      { filter: 'blur(9px) brightness(1.05) saturate(1)', transform: 'scale(1.02)' },
      { filter: 'blur(36px) brightness(1.9) saturate(.7)', transform: 'scale(1.12)' },
    ], { duration: 1500, delay: 180, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1250, delay: 480, easing: 'cubic-bezier(.4,0,.4,1)', fill: 'forwards' });
    a.onfinish = () => finish(el, a);
  }

  function finish(el, a) {
    const app = document.getElementById('mainContent');
    const f = el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 30, fill: 'forwards' });
    f.onfinish = () => {
      el.remove();
      if (a) a.cancel();
      if (app) app.classList.remove('hi-reveal');
      if (ov === el) ov = null;
    };
  }
})();
