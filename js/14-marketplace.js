// ══════════════════════════════════════════════
//  MARKETPLACE — annonces + baromètre d'opportunité
// ══════════════════════════════════════════════

// ── Photos (Cloudinary, plan gratuit — pas de carte bancaire requise) ──
const CLOUDINARY_CLOUD_NAME = 'rebyba7d';
const CLOUDINARY_UPLOAD_PRESET = 'Artemis-Image';
const MKT_MAX_PHOTOS = 4;

async function uploadPhotoToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error('Échec de l\'envoi de la photo' + (errBody && errBody.error ? ' : ' + errBody.error.message : ''));
  }
  const data = await res.json();
  return data.secure_url;
}
// Insère une transformation Cloudinary (redimensionnement à la volée) dans l'URL.
function mktCldUrl(url, transform) {
  if (!url) return url;
  return url.replace('/upload/', '/upload/' + transform + '/');
}

// ── Questionnaire pondéré ─────────────────────
// Le score final combine : rendement brut (20%, calculé), DPE (8%, dérivé du
// champ DPE), et ces questions à choix multiple (poids total 72%).
const MARKETPLACE_QUESTIONS = [
  {
    id: 'q_prix_marche', label: 'Prix au m² vs marché', weight: 15,
    options: [
      { id: 'a1', label: 'Nettement au-dessus du marché (+15% ou plus)', points: 2 },
      { id: 'a2', label: 'Au-dessus du marché (+5 à +15%)', points: 5 },
      { id: 'a3', label: 'Dans le marché (±5%)', points: 7 },
      { id: 'a4', label: 'En-dessous du marché (-5 à -15%)', points: 9 },
      { id: 'a5', label: 'Largement en-dessous du marché (-15% ou plus)', points: 10 },
    ],
  },
  {
    id: 'q_etat', label: 'État du bien / travaux à prévoir', weight: 10,
    options: [
      { id: 'a1', label: 'Neuf ou rénové, aucun travaux', points: 10 },
      { id: 'a2', label: 'Bon état, travaux mineurs (< 5% du prix)', points: 7 },
      { id: 'a3', label: 'À rafraîchir (5 à 15% du prix)', points: 4 },
      { id: 'a4', label: 'Travaux lourds (> 15% du prix)', points: 1 },
    ],
  },
  {
    id: 'q_tension', label: 'Tension locative de la zone', weight: 10,
    options: [
      { id: 'a1', label: 'Très tendue (grande métropole, forte demande)', points: 10 },
      { id: 'a2', label: 'Tendue (ville moyenne dynamique)', points: 7 },
      { id: 'a3', label: 'Équilibrée', points: 5 },
      { id: 'a4', label: 'Détendue (faible demande)', points: 2 },
    ],
  },
  {
    id: 'q_localisation', label: 'Localisation / proximité commodités', weight: 8,
    options: [
      { id: 'a1', label: 'Hyper-centre, tout à pied (transports, commerces, écoles)', points: 10 },
      { id: 'a2', label: 'Bon accès aux commodités, transports à proximité', points: 7 },
      { id: 'a3', label: 'Périphérie, dépendant de la voiture', points: 4 },
      { id: 'a4', label: 'Isolé, peu de commodités à proximité', points: 1 },
    ],
  },
  {
    id: 'q_lcd', label: 'Potentiel location courte durée (LCD)', weight: 8,
    options: [
      { id: 'a1', label: 'Zone touristique/étudiante, forte demande, réglementation favorable', points: 10 },
      { id: 'a2', label: 'LCD possible mais réglementé/plafonné', points: 6 },
      { id: 'a3', label: 'LLD uniquement pertinent', points: 5 },
      { id: 'a4', label: 'Zone réglementée défavorable (quota atteint...)', points: 2 },
    ],
  },
  {
    id: 'q_occupation', label: "Statut d'occupation", weight: 6,
    options: [
      { id: 'a1', label: 'Loué, bail récent, loyer cohérent avec le marché', points: 10 },
      { id: 'a2', label: 'Libre immédiatement', points: 8 },
      { id: 'a3', label: 'Loué, loyer sous le marché (bail ancien)', points: 5 },
      { id: 'a4', label: 'Loué, risque d\'impayés ou procédure en cours', points: 1 },
    ],
  },
  {
    id: 'q_exterieur', label: 'Extérieur (balcon / terrasse / jardin)', weight: 4,
    options: [
      { id: 'a1', label: 'Terrasse ou jardin spacieux (> 10 m²)', points: 10 },
      { id: 'a2', label: 'Balcon ou petite terrasse', points: 7 },
      { id: 'a3', label: 'Aucun extérieur', points: 3 },
    ],
  },
  {
    id: 'q_stationnement', label: 'Stationnement', weight: 3,
    options: [
      { id: 'a1', label: 'Garage ou box fermé', points: 10 },
      { id: 'a2', label: 'Place de parking extérieure', points: 7 },
      { id: 'a3', label: 'Aucun stationnement dédié', points: 3 },
    ],
  },
  {
    id: 'q_etage', label: 'Étage & accès', weight: 3,
    options: [
      { id: 'a1', label: 'Rez-de-chaussée ou ascenseur présent', points: 9 },
      { id: 'a2', label: '1er ou 2e étage sans ascenseur', points: 7 },
      { id: 'a3', label: 'Étage élevé (3e et plus) sans ascenseur', points: 4 },
    ],
  },
  {
    id: 'q_fiscalite', label: "Fiscalité / structure d'achat adaptée", weight: 5,
    options: [
      { id: 'a1', label: 'Optimisation claire possible (LMNP, SCI IS...)', points: 10 },
      { id: 'a2', label: 'Neutre', points: 5 },
      { id: 'a3', label: 'Contraintes fiscales défavorables', points: 2 },
    ],
  },
];

const MKT_RENDEMENT_WEIGHT = 20;
const MKT_DPE_WEIGHT = 8;
const MKT_DPE_POINTS = { A: 10, B: 10, C: 7, D: 7, E: 4, F: 2, G: 0 };

function _mktBandRendement(pct) {
  if (pct < 3) return 2;
  if (pct < 4) return 4;
  if (pct < 5) return 6;
  if (pct < 6) return 8;
  return 10;
}

function _pickPrixMarcheOptionId(ecartPct) {
  if (ecartPct >= 15) return 'a1';
  if (ecartPct >= 5) return 'a2';
  if (ecartPct >= -5) return 'a3';
  if (ecartPct >= -15) return 'a4';
  return 'a5';
}

// Question non répondue = exclue du calcul (pas pénalisante) : permet un aperçu
// du score en temps réel pendant que le formulaire se remplit.
function computeScore(listing) {
  const breakdown = [];
  let totalWeight = 0, weightedSum = 0;

  const prix = parseFloat(listing.prix) || 0;
  const loyer = parseFloat(listing.loyerEstime) || 0;
  if (prix > 0 && loyer > 0) {
    const pct = (loyer * 12 / prix) * 100;
    const pts = _mktBandRendement(pct);
    breakdown.push({ id: 'rendement', label: 'Rendement brut', detail: pct.toFixed(1) + ' %/an', points: pts, weight: MKT_RENDEMENT_WEIGHT });
    weightedSum += pts * MKT_RENDEMENT_WEIGHT; totalWeight += MKT_RENDEMENT_WEIGHT;
  }

  if (listing.dpe && MKT_DPE_POINTS[listing.dpe] != null) {
    const pts = MKT_DPE_POINTS[listing.dpe];
    breakdown.push({ id: 'dpe', label: 'DPE', detail: listing.dpe, points: pts, weight: MKT_DPE_WEIGHT });
    weightedSum += pts * MKT_DPE_WEIGHT; totalWeight += MKT_DPE_WEIGHT;
  }

  const answers = listing.answers || {};
  MARKETPLACE_QUESTIONS.forEach(q => {
    const opt = q.options.find(o => o.id === answers[q.id]);
    if (!opt) return;
    breakdown.push({ id: q.id, label: q.label, detail: opt.label, points: opt.points, weight: q.weight });
    weightedSum += opt.points * q.weight; totalWeight += q.weight;
  });

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
  return { score, breakdown };
}

// ── Géocodage + autocomplétion (API Adresse — gouvernemental, gratuit, CORS activé) ──
async function geocodeAddress(query) {
  if (!query) return null;
  try {
    const res = await fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(query) + '&limit=1');
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features && data.features[0];
    if (!f) return null;
    return _mktFeatureToGeo(f);
  } catch (e) {
    console.warn('[marketplace] géocodage indisponible', e);
    return null;
  }
}
function _mktFeatureToGeo(f) {
  return {
    label: f.properties.label,
    ville: f.properties.city,
    codePostal: f.properties.postcode,
    inseeCode: f.properties.citycode,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  };
}

// ── Comparatif DVF officiel (Etalab, app.dvf.etalab.gouv.fr — gouvernemental,
// CORS activé, vérifié en direct). Contrairement au service communautaire testé
// avant, cette API demande la section cadastrale exacte plutôt qu'un simple code
// commune : on géolocalise donc d'abord le point dans les sections cadastrales
// de la commune (cadastre.data.gouv.fr) avant d'interroger les ventes.
// Toujours best-effort — en cas d'échec le formulaire retombe sur une saisie manuelle.
function _mktPointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function _mktPointInFeature(pt, feature) {
  const geom = feature && feature.geometry;
  if (!geom) return false;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  return polys.some(poly => poly.length && _mktPointInRing(pt, poly[0]));
}

async function fetchDvfComparatif(lat, lon, inseeCode, typeLocal) {
  if (!inseeCode || lat == null || lon == null) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const sectionsRes = await fetch('https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/' + inseeCode + '/geojson/sections', { signal: ctrl.signal });
    if (!sectionsRes.ok) return null;
    const sectionsGeo = await sectionsRes.json();
    const pt = [lon, lat];
    const section = (sectionsGeo.features || []).find(f => _mktPointInFeature(pt, f));
    if (!section) return null;
    const sectionPrefixee = (section.properties.prefixe || '000') + section.properties.code;
    const mutRes = await fetch('https://app.dvf.etalab.gouv.fr/api/mutations3/' + inseeCode + '/' + sectionPrefixee, { signal: ctrl.signal });
    if (!mutRes.ok) return null;
    const mutData = await mutRes.json();
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 2);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const valid = (mutData.mutations || [])
      .filter(m => m.nature_mutation === 'Vente' && m.type_local === (typeLocal || 'Appartement') && m.date_mutation >= cutoffStr)
      .map(m => ({ valeur: parseFloat(m.valeur_fonciere), surface: parseFloat(m.surface_reelle_bati) }))
      .filter(m => m.valeur > 1000 && m.surface > 5);
    if (!valid.length) return null;
    const prixM2Moyen = valid.reduce((s, m) => s + m.valeur / m.surface, 0) / valid.length;
    return { prixM2Marche: Math.round(prixM2Moyen), nbVentes: valid.length };
  } catch (e) {
    console.warn('[marketplace] comparatif DVF indisponible', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Firestore CRUD ──
async function createListing(data) {
  const docRef = await _fs.collection('listings').add({
    ...data,
    createdBy: _auth.currentUser ? _auth.currentUser.email : null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  });
  return docRef.id;
}
function updateListing(id, data) { return _fs.collection('listings').doc(id).update(data); }
function deleteListing(id) { return _fs.collection('listings').doc(id).delete(); }
async function getListings() {
  const snap = await _fs.collection('listings').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Navigation écrans ──
function mktShowView(view) {
  ['mkt-grid-view', 'mkt-form-view', 'mkt-detail-view'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === view) ? '' : 'none';
  });
}

function showMarketplace() {
  const ms = document.getElementById('marketplaceScreen');
  const hs = document.getElementById('homeScreen');
  if (hs) hs.style.display = 'none';
  if (ms) ms.style.display = 'block';
  window.scrollTo(0, 0);
  mktShowView('mkt-grid-view');
  mktRefreshGrid();
}
function exitMarketplace() {
  const ms = document.getElementById('marketplaceScreen');
  if (ms) ms.style.display = 'none';
  showHome();
}

// ── Formulaire ──
let _mktAnswers = {};
let _mktCurrentGeocode = null;
let _mktCurrentDvf = null;
let _mktAddrSuggestions = [];
let _mktAddrTimer = null;
let _mktPhotoFiles = [];

function mktRenderPhotoSlots() {
  const el = document.getElementById('mkt-photo-slots');
  if (!el) return;
  const slots = [];
  for (let i = 0; i < MKT_MAX_PHOTOS; i++) {
    const file = _mktPhotoFiles[i];
    if (file) {
      const url = URL.createObjectURL(file);
      slots.push('<div class="mkt-photo-slot"><img src="' + url + '"><div class="mkt-photo-remove" onclick="event.stopPropagation();mktRemovePhoto(' + i + ')">✕</div></div>');
    } else {
      slots.push('<div class="mkt-photo-slot" onclick="mktPickPhoto(' + i + ')">+ Photo</div>');
    }
  }
  el.innerHTML = slots.join('');
}
function mktPickPhoto(i) {
  // L'input doit être dans le DOM (même invisible) : sur Safari, un <input type=file>
  // jamais attaché ne redéclenche pas toujours l'événement change une fois le fichier choisi.
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
  document.body.appendChild(input);
  input.onchange = () => {
    if (input.files[0]) { _mktPhotoFiles[i] = input.files[0]; mktRenderPhotoSlots(); }
    input.remove();
  };
  input.click();
}
function mktRemovePhoto(i) { _mktPhotoFiles[i] = null; mktRenderPhotoSlots(); }

function mktRenderQuestionnaire() {
  const el = document.getElementById('mkt-questionnaire');
  if (!el) return;
  el.innerHTML = MARKETPLACE_QUESTIONS.map(q => {
    const choices = q.options.map(o => {
      const selected = _mktAnswers[q.id] === o.id;
      return '<div class="mkt-choice' + (selected ? ' selected' : '') + '" onclick="mktSelectAnswer(\'' + q.id + '\',\'' + o.id + '\')">' +
        '<span class="mkt-choice-dot"></span><span>' + escHtml(o.label) + '</span></div>';
    }).join('');
    const autoNote = (q.id === 'q_prix_marche' && _mktCurrentDvf) ? ' <span style="color:var(--gold);font-weight:400">· estimé via DVF, modifiable</span>' : '';
    return '<div class="mkt-q-card"><span class="mkt-q-title">' + escHtml(q.label) + '</span>' +
      '<span class="mkt-q-weight">Poids ' + q.weight + '%' + autoNote + '</span>' +
      '<div class="mkt-choice-group">' + choices + '</div></div>';
  }).join('');
}
function mktSelectAnswer(qId, aId) {
  _mktAnswers[qId] = aId;
  mktRenderQuestionnaire();
  mktUpdateScorePreview();
}

function mktGatherFormData() {
  return {
    type: document.getElementById('mkt-f-type').value,
    dpe: document.getElementById('mkt-f-dpe').value,
    prix: parseFloat(document.getElementById('mkt-f-prix').value) || 0,
    surface: parseFloat(document.getElementById('mkt-f-surface').value) || 0,
    pieces: parseInt(document.getElementById('mkt-f-pieces').value) || 0,
    loyerEstime: parseFloat(document.getElementById('mkt-f-loyer').value) || 0,
    description: document.getElementById('mkt-f-description').value.trim(),
    adresse: document.getElementById('mkt-f-adresse').value.trim(),
    contactNom: document.getElementById('mkt-f-contact-nom').value.trim(),
    contactTel: document.getElementById('mkt-f-contact-tel').value.trim(),
    contactEmail: document.getElementById('mkt-f-contact-email').value.trim(),
    answers: _mktAnswers,
  };
}

function mktUpdateScorePreview() {
  const data = mktGatherFormData();
  const { score } = computeScore(data);
  const el = document.getElementById('mkt-score-preview');
  if (el) el.textContent = score != null ? (score.toFixed(1) + ' / 10') : '—';
}

// ── Autocomplétion d'adresse ──
function mktOnAddressInput() {
  _mktCurrentGeocode = null; _mktCurrentDvf = null;
  clearTimeout(_mktAddrTimer);
  const q = document.getElementById('mkt-f-adresse').value.trim();
  const box = document.getElementById('mkt-addr-suggestions');
  if (q.length < 4) { box.innerHTML = ''; box.style.display = 'none'; return; }
  _mktAddrTimer = setTimeout(async () => {
    try {
      const res = await fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(q) + '&limit=5');
      if (!res.ok) { box.style.display = 'none'; return; }
      const data = await res.json();
      _mktAddrSuggestions = data.features || [];
      if (!_mktAddrSuggestions.length) { box.style.display = 'none'; return; }
      box.innerHTML = _mktAddrSuggestions.map((f, i) =>
        '<div class="mkt-addr-suggestion" onmousedown="mktPickSuggestion(' + i + ')">' + escHtml(f.properties.label) + '</div>'
      ).join('');
      box.style.display = 'block';
    } catch (e) { box.style.display = 'none'; }
  }, 300);
}
async function mktPickSuggestion(i) {
  const f = _mktAddrSuggestions[i];
  const box = document.getElementById('mkt-addr-suggestions');
  if (box) box.style.display = 'none';
  if (!f) return;
  document.getElementById('mkt-f-adresse').value = f.properties.label;
  _mktCurrentGeocode = _mktFeatureToGeo(f);
  await mktRunDvfLookup();
}
function mktOnAddressBlur() {
  setTimeout(async () => {
    const box = document.getElementById('mkt-addr-suggestions');
    if (box) box.style.display = 'none';
    if (_mktCurrentGeocode) return; // déjà résolu via une suggestion cliquée
    const q = document.getElementById('mkt-f-adresse').value.trim();
    const statusEl = document.getElementById('mkt-dvf-status');
    if (!q) return;
    statusEl.textContent = "📍 Recherche de l'adresse...";
    const geo = await geocodeAddress(q);
    _mktCurrentGeocode = geo;
    if (!geo) { statusEl.textContent = '⚠️ Adresse non reconnue — le comparatif de prix ne sera pas automatique.'; return; }
    await mktRunDvfLookup();
  }, 200);
}
async function mktRunDvfLookup() {
  const statusEl = document.getElementById('mkt-dvf-status');
  const geo = _mktCurrentGeocode;
  if (!geo) return;
  statusEl.textContent = '📍 ' + geo.label + ' — recherche de ventes comparables...';
  const type = document.getElementById('mkt-f-type').value;
  const dvf = await fetchDvfComparatif(geo.lat, geo.lon, geo.inseeCode, type);
  _mktCurrentDvf = dvf;
  if (dvf) {
    statusEl.textContent = '📊 Prix moyen du secteur : ' + dvf.prixM2Marche + ' €/m² (' + dvf.nbVentes + ' vente(s) trouvée(s))';
    const prix = parseFloat(document.getElementById('mkt-f-prix').value) || 0;
    const surface = parseFloat(document.getElementById('mkt-f-surface').value) || 0;
    if (prix > 0 && surface > 0) {
      const ecartPct = ((prix / surface - dvf.prixM2Marche) / dvf.prixM2Marche) * 100;
      _mktAnswers.q_prix_marche = _pickPrixMarcheOptionId(ecartPct);
    }
  } else {
    statusEl.textContent = '⚠️ Comparatif automatique indisponible — choisis une estimation ci-dessous.';
  }
  mktRenderQuestionnaire();
  mktUpdateScorePreview();
}

function mktOpenForm() {
  _mktAnswers = {};
  _mktCurrentGeocode = null; _mktCurrentDvf = null;
  _mktPhotoFiles = [];
  ['mkt-f-adresse', 'mkt-f-prix', 'mkt-f-surface', 'mkt-f-pieces', 'mkt-f-loyer', 'mkt-f-description', 'mkt-f-dpe', 'mkt-f-contact-nom', 'mkt-f-contact-tel', 'mkt-f-contact-email'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('mkt-f-type').value = 'Appartement';
  document.getElementById('mkt-dvf-status').textContent = '';
  const box = document.getElementById('mkt-addr-suggestions');
  if (box) { box.innerHTML = ''; box.style.display = 'none'; }
  mktRenderPhotoSlots();
  mktRenderQuestionnaire();
  mktUpdateScorePreview();
  mktShowView('mkt-form-view');
}
function mktCloseForm() { mktShowView('mkt-grid-view'); }

async function mktSubmitListing() {
  const btn = document.getElementById('mkt-submit-btn');
  const data = mktGatherFormData();
  if (!data.adresse || !data.prix || !data.surface) {
    showToast('⚠️ Adresse, prix et surface sont obligatoires', '#f0566a');
    return;
  }
  btn.disabled = true; btn.textContent = 'Publication...';
  try {
    let geo = _mktCurrentGeocode;
    if (!geo) geo = await geocodeAddress(data.adresse);
    const { score, breakdown } = computeScore(data);
    const photoFiles = _mktPhotoFiles.filter(Boolean).slice(0, MKT_MAX_PHOTOS);
    let photos = [];
    if (photoFiles.length) {
      btn.textContent = 'Envoi des photos...';
      photos = await Promise.all(photoFiles.map(uploadPhotoToCloudinary));
    }
    btn.textContent = 'Publication...';
    const listingData = {
      ...data,
      ville: geo ? geo.ville : '',
      codePostal: geo ? geo.codePostal : '',
      inseeCode: geo ? geo.inseeCode : null,
      lat: geo ? geo.lat : null,
      lon: geo ? geo.lon : null,
      dvfComparatif: _mktCurrentDvf,
      score, scoreBreakdown: breakdown,
      photos,
    };
    await createListing(listingData);
    showToast('✅ Annonce publiée');
    mktCloseForm();
    mktRefreshGrid();
  } catch (e) {
    console.error('[marketplace] échec de publication', e);
    showToast('⚠️ Échec de la publication : ' + (e && e.message || e), '#f0566a');
  } finally {
    btn.disabled = false; btn.textContent = "Publier l'annonce";
  }
}

// ── Liste ──
function _mktScoreClass(score) {
  if (score == null) return '';
  if (score >= 7) return 'hi';
  if (score >= 4.5) return 'mid';
  return 'lo';
}

async function mktRefreshGrid() {
  const el = document.getElementById('mkt-listings');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text2);font-size:12px;padding:20px">Chargement...</div>';
  try {
    const listings = await getListings();
    if (!listings.length) {
      el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text2);font-size:13px;padding:60px 0">Aucune annonce pour le moment. Clique sur "Déposer une annonce" pour commencer.</div>';
      return;
    }
    el.innerHTML = listings.map(l =>
      '<div class="mkt-listing-card" onclick="mktOpenDetail(\'' + l.id + '\')">' +
      (l.photos && l.photos[0]
        ? '<div class="mkt-listing-photo" style="background-image:url(\'' + mktCldUrl(l.photos[0], 'w_400,h_220,c_fill,q_auto,f_auto') + '\');background-size:cover;background-position:center"></div>'
        : '<div class="mkt-listing-photo">🏠</div>') +
      '<div style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">' +
      '<div><div style="font-size:13px;font-weight:700;color:#eaf0ff">' + escHtml(l.type || 'Bien') + ' · ' + escHtml(l.ville || '—') + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + (l.surface || '?') + ' m² · ' + (l.pieces || '?') + ' pièces</div></div>' +
      '<div class="mkt-score-badge ' + _mktScoreClass(l.score) + '">' + (l.score != null ? l.score.toFixed(1) : '—') + '</div>' +
      '</div>' +
      '<div style="font-size:16px;font-weight:800;color:#ffb400">' + (l.prix ? Math.round(l.prix).toLocaleString('fr-FR') + ' €' : '—') + '</div>' +
      '</div></div>'
    ).join('');
  } catch (e) {
    console.error('[marketplace] échec de chargement des annonces', e);
    const reason = (e && (e.code || e.message)) ? (e.code || e.message) : String(e);
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:12px;padding:40px 0">' +
      'Échec du chargement des annonces.<br><span style="color:var(--text2);font-size:11px">' + escHtml(reason) + '</span></div>';
  }
}

// ── Détail ──
// ── Analyse automatique (texte généré à partir des données calculées, pas
// d'IA rédactrice : quelques phrases construites selon le score, le rendement,
// l'écart au marché DVF et les points forts/faibles du questionnaire) ──
function mktGenerateComment(l) {
  const parts = [];

  if (l.score != null) {
    let verdict;
    if (l.score >= 7.5) verdict = "une très bonne opportunité d'investissement";
    else if (l.score >= 6) verdict = "une opportunité correcte, avec quelques points de vigilance";
    else if (l.score >= 4.5) verdict = "un investissement à examiner avec prudence";
    else verdict = "un investissement présentant plusieurs points faibles";
    parts.push('Avec une note de <b>' + l.score.toFixed(1) + '/10</b>, ce bien représente ' + verdict + '.');
  }

  const rendementItem = (l.scoreBreakdown || []).find(b => b.id === 'rendement');
  if (rendementItem) {
    const niveau = rendementItem.points >= 8 ? 'nettement au-dessus'
      : rendementItem.points >= 6 ? 'dans la moyenne haute'
      : rendementItem.points >= 4 ? 'dans la moyenne'
      : 'en-dessous';
    parts.push('Le rendement brut estimé (' + rendementItem.detail + ') est ' + niveau + " des standards d'un investissement locatif classique (repère usuel : 4 à 6 % brut).");
  }

  if (l.dvfComparatif && l.prix && l.surface) {
    const prixM2Bien = Math.round(l.prix / l.surface);
    const ecart = Math.round(((prixM2Bien - l.dvfComparatif.prixM2Marche) / l.dvfComparatif.prixM2Marche) * 100);
    const comparaison = ecart > 3 ? (ecart + '% au-dessus') : ecart < -3 ? ((-ecart) + '% en-dessous') : 'proche';
    parts.push(
      'Le prix affiché (' + prixM2Bien.toLocaleString('fr-FR') + ' €/m²) est ' + comparaison +
      ' du prix moyen constaté sur le secteur via DVF (' + l.dvfComparatif.prixM2Marche.toLocaleString('fr-FR') + ' €/m², ' + l.dvfComparatif.nbVentes + ' vente(s) sur 2 ans). ' +
      'Cette donnée reste <b>à prendre avec précaution</b> : échantillon parfois limité, biens pas toujours comparables (état, étage, exposition...).'
    );
  }

  const bd = (l.scoreBreakdown || []).slice().sort((a, b) => b.points - a.points);
  if (bd.length >= 2) {
    const best = bd[0], worst = bd[bd.length - 1];
    if (best.points >= 7 && best.id !== 'rendement') parts.push('Point fort : <b>' + best.label.toLowerCase() + '</b> (' + best.detail + ').');
    if (worst.points <= 4) parts.push('Point de vigilance : <b>' + worst.label.toLowerCase() + '</b> (' + worst.detail + ').');
  }

  if (!parts.length) return '';
  return '<div class="mkt-comment"><div class="mkt-comment-label">💬 Analyse Artemis</div><p>' + parts.join(' ') + '</p></div>';
}

async function mktOpenDetail(id) {
  const el = document.getElementById('mkt-detail-view');
  el.innerHTML = '<div style="color:var(--text2)">Chargement...</div>';
  mktShowView('mkt-detail-view');
  try {
    const doc = await _fs.collection('listings').doc(id).get();
    if (!doc.exists) { el.innerHTML = '<div style="color:var(--red)">Annonce introuvable.</div>'; return; }
    const l = { id: doc.id, ...doc.data() };
    _mktDetailPhotos = l.photos || [];
    const galleryHtml = (l.photos && l.photos.length)
      ? '<div class="mkt-gallery">' + l.photos.map((u, i) => '<img src="' + mktCldUrl(u, 'w_600,h_400,c_fill,q_auto,f_auto') + '" onclick="mktOpenLightbox(' + i + ')">').join('') + '</div>'
      : '';
    const breakdownHtml = (l.scoreBreakdown || []).map(b =>
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">' +
      '<div><div style="color:var(--text)">' + escHtml(b.label) + '</div><div style="color:var(--text2);font-size:11px">' + escHtml(b.detail || '') + ' · poids ' + b.weight + '%</div></div>' +
      '<div style="font-family:monospace;font-weight:700">' + b.points + '/10</div></div>'
    ).join('');
    const commentHtml = mktGenerateComment(l);
    const hasContact = l.contactNom || l.contactTel || l.contactEmail;
    const contactHtml = hasContact ? (
      '<div class="sep-title">Contact</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;font-size:13px">' +
      (l.contactNom ? '<div>👤 ' + escHtml(l.contactNom) + '</div>' : '') +
      (l.contactTel ? '<div>📞 <a href="tel:' + escHtml(l.contactTel) + '" style="color:var(--cyan)">' + escHtml(l.contactTel) + '</a></div>' : '') +
      (l.contactEmail ? '<div>✉️ <a href="mailto:' + escHtml(l.contactEmail) + '" style="color:var(--cyan)">' + escHtml(l.contactEmail) + '</a></div>' : '') +
      '</div>'
    ) : '';
    const mapHtml = (l.lat && l.lon) ? '<div id="mkt-detail-map" style="height:280px;border-radius:12px;margin-bottom:20px"></div>' : '';
    el.innerHTML =
      '<button class="btn btn-outline" onclick="mktCloseDetail()" style="margin-bottom:16px">← Retour</button>' +
      galleryHtml +
      mapHtml +
      '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">' +
      '<div><div style="font-size:20px;font-weight:800;color:#eaf0ff">' + escHtml(l.type || '') + ' · ' + escHtml(l.ville || '') + '</div>' +
      '<div style="font-size:12px;color:var(--text2)">' + escHtml(l.adresse || '') + '</div></div>' +
      '<div class="mkt-score-badge ' + _mktScoreClass(l.score) + '" style="font-size:20px;min-width:48px;height:48px">' + (l.score != null ? l.score.toFixed(1) : '—') + '</div>' +
      '</div>' +
      '<div class="grid3" style="margin-bottom:14px">' +
      '<div><div class="lbl">Prix</div><div style="font-weight:700">' + (l.prix ? Math.round(l.prix).toLocaleString('fr-FR') + ' €' : '—') + '</div></div>' +
      '<div><div class="lbl">Surface</div><div style="font-weight:700">' + (l.surface || '—') + ' m²</div></div>' +
      '<div><div class="lbl">DPE</div><div style="font-weight:700">' + (l.dpe || '—') + '</div></div>' +
      '</div>' +
      (l.description ? '<p style="font-size:13px;color:var(--text2);margin-bottom:14px">' + escHtml(l.description) + '</p>' : '') +
      (l.dvfComparatif ? '<div class="chip chip-gold" style="margin-bottom:14px">📊 Marché secteur : ' + l.dvfComparatif.prixM2Marche + ' €/m² (' + l.dvfComparatif.nbVentes + ' ventes)</div>' : '') +
      contactHtml +
      '<div class="sep-title">Détail du score</div>' +
      breakdownHtml +
      commentHtml +
      '<div style="display:flex;justify-content:flex-end;margin-top:16px">' +
      '<button class="btn btn-red" onclick="mktDeleteListing(\'' + l.id + '\')">🗑 Supprimer</button>' +
      '</div></div>';
    if (l.lat && l.lon) mktInitDetailMap(l.lat, l.lon);
  } catch (e) {
    console.error(e);
    el.innerHTML = '<div style="color:var(--red)">Erreur de chargement.</div>';
  }
}

// ── Carte (Leaflet, déjà utilisé ailleurs dans l'app — vue satellite Esri gratuite,
// sans clé, + plan OpenStreetMap en option) ──
function mktInitDetailMap(lat, lon) {
  setTimeout(() => {
    const el = document.getElementById('mkt-detail-map');
    if (!el || typeof L === 'undefined') return;
    const map = L.map('mkt-detail-map', { zoomControl: true }).setView([lat, lon], 18);
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: '© Esri'
    }).addTo(map);
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    });
    L.control.layers({ 'Satellite': satellite, 'Plan': streets }).addTo(map);
    L.marker([lat, lon]).addTo(map);
  }, 50); // laisse le temps au conteneur d'obtenir ses dimensions avant l'init Leaflet
}

// ── Lightbox photos (plein écran, navigation ‹ › comme un site d'annonces) ──
let _mktDetailPhotos = [];
function mktOpenLightbox(startIndex) {
  const photos = _mktDetailPhotos;
  if (!photos.length) return;
  let idx = startIndex;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center';
  function render() {
    overlay.innerHTML =
      '<div style="position:absolute;top:20px;right:24px;color:#fff;font-size:28px;cursor:pointer;line-height:1" id="mkt-lb-close">✕</div>' +
      (photos.length > 1 ? '<div style="position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#fff;font-size:40px;cursor:pointer;user-select:none" id="mkt-lb-prev">‹</div>' : '') +
      '<img src="' + mktCldUrl(photos[idx], 'w_1600,q_auto,f_auto') + '" style="max-width:88vw;max-height:82vh;object-fit:contain;border-radius:6px">' +
      (photos.length > 1 ? '<div style="position:absolute;right:16px;top:50%;transform:translateY(-50%);color:#fff;font-size:40px;cursor:pointer;user-select:none" id="mkt-lb-next">›</div>' : '') +
      (photos.length > 1 ? '<div style="position:absolute;bottom:20px;color:#fff;font-size:12px;opacity:.7">' + (idx + 1) + ' / ' + photos.length + '</div>' : '');
    document.getElementById('mkt-lb-close').onclick = close;
    const prev = document.getElementById('mkt-lb-prev'); if (prev) prev.onclick = e => { e.stopPropagation(); idx = (idx - 1 + photos.length) % photos.length; render(); };
    const next = document.getElementById('mkt-lb-next'); if (next) next.onclick = e => { e.stopPropagation(); idx = (idx + 1) % photos.length; render(); };
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft' && photos.length > 1) { idx = (idx - 1 + photos.length) % photos.length; render(); }
    else if (e.key === 'ArrowRight' && photos.length > 1) { idx = (idx + 1) % photos.length; render(); }
  }
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  overlay.onclick = e => { if (e.target === overlay) close(); };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  render();
}
function mktCloseDetail() { mktShowView('mkt-grid-view'); mktRefreshGrid(); }
function mktDeleteListing(id) {
  askConfirm('Supprimer définitivement cette annonce ?', async () => {
    try { await deleteListing(id); showToast('Annonce supprimée'); mktCloseDetail(); }
    catch (e) { console.error(e); showToast('⚠️ Échec de la suppression', '#f0566a'); }
  }, 'Supprimer', '#f0566a');
}
