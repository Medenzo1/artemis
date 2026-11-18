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
  Object.assign(ArtCharts.colors, {
    text: '#231a1c', text2: '#6e6064', grid: 'rgba(110,60,45,0.09)', zero: 'rgba(110,60,45,0.28)',
    card: '#ffffff', green: '#16a35f', red: '#e0353f', cyan: haloAccHex(), gold: '#d98a0b', purple: '#7c5cf5',
    hover: 'rgba(255,255,255,0.55)', year: 'rgba(110,96,100,0.65)', guide: 'rgba(110,60,45,0.25)', guide2: 'rgba(110,60,45,0.4)',
    axis: 'rgba(110,60,45,0.22)', track: 'rgba(110,60,45,0.10)', band: 'rgba(255,255,255,0.35)', other: '#a08f93',
    font: "'Inter Tight', 'Inter', system-ui, sans-serif",
  });
}
const _HALO_COLMAP = () => ({
  '#22d3c8': haloAccHex(), '#0fa89f': haloAccHex(), '#22c97a': '#16a35f', '#34d399': '#16a35f', '#f0566a': '#e0353f',
  '#f5b731': '#d98a0b', '#ffb400': '#d98a0b', '#9b6ef3': '#7c5cf5', '#4f9eff': '#2f74f0', '#ff9142': '#ef7d1f',
  '#f472b6': '#e0559b', '#e2e8f3': '#231a1c', '#8a9ab2': '#6e6064',
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
const HDASH_TABS = [
  { tab: 'synthese', label: 'Synthèse', ico: 'wallet', subs: [['ca', 'CA'], ['depenses', 'Dépenses'], ['tresorerie', 'Trésorerie']], kind: 'stab' },
  { tab: 'resultat', label: 'Résultat', ico: 'scale' },
  { tab: 'kpis', label: 'KPIs', ico: 'trending-up', subs: [['lcd', 'Courte durée'], ['lld', 'Longue durée']], kind: 'ktab' },
  { tab: 'plateformes', label: 'Plateformes', ico: 'globe' },
  { tab: 'budget', label: 'Réel vs budget', ico: 'target' },
];
function hdashBuild() {
  const sc6 = document.getElementById('sc6');
  if (!sc6 || document.getElementById('hdash-head')) return;
  const head = document.createElement('div');
  head.id = 'hdash-head';
  head.innerHTML = '<div class="hpage-head"><div><div class="hpage-title">Dashboard</div><div class="hpage-sub" id="hdash-sub"></div></div>'
    + '<div class="hpage-actions"><button class="hbtn hbtn-light" onclick="openGuide(\'dashboard\', event)">' + hIco('info', 15) + 'Guide</button>'
    + '<button class="hbtn hbtn-dark" onclick="exportDashboardExcel();">' + hIco('download', 15) + 'Exporter en Excel</button></div></div>'
    + '<div class="hdash-tabs"><div class="hseg" id="hdash-main">' + HDASH_TABS.map(t => '<button data-tab="' + t.tab + '" onclick="hdashTab(\'' + t.tab + '\')">' + hIco(t.ico, 15) + t.label + '</button>').join('') + '</div>'
    + '<div class="hseg hseg-sub" id="hdash-sub-seg"></div></div>';
  sc6.insertBefore(head, sc6.firstChild);
  hdashSync();
}
function hdashTab(tab) {
  const b = document.querySelector('#dash-nav .dnav-head[data-tab="' + tab + '"]');
  if (b) b.click();
  hdashSync();
}
function hdashSub(kind, val) {
  const b = document.querySelector('#dash-nav .dnav-sub[data-' + kind + '="' + val + '"]');
  if (b) b.click();
  hdashSync();
}
function hdashSync() {
  const cur = typeof _dashTab !== 'undefined' ? _dashTab : 'synthese';
  document.querySelectorAll('#hdash-main button').forEach(b => b.classList.toggle('on', b.dataset.tab === cur));
  const t = HDASH_TABS.find(x => x.tab === cur);
  const seg = document.getElementById('hdash-sub-seg');
  if (seg) {
    if (t && t.subs) {
      const v = t.kind === 'stab' ? (typeof _synTab !== 'undefined' ? _synTab : 'ca') : (typeof _kpiTab !== 'undefined' ? _kpiTab : 'lcd');
      seg.innerHTML = t.subs.map(([k, l]) => '<button class="' + (k === v ? 'on' : '') + '" onclick="hdashSub(\'' + t.kind + '\',\'' + k + '\')">' + l + '</button>').join('');
      seg.style.display = '';
    } else { seg.innerHTML = ''; seg.style.display = 'none'; }
  }
  const sub = document.getElementById('hdash-sub');
  if (sub) {
    const a = document.getElementById('syn-date-min'), z = document.getElementById('syn-date-max');
    const f = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
    const range = a && z && a.value && z.value ? 'Du ' + f(a.value) + ' au ' + f(z.value) : 'Toutes les périodes';
    let n = 0; try { n = Object.keys(getDB().periods || {}).length; } catch (e) {}
    sub.textContent = range + ' · ' + n + ' mois importés';
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
