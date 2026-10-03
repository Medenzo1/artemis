// ════════════════════════════════════════════
//  SIMULATEUR — RÉSULTATS
//  Synthèse = onglet « 💰 SYNTHÈSE » du classeur ; détail d'un régime = son onglet (✔️ …),
//  lu cellule par cellule dans le moteur (aucun recalcul propre au site).
// ════════════════════════════════════════════

const SIM_SYN = '💰 SYNTHÈSE';
const SIM_LOAN = '🔎 EMPRUNT';

// Lignes de la synthèse, onglet de chaque régime, bloc d'emprunt utilisé (colonne de début dans 🔎 EMPRUNT)
// et cellule « POSSIBLE / IMPOSSIBLE » de l'onglet du régime.
const SIM_REGIMES = [
  { key: 'lmnp_reel',   row: 6,  sheet: '✔️ LMNP - BIC RÉEL',        loanCol: 2,  elig: null },
  { key: 'lmnp_micro',  row: 8,  sheet: '✔️ LMNP - MICRO BIC',       loanCol: 2,  elig: i => i.meubleTourisme === 'OUI' ? 'T6' : 'T3' },
  { key: 'lmp_reel',    row: 10, sheet: '✔️ LMP - BIC RÉEL',         loanCol: 2,  elig: 'T3' },
  { key: 'rf_reel',     row: 12, sheet: '✔️ RF - RÉEL',              loanCol: 20, elig: null },
  { key: 'rf_micro',    row: 14, sheet: '✔️ RF - MICRO FONCIER',     loanCol: 20, elig: 'T3' },
  { key: 'pinel_reel',  row: 16, sheet: '✔️ PINEL - RÉEL',           loanCol: 20, elig: 'T3' },
  { key: 'pinel_micro', row: 18, sheet: '✔️ PINEL - MICRO FONCIER',  loanCol: 20, elig: 'T3' },
  { key: 'is_sans',     row: 20, sheet: '✔ STÉ IS - SANS DISTRIB.',  loanCol: 38, elig: null },
  { key: 'is_avec',     row: 22, sheet: '✔ STÉ IS - AVEC DISTRIB.',  loanCol: 38, elig: null },
];

// Colonnes de la synthèse Excel
const SIM_COLS = [
  { k: 'cf',     col: 'H',  label: 'Cash-flow net-net cumulé',  fmt: 'eur', best: 'max' },
  { k: 'impRev', col: 'K',  label: 'Impôt sur les revenus locatifs', fmt: 'eur', best: 'min' },
  { k: 'impPv',  col: 'N',  label: 'Impôt sur la plus-value',   fmt: 'eur', best: 'min' },
  { k: 'rnn',    col: 'Q',  label: 'Rendement net-net',          fmt: 'pct', best: 'max' },
  { k: 'van',    col: 'T',  label: 'VAN nette',                  fmt: 'eur', best: 'max' },
  { k: 'tri',    col: 'W',  label: 'TRI',                        fmt: 'pct', best: 'max' },
  { k: 'drci',   col: 'Z',  label: 'DRCI',                       fmt: 'yrs', best: 'min' },
];

let SIM_DETAIL_REGIME = null;

// ── Formats ──
function simFmtEUR(n) {
  if (typeof n !== 'number' || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function simFmtPct(n, dec) {
  if (typeof n !== 'number' || isNaN(n)) return '—';
  return (n * 100).toLocaleString('fr-FR', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec }) + ' %';
}
// Libellés du classeur (en majuscules) → casse de phrase, sigles conservés
const SIM_ACRONYMS = ['lmnp','lmp','bic','is','ir','pv','mv','lt','ct','qf','csg/crds','cfe','cga','crl','tmi','rf','van','tri','drci','pno','gli','tva','pfu'];
function simSentence(s) {
  s = String(s == null ? '' : s).trim();
  if (!s) return '';
  let t = s.toLowerCase();
  SIM_ACRONYMS.forEach(a => {
    const re = new RegExp('(^|[^a-zà-ÿ])(' + a.replace(/[/+]/g, m => '\\' + m) + ')(?=$|[^a-zà-ÿ])', 'g');
    t = t.replace(re, (m, p1, p2) => p1 + p2.toUpperCase());
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
// Valeur de synthèse → texte (les cellules Excel peuvent contenir un nombre, un texte ou une erreur)
function simDisp(v, fmt) {
  if (SimXL.isErr(v)) return '<span title="' + v.code + '">—</span>';
  if (typeof v !== 'number') {
    const s = String(v == null || v === SimXL.BLANK ? '' : v).trim();
    if (!s || s === '-') return '—';
    return escHtml(simSentence(s));
  }
  if (fmt === 'pct') return simFmtPct(v);
  if (fmt === 'yrs') return v.toLocaleString('fr-FR') + ' an' + (v > 1 ? 's' : '');
  return simFmtEUR(v);
}
const simIsNum = v => typeof v === 'number' && isFinite(v);

// ── Lecture de la synthèse ──
function simRegimeRows(wb, inputs) {
  return SIM_REGIMES.map(r => {
    const o = { key: r.key, sheet: r.sheet, label: simSentence(wb.get(SIM_SYN, 'C' + r.row)), conf: r };
    SIM_COLS.forEach(c => { o[c.k] = wb.get(SIM_SYN, c.col + r.row); });
    o.regle = wb.get(SIM_SYN, 'AC' + r.row);
    const cell = typeof r.elig === 'function' ? r.elig(inputs) : r.elig;
    const st = cell ? wb.get(r.sheet, cell) : 'POSSIBLE';
    o.impossible = typeof st === 'string' && /^IMPOSSIBLE/i.test(st)
      ? simSentence(st).replace(/(\d{4,})\s*€/, (m, n) => (+n).toLocaleString('fr-FR') + ' €')
      : null;
    return o;
  });
}
// Nombre d'années de la synthèse (cellule AN35) : durée de détention, sinon durée du crédit, sinon 25 ans
function simHorizon(wb) {
  const v = wb.get(SIM_SYN, 'AN35');
  return typeof v === 'number' ? Math.max(1, Math.min(25, Math.round(v))) : 25;
}

// ════════════════════════════════════════════
//  Barres horizontales (synthèse graphique du classeur) — valeurs dans une colonne à part,
//  jamais par-dessus les libellés, y compris pour les montants négatifs
// ════════════════════════════════════════════
function simHBars(items, opts) {
  opts = opts || {};
  const fmt = opts.fmt || simFmtEUR;
  const colors = opts.colors || ['#34d399'];
  let lo = 0, hi = 0;
  items.forEach(it => {
    let pos = 0, neg = 0;
    it.values.forEach(v => { if (simIsNum(v)) { if (v >= 0) pos += v; else neg += v; } });
    hi = Math.max(hi, pos); lo = Math.min(lo, neg);
  });
  const span = (hi - lo) || 1;
  const x0 = (-lo / span) * 100;
  const rows = items.map(it => {
    let accP = 0, accN = 0;
    const segs = it.values.map((v, k) => {
      if (!simIsNum(v) || v === 0) return '';
      let left, width;
      if (v >= 0) { left = x0 + accP / span * 100; width = v / span * 100; accP += v; }
      else { accN += v; left = x0 + accN / span * 100; width = -v / span * 100; }
      const col = it.best && k === 0 && it.values.length === 1 ? '#34d399' : colors[k % colors.length];
      return '<span class="sim-hb-seg" style="left:' + left.toFixed(3) + '%;width:' + Math.max(width, 0.4).toFixed(3) + '%;background:' + (v < 0 ? '#f0566a' : col) + '"></span>';
    }).join('');
    const total = it.values.reduce((t, v) => t + (simIsNum(v) ? v : 0), 0);
    const hasNum = it.values.some(simIsNum);
    return '<div class="sim-hb-row' + (it.dim ? ' is-dim' : '') + (it.best ? ' is-best' : '') + '"' + (it.title ? ' title="' + escHtml(it.title) + '"' : '') + '>' +
      '<span class="sim-hb-lbl">' + escHtml(it.label) + '</span>' +
      '<span class="sim-hb-track"><span class="sim-hb-zero" style="left:' + x0.toFixed(3) + '%"></span>' + segs + '</span>' +
      '<span class="sim-hb-val">' + (hasNum ? fmt(total) : '—') + '</span>' +
    '</div>';
  }).join('');
  const legend = opts.legend ? '<div class="sim-hb-legend">' + opts.legend.map((l, k) => '<span><i style="background:' + colors[k] + '"></i>' + l + '</span>').join('') + '</div>' : '';
  return '<div class="sim-hb">' + rows + '</div>' + legend;
}

// ════════════════════════════════════════════
//  Vue comparatif (= onglet SYNTHÈSE)
// ════════════════════════════════════════════
function simRenderResults() {
  const el = document.getElementById('sim-content');
  const actions = document.getElementById('sim-header-actions');
  if (!el) return;
  if (!SIM_LAST_RESULTS) { el.innerHTML = '<div class="sim-empty">Aucun résultat à afficher.</div>'; return; }
  const inputs = SIM_LAST_RESULTS.inputs;
  const wb = simCompute(inputs);

  if (SIM_DETAIL_REGIME) {
    actions.innerHTML = '<button class="btn btn-outline" onclick="SIM_DETAIL_REGIME=null;simRenderResults()">← Comparatif</button>' +
      '<button class="btn btn-outline" onclick="simShowView(\'form\')">Modifier les paramètres</button>';
    simRenderRegimeDetail(el, wb, inputs, SIM_DETAIL_REGIME);
    return;
  }
  actions.innerHTML = '<button class="btn btn-outline" onclick="simShowView(\'form\')">← Modifier les paramètres</button>';

  const rows = simRegimeRows(wb, inputs);
  const possible = rows.filter(r => !r.impossible);
  const bestOf = c => {
    const vals = possible.map(r => r[c.k]).filter(simIsNum);
    if (!vals.length) return null;
    return c.best === 'max' ? Math.max(...vals) : Math.min(...vals);
  };
  const best = {};
  SIM_COLS.forEach(c => { best[c.k] = bestOf(c); });
  const winner = possible.filter(r => simIsNum(r.cf)).sort((a, b) => b.cf - a.cf)[0];

  const title = simSentence(wb.get(SIM_SYN, 'B1')) || 'Synthèse du projet';
  const LMNP = SIM_REGIMES[0].sheet;
  const cout = wb.get(LMNP, 'C3'), emprunt = +inputs.dureeEmprunt > 0 ? wb.get(LMNP, 'P5') : 0;
  const regleLbl = 'Règle des ' + Math.round((+inputs.reglesFinancementPct || 0) * 100) + ' %';

  const tableRows = rows.map(r => {
    const cells = SIM_COLS.map(c => {
      const isBest = !r.impossible && simIsNum(r[c.k]) && best[c.k] !== null && r[c.k] === best[c.k];
      return '<td class="num' + (isBest ? ' is-best' : '') + '">' + simDisp(r[c.k], c.fmt) + '</td>';
    }).join('');
    const regle = String(r.regle);
    return '<tr class="sim-row-click' + (r.impossible ? ' is-impossible' : '') + '" onclick="simOpenRegimeDetail(\'' + r.key + '\')" tabindex="0" onkeydown="if(event.key===\'Enter\')simOpenRegimeDetail(\'' + r.key + '\')">' +
      '<td class="sim-reg-name">' + escHtml(r.label) + (r.impossible ? '<span class="sim-badge-imp" title="' + escHtml(r.impossible) + '">' + icon('alert-triangle', {size:11}) + ' ' + escHtml(r.impossible) + '</span>' : '') + '</td>' +
      cells +
      '<td class="num"><span class="sim-yn ' + (regle === 'OUI' ? 'ok' : regle === 'NON' ? 'ko' : '') + '">' + (regle === 'NS' ? 'NS' : escHtml(simSentence(regle) || '—')) + '</span></td>' +
    '</tr>';
  }).join('');

  const short = r => {
    const map = { lmnp_reel: 'LMNP réel', lmnp_micro: 'LMNP micro-BIC', lmp_reel: 'LMP réel', rf_reel: 'Foncier réel', rf_micro: 'Micro-foncier', pinel_reel: 'Pinel réel', pinel_micro: 'Pinel micro', is_sans: 'IS sans distrib.', is_avec: 'IS avec distrib.' };
    return map[r.key] || r.label;
  };
  const chartItems = (k, opt) => rows.map(r => ({
    label: short(r), values: Array.isArray(k) ? k.map(x => r[x]) : [r[k]], dim: !!r.impossible,
    best: !Array.isArray(k) && !r.impossible && simIsNum(r[k]) && r[k] === best[k], title: r.impossible || r.label,
  }));

  el.innerHTML =
    '<div class="sim-head">' +
      '<div>' +
        '<h1 class="sim-h1">' + escHtml(title) + '</h1>' +
        '<div class="sim-sub">Coût du projet (meublé) ' + simFmtEUR(cout) + ' · Apport ' + simFmtEUR(+inputs.apportPersonnel || 0) + ' · Emprunt ' + simFmtEUR(simIsNum(emprunt) ? emprunt : 0) + (+inputs.dureeEmprunt > 0 ? ' sur ' + inputs.dureeEmprunt + ' ans' : '') + '</div>' +
      '</div>' +
    '</div>' +

    (winner ?
      '<div class="sim-card sim-winner">' +
        '<div class="sim-winner-top">' + icon('trophy', {size:16}) + '<span>Meilleur cash-flow net-net cumulé parmi les régimes possibles</span></div>' +
        '<div class="sim-winner-name">' + escHtml(winner.label) + '</div>' +
        '<div class="sim-kpis">' +
          simDetailKpi('Cash-flow net-net cumulé', simDisp(winner.cf, 'eur')) +
          simDetailKpi('VAN nette', simDisp(winner.van, 'eur')) +
          simDetailKpi('TRI', simDisp(winner.tri, 'pct')) +
          simDetailKpi('DRCI', simDisp(winner.drci, 'yrs')) +
        '</div>' +
      '</div>' : '') +

    '<div class="sim-card sim-table-card">' +
      '<div class="sim-card-head"><div class="sim-card-h">Synthèse chiffrée</div><div class="sim-card-note">En vert : la meilleure valeur parmi les régimes possibles. Cliquez sur un régime pour son détail année par année.</div></div>' +
      '<div class="sim-table-scroll">' +
      '<table class="sim-cmp">' +
        '<thead><tr><th>Régime</th>' + SIM_COLS.map(c => '<th class="num">' + c.label + '</th>').join('') + '<th class="num">' + regleLbl + '</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table></div>' +
    '</div>' +

    '<div class="sim-charts">' +
      '<div class="sim-card"><div class="sim-card-h">Cash-flow net-net cumulé</div>' + simHBars(chartItems('cf'), { colors: ['#7e8fa8'] }) + '</div>' +
      '<div class="sim-card"><div class="sim-card-h">Impôt sur les revenus locatifs + impôt sur la plus-value</div>' + simHBars(chartItems(['impRev', 'impPv']), { colors: ['#9b6ef3', '#f5b731'], legend: ['Revenus locatifs', 'Plus-value'] }) + '</div>' +
      '<div class="sim-card"><div class="sim-card-h">VAN nette</div>' + simHBars(chartItems('van'), { colors: ['#7e8fa8'] }) + '</div>' +
      '<div class="sim-card"><div class="sim-card-h">TRI</div>' + simHBars(chartItems('tri'), { colors: ['#7e8fa8'], fmt: v => simFmtPct(v) }) + '</div>' +
    '</div>';
}

function simOpenRegimeDetail(key) {
  SIM_DETAIL_REGIME = key;
  simRenderResults();
  const ss = document.getElementById('simulateurScreen');
  if (ss) ss.scrollTop = 0;
}

function simDetailKpi(label, value) {
  return '<div class="sim-kpi"><div class="sim-kpi-l">' + label + '</div><div class="sim-kpi-v">' + value + '</div></div>';
}

// ════════════════════════════════════════════
//  Détail d'un régime = son onglet du classeur
// ════════════════════════════════════════════
function simCellFmt(v, code) {
  if (SimXL.isErr(v)) return '<span class="sim-err" title="' + v.code + '">—</span>';
  if (typeof v !== 'number') {
    const s = v === SimXL.BLANK || v == null ? '' : String(v);
    return escHtml(s === '-' ? '–' : simSentence(s));
  }
  const grp = (n, d) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (code && code[0] === 'p') {
    const p = v * 100;
    return grp(p, Math.abs(p - Math.round(p)) < 1e-9 ? 0 : 2) + ' %';
  }
  if (code === 'n1') return grp(v, 1);
  if (code === 'e') {
    const r = Math.round(v);
    if (r === 0) return '<span class="sim-zero">–</span>';
    return (r < 0 ? '−' : '') + grp(Math.abs(r), 0);
  }
  if (code === 'i') return (v < 0 ? '−' : '') + grp(Math.abs(Math.round(v)), 0);
  return Number.isInteger(v) ? grp(v, 0) : grp(v, 2);
}

function simSheetSections(wb, sheet, horizon) {
  const si = SIM_MODEL.sheets.indexOf(sheet);
  const meta = SIM_MODEL.m[si] || [];
  const label = r => wb.getRC(sheet, r, 2);
  const firstYear = meta.find(m => label(m[0]) === 'ANNÉE');
  if (!firstYear) return [];
  const start = firstYear[0] - 1;
  const sections = [];
  let cur = null;
  meta.forEach(([r, hidden, code]) => {
    if (r < start) return;
    const lb = label(r);
    if (typeof lb !== 'string' || !lb.trim() || lb === 'ANNÉE') return;
    const vals = [];
    for (let c = 3; c < 3 + horizon; c++) vals.push(wb.getRC(sheet, r, c));
    const empty = vals.every(v => v === SimXL.BLANK || v === '' || v == null);
    if (empty && !hidden) { cur = { title: lb, rows: [] }; sections.push(cur); return; }
    if (!cur) { cur = { title: '', rows: [] }; sections.push(cur); }
    cur.rows.push({ r, label: lb, hidden: !!hidden, code, vals, sub: empty });
  });
  return sections.filter(s => s.rows.some(x => !x.sub));
}

function simToggleDetail(btn) {
  const card = btn.closest('.sim-sheet');
  const open = card.classList.toggle('show-detail');
  btn.innerHTML = (open ? 'Masquer le détail' : 'Afficher le détail') + ' ' + icon('chevron-down', {size:12});
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function simRenderRegimeDetail(el, wb, inputs, key) {
  const conf = SIM_REGIMES.find(r => r.key === key);
  if (!conf) { el.innerHTML = '<div class="sim-empty">Régime introuvable.</div>'; return; }
  const row = simRegimeRows(wb, inputs).find(r => r.key === key);
  const H = simHorizon(wb);
  const sheet = conf.sheet;

  // Graphique : cash-flow annuel (barres) et cumulé (courbe), lignes « CASH FLOW NET NET … » de l'onglet
  const si = SIM_MODEL.sheets.indexOf(sheet);
  const findRow = txt => (SIM_MODEL.m[si] || []).map(m => m[0]).find(r => wb.getRC(sheet, r, 2) === txt);
  const rA = findRow('CASH FLOW NET NET ANNUEL'), rC = findRow('CASH FLOW NET NET CUMULÉ');
  const yearVals = r => Array.from({ length: H }, (_, k) => { const v = r ? wb.getRC(sheet, r, 3 + k) : 0; return simIsNum(v) ? v : 0; });

  const sections = simSheetSections(wb, sheet, H);
  const head = '<tr><th>' + 'Année' + '</th>' + Array.from({ length: H }, (_, k) => '<th class="num">' + (k + 1) + '</th>').join('') + '</tr>';
  const sectionsHtml = sections.map(s => {
    const nDetail = s.rows.filter(x => x.hidden).length;
    const body = s.rows.map(x => {
      if (x.sub) return '<tr class="sim-sub-row' + (x.hidden ? ' is-detail' : '') + '"><td colspan="' + (H + 1) + '">' + escHtml(simSentence(x.label)) + '</td></tr>';
      const strong = /CASH FLOW NET NET|IMPÔT SUR LE REVENU AVEC|RÉSULTAT IMPOSABLE|IMPÔT SUR LA PLUS-VALUE AVEC|^PRODUITS$|^CHARGES/.test(x.label);
      return '<tr class="' + (x.hidden ? 'is-detail' : '') + (strong ? ' is-strong' : '') + '"><td>' + escHtml(simSentence(x.label)) + '</td>' +
        x.vals.map(v => '<td class="num' + (simIsNum(v) && v < 0 && x.code === 'e' && Math.round(v) !== 0 ? ' neg' : '') + '">' + simCellFmt(v, x.code) + '</td>').join('') + '</tr>';
    }).join('');
    return '<div class="sim-card sim-sheet">' +
      '<div class="sim-card-head"><div class="sim-card-h">' + escHtml(simSentence(s.title)) + '</div>' +
        (nDetail ? '<button class="btn btn-outline sim-detail-btn" onclick="simToggleDetail(this)" aria-expanded="false">Afficher le détail ' + icon('chevron-down', {size:12}) + '</button>' : '') +
      '</div>' +
      '<div class="sim-table-scroll"><table class="sim-sheet-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    '</div>';
  }).join('');

  // Tableau d'emprunt du régime (🔎 EMPRUNT, par année)
  let loanHtml = '';
  const L7 = +inputs.dureeEmprunt || 0;
  if (L7 > 0) {
    const c0 = conf.loanCol;
    const hdr = [1, 2, 3, 4, 5].map(k => wb.getRC(SIM_LOAN, 12, c0 + k));
    const lrows = [];
    for (let y = 1; y <= L7; y++) {
      const rr = 13 + y;
      lrows.push('<tr><td>' + y + '</td>' + [1, 2, 3, 4, 5].map(k => '<td class="num">' + simCellFmt(wb.getRC(SIM_LOAN, rr, c0 + k), 'e') + '</td>').join('') + '</tr>');
    }
    loanHtml = '<div class="sim-card sim-sheet">' +
      '<div class="sim-card-head"><div class="sim-card-h">' + escHtml(simSentence(wb.getRC(SIM_LOAN, 1, c0))) + '</div>' +
      '<div class="sim-card-note">Coût total du crédit : ' + simDisp(wb.getRC(SIM_LOAN, 6, c0 + 5), 'eur') + ' (intérêts ' + simDisp(wb.getRC(SIM_LOAN, 4, c0 + 5), 'eur') + ', assurance ' + simDisp(wb.getRC(SIM_LOAN, 5, c0 + 5), 'eur') + ')</div></div>' +
      '<div class="sim-table-scroll"><table class="sim-sheet-table sim-loan-table"><thead><tr><th>Année</th>' + hdr.map(h => '<th class="num">' + escHtml(String(h)) + '</th>').join('') + '</tr></thead><tbody>' + lrows.join('') + '</tbody></table></div>' +
    '</div>';
  }

  const regle = String(row.regle);
  el.innerHTML =
    '<div class="sim-head">' +
      '<div>' +
        '<h1 class="sim-h1">' + escHtml(row.label) + '</h1>' +
        '<div class="sim-sub">' + escHtml(simSentence(wb.getRC(sheet, 1, 2))) + ' · ' + H + ' ans ' + (inputs.dureeDetention === SIM_NO_RESALE ? 'sans revente' : 'avec revente') + '</div>' +
      '</div>' +
    '</div>' +
    (row.impossible ? '<div class="sim-alert">' + icon('alert-triangle', {size:14}) + '<span>Selon le classeur, ce régime est <b>' + escHtml(row.impossible.toLowerCase()) + '</b>. Les chiffres sont donnés à titre indicatif.</span></div>' : '') +
    '<div class="sim-kpis sim-kpis-detail">' +
      SIM_COLS.map(c => simDetailKpi(c.label, simDisp(row[c.k], c.fmt))).join('') +
      simDetailKpi('Règle des ' + Math.round((+inputs.reglesFinancementPct || 0) * 100) + ' %', '<span class="sim-yn ' + (regle === 'OUI' ? 'ok' : regle === 'NON' ? 'ko' : '') + '">' + escHtml(regle === 'NS' ? 'Sans objet' : simSentence(regle)) + '</span>') +
    '</div>' +
    '<div class="sim-card"><div class="sim-card-head"><div class="sim-card-h">Cash-flow net-net par année</div><div class="sim-card-note">Barres : cash-flow de l\'année (produit de cession inclus l\'année de revente) · Courbe : cumul</div></div>' +
      '<div class="ac-wrap"><canvas id="sim-cf-chart"></canvas></div></div>' +
    sectionsHtml +
    loanHtml;

  const cv = document.getElementById('sim-cf-chart');
  if (cv && typeof ArtCharts !== 'undefined') {
    ArtCharts.combo(cv, {
      labels: Array.from({ length: H }, (_, k) => 'An ' + (k + 1)),
      bars: [{ name: 'Cash-flow annuel', values: yearVals(rA), color: '#9b6ef3' }],
      line: { name: 'Cumulé', values: yearVals(rC), color: '#34d399' },
      height: 260,
    });
  }
}
