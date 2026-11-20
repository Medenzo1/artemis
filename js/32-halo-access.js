// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Comptes, rôles et droits
//
//  Rôles (Firestore « access/{uid} », modifiables par l'administrateur seul) :
//    admin    Administrateur : tout + gestion des accès
//    manager  Gestionnaire   : tout, sans la gestion des accès
//    viewer   Lecteur        : consultation de tout, aucune modification
//    custom   Personnalisé   : Lecteur, avec des parties masquées (hidden[])
//    none     Aucun accès
//  Chaque compte s'inscrit dans « members/{uid} » à la connexion (e-mail,
//  nom, dernière visite) pour apparaître dans la liste de l'administrateur.
//  Les règles Firestore (tools/firestore.rules) appliquent ces droits côté
//  serveur ; ce fichier adapte l'interface.
// ════════════════════════════════════════════════════════════════

const HAC_ROLES = [
  ['manager', 'Gestionnaire', 'Tout voir et tout modifier, sans gérer les comptes'],
  ['viewer', 'Lecteur', 'Tout voir, rien modifier'],
  ['custom', 'Personnalisé', 'Lecteur avec des parties masquées'],
  ['none', 'Aucun accès', 'Compte bloqué'],
];
const HAC_SECTIONS = [
  ['dashboard', 'Tableau de bord', ['dashboard']],
  ['budget', 'Budget', ['budget']],
  ['calendar', 'Calendrier', ['calendar']],
  ['saisie', 'Mois enregistrés', ['base']],
  ['patrimoine', 'Biens, emprunts, amortissements', ['params', 'loans', 'amort', 'lcd']],
  ['simulateur', 'Simulateur', ['simulateur']],
  ['marketplace', 'Marketplace', ['marketplace']],
];
const HAC_EDIT_ROUTES = ['import', 'mapping', 'validation'];
let _hac = null;   // { role, hidden: [] } une fois chargé

function haloRole() { return _hac ? _hac.role : 'loading'; }
function haloIsAdmin() { return haloRole() === 'admin'; }
function haloCanEdit() { return ['admin', 'manager'].includes(haloRole()); }
function haloHiddenRoutes() {
  const r = haloRole();
  const out = new Set();
  if (!haloCanEdit()) HAC_EDIT_ROUTES.forEach(x => out.add(x));
  if (r === 'custom') (_hac.hidden || []).forEach(id => { const s = HAC_SECTIONS.find(x => x[0] === id); if (s) s[2].forEach(x => out.add(x)); });
  return out;
}
function haloRouteAllowed(route) { return !haloHiddenRoutes().has(route); }

// ── Chargement des droits à la connexion ──
async function haloLoadAccess() {
  const u = _auth.currentUser;
  if (!u) { _hac = null; return; }
  const ref = _fs.collection('access').doc(u.uid);
  let data = null;
  try { const snap = await ref.get(); if (snap.exists) data = snap.data(); } catch (e) { console.warn('[access] lecture', e); }
  if (!data) {
    // Premier passage : seul l'administrateur désigné dans les règles Firestore peut se déclarer admin
    try { const d = { role: 'admin', hidden: [], email: u.email || '', updatedAt: new Date().toISOString() }; await ref.set(d); data = d; }
    catch (e) { data = { role: 'none', hidden: [], pending: true }; }
  }
  _hac = { role: data.role || 'none', hidden: Array.isArray(data.hidden) ? data.hidden : [], pending: !!data.pending };
  // Inscription dans la liste des membres (pour l'écran de gestion de l'administrateur)
  try {
    await _fs.collection('members').doc(u.uid).set({ email: u.email || '', name: (haloUI().fullName || haloUserName() || ''), lastSeen: new Date().toISOString() }, { merge: true });
  } catch (e) {}
}

// ── Application à l'interface ──
function haloApplyAccess() {
  const h = document.documentElement, r = haloRole();
  h.classList.toggle('ro', !haloCanEdit());
  h.dataset.role = r;
  const hidden = haloHiddenRoutes();
  document.querySelectorAll('#hsb .hsb-item').forEach(b => { b.style.display = hidden.has(b.dataset.route) ? 'none' : ''; });
  // Groupes vides masqués
  document.querySelectorAll('#hsb .hsb-group').forEach(g => {
    let n = g.nextElementSibling, any = false;
    while (n && !n.classList.contains('hsb-group') && !n.classList.contains('hsb-spacer')) { if (n.classList.contains('hsb-item') && n.style.display !== 'none') any = true; n = n.nextElementSibling; }
    g.style.display = any ? '' : 'none';
  });
  const steps = document.querySelector('#hsb .hsb-steps'); if (steps) steps.style.display = hidden.has('import') ? 'none' : '';
  haloHideLinks(document);
  // Compte sans accès
  let block = document.getElementById('hac-block');
  if (r === 'none') {
    if (!block) {
      block = document.createElement('div'); block.id = 'hac-block';
      block.innerHTML = '<div class="hac-box"><span class="hs-ico">' + hIco('lock', 18) + '</span><h2>Accès en attente</h2><p>Votre compte est bien connecté, mais l\'administrateur ne vous a pas encore donné accès à ARTEMIS.</p><button class="hbtn hbtn-dark" onclick="logout()">' + hIco('power', 14) + 'Se déconnecter</button></div>';
      document.body.appendChild(block);
    }
  } else if (block) block.remove();
}
// Masque les boutons qui mènent à une partie interdite (accueil, raccourcis…)
function haloHideLinks(root) {
  const hidden = haloHiddenRoutes();
  (root || document).querySelectorAll('[onclick*="haloGo("]').forEach(el => {
    if (el.closest('#hsb')) return;
    const m = /haloGo\('([a-z]+)'\)/.exec(el.getAttribute('onclick') || '');
    if (m) el.style.display = hidden.has(m[1]) ? 'none' : '';
  });
}

// ── Garde-fous ──
(function () {
  // Navigation
  const go = window.haloGo;
  window.haloGo = function (route) {
    if (route !== 'home' && route !== 'settings' && !haloRouteAllowed(route)) { try { showToast('Accès non autorisé à cette partie', '#e0353f'); } catch (e) {} return; }
    return go.apply(this, arguments);
  };
  // Palette
  const pal = window.haloPaletteItems;
  if (typeof pal === 'function') window.haloPaletteItems = function () {
    const hidden = haloHiddenRoutes();
    return pal.apply(this, arguments).filter(it => {
      const nav = HALO_NAV.find(n => n.id && n.label === it.label); if (nav && hidden.has(nav.id)) return false;
      if (hidden.has('marketplace') && it.label === 'Marketplace') return false;
      if (!haloCanEdit() && /Mapping du mois|Validation du mois/.test(it.label)) return false;
      if (hidden.has('dashboard') && it.sec === 'Tableau de bord') return false;
      if (!haloCanEdit() && /Importer/.test(it.label)) return false;
      return true;
    });
  };
  // Modifications : refusées en lecture seule (l'interface les cache déjà ; ceci couvre les cas restants)
  let roAt = 0;
  const ro = () => { if (Date.now() - roAt < 3000) return; roAt = Date.now(); try { showToast('Lecture seule : modification non autorisée', '#e0353f'); } catch (e) {} };
  ['saveParams', 'saveDB', 'budSaveStore', 'hcalSaveUserEvents', 'createListing', 'updateListing', 'deleteListing', 'saveLcdData', 'saveAmortData',
   'clearDatabase', 'deletePeriod', 'editPeriod', 'saveToDatabase', 'clearLcdData', 'confirmLoanImport', 'hsmSaveConf', 'budOpenNew', 'budDuplicate',
   'budRename', 'budDelete', 'budOpenRebase', 'budImportXlsx', 'mktOpenForm', 'mktSubmitListing', 'mktDeleteListing', 'hsmTest',
   'addSci', 'delSci', 'delBien', 'delLoan', 'delLoanBien', 'addLoanBien', 'delAirbnbMap', 'delBookingMap', 'deleteAmortRow', 'deleteLcdRow', 'confirmAddQp', 'clearPlatformMemory'].forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    window[n] = function () { if (_hac && !haloCanEdit()) { ro(); return; } return o.apply(this, arguments); };
  });
  // Calendrier : pas de création ni de modification d'événement en lecture seule
  const ed = window.hcalEdit;
  if (typeof ed === 'function') window.hcalEdit = function () { if (_hac && !haloCanEdit()) { ro(); return; } return ed.apply(this, arguments); };
  // L'accueil et les écrans re-rendus gardent les liens masqués
  const home = window.haloRenderHome;
  if (typeof home === 'function') window.haloRenderHome = function () { const r = home.apply(this, arguments); try { haloHideLinks(document.getElementById('hh')); } catch (e) {} return r; };
})();

// ════════════ Paramètres › Utilisateurs (administrateur) ════════════
const _hacAdmin = { members: null, access: {}, err: '' };
async function hacLoadMembers() {
  try {
    const [m, a] = await Promise.all([_fs.collection('members').get(), _fs.collection('access').get()]);
    _hacAdmin.members = m.docs.map(d => Object.assign({ uid: d.id }, d.data())).sort((x, y) => String(y.lastSeen || '').localeCompare(String(x.lastSeen || '')));
    _hacAdmin.access = {}; a.docs.forEach(d => { _hacAdmin.access[d.id] = d.data(); });
    _hacAdmin.err = '';
  } catch (e) { _hacAdmin.err = 'Lecture des comptes impossible : ' + (e.code || e.message); }
  hacRefreshCard();
}
function hacCardHtml() {
  const me = _auth.currentUser ? _auth.currentUser.uid : '';
  let body;
  if (_hacAdmin.err) body = '<div class="hsm-status err">' + hIco('alert-triangle', 15) + '<span>' + hEsc(_hacAdmin.err) + '</span></div>';
  else if (!_hacAdmin.members) body = '<div class="hac-empty">Chargement des comptes…</div>';
  else body = '<div class="hac-list">' + _hacAdmin.members.map(m => {
    const a = _hacAdmin.access[m.uid] || { role: 'none', hidden: [] };
    const isMe = m.uid === me;
    const seen = m.lastSeen ? new Date(m.lastSeen).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const who = '<div class="hac-who"><b>' + hEsc(m.name || m.email || 'Compte') + (isMe ? ' <small>(vous)</small>' : '') + '</b><small>' + hEsc(m.email || '') + ' · dernière visite ' + seen + '</small></div>';
    if (isMe || a.role === 'admin') return '<div class="hac-row">' + who + '<span class="hac-admin">' + hIco('shield-check', 14) + 'Administrateur</span></div>';
    const roleSel = '<select class="sel hac-role" onchange="hacSetRole(\'' + m.uid + '\', this.value)">' + HAC_ROLES.map(r => '<option value="' + r[0] + '"' + (a.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') + '</select>';
    const desc = (HAC_ROLES.find(r => r[0] === a.role) || HAC_ROLES[3])[2];
    const secs = a.role === 'custom' ? '<div class="hac-secs"><span>Parties masquées :</span>' + HAC_SECTIONS.map(s => '<label class="hac-chip' + ((a.hidden || []).includes(s[0]) ? ' on' : '') + '"><input type="checkbox"' + ((a.hidden || []).includes(s[0]) ? ' checked' : '') + ' onchange="hacToggleSection(\'' + m.uid + '\', \'' + s[0] + '\', this.checked)">' + s[1] + '</label>').join('') + '</div>' : '';
    return '<div class="hac-row">' + who + '<div class="hac-ctl">' + roleSel + '<small>' + desc + '</small></div>' + secs + '</div>';
  }).join('') + '</div>';
  return '<section class="hg hs-card hs-wide" id="hs-access"><div class="hs-h"><span class="hs-ico">' + hIco('users', 16) + '</span><div><h3>Utilisateurs et accès</h3><small>Créez les comptes dans la console Firebase (e-mail + mot de passe) : ils apparaissent ici après leur première connexion.</small></div>'
    + '<button class="hbtn hbtn-light hac-refresh" onclick="hacLoadMembers()">' + hIco('refresh-cw', 14) + 'Actualiser</button></div>' + body + '</section>';
}
function hacRefreshCard() { const el = document.getElementById('hs-access'); if (el) el.outerHTML = hacCardHtml(); }
async function hacSave(uid, patch) {
  const cur = Object.assign({ role: 'none', hidden: [] }, _hacAdmin.access[uid] || {}, patch, { updatedAt: new Date().toISOString(), updatedBy: _auth.currentUser.email || '' });
  const m = (_hacAdmin.members || []).find(x => x.uid === uid); if (m) cur.email = m.email || '';
  try { await _fs.collection('access').doc(uid).set(cur); _hacAdmin.access[uid] = cur; showToast('Accès mis à jour'); }
  catch (e) { showToast('⚠ Enregistrement impossible : ' + (e.code || e.message), '#e0353f'); }
  hacRefreshCard();
}
function hacSetRole(uid, role) { hacSave(uid, { role }); }
function hacToggleSection(uid, sec, on) {
  const h = new Set((_hacAdmin.access[uid] || {}).hidden || []);
  if (on) h.add(sec); else h.delete(sec);
  hacSave(uid, { hidden: [...h] });
}
(function () {
  const base = window.hsRender;
  if (typeof base !== 'function') return;
  window.hsRender = function () {
    const r = base.apply(this, arguments);
    const box = document.getElementById('hs-content');
    if (box && haloIsAdmin() && !document.getElementById('hs-access')) { box.insertAdjacentHTML('beforeend', hacCardHtml()); hacLoadMembers(); }
    // Les réglages partagés (Smoobu) ne concernent que ceux qui peuvent modifier
    const sm = document.getElementById('hs-smoobu'); if (sm && !haloCanEdit()) sm.style.display = 'none';
    // Rôle affiché sous le profil
    const role = { admin: 'Administrateur', manager: 'Gestionnaire', viewer: 'Lecteur', custom: 'Personnalisé' }[haloRole()];
    const card = [...document.querySelectorAll('#hs-content .hs-card')].find(c => /Profil/.test((c.querySelector('h3') || {}).textContent || ''));
    if (card && role && !card.querySelector('.hac-badge')) { const h = card.querySelector('.hs-h'); if (h) h.insertAdjacentHTML('beforeend', '<span class="hac-badge">' + hIco('shield-check', 13) + role + '</span>'); }
    return r;
  };
})();

// ── Démarrage ──
_auth.onAuthStateChanged(async user => {
  if (!user) { _hac = null; return; }
  await haloLoadAccess();
  haloApplyAccess();
  // Si on était sur une partie désormais interdite, retour à l'accueil
  if (window._haloRoute && window._haloRoute !== 'home' && !haloRouteAllowed(window._haloRoute)) haloGo('home');
});
