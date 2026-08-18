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
function simSvgEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

let SIM_DETAIL_REGIME = null;

// ════════════════════════════════════════════
//  Graphique en barres — classement des régimes
// ════════════════════════════════════════════
function simBarRankingChart(items, opts) {
  opts = opts || {};
  const fmt = opts.fmt || simFmtEUR;
  const W = 680;
  const barH = 26, gap = 12, labelW = 175;
  const chartW = W - labelW - 90;
  const n = items.length;
  const H = n * (barH + gap) - gap + 8;
  const vals = items.map(it => it.value || 0);
  const maxVal = Math.max(...vals, 0);
  const minVal = Math.min(...vals, 0);
  const scaleMax = (maxVal - minVal) || 1;
  const zeroX = labelW + (0 - minVal) / scaleMax * chartW;
  const bestVal = opts.higherIsBetter === false ? Math.min(...vals) : Math.max(...vals);

  let bars = '';
  items.forEach((it, i) => {
    const y = i * (barH + gap) + 4;
    const v = it.value || 0;
    const isBest = v === bestVal;
    const barW = Math.max(Math.abs(v) / scaleMax * chartW, v === 0 ? 0 : 2);
    const x = v >= 0 ? zeroX : zeroX - barW;
    const color = isBest ? '#34d399' : 'rgba(255,255,255,.14)';
    bars +=
      '<text x="' + (labelW - 10) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="11" fill="' + (isBest ? '#eaf0ff' : 'rgba(234,240,255,.65)') + '" font-weight="' + (isBest ? 700 : 500) + '">' + simSvgEsc(it.label) + '</text>' +
      '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + barW.toFixed(1) + '" height="' + barH + '" rx="5" fill="' + color + '">' +
        '<title>' + simSvgEsc(it.label) + ' — ' + fmt(v) + '</title>' +
      '</rect>' +
      '<text x="' + (v >= 0 ? (x + barW + 8) : (x - 8)) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="' + (v >= 0 ? 'start' : 'end') + '" font-size="11" font-family="monospace" font-weight="700" fill="' + (isBest ? '#34d399' : 'var(--text2)') + '">' + fmt(v) + '</text>';
  });

  return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block;min-width:' + W + 'px">' + bars + '</svg></div>';
}

// ════════════════════════════════════════════
//  Graphique de trajectoire (aire) avec crosshair + tooltip au survol
// ════════════════════════════════════════════
function simAreaChartWithHover(points, opts) {
  opts = opts || {};
  const fmt = opts.fmt || simFmtEUR;
  const color = opts.color || '#34d399';
  const W = 820, H = 240, padL = 8, padR = 8, padT = 16, padB = 26;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  if (!points.length) return '<div style="color:var(--text2);font-size:12px">Pas de données.</div>';
  const ys = points.map(p => p.y);
  const minY = Math.min(0, ...ys), maxY = Math.max(0, ...ys);
  const rangeY = (maxY - minY) || 1;
  const xAt = i => padL + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2);
  const yAt = v => padT + (1 - (v - minY) / rangeY) * chartH;
  const zeroY = yAt(0);

  const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(p.y).toFixed(1)).join(' ');
  const areaPath = linePath + ' L' + xAt(points.length - 1).toFixed(1) + ',' + zeroY.toFixed(1) + ' L' + xAt(0).toFixed(1) + ',' + zeroY.toFixed(1) + ' Z';
  const gid = 'simArea' + Math.random().toString(36).slice(2, 8);

  const step = Math.max(1, Math.ceil(points.length / 8));
  const xLabels = points.map((p, i) => (i % step === 0 || i === points.length - 1)
    ? '<text x="' + xAt(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text2)">An ' + p.x + '</text>' : ''
  ).join('');

  const dots = points.map((p, i) =>
    '<circle class="sim-hover-dot" data-x="' + xAt(i).toFixed(1) + '" data-y="' + yAt(p.y).toFixed(1) + '" data-label="Année ' + p.x + '" data-val="' + simSvgEsc(fmt(p.y)) + '" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.y).toFixed(1) + '" r="12" fill="transparent" style="cursor:crosshair" onmouseenter="simChartHover(event,this)" onmouseleave="simChartHoverOut(event,this)"/>'
  ).join('');

  return '<div class="sim-chart-wrap" style="position:relative">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + color + '" stop-opacity=".3"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<line x1="' + padL + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + zeroY.toFixed(1) + '" stroke="rgba(255,255,255,.1)" stroke-width="1"/>' +
      '<path d="' + areaPath + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + linePath + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      xLabels +
      '<g class="sim-crosshair" style="display:none">' +
        '<line class="sim-crosshair-line" x1="0" y1="' + padT + '" x2="0" y2="' + (H - padB) + '" stroke="' + color + '" stroke-width="1" stroke-dasharray="3,3"/>' +
        '<circle class="sim-crosshair-dot" r="4" fill="' + color + '" stroke="#04140d" stroke-width="2"/>' +
      '</g>' +
      dots +
    '</svg>' +
    '<div class="sim-tooltip" style="display:none;position:absolute;pointer-events:none;background:#0b1420;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 10px;font-size:11px;color:#eaf0ff;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:5"></div>' +
  '</div>';
}

function simChartHover(ev, dot) {
  const wrap = dot.closest('.sim-chart-wrap');
  if (!wrap) return;
  const svg = wrap.querySelector('svg');
  const tooltip = wrap.querySelector('.sim-tooltip');
  const crosshair = svg.querySelector('.sim-crosshair');
  const x = dot.getAttribute('data-x'), y = dot.getAttribute('data-y');
  crosshair.style.display = '';
  const line = crosshair.querySelector('.sim-crosshair-line');
  line.setAttribute('x1', x); line.setAttribute('x2', x);
  const cdot = crosshair.querySelector('.sim-crosshair-dot');
  cdot.setAttribute('cx', x); cdot.setAttribute('cy', y);

  tooltip.style.display = 'block';
  tooltip.innerHTML = '<div style="font-weight:700;margin-bottom:2px;color:#eaf0ff">' + dot.getAttribute('data-label') + '</div><div style="color:#34d399;font-family:monospace;font-weight:700">' + dot.getAttribute('data-val') + '</div>';

  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const scaleX = rect.width / vb.width, scaleY = rect.height / vb.height;
  const px = parseFloat(x) * scaleX, py = parseFloat(y) * scaleY;
  const wrapRect = wrap.getBoundingClientRect();
  const left = Math.max(4, Math.min(px + 12, wrapRect.width - 130));
  tooltip.style.left = left + 'px';
  tooltip.style.top = Math.max(0, py - 44) + 'px';
}
function simChartHoverOut(ev, dot) {
  const wrap = dot.closest('.sim-chart-wrap');
  if (!wrap) return;
  wrap.querySelector('.sim-crosshair').style.display = 'none';
  wrap.querySelector('.sim-tooltip').style.display = 'none';
}

// ════════════════════════════════════════════
//  Vue comparatif
// ════════════════════════════════════════════
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
  const sorted = okRegimes.slice().sort((a, b) => (b.cashFlowCumuleFinal || 0) - (a.cashFlowCumuleFinal || 0));

  function best(metric, higherIsBetter) {
    const vals = okRegimes.map(r => r[metric]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    return higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  }
  const bestCashFlow = best('cashFlowCumuleFinal', true);
  const bestVan = best('van', true);
  const bestTri = best('tri', true);
  const bestDrci = best('drci', false);

  const chartHtml = simBarRankingChart(sorted.map(r => ({ label: r.label, value: r.cashFlowCumuleFinal })), { fmt: simFmtEUR });

  const rows = regimes.map(r => {
    if (r.error) {
      return '<tr><td style="padding:14px 12px;font-weight:600;color:#eaf0ff">' + r.label + '</td><td colspan="6" style="padding:14px 12px;color:var(--red)">Erreur de calcul — voir console</td></tr>';
    }
    const hl = (v, b) => v === b && b != null ? 'color:#34d399;font-weight:700' : '';
    const spark = (typeof _sparkline === 'function' && r.years.length > 1)
      ? _sparkline(r.years.map(y => y.cashFlowCumule), r.cashFlowCumuleFinal === bestCashFlow ? '#34d399' : '#7e8fa8')
      : '';
    return '<tr class="sim-row-click" onclick="simOpenRegimeDetail(\'' + r.key + '\')">' +
      '<td style="padding:14px 12px;font-weight:600;color:#eaf0ff">' + r.label + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.cashFlowCumuleFinal, bestCashFlow) + '">' + simFmtEUR(r.cashFlowCumuleFinal) + '</td>' +
      '<td style="padding:6px 12px;text-align:center">' + spark + '</td>' +
      '<td style="padding:14px 12px;text-align:right">' + simFmtPct(r.rendementNetNet) + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.van, bestVan) + '">' + simFmtEUR(r.van) + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.tri, bestTri) + '">' + (r.tri != null ? simFmtPct(r.tri) : '—') + '</td>' +
      '<td style="padding:14px 12px;text-align:right;' + hl(r.drci, bestDrci) + '">' + simFmtYears(r.drci) + '</td>' +
      '<td style="padding:14px 12px;text-align:right;color:var(--text2)">' + simFmtEUR(r.totalImpot) + '</td>' +
      '</tr>';
  }).join('');

  const winner = sorted[0];

  el.innerHTML =
    '<div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">' +
      '<div>' +
        '<div style="font-size:22px;font-weight:700;color:#eaf0ff;margin-bottom:4px">Comparatif des régimes fiscaux</div>' +
        '<div style="font-size:12px;color:var(--text2)">Sur ' + SIM_LAST_RESULTS.inputs.dureeDetention + ' ans · Coût du projet ' + simFmtEUR(okRegimes[0] ? okRegimes[0].coutAcquisitionTotal : 0) + ' · Apport ' + simFmtEUR(SIM_LAST_RESULTS.inputs.apportPersonnel) + '</div>' +
      '</div>' +
    '</div>' +

    (winner ?
      '<div class="sim-card" style="margin-bottom:18px;background:linear-gradient(135deg,rgba(52,211,153,.10),rgba(16,185,129,.02));border-color:rgba(52,211,153,.25)">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">' +
          '<span style="font-size:18px">🏆</span>' +
          '<span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#34d399;font-weight:700">Régime le plus avantageux sur ce critère</span>' +
        '</div>' +
        '<div style="font-size:19px;font-weight:800;color:#eaf0ff;margin-bottom:10px">' + winner.label + '</div>' +
        '<div class="grid3" style="gap:14px">' +
          simDetailKpi('Cash-flow net-net cumulé', simFmtEUR(winner.cashFlowCumuleFinal)) +
          simDetailKpi('VAN nette', simFmtEUR(winner.van)) +
          simDetailKpi('TRI', winner.tri != null ? simFmtPct(winner.tri) : '—') +
        '</div>' +
      '</div>'
    : '') +

    '<div class="sim-card" style="margin-bottom:18px">' +
      '<div style="font-size:12px;font-weight:700;color:#eaf0ff;margin-bottom:16px">Classement par cash-flow net-net cumulé</div>' +
      chartHtml +
    '</div>' +

    '<div class="sim-card" style="padding:0;overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;white-space:nowrap">' +
        '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08);color:var(--text2);text-transform:uppercase;font-size:10px;letter-spacing:.05em">' +
          '<th style="padding:12px;text-align:left">Régime</th>' +
          '<th style="padding:12px;text-align:right">Cash-flow net-net cumulé</th>' +
          '<th style="padding:12px;text-align:center">Trajectoire</th>' +
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

  const cumulPoints = r.years.map(y => ({ x: y.annee, y: y.cashFlowCumule }));
  const annuelPoints = r.years.map(y => ({ x: y.annee, y: y.cashFlowAnnuel }));

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

    '<div class="sim-card" style="margin-bottom:18px">' +
      '<div style="font-size:12px;font-weight:700;color:#eaf0ff;margin-bottom:6px">Trajectoire du cash-flow cumulé</div>' +
      '<div style="font-size:10px;color:var(--text2);margin-bottom:10px">Survole le graphique pour voir le détail année par année</div>' +
      simAreaChartWithHover(cumulPoints, { color: '#34d399', fmt: simFmtEUR }) +
    '</div>' +

    '<div class="sim-card" style="margin-bottom:18px">' +
      '<div style="font-size:12px;font-weight:700;color:#eaf0ff;margin-bottom:6px">Cash-flow annuel</div>' +
      '<div style="font-size:10px;color:var(--text2);margin-bottom:10px">Produits − charges − capital emprunt − impôt (+ cession l\'année de revente)</div>' +
      simAreaChartWithHover(annuelPoints, { color: '#9b6ef3', fmt: simFmtEUR }) +
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
