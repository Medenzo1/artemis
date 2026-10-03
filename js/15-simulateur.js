// ════════════════════════════════════════════
//  SIMULATEUR DE RENTABILITÉ & FISCALITÉ IMMOBILIÈRE
//  Formulaire = onglet « ✏️ A COMPLÉTER » du classeur. Chaque champ alimente la même cellule
//  que dans Excel ; les calculs sont ceux du classeur (js/16 moteur + js/17 modèle).
// ════════════════════════════════════════════

const SIM_KEY = 'artemis_simulateur';
const SIM_SHEET_IN = '✏️ A COMPLÉTER';
const SIM_NO_RESALE = 'PAS DE REVENTE';

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
  fraisComptabiliteSociete: 1500,
  cga: 150,
  cfe: 150,

  // Foyer fiscal
  revenusNets: 0,
  situationPersonnelle: 'Célibataire ou Divorcé',
  nbEnfants: 0,
  impositionDividendes: 'FLAT TAX',

  // Revente
  valeurRevente: 0,
  dureeDetention: 15, // 1 à 25 ans, ou 'PAS DE REVENTE'

  // Options
  nbLots: 1,
  tauxVacance: 0.04,
  meubleTourisme: 'NON',
  tauxActualisation: 0.04,
  reglesFinancementPct: 0.7,
  dejaBienMeuble: 'NON',
  societeTVA: 'NON',
  pinelSurfaceUtile: 50,
  pinelDuree: 12,
  amortFraisAcquisition: 'NON',
};

// Exemple livré dans le classeur V4 — sert à vérifier que le site et Excel donnent les mêmes chiffres
const SIM_EXCEL_EXAMPLE = {
  prixBien: 130000, fraisAgence: 0, tauxNotaire: 0.08, fraisDossierBancaire: 500, fraisCourtier: 0,
  cautionHypotheque: 2200, travaux: 20000, mobilier: 3000, fraisConstitutionSociete: 1500,
  typeEmprunt: 'CLASSIQUE', dureeEmprunt: 20, dureeDiffereMois: 0, tauxEmprunt: 0.0145, tauxAssuranceEmprunt: 0.0025, apportPersonnel: 20000,
  loyerMeuble: 1450, chargesRecupMeuble: 50, loyerNu: 1500, chargesRecupNu: 50, modeLocationSociete: 'MEUBLE',
  chargesLocatives: 500, assurances: 250, taxeFonciere: 1500, entretien: 500, tauxGestionLocative: 0.05, fraisMiseEnLocation: 0,
  fraisBancaires: 15, fraisBancairesSociete: 25, fraisComptabilite: 900, fraisComptabiliteSociete: 1500, cga: 150, cfe: 150,
  revenusNets: 35000, situationPersonnelle: 'Marié ou Pacsé', nbEnfants: 2, impositionDividendes: 'FLAT TAX',
  valeurRevente: 180000, dureeDetention: 15,
  nbLots: 1, tauxVacance: 0.04, meubleTourisme: 'NON', tauxActualisation: 0.04, reglesFinancementPct: 0.7,
  dejaBienMeuble: 'NON', societeTVA: 'NON', pinelSurfaceUtile: 50, pinelDuree: 12, amortFraisAcquisition: 'NON',
};

// Champ du formulaire → cellule de l'onglet « ✏️ A COMPLÉTER »
const SIM_CELLS = {
  prixBien: 'E6', fraisAgence: 'E7', tauxNotaire: 'D8', fraisDossierBancaire: 'E9', fraisCourtier: 'E10',
  cautionHypotheque: 'E11', travaux: 'E12', mobilier: 'E13', fraisConstitutionSociete: 'E14',
  typeEmprunt: 'L6', dureeEmprunt: 'L7', dureeDiffereMois: 'L8', tauxEmprunt: 'P6', tauxAssuranceEmprunt: 'P7', apportPersonnel: 'P8',
  revenusNets: 'L11', nbEnfants: 'P11', situationPersonnelle: 'L12', impositionDividendes: 'L14',
  loyerMeuble: 'F17', loyerNu: 'G17', chargesRecupMeuble: 'F18', chargesRecupNu: 'G18', modeLocationSociete: 'H19',
  valeurRevente: 'L17', dureeDetention: 'L18',
  chargesLocatives: 'E22', assurances: 'E23', taxeFonciere: 'E24', entretien: 'E25', tauxGestionLocative: 'D26',
  fraisMiseEnLocation: 'E27', fraisBancaires: 'E28', fraisBancairesSociete: 'H28', fraisComptabilite: 'E29',
  fraisComptabiliteSociete: 'H29', cga: 'E30', cfe: 'E31',
  nbLots: 'L22', tauxVacance: 'P22', meubleTourisme: 'L23', tauxActualisation: 'P23', reglesFinancementPct: 'P24',
  dejaBienMeuble: 'L25', societeTVA: 'L26', pinelSurfaceUtile: 'L28', pinelDuree: 'L29', amortFraisAcquisition: 'L31',
};

// Champs stockés en fraction (0.08) mais affichés/saisis en % (8)
const SIM_PCT_FIELDS = ['tauxNotaire','tauxEmprunt','tauxAssuranceEmprunt','tauxGestionLocative','tauxVacance','tauxActualisation','reglesFinancementPct'];

// Anciennes simulations (avant l'alignement sur le classeur) → format actuel
function simMigrateInputs(i) {
  const o = Object.assign(JSON.parse(JSON.stringify(SIM_DEFAULT_INPUTS)), i || {});
  if (o.revendreLeBien === 'NON') o.dureeDetention = SIM_NO_RESALE;
  delete o.revendreLeBien;
  if (o.dureeDetention !== SIM_NO_RESALE) {
    o.dureeDetention = Math.min(25, Math.max(1, Math.round(+o.dureeDetention || 15)));
  }
  o.dureeEmprunt = Math.min(25, Math.max(0, Math.round(+o.dureeEmprunt || 0)));
  return o;
}

function getSimData() {
  try {
    const stored = JSON.parse(localStorage.getItem(SIM_KEY) || 'null');
    if (!stored) return { scenarios: [], draft: simMigrateInputs({}) };
    stored.draft = simMigrateInputs(stored.draft);
    if (!stored.scenarios) stored.scenarios = [];
    return stored;
  } catch (e) { return { scenarios: [], draft: simMigrateInputs({}) }; }
}
function saveSimData(data) { localStorage.setItem(SIM_KEY, JSON.stringify(data)); }
function saveSimDraft(inputs) { const d = getSimData(); d.draft = inputs; saveSimData(d); }

// ── Calcul : on écrit les saisies dans les cellules du classeur, le moteur fait le reste ──
let _simWB = null;
function simWorkbook() {
  if (!_simWB) _simWB = new SimXL.Workbook(SIM_MODEL);
  return _simWB;
}
function simCellValue(k, v) {
  if (k === 'modeLocationSociete') return v === 'NU' ? 'LOCATION NUE' : 'LOCATION MEUBLÉE';
  if (k === 'dureeDetention') return v === SIM_NO_RESALE ? SIM_NO_RESALE : (+v || 0);
  if (k === 'dureeDiffereMois') return +v ? +v : null; // « laisser vide » pour un emprunt classique
  if (typeof SIM_DEFAULT_INPUTS[k] === 'string') return v;
  return +v || 0;
}
function simCompute(inputs) {
  const wb = simWorkbook();
  Object.keys(SIM_CELLS).forEach(k => wb.set(SIM_SHEET_IN, SIM_CELLS[k], simCellValue(k, inputs[k])));
  return wb;
}

// ── Navigation écran ──
async function showSimulateur() {
  const ss = document.getElementById('simulateurScreen');
  const hs = document.getElementById('homeScreen');
  if (hs) hs.style.display = 'none';
  if (ss) { ss.style.display = 'block'; ss.scrollTop = 0; }
  window.scrollTo(0, 0);
  try { await simEnsureModel(); } catch (e) { console.error('[simulateur] modèle illisible', e); SIM_MODEL = null; }
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
  const ss = document.getElementById('simulateurScreen');
  if (ss) ss.scrollTop = 0;
  if (!SIM_MODEL && view !== 'scenarios') { simRenderNoModel(); return; }
  if (view === 'form') simRenderForm();
  else if (view === 'results') simRenderResults();
}

function simGetFormInputs() { return getSimData().draft; }

// ── Champs ──
function simPctVal(v) { return Math.round(v * 100000) / 1000; }

function simField(id, label, value, opts) {
  opts = opts || {};
  const type = opts.type || 'number';
  const suffix = opts.suffix || '';
  const help = opts.help ? '<span class="sim-help" tabindex="0" title="' + escHtml(opts.help) + '" aria-label="' + escHtml(opts.help) + '">' + icon('info', {size:12}) + '</span>' : '';
  let inputHtml;
  if (type === 'select') {
    inputHtml = '<select id="sim-f-' + id + '" onchange="simOnFieldChange(\'' + id + '\',this)">' +
      opts.options.map(o => '<option value="' + o.v + '"' + (String(value) === String(o.v) ? ' selected' : '') + '>' + o.l + '</option>').join('') + '</select>';
  } else {
    inputHtml = '<input type="text" inputmode="decimal" id="sim-f-' + id + '" value="' + simFmtInput(value) + '" oninput="simOnFieldChange(\'' + id + '\',this)" autocomplete="off">';
  }
  return '<div class="sim-field' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.hidden ? ' style="display:none"' : '') + ' data-field="' + id + '">' +
    '<label class="lbl" for="sim-f-' + id + '">' + label + help + '</label>' +
    '<div class="' + (suffix ? 'sim-suffix-wrap' : '') + '">' + inputHtml + (suffix ? '<span class="sim-suffix">' + suffix + '</span>' : '') + '</div>' +
    (opts.calc ? '<div class="sim-calc" id="sim-calc-' + id + '"></div>' : '') +
  '</div>';
}
function simFmtInput(v) {
  if (v === 0) return '0';
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace('.', ',');
}

let _simApercuTimer = null;
function simOnFieldChange(id, el) {
  const inputs = simGetFormInputs();
  const def = SIM_DEFAULT_INPUTS[id];
  let v = el.value;
  if (el.tagName === 'SELECT') {
    if (typeof def === 'number' && v !== SIM_NO_RESALE) v = +v;
  } else {
    v = v.replace(/[\s  ]/g, '').replace(',', '.');
    v = v === '' ? 0 : parseFloat(v);
    if (isNaN(v)) v = 0;
    if (SIM_PCT_FIELDS.includes(id)) v = v / 100;
  }
  inputs[id] = v;
  saveSimDraft(inputs);
  if (id === 'typeEmprunt' || id === 'dureeDetention' || id === 'dureeEmprunt') simSyncConditionalFields(inputs);
  clearTimeout(_simApercuTimer);
  _simApercuTimer = setTimeout(() => simRefreshApercu(inputs), 120);
}

function simSyncConditionalFields(i) {
  const show = (f, on) => { const el = document.querySelector('.sim-field[data-field="' + f + '"]'); if (el) el.style.display = on ? '' : 'none'; };
  show('dureeDiffereMois', String(i.typeEmprunt).startsWith('DIFFÉRÉ') && +i.dureeEmprunt > 0);
  show('valeurRevente', i.dureeDetention !== SIM_NO_RESALE);
}

function simSectionHeader(iconName, title, color) {
  color = color || '#34d399';
  return '<div class="sim-card-title sim-sec-title">' +
    '<span class="sim-sec-ico" style="background:' + color + '1a;color:' + color + '">' + icon(iconName, {size:16}) + '</span>' + title + '</div>';
}

const SIM_YN = [{v:'NON',l:'Non'},{v:'OUI',l:'Oui'}];

function simRenderForm() {
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  if (!el) return;
  const i = simGetFormInputs();
  const differe = String(i.typeEmprunt).startsWith('DIFFÉRÉ') && +i.dureeEmprunt > 0;
  const revente = i.dureeDetention !== SIM_NO_RESALE;

  actions.innerHTML =
    '<button class="btn btn-outline" onclick="simOpenScenarios()">' + icon('folder-open',{size:13}) + ' Mes simulations</button>' +
    '<button class="btn btn-green" onclick="simCalculer()">Calculer →</button>';

  const pct = (k) => simPctVal(i[k]);
  const years = (from, to) => Array.from({ length: to - from + 1 }, (_, k) => ({ v: from + k, l: (from + k) + ' an' + (from + k > 1 ? 's' : '') }));

  el.innerHTML =
    '<div class="sim-head">' +
      '<div>' +
        '<h1 class="sim-h1">Simulateur de rentabilité immobilière</h1>' +
        '<div class="sim-sub">9 régimes fiscaux comparés (LMNP, LMP, revenus fonciers, Pinel, société à l\'IS), avec les formules du classeur <b>' + escHtml(SIM_MODEL_INFO ? SIM_MODEL_INFO.name : '') + '</b>' +
          (SIM_MODEL_INFO && SIM_MODEL_INFO.importedAt ? ' (importé le ' + new Date(SIM_MODEL_INFO.importedAt).toLocaleDateString('fr-FR') + ')' : '') +
          ' · <a href="#" class="sim-link" onclick="simToggleImport();return false">Remplacer</a></div>' +
      '</div>' +
      '<button class="btn btn-outline sim-example-btn" onclick="simLoadExcelExample()" title="Remplit le formulaire avec l\'exemple livré dans le classeur V4">' + icon('file-spreadsheet',{size:13}) + ' Exemple du classeur</button>' +
    '</div>' +
    '<div id="sim-import-slot"></div>' +
    '<div class="sim-layout">' +
    '<div class="sim-form">' +

    '<div class="sim-card">' + simSectionHeader('home', "Coût d'acquisition du bien", '#4f9eff') + '<div class="sim-grid">' +
      simField('prixBien', "Prix du bien (hors frais d'agence)", i.prixBien, {suffix:'€'}) +
      simField('fraisAgence', "Frais d'agence", i.fraisAgence, {suffix:'€'}) +
      simField('tauxNotaire', 'Frais de notaire', pct('tauxNotaire'), {suffix:'%', calc:true}) +
      simField('fraisDossierBancaire', 'Frais de dossier bancaire', i.fraisDossierBancaire, {suffix:'€'}) +
      simField('fraisCourtier', 'Frais de courtier', i.fraisCourtier, {suffix:'€'}) +
      simField('cautionHypotheque', 'Caution bancaire / hypothèque', i.cautionHypotheque, {suffix:'€', help:'Crédit Logement ou hypothèque.'}) +
      simField('travaux', 'Travaux & équipements', i.travaux, {suffix:'€', help:"En location nue, les travaux d'agrandissement ne sont pas déductibles des revenus fonciers."}) +
      simField('mobilier', 'Mobilier', i.mobilier, {suffix:'€', help:'Location meublée, et société en location meublée. Ignoré en location nue.'}) +
      simField('fraisConstitutionSociete', 'Frais de constitution de société', i.fraisConstitutionSociete, {suffix:'€', help:'Uniquement pour les régimes en société à l\'IS.'}) +
    '</div></div>' +

    '<div class="sim-card">' + simSectionHeader('landmark', 'Financement & apport', '#9b6ef3') + '<div class="sim-grid">' +
      simField('typeEmprunt', "Type d'emprunt", i.typeEmprunt, {type:'select', options:[
        {v:'CLASSIQUE',l:'Classique'},{v:'DIFFÉRÉ PARTIEL',l:'Différé partiel'},{v:'DIFFÉRÉ TOTAL',l:'Différé total'},{v:'IN FINE',l:'In fine'}
      ]}) +
      simField('dureeEmprunt', "Durée de l'emprunt", i.dureeEmprunt, {type:'select', options:[{v:0,l:'Sans emprunt'}].concat(years(1, 25))}) +
      simField('dureeDiffereMois', 'Durée du différé', i.dureeDiffereMois, {suffix:'mois', hidden:!differe}) +
      simField('tauxEmprunt', "Taux de l'emprunt", pct('tauxEmprunt'), {suffix:'%'}) +
      simField('tauxAssuranceEmprunt', 'Taux assurance emprunteur', pct('tauxAssuranceEmprunt'), {suffix:'%'}) +
      simField('apportPersonnel', 'Apport personnel', i.apportPersonnel, {suffix:'€'}) +
    '</div></div>' +

    '<div class="sim-card">' + simSectionHeader('banknote', 'Produits mensuels', '#34d399') + '<div class="sim-grid">' +
      simField('loyerMeuble', 'Loyer hors charges — meublé', i.loyerMeuble, {suffix:'€', help:'Un meublé se loue en général 5 à 30 % plus cher que la location nue.'}) +
      simField('chargesRecupMeuble', 'Charges récupérables — meublé', i.chargesRecupMeuble, {suffix:'€'}) +
      simField('loyerNu', 'Loyer hors charges — nu', i.loyerNu, {suffix:'€'}) +
      simField('chargesRecupNu', 'Charges récupérables — nu', i.chargesRecupNu, {suffix:'€'}) +
      simField('modeLocationSociete', 'Location en société', i.modeLocationSociete, {type:'select', options:[
        {v:'MEUBLE',l:'Location meublée'},{v:'NU',l:'Location nue'}
      ], help:'Détermine le loyer, les charges et le mobilier retenus pour les régimes en société.'}) +
    '</div></div>' +

    '<div class="sim-card">' + simSectionHeader('clipboard-list', 'Charges annuelles', '#ff9142') + '<div class="sim-grid">' +
      simField('chargesLocatives', 'Charges locatives', i.chargesLocatives, {suffix:'€', help:'Copropriété et énergie (eau, électricité, gaz), refacturables ou non.'}) +
      simField('assurances', 'Assurances (PNO, GLI…)', i.assurances, {suffix:'€'}) +
      simField('taxeFonciere', 'Taxe foncière', i.taxeFonciere, {suffix:'€'}) +
      simField('entretien', 'Entretien & réparations', i.entretien, {suffix:'€'}) +
      simField('tauxGestionLocative', 'Gestion locative', pct('tauxGestionLocative'), {suffix:'% des loyers', calc:true}) +
      simField('fraisMiseEnLocation', 'Frais de mise en location', i.fraisMiseEnLocation, {suffix:'€'}) +
      simField('fraisBancaires', 'Frais bancaires (meublé / nu)', i.fraisBancaires, {suffix:'€'}) +
      simField('fraisBancairesSociete', 'Frais bancaires (société)', i.fraisBancairesSociete, {suffix:'€'}) +
      simField('fraisComptabilite', 'Comptabilité (meublé)', i.fraisComptabilite, {suffix:'€'}) +
      simField('fraisComptabiliteSociete', 'Comptabilité (société)', i.fraisComptabiliteSociete, {suffix:'€'}) +
      simField('cga', 'CGA (meublé)', i.cga, {suffix:'€'}) +
      simField('cfe', 'CFE', i.cfe, {suffix:'€', help:'Location meublée et société uniquement.', calc:true}) +
    '</div></div>' +

    '<div class="sim-card">' + simSectionHeader('users', 'Foyer fiscal', '#f472b6') + '<div class="sim-grid">' +
      simField('revenusNets', 'Revenus nets imposables du foyer', i.revenusNets, {suffix:'€', help:'Après abattement de 10 % ou déduction des frais réels.'}) +
      simField('situationPersonnelle', 'Situation personnelle', i.situationPersonnelle, {type:'select', options:[
        {v:'Célibataire ou Divorcé',l:'Célibataire ou divorcé'},{v:'Marié ou Pacsé',l:'Marié ou pacsé'}
      ]}) +
      simField('nbEnfants', "Nombre d'enfants", i.nbEnfants, {calc:true}) +
      simField('impositionDividendes', 'Imposition des dividendes', i.impositionDividendes, {type:'select', options:[
        {v:'FLAT TAX',l:'Flat tax (PFU)'},{v:'BARÈME PROGRESSIF',l:'Barème progressif'}
      ]}) +
    '</div></div>' +

    '<div class="sim-card">' + simSectionHeader('key', 'Revente du bien', '#f5b731') + '<div class="sim-grid">' +
      simField('dureeDetention', 'Durée de détention', i.dureeDetention, {help:'Sans revente, la simulation porte sur la durée du crédit (25 ans sans crédit).', type:'select', options:years(1, 25).concat([{v:SIM_NO_RESALE,l:'Pas de revente'}])}) +
      simField('valeurRevente', 'Valeur du bien à la revente', i.valeurRevente, {suffix:'€', hidden:!revente, help:'Au minimum le prix d\'achat. Laissée à 0, le prix d\'achat est retenu.'}) +
    '</div></div>' +

    '<div class="sim-card">' + simSectionHeader('settings', 'Options & réglages', '#22d3c8') + '<div class="sim-grid">' +
      simField('nbLots', 'Nombre de lots', i.nbLots) +
      simField('tauxVacance', 'Vacance locative', pct('tauxVacance'), {suffix:'%', help:'4 % ≈ un mois sans locataire tous les deux ans.'}) +
      simField('meubleTourisme', 'Meublé de tourisme', i.meubleTourisme, {type:'select', options:SIM_YN}) +
      simField('tauxActualisation', 'Taux d\'actualisation (VAN, TRI)', pct('tauxActualisation'), {suffix:'%'}) +
      simField('reglesFinancementPct', 'Règle de financement bancaire', pct('reglesFinancementPct'), {suffix:'%', help:'Part des loyers qui doit couvrir la mensualité (70 % en général).'}) +
      simField('dejaBienMeuble', 'Déjà un bien en meublé ?', i.dejaBienMeuble, {type:'select', options:SIM_YN, help:'Sans bien meublé existant, pas de CFE la première année.'}) +
      simField('societeTVA', 'Société soumise à TVA ?', i.societeTVA, {type:'select', options:SIM_YN, help:'Pas de CRL si la société est soumise à TVA.', calc:true}) +
      simField('amortFraisAcquisition', "Amortir les frais d'acquisition", i.amortFraisAcquisition, {type:'select', options:SIM_YN, help:'Oui : les frais sont immobilisés et amortis. Non : ils sont déduits en charges la première année.'}) +
      simField('pinelSurfaceUtile', 'Pinel — surface utile', i.pinelSurfaceUtile, {suffix:'m²'}) +
      simField('pinelDuree', "Pinel — durée d'engagement", i.pinelDuree, {type:'select', options:[{v:6,l:'6 ans'},{v:9,l:'9 ans'},{v:12,l:'12 ans'}]}) +
    '</div></div>' +

    '<div class="sim-form-actions">' +
      '<button class="btn btn-outline" onclick="simSaveScenarioPrompt()">' + icon('save',{size:13}) + ' Enregistrer cette simulation</button>' +
      '<button class="btn btn-green" onclick="simCalculer()">Calculer →</button>' +
    '</div>' +

    '</div>' + // .sim-form

    '<aside class="sim-apercu-wrap"><div id="sim-apercu"></div></aside>' +
    '</div>';

  simRefreshApercu(i);
}

// Aucun classeur importé : on ne peut rien calculer, on propose l'import
function simRenderNoModel() {
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  if (!el) return;
  actions.innerHTML = '';
  el.innerHTML = '<div class="sim-head"><div><h1 class="sim-h1">Simulateur de rentabilité immobilière</h1>' +
    '<div class="sim-sub">9 régimes fiscaux comparés (LMNP, LMP, revenus fonciers, Pinel, société à l\'IS), calculés avec les formules de votre classeur Excel.</div></div></div>' +
    simImportCard(false);
}

function simToggleImport() {
  const box = document.getElementById('sim-import-slot');
  if (box) box.innerHTML = box.innerHTML ? '' : simImportCard(true);
}

function simLoadExcelExample() {
  const d = getSimData();
  d.draft = simMigrateInputs(SIM_EXCEL_EXAMPLE);
  saveSimData(d);
  simRenderForm();
  simToast("Exemple du classeur chargé : comparez avec l'onglet « 💰 SYNTHÈSE » d'Excel.");
}

// ── Valeurs calculées sous les champs + panneau « Aperçu » (lus dans le classeur) ──
const simV = (wb, sheet, a) => { const v = wb.get(sheet, a); return typeof v === 'number' ? v : 0; };

function simRefreshApercu(inputs) {
  const el = document.getElementById('sim-apercu');
  if (!el) return;
  const i = inputs || simGetFormInputs();
  let wb;
  try { wb = simCompute(i); } catch (e) { console.error('[simulateur]', e); el.innerHTML = ''; return; }
  const IN = SIM_SHEET_IN, LMNP = '✔️ LMNP - BIC RÉEL';

  const setCalc = (id, html) => { const c = document.getElementById('sim-calc-' + id); if (c) c.innerHTML = html; };
  setCalc('tauxNotaire', '= ' + simFmtEURCompact(simV(wb, IN, 'E8')));
  setCalc('tauxGestionLocative', 'Meublé ' + simFmtEURCompact(simV(wb, IN, 'F26')) + ' · Nu ' + simFmtEURCompact(simV(wb, IN, 'G26')) + ' · Société ' + simFmtEURCompact(simV(wb, IN, 'H26')) + ' / an');
  setCalc('nbEnfants', simFmtNum(simV(wb, IN, 'P12'), 1) + ' part' + (simV(wb, IN, 'P12') > 1 ? 's' : '') + ' fiscale' + (simV(wb, IN, 'P12') > 1 ? 's' : ''));
  const crl = wb.get(IN, 'E32');
  setCalc('societeTVA', 'CRL société : ' + (typeof crl === 'number' ? simFmtEURCompact(crl) + ' / an' : String(crl)));

  const cout = simV(wb, LMNP, 'C3');
  const emprunt = +i.dureeEmprunt > 0 ? simV(wb, LMNP, 'P5') : 0;
  const mensualite = +i.dureeEmprunt > 0 ? simV(wb, '🔎 EMPRUNT', 'C14') / 12 : 0;
  const loyers = simV(wb, LMNP, 'G4');
  const regle = wb.get(LMNP, 'AB6');
  const apport = +i.apportPersonnel || 0;
  const pctApport = cout > 0 ? Math.max(0, Math.min(100, apport / cout * 100)) : 0;

  // Meilleur régime possible, d'après la synthèse du classeur
  let best = null;
  if (+i.prixBien > 0) {
    simRegimeRows(wb, i).forEach(r => {
      if (r.impossible || typeof r.cf !== 'number') return;
      if (!best || r.cf > best.cf) best = r;
    });
  }
  const regleCol = regle === 'OUI' ? '#34d399' : regle === 'NON' ? '#f0566a' : 'var(--text2)';

  el.innerHTML =
    '<div class="sim-card sim-apercu">' +
      '<div class="sim-ap-title">' + icon('gauge',{size:13}) + ' Aperçu du projet</div>' +
      '<div class="sim-ap-block">' +
        '<div class="sim-ap-lbl">Coût total du projet (meublé)</div>' +
        '<div class="sim-ap-big">' + simFmtEURCompact(cout) + '</div>' +
        (cout > 0 ? '<div class="sim-ap-split"><span style="width:' + pctApport + '%"></span></div>' +
          '<div class="sim-ap-legend"><span><i style="background:#34d399"></i>Apport ' + simFmtEURCompact(apport) + '</span><span><i style="background:#9b6ef3"></i>Emprunt ' + simFmtEURCompact(emprunt) + '</span></div>' : '') +
      '</div>' +
      '<div class="sim-ap-grid">' +
        '<div><div class="sim-ap-lbl">Loyers / an (meublé)</div><div class="sim-ap-val">' + simFmtEURCompact(loyers) + '</div></div>' +
        '<div><div class="sim-ap-lbl">Mensualité</div><div class="sim-ap-val">' + simFmtEURCompact(mensualite) + '</div></div>' +
      '</div>' +
      '<div class="sim-ap-row"><span>Règle des ' + Math.round((+i.reglesFinancementPct || 0) * 100) + ' % respectée ?</span><b style="color:' + regleCol + '">' + (regle === 'NS' ? 'Sans objet' : escHtml(String(regle))) + '</b></div>' +
      (best ?
        '<div class="sim-ap-best">' +
          '<div class="sim-ap-lbl">Meilleur cash-flow cumulé</div>' +
          '<div class="sim-ap-best-name">' + escHtml(best.label) + '</div>' +
          '<div class="sim-ap-best-val">' + simFmtEURCompact(best.cf) + '</div>' +
        '</div>' : '') +
    '</div>';
}

function simFmtEURCompact(n) {
  n = n || 0;
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s + ' €';
}
function simFmtNum(n, dec) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

function simToast(msg) {
  if (typeof showToast === 'function') showToast(msg);
  else alert(msg);
}

function simCalculer() {
  const inputs = simGetFormInputs();
  if (!inputs.prixBien || inputs.prixBien <= 0) {
    simToast('Renseignez au moins le prix du bien avant de calculer.');
    return;
  }
  try {
    simCompute(inputs);
    SIM_LAST_RESULTS = { inputs: JSON.parse(JSON.stringify(inputs)) };
  } catch (e) {
    console.error('[simulateur]', e);
    simToast('Erreur de calcul : ' + e.message);
    return;
  }
  SIM_DETAIL_REGIME = null;
  simShowView('results');
}

// ── Sauvegarde / chargement de scénarios nommés ──
function simSaveScenarioPrompt() {
  const name = prompt('Nom de cette simulation :', 'Simulation ' + new Date().toLocaleDateString('fr-FR'));
  if (!name) return;
  const d = getSimData();
  d.scenarios.push({ id: 'sim_' + Date.now(), name: name, createdAt: Date.now(), inputs: JSON.parse(JSON.stringify(d.draft)) });
  saveSimData(d);
  simToast('Simulation enregistrée.');
}

function simOpenScenarios() {
  const d = getSimData();
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  actions.innerHTML = '<button class="btn btn-outline" onclick="simShowView(\'form\')">← Retour au formulaire</button>';
  if (!d.scenarios.length) {
    el.innerHTML = '<div class="sim-empty">Aucune simulation enregistrée pour le moment.</div>';
    return;
  }
  el.innerHTML = '<h1 class="sim-h1" style="margin-bottom:18px">Mes simulations</h1>' +
    '<div class="grid3" style="gap:14px">' +
    d.scenarios.slice().reverse().map(s =>
      '<div class="sim-regime-card">' +
        '<div style="font-weight:700;color:#eaf0ff;margin-bottom:6px">' + escHtml(s.name) + '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-bottom:12px">' + new Date(s.createdAt).toLocaleDateString('fr-FR') + ' · ' + simFmtEURCompact(s.inputs.prixBien) + '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-outline" style="flex:1;font-size:11px;padding:7px 10px" onclick="simLoadScenario(\'' + s.id + '\')">Charger</button>' +
          '<button class="btn btn-red" style="font-size:11px;padding:7px 10px" onclick="simDeleteScenario(\'' + s.id + '\')" aria-label="Supprimer">' + icon('trash-2',{size:12}) + '</button>' +
        '</div></div>'
    ).join('') +
    '</div>';
}

function simLoadScenario(id) {
  const d = getSimData();
  const s = d.scenarios.find(x => x.id === id);
  if (!s) return;
  d.draft = simMigrateInputs(s.inputs);
  saveSimData(d);
  simShowView('form');
}

function simDeleteScenario(id) {
  if (!confirm('Supprimer cette simulation ?')) return;
  const d = getSimData();
  d.scenarios = d.scenarios.filter(x => x.id !== id);
  saveSimData(d);
  simOpenScenarios();
}
