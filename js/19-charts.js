// ════════════════════════════════════════════
//  ARTEMIS — MOTEUR DE GRAPHIQUES (canvas)
//  Un seul rendu pour tous les graphiques du dashboard :
//    ArtCharts.area(canvas, cfg)       courbe d'évolution + survol
//    ArtCharts.donut(canvas, cfg)      anneau de répartition + légende
//    ArtCharts.diverging(canvas, cfg)  barres P1 vs P2 (drivers)
//  Chaque graphique gère la netteté Retina, le redimensionnement,
//  le survol souris / tactile et une infobulle positionnée dans son cadre.
// ════════════════════════════════════════════

const ArtCharts = (() => {
  const FONT = 'Archivo, system-ui, sans-serif';
  const C = {
    text: '#e2e8f3', text2: '#8a9ab2', grid: 'rgba(255,255,255,0.055)', zero: 'rgba(255,255,255,0.18)',
    card: '#141922', green: '#22c97a', red: '#f0566a', cyan: '#22d3c8', gold: '#f5b731', purple: '#9b6ef3'
  };
  const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MONTHS_L = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const MONTH_IN = { jan: 0, fév: 1, fev: 1, mar: 2, avr: 3, mai: 4, juin: 5, juil: 6, aoû: 7, aou: 7, sep: 8, oct: 9, nov: 10, déc: 11, dec: 11 };

  // ── Formats ────────────────────────────────
  const nbsp = '\u00a0';
  const fmtEur = (v, signed) => {
    const s = Math.round(Math.abs(v)).toLocaleString('fr-FR').replace(/\s/g, nbsp) + nbsp + '€';
    return (v < 0 ? '−' : signed && v > 0 ? '+' : '') + s;
  };
  const fmtAxis = v => {
    const a = Math.abs(v);
    let s;
    if (a >= 1e6) s = (a / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + nbsp + 'M€';
    else if (a >= 1e4) s = Math.round(a / 1e3).toLocaleString('fr-FR') + nbsp + 'k€';
    else if (a >= 1e3) s = (a / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + nbsp + 'k€';
    else s = Math.round(a) + nbsp + '€';
    return (v < 0 ? '−' : '') + s;
  };
  const fmtPct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + nbsp + '%';

  // Libellés de période : accepte 'YYYY-MM' ou 'Jan 2025' / 'Fév 2025'
  const parsePeriod = lbl => {
    let m = String(lbl).match(/^(\d{4})-(\d{2})/);
    if (m) return { y: +m[1], m: +m[2] - 1 };
    m = String(lbl).trim().match(/^([^\s\d]+)\.?\s+(\d{4})$/);
    if (m) {
      const k = m[1].toLowerCase();
      const idx = MONTH_IN[k] ?? MONTH_IN[k.slice(0, 3)];
      if (idx !== undefined) return { y: +m[2], m: idx };
    }
    return null;
  };

  // ── Canvas net et redimensionnable ─────────
  function setup(cv, height) {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(120, Math.floor(cv.parentElement.clientWidth));
    const H = height;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.style.display = 'block';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    return { ctx, W, H };
  }
  function observe(cv, fn) {
    if (cv._acRO) cv._acRO.disconnect();
    let lastW = cv.parentElement.clientWidth, lastH = cv.parentElement.clientHeight;
    cv._acRO = new ResizeObserver(() => {
      if (!document.body.contains(cv)) { cv._acRO.disconnect(); return; }
      const w = cv.parentElement.clientWidth, h = cv.parentElement.clientHeight;
      const fill = cv.parentElement.classList.contains('ac-fill');
      if (Math.abs(w - lastW) < 1 && (!fill || Math.abs(h - lastH) < 1)) return;
      lastW = w; lastH = h; requestAnimationFrame(fn);
    });
    cv._acRO.observe(cv.parentElement);
  }

  // ── Infobulle DOM, contenue dans le cadre du graphique ──
  function tip(cv) {
    const host = cv.parentElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    let t = host.querySelector(':scope > .ac-tip');
    if (!t) { t = document.createElement('div'); t.className = 'ac-tip'; host.appendChild(t); }
    return {
      show(html, x, y) {
        t.innerHTML = html; t.classList.add('on');
        const hw = host.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        // À côté du curseur (jamais dessus), centrée verticalement et contenue dans le cadre
        let left = x + 18; if (left + tw > hw - 4) left = x - tw - 18; if (left < 4) left = 4;
        let top = Math.min(Math.max(4, y - th / 2), host.clientHeight - th - 4);
        t.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
      },
      hide() { t.classList.remove('on'); }
    };
  }
  const pointer = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hexA = (hex, a) => {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  function niceScale(min, max, n) {
    if (typeof _niceScale === 'function') return _niceScale(min, max, n);
    const step = Math.pow(10, Math.floor(Math.log10((max - min) / n || 1)));
    const ticks = []; for (let v = Math.floor(min / step) * step; v <= max + step * 1e-3; v += step) ticks.push(v);
    return { ticks, min: ticks[0], max: ticks[ticks.length - 1] };
  }
  function tightScale(min, max) {
    let best = null;
    for (let n = 4; n <= 7; n++) {
      const sc = niceScale(min, max, n);
      if (sc.ticks.length > 8) continue;
      const waste = (sc.max - sc.min) / ((max - min) || 1);
      if (!best || waste < best.waste - 0.02) best = Object.assign(sc, { waste });
    }
    return best || niceScale(min, max, 4);
  }
  // Courbe monotone (Fritsch–Carlson) : lisse sans jamais dépasser les données
  function monotonePath(ctx, pts, move) {
    const n = pts.length;
    if (move) ctx.moveTo(pts[0].x, pts[0].y);
    if (n < 3) { for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y); return; }
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    for (let i = 0; i < n - 1; i++) {
      const h = (pts[i + 1].x - pts[i].x) / 3;
      ctx.bezierCurveTo(pts[i].x + h, pts[i].y + h * m[i], pts[i + 1].x - h, pts[i + 1].y - h * m[i + 1], pts[i + 1].x, pts[i + 1].y);
    }
  }
  function pill(ctx, x, y, text, color, align) {
    ctx.font = '700 11px ' + FONT;
    const tw = ctx.measureText(text).width, pw = tw + 14, ph = 20;
    const bx = align === 'right' ? x - pw : align === 'left' ? x : x - pw / 2;
    ctx.fillStyle = C.card; ctx.strokeStyle = hexA(color, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx + 0.5, y - ph / 2 + 0.5, pw - 1, ph - 1, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 7, y + 0.5);
    return { x: bx, w: pw };
  }

  // ════════════════ COURBE D'ÉVOLUTION ════════════════
  // cfg: { labels, values, color, height?, name?, signed?, deltaGoodWhenUp?, budget?:[valeur|null] }
  function area(cv, cfg) {
    if (!cv || !cfg.values || !cfg.values.length) return;
    const color = cfg.color || C.cyan, H = cfg.height || 240;
    const periods = cfg.labels.map(parsePeriod);
    const shortLbl = i => { const p = periods[i]; return p ? MONTHS_S[p.m] : String(cfg.labels[i]); };
    const longLbl = i => { const p = periods[i]; return p ? MONTHS_L[p.m] + ' ' + p.y : String(cfg.labels[i]); };
    const vals = cfg.values.map(v => +v || 0), n = vals.length;
    const T = tip(cv);
    let hover = -1, L;
    const colAt = i => cfg.signed && vals[i] < 0 ? C.red : color;
    // Série budget facultative (pointillés) : null = mois sans budget
    const bud = Array.isArray(cfg.budget) && cfg.budget.length === n && cfg.budget.some(v => v !== null && v !== undefined) ? cfg.budget.map(v => v === null || v === undefined ? null : +v) : null;
    const budVals = bud ? bud.filter(v => v !== null) : [];

    function layout(ctx, W) {
      const minV = Math.min(...vals, ...budVals, 0), maxV = Math.max(...vals, ...budVals, 0);
      const sc = niceScale(minV, maxV === minV ? minV + 1 : maxV, 4);
      ctx.font = '500 11px ' + FONT;
      const yW = Math.max(...sc.ticks.map(t => ctx.measureText(fmtAxis(t)).width));
      const P = { top: 30, right: 20, bottom: 40, left: Math.ceil(yW) + 16 };
      const cW = W - P.left - P.right, cH = H - P.top - P.bottom;
      const inset = n > 1 ? Math.min(18, cW / (n * 2)) : 0;
      const xOf = i => n === 1 ? P.left + cW / 2 : P.left + inset + i / (n - 1) * (cW - inset * 2);
      const yOf = v => P.top + cH - (v - sc.min) / (sc.max - sc.min || 1) * cH;
      return { sc, P, cW, cH, xOf, yOf, pts: vals.map((v, i) => ({ x: xOf(i), y: yOf(v) })) };
    }

    function draw() {
      const { ctx, W } = setup(cv, H);
      L = layout(ctx, W);
      const { sc, P, cW, cH, xOf, yOf, pts } = L;
      const y0 = yOf(Math.max(sc.min, Math.min(0, sc.max)));

      // Grille + axe Y
      ctx.font = '500 11px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      sc.ticks.forEach(t => {
        const y = Math.round(yOf(t)) + 0.5;
        ctx.strokeStyle = t === 0 && sc.min < 0 ? C.zero : C.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(P.left, y); ctx.lineTo(P.left + cW, y); ctx.stroke();
        ctx.fillStyle = C.text2; ctx.fillText(fmtAxis(t), P.left - 10, y);
      });

      // Axe X : mois courts, année sous janvier et sous le premier point, éclaircis selon la place
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const slot = n > 1 ? (xOf(1) - xOf(0)) : cW;
      const step = Math.max(1, Math.ceil(46 / slot));
      for (let i = 0; i < n; i++) {
        const isLast = i === n - 1;
        if (i % step && !(isLast && (n - 1) % step >= step / 2)) continue;
        const x = xOf(i), p = periods[i];
        ctx.fillStyle = i === hover ? C.text : C.text2; ctx.font = '500 11px ' + FONT;
        ctx.fillText(shortLbl(i), x, H - P.bottom + 18);
        if (p && (i === 0 || p.m === 0 || (i - step >= 0 && periods[i - step] && periods[i - step].y !== p.y))) {
          ctx.fillStyle = 'rgba(138,154,178,0.6)'; ctx.font = '600 10px ' + FONT;
          ctx.fillText(String(p.y), x, H - P.bottom + 32);
        }
      }

      // Surface dégradée jusqu'à la ligne zéro
      const areaPath = () => { ctx.beginPath(); monotonePath(ctx, pts, true); ctx.lineTo(pts[n - 1].x, y0); ctx.lineTo(pts[0].x, y0); ctx.closePath(); };
      if (cfg.signed && sc.min < 0) {
        // Signé : dégradé couleur au-dessus de zéro, rouge en dessous (chacun s'estompe vers la ligne zéro)
        const gUp = ctx.createLinearGradient(0, P.top, 0, y0);
        gUp.addColorStop(0, hexA(color, 0.28)); gUp.addColorStop(1, hexA(color, 0.02));
        const gDn = ctx.createLinearGradient(0, y0, 0, P.top + cH);
        gDn.addColorStop(0, hexA(C.red, 0.02)); gDn.addColorStop(1, hexA(C.red, 0.28));
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, y0); ctx.clip(); areaPath(); ctx.fillStyle = gUp; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, H); ctx.clip(); areaPath(); ctx.fillStyle = gDn; ctx.fill(); ctx.restore();
      } else {
        const g = ctx.createLinearGradient(0, P.top, 0, P.top + cH);
        g.addColorStop(0, hexA(color, 0.28)); g.addColorStop(1, hexA(color, 0));
        areaPath(); ctx.fillStyle = g; ctx.fill();
      }

      // Courbe (rouge sous zéro si signée)
      const stroke = col => { ctx.beginPath(); monotonePath(ctx, pts, true); ctx.strokeStyle = col; ctx.lineWidth = 2.25; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
      if (cfg.signed && sc.min < 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, y0); ctx.clip(); stroke(color); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, H); ctx.clip(); stroke(C.red); ctx.restore();
      } else stroke(color);

      // Budget : pointillés dorés par tronçons de mois budgétés consécutifs, + légende
      if (bud) {
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.75; ctx.lineJoin = 'round';
        let seg = [];
        const flush = () => {
          if (seg.length === 1) { ctx.beginPath(); ctx.moveTo(seg[0].x - 6, seg[0].y); ctx.lineTo(seg[0].x + 6, seg[0].y); ctx.stroke(); }
          else if (seg.length > 1) { ctx.beginPath(); seg.forEach((p, k) => ctx[k ? 'lineTo' : 'moveTo'](p.x, p.y)); ctx.stroke(); }
          seg = [];
        };
        bud.forEach((v, i) => { if (v === null) flush(); else seg.push({ x: xOf(i), y: yOf(v) }); });
        flush(); ctx.restore();
        if (hover >= 0 && bud[hover] !== null) { ctx.beginPath(); ctx.arc(xOf(hover), yOf(bud[hover]), 3.5, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill(); }
        ctx.font = '600 11px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const lx = P.left + 4, ly = 10;
        ctx.strokeStyle = color; ctx.lineWidth = 2.25; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 16, ly); ctx.stroke();
        ctx.fillStyle = C.text2; ctx.fillText('Réel', lx + 22, ly + 0.5);
        const bx = lx + 22 + ctx.measureText('Réel').width + 16;
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.75; ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx + 16, ly); ctx.stroke(); ctx.restore();
        ctx.fillStyle = C.text2; ctx.fillText('Budget', bx + 22, ly + 0.5);
      }

      // Survol : repère vertical + point mis en valeur
      if (hover >= 0) {
        const x = Math.round(pts[hover].x) + 0.5;
        ctx.strokeStyle = 'rgba(226,232,243,0.22)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, P.top - 6); ctx.lineTo(x, P.top + cH); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pts[hover].x, pts[hover].y, 9, 0, Math.PI * 2); ctx.fillStyle = hexA(colAt(hover), 0.18); ctx.fill();
      }
      // Points discrets ; dernier point + valeur toujours visibles
      pts.forEach((p, i) => {
        const on = i === hover || i === n - 1;
        if (!on && n > 24) return;
        ctx.beginPath(); ctx.arc(p.x, p.y, on ? 4.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = on ? colAt(i) : C.card; ctx.fill();
        ctx.lineWidth = on ? 2 : 1.5; ctx.strokeStyle = on ? C.card : colAt(i); ctx.stroke();
      });
      if (hover !== n - 1) {
        const p = pts[n - 1], txt = fmtEur(vals[n - 1]);
        ctx.font = '700 11px ' + FONT;
        const pw = ctx.measureText(txt).width + 14;
        const below = p.y - 22 < P.top - 18;
        pill(ctx, Math.min(p.x + pw / 2, W - 2) , below ? p.y + 20 : p.y - 20, txt, colAt(n - 1), 'right');
      }
    }

    function onMove(e) {
      if (!L) return;
      const { x, y } = pointer(cv, e);
      if (x < L.P.left - 10 || x > L.P.left + L.cW + 10) return onLeave();
      let best = 0, bd = Infinity;
      L.pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
      if (best !== hover) { hover = best; draw(); }
      const v = vals[hover], prev = hover > 0 ? vals[hover - 1] : null;
      let delta = '';
      if (prev !== null && prev !== 0) {
        const pct = (v - prev) / Math.abs(prev) * 100;
        const good = (cfg.deltaGoodWhenUp === false) ? pct <= 0 : pct >= 0;
        delta = '<div class="ac-tip-sub"><span style="color:' + (good ? C.green : C.red) + '">' + fmtPct(pct) + '</span> vs mois précédent</div>';
      }
      T.show('<div class="ac-tip-head">' + longLbl(hover) + '</div>' +
        '<div class="ac-tip-row"><span class="ac-dot" style="background:' + colAt(hover) + '"></span>' + (cfg.name || 'Valeur') +
        '<b style="color:' + colAt(hover) + '">' + fmtEur(v) + '</b></div>' + budTip(hover) + delta, L.pts[hover].x, Math.min(L.pts[hover].y, y));
    }
    function budTip(i) {
      if (!bud || bud[i] === null) return '';
      const d = vals[i] - bud[i], good = cfg.deltaGoodWhenUp === false ? d <= 0 : d >= 0;
      const pct = bud[i] ? ' (' + fmtPct(d / Math.abs(bud[i]) * 100) + ')' : '';
      return '<div class="ac-tip-row"><span class="ac-dot" style="background:' + C.gold + '"></span>Budget<b>' + fmtEur(bud[i]) + '</b></div>' +
        '<div class="ac-tip-sub">Écart <span style="color:' + (Math.abs(d) < 0.5 ? C.text2 : good ? C.green : C.red) + '">' + fmtEur(d, true) + pct + '</span></div>';
    }
    function onLeave() { if (hover !== -1) { hover = -1; draw(); } T.hide(); }

    cv.style.touchAction = 'pan-y'; cv.style.cursor = 'crosshair';
    cv.onpointermove = onMove; cv.onpointerdown = onMove; cv.onpointerleave = onLeave;
    draw(); observe(cv, draw);
    return { redraw: draw };
  }

  // ════════════════ ANNEAU DE RÉPARTITION ════════════════
  // cfg: { entries:[[label,val]], palette, centerLabel, sign?:'+'|'-', legendEl?, valueColor?, height?, maxSlices? }
  function donut(cv, cfg) {
    if (!cv) return;
    const H = cfg.height || 240, maxS = cfg.maxSlices || 6;
    let entries = cfg.entries.filter(([, v]) => v > 0);
    if (entries.length > maxS) {
      const rest = entries.slice(maxS - 1).reduce((s, [, v]) => s + v, 0);
      entries = entries.slice(0, maxS - 1).concat([['Autres (' + (cfg.entries.length - maxS + 1) + ')', rest]]);
    }
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!total) return;
    const pal = i => entries[i][0].startsWith('Autres (') ? '#5b6980' : cfg.palette[i % cfg.palette.length];
    const valCol = cfg.valueColor || C.text;
    const fmtV = v => cfg.sign === '-' ? fmtEur(-v) : fmtEur(v, cfg.sign === '+');
    let hover = -1, G;

    function draw() {
      const { ctx, W } = setup(cv, H);
      const R = Math.min(H / 2 - 12, W / 2 - 12, 104), r = R * 0.66, cx0 = W / 2, cy0 = H / 2;
      G = { cx0, cy0, R, r, arcs: [] };
      const gap = entries.length > 1 ? 0.035 : 0;
      let a = -Math.PI / 2;
      entries.forEach(([, v], i) => {
        const sweep = v / total * Math.PI * 2, a0 = a + gap / 2, a1 = a + sweep - gap / 2;
        G.arcs.push({ a0: a, a1: a + sweep });
        const on = i === hover, dim = hover >= 0 && !on;
        const ro = on ? R + 5 : R;
        ctx.beginPath(); ctx.arc(cx0, cy0, ro, a0, Math.max(a0 + 0.001, a1)); ctx.arc(cx0, cy0, r, Math.max(a0 + 0.001, a1), a0, true); ctx.closePath();
        ctx.fillStyle = dim ? hexA(pal(i), 0.28) : pal(i); ctx.fill();
        a += sweep;
      });
      // Centre
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if (hover >= 0) {
        const [lbl, v] = entries[hover];
        ctx.font = '600 11px ' + FONT; ctx.fillStyle = C.text2;
        let l = lbl; while (ctx.measureText(l).width > r * 1.6 && l.length > 4) l = l.slice(0, -2);
        ctx.fillText(l === lbl ? l : l + '…', cx0, cy0 - 14);
        ctx.font = '800 18px ' + FONT; ctx.fillStyle = pal(hover); ctx.fillText(fmtV(v), cx0, cy0 + 6);
        ctx.font = '600 11px ' + FONT; ctx.fillStyle = C.text2; ctx.fillText(fmtPct(v / total * 100).replace('+', ''), cx0, cy0 + 22);
      } else {
        ctx.font = '800 19px ' + FONT; ctx.fillStyle = valCol; ctx.fillText(fmtV(total), cx0, cy0 + 4);
        ctx.font = '600 11px ' + FONT; ctx.fillStyle = C.text2; ctx.fillText(cfg.centerLabel || 'Total', cx0, cy0 + 21);
      }
    }
    function hit(e) {
      const { x, y } = pointer(cv, e), dx = x - G.cx0, dy = y - G.cy0, d = Math.hypot(dx, dy);
      if (d < G.r || d > G.R + 8) return -1;
      let ang = Math.atan2(dy, dx); if (ang < -Math.PI / 2) ang += Math.PI * 2;
      return G.arcs.findIndex(s => ang >= s.a0 && ang < s.a1);
    }
    function setHover(i) {
      if (i === hover) return; hover = i; draw();
      if (cfg.legendEl) cfg.legendEl.querySelectorAll('.ac-leg-row').forEach((row, k) => row.classList.toggle('dim', hover >= 0 && k !== hover));
    }
    // Légende
    if (cfg.legendEl) {
      cfg.legendEl.innerHTML = entries.map(([lbl, v], i) =>
        '<div class="ac-leg-row" data-i="' + i + '"><span class="ac-dot" style="background:' + pal(i) + '"></span>' +
        '<span class="ac-leg-lbl">' + lbl + '</span><span class="ac-leg-val" style="color:' + valCol + '">' + fmtV(v) + '</span>' +
        '<span class="ac-leg-pct">' + (v / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + nbsp + '%</span></div>').join('');
      cfg.legendEl.querySelectorAll('.ac-leg-row').forEach(row => {
        row.onmouseenter = () => setHover(+row.dataset.i);
        row.onmouseleave = () => setHover(-1);
      });
    }
    cv.style.touchAction = 'pan-y';
    cv.onpointermove = e => { const i = hit(e); cv.style.cursor = i >= 0 ? 'pointer' : 'default'; setHover(i); };
    cv.onpointerdown = cv.onpointermove;
    cv.onpointerleave = () => setHover(-1);
    draw(); observe(cv, draw);
    return { redraw: draw, hover: setHover };
  }

  // ════════════════ BARRES DIVERGENTES P1 / P2 ════════════════
  // cfg: { rows:[{label, sub, delta, p1, p2}], upIsGood?:true, p1Label?, p2Label? }
  function diverging(cv, cfg) {
    if (!cv || !cfg.rows || !cfg.rows.length) return;
    const rows = cfg.rows, ROW = 48, TOP = 8, H = rows.length * ROW + TOP * 2;
    const upGood = cfg.upIsGood !== false;
    const T = tip(cv);
    let hover = -1, G;

    function draw() {
      const { ctx, W } = setup(cv, H);
      const maxAbs = Math.max(...rows.map(r => Math.abs(r.delta)), 1);
      ctx.font = '700 12px ' + FONT;
      const valW = Math.max(...rows.map(r => ctx.measureText(fmtEur(r.delta, true)).width)) + 12;
      const lblW = W < 480 ? Math.max(96, W * 0.32) : Math.min(Math.max(140, W * 0.26), 220);
      const zoneL = lblW + 12, zoneR = W - 4;
      const hasNeg = rows.some(r => r.delta < 0), hasPos = rows.some(r => r.delta > 0);
      // Axe : centré s'il y a les deux signes, sinon collé au côté utile
      const axis = hasNeg && hasPos ? (zoneL + zoneR) / 2 : hasNeg ? zoneR - 4 : zoneL + 4;
      const halfPos = zoneR - axis - valW, halfNeg = axis - zoneL - valW;
      G = { lblW, axis };

      rows.forEach((r, i) => {
        const yc = TOP + i * ROW + ROW / 2, on = i === hover;
        if (on) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.beginPath(); ctx.roundRect(0, yc - ROW / 2 + 2, W, ROW - 4, 8); ctx.fill(); }
        // Libellé sur deux lignes, tronqué proprement
        const clip = (s, font, max) => { ctx.font = font; if (ctx.measureText(s).width <= max) return s; while (s.length > 3 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = C.text; ctx.fillText(clip(r.label, '600 12px ' + FONT, lblW - 10), 10, r.sub ? yc - 8 : yc);
        if (r.sub) { ctx.fillStyle = C.text2; ctx.fillText(clip(r.sub, '500 11px ' + FONT, lblW - 10), 10, yc + 9); }

        const good = upGood ? r.delta >= 0 : r.delta <= 0;
        const col = good ? C.green : C.red;
        const half = r.delta >= 0 ? halfPos : halfNeg;
        const bw = Math.max(3, Math.abs(r.delta) / maxAbs * Math.max(half, 10));
        const bx = r.delta >= 0 ? axis : axis - bw;
        ctx.fillStyle = hexA(col, on ? 0.95 : 0.8);
        ctx.beginPath(); ctx.roundRect(bx, yc - 8, bw, 16, r.delta >= 0 ? [0, 5, 5, 0] : [5, 0, 0, 5]); ctx.fill();
        // Montant au bout de la barre, jamais sur elle
        ctx.font = '700 12px ' + FONT; ctx.fillStyle = col;
        ctx.textAlign = r.delta >= 0 ? 'left' : 'right';
        const vx = r.delta >= 0 ? bx + bw + 8 : bx - 8;
        ctx.fillText(fmtEur(r.delta, true), vx, yc - (r.pct !== undefined ? 6 : 0));
        if (r.pct !== undefined && isFinite(r.pct)) { ctx.font = '600 10px ' + FONT; ctx.fillStyle = C.text2; ctx.fillText(fmtPct(r.pct), vx, yc + 9); }
        if (i < rows.length - 1) { ctx.fillStyle = C.grid; ctx.fillRect(10, TOP + (i + 1) * ROW, W - 10, 1); }
      });
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(Math.round(axis), TOP - 2, 1, H - TOP * 2 + 4);
    }
    cv.style.touchAction = 'pan-y';
    cv.onpointermove = e => {
      const { x, y } = pointer(cv, e);
      const i = Math.floor((y - TOP) / ROW);
      const idx = i >= 0 && i < rows.length ? i : -1;
      if (idx !== hover) { hover = idx; draw(); }
      if (idx < 0) return T.hide();
      const r = rows[idx];
      T.show('<div class="ac-tip-head">' + r.label + (r.sub ? ' · ' + r.sub : '') + '</div>' +
        '<div class="ac-tip-row">' + (cfg.p1Label || 'P1') + '<b>' + fmtEur(r.p1) + '</b></div>' +
        '<div class="ac-tip-row">' + (cfg.p2Label || 'P2') + '<b>' + fmtEur(r.p2) + '</b></div>' +
        '<div class="ac-tip-row">Écart<b style="color:' + ((upGood ? r.delta >= 0 : r.delta <= 0) ? C.green : C.red) + '">' + fmtEur(r.delta, true) + '</b></div>', x, y);
    };
    cv.onpointerdown = cv.onpointermove;
    cv.onpointerleave = () => { if (hover !== -1) { hover = -1; draw(); } T.hide(); };
    draw(); observe(cv, draw);
    return { redraw: draw };
  }

  // ════════════════ JAUGE DEMI-CERCLE ════════════════
  // cfg: { value, max, threshold?, color, label (centre), sub? , height? }
  function gauge(cv, cfg) {
    if (!cv) return;
    const H = cfg.height || 118;
    function draw() {
      const { ctx, W } = setup(cv, H);
      const R = Math.min(W / 2 - 10, H - 26), cx0 = W / 2, cy0 = H - 14, lw = Math.max(10, R * 0.16);
      const max = cfg.max || 100, pct = Math.max(0, Math.min((cfg.value || 0) / max, 1));
      ctx.lineCap = 'round'; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(cx0, cy0, R, Math.PI, 0); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.stroke();
      if (pct > 0.002) { ctx.beginPath(); ctx.arc(cx0, cy0, R, Math.PI, Math.PI + pct * Math.PI); ctx.strokeStyle = cfg.color || C.cyan; ctx.stroke(); }
      if (cfg.threshold !== undefined && cfg.threshold !== null) {
        const t = Math.max(0, Math.min(cfg.threshold / max, 1)), a = Math.PI + t * Math.PI;
        ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.red;
        ctx.beginPath(); ctx.moveTo(cx0 + (R - lw / 2 - 4) * Math.cos(a), cy0 + (R - lw / 2 - 4) * Math.sin(a));
        ctx.lineTo(cx0 + (R + lw / 2 + 4) * Math.cos(a), cy0 + (R + lw / 2 + 4) * Math.sin(a)); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = '800 ' + Math.round(Math.max(18, R * 0.34)) + 'px ' + FONT; ctx.fillStyle = C.text;
      ctx.fillText(String(cfg.label), cx0, cy0 - 4);
    }
    draw(); observe(cv, draw);
    return { redraw: draw };
  }

  // ════════════════ PALIERS (entonnoir de résultat) ════════════════
  // cfg: { rows:[{label, val, color}] }
  function funnel(cv, cfg) {
    if (!cv || !cfg.rows || !cfg.rows.length) return;
    const rows = cfg.rows, ROW = 40, H = rows.length * ROW + 4;
    function draw() {
      const { ctx, W } = setup(cv, H);
      ctx.font = '600 12px ' + FONT;
      const lblW = Math.min(Math.max(...rows.map(r => ctx.measureText(r.label).width)) + 16, W * 0.38);
      ctx.font = '700 12px ' + FONT;
      const valW = Math.max(...rows.map(r => ctx.measureText(fmtEur(r.val)).width)) + 14;
      const zx = lblW, zw = Math.max(20, W - lblW - valW);
      const maxAbs = Math.max(...rows.map(r => Math.abs(r.val)), 1);
      rows.forEach((r, i) => {
        const yc = 2 + i * ROW + ROW / 2;
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT; ctx.fillStyle = C.text2; ctx.textAlign = 'left'; ctx.fillText(r.label, 0, yc);
        ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.beginPath(); ctx.roundRect(zx, yc - 13, zw, 26, 7); ctx.fill();
        const bw = Math.max(4, Math.abs(r.val) / maxAbs * zw), bx = zx + (zw - bw) / 2;
        ctx.fillStyle = hexA(r.color, 0.85); ctx.beginPath(); ctx.roundRect(bx, yc - 13, bw, 26, 7); ctx.fill();
        ctx.font = '700 12px ' + FONT; ctx.fillStyle = r.color; ctx.textAlign = 'right';
        ctx.fillText(fmtEur(r.val), W, yc);
      });
    }
    draw(); observe(cv, draw);
    return { redraw: draw };
  }

  // ════════════════ TENDANCE + PRÉVISION ════════════════
  // cfg: { labels (YYYY-MM historiques + prévision), values (historique), trend:[...] (tous points), ci, color, name }
  function forecast(cv, cfg) {
    if (!cv || !cfg.values || cfg.values.length < 2) return;
    const H = cfg.height || 210, color = cfg.color || C.gold;
    const n = cfg.values.length, N = cfg.labels.length;
    const periods = cfg.labels.map(parsePeriod);
    const T = tip(cv);
    let hover = -1, L;
    function draw() {
      const { ctx, W } = setup(cv, H);
      const hi = Math.max(...cfg.values, ...cfg.trend.map(t => t + cfg.ci)), lo = Math.min(0, ...cfg.trend.map(t => t - cfg.ci));
      const sc = niceScale(Math.max(0, lo), hi || 1, 4);
      ctx.font = '500 11px ' + FONT;
      const yW = Math.max(...sc.ticks.map(t => ctx.measureText(fmtAxis(t)).width));
      const P = { top: 14, right: 12, bottom: 38, left: Math.ceil(yW) + 14 };
      const cW = W - P.left - P.right, cH = H - P.top - P.bottom;
      const xOf = i => P.left + i / (N - 1) * cW, yOf = v => P.top + cH - (v - sc.min) / (sc.max - sc.min || 1) * cH;
      L = { P, cW, xOf, yOf };
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      sc.ticks.forEach(t => { const y = Math.round(yOf(t)) + 0.5; ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.left, y); ctx.lineTo(P.left + cW, y); ctx.stroke(); ctx.fillStyle = C.text2; ctx.fillText(fmtAxis(t), P.left - 8, y); });
      // Zone prévision
      const sx = xOf(n - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(sx, P.top, P.left + cW - sx, cH);
      ctx.fillStyle = C.text2; ctx.font = '600 10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('PRÉVISION', sx + 8, P.top + 4);
      // Bande de confiance
      ctx.beginPath();
      for (let i = n - 1; i < N; i++) ctx[i === n - 1 ? 'moveTo' : 'lineTo'](xOf(i), yOf(cfg.trend[i] + cfg.ci));
      for (let i = N - 1; i >= n - 1; i--) ctx.lineTo(xOf(i), yOf(Math.max(sc.min, cfg.trend[i] - cfg.ci)));
      ctx.closePath(); ctx.fillStyle = hexA(color, 0.12); ctx.fill();
      // Tendance
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(226,232,243,0.35)';
      ctx.beginPath(); cfg.trend.forEach((t, i) => ctx[i ? 'lineTo' : 'moveTo'](xOf(i), yOf(t))); ctx.stroke(); ctx.setLineDash([]);
      // Historique
      const pts = cfg.values.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
      ctx.beginPath(); monotonePath(ctx, pts, true); ctx.strokeStyle = color; ctx.lineWidth = 2.25; ctx.lineJoin = 'round'; ctx.stroke();
      // Axe X
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const step = Math.max(1, Math.ceil(48 / (cW / (N - 1))));
      for (let i = 0; i < N; i += step) {
        const p = periods[i]; if (!p) continue;
        ctx.font = '500 11px ' + FONT; ctx.fillStyle = i === hover ? C.text : C.text2; ctx.fillText(MONTHS_S[p.m], xOf(i), H - P.bottom + 18);
        if (i === 0 || p.m < step) { ctx.font = '600 10px ' + FONT; ctx.fillStyle = 'rgba(138,154,178,0.6)'; ctx.fillText(String(p.y), xOf(i), H - P.bottom + 31); }
      }
      if (hover >= 0) {
        const x = Math.round(xOf(hover)) + 0.5;
        ctx.strokeStyle = 'rgba(226,232,243,0.22)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, P.top); ctx.lineTo(x, P.top + cH); ctx.stroke(); ctx.setLineDash([]);
        const v = hover < n ? cfg.values[hover] : cfg.trend[hover];
        ctx.beginPath(); ctx.arc(xOf(hover), yOf(v), 4.5, 0, Math.PI * 2); ctx.fillStyle = hover < n ? color : C.card; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = hover < n ? C.card : color; ctx.stroke();
      }
    }
    cv.style.touchAction = 'pan-y'; cv.style.cursor = 'crosshair';
    cv.onpointermove = e => {
      if (!L) return;
      const { x, y } = pointer(cv, e);
      const i = Math.max(0, Math.min(N - 1, Math.round((x - L.P.left) / L.cW * (N - 1))));
      if (i !== hover) { hover = i; draw(); }
      const p = periods[i], head = p ? MONTHS_L[p.m] + ' ' + p.y : cfg.labels[i];
      const hist = i < n;
      T.show('<div class="ac-tip-head">' + head + (hist ? '' : ' · prévision') + '</div>' +
        (hist ? '<div class="ac-tip-row"><span class="ac-dot" style="background:' + color + '"></span>' + (cfg.name || 'Valeur') + '<b style="color:' + color + '">' + fmtEur(cfg.values[i]) + '</b></div>' : '') +
        '<div class="ac-tip-row">Tendance<b>' + fmtEur(cfg.trend[i]) + '</b></div>' +
        (hist ? '' : '<div class="ac-tip-sub">Fourchette ' + fmtEur(Math.max(0, cfg.trend[i] - cfg.ci)) + ' – ' + fmtEur(cfg.trend[i] + cfg.ci) + '</div>'),
        L.xOf(i), y);
    };
    cv.onpointerdown = cv.onpointermove;
    cv.onpointerleave = () => { if (hover !== -1) { hover = -1; draw(); } T.hide(); };
    draw(); observe(cv, draw);
    return { redraw: draw };
  }

  // ════════════════ BARRES GROUPÉES + COURBE ════════════════
  // cfg: { labels (YYYY-MM), bars:[{name, values, color}], line?:{name, values, color}, stacked?, height? }
  function combo(cv, cfg) {
    if (!cv || !cfg.labels || !cfg.labels.length) return;
    const n = cfg.labels.length, bars = cfg.bars || [], line = cfg.line;
    // height: 'fill' = occupe toute la hauteur de son conteneur (.ac-fill), utile quand la carte est étirée par sa voisine
    const heightOf = () => cfg.height === 'fill' ? Math.max(cfg.minHeight || 240, Math.floor(cv.parentElement.clientHeight)) : (cfg.height || 260);
    const periods = cfg.labels.map(parsePeriod);
    const T = tip(cv);
    let hover = -1, L;
    function draw() {
      const H = heightOf();
      const { ctx, W } = setup(cv, H);
      const sums = cfg.stacked ? cfg.labels.map((_, i) => bars.reduce((t, b) => t + Math.max(0, b.values[i] || 0), 0)) : [];
      const all = [0, ...(cfg.stacked ? sums : bars.flatMap(b => b.values)), ...(line ? line.values : [])];
      const sc = tightScale(Math.min(...all), Math.max(...all) || 1);
      ctx.font = '500 11px ' + FONT;
      const yW = Math.max(...sc.ticks.map(t => ctx.measureText(fmtAxis(t)).width));
      const P = { top: 16, right: 12, bottom: 40, left: Math.ceil(yW) + 16 };
      const cW = W - P.left - P.right, cH = H - P.top - P.bottom, slot = cW / n;
      const yOf = v => P.top + cH - (v - sc.min) / (sc.max - sc.min || 1) * cH, y0 = yOf(0);
      const cx = i => P.left + slot * (i + 0.5);
      L = { P, cW, slot, cx };
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      sc.ticks.forEach(t => { const y = Math.round(yOf(t)) + 0.5; ctx.strokeStyle = t === 0 ? C.zero : C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.left, y); ctx.lineTo(P.left + cW, y); ctx.stroke(); ctx.fillStyle = C.text2; ctx.fillText(fmtAxis(t), P.left - 10, y); });
      if (hover >= 0) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(P.left + slot * hover, P.top, slot, cH); }
      // Barres
      if (cfg.stacked) {
        // Barres empilées : un segment par série, coins arrondis seulement en haut de la pile
        const bw = Math.min(slot * 0.62, 40);
        cfg.labels.forEach((_, i) => {
          let acc = 0; const segs = bars.map(b => Math.max(0, b.values[i] || 0));
          const topK = segs.reduce((t, v, k) => v > 0 ? k : t, -1);
          segs.forEach((v, k) => {
            if (!v) return;
            const yTop = yOf(acc + v), yBot = yOf(acc); acc += v;
            ctx.fillStyle = hexA(bars[k].color, hover === i ? 0.95 : 0.8);
            ctx.beginPath(); ctx.roundRect(cx(i) - bw / 2, yTop, bw, Math.max(yBot - yTop - (k === topK ? 0 : 1.5), 1), k === topK ? [5, 5, 0, 0] : 0); ctx.fill();
          });
        });
      }
      const gw = Math.min(slot * 0.7, 44), bw = gw / Math.max(bars.length, 1), gap = Math.min(3, bw * 0.15);
      if (!cfg.stacked) bars.forEach((b, k) => b.values.forEach((v, i) => {
        if (!v) return;
        const x = cx(i) - gw / 2 + k * bw + gap / 2, y = yOf(Math.max(v, 0)), h = Math.abs(yOf(v) - y0);
        ctx.fillStyle = hexA(b.color, hover === i ? 0.95 : 0.78);
        ctx.beginPath(); ctx.roundRect(x, v >= 0 ? y : y0, bw - gap, Math.max(h, 1), v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]); ctx.fill();
      }));
      // Courbe
      if (line) {
        const pts = line.values.map((v, i) => ({ x: cx(i), y: yOf(v) }));
        ctx.beginPath(); monotonePath(ctx, pts, true); ctx.strokeStyle = line.color; ctx.lineWidth = 2.25; ctx.lineJoin = 'round'; ctx.stroke();
        pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(p.x, p.y, i === hover ? 4.5 : 3, 0, Math.PI * 2); ctx.fillStyle = line.values[i] < 0 ? C.red : line.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.card; ctx.stroke(); });
      }
      // Axe X
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const step = Math.max(1, Math.ceil(44 / slot));
      for (let i = 0; i < n; i += step) {
        const p = periods[i];
        ctx.font = '500 11px ' + FONT; ctx.fillStyle = i === hover ? C.text : C.text2;
        ctx.fillText(p ? MONTHS_S[p.m] : String(cfg.labels[i]), cx(i), H - P.bottom + 18);
        if (p && (i === 0 || p.m < step)) { ctx.font = '600 10px ' + FONT; ctx.fillStyle = 'rgba(138,154,178,0.6)'; ctx.fillText(String(p.y), cx(i), H - P.bottom + 31); }
      }
    }
    cv.style.touchAction = 'pan-y';
    cv.onpointermove = e => {
      if (!L) return;
      const { x, y } = pointer(cv, e);
      const i = Math.floor((x - L.P.left) / L.slot);
      const idx = i >= 0 && i < n ? i : -1;
      if (idx !== hover) { hover = idx; draw(); }
      if (idx < 0) return T.hide();
      const p = periods[idx];
      const shown = cfg.stacked ? bars.filter(b => b.values[idx]) : bars;
      const rows = shown.map(b => '<div class="ac-tip-row"><span class="ac-dot" style="background:' + b.color + '"></span>' + b.name + '<b>' + fmtEur(b.values[idx]) + '</b></div>').join('') +
        (cfg.stacked ? '<div class="ac-tip-sub" style="display:flex">Total<b style="margin-left:auto;padding-left:12px;color:var(--text)">' + fmtEur(bars.reduce((t, b) => t + (b.values[idx] || 0), 0)) + '</b></div>' : '') +
        (line ? '<div class="ac-tip-sub" style="display:flex;gap:8px;align-items:center"><span class="ac-dot" style="background:' + line.color + '"></span>' + line.name + '<b style="margin-left:auto;padding-left:12px;color:' + (line.values[idx] < 0 ? C.red : line.color) + '">' + fmtEur(line.values[idx], true) + '</b></div>' : '');
      T.show('<div class="ac-tip-head">' + (p ? MONTHS_L[p.m] + ' ' + p.y : cfg.labels[idx]) + '</div>' + rows, L.cx(idx), y);
    };
    cv.onpointerdown = cv.onpointermove;
    cv.onpointerleave = () => { if (hover !== -1) { hover = -1; draw(); } T.hide(); };
    draw(); observe(cv, draw);
    return { redraw: draw };
  }

  return { area, donut, diverging, gauge, funnel, forecast, combo, fmtEur, fmtAxis, fmtPct, colors: C };
})();
