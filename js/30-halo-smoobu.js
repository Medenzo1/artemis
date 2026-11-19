// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Réservations Smoobu en temps réel
//  Le site interroge le relais Cloudflare (tools/smoobu-worker) avec le
//  jeton de connexion Firebase ; le relais signe la requête vers Smoobu.
//  Réglages partagés (artemis_params.smoobu) : adresse du relais et
//  correspondance logement Smoobu → bien ARTEMIS.
// ════════════════════════════════════════════════════════════════

const HSM_TTL = 5 * 60 * 1000;
const _hsm = { cache: {}, loading: {}, failAt: {}, err: '', at: 0, apts: null, testing: false, testMsg: '' };

function hsmConf() { try { return Object.assign({ url: '', map: {} }, getParams().smoobu || {}); } catch (e) { return { url: '', map: {} }; } }
function hsmSaveConf(patch) {
  const p = getParams();
  p.smoobu = Object.assign(hsmConf(), patch);
  saveParams(p);
}
function hsmOn() { return !!hsmConf().url; }
function hsmBase() { return hsmConf().url.trim().replace(/\/+$/, ''); }

async function hsmFetch(path) {
  if (typeof _auth === 'undefined' || !_auth.currentUser) throw new Error('Connexion ARTEMIS requise');
  const token = await _auth.currentUser.getIdToken();
  let res;
  try { res = await fetch(hsmBase() + path, { headers: { Authorization: 'Bearer ' + token } }); }
  catch (e) { throw new Error('Relais injoignable : vérifie l\'adresse du relais'); }
  let body = null;
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((body && body.error) || ('Erreur ' + res.status));
  return body;
}

// ── Réservations d'un mois (avec cache de 5 min) ──
function hsmLoad(month, force) {
  if (!hsmOn() || !/^\d{4}-\d{2}$/.test(month || '')) return Promise.resolve(null);
  const c = _hsm.cache[month];
  if (!force && c && Date.now() - c.at < HSM_TTL) return Promise.resolve(c.list);
  if (_hsm.loading[month]) return _hsm.loading[month];
  const [y, m] = month.split('-').map(Number);
  // On remonte d'un mois pour attraper les séjours commencés avant le 1er et encore en cours
  const from = hShift(month, -1) + '-01', to = month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  const pr = hsmFetch('/reservations?from=' + from + '&to=' + to)
    .then(d => { _hsm.cache[month] = { at: Date.now(), list: d.reservations || [] }; _hsm.err = ''; _hsm.at = Date.now(); delete _hsm.failAt[month]; return _hsm.cache[month].list; })
    .catch(e => { _hsm.err = e.message || String(e); _hsm.failAt[month] = Date.now(); return null; })
    .finally(() => {
      delete _hsm.loading[month];
      if (window._haloRoute === 'calendar' && typeof _hcal !== 'undefined' && _hcal.month === month) hcalRender('soft');
    });
  _hsm.loading[month] = pr;
  if (window._haloRoute === 'calendar') hsmChip();
  return pr;
}

// Réservations Smoobu → séjours du calendrier
function hsmStays() {
  const conf = hsmConf(), biens = (getParams().biens || []);
  const seen = new Set(), out = [];
  Object.values(_hsm.cache).forEach(c => (c.list || []).forEach(r => {
    if (seen.has(r.id) || !r.arrival || !r.departure) return;
    seen.add(r.id);
    const aptId = r.apartment ? String(r.apartment.id) : '';
    const target = conf.map[aptId];
    if (target === '-') return;
    const b = biens.find(x => x.id === target);
    const ch = String(r.channel || '');
    const src = r.blocked ? 'blocked' : /airbnb/i.test(ch) ? 'airbnb' : (/booking\.com/i.test(ch) || /^\s*booking\b/i.test(ch)) ? 'booking' : 'direct';
    const nuits = Math.max(1, Math.round((Date.parse(r.departure) - Date.parse(r.arrival)) / 864e5));
    out.push({ src, smoobu: true, id: r.id, bien: b ? b.name : (r.apartment ? r.apartment.name : 'Logement Smoobu'), start: r.arrival, end: r.departure, nuits,
      guest: r.blocked ? '' : r.guest, adults: r.adults, children: r.children, price: r.blocked ? null : r.price, paid: r.paid,
      channel: r.blocked ? 'Bloqué' : (ch || 'Direct'), notice: r.notice || '', checkIn: r.checkIn, checkOut: r.checkOut });
  }));
  return out;
}
function hsmCoveredBiens() {
  const conf = hsmConf(), biens = getParams().biens || [];
  const names = new Set(Object.values(conf.map).map(id => (biens.find(b => b.id === id) || {}).name).filter(Boolean));
  hsmStays().forEach(s => names.add(s.bien));
  return names;
}

// ── Calendrier : Smoobu remplace les imports pour les biens qu'il couvre ──
(function () {
  if (typeof hcalStays !== 'function') return;
  const base = window.hcalStays;
  window.hcalStays = function () {
    const own = base.apply(this, arguments);
    if (!hsmOn()) return own;
    const month = (typeof _hcal !== 'undefined' && _hcal.month) || new Date().toISOString().slice(0, 7);
    const failedRecently = _hsm.failAt[month] && Date.now() - _hsm.failAt[month] < 60000;
    if (!failedRecently && (!_hsm.cache[month] || Date.now() - _hsm.cache[month].at > HSM_TTL)) hsmLoad(month);
    const covered = hsmCoveredBiens();
    return own.filter(s => !covered.has(s.bien)).concat(hsmStays());
  };
  const baseRender = window.hcalRender;
  window.hcalRender = function () { const r = baseRender.apply(this, arguments); hsmChip(); return r; };
})();
function hsmChip() {
  const act = document.getElementById('hcal-actions');
  if (!act || !hsmOn()) return;
  let chip = document.getElementById('hsm-chip');
  if (!chip) { chip = document.createElement('button'); chip.id = 'hsm-chip'; chip.className = 'hsm-chip'; act.insertBefore(chip, act.firstChild); }
  const month = typeof _hcal !== 'undefined' ? _hcal.month : '';
  if (_hsm.loading[month]) { chip.className = 'hsm-chip load'; chip.innerHTML = '<i></i>Smoobu · chargement…'; chip.onclick = null; chip.title = ''; }
  else if (_hsm.err) { chip.className = 'hsm-chip err'; chip.innerHTML = '<i></i>Smoobu · erreur'; chip.title = _hsm.err + ' — cliquer pour ouvrir les réglages'; chip.onclick = () => haloGo('settings'); }
  else { chip.className = 'hsm-chip ok'; chip.innerHTML = '<i></i>Smoobu' + (_hsm.at ? ' · ' + new Date(_hsm.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''); chip.title = 'Réservations Smoobu en direct — cliquer pour actualiser'; chip.onclick = () => { if (month) hsmLoad(month, true); }; }
}

// ── Accueil : arrivées de la semaine depuis Smoobu ──
(function () {
  if (typeof hhTodo !== 'function') return;
  const base = window.hhTodo;
  window.hhTodo = function () {
    const out = base.apply(this, arguments);
    if (!hsmOn()) return out;
    const now = new Date();
    const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 7);
    const covered = hsmCoveredBiens();
    const kept = out.filter(t => !(t.t && t.t.startsWith('Arrivée · ') && [...covered].some(b => t.t.includes(b))));
    hsmStays().forEach(s => {
      if (s.src === 'blocked') return;
      const dt = new Date(s.start + 'T00:00:00');
      if (dt < mon || dt >= sun) return;
      kept.push({ t: 'Arrivée · ' + s.bien, s: (s.guest ? s.guest + ' · ' : '') + s.nuits + ' nuit' + (s.nuits > 1 ? 's' : '') + ' · ' + s.channel, tag: dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), c: HCAL_COL[s.src], date: dt, go: "haloGo('calendar')" });
    });
    return kept;
  };
  // Au démarrage : charge le mois en cours puis rafraîchit discrètement l'accueil
  const baseHome = window.showHome;
  let warmed = false;
  window.showHome = function () {
    const r = baseHome.apply(this, arguments);
    if (!warmed && hsmOn() && typeof _auth !== 'undefined' && _auth.currentUser) {
      warmed = true;
      hsmLoad(new Date().toISOString().slice(0, 7)).then(list => { if (list && window._haloRoute === 'home') { try { haloRenderHome(true); } catch (e) {} } });
    }
    return r;
  };
})();

// ── Paramètres : carte « Smoobu » ──
function hsmNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function hsmGuess(apt) {
  const biens = getParams().biens || [], n = hsmNorm(apt.name);
  const b = biens.find(x => [x.name, x.nom].filter(Boolean).some(v => { const k = hsmNorm(v); return k && n && (n.includes(k) || k.includes(n)); }));
  return b ? b.id : '';
}
function hsmCardHtml() {
  const conf = hsmConf(), biens = getParams().biens || [];
  const status = _hsm.testMsg ? '<div class="hsm-status ' + (_hsm.testMsg.ok ? 'ok' : 'err') + '">' + hIco(_hsm.testMsg.ok ? 'check-circle' : 'alert-triangle', 15) + '<span>' + hEsc(_hsm.testMsg.text) + '</span></div>' : '';
  let map = '';
  if (_hsm.apts && _hsm.apts.length) {
    map = '<div class="hsm-map"><div class="hsm-map-h"><span>Logement Smoobu</span><span>Bien ARTEMIS</span></div>'
      + _hsm.apts.map(a => {
        const cur = conf.map[String(a.id)] != null ? conf.map[String(a.id)] : '';
        return '<div class="hsm-map-r"><b>' + hEsc(a.name) + '</b><select class="sel" onchange="hsmSetMap(\'' + a.id + '\', this.value)">'
          + '<option value=""' + (cur === '' ? ' selected' : '') + '>Afficher sous son nom Smoobu</option>'
          + biens.map(b => '<option value="' + hEsc(b.id) + '"' + (cur === b.id ? ' selected' : '') + '>' + hEsc(b.name) + '</option>').join('')
          + '<option value="-"' + (cur === '-' ? ' selected' : '') + '>Ne pas afficher</option></select></div>';
      }).join('') + '</div>';
  }
  return '<section class="hg hs-card hs-wide" id="hs-smoobu"><div class="hs-h"><span class="hs-ico">' + hIco('calendar', 16) + '</span><div><h3>Smoobu</h3><small>Réservations en temps réel dans le calendrier (via votre relais Cloudflare)</small></div>'
    + (conf.url ? '<span class="hsm-on">Connecté</span>' : '') + '</div>'
    + '<div class="hs-row hsm-url"><span><b>Adresse du relais</b><small>Ex. : https://artemis-smoobu.votre-nom.workers.dev — <a href="https://github.com/Medenzo1/artemis/blob/main/tools/smoobu-worker/GUIDE.md" target="_blank" rel="noopener">guide de mise en place</a></small></span>'
    + '<div class="hsm-url-a"><input type="url" id="hsm-url" placeholder="https://…workers.dev" value="' + hEsc(conf.url) + '"><button class="hbtn hbtn-dark" onclick="hsmTest()"' + (_hsm.testing ? ' disabled' : '') + '>' + hIco('refresh-cw', 14) + (_hsm.testing ? 'Test…' : 'Tester et enregistrer') + '</button>'
    + (conf.url ? '<button class="hbtn hbtn-light" onclick="hsmDisconnect()">Déconnecter</button>' : '') + '</div></div>'
    + status + map + '</section>';
}
function hsmRefreshCard() { const el = document.getElementById('hs-smoobu'); if (el) el.outerHTML = hsmCardHtml(); }
async function hsmTest() {
  const input = document.getElementById('hsm-url');
  const url = (input ? input.value : '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+/.test(url)) { _hsm.testMsg = { ok: false, text: 'Adresse invalide : elle doit commencer par https://' }; return hsmRefreshCard(); }
  const old = hsmConf();
  hsmSaveConf({ url });
  _hsm.testing = true; _hsm.testMsg = ''; hsmRefreshCard();
  try {
    const d = await hsmFetch('/apartments');
    _hsm.apts = d.apartments || [];
    const map = Object.assign({}, hsmConf().map);
    _hsm.apts.forEach(a => { if (map[String(a.id)] == null) map[String(a.id)] = hsmGuess(a); });
    hsmSaveConf({ map });
    _hsm.cache = {}; _hsm.err = '';
    _hsm.testMsg = { ok: true, text: 'Connexion réussie : ' + _hsm.apts.length + ' logement' + (_hsm.apts.length > 1 ? 's' : '') + ' trouvé' + (_hsm.apts.length > 1 ? 's' : '') + '. Vérifie la correspondance ci-dessous.' };
  } catch (e) {
    if (!old.url) hsmSaveConf({ url: '' });
    _hsm.testMsg = { ok: false, text: e.message || String(e) };
  }
  _hsm.testing = false;
  hsmRefreshCard();
}
function hsmSetMap(aptId, bienId) {
  const map = Object.assign({}, hsmConf().map); map[String(aptId)] = bienId;
  hsmSaveConf({ map });
  try { showToast('Correspondance enregistrée'); } catch (e) {}
}
function hsmDisconnect() {
  if (!confirm('Déconnecter Smoobu ? Le calendrier reviendra aux réservations importées.')) return;
  hsmSaveConf({ url: '' });
  _hsm.cache = {}; _hsm.apts = null; _hsm.testMsg = ''; _hsm.err = '';
  hsmRefreshCard();
}
(function () {
  if (typeof hsRender !== 'function') return;
  const base = window.hsRender;
  window.hsRender = function () {
    const r = base.apply(this, arguments);
    const box = document.getElementById('hs-content');
    if (box && !document.getElementById('hs-smoobu')) box.insertAdjacentHTML('beforeend', hsmCardHtml());
    // Liste des logements chargée automatiquement si le relais est déjà configuré
    if (hsmOn() && !_hsm.apts && !_hsm.testing && typeof _auth !== 'undefined' && _auth.currentUser) {
      hsmFetch('/apartments').then(d => { _hsm.apts = d.apartments || []; hsmRefreshCard(); }).catch(e => { _hsm.testMsg = { ok: false, text: e.message }; hsmRefreshCard(); });
    }
    return r;
  };
})();
