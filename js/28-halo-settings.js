// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Écran « Paramètres » (profil, apparence, préférences)
//  Tout est rangé dans artemis_ui (synchronisé avec le cloud) : le
//  profil et l'interface suivent l'utilisateur d'un appareil à l'autre.
// ════════════════════════════════════════════════════════════════

const HS_START = [['home', 'Accueil'], ['dashboard', 'Tableau de bord'], ['calendar', 'Calendrier'], ['budget', 'Budget']];

// ── Application des réglages d'interface (étend celle de la coquille) ──
(function () {
  const base = window.haloApplyUI;
  window.haloApplyUI = function (u) {
    u = u || haloUI();
    base(u);
    const h = document.documentElement;
    // 0 = opaque (cartes et fond blancs) · 100 = verre (cartes transparentes, couleur du thème très présente)
    const g = Math.max(0, Math.min(100, u.glass == null ? 25 : +u.glass)) / 100;
    h.style.setProperty('--glass', 'linear-gradient(155deg, rgba(255,255,255,' + (1 - g * 0.5).toFixed(3) + '), rgba(255,255,255,' + (0.96 - g * 0.66).toFixed(3) + '))');
    h.style.setProperty('--glass-blur', 'blur(' + Math.round(8 + g * 26) + 'px) saturate(' + (1.2 + g * 0.6).toFixed(2) + ')');
    h.style.setProperty('--pa1', (0.8 - g * 0.65).toFixed(3));
    h.style.setProperty('--pa2', (0.62 - g * 0.57).toFixed(3));
    h.classList.toggle('compact', !!u.compact);
    h.classList.toggle('text-lg', u.textSize === 'l');
  };
  window.haloApplyUI();
})();

// ── Avatar (photo ou initiales) partout où il apparaît ──
function hsAvatarHtml(u, size) {
  const n = haloUserName() || 'Mon espace';
  if (u.photo) return '<span class="hs-av" style="width:' + size + 'px;height:' + size + 'px;background-image:url(' + u.photo + ')"></span>';
  return '<span class="hs-av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.36) + 'px">' + hEsc(n.slice(0, 2).toUpperCase()) + '</span>';
}
(function () {
  const base = window.haloRefreshUser;
  window.haloRefreshUser = function () {
    base();
    const u = haloUI(), a = document.getElementById('hsb-av');
    if (!a) return;
    a.style.backgroundImage = u.photo ? 'url(' + u.photo + ')' : '';
    a.classList.toggle('has-photo', !!u.photo);
    if (u.photo) a.textContent = '';
    const role = document.querySelector('#hsb .hsb-urole');
    if (role) role.textContent = u.role || 'Paramètres';
  };
})();

// ── Écran ──
function hsEnsureScreen() {
  let el = document.getElementById('settingsScreen');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'settingsScreen';
  el.style.display = 'none';
  el.innerHTML = '<div class="hov-top hs-top"><div><div class="hov-title"><b>Paramètres</b><small>Profil, apparence et préférences de votre espace</small></div></div>'
    + '<div class="hpage-actions"><button class="hbtn hbtn-light" onclick="hsResetLook()">' + hIco('refresh-cw', 14) + 'Apparence par défaut</button></div></div>'
    + '<div id="hs-content"></div>';
  const mc = document.getElementById('mainContent') || document.body;
  mc.appendChild(el);
  return el;
}
function showSettings() {
  const el = hsEnsureScreen();
  const hs = document.getElementById('homeScreen');
  if (hs) hs.style.display = 'none';
  el.style.display = 'block';
  el.scrollTop = 0;
  hsRender();
}
function hsRender() {
  const u = haloUI();
  const box = document.getElementById('hs-content');
  if (!box) return;
  let email = '';
  try { email = (_auth.currentUser && _auth.currentUser.email) || ''; } catch (e) {}
  const tog = (key, on, title, sub) => '<label class="hs-row"><span><b>' + title + '</b><small>' + sub + '</small></span><input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="hsSet(\'' + key + '\', this.checked)"><i class="hsw"></i></label>';
  const seg = (key, cur, opts) => '<div class="hseg hs-seg">' + opts.map(([v, l]) => '<button class="' + (v === cur ? 'on' : '') + '" onclick="hsSet(\'' + key + '\', \'' + v + '\')">' + l + '</button>').join('') + '</div>';

  // Profil
  const profil = '<section class="hg hs-card"><div class="hs-h"><span class="hs-ico">' + hIco('user', 16) + '</span><div><h3>Profil</h3><small>Ce qui s\'affiche dans la barre latérale et l\'accueil</small></div></div>'
    + '<div class="hs-id">' + hsAvatarHtml(u, 64) + '<div class="hs-id-t"><b>' + hEsc(u.fullName || haloUserName() || 'Mon espace') + '</b><small>' + hEsc(u.role || 'Fonction non renseignée') + '</small></div>'
    + '<div class="hs-id-a"><label class="hbtn hbtn-light">' + hIco('upload', 14) + 'Changer la photo<input type="file" accept="image/*" hidden onchange="hsPhoto(this)"></label>'
    + (u.photo ? '<button class="hbtn hbtn-light" onclick="hsSet(\'photo\', \'\')">' + hIco('trash-2', 14) + 'Retirer</button>' : '') + '</div></div>'
    + '<div class="hs-fields">'
    + '<label><span>Prénom affiché</span><input type="text" value="' + hEsc(u.name || haloUserName()) + '" placeholder="Prénom" onchange="hsSet(\'name\', this.value.trim())"></label>'
    + '<label><span>Nom complet</span><input type="text" value="' + hEsc(u.fullName || '') + '" placeholder="Prénom Nom" onchange="hsSet(\'fullName\', this.value.trim())"></label>'
    + '<label><span>Fonction</span><input type="text" value="' + hEsc(u.role || '') + '" placeholder="Gérant de SCI" onchange="hsSet(\'role\', this.value.trim())"></label>'
    + '<label><span>Adresse e-mail</span><input type="text" value="' + hEsc(email) + '" disabled></label>'
    + '</div></section>';

  // Apparence
  const g = u.glass == null ? 25 : +u.glass;
  const look = '<section class="hg hs-card"><div class="hs-h"><span class="hs-ico">' + hIco('sparkles', 16) + '</span><div><h3>Apparence</h3><small>Couleur d\'accent, verre et densité de l\'interface</small></div></div>'
    + '<div class="hs-swatches">' + HALO_ACCENTS.map(a => '<button class="hs-sw' + ((u.acc || 'corail') === a.id ? ' on' : '') + '" onclick="hsAccent(\'' + a.id + '\')"><i style="background:' + a.c + '"></i><span>' + a.name + '</span></button>').join('') + '</div>'
    + '<div class="hs-row hs-slider"><span><b>Intensité du verre</b><small>Cartes opaques, ou transparentes avec la couleur du thème qui ressort</small></span><div class="hs-glass"><input type="range" min="0" max="100" step="5" value="' + g + '" oninput="hsGlass(this.value)" onchange="hsSet(\'glass\', +this.value)"><div class="hs-glass-l"><span>Opaque</span><span>Verre</span></div></div></div>'
    + tog('anim', u.anim !== false, 'Animations', 'Transitions, cascades et compteurs animés')
    + tog('compact', !!u.compact, 'Mode compact', 'Réduit les espacements pour voir plus de données')
    + '<div class="hs-row"><span><b>Taille du texte</b><small>Agrandit toute l\'interface</small></span>' + seg('textSize', u.textSize || 'n', [['n', 'Normale'], ['l', 'Grande']]) + '</div>'
    + '</section>';

  // Préférences
  const views = typeof HDASH_ITEMS !== 'undefined' ? HDASH_ITEMS : [];
  const prefs = '<section class="hg hs-card"><div class="hs-h"><span class="hs-ico">' + hIco('sliders-horizontal', 16) + '</span><div><h3>Préférences</h3><small>Ce qui s\'ouvre quand vous arrivez</small></div></div>'
    + '<div class="hs-row"><span><b>Page au démarrage</b><small>Après la connexion</small></span>' + seg('start', u.start || 'home', HS_START) + '</div>'
    + '<div class="hs-row"><span><b>Vue du tableau de bord</b><small>Onglet ouvert en arrivant sur le tableau de bord</small></span><select class="sel hs-sel" onchange="hsSet(\'dashView\', this.value)">'
    + views.map(v => '<option value="' + v.id + '"' + ((u.dashView || 'ca') === v.id ? ' selected' : '') + '>' + v.label + '</option>').join('') + '</select></div>'
    + tog('greet', u.greet !== false, 'Message d\'accueil', 'Afficher « Bonjour, prénom » en haut de l\'accueil')
    + '</section>';

  // Mon espace
  let months = 0, biens = 0, scis = 0, budgets = 0, size = 0;
  try { months = Object.keys(getDB().periods || {}).length; } catch (e) {}
  try { const p = getParams(); biens = (p.biens || []).length; scis = (p.scis || []).length; } catch (e) {}
  try { budgets = Object.keys(budGetStore().versions || {}).length; } catch (e) {}
  try { Object.keys(localStorage).filter(k => k.startsWith('artemis_')).forEach(k => { size += (localStorage.getItem(k) || '').length; }); } catch (e) {}
  const stat = (v, l) => '<div class="hs-stat"><b>' + v + '</b><span>' + l + '</span></div>';
  const space = '<section class="hg hs-card"><div class="hs-h"><span class="hs-ico">' + hIco('cloud', 16) + '</span><div><h3>Mon espace</h3><small>Données synchronisées dans le cloud' + (email ? ' · ' + hEsc(email) : '') + '</small></div></div>'
    + '<div class="hs-stats">' + stat(months, 'mois importés') + stat(biens, 'biens') + stat(scis, 'sociétés') + stat(budgets, 'budgets') + '</div>'
    + '<div class="hs-row"><span><b>Volume des données</b><small>Base, paramètres, budgets et réservations</small></span><b class="hs-size">' + (size / 1024 > 1024 ? (size / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo' : Math.round(size / 1024).toLocaleString('fr-FR') + ' Ko') + '</b></div>'
    + '<div class="hs-actions"><button class="hbtn hbtn-light" onclick="exportDashboardExcel();">' + hIco('download', 14) + 'Exporter en Excel</button>'
    + '<button class="hbtn hbtn-light" onclick="exportDatabase()">' + hIco('save', 14) + 'Sauvegarde JSON</button>'
    + '<button class="hbtn hbtn-dark" onclick="logout()">' + hIco('power', 14) + 'Se déconnecter</button></div>'
    + '</section>';

  box.innerHTML = '<div class="hs-grid">' + profil + look + prefs + space + '</div>';
}

// ── Actions ──
function hsSet(key, val) {
  haloSaveUI({ [key]: val });
  haloRefreshUser();
  if (['photo', 'name', 'fullName', 'role', 'textSize', 'start'].includes(key)) hsRender();
  if (key === 'textSize' || key === 'compact') { try { showToast(key === 'compact' ? (val ? 'Mode compact activé' : 'Mode compact désactivé') : 'Taille du texte : ' + (val === 'l' ? 'grande' : 'normale')); } catch (e) {} }
}
function hsGlass(v) { const u = haloUI(); u.glass = +v; haloApplyUI(u); }
function hsAccent(id) {
  haloSetAccent(id);
  document.querySelectorAll('.hs-sw').forEach((b, i) => b.classList.toggle('on', HALO_ACCENTS[i].id === id));
}
function hsResetLook() {
  haloSaveUI({ acc: 'corail', glass: 25, anim: true, compact: false, textSize: 'n' });
  hsRender();
  try { showToast('Apparence par défaut rétablie'); } catch (e) {}
}
// Photo réduite à 160 px (JPEG) pour rester légère dans la synchronisation
function hsPhoto(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      hsSet('photo', c.toDataURL('image/jpeg', 0.82));
      try { showToast('Photo de profil mise à jour'); } catch (e) {}
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
}

// ── Branchement dans la navigation ──
(function () {
  // Route « settings » dans la barre latérale (groupe Système)
  // Pas d'entrée dans la barre latérale : on y accède en cliquant sur le profil (et par la recherche)
  const basePal = window.haloPaletteItems;
  window.haloPaletteItems = function () {
    const items = basePal.apply(this, arguments);
    items.splice(1, 0, { sec: 'Aller à', label: 'Paramètres', hint: 'Profil, apparence et préférences', ico: 'settings', kw: 'parametres profil apparence theme couleur preferences', run: () => haloGo('settings') });
    return items;
  };
  // Le profil s'allume quand on est dans les Paramètres
  const baseActive = window.haloSetActive;
  window.haloSetActive = function (route) {
    const r = baseActive.apply(this, arguments);
    const u = document.querySelector('#hsb .hsb-user');
    if (u) u.classList.toggle('on', route === 'settings');
    return r;
  };
  const baseGo = window.haloGo;
  window.haloGo = function (route) {
    const s = document.getElementById('settingsScreen');
    if (route === 'settings') {
      haloCloseOverlays();
      try { if (document.body.classList.contains('dash-mode')) { document.body.classList.remove('dash-mode'); document.getElementById('sc6').classList.remove('active'); } } catch (e) {}
      showSettings();
      haloSetActive('settings');
      try { window.scrollTo(0, 0); } catch (e) {}
      return;
    }
    if (s) s.style.display = 'none';
    return baseGo.apply(this, arguments);
  };
  // Les autres chemins (accueil, dashboard…) referment aussi l'écran
  ['showHome', 'enterDashboard', 'enterTools', 'showBudget', 'showSimulateur', 'showMarketplace'].forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    const w = function () { const s = document.getElementById('settingsScreen'); if (s) s.style.display = 'none'; return o.apply(this, arguments); };
    Object.assign(w, o); window[n] = w;
  });
  // Le profil en bas de la barre latérale ouvre les paramètres
  window.haloAppearance = function (ev) { if (ev) ev.stopPropagation(); haloGo('settings'); };
  // Animation d'arrivée
  const baseRoot = window._haloRouteRoot;
  if (typeof baseRoot === 'function') window._haloRouteRoot = r => r === 'settings' ? document.getElementById('settingsScreen') : baseRoot(r);
})();

// Page au démarrage et vue du tableau de bord par défaut
(function () {
  let started = false;
  const baseHome = window.showHome;
  window.showHome = function () {
    const r = baseHome.apply(this, arguments);
    haloApplyUI(); haloRefreshUser();
    if (!started && document.body.classList.contains('halo-in')) {
      started = true;
      const st = haloUI().start;
      if (st && st !== 'home') setTimeout(() => haloGo(st), 0);
    }
    return r;
  };
  const baseDash = window.enterDashboard;
  let dashOpened = false;
  window.enterDashboard = function () {
    const first = !dashOpened; dashOpened = true;
    if (first) {
      const v = haloUI().dashView;
      const it = v && typeof HDASH_ITEMS !== 'undefined' && HDASH_ITEMS.find(x => x.id === v);
      if (it && it.sub) { if (it.tab === 'synthese') _synTab = it.sub; if (it.tab === 'kpis') _kpiTab = it.sub; }
      const r = baseDash.apply(this, arguments);
      if (it && it.tab !== 'synthese') setTimeout(() => hdashGo(it.id), 0);
      return r;
    }
    return baseDash.apply(this, arguments);
  };
})();

