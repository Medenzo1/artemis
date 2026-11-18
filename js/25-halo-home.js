// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Accueil « Halo »
//  Tableau de bord d'accueil : carte héros, agenda, chiffres clés,
//  raccourcis, revenus (courbe animée), canaux et biens.
//  Lit uniquement la base existante (getDB / getParams / budget).
// ════════════════════════════════════════════════════════════════

const HH_BIEN_COLORS = ['#5b8cff', '#f59e0b', '#14b8a6', '#a855f7', '#ec4899', '#ef4444', '#22c55e', '#0ea5e9', '#f97316', '#8b5cf6'];
let _hhRange = 12;
const HH_K = { ca: '22,163,95', dep: '224,53,63', net: 'var(--acc-rgb)', marg: '124,92,245' };

// ── Agrégats mensuels ──
function hhData() {
  const db = getDB();
  const keys = Object.keys(db.periods || {}).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
  const M = {};
  const chan = {}, bienCA = {};
  keys.forEach(k => {
    const r = M[k] = { ca: 0, dep: 0, net: 0, biens: {} };
    (db.periods[k].lines || []).forEach(l => {
      const v = +l.montant || 0;
      r.net += v;
      let isCA = false, isDep = false;
      try { isCA = _isCA(l); isDep = _isDep(l); } catch (e) {}
      if (isCA) {
        r.ca += v;
        const b = l.bienName || l.bien || '';
        if (b) r.biens[b] = (r.biens[b] || 0) + v;
      }
      if (isDep) r.dep += -v;
    });
  });
  const last = keys[keys.length - 1] || null;
  const win = (end, n) => { const out = []; for (let i = n - 1; i >= 0; i--) out.push(hShift(end, -i)); return out; };
  const sum = (ks, f) => ks.reduce((s, k) => s + (M[k] ? f(M[k]) : 0), 0);
  let w12 = [], p12 = [];
  if (last) {
    w12 = win(last, 12); p12 = win(hShift(last, -12), 12);
    // Canaux et CA par bien sur 12 mois
    w12.forEach(k => {
      if (!db.periods[k]) return;
      (db.periods[k].lines || []).forEach(l => {
        let isCA = false; try { isCA = _isCA(l); } catch (e) {}
        if (!isCA) return;
        const c = l.cat || l.categorie || 'Autres';
        const g = /airbnb/i.test(c) ? 'Airbnb' : /booking/i.test(c) ? 'Booking' : /loyer/i.test(c) ? 'Loyers' : /direct|stripe/i.test(c) ? 'Direct' : 'Autres';
        chan[g] = (chan[g] || 0) + (+l.montant || 0);
      });
    });
    w12.forEach(k => M[k] && Object.entries(M[k].biens).forEach(([b, v]) => { (bienCA[b] = bienCA[b] || { cur: 0, prev: 0 }).cur += v; }));
    p12.forEach(k => M[k] && Object.entries(M[k].biens).forEach(([b, v]) => { (bienCA[b] = bienCA[b] || { cur: 0, prev: 0 }).prev += v; }));
  }
  return {
    db, keys, M, last, w12, p12, chan, bienCA,
    has: k => !!M[k], sum,
    ca12: sum(w12, r => r.ca), dep12: sum(w12, r => r.dep), net12: sum(w12, r => r.net),
    caP12: sum(p12, r => r.ca), depP12: sum(p12, r => r.dep), netP12: sum(p12, r => r.net),
  };
}

function hhVar(cur, prev, lowerIsBetter) {
  if (!prev) return '<span class="hbadge flat">—</span>';
  const p = (cur - prev) / Math.abs(prev) * 100;
  const good = lowerIsBetter ? p <= 0 : p >= 0;
  return '<span class="hbadge ' + (good ? 'up' : 'down') + '">' + hIco(p >= 0 ? 'trending-up' : 'trending-down', 12) + hPct(p, true) + '</span>';
}
function hhSpark(vals, color) {
  if (!vals || vals.length < 2) return '';
  const W = 92, H = 30, mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => [i / (vals.length - 1) * W, H - 3 - (v - mn) / rg * (H - 6)]);
  return '<svg class="hh-spark" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"><path d="' + hhSmooth(pts) + '" fill="none" style="stroke:' + color + '" stroke-width="2" stroke-linecap="round"/></svg>';
}
// Courbe lissée (Catmull-Rom → Bézier)
function hhSmooth(p) {
  if (!p.length) return '';
  let d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += 'C' + c1[0].toFixed(1) + ',' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ',' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  return d;
}
function hhGreeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}
function hhInitials(name) {
  const w = String(name).replace(/^(T\d|Ô|Le|La|Les|Maison)\s+/i, '').split(/\s+/).filter(Boolean);
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '')[1] || '')).toUpperCase();
}

// ── Rendu principal ──
function haloRenderHome(quiet) {
  const hs = document.getElementById('homeScreen');
  if (!hs) return;
  let root = document.getElementById('hh');
  if (!root) { root = document.createElement('div'); root.id = 'hh'; hs.appendChild(root); }
  const d = hhData();
  const params = (() => { try { return getParams(); } catch (e) { return { biens: [] }; } })();
  const biens = params.biens || [];
  const now = new Date();
  const name = haloUI().greet === false ? '' : haloUserName();
  const todayLbl = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Sous-titre : choses à faire
  const todo = hhTodo(d);
  const sub = todayLbl.charAt(0).toUpperCase() + todayLbl.slice(1) + (todo.length ? ' · ' + todo.length + ' point' + (todo.length > 1 ? 's' : '') + ' demande' + (todo.length > 1 ? 'nt' : '') + ' votre attention' : ' · tout est à jour');

  let html = '<div class="hpage-head"><div><div class="hpage-title">' + hhGreeting() + (name ? ', ' + hEsc(name) : '') + '</div><div class="hpage-sub">' + sub + '</div></div>'
    + '<div class="hpage-actions"><button class="hbtn hbtn-light" onclick="haloPalette()">' + hIco('search', 15) + 'Rechercher <kbd class="hkbd">⌘K</kbd></button>'
    + '<button class="hbtn hbtn-dark" onclick="haloGo(\'import\')">' + hIco('plus', 15) + 'Importer un mois</button></div></div>';

  html += '<div class="hh-grid">';
  html += hhHero(d, biens);
  html += hhAgenda(d, todo);
  html += hhKpis(d, biens);
  html += hhActions(d);
  html += hhRevenue(d);
  html += hhChannels(d);
  html += hhBiens(d, biens);
  html += '</div>';
  root.innerHTML = html;

  // Animations d'entrée en cascade
  if (!quiet) root.querySelectorAll('.hh-grid > *').forEach((el, i) => { el.classList.add('hrise'); el.style.animationDelay = (0.05 + i * 0.06) + 's'; });
  if (!quiet && !window._hhOpened) { window._hhOpened = true; hs.classList.add('hopen'); setTimeout(() => hs.classList.remove('hopen'), 1200); }
  haloCountUp(root);
  hhDrawRevenue(true);
  requestAnimationFrame(() => {
    root.querySelectorAll('.hh-ring-fg').forEach(c => { c.style.strokeDashoffset = c.dataset.off; });
    root.querySelectorAll('.hh-donut-seg').forEach(c => { c.style.strokeDasharray = c.dataset.dash; });
    root.querySelectorAll('.hh-bar i').forEach(b => { b.style.width = b.dataset.w; });
  });
}

function hhTodo(d) {
  const out = [];
  const now = new Date();
  const prevMonth = hShift(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), -1);
  if (!d.last) out.push({ t: 'Importer votre premier relevé', s: 'Pour alimenter le tableau de bord', tag: 'À faire', go: "haloGo('import')", c: 'var(--acc)' });
  else if (d.last < prevMonth) out.push({ t: 'Importer ' + hMonthLbl(hShift(d.last, 1)), s: 'Dernier mois importé : ' + hMonthLbl(d.last), tag: 'Import', go: "haloGo('import')", c: 'var(--acc)' });
  try {
    const ny = now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0);
    if (!budRefVersion(ny)) out.push({ t: 'Préparer le budget ' + ny, s: 'Repartir du réel et ajuster en %', tag: 'Budget', go: "haloGo('budget')", c: '#f59e0b' });
  } catch (e) {}
  // Arrivées de la semaine (réservations importées)
  try {
    const res = (typeof _getReservations === 'function' ? _getReservations() : []);
    const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 7);
    res.forEach(r => {
      const dt = hhParseDate(r.dateDebut);
      if (dt && dt >= mon && dt < sun) out.push({ t: 'Arrivée · ' + (r.logement || 'réservation'), s: r.nuits + ' nuit' + (r.nuits > 1 ? 's' : '') + ' · ' + (r.source === 'booking' ? 'Booking' : 'Airbnb'), tag: dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), c: r.source === 'booking' ? '#2f74f0' : '#ff5a5f', date: dt });
    });
  } catch (e) {}
  return out;
}
function hhParseDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function hhHero(d, biens) {
  if (!d.last) {
    return '<section class="hg hacc hh-hero"><div class="hh-hero-main"><div class="hh-chip">' + hIco('sparkles', 13) + 'Bienvenue</div>'
      + '<h2 class="hh-hero-t">Votre patrimoine, <span class="hserif">en clair</span></h2>'
      + '<p class="hh-hero-p">Importez votre premier relevé bancaire : Artemis ventile chaque ligne par bien et construit votre tableau de bord.</p>'
      + '<div class="hh-hero-btns"><button class="hbtn hbtn-white" onclick="haloGo(\'import\')">Importer un relevé ' + hIco('arrow-right', 14) + '</button></div></div></section>';
  }
  const cur = d.M[d.last];
  const refK = d.has(hShift(d.last, -12)) ? hShift(d.last, -12) : d.has(hShift(d.last, -1)) ? hShift(d.last, -1) : null;
  const ref = refK ? d.M[refK].ca : 0;
  const pct = ref ? (cur.ca - ref) / Math.abs(ref) * 100 : 0;
  let title;
  if (!ref || pct >= 3) title = 'Votre patrimoine tourne à <span class="hserif">plein régime</span> ce mois-ci';
  else if (pct > -3) title = 'Votre patrimoine <span class="hserif">garde le cap</span> ce mois-ci';
  else title = 'Un mois <span class="hserif">plus calme</span> pour votre patrimoine';
  // Biens en hausse vs N-1
  let up = 0, tot = 0;
  const prevB = refK ? d.M[refK].biens : {};
  Object.entries(cur.biens).forEach(([b, v]) => { tot++; if (v >= (prevB[b] || 0)) up++; });
  const p = hMonthLbl(d.last);
  const sentence = p.charAt(0).toUpperCase() + p.slice(1) + ' : ' + hEur(cur.ca) + ' de chiffre d\'affaires'
    + (ref ? ', ' + hPct(pct, true) + ' vs ' + hMonthLbl(refK) : '') + '.' + (tot ? ' ' + up + ' bien' + (up > 1 ? 's' : '') + ' sur ' + tot + ' en hausse.' : '');

  // Anneau : budget annuel, sinon CA de l'année précédente
  const y = +d.last.slice(0, 4);
  const ytd = d.keys.filter(k => k.startsWith(y + '-')).reduce((s, k) => s + d.M[k].ca, 0);
  let goal = 0, goalLbl = '';
  try {
    const v = budRefVersion(y);
    if (v) {
      const months = []; for (let m = 1; m <= 12; m++) months.push(y + '-' + String(m).padStart(2, '0'));
      goal = budLinesFor(months, {}).filter(l => _isCA(l)).reduce((s, l) => s + l.montant, 0);
      goalLbl = 'du budget ' + y;
    }
  } catch (e) {}
  if (!goal) {
    const py = d.keys.filter(k => k.startsWith((y - 1) + '-'));
    if (py.length >= 6) { goal = py.reduce((s, k) => s + d.M[k].ca, 0); goalLbl = 'du CA ' + (y - 1); }
  }
  const ringPct = goal > 0 ? ytd / goal * 100 : (d.ca12 ? d.net12 / d.ca12 * 100 : 0);
  if (!goal) goalLbl = 'marge nette 12 mois';
  const R = 74, C = 2 * Math.PI * R, off = C * (1 - Math.max(0, Math.min(1, ringPct / 100)));

  // Bulles des biens autour de l'anneau
  const named = biens.length ? biens : Object.keys(cur.biens).map(n => ({ name: n }));
  const orbit = named.slice(0, 8).map((b, i, arr) => {
    const a = -90 + i * 360 / arr.length;
    const col = HH_BIEN_COLORS[i % HH_BIEN_COLORS.length];
    const v = cur.biens[b.name] || 0;
    return '<div class="hh-orb" style="--a:' + a + 'deg;--c:' + col + '" title="' + hEsc(b.name) + ' · ' + hEur(v) + ' en ' + hMonthLbl(d.last) + '"><span>' + hEsc(hhInitials(b.name)) + '</span></div>';
  }).join('');

  return '<section class="hg hacc hh-hero"><div class="hh-hero-main">'
    + '<div class="hh-chip"><i class="hh-live"></i>' + d.keys.length + ' mois importés · ' + (biens.length || tot) + ' biens suivis</div>'
    + '<h2 class="hh-hero-t">' + title + '</h2><p class="hh-hero-p">' + sentence + '</p>'
    + '<div class="hh-hero-stats">'
    + '<div><b data-hcount="' + Math.round(cur.ca) + '" data-hfmt="eur">0</b><span>CA du mois</span></div>'
    + '<div><b data-hcount="' + Math.round(cur.dep) + '" data-hfmt="eur">0</b><span>Charges</span></div>'
    + '<div><b data-hcount="' + Math.round(cur.net) + '" data-hfmt="eur" data-hsigned="1">0</b><span>Cash-flow net</span></div></div>'
    + '<div class="hh-hero-btns"><button class="hbtn hbtn-white" onclick="haloGo(\'dashboard\')">Ouvrir le dashboard ' + hIco('external-link', 13) + '</button>'
    + '<button class="hbtn hbtn-ghost" onclick="haloGo(\'budget\')">' + hIco('target', 14) + 'Réel vs budget</button></div></div>'
    + '<div class="hh-ring-wrap"><div class="hh-orbit">' + orbit + '</div>'
    + '<svg class="hh-ring" viewBox="0 0 180 180"><circle cx="90" cy="90" r="' + R + '" class="hh-ring-bg"/><circle cx="90" cy="90" r="' + R + '" class="hh-ring-fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/></svg>'
    + '<div class="hh-ring-c"><b data-hcount="' + ringPct.toFixed(1) + '" data-hfmt="pct">0</b><span>' + goalLbl + '</span></div></div>'
    + '</section>';
}

function hhAgenda(d, todo) {
  const now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let week = '';
  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon); dt.setDate(mon.getDate() + i);
    const on = dt.toDateString() === now.toDateString();
    const has = todo.some(t => t.date && t.date.toDateString() === dt.toDateString());
    week += '<div class="hh-day' + (on ? ' on' : '') + (has ? ' has' : '') + '"><small>' + L[i] + '</small><b>' + dt.getDate() + '</b></div>';
  }
  const wd = now.toLocaleDateString('fr-FR', { weekday: 'long' });
  const my = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const items = todo.slice(0, 3).map(t => '<div class="hh-ev"' + (t.go ? ' onclick="' + t.go + '" style="cursor:pointer"' : '') + '><span class="hh-ev-tag">' + hEsc(t.tag) + '</span><i style="background:' + t.c + '"></i><div><b>' + hEsc(t.t) + '</b><small>' + hEsc(t.s) + '</small></div></div>').join('')
    || '<div class="hh-ev hh-ev-empty">' + hIco('check-circle', 16) + '<div><b>Rien à signaler</b><small>Vos données sont à jour</small></div></div>';
  return '<section class="hg hh-agenda"><div class="hh-ag-head"><div class="hh-ag-n">' + now.getDate() + '</div><div><b>' + wd.charAt(0).toUpperCase() + wd.slice(1) + '</b><small>' + my.charAt(0).toUpperCase() + my.slice(1) + ' · ' + todo.length + ' élément' + (todo.length > 1 ? 's' : '') + '</small></div>'
    + '<span class="hh-ag-ico">' + hIco('calendar', 16) + '</span></div><div class="hh-week">' + week + '</div><div class="hh-evs">' + items + '</div></section>';
}

function hhKpis(d, biens) {
  const s = k => d.w12.map(m => d.M[m] ? d.M[m][k] : 0);
  const marg = d.ca12 ? d.net12 / d.ca12 * 100 : 0, margP = d.caP12 ? d.netP12 / d.caP12 * 100 : 0;
  const lcd = biens.filter(b => (b.mode || b.type) === 'LCD').length, lld = biens.length - lcd;
  const card = (ico, val, fmt, lbl, sub, badge, spark, krgb) => '<section class="hg hh-kpi hk" style="--krgb:' + krgb + '"><div class="hh-kpi-top"><span class="hh-kpi-ico">' + hIco(ico, 16) + '</span>' + badge + '</div>'
    + '<div class="hh-kpi-v"><b data-hcount="' + val + '" data-hfmt="' + fmt + '"' + (fmt === 'eur' && krgb === HH_K.net ? ' data-hsigned="1"' : '') + '>0</b></div><div class="hh-kpi-b"><div><div class="hh-kpi-l">' + lbl + '</div><div class="hh-kpi-s">' + sub + '</div></div>' + spark + '</div></section>';
  if (!d.last) return '';
  return card('wallet', Math.round(d.ca12), 'eur', "Chiffre d'affaires", '12 derniers mois', hhVar(d.ca12, d.caP12), hhSpark(s('ca'), '#16a35f'), HH_K.ca)
    + card('receipt', Math.round(d.dep12), 'eur', 'Charges', '12 derniers mois', hhVar(d.dep12, d.depP12, true), hhSpark(s('dep'), '#e0353f'), HH_K.dep)
    + card('coins', Math.round(d.net12), 'eur', 'Cash-flow net', 'après crédits · 12 mois', hhVar(d.net12, d.netP12), hhSpark(s('net'), 'var(--acc)'), HH_K.net)
    + card('percent', marg.toFixed(1), 'pct', 'Marge nette', biens.length ? lcd + ' LCD · ' + lld + ' LLD' : 'cash-flow / CA', d.caP12 ? '<span class="hbadge ' + (marg >= margP ? 'up' : 'down') + '">' + hPct(marg - margP, true).replace('%', 'pt') + '</span>' : '<span class="hbadge flat">—</span>', '', HH_K.marg);
}

function hhActions(d) {
  const nb = d.keys.length;
  let bud = 'Prévisionnel annuel';
  try { const y = new Date().getFullYear(); const v = budRefVersion(y + 1) || budRefVersion(y); if (v) bud = v.name + ' · ' + v.year; } catch (e) {}
  const a = [
    ['upload', 'Importer un relevé', d.last ? 'Dernier : ' + hMonthLbl(d.last) : 'Banque, Airbnb, Booking', "haloGo('import')"],
    ['database', 'Voir la base', nb + ' mois enregistrés', "haloGo('base')"],
    ['target', 'Piloter le budget', bud, "haloGo('budget')"],
    ['calculator', 'Simuler un projet', 'Rentabilité et fiscalité', "haloGo('simulateur')"],
    ['download', 'Exporter en Excel', 'Toutes les données du dashboard', 'exportDashboardExcel();'],
    ['settings', 'Paramètres', 'Biens, SCI, emprunts', "haloGo('params')"],
  ];
  return '<div class="hh-actions">' + a.map(x => '<button class="hg hh-act" onclick="' + x[3] + '"><span class="hh-act-ico">' + hIco(x[0], 16) + '</span><span><b>' + x[1] + '</b><small>' + hEsc(x[2]) + '</small></span></button>').join('') + '</div>';
}

// ── Revenus : courbe CA / charges qui se transforme ──
function hhRevenue(d) {
  if (!d.last) return '';
  const opts = [[3, '3 mois'], [6, '6 mois'], [12, '12 mois'], [0, 'Tout']];
  return '<section class="hg hh-rev"><div class="hh-card-h"><div><h3>Revenus</h3><small id="hh-rev-sub"></small></div>'
    + '<div class="hseg" id="hh-rev-seg">' + opts.map(o => '<button class="' + (o[0] === _hhRange ? 'on' : '') + '" onclick="hhSetRange(' + o[0] + ')">' + o[1] + '</button>').join('') + '</div></div>'
    + '<div class="hh-legend"><span><i style="background:var(--acc)"></i>Chiffre d\'affaires</span><span><i style="background:var(--ink)"></i>Charges</span></div>'
    + '<div class="hh-chart" id="hh-chart"><svg id="hh-svg" preserveAspectRatio="none"></svg><div class="hh-tip" id="hh-tip"></div></div></section>';
}
function hhSetRange(n) {
  _hhRange = n;
  document.querySelectorAll('#hh-rev-seg button').forEach(b => b.classList.toggle('on', b.getAttribute('onclick') === 'hhSetRange(' + n + ')'));
  hhDrawRevenue();
}
let _hhChartState = null;
function hhDrawRevenue(first) {
  const box = document.getElementById('hh-chart'), svg = document.getElementById('hh-svg');
  if (!box || !svg) return;
  const d = hhData();
  if (!d.last) return;
  let months = d.keys.slice();
  if (_hhRange) { months = []; for (let i = _hhRange - 1; i >= 0; i--) months.push(hShift(d.last, -i)); }
  const ca = months.map(k => d.M[k] ? d.M[k].ca : 0), dep = months.map(k => d.M[k] ? d.M[k].dep : 0);
  const subEl = document.getElementById('hh-rev-sub');
  const tCa = ca.reduce((a, b) => a + b, 0), tDep = dep.reduce((a, b) => a + b, 0);
  if (subEl) subEl.textContent = hEur(tCa - tDep, true) + ' de marge sur ' + months.length + ' mois · ' + hMonthLbl(months[0], true) + ' → ' + hMonthLbl(months[months.length - 1], true);

  const W = Math.max(300, box.clientWidth), H = 250, P = { l: 46, r: 14, t: 14, b: 30 };
  const cw = W - P.l - P.r, ch = H - P.t - P.b;
  const mx = Math.max(1, ...ca, ...dep) * 1.12;
  // Ré-échantillonne à N points fixes : même nombre de points d'une plage à l'autre → la courbe se transforme
  const N = 60;
  const samp = arr => {
    if (arr.length === 1) return Array(N).fill(arr[0]);
    return Array.from({ length: N }, (_, i) => {
      const x = i / (N - 1) * (arr.length - 1), j = Math.min(arr.length - 2, Math.floor(x)), t = x - j;
      const p0 = arr[j - 1] ?? arr[j], p1 = arr[j], p2 = arr[j + 1], p3 = arr[j + 2] ?? p2;
      const t2 = t * t, t3 = t2 * t;
      return Math.max(0, 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
    });
  };
  const target = { a: samp(ca), b: samp(dep), mx };
  const from = _hhChartState && !first ? _hhChartState.cur : { a: Array(N).fill(0), b: Array(N).fill(0), mx };
  const anim = haloUI().anim !== false;
  const x = i => P.l + i / (N - 1) * cw;
  const yv = (v, m) => P.t + ch - v / m * ch;
  const ticks = 4;
  const fmtAx = v => v >= 1e3 ? (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: v >= 1e4 ? 0 : 1 }) + hNb + 'k€' : Math.round(v) + hNb + '€';
  const labelsX = months.map((k, i) => ({ k, x: P.l + (months.length === 1 ? cw / 2 : i / (months.length - 1) * cw) }));
  const every = Math.ceil(months.length / 12);

  const draw = s => {
    const pa = s.a.map((v, i) => [x(i), yv(v, s.mx)]), pb = s.b.map((v, i) => [x(i), yv(v, s.mx)]);
    const la = hhSmooth(pa), lb = hhSmooth(pb);
    let g = '<defs><linearGradient id="hh-ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--acc)" stop-opacity=".42"/><stop offset="1" style="stop-color:var(--acc)" stop-opacity="0"/></linearGradient></defs>';
    for (let i = 0; i <= ticks; i++) {
      const v = s.mx / 1.12 * i / ticks, yy = yv(v, s.mx);
      g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="hh-grid-l"/><text x="' + (P.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" class="hh-ax" text-anchor="end">' + fmtAx(v) + '</text>';
    }
    labelsX.forEach((L, i) => { if (i % every === 0 || i === labelsX.length - 1) g += '<text x="' + L.x.toFixed(1) + '" y="' + (H - 8) + '" class="hh-ax" text-anchor="middle">' + H_MONTHS_S[+L.k.slice(5) - 1] + '</text>'; });
    g += '<path d="' + la + 'L' + x(N - 1) + ',' + (P.t + ch) + 'L' + P.l + ',' + (P.t + ch) + 'Z" fill="url(#hh-ga)"/>';
    g += '<path d="' + la + '" fill="none" style="stroke:var(--acc)" stroke-width="2.6" stroke-linecap="round"/>';
    g += '<path d="' + lb + '" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-linecap="round" opacity=".85"/>';
    g += '<g id="hh-hover"></g>';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.innerHTML = g;
  };
  cancelAnimationFrame(_hhChartState && _hhChartState.raf);
  const st = _hhChartState = { cur: from, raf: 0 };
  const t0 = performance.now(), D = anim ? (first ? 1100 : 850) : 0;
  const tick = t => {
    const p = D ? Math.min(1, (t - t0) / D) : 1, e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const s = { a: from.a.map((v, i) => v + (target.a[i] - v) * e), b: from.b.map((v, i) => v + (target.b[i] - v) * e), mx: from.mx + (target.mx - from.mx) * e };
    st.cur = s; draw(s);
    if (p < 1) st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);

  // Survol : la bulle suit la souris
  box.onmousemove = ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(months.length - 1, Math.round((px - P.l) / cw * (months.length - 1))));
    const L = labelsX[i], yc = yv(ca[i], target.mx), yd = yv(dep[i], target.mx);
    const hv = svg.querySelector('#hh-hover');
    if (hv) hv.innerHTML = '<line x1="' + L.x + '" x2="' + L.x + '" y1="' + P.t + '" y2="' + (P.t + ch) + '" class="hh-guide"/><circle cx="' + L.x + '" cy="' + yc + '" r="5" class="hh-dot-a"/><circle cx="' + L.x + '" cy="' + yd + '" r="4" class="hh-dot-b"/>';
    const tip = document.getElementById('hh-tip');
    tip.innerHTML = '<b>' + hMonthLbl(L.k) + '</b><span><i style="background:var(--acc)"></i>CA ' + hEur(ca[i]) + '</span><span><i style="background:var(--ink)"></i>Charges ' + hEur(dep[i]) + '</span>';
    tip.style.opacity = 1;
    const tx = L.x / W * r.width, tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(r.width - tw - 4, tx - tw / 2)) + 'px';
    tip.style.top = Math.max(0, yc / H * r.height - tip.offsetHeight - 14) + 'px';
  };
  box.onmouseleave = () => { const hv = svg.querySelector('#hh-hover'); if (hv) hv.innerHTML = ''; const tip = document.getElementById('hh-tip'); if (tip) tip.style.opacity = 0; };
}
window.addEventListener('resize', () => { clearTimeout(window._hhRz); window._hhRz = setTimeout(() => { if (window._haloRoute === 'home') hhDrawRevenue(true); }, 150); });

function hhChannels(d) {
  if (!d.last) return '';
  const cols = { Airbnb: '#ff5a5f', Booking: '#2f74f0', Loyers: '#16a35f', Direct: '#f59e0b', Autres: '#a08f93' };
  const ent = Object.entries(d.chan).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const tot = ent.reduce((s, [, v]) => s + v, 0) || 1;
  const R = 62, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = ent.map(([k, v]) => {
    const len = v / tot * C, gap = ent.length > 1 ? 3 : 0;
    const s = '<circle class="hh-donut-seg" cx="80" cy="80" r="' + R + '" stroke="' + cols[k] + '" stroke-dasharray="0 ' + C.toFixed(1) + '" data-dash="' + Math.max(0, len - gap).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-acc).toFixed(1) + '"/>';
    acc += len; return s;
  }).join('');
  return '<section class="hg hh-chan"><div class="hh-card-h"><div><h3>Revenus par canal</h3><small>12 derniers mois</small></div></div>'
    + '<div class="hh-donut"><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="' + R + '" class="hh-donut-bg"/>' + segs + '</svg><div class="hh-donut-c"><b data-hcount="' + Math.round(tot) + '" data-hfmt="eur">0</b><span>Total</span></div></div>'
    + '<div class="hh-chan-l">' + ent.map(([k, v]) => '<div><i style="background:' + cols[k] + '"></i><span>' + k + '</span><b>' + hPct(v / tot * 100) + '</b></div>').join('') + '</div></section>';
}

function hhBiens(d, biens) {
  if (!d.last) return '';
  const list = (biens.length ? biens.map(b => b.name) : Object.keys(d.bienCA)).map((n, i) => ({ n, i, b: biens.find(x => x.name === n) || {}, v: d.bienCA[n] || { cur: 0, prev: 0 } }))
    .sort((a, b) => b.v.cur - a.v.cur);
  const mx = Math.max(1, ...list.map(x => x.v.cur));
  const rows = list.map(x => {
    const col = HH_BIEN_COLORS[x.i % HH_BIEN_COLORS.length];
    const share = d.ca12 ? x.v.cur / d.ca12 * 100 : 0;
    return '<div class="hh-bien" onclick="haloOpenDashTab(\'synthese\',\'ca\',' + hEsc(JSON.stringify(x.n)) + ')"><span class="hh-orb sm" style="--c:' + col + '"><span>' + hEsc(hhInitials(x.n)) + '</span></span>'
      + '<div class="hh-bien-n"><b>' + hEsc(x.n) + '</b><small>' + hEsc((x.b.mode || x.b.type || '') + (x.b.sci ? ' · ' + x.b.sci.replace('SCI - ', 'SCI ') : '')) + '</small></div>'
      + '<div class="hh-bar"><i style="width:0;background:' + col + '" data-w="' + (x.v.cur / mx * 100).toFixed(1) + '%"></i></div>'
      + '<div class="hh-bien-p">' + hPct(share) + '</div><div class="hh-bien-v">' + hEur(x.v.cur) + '</div>' + hhVar(x.v.cur, x.v.prev) + '</div>';
  }).join('');
  return '<section class="hg hh-biens"><div class="hh-card-h"><div><h3>Mes biens</h3><small>Chiffre d\'affaires sur 12 mois · part du total · évolution vs 12 mois précédents</small></div>'
    + '<button class="hbtn hbtn-light" onclick="haloGo(\'dashboard\')">Tout le détail ' + hIco('arrow-right', 14) + '</button></div><div class="hh-biens-l">' + rows + '</div></section>';
}
