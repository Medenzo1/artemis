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
  { group: 'Principal' },
  { id: 'home', label: 'Accueil', ico: 'home' },
  { id: 'dashboard', label: 'Dashboard', ico: 'layout-dashboard' },
  { id: 'budget', label: 'Budget', ico: 'target' },
  { group: 'Données' },
  { id: 'import', label: 'Import', ico: 'upload' },
  { id: 'mapping', label: 'Mapping', ico: 'folder' },
  { id: 'validation', label: 'Validation', ico: 'check-circle' },
  { id: 'base', label: 'Base', ico: 'database' },
  { group: 'Outils' },
  { id: 'simulateur', label: 'Simulateur', ico: 'calculator' },
  { id: 'marketplace', label: 'Marketplace', ico: 'store' },
  { group: 'Système' },
  { id: 'params', label: 'Paramètres', ico: 'settings' },
  { id: 'loans', label: 'Emprunts', ico: 'landmark' },
  { id: 'lcd', label: 'Location directe', ico: 'bed-double' },
  { id: 'amort', label: 'Amortissements', ico: 'trending-up' },
];

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
    + '<button class="hsb-search" onclick="haloPalette()">' + hIco('search', 15) + '<span>Rechercher ou aller à…</span><kbd>⌘K</kbd></button>';
  HALO_NAV.forEach(n => {
    if (n.group) { html += '<div class="hsb-group">' + n.group + '</div>'; return; }
    html += '<button class="hsb-item" data-route="' + n.id + '" onclick="haloGo(\'' + n.id + '\')">' + hIco(n.ico) + '<span>' + n.label + '</span></button>';
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
function haloSetActive(route) {
  window._haloRoute = route;
  document.querySelectorAll('#hsb .hsb-item').forEach(b => b.classList.toggle('on', b.dataset.route === route));
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
function _haloParamsTab(navId) {
  enterTools();
  setTimeout(() => { const b = document.getElementById(navId); if (b) b.click(); haloSetActive(window._haloPendingRoute); }, 0);
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
    case 'params': _haloLeaveDash(); _haloParamsTab('nav-params'); break;
    case 'loans': _haloLeaveDash(); _haloParamsTab('nav-loans'); break;
    case 'lcd': _haloLeaveDash(); _haloParamsTab('nav-lcd'); break;
    case 'amort': _haloLeaveDash(); _haloParamsTab('nav-amort'); break;
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
  HALO_NAV.filter(n => n.id).forEach(n => items.push({ sec: 'Aller à', label: n.label, ico: n.ico, run: () => haloGo(n.id), kw: n.label }));
  const tabs = [
    ['Synthèse · CA', 'synthese', 'ca'], ['Synthèse · Dépenses', 'synthese', 'depenses'], ['Synthèse · Trésorerie', 'synthese', 'tresorerie'],
    ['Résultat (SIG)', 'resultat'], ['KPIs · Location courte durée', 'kpis', 'lcd'], ['KPIs · Location longue durée', 'kpis', 'lld'],
    ['Plateformes', 'plateformes'], ['Réel vs budget', 'budget'],
  ];
  tabs.forEach(([label, tab, sub]) => items.push({ sec: 'Dashboard', label, ico: 'bar-chart-3', kw: 'dashboard ' + label, run: () => haloOpenDashTab(tab, sub) }));
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
    const head = document.querySelector('.dnav-head[data-tab="' + tab + '"]');
    if (head) head.click();
    if (sub) {
      const s = document.querySelector('.dnav-sub[data-stab="' + sub + '"], .dnav-sub[data-ktab="' + sub + '"]');
      if (s) s.click();
    }
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
document.addEventListener('DOMContentLoaded', () => {
  haloBuildSidebar();
  haloWatchSession();
  if (window._auth) { try { _auth.onAuthStateChanged(() => haloRefreshUser()); } catch (e) {} }
});
