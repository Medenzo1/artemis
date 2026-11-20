// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Afficher / masquer les comparaisons au budget
//  Réglage par utilisateur (artemis_ui.showBudget, affiché par défaut).
//  Masqué : plus de blocs « réel vs budget », de courbe budget dans les
//  graphiques, d'onglet « Réel vs budget » ni d'anneau budget à l'accueil.
//  L'écran Budget (saisie) reste accessible.
// ════════════════════════════════════════════════════════════════

function haloBudgetShown() { return haloUI().showBudget !== false; }

(function () {
  const guard = (name, empty) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { return haloBudgetShown() ? orig.apply(this, arguments) : empty; };
  };
  guard('budInjectStrip', undefined);
  guard('budChartSeries', null);
  guard('budSigCardHtml', '');
  guard('budLcdKpiHtml', '');
  guard('budLldKpiHtml', '');
  guard('budPltHtml', '');
  guard('_budAfterFirst', undefined);
  // Accueil : l'anneau se rabat sur le CA de l'année précédente
  const ref = window.budRefVersion;
  window.budRefVersion = function () {
    if (!haloBudgetShown() && window._haloBudgetCaller === 'home') return null;
    return ref.apply(this, arguments);
  };
  const home = window.hhHero;
  if (typeof home === 'function') window.hhHero = function () {
    window._haloBudgetCaller = 'home';
    try { return home.apply(this, arguments); } finally { window._haloBudgetCaller = null; }
  };
})();

function haloSetBudgetShown(on) {
  haloSaveUI({ showBudget: !!on });
  haloBudgetSync();
  try { if (window._haloRoute === 'dashboard') { if (!on && _dashTab === 'budget') hdashGo('ca'); else _renderDashTab(); } } catch (e) {}
  try { if (window._haloRoute === 'home') haloRenderHome(true); } catch (e) {}
  try { showToast(on ? 'Comparaisons au budget affichées' : 'Comparaisons au budget masquées'); } catch (e) {}
}
// Bouton dans l'en-tête du tableau de bord + onglet « Réel vs budget »
function haloBudgetSync() {
  const on = haloBudgetShown();
  const tab = document.querySelector('#hdash-head .hdn-tab[data-view="budget"]');
  if (tab) { const g = tab.closest('.hdn-group'); (g || tab).style.display = on ? '' : 'none'; }
  const act = document.querySelector('#hdash-head .hpage-actions');
  if (!act) return;
  let b = document.getElementById('hbud-toggle');
  if (!b) { b = document.createElement('button'); b.id = 'hbud-toggle'; b.className = 'hbtn hbtn-light'; act.insertBefore(b, act.firstChild); }
  b.innerHTML = hIco('target', 15) + 'Budget : ' + (on ? 'affiché' : 'masqué');
  b.classList.toggle('off', !on);
  b.title = on ? 'Masquer toutes les comparaisons au budget' : 'Afficher les comparaisons au budget';
  b.onclick = () => haloSetBudgetShown(!haloBudgetShown());
}
(function () {
  const sync = window.hdashSync;
  if (typeof sync === 'function') window.hdashSync = function () { const r = sync.apply(this, arguments); try { haloBudgetSync(); } catch (e) {} return r; };
  // Palette : la vue « Réel vs budget » disparaît quand le budget est masqué
  const pal = window.haloPaletteItems;
  if (typeof pal === 'function') window.haloPaletteItems = function () {
    const items = pal.apply(this, arguments);
    return haloBudgetShown() ? items : items.filter(i => i.label !== 'Réel vs budget');
  };
  // Paramètres › Préférences : même réglage
  const hs = window.hsRender;
  if (typeof hs === 'function') window.hsRender = function () {
    const r = hs.apply(this, arguments);
    const card = [...document.querySelectorAll('#hs-content .hs-card')].find(c => /Préférences/.test(c.querySelector('h3') ? c.querySelector('h3').textContent : ''));
    if (card && !card.querySelector('[data-hbud]')) card.insertAdjacentHTML('beforeend', '<label class="hs-row" data-hbud><span><b>Comparaisons au budget</b><small>Blocs réel vs budget, courbe budget et onglet dédié</small></span><input type="checkbox" ' + (haloBudgetShown() ? 'checked' : '') + ' onchange="haloSetBudgetShown(this.checked)"><i class="hsw"></i></label>');
    return r;
  };
})();

// ── Mensuel / Cumulé : la courbe se transforme d'une forme à l'autre (comme le graphique de l'accueil) ──
(function () {
  if (typeof ArtCharts === 'undefined' || typeof ArtCharts.area !== 'function') return;
  const last = {};                 // dernières valeurs affichées, par graphique (couleur + mois)
  const anims = new WeakMap();
  const baseArea = ArtCharts.area;
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  ArtCharts.area = function (cv, cfg) {
    if (!cv || !cfg || !Array.isArray(cfg.values)) return baseArea.apply(this, arguments);
    const key = String(cfg.color || '') + '|' + (cfg.labels || []).join(',');
    const prev = last[key];
    const target = { values: cfg.values.map(v => +v || 0), budget: Array.isArray(cfg.budget) ? cfg.budget.slice() : null };
    last[key] = target;
    const morph = window._haloMorphUntil && Date.now() < window._haloMorphUntil && prev && prev.values.length === target.values.length
      && typeof haloAnimOn === 'function' && haloAnimOn();
    if (!morph) return baseArea.call(this, cv, cfg);
    const old = anims.get(cv); if (old) cancelAnimationFrame(old);
    const t0 = performance.now(), D = 800, self = this;
    const lerpB = (a, b, e) => (b || []).map((v, i) => v == null ? null : (a && a[i] != null ? a[i] + (v - a[i]) * e : v));
    const step = t => {
      const p = Math.min(1, (t - t0) / D), e = ease(p);
      if (p < 1) {
        baseArea.call(self, cv, Object.assign({}, cfg, { values: prev.values.map((v, i) => v + (target.values[i] - v) * e), budget: target.budget ? lerpB(prev.budget, target.budget, e) : cfg.budget }));
        anims.set(cv, requestAnimationFrame(step));
      } else { anims.delete(cv); baseArea.call(self, cv, cfg); }
    };
    baseArea.call(this, cv, Object.assign({}, cfg, { values: prev.values, budget: prev.budget || cfg.budget }));
    anims.set(cv, requestAnimationFrame(step));
  };
  const orig = window._toggleChartMode;
  if (typeof orig === 'function') window._toggleChartMode = function () {
    window._haloMorphUntil = Date.now() + 1500;   // le prochain dessin des courbes se fait en transformation
    return orig.apply(this, arguments);
  };
})();
