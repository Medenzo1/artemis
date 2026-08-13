// ══════════════════════════════════════════════
//  MARKETPLACE — annonces + baromètre d'opportunité
// ══════════════════════════════════════════════

// ── Questionnaire pondéré ─────────────────────
// Le score final combine : rendement brut (25%, calculé), DPE (10%, dérivé du
// champ DPE), et ces 5 questions à choix multiple (poids total 65%).
const MARKETPLACE_QUESTIONS = [
  {
    id: 'q_prix_marche', label: 'Prix au m² vs marché', weight: 20,
    options: [
      { id: 'a1', label: 'Nettement au-dessus du marché (+15% ou plus)', points: 2 },
      { id: 'a2', label: 'Au-dessus du marché (+5 à +15%)', points: 5 },
      { id: 'a3', label: 'Dans le marché (±5%)', points: 7 },
      { id: 'a4', label: 'En-dessous du marché (-5 à -15%)', points: 9 },
      { id: 'a5', label: 'Largement en-dessous du marché (-15% ou plus)', points: 10 },
    ],
  },
  {
    id: 'q_etat', label: 'État du bien / travaux à prévoir', weight: 15,
    options: [
      { id: 'a1', label: 'Neuf ou rénové, aucun travaux', points: 10 },
      { id: 'a2', label: 'Bon état, travaux mineurs (< 5% du prix)', points: 7 },
      { id: 'a3', label: 'À rafraîchir (5 à 15% du prix)', points: 4 },
      { id: 'a4', label: 'Travaux lourds (> 15% du prix)', points: 1 },
    ],
  },
  {
    id: 'q_tension', label: 'Tension locative de la zone', weight: 15,
    options: [
      { id: 'a1', label: 'Très tendue (grande métropole, forte demande)', points: 10 },
      { id: 'a2', label: 'Tendue (ville moyenne dynamique)', points: 7 },
      { id: 'a3', label: 'Équilibrée', points: 5 },
      { id: 'a4', label: 'Détendue (faible demande)', points: 2 },
    ],
  },
  {
    id: 'q_lcd', label: 'Potentiel location courte durée (LCD)', weight: 10,
    options: [
      { id: 'a1', label: 'Zone touristique/étudiante, forte demande, réglementation favorable', points: 10 },
      { id: 'a2', label: 'LCD possible mais réglementé/plafonné', points: 6 },
      { id: 'a3', label: 'LLD uniquement pertinent', points: 5 },
      { id: 'a4', label: 'Zone réglementée défavorable (quota atteint...)', points: 2 },
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

const MKT_RENDEMENT_WEIGHT = 25;
const MKT_DPE_WEIGHT = 10;
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

// Ligne non répondue = exclue du calcul (pas pénalisante) : permet un aperçu
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

// ── Géocodage (API Adresse — gouvernemental, gratuit, CORS activé) ──
async function geocodeAddress(query) {
  if (!query) return null;
  try {
    const res = await fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(query) + '&limit=1');
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features && data.features[0];
    if (!f) return null;
    return {
      label: f.properties.label,
      ville: f.properties.city,
      codePostal: f.properties.postcode,
      inseeCode: f.properties.citycode,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    };
  } catch (e) {
    console.warn('[marketplace] géocodage indisponible', e);
    return null;
  }
}

// ── Comparatif DVF (best-effort — service communautaire non garanti,
// jamais bloquant : en cas d'échec le formulaire retombe sur une saisie manuelle) ──
async function fetchDvfComparatif(inseeCode, typeLocal) {
  if (!inseeCode) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const url = 'https://api.cquest.org/dvf?code_commune=' + encodeURIComponent(inseeCode) +
      '&nature_mutation=Vente&type_local=' + encodeURIComponent(typeLocal || 'Appartement');
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.features ? data.features.map(f => f.properties || f) : []);
    const valid = rows
      .map(r => ({ valeur: parseFloat(r.valeur_fonciere), surface: parseFloat(r.surface_reelle_bati) }))
      .filter(r => r.valeur > 0 && r.surface > 0);
    if (!valid.length) return null;
    const prixM2Moyen = valid.reduce((s, r) => s + r.valeur / r.surface, 0) / valid.length;
    return { prixM2Marche: Math.round(prixM2Moyen), nbVentes: valid.length };
  } catch (e) {
    console.warn('[marketplace] comparatif DVF indisponible', e);
    return null;
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
let _mktCurrentGeocode = null;
let _mktCurrentDvf = null;

function mktRenderQuestionnaire() {
  const el = document.getElementById('mkt-questionnaire');
  if (!el) return;
  el.innerHTML = MARKETPLACE_QUESTIONS.map(q =>
    '<div class="mkt-q-row"><label class="lbl">' + escHtml(q.label) +
    ' <span style="color:var(--text2);font-weight:400;text-transform:none">(poids ' + q.weight + '%)</span></label>' +
    '<select id="mkt-q-' + q.id + '" onchange="mktUpdateScorePreview()"><option value="">— Choisir —</option>' +
    q.options.map(o => '<option value="' + o.id + '">' + escHtml(o.label) + '</option>').join('') +
    '</select></div>'
  ).join('');
}

function mktGatherFormData() {
  const answers = {};
  MARKETPLACE_QUESTIONS.forEach(q => {
    const el = document.getElementById('mkt-q-' + q.id);
    if (el && el.value) answers[q.id] = el.value;
  });
  return {
    type: document.getElementById('mkt-f-type').value,
    dpe: document.getElementById('mkt-f-dpe').value,
    prix: parseFloat(document.getElementById('mkt-f-prix').value) || 0,
    surface: parseFloat(document.getElementById('mkt-f-surface').value) || 0,
    pieces: parseInt(document.getElementById('mkt-f-pieces').value) || 0,
    loyerEstime: parseFloat(document.getElementById('mkt-f-loyer').value) || 0,
    description: document.getElementById('mkt-f-description').value.trim(),
    adresse: document.getElementById('mkt-f-adresse').value.trim(),
    answers,
  };
}

function mktUpdateScorePreview() {
  const data = mktGatherFormData();
  const { score } = computeScore(data);
  const el = document.getElementById('mkt-score-preview');
  if (el) el.textContent = score != null ? (score.toFixed(1) + ' / 10') : '—';
}

async function mktOnAddressBlur() {
  const q = document.getElementById('mkt-f-adresse').value.trim();
  const statusEl = document.getElementById('mkt-dvf-status');
  const sel = document.getElementById('mkt-q-q_prix_marche');
  if (!q) return;
  statusEl.textContent = "📍 Recherche de l'adresse...";
  const geo = await geocodeAddress(q);
  _mktCurrentGeocode = geo;
  if (!geo) {
    statusEl.textContent = '⚠️ Adresse non reconnue — le comparatif de prix ne sera pas automatique.';
    if (sel) sel.disabled = false;
    return;
  }
  statusEl.textContent = '📍 ' + geo.label + ' — recherche de ventes comparables...';
  const type = document.getElementById('mkt-f-type').value;
  const dvf = await fetchDvfComparatif(geo.inseeCode, type);
  _mktCurrentDvf = dvf;
  if (dvf) {
    statusEl.textContent = '📊 Prix moyen du secteur : ' + dvf.prixM2Marche + ' €/m² (' + dvf.nbVentes + ' vente(s) trouvée(s))';
    const prix = parseFloat(document.getElementById('mkt-f-prix').value) || 0;
    const surface = parseFloat(document.getElementById('mkt-f-surface').value) || 0;
    if (prix > 0 && surface > 0 && sel) {
      const ecartPct = ((prix / surface - dvf.prixM2Marche) / dvf.prixM2Marche) * 100;
      sel.value = _pickPrixMarcheOptionId(ecartPct);
      sel.disabled = true;
    }
  } else {
    statusEl.textContent = '⚠️ Comparatif automatique indisponible — choisis une estimation ci-dessous.';
    if (sel) sel.disabled = false;
  }
  mktUpdateScorePreview();
}

function mktOpenForm() {
  _mktCurrentGeocode = null; _mktCurrentDvf = null;
  ['mkt-f-adresse', 'mkt-f-prix', 'mkt-f-surface', 'mkt-f-pieces', 'mkt-f-loyer', 'mkt-f-description', 'mkt-f-dpe'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('mkt-f-type').value = 'Appartement';
  document.getElementById('mkt-dvf-status').textContent = '';
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
    const listingData = {
      ...data,
      ville: geo ? geo.ville : '',
      codePostal: geo ? geo.codePostal : '',
      inseeCode: geo ? geo.inseeCode : null,
      lat: geo ? geo.lat : null,
      lon: geo ? geo.lon : null,
      dvfComparatif: _mktCurrentDvf,
      score, scoreBreakdown: breakdown,
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
      '<div class="mkt-listing-photo">🏠</div>' +
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
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:12px;padding:40px 0">Échec du chargement des annonces.</div>';
  }
}

// ── Détail ──
async function mktOpenDetail(id) {
  const el = document.getElementById('mkt-detail-view');
  el.innerHTML = '<div style="color:var(--text2)">Chargement...</div>';
  mktShowView('mkt-detail-view');
  try {
    const doc = await _fs.collection('listings').doc(id).get();
    if (!doc.exists) { el.innerHTML = '<div style="color:var(--red)">Annonce introuvable.</div>'; return; }
    const l = { id: doc.id, ...doc.data() };
    const breakdownHtml = (l.scoreBreakdown || []).map(b =>
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">' +
      '<div><div style="color:var(--text)">' + escHtml(b.label) + '</div><div style="color:var(--text2);font-size:11px">' + escHtml(b.detail || '') + ' · poids ' + b.weight + '%</div></div>' +
      '<div style="font-family:monospace;font-weight:700">' + b.points + '/10</div></div>'
    ).join('');
    el.innerHTML =
      '<button class="btn btn-outline" onclick="mktCloseDetail()" style="margin-bottom:16px">← Retour</button>' +
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
      '<div class="sep-title">Détail du score</div>' +
      breakdownHtml +
      '<div style="display:flex;justify-content:flex-end;margin-top:16px">' +
      '<button class="btn btn-red" onclick="mktDeleteListing(\'' + l.id + '\')">🗑 Supprimer</button>' +
      '</div></div>';
  } catch (e) {
    console.error(e);
    el.innerHTML = '<div style="color:var(--red)">Erreur de chargement.</div>';
  }
}
function mktCloseDetail() { mktShowView('mkt-grid-view'); mktRefreshGrid(); }
function mktDeleteListing(id) {
  askConfirm('Supprimer définitivement cette annonce ?', async () => {
    try { await deleteListing(id); showToast('Annonce supprimée'); mktCloseDetail(); }
    catch (e) { console.error(e); showToast('⚠️ Échec de la suppression', '#f0566a'); }
  }, 'Supprimer', '#f0566a');
}
