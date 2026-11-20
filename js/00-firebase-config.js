// ══════════════════════════════════════════════
//  FIREBASE — config, auth helpers, sync localStorage <-> Firestore
// ══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDlR6RfsLmTmiO--EECP7BS6LufWH_a_3k",
  authDomain: "artemis-sci.firebaseapp.com",
  projectId: "artemis-sci",
  storageBucket: "artemis-sci.firebasestorage.app",
  messagingSenderId: "884118064792",
  appId: "1:884118064792:web:6cd2fb6fe657a70ff30aed"
};
firebase.initializeApp(firebaseConfig);
const _auth = firebase.auth();
const _fs = firebase.firestore();

// Clés localStorage partagées entre les utilisateurs (données métier).
// Tout le reste (préférences d'affichage éventuelles, etc.) reste local à l'appareil.
const _SYNC_KEYS = new Set([
  'artemis_db',
  'artemis_params',
  'artemis_amort',
  'artemis_amort_pending',
  'artemis_lcd',
  'artemis_lcd_pending',
  'artemis_reservations',
  'artemis_airbnb_rows',
  'artemis_booking_rows',
  'artemis_budget',
  'artemis_ui',        // profil et apparence (Paramètres) — PROPRE À CHAQUE COMPTE, voir _PER_USER_KEYS
  'artemis_events',    // événements du calendrier (partagés)
]);
// Clés rangées à part pour chaque utilisateur connecté : « sync/k_<clé>__<uid> »
const _PER_USER_KEYS = new Set(['artemis_ui']);
const _cloudKey = k => (_PER_USER_KEYS.has(k) && _auth.currentUser) ? k + '__' + _auth.currentUser.uid : k;

// NB: on a essayé d'intercepter localStorage.setItem/removeItem directement,
// mais Safari ignore silencieusement ce genre de remplacement (protection
// anti-fingerprinting — cette technique sert aussi à des trackers). On
// détecte donc les changements par comparaison périodique, ce qui marche
// dans tous les navigateurs sans exception.
//
// Stockage : un document Firestore est limité à 1 Mo. Tout ranger dans « sync/shared » faisait
// échouer l'écriture dès que les exports Airbnb / Booking s'ajoutaient à la base (et l'échec
// n'était jamais retenté). Chaque clé a donc son propre en-tête « sync/k_<clé> » et ses
// morceaux « sync/k_<clé>_<i> » (≤ 400 000 caractères, < 1 Mo même en UTF-8 accentué).
// « sync/shared » n'est plus que lu, pour migrer les données existantes.
const _SYNC_CHUNK = 400000;
const _syncHead = k => _fs.collection('sync').doc('k_' + _cloudKey(k));
const _syncPart = (k, i) => _fs.collection('sync').doc('k_' + _cloudKey(k) + '_' + i);
const _NEVER = '\u0000never-synced';

let _lastSynced = {};
_SYNC_KEYS.forEach(k => { _lastSynced[k] = localStorage.getItem(k); });
let _syncBusy = false, _syncLastError = '';

async function _pushKey(k, val) {
  const batch = _fs.batch();
  if (val === null) {
    batch.set(_syncHead(k), { n: 0, deleted: true, at: firebase.firestore.FieldValue.serverTimestamp() });
  } else {
    const n = Math.max(1, Math.ceil(val.length / _SYNC_CHUNK));
    for (let i = 0; i < n; i++) batch.set(_syncPart(k, i), { d: val.slice(i * _SYNC_CHUNK, (i + 1) * _SYNC_CHUNK) });
    batch.set(_syncHead(k), { n, len: val.length, at: firebase.firestore.FieldValue.serverTimestamp() });
  }
  await batch.commit();   // atomique : en-tête et morceaux changent ensemble
}

async function _checkAndPushChanges() {
  if (!_auth.currentUser || _syncBusy) return;
  const todo = [..._SYNC_KEYS].filter(k => localStorage.getItem(k) !== _lastSynced[k]);
  if (!todo.length) return;
  _syncBusy = true;
  let ok = 0;
  for (const k of todo) {
    const cur = localStorage.getItem(k);
    try {
      await _pushKey(k, cur);
      _lastSynced[k] = cur;        // marqué synchronisé seulement après succès : sinon retenté au prochain passage
      ok++;
    } catch (e) {
      console.error('[artemis] échec de synchronisation cloud pour', k, e);
      const msg = (e && e.code) || String(e);
      if (msg !== _syncLastError) { _syncLastError = msg; try { showToast('⚠ Échec de synchro cloud (' + k.replace('artemis_', '') + ') : ' + msg, '#f0566a'); } catch (_) {} }
    }
  }
  _syncBusy = false;
  if (ok) { _syncLastError = ''; try { showToast('☁ Synchronisé'); } catch (e) {} }
}
setInterval(_checkAndPushChanges, 3000);

async function _pullCloudData() {
  try {
    let applied = 0;
    const heads = await Promise.all([..._SYNC_KEYS].map(k => _syncHead(k).get().then(d => [k, d])));
    const missing = [];
    for (const [k, h] of heads) {
      if (!h.exists && _PER_USER_KEYS.has(k)) {
        // Pas encore de profil pour ce compte : on garde le profil local seulement s'il lui appartient
        // (ou s'il n'a pas de propriétaire : appareil de l'utilisateur avant cette séparation), sinon on repart de zéro
        const uid = _auth.currentUser && _auth.currentUser.uid;
        let owner = null;
        try { owner = (JSON.parse(localStorage.getItem(k) || 'null') || {})._uid || null; } catch (e) {}
        if (localStorage.getItem(k) !== null && owner && owner !== uid) localStorage.removeItem(k);
        else if (localStorage.getItem(k) !== null && !owner && uid) {
          try { const v = JSON.parse(localStorage.getItem(k)); v._uid = uid; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
        }
        _lastSynced[k] = localStorage.getItem(k) === null ? null : _NEVER;
        continue;
      }
      if (!h.exists) { missing.push(k); continue; }
      const { n, deleted } = h.data();
      if (deleted) { localStorage.removeItem(k); _lastSynced[k] = null; continue; }
      const parts = await Promise.all(Array.from({ length: n }, (_, i) => _syncPart(k, i).get()));
      if (parts.some(p => !p.exists)) { console.warn('[artemis] morceaux manquants pour', k); continue; }
      const val = parts.map(p => p.data().d).join('');
      localStorage.setItem(k, val);
      _lastSynced[k] = val;        // évite de re-pousser immédiatement ce qu'on vient de récupérer
      applied++;
    }
    // Migration : clés encore absentes du nouveau format → ancien document « sync/shared »
    if (missing.length) {
      const snap = await _fs.collection('sync').doc('shared').get();
      const legacy = snap.exists ? snap.data() : {};
      missing.forEach(k => {
        if (typeof legacy[k] === 'string') { localStorage.setItem(k, legacy[k]); applied++; }
        // Ce qui existe localement mais pas encore dans le nouveau format sera poussé au prochain passage
        _lastSynced[k] = localStorage.getItem(k) === null ? null : _NEVER;
      });
    }
    console.log('[artemis] données cloud récupérées :', applied, 'clé(s)', missing.length ? '· à migrer : ' + missing.join(', ') : '');
  } catch (e) {
    console.error('[artemis] échec de récupération cloud, utilisation des données locales', e);
    try { showToast('⚠ Échec de récupération cloud : ' + (e && e.code || e), '#f0566a'); } catch(_) {}
  }
}

// Déconnexion : on attend Firebase, on pousse les derniers changements locaux, puis on recharge
// la page pour repartir d'un état propre (écran de connexion, aucune donnée de session affichée).
let _loggingOut = false;
async function logout() {
  if (_loggingOut) return;
  _loggingOut = true;
  try { showToast('Déconnexion…'); } catch (e) {}
  try { await _checkAndPushChanges(); } catch (e) {}
  try {
    await _auth.signOut();
  } catch (e) {
    _loggingOut = false;
    console.error('[artemis] échec de déconnexion', e);
    try { showToast('⚠ Déconnexion impossible : ' + ((e && (e.code || e.message)) || e), '#e0353f'); } catch (_) {}
    return;
  }
  try { document.getElementById('mainContent').style.display = 'none'; document.getElementById('loginScreen').style.display = 'flex'; } catch (e) {}
  location.replace(location.pathname + '?logout=' + Date.now());
}

// Après une déconnexion, on retire le marqueur de l'adresse
if (/[?&]logout=/.test(location.search)) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
