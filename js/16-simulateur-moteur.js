// ════════════════════════════════════════════
//  SIMULATEUR — MOTEUR DE CALCUL PARTAGÉ
//  Emprunt · Amortissement comptable · IR (QF/plafonnement/décote)
//  Déficit foncier/BIC · Plus-value · VAN/TRI/DRCI
//  Horizon fixe de simulation : 25 ans (comme le classeur source)
// ════════════════════════════════════════════

const SIM_HORIZON = 25;

// ── Barème IR 2025 (revenus 2024) — ⚙️ PARAMÈTRES!B7:D11 ──
const SIM_BAREME_IR = [
  { bas: 0,      haut: 11497,  taux: 0 },
  { bas: 11497,  haut: 29315,  taux: 0.11 },
  { bas: 29315,  haut: 83823,  taux: 0.30 },
  { bas: 83823,  haut: 180294, taux: 0.41 },
  { bas: 180294, haut: Infinity, taux: 0.45 },
];

const SIM_PLAFOND_DEMI_PART = 1791; // ⚙️ PARAMÈTRES!I6
const SIM_DECOTE = {
  'Célibataire ou Divorcé': { seuil: 1964, forfait: 889,  taux: 0.4525 },
  'Marié ou Pacsé':         { seuil: 3249, forfait: 1470, taux: 0.4525 },
};

const SIM_TAUX_CSG_CRDS   = 0.172;  // ⚙️ PARAMÈTRES!M16
const SIM_TAUX_IR_PV      = 0.19;   // ⚙️ PARAMÈTRES!D21 — PV particuliers (RF/Pinel/LMNP)
const SIM_TAUX_IR_PV_LT_LMP = 0.128; // ⚙️ PARAMÈTRES!D24 — PV long terme LMP
const SIM_ABATT_FRAIS_ACQ_PV = 0.075; // ⚙️ PARAMÈTRES!D22
const SIM_ABATT_TRAVAUX_PV   = 0.15;  // ⚙️ PARAMÈTRES!D23 (si détention >= 5 ans)
const SIM_CA_EXO_TOTALE_LMP  = 90000; // ⚙️ PARAMÈTRES!D25
const SIM_TAUX_COTIS_LMP     = 0.40;  // ⚙️ PARAMÈTRES!M19
const SIM_COTIS_MIN_LMP      = 1208;  // ⚙️ PARAMÈTRES!M18
const SIM_ABATT_MICRO_BIC    = 0.50;  // ⚙️ PARAMÈTRES!I17/I18
const SIM_ABATT_MICRO_FONCIER= 0.30;  // ⚙️ PARAMÈTRES!I16
const SIM_PLAFOND_MICRO_FONCIER = 15000; // ⚙️ PARAMÈTRES!D16
const SIM_PLAFOND_MICRO_BIC  = 77700; // ⚙️ PARAMÈTRES!D17/D18
const SIM_SEUIL_IS_PME       = 42500; // ⚙️ PARAMÈTRES!L6
const SIM_TAUX_IS_REDUIT     = 0.15;  // ⚙️ PARAMÈTRES!M6
const SIM_TAUX_IS_NORMAL     = 0.25;  // ⚙️ PARAMÈTRES!M7
const SIM_PLAFOND_DEFICIT_FONCIER = 10700; // art. 156 I 3° CGI
const SIM_DEFICIT_REPORT_ANS = 10;
const SIM_TAUX_CRL = 0.025; // ⚙️ PARAMÈTRES!M17 — Contribution sur les Revenus Locatifs (société, si pas de TVA)
const SIM_PINEL_PRIX_M2_PLAFOND = 5500; // ⚙️ PARAMÈTRES!M21
const SIM_PINEL_INVEST_PLAFOND = 300000; // ⚙️ PARAMÈTRES!M20

function simTMI(revenuImposable, nbParts) {
  const q = revenuImposable / (nbParts || 1);
  for (let i = SIM_BAREME_IR.length - 1; i >= 0; i--) {
    if (q > SIM_BAREME_IR[i].bas) return SIM_BAREME_IR[i].taux;
  }
  return 0;
}

// Prix de revient plafonné Pinel — cascade fidèle à ⚙️ PARAMÈTRES!G23:G25 (4 IF imbriqués)
function simPinelPrixDeRevient(investissement, surfaceUtile) {
  if (!surfaceUtile) return Math.min(investissement, SIM_PINEL_INVEST_PLAFOND);
  const ratioM2 = investissement / surfaceUtile;
  if (ratioM2 <= SIM_PINEL_PRIX_M2_PLAFOND && investissement <= SIM_PINEL_INVEST_PLAFOND) return investissement;
  if (ratioM2 > SIM_PINEL_PRIX_M2_PLAFOND && investissement <= SIM_PINEL_INVEST_PLAFOND) return SIM_PINEL_PRIX_M2_PLAFOND * surfaceUtile;
  return SIM_PINEL_INVEST_PLAFOND;
}
// Réduction Pinel annuelle effective — 2%/an les années 1-9, 1%/an les années 10-12
function simPinelReductionAnnuelle(prixDeRevient, anneeDetention) {
  if (anneeDetention <= 9) return prixDeRevient * 0.02;
  if (anneeDetention <= 12) return prixDeRevient * 0.01;
  return 0;
}

// Barème d'abattement pour durée de détention (plus-value) — ⚙️ PARAMÈTRES!S7:V36
// index = durée de détention en années (1..30+)
function simAbattementDureeDetention(dureeAns) {
  // Assiette IR : 6%/an de la 6e à la 21e année (16 ans), 4% la 22e -> exo à 22 ans
  // Assiette PS : 1,65%/an de la 6e à la 21e, 1,6% la 22e, puis 9%/an de la 23e à la 30e -> exo à 30 ans
  let ir = 0, ps = 0;
  for (let a = 6; a <= dureeAns && a <= 22; a++) {
    ir += (a <= 21) ? 0.06 : 0.04;
    ps += (a <= 21) ? 0.0165 : 0.016;
  }
  for (let a = 23; a <= dureeAns && a <= 30; a++) {
    ps += 0.09;
  }
  return { ir: Math.min(ir, 1), ps: Math.min(ps, 1) };
}

// Abattement spécifique PV long terme LMP (art. 151 septies B) — colonne V : 10%/an à partir de la 6e année, exo à 15 ans
function simAbattementDureeDetentionLMP(dureeAns) {
  let taux = 0;
  for (let a = 6; a <= dureeAns && a <= 15; a++) taux += 0.10;
  return Math.min(taux, 1);
}

// ════════════════════════════════════════════
//  EMPRUNT — tableau d'amortissement (🔎 EMPRUNT)
// ════════════════════════════════════════════
// Retourne un tableau de SIM_HORIZON entrées {capitalRembourse, interets, assurance, capitalRestantDu, mensualite}
function simBuildLoanSchedule(montantEmprunte, tauxAnnuel, tauxAssuranceAnnuel, dureeAnnees, dureeDiffereMois, typeEmprunt) {
  const years = [];
  for (let a = 0; a < SIM_HORIZON; a++) years.push({ capitalRembourse: 0, interets: 0, assurance: 0, capitalRestantDu: 0, mensualite: 0 });

  if (!montantEmprunte || montantEmprunte <= 0 || !dureeAnnees || dureeAnnees <= 0) return years;

  const K = montantEmprunte;
  const i = tauxAnnuel / 12;
  const N = Math.min(Math.round(dureeAnnees * 12), SIM_HORIZON * 12);
  const D = Math.max(0, Math.min(dureeDiffereMois || 0, N - 1));
  const assuranceMensuelle = (tauxAssuranceAnnuel || 0) * K / 12;

  function annuite(capital, tauxMensuel, dureeMois) {
    if (dureeMois <= 0) return capital; // garde-fou : pas de durée résiduelle -> rembourse tout d'un coup
    if (tauxMensuel === 0) return capital / dureeMois;
    return (capital * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeMois));
  }

  const capitalCapitaliseFinDiffere = K * Math.pow(1 + i, D);
  let crd = K;
  const monthly = [];

  for (let m = 1; m <= N; m++) {
    let capitalRembourse = 0, interets = 0, assurance = assuranceMensuelle, mensualite = 0;

    if (typeEmprunt === 'IN FINE') {
      interets = crd * i;
      if (m < N) { capitalRembourse = 0; }
      else { capitalRembourse = crd; }
      mensualite = interets + assurance + (m === N ? capitalRembourse : 0);
    } else if (typeEmprunt === 'DIFFÉRÉ TOTAL') {
      if (m <= D) {
        interets = 0; // capitalisés, pas prélevés
        capitalRembourse = 0;
        mensualite = assurance;
        crd = crd + crd * i; // capitalisation des intérêts
        monthly.push({ capitalRembourse, interets, assurance, crd });
        continue;
      } else {
        interets = crd * i;
        const base = Math.max(K, capitalCapitaliseFinDiffere);
        const mensualiteHorsAssurance = annuite(base, i, N - D);
        capitalRembourse = mensualiteHorsAssurance - interets;
        mensualite = mensualiteHorsAssurance + assurance;
      }
    } else if (typeEmprunt === 'DIFFÉRÉ PARTIEL') {
      interets = crd * i;
      if (m <= D) {
        capitalRembourse = 0;
        mensualite = interets + assurance;
      } else {
        const mensualiteHorsAssurance = annuite(K, i, N - D);
        capitalRembourse = mensualiteHorsAssurance - interets;
        mensualite = mensualiteHorsAssurance + assurance;
      }
    } else { // CLASSIQUE
      interets = crd * i;
      const mensualiteHorsAssurance = annuite(K, i, N);
      capitalRembourse = mensualiteHorsAssurance - interets;
      mensualite = mensualiteHorsAssurance + assurance;
    }

    crd = Math.max(0, crd - capitalRembourse);
    monthly.push({ capitalRembourse, interets, assurance, crd });
  }

  // Agrégation mensuelle -> annuelle (25 ans max)
  for (let a = 0; a < SIM_HORIZON; a++) {
    const startIdx = a * 12, endIdx = Math.min(startIdx + 12, monthly.length);
    if (startIdx >= monthly.length) break;
    let capRemb = 0, inte = 0, assu = 0;
    for (let k = startIdx; k < endIdx; k++) {
      capRemb += monthly[k].capitalRembourse;
      inte += monthly[k].interets;
      assu += monthly[k].assurance;
    }
    years[a] = {
      capitalRembourse: capRemb,
      interets: inte,
      assurance: assu,
      capitalRestantDu: endIdx > 0 ? monthly[endIdx - 1].crd : K,
      mensualite: endIdx > startIdx ? (capRemb + inte + assu) / (endIdx - startIdx) : 0,
    };
  }
  return years;
}

// ════════════════════════════════════════════
//  AMORTISSEMENT — ventilation comptable du bien (🔎 AMORTISSEMENT)
// ════════════════════════════════════════════
const SIM_COMPOSANTS_BIEN = [
  { nom: 'Terrain',      pct: 0.15, duree: 0 },
  { nom: 'Gros œuvre',   pct: 0.50, duree: 50 },
  { nom: 'Toiture',      pct: 0.10, duree: 25 },
  { nom: 'Agencement',   pct: 0.15, duree: 15 },
  { nom: 'Électricité',  pct: 0.05, duree: 25 },
  { nom: 'Étanchéité',   pct: 0.05, duree: 15 },
];

function simDotationLineaire(montant, duree, horizon) {
  const arr = new Array(horizon).fill(0);
  if (!montant || !duree || duree <= 0) return arr;
  const dotationAnnuelle = montant / duree;
  for (let a = 0; a < horizon && a < duree; a++) arr[a] = dotationAnnuelle;
  return arr;
}

function simSum(arr) { return arr.reduce((s, v) => s + v, 0); }
function simAddArrays() {
  const n = arguments[0].length;
  const out = new Array(n).fill(0);
  for (const arr of arguments) for (let i = 0; i < n; i++) out[i] += arr[i] || 0;
  return out;
}

// prixBienSeul = prix du bien hors frais d'agence (base de ventilation par composant)
function simBuildDepreciationSchedule(params) {
  const { prixBienSeul, fraisAgence, fraisNotaire, fraisDossier, fraisCourtier, cautionHypotheque,
          travaux, mobilier, fraisConstitutionSociete, amortirFraisAcquisition, dureeEmpruntAnnees } = params;

  const amortComposants = SIM_COMPOSANTS_BIEN.map(c =>
    simDotationLineaire(c.pct * prixBienSeul, c.duree, SIM_HORIZON)
  );
  const amortBien = simAddArrays(...amortComposants);

  const dureeMoyennePonderee = SIM_COMPOSANTS_BIEN.reduce((s, c) => s + c.pct * c.duree, 0);
  const montantFraisAcq = amortirFraisAcquisition ? (fraisAgence + fraisNotaire) : 0;
  const amortFraisAcq = simDotationLineaire(montantFraisAcq, dureeMoyennePonderee, SIM_HORIZON);

  const montantFraisBancaires = amortirFraisAcquisition ? (fraisDossier + fraisCourtier + cautionHypotheque) : 0;
  const amortFraisBancaires = simDotationLineaire(montantFraisBancaires, dureeEmpruntAnnees || 0, SIM_HORIZON);

  const amortTravaux = simDotationLineaire(travaux, 10, SIM_HORIZON);
  const amortMobilier = simDotationLineaire(mobilier, 5, SIM_HORIZON);

  const montantFraisConstitution = amortirFraisAcquisition ? (fraisConstitutionSociete || 0) : 0;
  const amortFraisConstitution = simDotationLineaire(montantFraisConstitution, 5, SIM_HORIZON);

  return { amortBien, amortFraisAcq, amortFraisBancaires, amortTravaux, amortMobilier, amortFraisConstitution };
}

// ════════════════════════════════════════════
//  IR — Quotient familial, plafonnement, décote (⚙️ PARAMÈTRES)
// ════════════════════════════════════════════
function simNbParts(situation, nbEnfants) {
  const base = (situation === 'Marié ou Pacsé') ? 2 : 1;
  const partsEnfants = (nbEnfants <= 2) ? nbEnfants * 0.5 : (nbEnfants - 1);
  return base + partsEnfants;
}
function simNbPartsSansEnfants(situation) { return (situation === 'Marié ou Pacsé') ? 2 : 1; }

function simBaremeIR(quotient) {
  let impot = 0;
  for (const t of SIM_BAREME_IR) {
    if (quotient > t.haut) impot += (t.haut - t.bas) * t.taux;
    else if (quotient > t.bas) impot += (quotient - t.bas) * t.taux;
  }
  return impot;
}
function simIrAvantPlafonnement(revenuImposable, nbParts) {
  if (!nbParts || nbParts <= 0) return 0;
  return simBaremeIR(revenuImposable / nbParts) * nbParts;
}
function simIrAvecPlafonnementQF(revenuImposable, nbPartsReel, situation) {
  const nbPartsSansEnfants = simNbPartsSansEnfants(situation);
  const irAvecParts = simIrAvantPlafonnement(revenuImposable, nbPartsReel);
  if (nbPartsReel === nbPartsSansEnfants) return irAvecParts;
  const irSansEnfants = simIrAvantPlafonnement(revenuImposable, nbPartsSansEnfants);
  let plafondTotal = 0;
  if (irAvecParts < irSansEnfants) {
    plafondTotal = SIM_PLAFOND_DEMI_PART * (nbPartsReel - nbPartsSansEnfants) * 2;
  }
  const irPlafonneCandidat = irSansEnfants - plafondTotal;
  return irPlafonneCandidat > irAvecParts ? irPlafonneCandidat : irAvecParts;
}
function simDecote(irAvecPlafonnement, situation) {
  const d = SIM_DECOTE[situation] || SIM_DECOTE['Célibataire ou Divorcé'];
  if (irAvecPlafonnement > d.seuil) return 0;
  return Math.max(0, Math.min(d.forfait - irAvecPlafonnement * d.taux, irAvecPlafonnement));
}
function simIrNet(revenuImposable, nbParts, situation) {
  const ir = simIrAvecPlafonnementQF(revenuImposable, nbParts, situation);
  const dec = simDecote(ir, situation);
  return Math.max(0, ir - dec);
}
// Méthode différentielle : impôt marginal réellement imputable à l'opération immobilière
function simImpotMarginal(revenusFoyer, resultatOperation, nbParts, situation) {
  if (!resultatOperation) return 0;
  const irSans = simIrNet(revenusFoyer, nbParts, situation);
  const irAvec = simIrNet(revenusFoyer + resultatOperation, nbParts, situation);
  return irAvec - irSans;
}

// ════════════════════════════════════════════
//  DÉFICIT — pools FIFO (report 10 ans, ou illimité pour l'amortissement LMNP)
// ════════════════════════════════════════════
function simConsumeFIFO(pool, montantDisponible) {
  let remaining = montantDisponible;
  let consomme = 0;
  for (let i = 0; i < pool.length && remaining > 1e-9; i++) {
    const use = Math.min(pool[i].montant, remaining);
    pool[i].montant -= use;
    remaining -= use;
    consomme += use;
  }
  for (let i = pool.length - 1; i >= 0; i--) if (pool[i].montant <= 1e-9) pool.splice(i, 1);
  return consomme;
}
function simAgeOutFIFO(pool, anneeCourante) {
  for (let i = pool.length - 1; i >= 0; i--) {
    if (anneeCourante - pool[i].origine >= SIM_DEFICIT_REPORT_ANS) pool.splice(i, 1);
  }
}

// Déficit foncier (RF réel / Pinel réel) — art. 156 I 3° CGI
// Retourne, pour chaque année : { resultatApresImputation, imputationRevenuGlobal }
function simDeficitFoncierEngine(revenusBrutsAnnuels, chargesExploitationAnnuelles, chargesFinancieresAnnuelles, revenuGlobalFoyerAnnuel, horizon) {
  const pool = [];       // déficit reportable sur revenus fonciers (10 ans)
  const poolNonImpute = []; // reliquat non imputé sur revenu global faute de revenu suffisant (10 ans)
  const out = [];
  for (let a = 0; a < horizon; a++) {
    simAgeOutFIFO(pool, a);
    simAgeOutFIFO(poolNonImpute, a);
    const revBruts = revenusBrutsAnnuels[a] || 0;
    const chExpl = chargesExploitationAnnuelles[a] || 0;
    const chFin = chargesFinancieresAnnuelles[a] || 0;
    const resultatAvant = revBruts - chExpl - chFin;

    let resultatApres, imputationRevenuGlobal = 0;
    if (resultatAvant >= 0) {
      const consomme = simConsumeFIFO(pool, resultatAvant);
      resultatApres = Math.max(0, resultatAvant - consomme);
      // le revenu global disponible peut encore absorber un reliquat non imputé des années passées
      const revGlobal = revenuGlobalFoyerAnnuel[a] || 0;
      const dispo = Math.max(0, revGlobal);
      simConsumeFIFO(poolNonImpute, Math.min(dispo, simSum(poolNonImpute)));
    } else {
      const chargesFinExcess = Math.max(chFin - revBruts, 0);
      let imputable = Math.max(-SIM_PLAFOND_DEFICIT_FONCIER, resultatAvant + chargesFinExcess);
      const revGlobal = Math.max(0, revenuGlobalFoyerAnnuel[a] || 0);
      const imputationEffective = Math.max(imputable, -revGlobal);
      if (imputationEffective > imputable) {
        poolNonImpute.push({ origine: a, montant: imputable - imputationEffective });
      }
      imputationRevenuGlobal = imputationEffective;
      const deficitReportable = chargesFinExcess + Math.max(-resultatAvant - chargesFinExcess - SIM_PLAFOND_DEFICIT_FONCIER, 0);
      if (deficitReportable > 0) pool.push({ origine: a, montant: deficitReportable });
      resultatApres = 0;
    }
    out.push({ resultatApres, imputationRevenuGlobal });
  }
  return out;
}

// Déficit BIC LMP — amortissement inclus dans le résultat (pas de plancher 0), imputable sur revenu global
// dans la limite du revenu global disponible (pas de plafond fixe 10700)
function simDeficitLMPEngine(produitsAnnuels, chargesHorsAmortAnnuelles, amortissementAnnuel, revenuGlobalFoyerAnnuel, horizon) {
  const pool = [];
  const out = [];
  for (let a = 0; a < horizon; a++) {
    simAgeOutFIFO(pool, a);
    const resultatAvant = (produitsAnnuels[a] || 0) - (chargesHorsAmortAnnuelles[a] || 0) - (amortissementAnnuel[a] || 0);
    let resultatApres, imputationRevenuGlobal = 0;
    if (resultatAvant >= 0) {
      const consomme = simConsumeFIFO(pool, resultatAvant);
      resultatApres = resultatAvant - consomme;
    } else {
      const revGlobal = Math.max(0, revenuGlobalFoyerAnnuel[a] || 0);
      imputationRevenuGlobal = Math.max(resultatAvant, -revGlobal);
      const nonImpute = resultatAvant - imputationRevenuGlobal; // <= 0
      if (nonImpute < 0) pool.push({ origine: a, montant: -nonImpute });
      resultatApres = 0;
    }
    out.push({ resultatApres, imputationRevenuGlobal });
  }
  return out;
}

// Déficit BIC LMNP — amortissement plafonné (report illimité), déficit hors amort. reportable 10 ans,
// AUCUNE imputation possible sur le revenu global
function simDeficitLMNPEngine(produitsAnnuels, chargesHorsAmortAnnuelles, amortissementAnnuel, horizon) {
  const poolDeficit = []; // 10 ans
  let stockAmortReportable = 0; // illimité
  const out = [];
  for (let a = 0; a < horizon; a++) {
    simAgeOutFIFO(poolDeficit, a);
    const resultatAvantAmort = (produitsAnnuels[a] || 0) - (chargesHorsAmortAnnuelles[a] || 0);
    const amort = amortissementAnnuel[a] || 0;
    let resultatApres, amortNonUtilise = 0, amortImpute = 0;
    if (resultatAvantAmort < 0) {
      poolDeficit.push({ origine: a, montant: -resultatAvantAmort });
      amortNonUtilise = amort;
      stockAmortReportable += amort;
      resultatApres = 0;
    } else {
      const amortDisponible = amort + stockAmortReportable;
      amortImpute = Math.min(resultatAvantAmort, amortDisponible);
      stockAmortReportable = amortDisponible - amortImpute;
      const resultatApresAmort = resultatAvantAmort - amortImpute;
      const consomme = simConsumeFIFO(poolDeficit, resultatApresAmort);
      resultatApres = resultatApresAmort - consomme;
    }
    out.push({ resultatApres });
  }
  return out;
}

// ════════════════════════════════════════════
//  PLUS-VALUE À LA REVENTE
// ════════════════════════════════════════════

// Régime des particuliers (RF/Pinel/LMNP), avec réintégration optionnelle des amortissements (LMNP depuis 2025)
function simPvParticuliers({ prixVente, prixBien, fraisReels, travauxImmobilises, cumulAmortTravaux, dureeDetention, reintegrerAmortissements, cumulAmortBien }) {
  if (!dureeDetention || dureeDetention <= 0 || !prixVente) return { pvBrute: 0, impotIR: 0, csgCrds: 0, total: 0 };
  const fraisAcquisition = Math.max(prixBien * SIM_ABATT_FRAIS_ACQ_PV, fraisReels || 0);
  let abattementTravaux = 0;
  if (dureeDetention >= 5) {
    const travauxNetAmort = (travauxImmobilises || 0) - (cumulAmortTravaux || 0);
    abattementTravaux = Math.max(travauxNetAmort, prixBien * SIM_ABATT_TRAVAUX_PV);
  }
  let pvBrute = prixVente - (prixBien + fraisAcquisition + abattementTravaux);
  if (reintegrerAmortissements) pvBrute += (cumulAmortBien || 0);
  if (pvBrute <= 0) return { pvBrute, impotIR: 0, csgCrds: 0, total: 0 };
  const { ir: abattIR, ps: abattPS } = simAbattementDureeDetention(dureeDetention);
  const impotIR = pvBrute * (1 - abattIR) * SIM_TAUX_IR_PV;
  const csgCrds = pvBrute * (1 - abattPS) * SIM_TAUX_CSG_CRDS;
  return { pvBrute, impotIR, csgCrds, total: impotIR + csgCrds };
}

// Régime professionnel LMP — CT (recapture amortissements, barème IR + cotisations) / LT (12,8% + abattement art.151 septies B)
function simPvLMP({ prixVente, prixBien, dureeDetention, cumulAmortTotal, caMoyenDeuxDerniersExercices, tmiFoyer }) {
  if (!dureeDetention || dureeDetention <= 0 || !prixVente) return { pvCT: 0, pvLT: 0, total: 0, exonere: false };
  if (dureeDetention <= 2) {
    const pvCT = cumulAmortTotal || 0;
    const cotisCT = pvCT * SIM_TAUX_COTIS_LMP / (1 + SIM_TAUX_COTIS_LMP);
    const impotCT = Math.max(0, pvCT - cotisCT) * (tmiFoyer || 0);
    return { pvCT, pvLT: 0, impotCT, cotisCT, impotLT: 0, csgCrdsLT: 0, total: impotCT + cotisCT, exonere: false };
  }
  const exonere = (dureeDetention >= 5) && (caMoyenDeuxDerniersExercices || 0) <= SIM_CA_EXO_TOTALE_LMP;
  if (exonere) return { pvCT: 0, pvLT: 0, total: 0, exonere: true };
  const pvCT = cumulAmortTotal || 0;
  const pvLT = Math.max(0, prixVente - prixBien);
  const cotisCT = pvCT * SIM_TAUX_COTIS_LMP / (1 + SIM_TAUX_COTIS_LMP);
  const impotCT = Math.max(0, pvCT - cotisCT) * (tmiFoyer || 0);
  const abattLT = simAbattementDureeDetentionLMP(dureeDetention);
  const impotLT = pvLT * (1 - abattLT) * SIM_TAUX_IR_PV_LT_LMP;
  const csgCrdsLT = pvLT * SIM_TAUX_CSG_CRDS; // pas d'abattement sur l'assiette PS en LMP
  return { pvCT, pvLT, impotCT, cotisCT, impotLT, csgCrdsLT, total: impotCT + cotisCT + impotLT + csgCrdsLT, exonere: false };
}

// Régime société IS — plus-value = prix de cession - VNC, aucun abattement, intégrée au résultat imposable IS
function simPvIS({ prixVente, valeurNetteComptable }) {
  if (!prixVente) return 0;
  return prixVente - (valeurNetteComptable || 0);
}

function simIS(resultatImposable) {
  if (resultatImposable <= 0) return 0;
  if (resultatImposable <= SIM_SEUIL_IS_PME) return resultatImposable * SIM_TAUX_IS_REDUIT;
  return SIM_SEUIL_IS_PME * SIM_TAUX_IS_REDUIT + (resultatImposable - SIM_SEUIL_IS_PME) * SIM_TAUX_IS_NORMAL;
}

// ════════════════════════════════════════════
//  VAN / TRI / DRCI
// ════════════════════════════════════════════
// flux[0] = mise de fonds initiale (négative), flux[1..n] = cash-flows annuels
function simVAN(flux, tauxActualisation) {
  let van = 0;
  for (let t = 0; t < flux.length; t++) van += flux[t] / Math.pow(1 + tauxActualisation, t);
  return van;
}
function simTRI(flux) {
  // Recherche par dichotomie du taux qui annule la VAN
  let lo = -0.99, hi = 5, mid = 0;
  const van = (r) => simVAN(flux, r);
  if (van(lo) * van(hi) > 0) return null; // pas de racine trouvable dans l'intervalle
  for (let iter = 0; iter < 100; iter++) {
    mid = (lo + hi) / 2;
    const v = van(mid);
    if (Math.abs(v) < 1e-6) break;
    if (van(lo) * v < 0) hi = mid; else lo = mid;
  }
  return mid;
}
// Délai de récupération du capital investi (première année où le cash-flow cumulé compense l'apport)
function simDRCI(apport, cashFlowsAnnuels) {
  let cumule = -apport;
  for (let a = 0; a < cashFlowsAnnuels.length; a++) {
    const prev = cumule;
    cumule += cashFlowsAnnuels[a];
    if (cumule >= 0) {
      const frac = prev < 0 ? (-prev) / (cumule - prev) : 0;
      return a + frac; // en années (fraction incluse)
    }
  }
  return null; // jamais récupéré sur l'horizon simulé
}
