// ════════════════════════════════════════════════════════════════
//  HALO — Expérience téléphone (même site, mise en page dédiée ≤ 900 px)
//  · barre d'onglets en bas : Accueil, Tableau de bord, Calendrier, Budget, Menu
//  · « Menu » ouvre un panneau avec toutes les parties, Paramètres et Déconnexion
//  · filtres du tableau de bord repliables (résumé de la période affiché)
//  Les droits d'accès (js/32) sont respectés : une partie masquée n'apparaît pas.
// ════════════════════════════════════════════════════════════════
(function () {
  const MQ = window.matchMedia('(max-width: 900px)');
  const TABS = [
    ['home', 'Accueil', 'home'],
    ['dashboard', 'Tableau', 'layout-dashboard'],
    ['calendar', 'Agenda', 'calendar'],
    ['budget', 'Budget', 'target'],
  ];
  const allowed = r => typeof haloRouteAllowed !== 'function' || haloRouteAllowed(r);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Barre d'onglets ──
  function buildNav() {
    let nav = document.getElementById('hmnav');
    if (!nav) { nav = document.createElement('nav'); nav.id = 'hmnav'; nav.setAttribute('aria-label', 'Navigation'); document.body.appendChild(nav); }
    const tabs = TABS.filter(t => allowed(t[0]));
    nav.innerHTML = tabs.map(t => '<button type="button" class="hmn-it" data-route="' + t[0] + '" onclick="hmGo(\'' + t[0] + '\')">' + hIco(t[2], 21) + '<span>' + t[1] + '</span></button>').join('')
      + '<button type="button" class="hmn-it hmn-more" data-route="__more" onclick="hmMenu(true)">' + hIco('menu', 21) + '<span>Menu</span></button>';
    syncActive(window._haloRoute);
  }
  function syncActive(route) {
    const nav = document.getElementById('hmnav'); if (!nav) return;
    let on = route;
    if (!TABS.some(t => t[0] === route)) on = '__more';
    nav.querySelectorAll('.hmn-it').forEach(b => b.classList.toggle('on', b.dataset.route === on));
  }
  window.hmGo = function (route) {
    hmMenu(false);
    if (route === window._haloRoute && route !== 'dashboard') { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} return; }
    haloGo(route);
  };

  // ── Panneau « Menu » ──
  window.hmMenu = function (open) {
    let sh = document.getElementById('hmsheet');
    if (!open) { if (sh) { sh.classList.remove('on'); setTimeout(() => { if (sh && !sh.classList.contains('on')) sh.remove(); }, 260); } return; }
    if (sh) sh.remove();
    sh = document.createElement('div'); sh.id = 'hmsheet';
    const cur = window._haloRoute;
    let html = '', group = '';
    const nav = (typeof HALO_NAV !== 'undefined' ? HALO_NAV : []);
    nav.forEach(n => {
      if (n.group) { group = n.group; return; }
      if (!allowed(n.id)) return;
      if (group !== null) { html += '<div class="hms-cap">' + esc(group || 'Général') + '</div>'; group = null; }
      html += '<button type="button" class="hms-it' + (n.id === cur || (n.steps && n.steps.some(s => s[0] === cur)) ? ' on' : '') + '" onclick="hmGo(\'' + n.id + '\')">'
        + '<span class="hms-ico">' + hIco(n.ico, 18) + '</span><span class="hms-t"><b>' + esc(n.label) + '</b><small>' + esc(n.hint || '') + '</small></span>' + hIco('chevron-right', 16) + '</button>';
    });
    let who = ''; try { who = (haloUI().fullName || haloUserName() || ''); } catch (e) {}
    html += '<div class="hms-cap">Compte</div>'
      + '<button type="button" class="hms-it' + (cur === 'settings' ? ' on' : '') + '" onclick="hmGo(\'settings\')"><span class="hms-ico">' + hIco('settings', 18) + '</span><span class="hms-t"><b>Paramètres</b><small>' + esc(who ? who + ' · profil, apparence, accès' : 'Profil, apparence, accès') + '</small></span>' + hIco('chevron-right', 16) + '</button>'
      + '<button type="button" class="hms-it hms-out" onclick="hmMenu(false);logout()"><span class="hms-ico">' + hIco('power', 18) + '</span><span class="hms-t"><b>Se déconnecter</b></span></button>';
    sh.innerHTML = '<div class="hms-bg" onclick="hmMenu(false)"></div><div class="hms-panel" role="dialog" aria-label="Menu"><div class="hms-grip"></div>'
      + '<div class="hms-head"><b>Menu</b><button type="button" class="hms-x" onclick="hmMenu(false)" aria-label="Fermer">' + hIco('x', 18) + '</button></div>'
      + '<div class="hms-list">' + html + '</div></div>';
    document.body.appendChild(sh);
    requestAnimationFrame(() => sh.classList.add('on'));
    // Glisser vers le bas pour fermer
    const panel = sh.querySelector('.hms-panel');
    let y0 = null, dy = 0;
    panel.addEventListener('touchstart', e => { if (sh.querySelector('.hms-list').scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; panel.style.transition = 'none'; }, { passive: true });
    panel.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); panel.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    panel.addEventListener('touchend', () => { if (y0 === null) return; panel.style.transition = ''; panel.style.transform = ''; if (dy > 90) hmMenu(false); y0 = null; });
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hmMenu(false); });

  // ── Filtres repliables ──
  const fmtD = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) : ''; };
  function filterSummary(bar) {
    const ins = [...bar.querySelectorAll('input[type=date]')];
    let txt = ins.length >= 2 && ins[0].value && ins[1].value ? fmtD(ins[0].value) + ' → ' + fmtD(ins[1].value) : '';
    let n = 0;
    bar.querySelectorAll('.ms-wrap .ms-label').forEach(l => { const w = l.closest('.ms-wrap'); if (w && l.textContent.trim() !== (w.dataset.all || '')) n++; });
    bar.querySelectorAll('select').forEach(s => { if (s.closest('.ms-wrap')) return; if (s.selectedIndex > 0 && /all|tous|toutes/i.test(s.options[0] && (s.options[0].value + s.options[0].text) || '')) n++; });
    if (!txt) { const y = bar.querySelector('select'); if (y && y.selectedOptions[0]) txt = y.selectedOptions[0].text; }
    return { txt: txt || 'Toutes les périodes', n };
  }
  function decorateFilters() {
    if (!MQ.matches) return;
    document.querySelectorAll('#sc6 [id$="-filters"], #budgetScreen [id$="-filters"]').forEach(bar => {
      if (!bar.offsetParent && getComputedStyle(bar).display === 'none') return;
      let t = bar.querySelector(':scope > .hm-ftoggle');
      if (!t) {
        t = document.createElement('button'); t.type = 'button'; t.className = 'hm-ftoggle';
        t.onclick = () => { bar.classList.toggle('hm-open'); refresh(bar); };
        bar.insertBefore(t, bar.firstChild);
        bar.classList.add('hm-fbar');
        bar.addEventListener('change', () => setTimeout(() => refresh(bar), 50));
      }
      refresh(bar);
    });
  }
  function refresh(bar) {
    const t = bar.querySelector(':scope > .hm-ftoggle'); if (!t) return;
    const s = filterSummary(bar);
    t.innerHTML = '<span class="hm-fi">' + hIco('sliders-horizontal', 16) + '</span><span class="hm-ft"><b>Filtres' + (s.n ? ' <i>' + s.n + '</i>' : '') + '</b><small>' + esc(s.txt) + '</small></span>' + hIco('chevron-down', 18);
  }
  window.hmRefreshFilters = decorateFilters;

  // ── Branchements ──
  const set = window.haloSetActive;
  if (typeof set === 'function') window.haloSetActive = function (route) { const r = set.apply(this, arguments); try { syncActive(route); setTimeout(decorateFilters, 60); } catch (e) {} return r; };
  if (typeof window.hdashSync === 'function') {
    const hs = window.hdashSync;
    window.hdashSync = function () { const r = hs.apply(this, arguments); try { setTimeout(decorateFilters, 60); } catch (e) {} return r; };
  }
  const apply = window.haloApplyAccess;
  if (typeof apply === 'function') window.haloApplyAccess = function () { const r = apply.apply(this, arguments); try { buildNav(); } catch (e) {} return r; };
  const go = window.haloGo;
  if (typeof go === 'function') window.haloGo = function () { const r = go.apply(this, arguments); try { syncActive(window._haloRoute); } catch (e) {} return r; };

  function init() { buildNav(); decorateFilters(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  MQ.addEventListener ? MQ.addEventListener('change', decorateFilters) : MQ.addListener(decorateFilters);
})();
