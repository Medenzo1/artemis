// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Animations d'arrivée « Halo »
//  À l'arrivée sur une page (ou un onglet du dashboard) : les cartes
//  montent du flou en cascade, les chiffres défilent jusqu'à leur
//  valeur, les graphiques se dessinent, les lignes de tableau glissent.
//  Les re-rendus dus aux filtres ne rejouent pas l'animation.
// ════════════════════════════════════════════════════════════════

const HALO_BLOCKS = '.card,.kpi-card,.hg,.sim-card,.sim-regime-card,.mkt-listing-card,.mkt-form,.import-card,.bud-side,.bud-main,.bud-card,.bud-kpi,.bud-lcd-card,[id$="-filters"],.hpage-head,.hdash-tabs,.app > header,.hov-title';
const HALO_NUM_RE = /^([+\-−]?\s?)(\d{1,3}(?:[\s  ]\d{3})*|\d+)(?:([,.])(\d+))?(\s?(?:k€|M€|€|%|pts?|ans?|mois|nuits?)?)$/;

function haloAnimOn() { try { return haloUI().anim !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } }

function _haloOnce(el, cls, delay) {
  if (el.classList.contains(cls)) return;
  el.style.animationDelay = delay.toFixed(2) + 's';
  el.classList.add(cls);
  el.addEventListener('animationend', function done(e) {
    if (e.target !== el) return;
    el.classList.remove(cls); el.style.animationDelay = '';
    el.removeEventListener('animationend', done);
  });
}

// Fait défiler un nombre affiché (« +84 805 € », « 21,7 % », « 1021 »…) en gardant son format
function haloCountText(el, delay) {
  const txt = el.textContent.trim();
  const m = txt.match(HALO_NUM_RE);
  if (!m) return;
  const sep = (m[2].match(/[\s  ]/) || [''])[0];
  const intDigits = m[2].replace(/[\s  ]/g, '');
  const dec = m[4] ? m[4].length : 0;
  const target = parseFloat(intDigits + (dec ? '.' + m[4] : ''));
  if (!isFinite(target) || target === 0) return;
  const fmt = v => {
    let s = v.toFixed(dec).split('.');
    let i = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep || '');
    if (!sep && s[0].length > 4) i = s[0];
    return m[1] + i + (dec ? (m[3] || ',') + s[1] : '') + m[5];
  };
  const D = 1100, start = performance.now() + delay * 1000;
  el.textContent = fmt(0);
  const step = t => {
    if (!el.isConnected) return;
    const p = Math.max(0, Math.min(1, (t - start) / D)), e = 1 - Math.pow(1 - p, 4);
    if (p < 1) { el.textContent = fmt(target * e); requestAnimationFrame(step); }
    else el.textContent = txt;
  };
  requestAnimationFrame(step);
}

function haloAnimateIn(root, opts) {
  if (!root || !haloAnimOn()) return;
  opts = opts || {};
  const base = opts.delay || 0;
  const vh = window.innerHeight;
  const blocks = [...root.querySelectorAll(HALO_BLOCKS)].filter(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
    const anc = el.parentElement && el.parentElement.closest(HALO_BLOCKS);
    return !(anc && root.contains(anc));
  });
  let k = 0;
  blocks.forEach(el => {
    const r = el.getBoundingClientRect();
    const visible = r.top < vh + 40;
    const d = base + (visible ? Math.min(k++, 14) * 0.06 : 0.05);
    _haloOnce(el, 'hrise', d);
    if (!visible) return;
    // Graphiques : tracé qui se déroule de gauche à droite
    el.querySelectorAll('canvas, .kpi-v2-spark svg, svg.hh-spark').forEach(c => _haloOnce(c, 'hwipe', d + 0.15));
    // Lignes de tableau en cascade
    el.querySelectorAll('tbody tr').forEach((tr, j) => { if (j < 16) _haloOnce(tr, 'hrow', d + 0.2 + j * 0.03); });
    // Chiffres qui défilent (gros caractères uniquement)
    el.querySelectorAll('div, span, b, strong, dd, td').forEach(n => {
      if (n.children.length || !n.textContent.trim()) return;
      const fs = parseFloat(getComputedStyle(n).fontSize) || 0;
      if (fs >= 17) haloCountText(n, d + 0.1);
    });
  });
}

// Conteneur visible selon la page
function _haloRouteRoot(route) {
  if (route === 'dashboard') return document.getElementById('sc6');
  if (route === 'budget') return document.getElementById('budgetScreen');
  if (route === 'simulateur') return document.getElementById('simulateurScreen');
  if (route === 'marketplace') return document.getElementById('marketplaceScreen');
  if (route === 'home') return null; // l'accueil a sa propre chorégraphie
  return document.querySelector('.app');
}
let _haloAnimTimer = null;
function haloAnimateRoute(route) {
  if (!haloAnimOn()) return;
  const root = _haloRouteRoot(route);
  if (!root) return;
  clearTimeout(_haloAnimTimer);
  const isApp = root.classList.contains('app');
  // Les écrans Données / Patrimoine changent au tick suivant : on les masque le temps qu'ils se posent
  if (isApp) root.classList.add('halo-pre');
  _haloAnimTimer = setTimeout(() => {
    root.classList.remove('halo-pre');
    requestAnimationFrame(() => haloAnimateIn(root));
  }, isApp ? 140 : 0);
}

// Changement de page : branché sur la barre latérale
(function () {
  const orig = window.haloSetActive;
  if (typeof orig !== 'function') return;
  window.haloSetActive = function (route) {
    const prev = window._haloRoute;
    const r = orig.apply(this, arguments);
    if (route && route !== prev) haloAnimateRoute(route);
    return r;
  };
})();

// Changement d'onglet du dashboard (ordinateur et tiroir mobile)
['switchNavHead', 'switchNavSub', 'switchNavKpi', 'dashDrawerTab', 'dashDrawerSub'].forEach(name => {
  const orig = window[name];
  if (typeof orig !== 'function') return;
  window[name] = function () {
    const r = orig.apply(this, arguments);
    const panel = document.getElementById('dp-' + (typeof _dashTab !== 'undefined' ? _dashTab : 'synthese'));
    clearTimeout(_haloAnimTimer);
    requestAnimationFrame(() => haloAnimateIn(panel));
    return r;
  };
});

// Budget : nouvel onglet, nouveau bien ou nouvelle version (pas à chaque saisie)
(function () {
  const orig = window.budRender;
  if (typeof orig !== 'function') return;
  let last = '';
  window.budRender = function () {
    const r = orig.apply(this, arguments);
    const key = (typeof _bud !== 'undefined') ? _bud.tab + '|' + _bud.entity + '|' + _bud.vid : '';
    if (key !== last && last && window._haloRoute === 'budget') {
      const root = document.getElementById('bud-content');
      requestAnimationFrame(() => haloAnimateIn(root));
    }
    last = key;
    return r;
  };
})();
// Simulateur : passage formulaire → résultats
(function () {
  const orig = window.simShowView;
  if (typeof orig !== 'function') return;
  window.simShowView = function (view) {
    const changed = typeof SIM_CURRENT_VIEW !== 'undefined' && SIM_CURRENT_VIEW !== view;
    const r = orig.apply(this, arguments);
    if (changed && window._haloRoute === 'simulateur') requestAnimationFrame(() => haloAnimateIn(document.getElementById('sim-content')));
    return r;
  };
})();

// Annonces de la Marketplace : chargées après coup
(function () {
  const orig = window.mktRefreshGrid;
  if (typeof orig !== 'function') return;
  window.mktRefreshGrid = async function () {
    const r = await orig.apply(this, arguments);
    requestAnimationFrame(() => haloAnimateIn(document.getElementById('mkt-listings')));
    return r;
  };
})();
