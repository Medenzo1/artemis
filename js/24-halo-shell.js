// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Coquille « Halo »
//  Barre latérale en verre, palette ⌘K, couleur d'accent, et
//  routage unique vers les écrans existants (aucune logique métier ici).
// ════════════════════════════════════════════════════════════════

const HALO_UI_KEY = 'artemis_ui';
const HALO_ACCENTS = [
  { id: 'corail',  name: 'Corail',  c: '#f2553d' },
  { id: 'lagune',  name: 'Lagune',  c: '#0fa595' },
  { id: 'lavande', name: 'Lavande', c: '#7657f2' },
  { id: 'ocean',   name: 'Océan',   c: '#2f74f0' },
];

function haloUI() {
  try { return Object.assign({ acc: 'corail', anim: true, name: '' }, JSON.parse(localStorage.getItem(HALO_UI_KEY) || '{}')); }
  catch (e) { return { acc: 'corail', anim: true, name: '' }; }
}
function haloSaveUI(patch) {
  const u = Object.assign(haloUI(), patch);
  try { localStorage.setItem(HALO_UI_KEY, JSON.stringify(u)); } catch (e) {}
  haloApplyUI(u);
  return u;
}
function haloApplyUI(u) {
  u = u || haloUI();
  const h = document.documentElement;
  h.classList.add('halo');
  if (u.acc && u.acc !== 'corail') h.dataset.acc = u.acc; else delete h.dataset.acc;
  h.classList.toggle('no-anim', u.anim === false);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#f0ddd2');
}
haloApplyUI();

// ── Petits utilitaires ──
const hNb = ' ';
function hEur(v, signed) {
  const s = Math.round(Math.abs(v || 0)).toLocaleString('fr-FR').replace(/\s/g, hNb) + hNb + '€';
  return (v < 0 ? '−' : signed && v > 0 ? '+' : '') + s;
}
function hPct(v, signed) {
  if (!isFinite(v)) return '—';
  return (signed && v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 }) + hNb + '%';
}
function hEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hIco(name, size) { try { return icon(name, { size: size || 17 }); } catch (e) { return ''; } }
const H_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const H_MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function hMonthLbl(k, short) { const [y, m] = k.split('-'); return (short ? H_MONTHS_S : H_MONTHS)[+m - 1] + ' ' + y; }
function hShift(k, d) { let [y, m] = k.split('-').map(Number); m += d; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); }

// Compteur animé : <span data-hcount="1234" data-hfmt="eur|pct|int">
function haloCountUp(root) {
  const els = (root || document).querySelectorAll('[data-hcount]');
  const anim = haloUI().anim !== false;
  els.forEach(el => {
    const to = +el.dataset.hcount || 0, f = el.dataset.hfmt || 'int', signed = el.dataset.hsigned === '1';
    const out = v => f === 'eur' ? hEur(v, signed) : f === 'pct' ? hPct(v, signed) : Math.round(v).toLocaleString('fr-FR');
    if (!anim) { el.textContent = out(to); return; }
    const t0 = performance.now(), D = 1100;
    const step = t => {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 4);
      el.textContent = out(to * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ════════════ Barre latérale ════════════
const HALO_NAV = [
  { id: 'home', label: 'Accueil', ico: 'home', hint: "Vue d'ensemble de votre patrimoine" },
  { group: 'Pilotage' },
  { id: 'dashboard', label: 'Tableau de bord', ico: 'layout-dashboard', hint: 'CA, dépenses, trésorerie, résultat, KPIs' },
  { id: 'budget', label: 'Budget', ico: 'target', hint: 'Prévisionnel annuel, réel vs budget, atterrissage' },
  { group: 'Saisie mensuelle' },
  { id: 'import', label: 'Importer un mois', ico: 'upload', hint: 'Relevé bancaire, Airbnb, Booking → mapping → validation',
    steps: [['import', 'Relevés'], ['mapping', 'Mapping'], ['validation', 'Validation']] },
  { id: 'base', label: 'Mois enregistrés', ico: 'database', hint: 'Historique des mois importés : consulter, éditer, supprimer' },
  { group: 'Mon patrimoine' },
  { id: 'params', label: 'Biens & sociétés', ico: 'building', hint: 'SCI, biens, correspondances Airbnb/Booking, quote-parts' },
  { id: 'loans', label: 'Emprunts', ico: 'landmark', hint: 'Prêts et tableaux de remboursement' },
  { id: 'amort', label: 'Amortissements', ico: 'trending-up', hint: "Tableau d'amortissements comptables" },
  { id: 'lcd', label: 'Locations directes', ico: 'bed-double', hint: 'Réservations en direct (hors plateformes)' },
  { group: 'Outils' },
  { id: 'simulateur', label: 'Simulateur', ico: 'calculator', hint: "Rentabilité et fiscalité d'un projet" },
  { id: 'marketplace', label: 'Marketplace', ico: 'store', hint: 'Biens à vendre et opportunités' },
];
const HALO_STEP_ROUTES = ['import', 'mapping', 'validation'];

function haloUserName() {
  const u = haloUI();
  if (u.name) return u.name;
  try {
    const cu = _auth && _auth.currentUser;
    if (cu && cu.displayName) return cu.displayName.split(' ')[0];
    if (cu && cu.email) {
      const p = cu.email.split('@')[0].split(/[._-]/)[0].replace(/\d+$/, '');
      return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
    }
  } catch (e) {}
  return '';
}

function haloBuildSidebar() {
  if (document.getElementById('hsb')) return;
  const sb = document.createElement('aside');
  sb.id = 'hsb';
  sb.setAttribute('aria-label', 'Navigation principale');
  let html = '<div class="hsb-brand"><div class="hsb-logo"><img src="icon-192.png" alt=""></div>'
    + '<div><div class="hsb-name">ARTEMIS</div><div class="hsb-sub">Gestion patrimoniale</div></div></div>'
    + '<button class="hsb-search" onclick="haloPalette()">' + hIco('search', 15) + '<span>Rechercher</span><kbd>⌘K</kbd></button>';
  HALO_NAV.forEach(n => {
    if (n.group) { html += '<div class="hsb-group">' + n.group + '</div>'; return; }
    html += '<button class="hsb-item" data-route="' + n.id + '" title="' + hEsc(n.hint || '') + '" onclick="haloGo(\'' + n.id + '\')">' + hIco(n.ico) + '<span>' + n.label + '</span></button>';
    if (n.steps) html += '<div class="hsb-steps">' + n.steps.map((st, i) => '<button class="hsb-step" data-step="' + st[0] + '" onclick="haloGo(\'' + st[0] + '\')"><i>' + (i + 1) + '</i>' + st[1] + '</button>').join('') + '</div>';
  });
  html += '<div class="hsb-spacer"></div>'
    + '<div class="hsb-user"><div class="hsb-av" id="hsb-av"></div><div style="min-width:0;cursor:pointer" onclick="haloAppearance(event)"><div class="hsb-uname" id="hsb-uname"></div><div class="hsb-urole">Apparence · thème</div></div>'
    + '<button class="hsb-out" title="Se déconnecter" onclick="logout()">' + hIco('power', 16) + '</button></div>';
  sb.innerHTML = html;
  document.body.appendChild(sb);
  haloRefreshUser();
}
function haloRefreshUser() {
  const n = haloUserName() || 'Mon espace';
  const a = document.getElementById('hsb-av'), u = document.getElementById('hsb-uname');
  if (a) a.textContent = n.slice(0, 2).toUpperCase();
  if (u) u.textContent = n;
}
const HALO_PAGE_TITLES = {
  import: ['Importer un mois', 'Étape 1 · relevé bancaire et exports Airbnb / Booking du mois'],
  mapping: ['Mapping', 'Étape 2 · chaque ligne reçoit une catégorie et un bien'],
  validation: ['Validation', "Étape 3 · vérifiez la ventilation avant d'enregistrer le mois"],
  base: ['Mois enregistrés', 'Tous les mois importés : consulter, éditer, supprimer'],
  params: ['Biens & sociétés', 'SCI, biens, correspondances Airbnb / Booking et quote-parts'],
  loans: ['Emprunts', 'Prêts et tableaux de remboursement'],
  amort: ['Amortissements', "Tableau d'amortissements comptables"],
  lcd: ['Locations directes', 'Réservations encaissées en direct, hors plateformes'],
};
function haloTitleTools(route) {
  const t = HALO_PAGE_TITLES[route];
  if (!t) return;
  const h = document.getElementById('header-section'), p = document.querySelector('.app > header .logo p');
  if (h) h.textContent = t[0];
  if (p) p.textContent = t[1];
}
function haloSetActive(route) {
  window._haloRoute = route;
  haloTitleTools(route);
  const mn = { home: 'home', dashboard: 'dash', budget: 'dash', import: 'tools', mapping: 'tools', validation: 'tools', base: 'tools', params: 'params', loans: 'params', amort: 'params', lcd: 'params' }[route];
  document.querySelectorAll('#mobile-bottom-nav .mn-item').forEach(el => el.classList.toggle('active', !!mn && el.id === 'mn-' + mn));
  const inSteps = HALO_STEP_ROUTES.includes(route);
  document.querySelectorAll('#hsb .hsb-item').forEach(b => b.classList.toggle('on', b.dataset.route === route || (inSteps && b.dataset.route === 'import')));
  const steps = document.querySelector('#hsb .hsb-steps');
  if (steps) {
    steps.classList.toggle('open', inSteps);
    const idx = HALO_STEP_ROUTES.indexOf(route);
    steps.querySelectorAll('.hsb-step').forEach((b, i) => { b.classList.toggle('on', i === idx); b.classList.toggle('done', idx > i); });
  }
}

// ════════════ Routage ════════════
function haloCloseOverlays(except) {
  ['marketplaceScreen', 'simulateurScreen', 'budgetScreen'].forEach(id => {
    if (id === except) return;
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none') el.style.display = 'none';
  });
  try { closeGuide && document.querySelector('.guide-open') && closeGuide(true); } catch (e) {}
}
function _haloLeaveDash() {
  if (document.body.classList.contains('dash-mode')) {
    document.body.classList.remove('dash-mode');
    const sc6 = document.getElementById('sc6'); if (sc6) sc6.classList.remove('active');
  }
}
function _haloParamsTab(navId, route) {
  enterTools();
  setTimeout(() => {
    window._haloPendingRoute = route;
    const b = document.getElementById(navId); if (b) b.click();
    haloSetActive(route);
    // Les onglets « Sociétés & Biens / Quote-parts » ne concernent que Biens & sociétés
    setTimeout(() => {
      const show = route === 'params';
      document.querySelectorAll('#paramsTabs, #paramsActionBar').forEach(el => { el.style.display = show ? '' : 'none'; });
    }, 80);
  }, 0);
}
function haloGo(route) {
  haloCloseOverlays();
  window._haloPendingRoute = route;
  switch (route) {
    case 'home': showHome(); break;
    case 'dashboard': enterDashboard(); break;
    case 'budget': _haloLeaveDash(); showBudget('home'); break;
    case 'simulateur': _haloLeaveDash(); showSimulateur(); break;
    case 'marketplace': _haloLeaveDash(); showMarketplace(); break;
    case 'import': _haloLeaveDash(); enterTools(); break;
    case 'mapping': case 'validation': case 'base': {
      _haloLeaveDash(); enterTools();
      const n = { mapping: 2, validation: 3, base: 4 }[route];
      setTimeout(() => navTo(n), 0);
      break;
    }
    case 'params': _haloLeaveDash(); _haloParamsTab('nav-params', 'params'); break;
    case 'loans': _haloLeaveDash(); _haloParamsTab('nav-loans', 'loans'); break;
    case 'lcd': _haloLeaveDash(); _haloParamsTab('nav-lcd', 'lcd'); break;
    case 'amort': _haloLeaveDash(); _haloParamsTab('nav-amort', 'amort'); break;
  }
  haloSetActive(route);
  try { window.scrollTo(0, 0); } catch (e) {}
}

// Les écrans existants mettent la barre latérale à jour quel que soit le chemin emprunté
function _haloWrap(name, route) {
  const orig = window[name];
  if (typeof orig !== 'function' || orig._halo) return;
  const w = function () {
    const r = orig.apply(this, arguments);
    const rt = typeof route === 'function' ? route.apply(this, arguments) : route;
    if (rt) haloSetActive(rt);
    if (name === 'showHome') { try { haloRenderHome(); } catch (e) { console.error('[halo] accueil', e); } }
    return r;
  };
  w._halo = true;
  window[name] = w;
}
_haloWrap('showHome', 'home');
_haloWrap('enterDashboard', 'dashboard');
_haloWrap('showBudget', 'budget');
_haloWrap('showSimulateur', 'simulateur');
_haloWrap('showMarketplace', 'marketplace');
_haloWrap('navTo', n => {
  const r = { 1: 'import', 2: 'mapping', 3: 'validation', 4: 'base', 5: window._haloPendingRoute && ['params', 'loans', 'lcd', 'amort'].includes(window._haloPendingRoute) ? window._haloPendingRoute : 'params' }[n];
  if (n !== 5) window._haloPendingRoute = null;
  return r;
});
// Le fond animé de l'ancien accueil n'a plus lieu d'être
window._startHomeCanvas = function () {};

// La coquille n'apparaît qu'une fois connecté
function haloWatchSession() {
  const mc = document.getElementById('mainContent');
  if (!mc) return;
  const sync = () => document.body.classList.toggle('halo-in', mc.style.display !== 'none');
  new MutationObserver(sync).observe(mc, { attributes: true, attributeFilter: ['style'] });
  sync();
}

// ════════════ Apparence (accent) ════════════
function haloAppearance(ev) {
  if (ev) ev.stopPropagation();
  let pop = document.getElementById('happ');
  if (pop) { pop.remove(); return; }
  const u = haloUI();
  pop = document.createElement('div');
  pop.id = 'happ';
  pop.className = 'hg';
  pop.innerHTML = '<div class="happ-t">Apparence</div><div class="happ-s">Couleur d\'accent de tout l\'espace</div>'
    + '<div class="happ-sw">' + HALO_ACCENTS.map(a => '<button class="' + (u.acc === a.id ? 'on' : '') + '" onclick="haloSetAccent(\'' + a.id + '\')"><i style="background:' + a.c + '"></i><span>' + a.name + '</span></button>').join('') + '</div>'
    + '<label class="happ-row"><span><b>Animations</b><small>Transitions et compteurs animés</small></span><input type="checkbox" ' + (u.anim !== false ? 'checked' : '') + ' onchange="haloSaveUI({anim:this.checked})"><i class="hsw"></i></label>'
    + '<label class="happ-row happ-name"><span><b>Prénom affiché</b><small>Pour le message d\'accueil</small></span><input type="text" value="' + hEsc(u.name || haloUserName()) + '" onchange="haloSaveUI({name:this.value.trim()});haloRefreshUser();if(window._haloRoute===\'home\')haloRenderHome()"></label>';
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener('click', function off(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', off); } }), 0);
}
function haloSetAccent(id) {
  haloSaveUI({ acc: id });
  document.querySelectorAll('#happ .happ-sw button').forEach((b, i) => b.classList.toggle('on', HALO_ACCENTS[i].id === id));
  const a = HALO_ACCENTS.find(x => x.id === id);
  try { showToast('Thème « ' + a.name + ' » appliqué', a.c); } catch (e) {}
  // Les graphiques canvas relisent les couleurs
  setTimeout(() => { try { if (window._haloRoute === 'home') haloRenderHome(true); else if (window._haloRoute === 'dashboard') _renderDashTab(); } catch (e) {} }, 950);
}

// ════════════ Palette ⌘K ════════════
function haloPaletteItems() {
  const items = [];
  HALO_NAV.filter(n => n.id).forEach(n => items.push({ sec: 'Aller à', label: n.label, hint: n.hint, ico: n.ico, run: () => haloGo(n.id), kw: n.label + ' ' + (n.hint || '') }));
  items.push({ sec: 'Aller à', label: 'Mapping du mois', ico: 'folder', run: () => haloGo('mapping'), kw: 'mapping étape 2' });
  items.push({ sec: 'Aller à', label: 'Validation du mois', ico: 'check-circle', run: () => haloGo('validation'), kw: 'validation étape 3' });
  (typeof HDASH_ITEMS !== 'undefined' ? HDASH_ITEMS : []).forEach(it => items.push({ sec: 'Tableau de bord', label: it.label, hint: it.hint, ico: it.ico, kw: 'dashboard tableau ' + it.label + ' ' + it.hint, run: () => { haloGo('dashboard'); setTimeout(() => hdashGo(it.id), 60); } }));
  try {
    (getParams().biens || []).forEach(b => items.push({ sec: 'Biens', label: b.name, hint: (b.mode || b.type || '') + ' · ' + (b.sci || ''), ico: 'home', kw: b.name + ' ' + b.sci, run: () => haloOpenDashTab('synthese', 'ca', b.name) }));
  } catch (e) {}
  items.push({ sec: 'Actions', label: 'Exporter le dashboard en Excel', ico: 'download', kw: 'export excel xlsx', run: () => exportDashboardExcel() });
  items.push({ sec: 'Actions', label: 'Importer un relevé bancaire', ico: 'upload', kw: 'import banque relevé', run: () => haloGo('import') });
  items.push({ sec: 'Actions', label: 'Changer la couleur d\'accent', ico: 'sparkles', kw: 'theme couleur apparence accent', run: () => setTimeout(() => haloAppearance(), 0) });
  return items;
}
function haloOpenDashTab(tab, sub, bienName) {
  haloGo('dashboard');
  setTimeout(() => {
    if (typeof hdashGo === 'function') hdashGo(sub || tab);
    if (bienName && typeof _msState === 'object') {
      _msState['syn-bien'] = [bienName];
      try { renderSynTab(); } catch (e) {}
    }
  }, 60);
}
let _hpalItems = [], _hpalSel = 0;
function haloPalette() {
  let p = document.getElementById('hpal');
  if (!p) {
    p = document.createElement('div');
    p.id = 'hpal';
    p.innerHTML = '<div class="hpal-box" role="dialog" aria-label="Recherche"><div class="hpal-in">' + hIco('search', 19)
      + '<input id="hpal-q" placeholder="Rechercher un écran, un bien, une action…" autocomplete="off"><kbd style="font:600 11px var(--font);color:var(--text3)">Échap</kbd></div><div class="hpal-list" id="hpal-list"></div></div>';
    p.addEventListener('mousedown', e => { if (e.target === p) haloPaletteClose(); });
    document.body.appendChild(p);
    const q = p.querySelector('#hpal-q');
    q.addEventListener('input', () => { _hpalSel = 0; haloPaletteRender(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { _hpalSel = Math.min(_hpalItems.length - 1, _hpalSel + 1); haloPaletteRender(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { _hpalSel = Math.max(0, _hpalSel - 1); haloPaletteRender(); e.preventDefault(); }
      else if (e.key === 'Enter') { const it = _hpalItems[_hpalSel]; if (it) { haloPaletteClose(); it.run(); } }
      else if (e.key === 'Escape') haloPaletteClose();
    });
  }
  p.classList.add('open');
  const q = document.getElementById('hpal-q');
  q.value = ''; _hpalSel = 0; haloPaletteRender();
  setTimeout(() => q.focus(), 10);
}
function haloPaletteClose() { const p = document.getElementById('hpal'); if (p) p.classList.remove('open'); }
function haloPaletteRender() {
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(document.getElementById('hpal-q').value.trim());
  const all = haloPaletteItems();
  _hpalItems = q ? all.filter(it => q.split(/\s+/).every(w => norm(it.kw + ' ' + it.label).includes(w))) : all.filter(it => it.sec !== 'Biens').slice(0, 14);
  const list = document.getElementById('hpal-list');
  if (!_hpalItems.length) { list.innerHTML = '<div class="hpal-empty">Aucun résultat</div>'; return; }
  let html = '', sec = '';
  _hpalItems.forEach((it, i) => {
    if (it.sec !== sec) { sec = it.sec; html += '<div class="hpal-sec">' + sec + '</div>'; }
    html += '<div class="hpal-row' + (i === _hpalSel ? ' sel' : '') + '" data-i="' + i + '"><span class="hpal-ico">' + hIco(it.ico, 16) + '</span>' + hEsc(it.label) + (it.hint ? '<small>' + hEsc(it.hint) + '</small>' : '') + '</div>';
  });
  list.innerHTML = html;
  list.querySelectorAll('.hpal-row').forEach(r => {
    r.onmouseenter = () => { _hpalSel = +r.dataset.i; list.querySelectorAll('.hpal-row').forEach(x => x.classList.toggle('sel', x === r)); };
    r.onclick = () => { const it = _hpalItems[+r.dataset.i]; haloPaletteClose(); it.run(); };
  });
  const s = list.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
}
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    if (!document.body.classList.contains('halo-in')) return;
    e.preventDefault();
    const p = document.getElementById('hpal');
    if (p && p.classList.contains('open')) haloPaletteClose(); else haloPalette();
  }
});

// ════════════ Démarrage ════════════
// Barres du haut des écrans plein cadre → en-tête de page
function haloOverlayHeads() {
  [['#marketplaceScreen .mkt-topbar', 'Marketplace', 'Biens à vendre · opportunités · baromètre'],
   ['#sim-topbar', 'Simulateur', 'Rentabilité · fiscalité · comparatif des régimes'],
   ['#bud-topbar', 'Budget', 'Prévisionnel · réel vs budget · atterrissage']].forEach(([sel, t, sub]) => {
    const el = document.querySelector(sel);
    if (!el || el.classList.contains('hov-top')) return;
    el.classList.add('hov-top');
    const left = el.firstElementChild;
    if (!left) return;
    const d = document.createElement('div');
    d.className = 'hov-title';
    d.innerHTML = '<b>' + t + '</b><small>' + sub + '</small>';
    left.insertBefore(d, left.firstChild);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  haloOverlayHeads();
  haloBuildSidebar();
  haloWatchSession();
  if (typeof _auth !== 'undefined') { try { _auth.onAuthStateChanged(() => { haloRefreshUser(); if (window._haloRoute === 'home') { try { haloRenderHome(true); } catch (e) {} } }); } catch (e) {} }
});
