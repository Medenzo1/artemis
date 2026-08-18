// ════════════════════════════════════════════
//  SIMULATEUR — RENDU DES RÉSULTATS & SYNTHÈSE COMPARATIVE
// ════════════════════════════════════════════

function simFmtEUR(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function simFmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n * 100).toFixed(2).replace('.', ',') + ' %';
}
function simFmtYears(n) {
  if (n == null || isNaN(n)) return '> 25 ans';
  return n.toFixed(1).replace('.', ',') + ' ans';
}

let SIM_DETAIL_REGIME = null;

function simRenderResults() {
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  if (!el) return;
  actions.innerHTML = '<button class="btn btn-outline" onclick="simShowView(\'form\')">← Modifier les paramètres</button>';

  if (!SIM_LAST_RESULTS) { el.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text2)">Aucun résultat à afficher.</div>'; return; }

  if (SIM_DETAIL_REGIME) {
    el.innerHTML = simRenderRegimeDetail(SIM_LAST_RESULTS.regimes.find(r => r.key === SIM_DETAIL_REGIME));
    return;
  }

  const regimes = SIM_LAST_RESULTS.regimes;
  const okRegimes = regimes.filter(r => !r.error);

  function best(metric, higherIsBetter) {
    const vals = okRegimes.map(r => r[metric]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    return higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  }
  const bestCashFlow = best('cashFlowCumuleFinal', true);
  const bestVan = best('van', true);
  const bestTri = best('tri', true);
  const bestDrci = best('drci', false);
  const bestRendement = best('rendementNetNet', true);

  const rows = regimes.map(r => {
    if (r.error) {
      return '<tr><td style="padding:14px 12px;font-weight:600;color:#eaf0ff">' + r.label + '</td><td colspan="6" style="padding:14px 12px;color:var(--red)">Erreur de calcul — voir console</td></tr>';
    }
    const hl = (v, b) => v === b && b != null ? 'color:#34d399;font-weight:700' : '';
    return '<tr class="sim-row-click" onclick="simOpenRegimeDetail(\'' + r.key + '\')">' +
      '<td style="padding:14px 12px;font-weight:600;color:#eaf0ff">' + r.label + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.cashFlowCumuleFinal, bestCashFlow) + '">' + simFmtEUR(r.cashFlowCumuleFinal) + '</td>' +
      '<td style="padding:14px 12px;text-align:right">' + simFmtPct(r.rendementNetNet) + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.van, bestVan) + '">' + simFmtEUR(r.van) + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.tri, bestTri) + '">' + (r.tri != null ? simFmtPct(r.tri) : '—') + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.drci, bestDrci) + '">' + simFmtYears(r.drci) + '</td>' +
      '<td style="padding:14px 12px;text-align:right;color:var(--text2)">' + simFmtEUR(r.totalImpot) + '</td>' +
      '</tr>';
  }).join('');

  el.innerHTML =
    '<div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">' +
      '<div>' +
        '<div style="font-size:22px;font-weight:700;color:#eaf0ff;margin-bottom:4px">Comparatif des régimes fiscaux</div>' +
        '<div style="font-size:12px;color:var(--text2)">Sur ' + SIM_LAST_RESULTS.inputs.dureeDetention + ' ans · Coût du projet ' + simFmtEUR(okRegimes[0] ? okRegimes[0].coutAcquisitionTotal : 0) + ' · Apport ' + simFmtEUR(SIM_LAST_RESULTS.inputs.apportPersonnel) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="sim-card" style="padding:0;overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;white-space:nowrap">' +
        '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08);color:var(--text2);text-transform:uppercase;font-size:10px;letter-spacing:.05em">' +
          '<th style="padding:12px;text-align:left">Régime</th>' +
          '<th style="padding:12px;text-align:right">Cash-flow net-net cumulé</th>' +
          '<th style="padding:12px;text-align:right">Rendement net-net</th>' +
          '<th style="padding:12px;text-align:right">VAN nette</th>' +
          '<th style="padding:12px;text-align:right">TRI</th>' +
          '<th style="padding:12px;text-align:right">DRCI</th>' +
          '<th style="padding:12px;text-align:right">Impôt total</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="margin-top:14px;font-size:11px;color:var(--text2)">Clique sur une ligne pour voir le détail année par année. Les valeurs en <span style="color:#34d399;font-weight:700">vert</span> indiquent le meilleur régime sur ce critère.</div>' +
    '<style>.sim-row-click{cursor:pointer;transition:background .15s}.sim-row-click:hover{background:rgba(52,211,153,.05)}.sim-row-click td{border-bottom:1px solid rgba(255,255,255,.04)}</style>';
}

function simOpenRegimeDetail(key) {
  SIM_DETAIL_REGIME = key;
  simRenderResults();
}

function simRenderRegimeDetail(r) {
  if (!r) return '<div>Régime introuvable.</div>';
  const actionsBack = '<div style="margin-bottom:20px"><button class="btn btn-outline" onclick="SIM_DETAIL_REGIME=null;simRenderResults()">← Retour au comparatif</button></div>';
  if (r.error) return actionsBack + '<div class="sim-card">Erreur de calcul pour ce régime : ' + r.error + '</div>';

  const rows = r.years.map(y =>
    '<tr>' +
      '<td style="padding:8px 10px">' + y.annee + '</td>' +
      '<td style="padding:8px 10px;text-align:right">' + simFmtEUR(y.produits) + '</td>' +
      '<td style="padding:8px 10px;text-align:right">' + simFmtEUR(-y.chargesDecaissees) + '</td>' +
      '<td style="padding:8px 10px;text-align:right">' + simFmtEUR(-y.amortissementEmprunt) + '</td>' +
      '<td style="padding:8px 10px;text-align:right">' + simFmtEUR(-y.impotLocatif) + '</td>' +
      '<td style="padding:8px 10px;text-align:right">' + (y.produitCession ? simFmtEUR(y.produitCession) : '—') + '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-weight:700;color:' + (y.cashFlowAnnuel >= 0 ? '#34d399' : 'var(--red)') + '">' + simFmtEUR(y.cashFlowAnnuel) + '</td>' +
      '<td style="padding:8px 10px;text-align:right;color:var(--text2)">' + simFmtEUR(y.cashFlowCumule) + '</td>' +
    '</tr>'
  ).join('');

  return actionsBack +
    '<div style="margin-bottom:20px">' +
      '<div style="font-size:20px;font-weight:700;color:#eaf0ff;margin-bottom:10px">' + r.label + '</div>' +
      '<div class="grid3" style="gap:14px">' +
        simDetailKpi('Cash-flow net-net cumulé', simFmtEUR(r.cashFlowCumuleFinal)) +
        simDetailKpi('Rendement net-net', simFmtPct(r.rendementNetNet)) +
        simDetailKpi('Rendement brut', simFmtPct(r.rendementBrut)) +
        simDetailKpi('VAN nette', simFmtEUR(r.van)) +
        simDetailKpi('TRI', r.tri != null ? simFmtPct(r.tri) : '—') +
        simDetailKpi('DRCI', simFmtYears(r.drci)) +
      '</div>' +
    '</div>' +
    '<div class="sim-card" style="padding:0;overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">' +
        '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08);color:var(--text2);text-transform:uppercase;font-size:10px;letter-spacing:.05em">' +
          '<th style="padding:10px">Année</th><th style="padding:10px;text-align:right">Produits</th>' +
          '<th style="padding:10px;text-align:right">Charges décaissées</th><th style="padding:10px;text-align:right">Capital emprunt</th>' +
          '<th style="padding:10px;text-align:right">Impôt</th><th style="padding:10px;text-align:right">Cession</th>' +
          '<th style="padding:10px;text-align:right">Cash-flow annuel</th><th style="padding:10px;text-align:right">Cumulé</th>' +
        '</tr></thead><tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
}

function simDetailKpi(label, value) {
  return '<div class="sim-card"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text2);margin-bottom:6px">' + label + '</div><div style="font-size:18px;font-weight:700;color:#eaf0ff">' + value + '</div></div>';
}
