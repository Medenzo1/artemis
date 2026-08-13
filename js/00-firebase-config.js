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

// NB: on a essayé d'intercepter localStorage.setItem/removeItem directement,
// mais Safari ignore silencieusement ce genre de remplacement (protection
// anti-fingerprinting — cette technique sert aussi à des trackers). On
// détecte donc les changements par comparaison périodique, ce qui marche
// dans tous les navigateurs sans exception.
let _lastSynced = {};
_SYNC_KEYS.forEach(k => { _lastSynced[k] = localStorage.getItem(k); });

function _checkAndPushChanges() {
  if (!_auth.currentUser) return;
  const changed = {};
  let hasChanges = false;
  _SYNC_KEYS.forEach(k => {
    const cur = localStorage.getItem(k);
    if (cur !== _lastSynced[k]) {
      changed[k] = (cur === null) ? firebase.firestore.FieldValue.delete() : cur;
      _lastSynced[k] = cur;
      hasChanges = true;
    }
  });
  if (!hasChanges) return;
  _fs.collection('sync').doc('shared').set(changed, { merge: true })
    .then(() => { try { showToast('☁ Synchronisé'); } catch(e) {} })
    .catch(e => {
      console.error('[artemis] échec de synchronisation cloud', e);
      try { showToast('⚠ Échec de synchro cloud : ' + (e && e.code || e), '#f0566a'); } catch(_) {}
    });
}
setInterval(_checkAndPushChanges, 3000);

async function _pullCloudData() {
  try {
    const snap = await _fs.collection('sync').doc('shared').get();
    if (!snap.exists) { console.warn('[artemis] aucune donnée cloud trouvée (document sync/shared inexistant)'); return; }
    const data = snap.data();
    let applied = 0;
    _SYNC_KEYS.forEach(k => {
      if (typeof data[k] === 'string') {
        localStorage.setItem(k, data[k]);
        _lastSynced[k] = data[k]; // évite de re-pousser immédiatement ce qu'on vient de récupérer
        applied++;
      }
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
