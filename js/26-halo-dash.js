// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Dashboard « Halo »
//  En-tête de page (titre + onglets en pilules) qui pilote la barre
//  d'onglets d'origine (masquée), et thème clair des graphiques.
// ════════════════════════════════════════════════════════════════

// ── Graphiques : palette claire + couleurs historiques recalées ──
function haloAccHex() {
  const id = haloUI().acc || 'corail';
  return (HALO_ACCENTS.find(a => a.id === id) || HALO_ACCENTS[0]).c;
}
function haloChartTheme() {
  if (typeof ArtCharts === 'undefined' || !ArtCharts.colors) return;
  const cs = getComputedStyle(document.documentElement);
  const v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  const t = v('--tint', '110,60,45'), tx = v('--text', '#231a1c'), t2 = v('--text2', '#6e6064');
  Object.assign(ArtCharts.colors, {
    text: tx, text2: t2, grid: 'rgba(' + t + ',0.15)', zero: 'rgba(' + t + ',0.28)',
    card: '#ffffff', green: '#16a35f', red: '#e0353f', cyan: haloAccHex(), gold: '#d98a0b', purple: '#7c5cf5',
    hover: 'rgba(255,255,255,0.55)', year: 'rgba(' + t + ',0.5)', guide: 'rgba(' + t + ',0.25)', guide2: 'rgba(' + t + ',0.4)',
    axis: 'rgba(' + t + ',0.22)', track: 'rgba(' + t + ',0.10)', band: 'rgba(255,255,255,0.35)', other: '#a09398',
    font: "'Inter Tight', 'Inter', system-ui, sans-serif",
  });
}
const _HALO_COLMAP = () => ({
  '#22d3c8': haloAccHex(), '#0fa89f': haloAccHex(), '#22c97a': '#16a35f', '#34d399': '#16a35f', '#f0566a': '#e0353f',
  '#f5b731': '#d98a0b', '#ffb400': '#d98a0b', '#9b6ef3': '#7c5cf5', '#4f9eff': '#2f74f0', '#ff9142': '#ef7d1f',
  '#f472b6': '#e0559b', '#e2e8f3': (getComputedStyle(document.documentElement).getPropertyValue('--text') || '#231a1c').trim(), '#8a9ab2': (getComputedStyle(document.documentElement).getPropertyValue('--text2') || '#6e6064').trim(),
});
function _haloRecolor(v, map, depth) {
  if (depth > 5 || v == null) return v;
  if (typeof v === 'string') { const k = v.toLowerCase(); return map[k] || v; }
  if (Array.isArray(v)) return v.map(x => _haloRecolor(x, map, depth + 1));
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const o = {}; for (const k in v) o[k] = _haloRecolor(v[k], map, depth + 1); return o;
  }
  return v;
}
(function haloWrapCharts() {
  if (typeof ArtCharts === 'undefined') return;
  haloChartTheme();
  ['area', 'donut', 'diverging', 'gauge', 'funnel', 'forecast', 'combo'].forEach(name => {
    const orig = ArtCharts[name];
    if (typeof orig !== 'function') return;
    ArtCharts[name] = function (cv, cfg) {
      haloChartTheme();
      return orig.call(this, cv, _haloRecolor(cfg, _HALO_COLMAP(), 0));
    };
  });
})();

// ── En-tête du dashboard ──
// Une seule barre d'onglets, à plat : chaque onglet mène directement à une vue
const HDASH_NAV = [
  { group: 'Finances', items: [
    { id: 'ca', tab: 'synthese', sub: 'ca', label: "Chiffre d'affaires", ico: 'wallet', hint: 'Encaissements par bien, canal et mois' },
    { id: 'depenses', tab: 'synthese', sub: 'depenses', label: 'Dépenses', ico: 'receipt', hint: 'Charges par catégorie et par bien' },
    { id: 'tresorerie', tab: 'synthese', sub: 'tresorerie', label: 'Trésorerie', ico: 'piggy-bank', hint: 'Solde mensuel entrées − sorties' },
    { id: 'resultat', tab: 'resultat', label: 'Résultat', ico: 'scale', hint: 'Compte de résultat et soldes de gestion (SIG)' },
  ] },
  { group: 'Locations', items: [
    { id: 'lcd', tab: 'kpis', sub: 'lcd', label: 'Courte durée', ico: 'bed-double', hint: 'Occupation, prix moyen, point mort' },
    { id: 'lld', tab: 'kpis', sub: 'lld', label: 'Longue durée', ico: 'key', hint: 'Loyers, vacance, rendement' },
    { id: 'plateformes', tab: 'plateformes', label: 'Plateformes', ico: 'globe', hint: 'Airbnb, Booking, direct : revenus et commissions' },
  ] },
  { group: 'Pilotage', items: [
    { id: 'budget', tab: 'budget', label: 'Réel vs budget', ico: 'target', hint: 'Écarts au budget et atterrissage de fin d’année' },
  ] },
];
const HDASH_ITEMS = HDASH_NAV.flatMap(g => g.items);
function hdashCurrent() {
  const tab = typeof _dashTab !== 'undefined' ? _dashTab : 'synthese';
  if (tab === 'synthese') return typeof _synTab !== 'undefined' ? _synTab : 'ca';
  if (tab === 'kpis') return typeof _kpiTab !== 'undefined' ? _kpiTab : 'lcd';
  return tab;
}
function hdashBuild() {
  const sc6 = document.getElementById('sc6');
  if (!sc6 || document.getElementById('hdash-head')) return;
  const head = document.createElement('div');
  head.id = 'hdash-head';
  head.innerHTML = '<div class="hpage-head"><div><div class="hpage-title" id="hdash-title">Tableau de bord</div><div class="hpage-sub" id="hdash-sub"></div></div>'
    + '<div class="hpage-actions"><button class="hbtn hbtn-light" onclick="openGuide(\'dashboard\', event)">' + hIco('info', 15) + 'Guide</button>'
    + '<button class="hbtn hbtn-dark" onclick="exportDashboardExcel();">' + hIco('download', 15) + 'Exporter en Excel</button></div></div>'
    + '<nav class="hdash-nav" aria-label="Vues du tableau de bord">' + HDASH_NAV.map(g => '<div class="hdn-group"><div class="hdn-cap">' + g.group + '</div><div class="hdn-row">'
      + g.items.map(it => '<button class="hdn-tab" data-view="' + it.id + '" title="' + hEsc(it.hint) + '" onclick="hdashGo(\'' + it.id + '\')">' + hIco(it.ico, 16) + '<span>' + it.label + '</span></button>').join('')
      + '</div></div>').join('') + '</nav>';
  sc6.insertBefore(head, sc6.firstChild);
  hdashSync();
}
// Ouvre une vue en un seul rendu (la sous-vue est choisie avant de basculer d'onglet)
function hdashGo(id) {
  const it = HDASH_ITEMS.find(x => x.id === id);
  if (!it) return;
  const curTab = typeof _dashTab !== 'undefined' ? _dashTab : '';
  if (it.sub && curTab === it.tab) {
    const b = document.querySelector('#dash-nav .dnav-sub[data-' + (it.tab === 'kpis' ? 'ktab' : 'stab') + '="' + it.sub + '"]');
    if (b) b.click();
  } else {
    if (it.tab === 'synthese') { _synTab = it.sub; try { _adjustSynFilters(); } catch (e) {} }
    if (it.tab === 'kpis') _kpiTab = it.sub;
    const h = document.querySelector('#dash-nav .dnav-head[data-tab="' + it.tab + '"]');
    if (h) h.click();
  }
  hdashSync();
}
// Compatibilité avec les appels existants (palette, accueil…)
function hdashTab(tab) { const it = HDASH_ITEMS.find(x => x.tab === tab && (!x.sub || x.sub === (tab === 'kpis' ? _kpiTab : _synTab))) || HDASH_ITEMS.find(x => x.tab === tab); if (it) hdashGo(it.id); }
function hdashSub(kind, val) { hdashGo(val); }
function hdashSync() {
  const cur = hdashCurrent();
  document.querySelectorAll('#hdash-head .hdn-tab').forEach(b => b.classList.toggle('on', b.dataset.view === cur));
  const nav = document.querySelector('#hdash-head .hdash-nav'), on = nav && nav.querySelector('.hdn-tab.on');
  if (nav && on && nav.scrollWidth > nav.clientWidth + 4) {
    const r = on.getBoundingClientRect(), n = nav.getBoundingClientRect();
    if (r.left < n.left || r.right > n.right) nav.scrollTo({ left: nav.scrollLeft + r.left - n.left - 24, behavior: 'smooth' });
  }
  const it = HDASH_ITEMS.find(x => x.id === cur);
  const sub = document.getElementById('hdash-sub');
  if (sub) {
    const a = document.getElementById('syn-date-min'), z = document.getElementById('syn-date-max');
    const f = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
    const range = a && z && a.value && z.value ? 'du ' + f(a.value) + ' au ' + f(z.value) : 'toutes les périodes';
    let n = 0; try { n = Object.keys(getDB().periods || {}).length; } catch (e) {}
    sub.innerHTML = (it ? '<b>' + it.label + '</b> · ' + hEsc(it.hint.charAt(0).toLowerCase() + it.hint.slice(1)) + '<br>' : '') + range.charAt(0).toUpperCase() + range.slice(1) + ' · ' + n + ' mois importés';
  }
}
// Toute bascule d'onglet (y compris depuis le tiroir mobile ou la palette) resynchronise l'en-tête
['switchNavHead', 'switchNavSub', 'switchNavKpi', '_renderDashTab'].forEach(name => {
  const orig = window[name];
  if (typeof orig !== 'function' || orig._hdash) return;
  const w = function () { const r = orig.apply(this, arguments); try { hdashSync(); } catch (e) {} return r; };
  w._hdash = true; window[name] = w;
});
(function () {
  const orig = window.enterDashboard;
  window.enterDashboard = function () { hdashBuild(); const r = orig.apply(this, arguments); setTimeout(hdashSync, 120); return r; };
  window.enterDashboard._halo = true;
})();
document.addEventListener('DOMContentLoaded', hdashBuild);

// ── Cartes de chiffres : couleur de sens lue sur le montant, montant passé en noir ──
function haloDecorateKpis(root) {
  (root || document).querySelectorAll('.kpi-card:not(.hk)').forEach(card => {
    let val = card.querySelector('.kpi-v2-val');
    if (!val) {
      let best = null, max = 0;
      card.querySelectorAll('div, span').forEach(n => {
        if (n.children.length || !n.textContent.trim() || n.closest('.art-emo')) return;
        const f = parseFloat(getComputedStyle(n).fontSize) || 0;
        if (f > max) { max = f; best = n; }
      });
      val = best;
    }
    if (!val) return;
    const m = getComputedStyle(val).color.match(/\d+(\.\d+)?/g);
    if (!m) return;
    card.style.setProperty('--krgb', m.slice(0, 3).join(','));
    card.classList.add('hk');
    val.classList.add('hk-val');
    const lblIco = card.querySelector('.kpi-v2-lbl .art-emo');
    if (lblIco) lblIco.classList.add('hk-ico');
    card.querySelectorAll('.art-emo').forEach(e => { if (e !== lblIco) e.classList.add('hk-deco'); });
    // Nom du « meilleur bien » / « poste principal » : garde la couleur de sens
    card.querySelectorAll('div').forEach(n => { if (!n.children.length && n !== val && /color:\s*var\(--(green|red|gold|purple|cyan|blue|orange|pink)\)/.test(n.getAttribute('style') || '')) n.classList.add('hk-name'); });
  });
}
(function () {
  let t = null;
  const run = () => { clearTimeout(t); t = setTimeout(() => haloDecorateKpis(document.getElementById('sc6')), 30); };
  document.addEventListener('DOMContentLoaded', () => {
    const sc6 = document.getElementById('sc6');
    if (sc6) new MutationObserver(run).observe(sc6, { childList: true, subtree: true });
  });
})();

// ── Clic sur un mois d'un graphique : filtre la période sur ce mois ──
(function () {
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const pad = n => String(n).padStart(2, '0');
  let undo = null, timer = null;

  function setRange(pre, a, z) {
    document.querySelectorAll('[id="' + pre + '-date-min"]').forEach(el => { el.value = a; });
    document.querySelectorAll('[id="' + pre + '-date-max"]').forEach(el => { el.value = z; });
    if (pre === 'kpi') { if (typeof renderKpis === 'function') renderKpis(); }
    else if (typeof _synDateInputChange === 'function') _synDateInputChange();
    else if (typeof renderSynTab === 'function') renderSynTab();
    try { hdashSync(); } catch (e) {}
  }

  function pill(text, onUndo) {
    let el = document.getElementById('hpick');
    if (!el) { el = document.createElement('div'); el.id = 'hpick'; document.body.appendChild(el); }
    el.innerHTML = '<span>' + text + '</span><button type="button">Annuler</button>';
    el.querySelector('button').onclick = () => { hide(); onUndo(); };
    el.classList.add('on');
    clearTimeout(timer); timer = setTimeout(hide, 7000);
  }
  function hide() { const el = document.getElementById('hpick'); if (el) el.classList.remove('on'); clearTimeout(timer); }

  window.haloChartPick = function (y, m, cv) {
    if (window._haloRoute !== 'dashboard') return false;
    if (cv && cv.closest && cv.closest('#settingsScreen,.hh-wrap')) return false;
    const pre = (typeof _dashTab !== 'undefined' && _dashTab === 'kpis') ? 'kpi' : 'syn';
    const minEl = document.getElementById(pre + '-date-min'), maxEl = document.getElementById(pre + '-date-max');
    if (!minEl || !maxEl) return false;
    const a = y + '-' + pad(m + 1) + '-01';
    const z = y + '-' + pad(m + 1) + '-' + pad(new Date(y, m + 1, 0).getDate());
    if (minEl.value === a && maxEl.value === z) return false;
    const prev = [minEl.value, maxEl.value];
    setRange(pre, a, z);
    pill('Période filtrée sur ' + MOIS[m] + ' ' + y, () => setRange(pre, prev[0], prev[1]));
    return true;
  };
})();
