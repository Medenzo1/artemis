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

// ── Typologies de bien ─────────────────────────
// Source de vérité unique pilotant : champs affichés dans le formulaire, jeu de
// questions du baromètre, filtre DVF, et module d'analyse PDF additionnel.
// Clé = valeur exacte stockée dans listing.type (donc zéro migration des annonces existantes).
const MKT_TYPOLOGIES = {
  'Appartement':          { dvfTypeLocal: 'Appartement', dvfEnabled: true,  showDpe: true,  showPieces: true,  pieceLabel: 'Pièces',          questionSetKey: 'standard', reportModuleKey: null },
  'Maison':                { dvfTypeLocal: 'Maison',      dvfEnabled: true,  showDpe: true,  showPieces: true,  pieceLabel: 'Pièces',          questionSetKey: 'standard', reportModuleKey: null },
  'Location courte durée': { dvfTypeLocal: 'Appartement', dvfEnabled: true,  showDpe: true,  showPieces: true,  pieceLabel: 'Pièces',          questionSetKey: 'standard', reportModuleKey: 'lcd' },
  'Place de parking':      { dvfTypeLocal: 'Dépendance',  dvfEnabled: true,  showDpe: false, showPieces: false, pieceLabel: null,              questionSetKey: 'parking',  reportModuleKey: null },
  'Immeuble':              { dvfTypeLocal: null,          dvfEnabled: false, showDpe: false, showPieces: true,  pieceLabel: 'Nombre de lots',  questionSetKey: 'immeuble', reportModuleKey: 'immeuble' },
};
const MKT_DEFAULT_TYPOLOGY = 'Appartement';
function mktTypology(type) { return MKT_TYPOLOGIES[type] || MKT_TYPOLOGIES[MKT_DEFAULT_TYPOLOGY]; }

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

// Place de parking : pas de DPE, pas d'étage/extérieur — questions dédiées.
const MKT_QUESTIONS_PARKING = [
  {
    id: 'q_prix_marche', label: 'Prix vs marché', weight: 22,
    options: [
      { id: 'a1', label: 'Nettement au-dessus du marché (+15% ou plus)', points: 2 },
      { id: 'a2', label: 'Au-dessus du marché (+5 à +15%)', points: 5 },
      { id: 'a3', label: 'Dans le marché (±5%)', points: 7 },
      { id: 'a4', label: 'En-dessous du marché (-5 à -15%)', points: 9 },
      { id: 'a5', label: 'Largement en-dessous du marché (-15% ou plus)', points: 10 },
    ],
  },
  {
    id: 'q_securisation', label: 'Sécurisation / accès', weight: 12,
    options: [
      { id: 'a1', label: 'Box fermé individuel, digicode + vidéosurveillance', points: 10 },
      { id: 'a2', label: 'Parking clos/gardienné, accès contrôlé', points: 7 },
      { id: 'a3', label: 'Parking clos sans surveillance active', points: 5 },
      { id: 'a4', label: 'Place extérieure non sécurisée', points: 2 },
    ],
  },
  {
    id: 'q_tension_parking', label: 'Tension du marché local du stationnement', weight: 12,
    options: [
      { id: 'a1', label: 'Hyper-centre / zone tendue, stationnement rare et cher', points: 10 },
      { id: 'a2', label: 'Quartier dense, demande soutenue', points: 7 },
      { id: 'a3', label: 'Demande modérée, offre équilibrée', points: 5 },
      { id: 'a4', label: 'Zone peu tendue, stationnement facile en voirie', points: 2 },
    ],
  },
  {
    id: 'q_accessibilite', label: 'Accessibilité / manœuvre', weight: 10,
    options: [
      { id: 'a1', label: 'Place large, accès direct, manœuvre facile (tous véhicules)', points: 10 },
      { id: 'a2', label: 'Standard, manœuvre normale', points: 7 },
      { id: 'a3', label: 'Accès contraint (rampe, virage serré, hauteur limitée)', points: 4 },
      { id: 'a4', label: "Place difficile d'accès, incompatible gros véhicules", points: 1 },
    ],
  },
  {
    id: 'q_fiscalite', label: "Fiscalité / structure d'achat adaptée", weight: 6,
    options: [
      { id: 'a1', label: 'Optimisation claire possible (LMNP, SCI...)', points: 10 },
      { id: 'a2', label: 'Neutre', points: 5 },
      { id: 'a3', label: 'Contraintes fiscales défavorables', points: 2 },
    ],
  },
];

// Immeuble entier : pas de DPE (bien collectif), questions sur le parc de lots.
const MKT_QUESTIONS_IMMEUBLE = [
  {
    id: 'q_prix_marche', label: 'Prix vs marché (estimation manuelle — pas de comparatif DVF automatique pour les immeubles)', weight: 18,
    options: [
      { id: 'a1', label: 'Nettement au-dessus des immeubles de rapport comparables (+15% ou plus)', points: 2 },
      { id: 'a2', label: 'Au-dessus du marché (+5 à +15%)', points: 5 },
      { id: 'a3', label: 'Dans le marché (±5%)', points: 7 },
      { id: 'a4', label: 'En-dessous du marché (-5 à -15%)', points: 9 },
      { id: 'a5', label: 'Largement en-dessous du marché (-15% ou plus)', points: 10 },
    ],
  },
  {
    id: 'q_etat_immeuble', label: "État général de l'immeuble (structure, toiture, façade, parties communes)", weight: 12,
    options: [
      { id: 'a1', label: 'Neuf ou récemment rénové intégralement', points: 10 },
      { id: 'a2', label: 'Bon état, travaux mineurs ponctuels', points: 7 },
      { id: 'a3', label: 'Vieillissant, rénovation à prévoir (toiture, façade...)', points: 4 },
      { id: 'a4', label: 'Dégradé, travaux lourds de structure/mise aux normes', points: 1 },
    ],
  },
  {
    id: 'q_occupation_taux', label: "Taux d'occupation actuel du parc de lots", weight: 12,
    options: [
      { id: 'a1', label: '100% loué, baux à jour et cohérents avec le marché', points: 10 },
      { id: 'a2', label: 'Majoritairement loué (> 70%), quelques vacances', points: 7 },
      { id: 'a3', label: 'Occupation partielle (40-70%)', points: 4 },
      { id: 'a4', label: 'Largement vacant (< 40%)', points: 1 },
    ],
  },
  {
    id: 'q_mixite_baux', label: 'Mixité des baux / usages', weight: 8,
    options: [
      { id: 'a1', label: 'Mixte habitation + commercial, baux diversifiés (mutualise le risque)', points: 10 },
      { id: 'a2', label: 'Homogène habitation, baux nus et meublés variés', points: 7 },
      { id: 'a3', label: 'Un seul type de bail, un seul type de locataire dominant', points: 4 },
    ],
  },
  {
    id: 'q_charges_gestion', label: 'Charges de copropriété / complexité de gestion', weight: 8,
    options: [
      { id: 'a1', label: 'Mono-propriété, gestion simple, charges maîtrisées', points: 10 },
      { id: 'a2', label: 'Copropriété saine, charges raisonnables', points: 6 },
      { id: 'a3', label: 'Charges élevées ou copropriété en difficulté', points: 2 },
    ],
  },
  {
    id: 'q_potentiel_valorisation', label: "Potentiel de valorisation (découpe en lots, travaux, changement d'usage)", weight: 10,
    options: [
      { id: 'a1', label: 'Fort potentiel identifié (découpe, surélévation, changement d\'usage)', points: 10 },
      { id: 'a2', label: 'Potentiel modéré (rénovation valorisante possible)', points: 6 },
      { id: 'a3', label: 'Aucun potentiel de valorisation identifié', points: 2 },
    ],
  },
  {
    id: 'q_fiscalite', label: "Fiscalité / structure d'achat adaptée", weight: 6,
    options: [
      { id: 'a1', label: 'Optimisation claire possible (SCI IS, déficit foncier, LMNP...)', points: 10 },
      { id: 'a2', label: 'Neutre', points: 5 },
      { id: 'a3', label: 'Contraintes fiscales défavorables', points: 2 },
    ],
  },
];

const MKT_QUESTION_SETS = { standard: MARKETPLACE_QUESTIONS, parking: MKT_QUESTIONS_PARKING, immeuble: MKT_QUESTIONS_IMMEUBLE };
function mktQuestionsFor(type) { return MKT_QUESTION_SETS[mktTypology(type).questionSetKey] || MKT_QUESTION_SETS.standard; }

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
  mktQuestionsFor(listing.type).forEach(q => {
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
    // Les dépendances (garages, caves, places de parking) ont souvent une surface_reelle_bati
    // vide dans le DVF, et le €/m² n'a pas de sens pour ce type de bien — on compare alors
    // en prix de vente absolu plutôt qu'en prix au m².
    const unitBased = typeLocal === 'Dépendance';
    const valid = (mutData.mutations || [])
      .filter(m => m.nature_mutation === 'Vente' && m.type_local === (typeLocal || 'Appartement') && m.date_mutation >= cutoffStr)
      .map(m => ({ valeur: parseFloat(m.valeur_fonciere), surface: parseFloat(m.surface_reelle_bati) }))
      .filter(m => m.valeur > 1000 && (unitBased || m.surface > 5));
    if (!valid.length) return null;
    if (unitBased) {
      const prixMoyen = valid.reduce((s, m) => s + m.valeur, 0) / valid.length;
      return { prixMoyen: Math.round(prixMoyen), nbVentes: valid.length, unitBased: true };
    }
    const prixM2Moyen = valid.reduce((s, m) => s + m.valeur / m.surface, 0) / valid.length;
    return { prixM2Marche: Math.round(prixM2Moyen), nbVentes: valid.length, unitBased: false };
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
  const type = document.getElementById('mkt-f-type').value;
  el.innerHTML = mktQuestionsFor(type).map(q => {
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

function mktToggleLinkedBien() {
  const checked = document.getElementById('mkt-f-linked').checked;
  const wrap = document.getElementById('mkt-linked-bien-wrap');
  wrap.style.display = checked ? '' : 'none';
  if (checked) {
    const sel = document.getElementById('mkt-f-linked-bien');
    const biens = (getParams().biens || []);
    sel.innerHTML = biens.map(b => '<option value="' + escHtml(b.id) + '">' + escHtml(b.nom || b.name || b.id) + '</option>').join('');
  }
}

function mktGatherFormData() {
  const linked = document.getElementById('mkt-f-linked').checked;
  const linkedSel = document.getElementById('mkt-f-linked-bien');
  const linkedBienId = linked ? linkedSel.value : null;
  const linkedBienNom = linked && linkedBienId ? (linkedSel.options[linkedSel.selectedIndex] ? linkedSel.options[linkedSel.selectedIndex].textContent : '') : null;
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
    linkedBienId, linkedBienNom,
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
  const type = document.getElementById('mkt-f-type').value;
  const tg = mktTypology(type);
  if (!tg.dvfEnabled) {
    _mktCurrentDvf = null;
    statusEl.textContent = 'ℹ️ Comparatif DVF non disponible pour les immeubles (ventes en bloc, non comparables aux ventes au lot) — estime le prix vs marché manuellement dans le questionnaire ci-dessous.';
    mktRenderQuestionnaire();
    mktUpdateScorePreview();
    return;
  }
  statusEl.textContent = '📍 ' + geo.label + ' — recherche de ventes comparables...';
  const dvf = await fetchDvfComparatif(geo.lat, geo.lon, geo.inseeCode, tg.dvfTypeLocal);
  _mktCurrentDvf = dvf;
  if (dvf) {
    const prix = parseFloat(document.getElementById('mkt-f-prix').value) || 0;
    if (dvf.unitBased) {
      statusEl.textContent = '📊 Prix moyen constaté du secteur : ' + mktFmtEUR(dvf.prixMoyen) + ' (' + dvf.nbVentes + ' vente(s) trouvée(s) — catégorie DVF "Dépendance" : garages, caves et places de parking confondus)';
      if (prix > 0) {
        const ecartPct = ((prix - dvf.prixMoyen) / dvf.prixMoyen) * 100;
        _mktAnswers.q_prix_marche = _pickPrixMarcheOptionId(ecartPct);
      }
    } else {
      statusEl.textContent = '📊 Prix moyen du secteur : ' + dvf.prixM2Marche + ' €/m² (' + dvf.nbVentes + ' vente(s) trouvée(s))';
      const surface = parseFloat(document.getElementById('mkt-f-surface').value) || 0;
      if (prix > 0 && surface > 0) {
        const ecartPct = ((prix / surface - dvf.prixM2Marche) / dvf.prixM2Marche) * 100;
        _mktAnswers.q_prix_marche = _pickPrixMarcheOptionId(ecartPct);
      }
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
  document.getElementById('mkt-f-linked').checked = false;
  document.getElementById('mkt-linked-bien-wrap').style.display = 'none';
  const box = document.getElementById('mkt-addr-suggestions');
  if (box) { box.innerHTML = ''; box.style.display = 'none'; }
  mktRenderPhotoSlots();
  mktOnTypeChange();
  mktShowView('mkt-form-view');
}
function mktCloseForm() { mktShowView('mkt-grid-view'); }

// Appelé au changement de typologie : adapte les champs affichés (DPE, Pièces),
// recharge le bon jeu de questions, recalcule le score, et relance le comparatif
// DVF si une adresse est déjà géocodée (le filtre type_local peut changer).
function mktOnTypeChange() {
  const type = document.getElementById('mkt-f-type').value;
  const tg = mktTypology(type);
  const dpeWrap = document.getElementById('mkt-f-dpe-wrap');
  if (dpeWrap) dpeWrap.style.display = tg.showDpe ? '' : 'none';
  if (!tg.showDpe) document.getElementById('mkt-f-dpe').value = '';
  const piecesWrap = document.getElementById('mkt-f-pieces-wrap');
  if (piecesWrap) piecesWrap.style.display = tg.showPieces ? '' : 'none';
  const piecesLabel = document.getElementById('mkt-f-pieces-label');
  if (piecesLabel) piecesLabel.textContent = tg.pieceLabel || 'Pièces';
  _mktAnswers = {};
  mktRenderQuestionnaire();
  mktUpdateScorePreview();
  if (_mktCurrentGeocode) mktRunDvfLookup();
}

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
// Phrases en texte brut avec marqueurs **gras** — partagées entre l'affichage
// HTML (converti en <b>) et le PDF (marqueurs simplement retirés).
function mktBuildAnalysisParts(l) {
  const parts = [];

  if (l.score != null) {
    let verdict;
    if (l.score >= 7.5) verdict = "une très bonne opportunité d'investissement";
    else if (l.score >= 6) verdict = "une opportunité correcte, avec quelques points de vigilance";
    else if (l.score >= 4.5) verdict = "un investissement à examiner avec prudence";
    else verdict = "un investissement présentant plusieurs points faibles";
    parts.push('Avec une note de **' + l.score.toFixed(1) + '/10**, ce bien représente ' + verdict + '.');
  }

  const rendementItem = (l.scoreBreakdown || []).find(b => b.id === 'rendement');
  if (rendementItem) {
    const niveau = rendementItem.points >= 8 ? 'nettement au-dessus'
      : rendementItem.points >= 6 ? 'dans la moyenne haute'
      : rendementItem.points >= 4 ? 'dans la moyenne'
      : 'en-dessous';
    parts.push('Le rendement brut estimé (' + rendementItem.detail + ') est ' + niveau + " des standards d'un investissement locatif classique (repère usuel : 4 à 6 % brut).");
  }

  if (l.dvfComparatif && l.dvfComparatif.unitBased && l.prix) {
    const ecart = Math.round(((l.prix - l.dvfComparatif.prixMoyen) / l.dvfComparatif.prixMoyen) * 100);
    const comparaison = ecart > 3 ? (ecart + '% au-dessus') : ecart < -3 ? ((-ecart) + '% en-dessous') : 'proche';
    parts.push(
      'Le prix affiché (' + mktFmtEUR(l.prix) + ') est ' + comparaison +
      ' du prix moyen constaté sur le secteur via DVF (' + mktFmtEUR(l.dvfComparatif.prixMoyen) + ', ' + l.dvfComparatif.nbVentes + ' vente(s) sur 2 ans, catégorie "Dépendance" : garages, caves et places de parking confondus). ' +
      'Cette donnée reste **à prendre avec précaution** : échantillon parfois limité, biens pas toujours comparables (sécurisation, accessibilité, emplacement...).'
    );
  } else if (l.dvfComparatif && !l.dvfComparatif.unitBased && l.prix && l.surface) {
    const prixM2Bien = Math.round(l.prix / l.surface);
    const ecart = Math.round(((prixM2Bien - l.dvfComparatif.prixM2Marche) / l.dvfComparatif.prixM2Marche) * 100);
    const comparaison = ecart > 3 ? (ecart + '% au-dessus') : ecart < -3 ? ((-ecart) + '% en-dessous') : 'proche';
    parts.push(
      'Le prix affiché (' + mktFmtNum(prixM2Bien) + ' €/m²) est ' + comparaison +
      ' du prix moyen constaté sur le secteur via DVF (' + mktFmtNum(l.dvfComparatif.prixM2Marche) + ' €/m², ' + l.dvfComparatif.nbVentes + ' vente(s) sur 2 ans). ' +
      'Cette donnée reste **à prendre avec précaution** : échantillon parfois limité, biens pas toujours comparables (état, étage, exposition...).'
    );
  }

  const bd = (l.scoreBreakdown || []).slice().sort((a, b) => b.points - a.points);
  if (bd.length >= 2) {
    const best = bd[0], worst = bd[bd.length - 1];
    if (best.points >= 7 && best.id !== 'rendement') parts.push('Point fort : **' + best.label.toLowerCase() + '** (' + best.detail + ').');
    if (worst.points <= 4) parts.push('Point de vigilance : **' + worst.label.toLowerCase() + '** (' + worst.detail + ').');
  }

  return parts;
}

function mktGenerateComment(l) {
  const parts = mktBuildAnalysisParts(l);
  if (!parts.length) return '';
  const html = parts.map(p => p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')).join(' ');
  return '<div class="mkt-comment"><div class="mkt-comment-label">💬 Analyse Artemis</div><p>' + html + '</p></div>';
}

// ── Rapport financier PDF (bien suivi dans Artemis, données réelles importées) ──
// Design "dossier bancaire" : page de couverture + synthèse KPI + graphique
// vectoriel + tableau détaillé + répartition des charges, aux couleurs Artemis.
const PDF_NAVY   = [13, 23, 46];
const PDF_NAVY2  = [23, 35, 68];
const PDF_CYAN   = [34, 211, 200];
const PDF_GOLD   = [245, 183, 49];
const PDF_GREEN  = [34, 201, 122];
const PDF_RED    = [240, 86, 106];
const PDF_PURPLE = [155, 110, 243];
const PDF_BGSOFT = [244, 246, 250];
const PDF_LINE   = [226, 231, 239];
const PDF_TEXT   = [23, 28, 40];
const PDF_MUTED  = [110, 122, 145];
const PDF_CAT_COLORS = [PDF_GOLD, PDF_CYAN, PDF_PURPLE, PDF_RED, PDF_GREEN, PDF_NAVY2];
const PDF_TYPE_LABELS = { LCD: 'Location courte durée', LLD: 'Location longue durée', SC: 'Sous-colocation' };
const PDF_MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

function mktFmtPeriod(period, short) {
  const [y, m] = String(period).split('-');
  const mi = (+m || 1) - 1;
  if (short) return (m || '01') + '/' + String(y).slice(-2);
  return (PDF_MONTHS[mi] || m) + ' ' + y;
}
// Les polices standard des PDF (WinAnsi) ne supportent pas l'espace fine insécable
// (U+202F) utilisée par défaut par toLocaleString('fr-FR') pour grouper les milliers :
// jsPDF retombe alors sur un caractère parasite ("/"). On la remplace par un espace normal.
function mktFmtNum(n, opts) { return n.toLocaleString('fr-FR', opts).replace(/[  ]/g, ' '); }
function mktFmtEUR(n) { return mktFmtNum(Math.round(n)) + ' €'; }
function mktFmtK(n) {
  if (Math.abs(n) >= 1000) return mktFmtNum(n / 1000, { maximumFractionDigits: 1 }) + ' k€';
  return mktFmtNum(Math.round(n)) + ' €';
}
function mktNiceMax(v) {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function mktBuildBienStats(bienId) {
  const db = getDB();
  const periodKeys = Object.keys(db.periods || {}).sort();
  const rows = [];
  const catTotals = {};
  periodKeys.forEach(k => {
    // _expandFG ventile les lignes "Frais généraux" (ex : expert-comptable réparti
    // sur plusieurs biens via une quote-part) en une sous-ligne par bien avant filtrage —
    // sans ça, seules les charges mappées directement sur ce bien étaient comptées.
    const lines = _expandFG(db.periods[k].lines || []).filter(l => l.bienId === bienId);
    if (!lines.length) return;
    const ca = lines.filter(l => _isCA(l)).reduce((s, l) => s + (+l.montant || 0), 0);
    const dep = lines.filter(l => _isDep(l)).reduce((s, l) => s + (+l.montant || 0), 0); // négatif
    lines.filter(l => _isDep(l)).forEach(l => {
      const cat = l.cat || 'Autre';
      catTotals[cat] = (catTotals[cat] || 0) + Math.abs(+l.montant || 0);
    });
    rows.push({ period: k, ca, dep, resultat: ca + dep });
  });
  return { rows, catTotals };
}

// Charge une image (logo local ou photo Cloudinary) et la convertit en dataURL exploitable par jsPDF.
function mktLoadImage(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function mktPdfHeaderBand(doc, logo, bienNom) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_NAVY); doc.rect(0, 0, pageW, 20, 'F');
  if (logo) doc.addImage(logo.dataUrl, 'PNG', 14, 5, 10, 10);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text('ARTEMIS', 28, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_CYAN);
  doc.text('Dossier · ' + bienNom, pageW - 14, 9, { align: 'right' });
  doc.setTextColor(200, 208, 225);
  doc.text('Généré le ' + new Date().toLocaleDateString('fr-FR'), pageW - 14, 14.5, { align: 'right' });
  return 30;
}

function mktPdfFooters(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_LINE); doc.setLineWidth(0.3);
    doc.line(14, pageH - 13, pageW - 14, pageH - 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...PDF_MUTED);
    doc.text('Artemis · Document confidentiel — usage interne et bancaire', 14, pageH - 8);
    doc.text('Page ' + p + ' / ' + total, pageW - 14, pageH - 8, { align: 'right' });
  }
}

// Carte KPI arrondie avec liseré coloré, style tableau de bord bancaire.
function mktPdfKpiCard(doc, x, y, w, h, label, value, color) {
  doc.setFillColor(...PDF_BGSOFT); doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setFillColor(...color); doc.roundedRect(x, y, 2.2, h, 1.1, 1.1, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...PDF_MUTED);
  doc.text(label.toUpperCase(), x + 7, y + 8);
  const fs = value.length > 13 ? 11 : value.length > 10 ? 13 : 15;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.setTextColor(...PDF_TEXT);
  doc.text(value, x + 7, y + h - 6);
}

function mktPdfSectionTitle(doc, x, y, title) {
  doc.setFillColor(...PDF_GOLD); doc.rect(x, y - 4, 1.4, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...PDF_NAVY);
  doc.text(title, x + 4, y);
}

// Graphique en barres 100% vectoriel (net à l'impression, pas de flou de rastérisation).
function mktPdfBarChart(doc, x, y, w, h, rows) {
  const leftPad = 20, bottomPad = 14;
  const plotX = x + leftPad, plotW = w - leftPad, plotH = h - bottomPad;
  const maxVal = mktNiceMax(Math.max(1, ...rows.map(r => Math.max(r.ca, Math.abs(r.dep)))));
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = y + plotH - (plotH * i / 4);
    doc.setDrawColor(...(i === 0 ? PDF_MUTED : PDF_LINE));
    doc.line(plotX, gy, x + w, gy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...PDF_MUTED);
    doc.text(mktFmtK(maxVal * i / 4), plotX - 3, gy + 1, { align: 'right' });
  }
  const n = rows.length;
  const groupW = plotW / n;
  const barW = Math.min(9, groupW * 0.32);
  const gap = barW * 0.3;
  const shortLabels = n > 6;
  rows.forEach((r, i) => {
    const gx = plotX + groupW * i + groupW / 2;
    const caH = (r.ca / maxVal) * plotH;
    const depH = (Math.abs(r.dep) / maxVal) * plotH;
    doc.setFillColor(...PDF_GREEN);
    doc.roundedRect(gx - barW - gap / 2, y + plotH - caH, barW, Math.max(caH, 0.3), 0.6, 0.6, 'F');
    doc.setFillColor(...PDF_RED);
    doc.roundedRect(gx + gap / 2, y + plotH - depH, barW, Math.max(depH, 0.3), 0.6, 0.6, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(n > 10 ? 6 : 7); doc.setTextColor(...PDF_MUTED);
    doc.text(mktFmtPeriod(r.period, shortLabels), gx, y + plotH + 7, { align: 'center' });
  });
}

// Graphique en barres à une seule série (ex. saisonnalité LCD). Copie volontairement la
// logique d'axes/grille de mktPdfBarChart plutôt que de la factoriser, pour ne pas risquer
// de régression sur le graphique CA/Charges déjà utilisé par la Synthèse financière.
function mktPdfSeasonalityChart(doc, x, y, w, h, rows, color) {
  const leftPad = 20, bottomPad = 14;
  const plotX = x + leftPad, plotW = w - leftPad, plotH = h - bottomPad;
  const maxVal = mktNiceMax(Math.max(1, ...rows.map(r => r.ca)));
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = y + plotH - (plotH * i / 4);
    doc.setDrawColor(...(i === 0 ? PDF_MUTED : PDF_LINE));
    doc.line(plotX, gy, x + w, gy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...PDF_MUTED);
    doc.text(mktFmtK(maxVal * i / 4), plotX - 3, gy + 1, { align: 'right' });
  }
  const n = rows.length;
  const groupW = plotW / n;
  const barW = Math.min(12, groupW * 0.5);
  const shortLabels = n > 6;
  rows.forEach((r, i) => {
    const gx = plotX + groupW * i + groupW / 2;
    const caH = (r.ca / maxVal) * plotH;
    doc.setFillColor(...color);
    doc.roundedRect(gx - barW / 2, y + plotH - caH, barW, Math.max(caH, 0.3), 0.6, 0.6, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(n > 10 ? 6 : 7); doc.setTextColor(...PDF_MUTED);
    doc.text(mktFmtPeriod(r.period, shortLabels), gx, y + plotH + 7, { align: 'center' });
  });
}

function mktPdfLegendDot(doc, x, y, color, label) {
  doc.setFillColor(...color); doc.roundedRect(x, y - 2.6, 3.2, 3.2, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_TEXT);
  doc.text(label, x + 5, y);
}

// Grille label/valeur façon fiche technique (3 colonnes par défaut). Retourne le y de fin.
function mktPdfFactsGrid(doc, x, y, w, items, cols) {
  const colW = w / cols;
  const rowH = 14;
  items.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const ix = x + col * colW, iy = y + row * rowH;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...PDF_MUTED);
    doc.text(it[0].toUpperCase(), ix, iy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...PDF_TEXT);
    doc.text(String(it[1]), ix, iy + 5.5);
  });
  return y + Math.ceil(items.length / cols) * rowH + 4;
}

// Paragraphe avec retour à la ligne + saut de page automatique (en-tête répété).
function mktPdfParagraph(doc, x, y, w, text, logo, docTitle, pageH) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...PDF_TEXT);
  const lines = doc.splitTextToSize(text, w);
  lines.forEach(line => {
    if (y > pageH - 24) {
      doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...PDF_TEXT);
    }
    doc.text(line, x, y); y += 5;
  });
  return y;
}

// Carte de localisation vectorielle. Pas d'imagerie satellite : les tuiles
// gratuites (Esri, OSM, IGN — toutes vérifiées) ne renvoient aucun en-tête
// CORS, donc leurs pixels sont illisibles côté navigateur pour être
// incrustés dans un PDF ; la carte interactive reste dans l'app.
function mktPdfLocationCard(doc, x, y, w, listing) {
  const h = 62;
  doc.setFillColor(...PDF_BGSOFT); doc.roundedRect(x, y, w, h, 3, 3, 'F');
  const cx = x + 28, cy = y + h / 2 - 4;
  doc.setFillColor(...PDF_GOLD); doc.circle(cx, cy, 9, 'F');
  doc.setDrawColor(...PDF_NAVY); doc.setLineWidth(1); doc.circle(cx, cy, 9, 'S');
  doc.triangle(cx - 6, cy + 6, cx + 6, cy + 6, cx, cy + 17, 'F');
  doc.setFillColor(...PDF_NAVY); doc.circle(cx, cy, 3, 'F');

  const tx = x + 54;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...PDF_TEXT);
  doc.text(listing.adresse || 'Adresse non renseignée', tx, y + 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...PDF_MUTED);
  doc.text([listing.codePostal, listing.ville].filter(Boolean).join(' ') || '', tx, y + 27);
  if (listing.lat && listing.lon) {
    doc.setFontSize(8);
    doc.text('Coordonnées GPS : ' + (+listing.lat).toFixed(5) + ', ' + (+listing.lon).toFixed(5), tx, y + 35);
  }
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...PDF_MUTED);
  doc.text(doc.splitTextToSize("La carte satellite interactive du bien reste consultable dans l'application Artemis, sur la fiche de l'annonce.", w - 54 - 14), tx, y + h - 12);
  return y + h + 8;
}

function mktPdfScoreCircle(doc, cx, cy, r, score) {
  const color = score >= 7 ? PDF_GREEN : score >= 4.5 ? PDF_GOLD : PDF_RED;
  doc.setFillColor(255, 255, 255); doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(...color); doc.setLineWidth(2.4); doc.circle(cx, cy, r, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(r > 15 ? 22 : 15); doc.setTextColor(...PDF_TEXT);
  doc.text(score != null ? score.toFixed(1) : '—', cx, cy + r * 0.18, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...PDF_MUTED);
  doc.text('/ 10', cx, cy + r * 0.18 + 6, { align: 'center' });
}

// Un critère du questionnaire : hauteur calculée à l'avance pour que
// l'appelant puisse décider d'un saut de page avant de dessiner.
function mktPdfScoreCriterion(doc, x, w, item) {
  const detailLines = item.detail ? doc.splitTextToSize(item.detail, w - 20) : [];
  const height = 5 + detailLines.length * 4 + 9;
  return {
    height,
    draw(yy) {
      const color = item.points >= 7 ? PDF_GREEN : item.points >= 4 ? PDF_GOLD : PDF_RED;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PDF_TEXT);
      doc.text(item.label, x, yy);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...PDF_MUTED);
      doc.text('Poids ' + item.weight + '%', x + w, yy, { align: 'right' });
      yy += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_MUTED);
      detailLines.forEach(line => { doc.text(line, x, yy); yy += 4; });
      yy += 1.5;
      doc.setFillColor(...PDF_LINE); doc.roundedRect(x, yy, w - 16, 3, 1.5, 1.5, 'F');
      doc.setFillColor(...color); doc.roundedRect(x, yy, Math.max(3, (w - 16) * (item.points / 10)), 3, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...color);
      doc.text(item.points + '/10', x + w, yy + 2.6, { align: 'right' });
    }
  };
}

const MKT_GALLERY_TRANSFORM = 'w_700,h_460,c_fill,q_auto,f_auto';
const MKT_GALLERY_RATIO = 460 / 700; // même ratio que le recadrage Cloudinary ci-dessus, pour dimensionner la grille photo dans le PDF sans déformation

// ── Module PDF « Location courte durée » ──────────────────────────────────
// Il n'existe pas d'équivalent gratuit au DVF pour la location courte durée en France
// (les données de marché LCD sérieuses — AirDNA etc. — sont payantes). On s'appuie donc
// sur une donnée réelle et gratuite : l'historique des autres biens LCD déjà suivis dans
// le portefeuille Artemis de l'utilisateur (getParams().biens, type==='LCD').
function mktLcdPortfolioBenchmark(excludeBienId) {
  const biens = (getParams().biens || []).filter(b => b.type === 'LCD' && b.id !== excludeBienId);
  const perBien = biens.map(b => mktBuildBienStats(b.id)).filter(s => s.rows.length);
  const byPeriod = {};
  perBien.forEach(({ rows }) => rows.forEach(r => { (byPeriod[r.period] = byPeriod[r.period] || []).push(r.ca); }));
  const periods = Object.keys(byPeriod).sort();
  const avgRows = periods.map(period => ({ period, ca: byPeriod[period].reduce((s, v) => s + v, 0) / byPeriod[period].length }));
  const globalAvgMonthly = avgRows.length ? avgRows.reduce((s, r) => s + r.ca, 0) / avgRows.length : null;
  return { nbBiens: perBien.length, avgRows, globalAvgMonthly, firstPeriod: periods[0], lastPeriod: periods[periods.length - 1] };
}

function mktPdfModuleLCD(doc, listing, logo, docTitle, marginX, contentW, pageH) {
  doc.addPage();
  let y = mktPdfHeaderBand(doc, logo, docTitle);
  y += 6;
  mktPdfSectionTitle(doc, marginX, y, 'Analyse marché — Location courte durée');
  y += 10;

  const bench = mktLcdPortfolioBenchmark(listing.linkedBienId || null);

  if (bench.nbBiens < 2) {
    mktPdfParagraph(doc, marginX, y, contentW,
      "Cette analyse s'appuie sur l'historique de revenus des biens de type Location courte durée déjà suivis dans votre portefeuille Artemis. " +
      "À ce jour, " + bench.nbBiens + (bench.nbBiens > 1 ? ' biens sont suivis' : (bench.nbBiens === 1 ? ' bien est suivi' : ' bien n\'est suivi')) +
      " avec des données importées — un minimum de 2 biens comparables est nécessaire pour établir une moyenne de portefeuille fiable. " +
      "Ajoute et importe les données d'autres biens LCD dans Artemis pour enrichir cette analyse.",
      logo, docTitle, pageH);
    return;
  }

  const cardGap = 5, cardW = (contentW - cardGap * 3) / 4, cardH = 26;
  const ecart = (listing.loyerEstime && bench.globalAvgMonthly) ? Math.round(((listing.loyerEstime - bench.globalAvgMonthly) / bench.globalAvgMonthly) * 100) : null;
  mktPdfKpiCard(doc, marginX, y, cardW, cardH, 'Revenu moyen portefeuille', mktFmtEUR(bench.globalAvgMonthly) + ' /mois', PDF_CYAN);
  mktPdfKpiCard(doc, marginX + (cardW + cardGap), y, cardW, cardH, 'Loyer estimé de ce bien', listing.loyerEstime ? mktFmtEUR(listing.loyerEstime) + ' /mois' : '—', PDF_GOLD);
  mktPdfKpiCard(doc, marginX + (cardW + cardGap) * 2, y, cardW, cardH, 'Écart', ecart != null ? (ecart >= 0 ? '+' : '') + ecart + ' %' : '—', (ecart != null && ecart >= 0) ? PDF_GREEN : PDF_RED);
  mktPdfKpiCard(doc, marginX + (cardW + cardGap) * 3, y, cardW, cardH, 'Biens comparés', String(bench.nbBiens), PDF_NAVY2);
  y += cardH + 14;

  mktPdfSectionTitle(doc, marginX, y, 'Revenu mensuel moyen — portefeuille LCD');
  y += 10;
  mktPdfSeasonalityChart(doc, marginX, y, contentW, 60, bench.avgRows, PDF_CYAN);
  y += 60 + 12;

  const parts = [];
  parts.push('Cette page compare le loyer estimé de ce bien à l\'historique réel des ' + bench.nbBiens +
    ' biens de type Location courte durée déjà suivis dans votre portefeuille Artemis (' +
    mktFmtPeriod(bench.firstPeriod) + ' → ' + mktFmtPeriod(bench.lastPeriod) + ').');
  if (ecart != null) {
    parts.push('Le loyer estimé de ce bien (' + mktFmtEUR(listing.loyerEstime) + '/mois) se situe ' +
      Math.abs(ecart) + '% ' + (ecart >= 0 ? 'au-dessus' : 'en-dessous') +
      ' de la moyenne mensuelle constatée sur votre portefeuille LCD (' + mktFmtEUR(bench.globalAvgMonthly) + '/mois).');
  }
  parts.push("Cette comparaison reste indicative : elle s'appuie sur vos propres biens, dont l'emplacement, la taille et le niveau de gamme peuvent différer de ce bien. Elle ne remplace pas une étude de marché spécialisée (non intégrée à Artemis pour rester sans coût).");
  mktPdfParagraph(doc, marginX, y, contentW, parts.join(' '), logo, docTitle, pageH);
}

// ── Module PDF « Immeuble » ────────────────────────────────────────────────
// Pas de comparatif DVF pour un immeuble (voir fetchDvfComparatif / mktRunDvfLookup) : le seul
// signal fiable et gratuit vient des champs déjà saisis dans le formulaire (prix, loyers
// cumulés, nombre de lots), agrégés en un rendement global et une lecture par lot.
function mktPdfModuleImmeuble(doc, listing, logo, docTitle, marginX, contentW, pageH) {
  doc.addPage();
  let y = mktPdfHeaderBand(doc, logo, docTitle);
  y += 6;
  mktPdfSectionTitle(doc, marginX, y, "Rentabilité globale de l'immeuble");
  y += 10;

  const prix = listing.prix || 0, loyer = listing.loyerEstime || 0, lots = listing.pieces || 0;
  const rendementGlobal = (prix > 0 && loyer > 0) ? (loyer * 12 / prix) * 100 : null;

  const cardGap = 5, cardW = (contentW - cardGap * 3) / 4, cardH = 26;
  mktPdfKpiCard(doc, marginX, y, cardW, cardH, 'Prix total', mktFmtEUR(prix), PDF_NAVY2);
  mktPdfKpiCard(doc, marginX + (cardW + cardGap), y, cardW, cardH, 'Loyers mensuels cumulés', mktFmtEUR(loyer), PDF_GOLD);
  mktPdfKpiCard(doc, marginX + (cardW + cardGap) * 2, y, cardW, cardH, 'Rendement brut global', rendementGlobal != null ? rendementGlobal.toFixed(1) + ' %' : '—', PDF_GREEN);
  mktPdfKpiCard(doc, marginX + (cardW + cardGap) * 3, y, cardW, cardH, 'Nombre de lots', lots ? String(lots) : '—', PDF_CYAN);
  y += cardH + 14;

  if (lots > 0) {
    y = mktPdfFactsGrid(doc, marginX, y, contentW, [
      ['Prix moyen / lot', mktFmtEUR(prix / lots)],
      ['Loyer moyen / lot', mktFmtEUR(loyer / lots) + ' /mois'],
    ], 2);
    y += 4;
  }

  if (rendementGlobal != null) {
    const niveau = rendementGlobal >= 6 ? 'nettement au-dessus' : rendementGlobal >= 5 ? 'dans la moyenne haute'
      : rendementGlobal >= 4 ? 'dans la moyenne' : 'en-dessous';
    mktPdfParagraph(doc, marginX, y, contentW,
      'Le rendement brut global de cet immeuble (' + rendementGlobal.toFixed(1) + ' %) est ' + niveau +
      " des standards d'un investissement locatif classique (repère usuel : 4 à 6 % brut). " +
      "Ce chiffre agrège l'ensemble des lots : la performance réelle peut varier fortement d'un lot à l'autre selon leur état, leur occupation et leur typologie.",
      logo, docTitle, pageH);
  }
}

async function mktGenerateReport() {
  if (!window.jspdf) { showToast('⚠️ Génération PDF indisponible', '#f0566a'); return; }
  const listing = _mktCurrentListing;
  if (!listing) { showToast('⚠️ Aucune annonce sélectionnée', '#f0566a'); return; }
  const { jsPDF } = window.jspdf;

  showToast('📄 Génération du dossier en cours…', '#22d3c8');

  const bienId = listing.linkedBienId || null;
  const bien = bienId ? ((getParams().biens || []).find(b => b.id === bienId) || {}) : {};
  const { rows, catTotals } = bienId ? mktBuildBienStats(bienId) : { rows: [], catTotals: {} };
  const docTitle = listing.linkedBienNom || [listing.type, listing.ville].filter(Boolean).join(' · ') || 'Bien';
  const galleryUrls = (listing.photos || []).slice(0, MKT_MAX_PHOTOS);

  const [logo, coverPhoto, ...galleryPhotos] = await Promise.all([
    mktLoadImage('icon-192.png'),
    galleryUrls[0] ? mktLoadImage(mktCldUrl(galleryUrls[0], 'w_1000,h_650,c_fill,q_auto,f_auto')) : Promise.resolve(null),
    ...galleryUrls.map(u => mktLoadImage(mktCldUrl(u, MKT_GALLERY_TRANSFORM)))
  ]);

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2;

  // ═══ PAGE DE COUVERTURE ═══
  doc.setFillColor(...PDF_NAVY); doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(...PDF_GOLD); doc.rect(0, 0, pageW * 0.28, 1.4, 'F');

  if (logo) {
    doc.setFillColor(255, 255, 255); doc.roundedRect(pageW / 2 - 17, 34, 34, 34, 4, 4, 'F');
    doc.addImage(logo.dataUrl, 'PNG', pageW / 2 - 13, 38, 26, 26);
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text('A R T E M I S', pageW / 2, 84, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...PDF_CYAN);
  doc.text('G E S T I O N   L O C A T I V E   &   S C I', pageW / 2, 91, { align: 'center' });

  doc.setDrawColor(...PDF_GOLD); doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 14, 100, pageW / 2 + 14, 100);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(255, 255, 255);
  doc.text('Dossier du bien', pageW / 2, 118, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(15); doc.setTextColor(...PDF_CYAN);
  doc.text(docTitle, pageW / 2, 128, { align: 'center' });

  if (coverPhoto) {
    const pw = 120, ph = 78, px = pageW / 2 - pw / 2, py = 140;
    doc.setFillColor(255, 255, 255); doc.roundedRect(px - 1.5, py - 1.5, pw + 3, ph + 3, 3, 3, 'F');
    doc.addImage(coverPhoto.dataUrl, 'PNG', px, py, pw, ph);
  }

  const factsAll = [];
  if (bien.sci) factsAll.push(['SCI', bien.sci]);
  factsAll.push(['Type de bien', listing.type || '—']);
  factsAll.push(['Localisation', [listing.codePostal, listing.ville].filter(Boolean).join(' ') || '—']);
  if (listing.prix) factsAll.push(['Prix', mktFmtEUR(listing.prix)]);
  if (listing.surface) factsAll.push(['Surface', listing.surface + ' m²']);
  if (rows.length) factsAll.push(['Période comptable', mktFmtPeriod(rows[0].period) + ' → ' + mktFmtPeriod(rows[rows.length - 1].period)]);
  const facts = factsAll.slice(0, coverPhoto ? 4 : 6);
  const factsRows = Math.max(1, Math.ceil(facts.length / 2));
  const cardH = factsRows * 14 + 6;
  const factsY = coverPhoto ? 232 : 150;
  doc.setFillColor(255, 255, 255); doc.roundedRect(marginX + 10, factsY, contentW - 20, cardH, 3, 3, 'F');
  const colW = (contentW - 20) / 2;
  facts.forEach((f, i) => {
    const fx = marginX + 10 + 8 + (i % 2) * colW;
    const fy = factsY + 12 + Math.floor(i / 2) * 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...PDF_MUTED);
    doc.text(f[0].toUpperCase(), fx, fy - 4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...PDF_TEXT);
    doc.text(String(f[1]), fx, fy + 2);
  });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 160, 182);
  doc.text('Document confidentiel généré automatiquement par Artemis le ' + new Date().toLocaleDateString('fr-FR'), pageW / 2, pageH - 14, { align: 'center' });

  // ═══ PAGE — PRÉSENTATION DU BIEN ═══
  doc.addPage();
  let y = mktPdfHeaderBand(doc, logo, docTitle);
  y += 6;
  mktPdfSectionTitle(doc, marginX, y, 'Présentation du bien');
  y += 10;

  const validGallery = galleryPhotos.filter(Boolean);
  if (validGallery.length) {
    const gap = 4;
    const cols = validGallery.length === 1 ? 1 : 2;
    const photoW = cols === 1 ? contentW : (contentW - gap) / 2;
    const photoH = photoW * MKT_GALLERY_RATIO;
    validGallery.forEach((ph, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      doc.addImage(ph.dataUrl, 'PNG', marginX + col * (photoW + gap), y + row * (photoH + gap), photoW, photoH);
    });
    y += Math.ceil(validGallery.length / cols) * (photoH + gap) + 6;
  }

  const factItems = [
    ['Type', listing.type || '—'],
    ['Ville', listing.ville || '—'],
    ['DPE', listing.dpe || '—'],
    ['Prix', listing.prix ? mktFmtEUR(listing.prix) : '—'],
    ['Surface', listing.surface ? listing.surface + ' m²' : '—'],
    ['Pièces', listing.pieces || '—'],
    ['Prix / m²', (listing.prix && listing.surface) ? mktFmtEUR(Math.round(listing.prix / listing.surface)) : '—'],
    ['Loyer estimé', listing.loyerEstime ? mktFmtEUR(listing.loyerEstime) + ' / mois' : '—'],
    ['Adresse', listing.adresse || '—']
  ];
  y = mktPdfFactsGrid(doc, marginX, y, contentW, factItems, 3);
  y += 4;

  if (listing.contactNom || listing.contactTel || listing.contactEmail) {
    doc.setFillColor(...PDF_BGSOFT); doc.roundedRect(marginX, y, contentW, 12, 2, 2, 'F');
    const contactBits = [
      listing.contactNom ? 'Contact : ' + listing.contactNom : '',
      listing.contactTel ? 'Tél. ' + listing.contactTel : '',
      listing.contactEmail ? listing.contactEmail : ''
    ].filter(Boolean).join('     ');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...PDF_TEXT);
    doc.text(contactBits, marginX + 6, y + 7.5);
    y += 18;
  }

  if (listing.description) {
    mktPdfSectionTitle(doc, marginX, y, 'Description de l’annonce');
    y += 8;
    y = mktPdfParagraph(doc, marginX, y, contentW, listing.description, logo, docTitle, pageH);
  }

  // ═══ PAGE — LOCALISATION ═══
  if (listing.adresse || (listing.lat && listing.lon)) {
    doc.addPage();
    y = mktPdfHeaderBand(doc, logo, docTitle);
    y += 6;
    mktPdfSectionTitle(doc, marginX, y, 'Localisation');
    y += 10;
    mktPdfLocationCard(doc, marginX, y, contentW, listing);
  }

  // ═══ PAGE — SCORE D'OPPORTUNITÉ ═══
  if (listing.score != null || (listing.scoreBreakdown || []).length) {
    doc.addPage();
    y = mktPdfHeaderBand(doc, logo, docTitle);
    y += 6;
    mktPdfSectionTitle(doc, marginX, y, "Score d'opportunité Artemis");
    y += 12;

    mktPdfScoreCircle(doc, marginX + 16, y + 4, 16, listing.score);
    if (listing.dvfComparatif && listing.dvfComparatif.unitBased && listing.prix) {
      doc.setFillColor(...PDF_BGSOFT); doc.roundedRect(marginX + 40, y - 12, contentW - 40, 32, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...PDF_TEXT);
      doc.text('Comparatif marché (DVF)', marginX + 46, y - 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_MUTED);
      doc.text(
        doc.splitTextToSize(
          'Bien : ' + mktFmtEUR(listing.prix) + '  ·  Secteur : ' + mktFmtEUR(listing.dvfComparatif.prixMoyen) + ' (' + listing.dvfComparatif.nbVentes + ' vente(s) sur 2 ans)',
          contentW - 52
        ), marginX + 46, y + 4
      );
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize('Donnée officielle Etalab (DVF), catégorie "Dépendance" (garages, caves et places de parking confondus) — à prendre avec précaution.', contentW - 52), marginX + 46, y + 15);
    } else if (listing.dvfComparatif && !listing.dvfComparatif.unitBased && listing.prix && listing.surface) {
      const prixM2 = Math.round(listing.prix / listing.surface);
      doc.setFillColor(...PDF_BGSOFT); doc.roundedRect(marginX + 40, y - 12, contentW - 40, 32, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...PDF_TEXT);
      doc.text('Comparatif marché (DVF)', marginX + 46, y - 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_MUTED);
      doc.text(
        doc.splitTextToSize(
          'Bien : ' + mktFmtEUR(prixM2) + '/m²  ·  Secteur : ' + mktFmtEUR(listing.dvfComparatif.prixM2Marche) + '/m² (' + listing.dvfComparatif.nbVentes + ' vente(s) sur 2 ans)',
          contentW - 52
        ), marginX + 46, y + 4
      );
      doc.setFontSize(7); doc.text('Donnée officielle Etalab (DVF) — à prendre avec précaution, échantillon parfois limité.', marginX + 46, y + 15);
    }
    y += 30;

    const breakdown = listing.scoreBreakdown || [];
    breakdown.forEach(item => {
      const c = mktPdfScoreCriterion(doc, marginX, contentW, item);
      if (y + c.height > pageH - 24) { doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle); }
      c.draw(y);
      y += c.height;
    });

    const analysisParts = mktBuildAnalysisParts(listing).map(p => p.replace(/\*\*/g, ''));
    if (analysisParts.length) {
      y += 4;
      if (y + 20 > pageH - 24) { doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle); }
      mktPdfSectionTitle(doc, marginX, y, 'Analyse Artemis');
      y += 9;
      y = mktPdfParagraph(doc, marginX, y, contentW, analysisParts.join(' '), logo, docTitle, pageH);
    }
  }

  // ═══ MODULE D'ANALYSE SPÉCIFIQUE À LA TYPOLOGIE ═══
  const typologyModule = mktTypology(listing.type).reportModuleKey;
  if (typologyModule === 'lcd') {
    mktPdfModuleLCD(doc, listing, logo, docTitle, marginX, contentW, pageH);
  } else if (typologyModule === 'immeuble') {
    mktPdfModuleImmeuble(doc, listing, logo, docTitle, marginX, contentW, pageH);
  }

  // ═══ PAGES — SYNTHÈSE FINANCIÈRE (uniquement si le bien est suivi avec des données importées) ═══
  if (rows.length) {
    const totalCa = rows.reduce((s, r) => s + r.ca, 0);
    const totalDep = rows.reduce((s, r) => s + r.dep, 0);
    const totalRes = totalCa + totalDep;
    const totalDepAbs = Math.abs(totalDep) || 1;
    const moyMensuelle = totalRes / rows.length;

    doc.addPage();
    y = mktPdfHeaderBand(doc, logo, docTitle);
    y += 6;

    mktPdfSectionTitle(doc, marginX, y, 'Synthèse financière');
    y += 8;

    const cardGap = 5;
    const cardW = (contentW - cardGap * 3) / 4;
    const cardH2 = 26;
    mktPdfKpiCard(doc, marginX, y, cardW, cardH2, "Chiffre d'affaires", mktFmtEUR(totalCa), PDF_GREEN);
    mktPdfKpiCard(doc, marginX + (cardW + cardGap), y, cardW, cardH2, 'Charges', mktFmtEUR(totalDepAbs), PDF_RED);
    mktPdfKpiCard(doc, marginX + (cardW + cardGap) * 2, y, cardW, cardH2, 'Résultat net', mktFmtEUR(totalRes), totalRes >= 0 ? PDF_GOLD : PDF_RED);
    mktPdfKpiCard(doc, marginX + (cardW + cardGap) * 3, y, cardW, cardH2, 'Moyenne mensuelle', mktFmtEUR(moyMensuelle), PDF_CYAN);
    y += cardH2 + 14;

    mktPdfSectionTitle(doc, marginX, y, 'Évolution mensuelle');
    mktPdfLegendDot(doc, pageW - 14 - 95, y, PDF_GREEN, "Chiffre d'affaires");
    mktPdfLegendDot(doc, pageW - 14 - 28, y, PDF_RED, 'Charges');
    y += 10;
    const chartH = 66;
    mktPdfBarChart(doc, marginX, y, contentW, chartH, rows);
    y += chartH + 12;

    // Tableau détail mensuel (avec saut de page automatique + en-tête répété)
    const tableTop = () => {
      mktPdfSectionTitle(doc, marginX, y, 'Détail mensuel');
      y += 7;
      doc.setFillColor(...PDF_NAVY); doc.rect(marginX, y, contentW, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
      doc.text('PÉRIODE', marginX + 4, y + 5.5);
      doc.text("CHIFFRE D'AFFAIRES", marginX + contentW * 0.52, y + 5.5, { align: 'right' });
      doc.text('CHARGES', marginX + contentW * 0.74, y + 5.5, { align: 'right' });
      doc.text('RÉSULTAT', marginX + contentW - 4, y + 5.5, { align: 'right' });
      y += 8;
    };
    if (y + 8 > pageH - 24) { doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle); }
    tableTop();

    const rowH = 7.2;
    rows.forEach((r, i) => {
      if (y + rowH > pageH - 24) {
        doc.addPage();
        y = mktPdfHeaderBand(doc, logo, docTitle);
        tableTop();
      }
      if (i % 2 === 1) { doc.setFillColor(...PDF_BGSOFT); doc.rect(marginX, y, contentW, rowH, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...PDF_TEXT);
      doc.text(mktFmtPeriod(r.period), marginX + 4, y + 5);
      doc.text(mktFmtEUR(r.ca), marginX + contentW * 0.52, y + 5, { align: 'right' });
      doc.setTextColor(...PDF_RED);
      doc.text(mktFmtEUR(Math.abs(r.dep)), marginX + contentW * 0.74, y + 5, { align: 'right' });
      doc.setTextColor(...(r.resultat >= 0 ? PDF_GREEN : PDF_RED));
      doc.setFont('helvetica', 'bold');
      doc.text(mktFmtEUR(r.resultat), marginX + contentW - 4, y + 5, { align: 'right' });
      y += rowH;
    });

    if (y + rowH > pageH - 24) { doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle); }
    doc.setDrawColor(...PDF_NAVY); doc.setLineWidth(0.6); doc.line(marginX, y, marginX + contentW, y);
    doc.setFillColor(...PDF_BGSOFT); doc.rect(marginX, y, contentW, rowH + 1, 'F');
    y += rowH * 0.72;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PDF_NAVY);
    doc.text('TOTAL', marginX + 4, y);
    doc.setTextColor(...PDF_GREEN); doc.text(mktFmtEUR(totalCa), marginX + contentW * 0.52, y, { align: 'right' });
    doc.setTextColor(...PDF_RED); doc.text(mktFmtEUR(totalDepAbs), marginX + contentW * 0.74, y, { align: 'right' });
    doc.setTextColor(...(totalRes >= 0 ? PDF_GREEN : PDF_RED)); doc.text(mktFmtEUR(totalRes), marginX + contentW - 4, y, { align: 'right' });
    y += rowH + 12;

    // Répartition des charges par catégorie (barres horizontales colorées)
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (catEntries.length) {
      if (y + 25 > pageH - 24 && y > 60) {
        doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle);
      }
      mktPdfSectionTitle(doc, marginX, y, 'Répartition des charges par catégorie');
      y += 10;
      const maxCat = catEntries[0][1];
      catEntries.forEach(([cat, amt], i) => {
        if (y + 11 > pageH - 24) { doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle); }
        const pct = (amt / totalDepAbs * 100);
        const color = PDF_CAT_COLORS[i % PDF_CAT_COLORS.length];
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...PDF_TEXT);
        doc.text(cat, marginX, y);
        doc.setTextColor(...PDF_MUTED);
        doc.text(mktFmtEUR(amt) + '  ·  ' + pct.toFixed(1) + '%', marginX + contentW, y, { align: 'right' });
        y += 2.5;
        doc.setFillColor(...PDF_LINE); doc.roundedRect(marginX, y, contentW, 3, 1.5, 1.5, 'F');
        const fillW = Math.max(3, contentW * (amt / maxCat));
        doc.setFillColor(...color); doc.roundedRect(marginX, y, fillW, 3, 1.5, 1.5, 'F');
        y += 8.5;
      });
      y += 4;
    }

    if (y + 14 > pageH - 24) { doc.addPage(); y = mktPdfHeaderBand(doc, logo, docTitle); }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...PDF_MUTED);
    const disclaimer = "Les montants présentés sont issus des données comptables importées et catégorisées dans Artemis (relevés bancaires, plateformes de location). Ce document est fourni à titre indicatif et ne constitue pas une pièce comptable certifiée.";
    doc.text(doc.splitTextToSize(disclaimer, contentW), marginX, y);
  }

  mktPdfFooters(doc);
  doc.save('dossier-' + docTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf');
  showToast('✅ Dossier téléchargé');
}

let _mktCurrentListing = null;
async function mktOpenDetail(id) {
  const el = document.getElementById('mkt-detail-view');
  el.innerHTML = '<div style="color:var(--text2)">Chargement...</div>';
  mktShowView('mkt-detail-view');
  try {
    const doc = await _fs.collection('listings').doc(id).get();
    if (!doc.exists) { el.innerHTML = '<div style="color:var(--red)">Annonce introuvable.</div>'; return; }
    const l = { id: doc.id, ...doc.data() };
    _mktCurrentListing = l;
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
    const reportHtml = '<div class="chip chip-cyan" style="margin-bottom:14px;cursor:pointer" onclick="mktGenerateReport()">📄 Télécharger le dossier complet (PDF)</div>';
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
      (l.dvfComparatif && l.dvfComparatif.unitBased
        ? '<div class="chip chip-gold" style="margin-bottom:14px">📊 Marché secteur (dépendances) : ' + Math.round(l.dvfComparatif.prixMoyen).toLocaleString('fr-FR') + ' € (' + l.dvfComparatif.nbVentes + ' ventes)</div>'
        : l.dvfComparatif ? '<div class="chip chip-gold" style="margin-bottom:14px">📊 Marché secteur : ' + l.dvfComparatif.prixM2Marche + ' €/m² (' + l.dvfComparatif.nbVentes + ' ventes)</div>' : '') +
      reportHtml +
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
