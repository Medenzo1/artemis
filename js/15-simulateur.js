// ════════════════════════════════════════════
//  SIMULATEUR DE RENTABILITÉ & FISCALITÉ IMMOBILIÈRE
//  Écran + formulaire de saisie (équivalent "A COMPLÉTER")
// ════════════════════════════════════════════

const SIM_KEY = 'artemis_simulateur';

const SIM_DEFAULT_INPUTS = {
  // Coût d'acquisition
  prixBien: 0,
  fraisAgence: 0,
  tauxNotaire: 0.08,
  fraisDossierBancaire: 500,
  fraisCourtier: 0,
  cautionHypotheque: 0,
  travaux: 0,
  mobilier: 0,
  fraisConstitutionSociete: 1500,

  // Financement
  typeEmprunt: 'CLASSIQUE',
  tauxEmprunt: 0.0145,
  dureeEmprunt: 20,
  dureeDiffereMois: 0,
  tauxAssuranceEmprunt: 0.0025,
  apportPersonnel: 0,

  // Produits mensuels
  loyerMeuble: 0,
  loyerNu: 0,
  chargesRecupMeuble: 0,
  chargesRecupNu: 0,
  modeLocationSociete: 'MEUBLE', // 'MEUBLE' | 'NU'

  // Charges annuelles
  chargesLocatives: 0,
  assurances: 0,
  taxeFonciere: 0,
  entretien: 0,
  tauxGestionLocative: 0.05,
  fraisMiseEnLocation: 0,
  fraisBancaires: 15,
  fraisBancairesSociete: 25,
  fraisComptabilite: 900,
  cga: 150,
  cfe: 150,

  // Foyer fiscal
  revenusNets: 0,
  situationPersonnelle: 'Célibataire ou Divorcé', // ou 'Marié ou Pacsé'
  nbEnfants: 0,
  impositionDividendes: 'FLAT TAX', // ou 'BARÈME PROGRESSIF'

  // Revente
  valeurRevente: 0,
  dureeDetention: 15,

  // Options
  nbLots: 1,
  tauxVacance: 0.04,
  meubleTourisme: 'NON',
  tauxActualisation: 0.04,
  reglesFinancementPct: 0.7,
  dejaBienMeuble: 'NON',
  societeTVA: 'NON',
  pinelSurfaceUtile: 0,
  pinelDuree: 6,
  amortFraisAcquisition: 'NON',
};

function getSimData() {
  try {
    const stored = JSON.parse(localStorage.getItem(SIM_KEY) || 'null');
    if (!stored) return { scenarios: [], draft: JSON.parse(JSON.stringify(SIM_DEFAULT_INPUTS)) };
    if (!stored.draft) stored.draft = JSON.parse(JSON.stringify(SIM_DEFAULT_INPUTS));
    if (!stored.scenarios) stored.scenarios = [];
    // Complète les clés manquantes si le schéma a évolué
    stored.draft = Object.assign(JSON.parse(JSON.stringify(SIM_DEFAULT_INPUTS)), stored.draft);
    return stored;
  } catch(e) { return { scenarios: [], draft: JSON.parse(JSON.stringify(SIM_DEFAULT_INPUTS)) }; }
}
function saveSimData(data) { localStorage.setItem(SIM_KEY, JSON.stringify(data)); }
function saveSimDraft(inputs) { const d = getSimData(); d.draft = inputs; saveSimData(d); }

// ── Navigation écran ──
function showSimulateur() {
  const ss = document.getElementById('simulateurScreen');
  const hs = document.getElementById('homeScreen');
  if (hs) hs.style.display = 'none';
  if (ss) ss.style.display = 'block';
  window.scrollTo(0, 0);
  simShowView('form');
}
function exitSimulateur() {
  const ss = document.getElementById('simulateurScreen');
  if (ss) ss.style.display = 'none';
  showHome();
}

let SIM_CURRENT_VIEW = 'form';
let SIM_LAST_RESULTS = null;

function simShowView(view) {
  SIM_CURRENT_VIEW = view;
  if (view === 'form') simRenderForm();
  else if (view === 'results') simRenderResults();
}

function simGetFormInputs() {
  const d = getSimData();
  return d.draft;
}

function simField(id, label, value, opts) {
  opts = opts || {};
  const type = opts.type || 'number';
  const suffix = opts.suffix || '';
  const step = opts.step || (type === 'number' ? 'any' : undefined);
  let inputHtml;
  if (type === 'select') {
    inputHtml = '<select id="' + id + '" onchange="simOnFieldChange(\'' + id + '\',this)">' +
      opts.options.map(function(o) {
        return '<option value="' + o.v + '"' + (String(value) === String(o.v) ? ' selected' : '') + '>' + o.l + '</option>';
      }).join('') + '</select>';
  } else {
    inputHtml = '<input type="' + type + '" id="' + id + '" value="' + (value === 0 ? 0 : (value || '')) + '"' +
      (step ? ' step="' + step + '"' : '') +
      ' oninput="simOnFieldChange(\'' + id + '\',this)">';
  }
  const wrapClass = suffix ? 'sim-suffix-wrap' : '';
  return '<div><label class="lbl">' + label + '</label><div class="' + wrapClass + '">' + inputHtml +
    (suffix ? '<span class="sim-suffix">' + suffix + '</span>' : '') + '</div></div>';
}

function simOnFieldChange(id, el) {
  const inputs = simGetFormInputs();
  const def = SIM_DEFAULT_INPUTS[id];
  let v = el.value;
  if (el.tagName === 'SELECT' || typeof def === 'string') {
    // valeur texte
  } else {
    v = v === '' ? 0 : parseFloat(v.replace(',', '.'));
    if (isNaN(v)) v = 0;
    // Champs stockés en fraction (taux) mais saisis en %
    if (SIM_PCT_FIELDS.includes(id)) v = v / 100;
  }
  inputs[id] = v;
  saveSimDraft(inputs);
}

// Champs stockés en fraction (0.08) mais affichés/saisis en % (8) dans le formulaire
const SIM_PCT_FIELDS = ['tauxNotaire','tauxEmprunt','tauxAssuranceEmprunt','tauxGestionLocative','tauxVacance','tauxActualisation','reglesFinancementPct'];

function simPctVal(v) { return Math.round(v * 10000) / 100; }

function simRenderForm() {
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  if (!el) return;
  const i = simGetFormInputs();

  actions.innerHTML = '<button class="btn btn-outline" onclick="simOpenScenarios()">📂 Mes simulations</button>' +
    '<button class="btn btn-green" onclick="simCalculer()">Calculer →</button>';

  el.innerHTML =
    '<div style="margin-bottom:24px">' +
      '<div style="font-size:22px;font-weight:700;color:#eaf0ff;margin-bottom:4px">Simulateur de rentabilité immobilière</div>' +
      '<div style="font-size:12px;color:var(--text2)">Renseignez votre projet, puis comparez automatiquement 9 régimes fiscaux (LMNP, LMP, revenus fonciers, Pinel, société à l\'IS...)</div>' +
    '</div>' +
    '<div class="sim-form" style="display:flex;flex-direction:column;gap:18px">' +

    // Coût d'acquisition
    '<div class="sim-card"><div class="sim-card-title">🏠 Coût d\'acquisition du bien</div><div class="grid3" style="gap:14px">' +
      simField('prixBien', "Prix du bien (hors frais d'agence)", i.prixBien, {suffix:'€'}) +
      simField('fraisAgence', "Frais d'agence", i.fraisAgence, {suffix:'€'}) +
      simField('tauxNotaire', 'Frais de notaire', simPctVal(i.tauxNotaire), {suffix:'%'}) +
      simField('fraisDossierBancaire', 'Frais de dossier bancaire', i.fraisDossierBancaire, {suffix:'€'}) +
      simField('fraisCourtier', 'Frais de courtier', i.fraisCourtier, {suffix:'€'}) +
      simField('cautionHypotheque', 'Caution bancaire / hypothèque', i.cautionHypotheque, {suffix:'€'}) +
      simField('travaux', 'Travaux & équipements', i.travaux, {suffix:'€'}) +
      simField('mobilier', 'Mobilier', i.mobilier, {suffix:'€'}) +
      simField('fraisConstitutionSociete', 'Frais de constitution de société', i.fraisConstitutionSociete, {suffix:'€'}) +
    '</div></div>' +

    // Financement
    '<div class="sim-card"><div class="sim-card-title">🏦 Financement & apport</div><div class="grid3" style="gap:14px">' +
      simField('typeEmprunt', 'Type emprunt', i.typeEmprunt, {type:'select', options:[
        {v:'CLASSIQUE',l:'Classique'},{v:'DIFFÉRÉ PARTIEL',l:'Différé partiel'},{v:'DIFFÉRÉ TOTAL',l:'Différé total'},{v:'IN FINE',l:'In fine'}
      ]}) +
      simField('dureeEmprunt', "Durée emprunt (années)", i.dureeEmprunt) +
      simField('dureeDiffereMois', 'Durée du différé (mois)', i.dureeDiffereMois) +
      simField('tauxEmprunt', 'Taux emprunt', simPctVal(i.tauxEmprunt), {suffix:'%'}) +
      simField('tauxAssuranceEmprunt', 'Taux assurance emprunteur', simPctVal(i.tauxAssuranceEmprunt), {suffix:'%'}) +
      simField('apportPersonnel', 'Apport personnel', i.apportPersonnel, {suffix:'€'}) +
    '</div></div>' +

    // Produits mensuels
    '<div class="sim-card"><div class="sim-card-title">💶 Produits mensuels</div><div class="grid3" style="gap:14px">' +
      simField('loyerMeuble', 'Loyer mensuel — location meublée', i.loyerMeuble, {suffix:'€'}) +
      simField('chargesRecupMeuble', 'Charges récupérables — meublée', i.chargesRecupMeuble, {suffix:'€'}) +
      simField('loyerNu', 'Loyer mensuel — location nue', i.loyerNu, {suffix:'€'}) +
      simField('chargesRecupNu', 'Charges récupérables — nue', i.chargesRecupNu, {suffix:'€'}) +
      simField('modeLocationSociete', 'Mode de location en société', i.modeLocationSociete, {type:'select', options:[
        {v:'MEUBLE',l:'Location meublée'},{v:'NU',l:'Location nue'}
      ]}) +
    '</div></div>' +

    // Charges annuelles
    '<div class="sim-card"><div class="sim-card-title">📋 Charges annuelles</div><div class="grid3" style="gap:14px">' +
      simField('chargesLocatives', 'Charges locatives', i.chargesLocatives, {suffix:'€'}) +
      simField('assurances', 'Assurances (PNO/immeuble/GLI...)', i.assurances, {suffix:'€'}) +
      simField('taxeFonciere', 'Taxe foncière', i.taxeFonciere, {suffix:'€'}) +
      simField('entretien', 'Entretien & réparation', i.entretien, {suffix:'€'}) +
      simField('tauxGestionLocative', 'Taux gestion locative', simPctVal(i.tauxGestionLocative), {suffix:'%'}) +
      simField('fraisMiseEnLocation', 'Frais de mise en location', i.fraisMiseEnLocation, {suffix:'€'}) +
      simField('fraisBancaires', 'Frais bancaires (perso)', i.fraisBancaires, {suffix:'€'}) +
      simField('fraisBancairesSociete', 'Frais bancaires (société)', i.fraisBancairesSociete, {suffix:'€'}) +
      simField('fraisComptabilite', 'Frais de comptabilité', i.fraisComptabilite, {suffix:'€'}) +
      simField('cga', 'CGA', i.cga, {suffix:'€'}) +
      simField('cfe', 'CFE (cotisation foncière entreprises)', i.cfe, {suffix:'€'}) +
    '</div></div>' +

    // Foyer fiscal
    '<div class="sim-card"><div class="sim-card-title">👪 Foyer fiscal</div><div class="grid3" style="gap:14px">' +
      simField('revenusNets', 'Revenus nets imposables du foyer', i.revenusNets, {suffix:'€'}) +
      simField('situationPersonnelle', 'Situation personnelle', i.situationPersonnelle, {type:'select', options:[
        {v:'Célibataire ou Divorcé',l:'Célibataire ou divorcé'},{v:'Marié ou Pacsé',l:'Marié ou pacsé'}
      ]}) +
      simField('nbEnfants', "Nombre d'enfants", i.nbEnfants) +
      simField('impositionDividendes', 'Imposition des dividendes', i.impositionDividendes, {type:'select', options:[
        {v:'FLAT TAX',l:'Flat tax (PFU 30%)'},{v:'BARÈME PROGRESSIF',l:'Barème progressif'}
      ]}) +
    '</div></div>' +

    // Revente
    '<div class="sim-card"><div class="sim-card-title">🔑 Revente du bien</div><div class="grid3" style="gap:14px">' +
      simField('valeurRevente', 'Valeur du bien à la revente', i.valeurRevente, {suffix:'€'}) +
      simField('dureeDetention', 'Durée de détention du bien (années)', i.dureeDetention) +
    '</div></div>' +

    // Options
    '<div class="sim-card"><div class="sim-card-title">⚙️ Options & réglages</div><div class="grid3" style="gap:14px">' +
      simField('nbLots', 'Nombre de lots sur ce projet', i.nbLots) +
      simField('tauxVacance', 'Taux de vacance locative', simPctVal(i.tauxVacance), {suffix:'%'}) +
      simField('tauxActualisation', 'Taux actualisation (VAN & TRI)', simPctVal(i.tauxActualisation), {suffix:'%'}) +
      simField('reglesFinancementPct', 'Financement bancaire — règle du...', simPctVal(i.reglesFinancementPct), {suffix:'%'}) +
      simField('meubleTourisme', 'Meublé de tourisme', i.meubleTourisme, {type:'select', options:[{v:'NON',l:'Non'},{v:'OUI',l:'Oui'}]}) +
      simField('dejaBienMeuble', 'Avez-vous déjà un bien en meublé ?', i.dejaBienMeuble, {type:'select', options:[{v:'NON',l:'Non'},{v:'OUI',l:'Oui'}]}) +
      simField('societeTVA', 'Votre société est soumise à TVA ?', i.societeTVA, {type:'select', options:[{v:'NON',l:'Non'},{v:'OUI',l:'Oui'}]}) +
      simField('amortFraisAcquisition', "Amortissement des frais d'acquisition", i.amortFraisAcquisition, {type:'select', options:[{v:'NON',l:'Non'},{v:'OUI',l:'Oui'}]}) +
      simField('pinelSurfaceUtile', 'Pinel — surface utile', i.pinelSurfaceUtile, {suffix:'m²'}) +
      simField('pinelDuree', 'Pinel — durée d\'engagement', i.pinelDuree, {type:'select', options:[{v:6,l:'6 ans'},{v:9,l:'9 ans'},{v:12,l:'12 ans'}]}) +
    '</div></div>' +

    '<div style="display:flex;justify-content:flex-end;gap:10px;padding-bottom:40px">' +
      '<button class="btn btn-outline" onclick="simSaveScenarioPrompt()">💾 Enregistrer cette simulation</button>' +
      '<button class="btn btn-green" onclick="simCalculer()">Calculer →</button>' +
    '</div>' +

    '</div>';
}

function simCalculer() {
  const inputs = simGetFormInputs();
  if (!inputs.prixBien || inputs.prixBien <= 0) {
    if (typeof showToast === 'function') showToast('Renseignez au moins le prix du bien avant de calculer.');
    else alert('Renseignez au moins le prix du bien avant de calculer.');
    return;
  }
  SIM_LAST_RESULTS = simRunAllRegimes(inputs);
  simShowView('results');
}

// ── Sauvegarde / chargement de scénarios nommés ──
function simSaveScenarioPrompt() {
  const name = prompt('Nom de cette simulation :', 'Simulation ' + new Date().toLocaleDateString('fr-FR'));
  if (!name) return;
  const d = getSimData();
  d.scenarios.push({ id: 'sim_' + Date.now(), name: name, createdAt: Date.now(), inputs: JSON.parse(JSON.stringify(d.draft)) });
  saveSimData(d);
  if (typeof showToast === 'function') showToast('Simulation enregistrée.');
}

function simOpenScenarios() {
  const d = getSimData();
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  actions.innerHTML = '<button class="btn btn-outline" onclick="simShowView(\'form\')">← Retour au formulaire</button>';
  if (!d.scenarios.length) {
    el.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text2)">Aucune simulation enregistrée pour le moment.</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:18px;font-weight:700;color:#eaf0ff;margin-bottom:18px">Mes simulations</div>' +
    '<div class="grid3" style="gap:14px">' +
    d.scenarios.slice().reverse().map(function(s) {
      return '<div class="sim-regime-card">' +
        '<div style="font-weight:700;color:#eaf0ff;margin-bottom:6px">' + s.name + '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-bottom:12px">' + new Date(s.createdAt).toLocaleDateString('fr-FR') + ' · ' + (s.inputs.prixBien||0).toLocaleString('fr-FR') + ' €</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-outline" style="flex:1;font-size:10px;padding:7px 10px" onclick="simLoadScenario(\'' + s.id + '\')">Charger</button>' +
          '<button class="btn btn-red" style="font-size:10px;padding:7px 10px" onclick="simDeleteScenario(\'' + s.id + '\')">✕</button>' +
        '</div></div>';
    }).join('') +
    '</div>';
}

function simLoadScenario(id) {
  const d = getSimData();
  const s = d.scenarios.find(function(x){ return x.id === id; });
  if (!s) return;
  d.draft = JSON.parse(JSON.stringify(s.inputs));
  saveSimData(d);
  simShowView('form');
}

function simDeleteScenario(id) {
  if (!confirm('Supprimer cette simulation ?')) return;
  const d = getSimData();
  d.scenarios = d.scenarios.filter(function(x){ return x.id !== id; });
  saveSimData(d);
  simOpenScenarios();
}
