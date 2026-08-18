// ════════════════════════════════════════════
//  SIMULATEUR — CALCULATEURS PAR RÉGIME FISCAL
//  LMNP micro-BIC · LMNP réel · LMP réel · RF réel · RF micro-foncier
//  Pinel réel · Pinel micro-foncier · Société IS sans/avec distribution
// ════════════════════════════════════════════

// ── Coût d'acquisition selon le mode de location (meuble / nu / societe) ──
function simBuildBaseCoutAcquisition(inputs, mode) {
  const prixBien = inputs.prixBien;
  const fraisAgence = inputs.fraisAgence;
  const fraisNotaire = prixBien * inputs.tauxNotaire;
  const fraisDossier = inputs.fraisDossierBancaire;
  const fraisCourtier = inputs.fraisCourtier;
  const caution = inputs.cautionHypotheque;
  const travaux = inputs.travaux;
  let mobilier = 0;
  if (mode === 'meuble') mobilier = inputs.mobilier;
  else if (mode === 'societe') mobilier = (inputs.modeLocationSociete === 'NU') ? 0 : inputs.mobilier;
  const fraisConstitution = (mode === 'societe') ? inputs.fraisConstitutionSociete : 0;
  const total = prixBien + fraisAgence + fraisNotaire + fraisDossier + fraisCourtier + caution + travaux + mobilier + fraisConstitution;
  return { prixBien, fraisAgence, fraisNotaire, fraisDossier, fraisCourtier, caution, travaux, mobilier, fraisConstitution, total };
}

function simLoyerCharges(inputs, mode) {
  if (mode === 'meuble') return { loyerMensuel: inputs.loyerMeuble, chargesMensuelles: inputs.chargesRecupMeuble };
  if (mode === 'nu') return { loyerMensuel: inputs.loyerNu, chargesMensuelles: inputs.chargesRecupNu };
  return inputs.modeLocationSociete === 'NU'
    ? { loyerMensuel: inputs.loyerNu, chargesMensuelles: inputs.chargesRecupNu }
    : { loyerMensuel: inputs.loyerMeuble, chargesMensuelles: inputs.chargesRecupMeuble };
}

function simChargesAnnuellesRecurrentes(inputs, mode) {
  const { loyerMensuel, chargesMensuelles } = simLoyerCharges(inputs, mode);
  const gestionLocative = Math.round(((loyerMensuel + chargesMensuelles) * 12 * (1 - inputs.tauxVacance)) * inputs.tauxGestionLocative);
  const fraisComptabilite = (mode === 'nu') ? 0 : inputs.fraisComptabilite;
  const cga = (mode === 'meuble') ? inputs.cga : 0;
  const cfe = (mode === 'nu') ? 0 : inputs.cfe;
  const fraisBancaires = (mode === 'societe') ? inputs.fraisBancairesSociete : inputs.fraisBancaires;
  const crl = (mode === 'societe' && inputs.societeTVA === 'NON') ? (loyerMensuel * 12 * (1 - inputs.tauxVacance) * SIM_TAUX_CRL) : 0;
  return {
    chargesLocatives: inputs.chargesLocatives, assurances: inputs.assurances, taxeFonciere: inputs.taxeFonciere,
    entretien: inputs.entretien, gestionLocative, fraisMiseEnLocation: inputs.fraisMiseEnLocation,
    fraisBancaires, fraisComptabilite, cga, cfe, crl,
  };
}
function simTotalChargesRecurrentes(ch) {
  return ch.chargesLocatives + ch.assurances + ch.taxeFonciere + ch.entretien + ch.gestionLocative +
         ch.fraisMiseEnLocation + ch.fraisBancaires + ch.fraisComptabilite + ch.cga + ch.cfe + ch.crl;
}

// Durée effective de simulation : l'horizon complet (25 ans) si l'utilisateur ne prévoit pas de
// revendre le bien, sinon la durée de détention saisie (repliée sur l'horizon si non renseignée).
function simEffectiveDuree(inputs) {
  if (inputs.revendreLeBien === 'NON') return SIM_HORIZON;
  return inputs.dureeDetention > 0 ? inputs.dureeDetention : SIM_HORIZON;
}

// ── Base annuelle commune (produits, charges récurrentes, emprunt) pour un mode donné ──
function simBuildAnnualBase(inputs, mode) {
  const cout = simBuildBaseCoutAcquisition(inputs, mode);
  const { loyerMensuel, chargesMensuelles } = simLoyerCharges(inputs, mode);
  const chAnn = simChargesAnnuellesRecurrentes(inputs, mode);
  const montantEmprunte = inputs.dureeEmprunt > 0 ? Math.max(0, cout.total - inputs.apportPersonnel) : 0;
  const loan = simBuildLoanSchedule(montantEmprunte, inputs.tauxEmprunt, inputs.tauxAssuranceEmprunt, inputs.dureeEmprunt, inputs.dureeDiffereMois, inputs.typeEmprunt);

  const dureeDetention = simEffectiveDuree(inputs);
  const years = [];
  for (let a = 0; a < SIM_HORIZON; a++) {
    const active = (a + 1) <= dureeDetention;
    const loyers = active ? loyerMensuel * 12 * (1 - inputs.tauxVacance) : 0;
    const chargesRecup = active ? chargesMensuelles * 12 * (1 - inputs.tauxVacance) : 0;
    const produits = loyers + chargesRecup;
    const cfeExoneree = (a === 0 && inputs.dejaBienMeuble === 'NON' && mode !== 'nu');
    const chargeExploit = active ? (simTotalChargesRecurrentes(chAnn) - (cfeExoneree ? chAnn.cfe : 0)) : 0;
    const interets = active ? loan[a].interets : 0;
    const assuranceEmprunt = active ? loan[a].assurance : 0;
    years.push({
      loyers, chargesRecup, produits, chargeExploit, interets, assuranceEmprunt,
      capitalRembourse: active ? loan[a].capitalRembourse : 0,
      capitalRestantDu: loan[a].capitalRestantDu,
    });
  }
  return { cout, montantEmprunte, loan, years, loyerMensuel, chargesMensuelles };
}

// ── Finalisation commune : VAN / TRI / DRCI / rendements à partir des cash-flows annuels ──
function simFinalizeRegime(key, label, years, apport, coutAcquisitionTotal, inputs) {
  const validYears = years.filter(y => y);
  const flux = [-apport, ...validYears.map(y => y.cashFlowAnnuel)];
  const van = simVAN(flux, inputs.tauxActualisation);
  const tri = simTRI(flux);
  const drci = simDRCI(apport, validYears.map(y => y.cashFlowAnnuel));
  const cashFlowCumuleFinal = validYears.length ? validYears[validYears.length - 1].cashFlowCumule : 0;
  const totalImpot = simSum(validYears.map(y => y.impotLocatif));

  // Année exclue du calcul de rendement uniquement si elle porte une revente (produit de cession
  // et impôt de plus-value ponctuels qui fausseraient le ratio) — jamais en mode "pas de revente".
  const hasResale = inputs.revendreLeBien === 'OUI';
  const opYears = (hasResale && validYears.length > 1) ? validYears.slice(0, -1) : validYears;
  const rendementNetNet = coutAcquisitionTotal > 0 && opYears.length
    ? simSum(opYears.map(y => (y.produits - y.chargesDecaissees - y.impotLocatif) / coutAcquisitionTotal)) / opYears.length
    : 0;
  const rendementBrut = coutAcquisitionTotal > 0 && opYears.length
    ? simSum(opYears.map(y => y.produits)) / opYears.length / coutAcquisitionTotal
    : 0;

  return {
    key, label, years: validYears, apport, coutAcquisitionTotal,
    van, tri, drci, cashFlowCumuleFinal, rendementNetNet, rendementBrut, totalImpot,
  };
}

// ════════════════════════════════════════════
//  1. LMNP — RÉGIME BIC RÉEL SIMPLIFIÉ
// ════════════════════════════════════════════
function simRegimeLmnpReel(inputs) {
  const mode = 'meuble';
  const base = simBuildAnnualBase(inputs, mode);
  const L31 = inputs.amortFraisAcquisition === 'OUI';
  const fraisAcqTotal = base.cout.fraisAgence + base.cout.fraisNotaire + base.cout.fraisDossier + base.cout.fraisCourtier + base.cout.caution;

  const dep = simBuildDepreciationSchedule({
    prixBienSeul: inputs.prixBien, fraisAgence: base.cout.fraisAgence, fraisNotaire: base.cout.fraisNotaire,
    fraisDossier: base.cout.fraisDossier, fraisCourtier: base.cout.fraisCourtier, cautionHypotheque: base.cout.caution,
    travaux: base.cout.travaux, mobilier: base.cout.mobilier, fraisConstitutionSociete: 0,
    amortirFraisAcquisition: L31, dureeEmpruntAnnees: inputs.dureeEmprunt,
  });
  const amortissement = simAddArrays(dep.amortBien, dep.amortFraisAcq, dep.amortFraisBancaires, dep.amortTravaux, dep.amortMobilier);

  const produits = base.years.map(y => y.produits);
  const chargesHorsAmort = base.years.map((y, a) => y.chargeExploit + y.interets + y.assuranceEmprunt + (a === 0 && !L31 ? fraisAcqTotal : 0));

  const deficitOut = simDeficitLMNPEngine(produits, chargesHorsAmort, amortissement, SIM_HORIZON);

  const dureeDetention = simEffectiveDuree(inputs);
  const cumulAmortBien = simSum(dep.amortBien.slice(0, dureeDetention));
  const cumulAmortTravaux = simSum(dep.amortTravaux.slice(0, dureeDetention));
  const pv = simPvParticuliers({
    prixVente: inputs.valeurRevente || inputs.prixBien, prixBien: inputs.prixBien,
    fraisReels: base.cout.fraisNotaire + base.cout.fraisDossier, travauxImmobilises: base.cout.travaux,
    cumulAmortTravaux, dureeDetention, reintegrerAmortissements: true, cumulAmortBien,
  });

  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const resultatImposable = deficitOut[a].resultatApres;
    const impotMarginal = simImpotMarginal(inputs.revenusNets, resultatImposable, nbParts, inputs.situationPersonnelle);
    const csgCrds = resultatImposable * SIM_TAUX_CSG_CRDS;
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    const impotPVAnnee = isRevente ? pv.total : 0;
    const impotLocatif = impotMarginal + csgCrds + impotPVAnnee;

    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;

    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - impotLocatif + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable });
  }
  return simFinalizeRegime('lmnp_reel', 'LMNP - Régime BIC réel simplifié', years, apport, base.cout.total, inputs);
}

// ════════════════════════════════════════════
//  2. LMNP — RÉGIME MICRO-BIC
// ════════════════════════════════════════════
function simRegimeLmnpMicro(inputs) {
  const mode = 'meuble';
  const base = simBuildAnnualBase(inputs, mode);
  const dureeDetention = simEffectiveDuree(inputs);
  const produits = base.years.map(y => y.produits);
  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  const L31 = inputs.amortFraisAcquisition === 'OUI';

  // La PV réintègre les amortissements "fictifs" — identique au réel même si jamais déduits ici
  const dep = simBuildDepreciationSchedule({
    prixBienSeul: inputs.prixBien, fraisAgence: base.cout.fraisAgence, fraisNotaire: base.cout.fraisNotaire,
    fraisDossier: base.cout.fraisDossier, fraisCourtier: base.cout.fraisCourtier, cautionHypotheque: base.cout.caution,
    travaux: base.cout.travaux, mobilier: base.cout.mobilier, fraisConstitutionSociete: 0,
    amortirFraisAcquisition: L31, dureeEmpruntAnnees: inputs.dureeEmprunt,
  });
  const cumulAmortBien = simSum(dep.amortBien.slice(0, dureeDetention));
  const cumulAmortTravaux = simSum(dep.amortTravaux.slice(0, dureeDetention));
  const pv = simPvParticuliers({
    prixVente: inputs.valeurRevente || inputs.prixBien, prixBien: inputs.prixBien,
    fraisReels: base.cout.fraisNotaire + base.cout.fraisDossier, travauxImmobilises: base.cout.travaux,
    cumulAmortTravaux, dureeDetention, reintegrerAmortissements: true, cumulAmortBien,
  });

  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const resultatImposable = Math.max(0, produits[a] * (1 - SIM_ABATT_MICRO_BIC));
    const impotMarginal = simImpotMarginal(inputs.revenusNets, resultatImposable, nbParts, inputs.situationPersonnelle);
    const csgCrds = resultatImposable * SIM_TAUX_CSG_CRDS;
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    const impotPVAnnee = isRevente ? pv.total : 0;
    const impotLocatif = impotMarginal + csgCrds + impotPVAnnee;
    // Pas d'obligation comptable en micro-BIC : frais de comptabilité et CGA jamais décaissés
    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt - inputs.fraisComptabilite - inputs.cga;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;
    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - impotLocatif + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable });
  }
  return simFinalizeRegime('lmnp_micro', 'LMNP - Régime micro-BIC', years, apport, base.cout.total, inputs);
}

// ════════════════════════════════════════════
//  3. LMP — RÉGIME RÉEL BIC
// ════════════════════════════════════════════
function simRegimeLmpReel(inputs) {
  const mode = 'meuble';
  const base = simBuildAnnualBase(inputs, mode);
  const L31 = inputs.amortFraisAcquisition === 'OUI';
  const fraisAcqTotal = base.cout.fraisAgence + base.cout.fraisNotaire + base.cout.fraisDossier + base.cout.fraisCourtier + base.cout.caution;
  const dep = simBuildDepreciationSchedule({
    prixBienSeul: inputs.prixBien, fraisAgence: base.cout.fraisAgence, fraisNotaire: base.cout.fraisNotaire,
    fraisDossier: base.cout.fraisDossier, fraisCourtier: base.cout.fraisCourtier, cautionHypotheque: base.cout.caution,
    travaux: base.cout.travaux, mobilier: base.cout.mobilier, fraisConstitutionSociete: 0,
    amortirFraisAcquisition: L31, dureeEmpruntAnnees: inputs.dureeEmprunt,
  });
  const amortissement = simAddArrays(dep.amortBien, dep.amortFraisAcq, dep.amortFraisBancaires, dep.amortTravaux, dep.amortMobilier);

  const produits = base.years.map(y => y.produits);
  const chargesHorsAmort = base.years.map((y, a) => y.chargeExploit + y.interets + y.assuranceEmprunt + (a === 0 && !L31 ? fraisAcqTotal : 0));
  const revenuFoyerAnnuel = new Array(SIM_HORIZON).fill(inputs.revenusNets);
  const deficitOut = simDeficitLMPEngine(produits, chargesHorsAmort, amortissement, revenuFoyerAnnuel, SIM_HORIZON);

  const dureeDetention = simEffectiveDuree(inputs);
  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  const idxRevente = dureeDetention - 1;
  const resultatAvantArr = base.years.map((y, a) => produits[a] - chargesHorsAmort[a] - (amortissement[a] || 0));
  const tmiFoyer = simTMI(inputs.revenusNets + Math.max(0, resultatAvantArr[idxRevente] || 0), nbParts);
  const cumulAmortTotalRevente = simSum(amortissement.slice(0, dureeDetention));
  const produitsN1 = produits[idxRevente - 1] || 0, produitsN2 = produits[idxRevente - 2] || 0;
  const caMoyen = (dureeDetention >= 2) ? (produitsN1 + produitsN2) / 2 : (produits[0] || 0);
  const pv = simPvLMP({
    prixVente: inputs.valeurRevente || inputs.prixBien, prixBien: inputs.prixBien, dureeDetention,
    cumulAmortTotal: cumulAmortTotalRevente, caMoyenDeuxDerniersExercices: caMoyen, tmiFoyer,
  });

  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const d = deficitOut[a];
    const resultatOperation = d.resultatApres + d.imputationRevenuGlobal;
    const impotMarginal = simImpotMarginal(inputs.revenusNets, resultatOperation, nbParts, inputs.situationPersonnelle);
    const resultatAvant = resultatAvantArr[a];
    const cotisations = resultatAvant <= 0 ? SIM_COTIS_MIN_LMP : resultatAvant * SIM_TAUX_COTIS_LMP;
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    const impotPVAnnee = isRevente ? pv.total : 0;
    const impotLocatif = impotMarginal + cotisations + impotPVAnnee;
    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;
    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - impotLocatif + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable: Math.max(0, resultatOperation) });
  }
  return simFinalizeRegime('lmp_reel', 'LMP - Régime réel BIC', years, apport, base.cout.total, inputs);
}

// ════════════════════════════════════════════
//  4-7. REVENUS FONCIERS & PINEL (réel / micro-foncier)
// ════════════════════════════════════════════
function simBuildFoncierBase(inputs, travauxDeductible) {
  const base = simBuildAnnualBase(inputs, 'nu');
  const dureeDetention = simEffectiveDuree(inputs);
  const produits = base.years.map(y => y.produits);
  const chargesFinancieres = base.years.map((y, a) => y.interets + y.assuranceEmprunt + (a === 0 ? (base.cout.fraisDossier + base.cout.caution) : 0));
  const chargesExploitation = base.years.map((y, a) => y.chargeExploit + (a === 0 && travauxDeductible ? base.cout.travaux : 0));
  return { base, dureeDetention, produits, chargesFinancieres, chargesExploitation };
}

function simBuildFoncierYearsAndFinalize(key, label, base, dureeDetention, produits, deficitOut, pv, nbParts, inputs, pinelReductionFn) {
  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const d = deficitOut[a];
    const resultatOperation = d.resultatApres + d.imputationRevenuGlobal;
    let impotMarginal = simImpotMarginal(inputs.revenusNets, resultatOperation, nbParts, inputs.situationPersonnelle);
    if (pinelReductionFn) impotMarginal = Math.max(0, impotMarginal - pinelReductionFn(a + 1));
    const csgCrds = Math.max(0, d.resultatApres) * SIM_TAUX_CSG_CRDS;
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    const impotPVAnnee = isRevente ? pv.total : 0;
    const impotLocatif = impotMarginal + csgCrds + impotPVAnnee;
    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;
    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - impotLocatif + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable: d.resultatApres });
  }
  return simFinalizeRegime(key, label, years, apport, base.cout.total, inputs);
}

function simPinelReductionFnFor(inputs, dureeDetention) {
  const investissement = inputs.prixBien + inputs.fraisAgence + (inputs.prixBien * inputs.tauxNotaire) + inputs.travaux;
  const prixDeRevient = simPinelPrixDeRevient(investissement, inputs.pinelSurfaceUtile);
  const dureeEngagement = inputs.pinelDuree;
  return (anneeCourante) => {
    if (anneeCourante > dureeDetention || anneeCourante > dureeEngagement) return 0;
    return simPinelReductionAnnuelle(prixDeRevient, anneeCourante);
  };
}

function simRegimeRfReel(inputs) {
  const { base, dureeDetention, produits, chargesFinancieres, chargesExploitation } = simBuildFoncierBase(inputs, true);
  const revenuFoyerAnnuel = new Array(SIM_HORIZON).fill(inputs.revenusNets);
  const deficitOut = simDeficitFoncierEngine(produits, chargesExploitation, chargesFinancieres, revenuFoyerAnnuel, SIM_HORIZON);
  const pv = simPvParticuliers({
    prixVente: inputs.valeurRevente || inputs.prixBien, prixBien: inputs.prixBien,
    fraisReels: base.cout.fraisNotaire + base.cout.fraisDossier, travauxImmobilises: base.cout.travaux,
    cumulAmortTravaux: 0, dureeDetention, reintegrerAmortissements: false, cumulAmortBien: 0,
  });
  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  return simBuildFoncierYearsAndFinalize('rf_reel', 'Revenus fonciers - Régime réel', base, dureeDetention, produits, deficitOut, pv, nbParts, inputs, null);
}

function simRegimePinelReel(inputs) {
  const { base, dureeDetention, produits, chargesFinancieres, chargesExploitation } = simBuildFoncierBase(inputs, false);
  const revenuFoyerAnnuel = new Array(SIM_HORIZON).fill(inputs.revenusNets);
  const deficitOut = simDeficitFoncierEngine(produits, chargesExploitation, chargesFinancieres, revenuFoyerAnnuel, SIM_HORIZON);
  const pv = simPvParticuliers({
    prixVente: inputs.valeurRevente || inputs.prixBien, prixBien: inputs.prixBien,
    fraisReels: base.cout.fraisNotaire + base.cout.fraisDossier, travauxImmobilises: base.cout.travaux,
    cumulAmortTravaux: 0, dureeDetention, reintegrerAmortissements: false, cumulAmortBien: 0,
  });
  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  const pinelReductionFn = simPinelReductionFnFor(inputs, dureeDetention);
  return simBuildFoncierYearsAndFinalize('pinel_reel', 'Pinel - Régime réel', base, dureeDetention, produits, deficitOut, pv, nbParts, inputs, pinelReductionFn);
}

function simBuildMicroFoncierRegime(key, label, inputs, sourceBase, abattement, pinelReductionFn) {
  const { base, dureeDetention, produits } = sourceBase;
  const loyersSeuls = base.years.map(y => y.loyers);
  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  const pv = simPvParticuliers({
    prixVente: inputs.valeurRevente || inputs.prixBien, prixBien: inputs.prixBien,
    fraisReels: base.cout.fraisNotaire + base.cout.fraisDossier, travauxImmobilises: base.cout.travaux,
    cumulAmortTravaux: 0, dureeDetention, reintegrerAmortissements: false, cumulAmortBien: 0,
  });
  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const resultatMicro = Math.max(0, loyersSeuls[a] * (1 - abattement));
    let impotMarginal = simImpotMarginal(inputs.revenusNets, resultatMicro, nbParts, inputs.situationPersonnelle);
    if (pinelReductionFn) impotMarginal = Math.max(0, impotMarginal - pinelReductionFn(a + 1));
    const csgCrds = resultatMicro * SIM_TAUX_CSG_CRDS;
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    const impotPVAnnee = isRevente ? pv.total : 0;
    const impotLocatif = impotMarginal + csgCrds + impotPVAnnee;
    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;
    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - impotLocatif + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable: resultatMicro });
  }
  return simFinalizeRegime(key, label, years, apport, base.cout.total, inputs);
}

function simRegimeRfMicro(inputs) {
  const sourceBase = simBuildFoncierBase(inputs, true);
  return simBuildMicroFoncierRegime('rf_micro', 'RF - Régime micro-foncier', inputs, sourceBase, SIM_ABATT_MICRO_FONCIER, null);
}
function simRegimePinelMicro(inputs) {
  const sourceBase = simBuildFoncierBase(inputs, false);
  const pinelReductionFn = simPinelReductionFnFor(inputs, sourceBase.dureeDetention);
  return simBuildMicroFoncierRegime('pinel_micro', 'Pinel - Régime micro-foncier', inputs, sourceBase, SIM_ABATT_MICRO_FONCIER, pinelReductionFn);
}

// ════════════════════════════════════════════
//  8-9. SOCIÉTÉ À L'IS (sans / avec distribution)
// ════════════════════════════════════════════
function simBuildIsBase(inputs) {
  const mode = 'societe';
  const base = simBuildAnnualBase(inputs, mode);
  const L31 = inputs.amortFraisAcquisition === 'OUI';
  const fraisAcqTotal = base.cout.fraisAgence + base.cout.fraisNotaire + base.cout.fraisDossier + base.cout.fraisCourtier + base.cout.caution;
  const dep = simBuildDepreciationSchedule({
    prixBienSeul: inputs.prixBien, fraisAgence: base.cout.fraisAgence, fraisNotaire: base.cout.fraisNotaire,
    fraisDossier: base.cout.fraisDossier, fraisCourtier: base.cout.fraisCourtier, cautionHypotheque: base.cout.caution,
    travaux: base.cout.travaux, mobilier: base.cout.mobilier, fraisConstitutionSociete: inputs.fraisConstitutionSociete,
    amortirFraisAcquisition: L31, dureeEmpruntAnnees: inputs.dureeEmprunt,
  });
  const amortissement = simAddArrays(dep.amortBien, dep.amortFraisAcq, dep.amortFraisBancaires, dep.amortTravaux, dep.amortMobilier, dep.amortFraisConstitution);
  const dureeDetention = simEffectiveDuree(inputs);
  const produits = base.years.map(y => y.produits);
  // Si L31="NON" : frais d'acquisition + frais de constitution déduits intégralement en charge l'année 1 (jamais amortis).
  // Travaux et mobilier restent, eux, toujours immobilisés (jamais en charge courante) — cf. simBuildDepreciationSchedule.
  const chargesHorsAmort = base.years.map((y, a) => y.chargeExploit + y.interets + y.assuranceEmprunt + (a === 0 && !L31 ? (fraisAcqTotal + inputs.fraisConstitutionSociete) : 0));

  let deficitReporte = 0; // toujours <= 0, report en avant illimité (IS)
  const resultatApresArr = [];
  for (let a = 0; a < SIM_HORIZON; a++) {
    const resultatAvant = (produits[a] || 0) - (chargesHorsAmort[a] || 0) - (amortissement[a] || 0);
    const resultat = deficitReporte + resultatAvant;
    deficitReporte = Math.min(0, resultat);
    resultatApresArr.push(resultat);
  }
  return { base, dep, amortissement, produits, chargesHorsAmort, resultatApresArr, dureeDetention, L31 };
}

function simRegimeSocieteIsSansDistrib(inputs) {
  const { base, dep, amortissement, produits, resultatApresArr, dureeDetention, L31 } = simBuildIsBase(inputs);
  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    let pvImposable = 0;
    if (isRevente) {
      const cumulAmortTotal = simSum(amortissement.slice(0, a + 1));
      const vnc = L31
        ? (base.cout.total - cumulAmortTotal)
        : (base.cout.prixBien + base.cout.travaux + base.cout.mobilier - simSum(dep.amortBien.slice(0, a + 1)) - simSum(dep.amortTravaux.slice(0, a + 1)) - simSum(dep.amortMobilier.slice(0, a + 1)));
      pvImposable = simPvIS({ prixVente: inputs.valeurRevente || inputs.prixBien, valeurNetteComptable: vnc });
    }
    const resultatImposableIS = Math.max(0, resultatApresArr[a]) + (isRevente ? pvImposable : 0);
    const is = simIS(resultatImposableIS);
    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;
    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - is + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif: is, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable: resultatImposableIS });
  }
  return simFinalizeRegime('is_sans_distrib', "Société à l'IS (sans distribution)", years, apport, base.cout.total, inputs);
}

function simRegimeSocieteIsAvecDistrib(inputs) {
  const { base, dep, amortissement, produits, resultatApresArr, dureeDetention, L31 } = simBuildIsBase(inputs);
  const nbParts = simNbParts(inputs.situationPersonnelle, inputs.nbEnfants);
  const tauxDistribution = 1; // ⚙️PARAMÈTRES!Q6 — 100% par défaut dans le classeur source, non exposé en input utilisateur
  const years = []; let cumule = 0; const apport = inputs.apportPersonnel;
  for (let a = 0; a < SIM_HORIZON; a++) {
    if ((a + 1) > dureeDetention) { years.push(null); continue; }
    const isRevente = inputs.revendreLeBien === 'OUI' && (a + 1) === dureeDetention;
    let pvImposable = 0;
    if (isRevente) {
      const cumulAmortTotal = simSum(amortissement.slice(0, a + 1));
      const vnc = L31
        ? (base.cout.total - cumulAmortTotal)
        : (base.cout.prixBien + base.cout.travaux + base.cout.mobilier - simSum(dep.amortBien.slice(0, a + 1)) - simSum(dep.amortTravaux.slice(0, a + 1)) - simSum(dep.amortMobilier.slice(0, a + 1)));
      pvImposable = simPvIS({ prixVente: inputs.valeurRevente || inputs.prixBien, valeurNetteComptable: vnc });
    }
    const resultatImposableIS = Math.max(0, resultatApresArr[a]) + (isRevente ? pvImposable : 0);
    const is = simIS(resultatImposableIS);
    const beneficeDistribuable = Math.max(0, resultatImposableIS - is) * tauxDistribution;

    let impotDividendes = 0, csgCrdsDividendes = 0;
    if (beneficeDistribuable > 0) {
      if (inputs.impositionDividendes === 'FLAT TAX') {
        impotDividendes = beneficeDistribuable * 0.30; // ⚙️PARAMÈTRES!Q8
      } else {
        const revenusCapitaux = beneficeDistribuable * (1 - 0.40); // abattement 40%
        impotDividendes = Math.max(0, simIrNet(inputs.revenusNets + revenusCapitaux, nbParts, inputs.situationPersonnelle) - simIrNet(inputs.revenusNets, nbParts, inputs.situationPersonnelle));
        csgCrdsDividendes = revenusCapitaux * SIM_TAUX_CSG_CRDS;
      }
    }

    const chargesDecaissees = base.years[a].chargeExploit + base.years[a].interets + base.years[a].assuranceEmprunt;
    const amortissementEmprunt = base.years[a].capitalRembourse + (isRevente ? base.years[a].capitalRestantDu : 0);
    const produitCession = isRevente ? (inputs.valeurRevente || inputs.prixBien) : 0;
    const impotLocatif = is + impotDividendes + csgCrdsDividendes;
    const cashFlowAnnuel = produits[a] - chargesDecaissees - amortissementEmprunt - impotLocatif + produitCession;
    cumule += cashFlowAnnuel;
    years.push({ annee: a + 1, produits: produits[a], chargesDecaissees, amortissementEmprunt, impotLocatif, produitCession, cashFlowAnnuel, cashFlowCumule: cumule, resultatImposable: resultatImposableIS });
  }
  return simFinalizeRegime('is_avec_distrib', "Société à l'IS (avec distribution)", years, apport, base.cout.total, inputs);
}

// ════════════════════════════════════════════
//  ORCHESTRATEUR
// ════════════════════════════════════════════
const SIM_REGIME_FNS = [
  simRegimeLmnpReel, simRegimeLmnpMicro, simRegimeLmpReel,
  simRegimeRfReel, simRegimeRfMicro, simRegimePinelReel, simRegimePinelMicro,
  simRegimeSocieteIsSansDistrib, simRegimeSocieteIsAvecDistrib,
];

function simRunAllRegimes(inputs) {
  const regimes = SIM_REGIME_FNS.map(fn => {
    try { return fn(inputs); }
    catch (e) {
      console.error('[Simulateur] erreur régime', fn.name, e);
      return { key: fn.name, label: fn.name, error: e.message, years: [], van: 0, tri: null, drci: null, cashFlowCumuleFinal: 0, rendementNetNet: 0, totalImpot: 0, apport: inputs.apportPersonnel, coutAcquisitionTotal: 0 };
    }
  });
  return { inputs, regimes };
}
