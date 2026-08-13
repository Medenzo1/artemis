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
]);

const _origSetItem = Storage.prototype.setItem.bind(localStorage);
const _origRemoveItem = Storage.prototype.removeItem.bind(localStorage);

let _pendingPush = {};
let _pushTimer = null;
function _flushCloudPush() {
  if (!_auth.currentUser) { console.warn('[artemis] sync ignorée : utilisateur non authentifié'); return; }
  const data = _pendingPush;
  _pendingPush = {};
  _fs.collection('sync').doc('shared').set(data, { merge: true })
    .then(() => { try { showToast('☁ Synchronisé'); } catch(e) {} })
    .catch(e => {
      console.error('[artemis] échec de synchronisation cloud', e);
      try { showToast('⚠ Échec de synchro cloud : ' + (e && e.code || e), '#f0566a'); } catch(_) { alert('Échec de synchro cloud : ' + e); }
    });
}
function _scheduleCloudPush(key, value) {
  _pendingPush[key] = value;
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(_flushCloudPush, 1500);
}

// Intercepte localStorage sans toucher au reste du code : chaque lecture/écriture
// existante continue de fonctionner à l'identique, avec en plus une réplication
// silencieuse vers Firestore pour les clés partagées.
localStorage.setItem = function (key, value) {
  _origSetItem(key, value);
  if (_SYNC_KEYS.has(key)) _scheduleCloudPush(key, value);
};
localStorage.removeItem = function (key) {
  _origRemoveItem(key);
  if (_SYNC_KEYS.has(key)) _scheduleCloudPush(key, firebase.firestore.FieldValue.delete());
};

async function _pullCloudData() {
  try {
    const snap = await _fs.collection('sync').doc('shared').get();
    if (!snap.exists) { console.warn('[artemis] aucune donnée cloud trouvée (document sync/shared inexistant)'); return; }
    const data = snap.data();
    let applied = 0;
    _SYNC_KEYS.forEach(k => {
      if (typeof data[k] === 'string') { _origSetItem(k, data[k]); applied++; }
    });
    console.log('[artemis] données cloud récupérées :', applied, 'clé(s)');
  } catch (e) {
    console.error('[artemis] échec de récupération cloud, utilisation des données locales', e);
    try { showToast('⚠ Échec de récupération cloud : ' + (e && e.code || e), '#f0566a'); } catch(_) {}
  }
}

function logout() {
  _auth.signOut();
}
