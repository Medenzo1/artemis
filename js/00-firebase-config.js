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
]);

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
const _syncHead = k => _fs.collection('sync').doc('k_' + k);
const _syncPart = (k, i) => _fs.collection('sync').doc('k_' + k + '_' + i);
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

function logout() {
  _auth.signOut();
}
