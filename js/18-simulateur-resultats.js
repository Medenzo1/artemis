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
  { k: 'cf',     col: 'H',  label: 'Cash-flow net-net cumulé',       short: 'Cash-flow cumulé', fmt: 'eur', best: 'max', sign: true },
  { k: 'impRev', col: 'K',  label: 'Impôt sur les revenus locatifs', short: 'Impôt revenus',    fmt: 'eur', best: 'min' },
  { k: 'impPv',  col: 'N',  label: 'Impôt sur la plus-value',        short: 'Impôt plus-value', fmt: 'eur', best: 'min' },
  { k: 'rnn',    col: 'Q',  label: 'Rendement net-net',              short: 'Rdt net-net',      fmt: 'pct', best: 'max', sign: true },
  { k: 'van',    col: 'T',  label: 'VAN nette',                      short: 'VAN',              fmt: 'eur', best: 'max', sign: true },
  { k: 'tri',    col: 'W',  label: 'TRI',                            short: 'TRI',              fmt: 'pct', best: 'max', sign: true },
  { k: 'drci',   col: 'Z',  label: 'DRCI (délai de récupération)',   short: 'DRCI',             fmt: 'yrs', best: 'min' },
];

let SIM_DETAIL_REGIME = null;
let SIM_SORT = { k: null, dir: -1 };   // tri du tableau de synthèse (null = ordre du classeur)

// ── Formats ──
// Montants : « 165 993 € », signe moins typographique « − 10 423 € »
function simFmtEUR(n) {
  if (typeof n !== 'number' || isNaN(n)) return '—';
  const r = Math.round(n);
  return (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('fr-FR') + '\u00a0€';
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
      ? simSentence(st).replace(/(\d{4,})\s*€/, (m, n) => (+n).toLocaleString('fr-FR') + ' €').replace(/loyers > à/i, 'loyers supérieurs à').replace(/loyer > à/i, 'loyer supérieur à')
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
  const regleLbl = 'Règle ' + Math.round((+inputs.reglesFinancementPct || 0) * 100) + '\u00a0%';

  let ordered = rows.slice();
  if (SIM_SORT.k) {
    const key = r => simIsNum(r[SIM_SORT.k]) ? r[SIM_SORT.k] : null;
    ordered.sort((a, b) => {
      if (!!a.impossible !== !!b.impossible) return a.impossible ? 1 : -1;   // régimes possibles d'abord
      const x = key(a), y = key(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x - y) * SIM_SORT.dir;
    });
  }
  const tableRows = ordered.map(r => {
    const cells = SIM_COLS.map(c => {
      const v = r[c.k];
      const isBest = !r.impossible && simIsNum(v) && best[c.k] !== null && v === best[c.k];
      const neg = c.sign && simIsNum(v) && v < 0;
      return '<td class="num' + (isBest ? ' is-best' : '') + (neg ? ' neg' : '') + '">' + simDisp(v, c.fmt) + '</td>';
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
      '<div class="sim-card sim-verdict">' +
        '<div class="sim-verdict-head">' +
          '<span class="sim-verdict-ico">' + icon('trophy', {size:18}) + '</span>' +
          '<div><h2 class="sim-verdict-title">' + escHtml(winner.label) + '</h2>' +
          '<div class="sim-verdict-sub">Meilleur cash-flow net-net cumulé parmi les régimes possibles</div></div>' +
          '<button class="btn btn-outline sim-verdict-btn" onclick="simOpenRegimeDetail(\'' + winner.key + '\')">Voir le détail</button>' +
        '</div>' +
        simStats([
          ['Cash-flow net-net cumulé', simDisp(winner.cf, 'eur'), simIsNum(winner.cf) && winner.cf < 0],
          ['VAN nette', simDisp(winner.van, 'eur'), simIsNum(winner.van) && winner.van < 0],
          ['TRI', simDisp(winner.tri, 'pct'), simIsNum(winner.tri) && winner.tri < 0],
          ['DRCI', simDisp(winner.drci, 'yrs')],
        ]) +
      '</div>' : '') +

    '<div class="sim-card sim-table-card">' +
      '<div class="sim-card-head"><div class="sim-card-h">Les 9 régimes comparés</div><div class="sim-card-note">' +
        (SIM_SORT.k ? '<a href="#" class="sim-link" onclick="SIM_SORT.k=null;simRenderResults();return false">Ordre du classeur</a> · ' : '') +
        'En vert, la meilleure valeur parmi les régimes possibles · Cliquez sur un régime pour son détail</div></div>' +
      '<div class="sim-table-scroll">' +
      '<table class="sim-cmp">' +
        '<thead><tr><th scope="col">Régime fiscal</th>' + SIM_COLS.map(c => {
          const on = SIM_SORT.k === c.k;
          return '<th scope="col" class="num" aria-sort="' + (on ? (SIM_SORT.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
            '<button class="sim-sort' + (on ? ' on' : '') + '" onclick="simSortBy(\'' + c.k + '\')" title="' + escHtml(c.label) + ' — cliquer pour trier">' + c.short +
            '<span class="sim-sort-ico">' + (on ? (SIM_SORT.dir > 0 ? '↑' : '↓') : '↕') + '</span></button></th>';
        }).join('') + '<th scope="col" class="num" title="Les loyers couvrent-ils la mensualité selon la règle de la banque ?">' + regleLbl + '</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table></div>' +
    '</div>' +

    simAnalysisCard(wb, inputs, winner ? winner.key : rows[0].key) +

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

function simSortBy(k) {
  if (SIM_SORT.k === k) SIM_SORT.dir = -SIM_SORT.dir;
  else { SIM_SORT.k = k; SIM_SORT.dir = (SIM_COLS.find(c => c.k === k) || {}).best === 'min' ? 1 : -1; }
  simRenderResults();
}

// Rangée de chiffres clés séparés par des filets (un seul bloc, pas une carte par chiffre)
function simStats(items) {
  return '<dl class="sim-stats">' + items.map(([l, v, neg]) =>
    '<div class="sim-stat"><dt>' + l + '</dt><dd' + (neg ? ' class="neg"' : '') + '>' + v + '</dd></div>').join('') + '</dl>';
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
  const rA = findRow('CASH FLOW NET NET ANNUEL');
  const rS = (SIM_MODEL.m[si] || []).map(m => m[0]).find(r => /CESSION ENCAISSÉ|ENCAISSÉ SUR LA CESSION/.test(String(wb.getRC(sheet, r, 2))));
  const yearVals = r => Array.from({ length: H }, (_, k) => { const v = r ? wb.getRC(sheet, r, 3 + k) : 0; return simIsNum(v) ? v : 0; });

  // L'année de revente (produit de cession, remboursement du crédit restant, impôt sur la plus-value)
  // écraserait l'échelle : le graphique montre les années d'exploitation, l'année de revente est résumée à part.
  const annual = yearVals(rA), saleVals = yearVals(rS);
  const sale = inputs.dureeDetention !== SIM_NO_RESALE ? H : 0;   // colonne de l'année de revente
  const nYears = sale ? H - 1 : H;
  const opCF = annual.slice(0, nYears);
  let acc = 0;
  const opCum = opCF.map(v => (acc += v));
  const saleTotal = saleVals.reduce((t, v) => t + v, 0);
  const sections = simSheetSections(wb, sheet, H);
  const colCls = k => k + 1 === sale ? ' is-sale' : '';
  const head = '<tr><th scope="col">Montants en euros</th>' + Array.from({ length: H }, (_, k) => '<th scope="col" class="num' + colCls(k) + '">An ' + (k + 1) + (k + 1 === sale ? '<span class="sim-sale-tag">revente</span>' : '') + '</th>').join('') + '</tr>';
  const sectionsHtml = sections.map(s => {
    const nDetail = s.rows.filter(x => x.hidden).length;
    const body = s.rows.map(x => {
      if (x.sub) return '<tr class="sim-sub-row' + (x.hidden ? ' is-detail' : '') + '"><td colspan="' + (H + 1) + '">' + escHtml(simSentence(x.label)) + '</td></tr>';
      const strong = /CASH FLOW NET NET|IMPÔT SUR LE REVENU AVEC|RÉSULTAT IMPOSABLE|IMPÔT SUR LA PLUS-VALUE AVEC|^PRODUITS$|^CHARGES/.test(x.label);
      return '<tr class="' + (x.hidden ? 'is-detail' : '') + (strong ? ' is-strong' : '') + '"><td>' + escHtml(simSentence(x.label)) + '</td>' +
        x.vals.map((v, k) => '<td class="num' + colCls(k) + (simIsNum(v) && v < 0 && x.code === 'e' && Math.round(v) !== 0 ? ' neg' : '') + '">' + simCellFmt(v, x.code) + '</td>').join('') + '</tr>';
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
    '<div class="sim-card sim-detail-stats">' +
      simStats(SIM_COLS.map(c => [c.label, simDisp(row[c.k], c.fmt), c.sign && simIsNum(row[c.k]) && row[c.k] < 0]).concat([
        ['Règle des ' + Math.round((+inputs.reglesFinancementPct || 0) * 100) + '\u00a0%', '<span class="sim-yn ' + (regle === 'OUI' ? 'ok' : regle === 'NON' ? 'ko' : '') + '">' + escHtml(regle === 'NS' ? 'Sans objet' : simSentence(regle)) + '</span>'],
      ])) +
    '</div>' +
    '<div class="sim-card"><div class="sim-card-head"><div class="sim-card-h">' + (sale ? 'Cash-flow net-net des années d\'exploitation' : 'Cash-flow net-net par année') + '</div></div>' +
      (sale && nYears >= 1 ? '<div class="ac-wrap"><canvas id="sim-cf-chart"></canvas></div>' : '') +
      (sale ? '<div class="sim-sale-line">' + icon('key', {size:14}) + '<span>Année ' + H + ', revente : cash-flow net de <b class="' + (annual[H - 1] < 0 ? 'neg' : '') + '">' + simFmtEUR(annual[H - 1]) + '</b>, après encaissement du prix de cession (' + simFmtEUR(saleTotal) + '), remboursement du crédit restant et impôt sur la plus-value.</span></div>' : '') +
      (sale ? '' : '<div class="ac-wrap"><canvas id="sim-cf-chart"></canvas></div>') + '</div>' +
    '<div class="sim-card sim-analysis"><div class="sim-card-head"><div class="sim-card-h">Lecture des résultats</div></div>' + simAnalysisHtml(wb, inputs, key) + '</div>' +
    sectionsHtml +
    loanHtml;

  const cv = document.getElementById('sim-cf-chart');
  if (cv && typeof ArtCharts !== 'undefined') {
    ArtCharts.combo(cv, {
      labels: Array.from({ length: nYears }, (_, k) => 'An ' + (k + 1)),
      bars: [{ name: 'Cash-flow de l\'année', values: opCF, color: '#9b6ef3' }],
      line: { name: 'Cumul', values: opCum, color: '#34d399' },
      height: 260,
    });
  }
}

// ════════════════════════════════════════════
//  ANALYSE COMMENTÉE — lecture des résultats avec les chiffres de la simulation
//  Tout est lu dans le classeur (onglets des régimes et synthèse) ; aucun chiffre n'est recalculé
//  autrement que par des sommes de lignes du classeur.
// ════════════════════════════════════════════
function simLabelRow(wb, sheet, re) {
  const si = SIM_MODEL.sheets.indexOf(sheet);
  return (SIM_MODEL.m[si] || []).map(m => m[0]).find(r => {
    const l = wb.getRC(sheet, r, 2);
    return typeof l === 'string' && re.test(l.trim());
  });
}
function simRowValues(wb, sheet, re, H) {
  const r = simLabelRow(wb, sheet, re);
  return Array.from({ length: H }, (_, k) => { const v = r ? wb.getRC(sheet, r, 3 + k) : 0; return simIsNum(v) ? v : 0; });
}
const simSum = a => a.reduce((t, v) => t + v, 0);

// Chiffres d'un régime sur la durée de la simulation
function simRegimeFacts(wb, inputs, key) {
  const conf = SIM_REGIMES.find(r => r.key === key);
  const row = simRegimeRows(wb, inputs).find(r => r.key === key);
  const H = simHorizon(wb), s = conf.sheet;
  const produits = simRowValues(wb, s, /^PRODUITS ENCAISSÉS/, H);
  const charges = simRowValues(wb, s, /^CHARGES DÉCAISSÉES/, H);
  const capital = simRowValues(wb, s, /^AMORTISSEMENT EMPRUNT/, H);
  const impot = simRowValues(wb, s, /^IMPÔT SUR LES REVENUS LOCATIFS/, H);
  const cession = simRowValues(wb, s, /CESSION ENCAISSÉ|ENCAISSÉ SUR LA CESSION/, H);
  const cf = simRowValues(wb, s, /^CASH FLOW NET NET ANNUEL/, H);
  const amort = simRowValues(wb, s, /^AMORTISSEMENT$/, H);
  const resImp = simRowValues(wb, s, /^RÉSULTAT IMPOSABLE AVANT (IMPÔT|IS)/, H);
  const f = {
    key, conf, row, H, sale: inputs.dureeDetention !== SIM_NO_RESALE,
    apport: +inputs.apportPersonnel || 0,
    rate: +inputs.tauxActualisation || 0,
    produits: simSum(produits), charges: simSum(charges), capital: simSum(capital),
    impot: simSum(impot), cession: simSum(cession), cfTotal: simSum(cf), cf,
    amort: simSum(amort), yearsNoTax: resImp.filter(v => v <= 0).length,
  };
  // Ce qui n'entre dans aucune des lignes ci-dessus (ex. fiscalité des dividendes en société)
  f.autres = f.cfTotal - (f.produits - f.charges - f.capital - f.impot + f.cession);
  const opYears = f.sale ? cf.slice(0, H - 1) : cf;
  f.negYears = opYears.filter(v => v < 0).length;
  f.worstMonth = Math.min(0, ...opYears) / 12;
  f.firstYearMonth = (cf[0] || 0) / 12;
  f.lastCF = cf[H - 1] || 0;
  return f;
}

const simEur = v => '<b>' + simFmtEUR(v) + '</b>';
const simPctB = v => '<b>' + simFmtPct(v) + '</b>';

function simAnalysisHtml(wb, inputs, key) {
  const f = simRegimeFacts(wb, inputs, key);
  const r = f.row;
  const all = simRegimeRows(wb, inputs);
  const possible = all.filter(x => !x.impossible);
  const P = [];   // paragraphes

  // 1. D'où vient le cash-flow
  const lines = [
    ['Loyers et charges récupérées encaissés', f.produits],
    ['Charges payées (copropriété, taxe foncière, gestion, intérêts, assurances…)', -f.charges],
    ['Capital du crédit remboursé' + (f.sale ? ' (y compris le solde à la revente)' : ''), -f.capital],
    [f.sale ? 'Impôts sur les loyers et sur la plus-value' : 'Impôts sur les loyers', -f.impot],
  ];
  if (f.cession) lines.push(['Prix de revente encaissé', f.cession]);
  if (Math.abs(f.autres) >= 1) lines.push([f.key === 'is_avec' ? 'Fiscalité des dividendes et autres flux' : 'Autres flux', f.autres]);
  const table = '<div class="sim-an-flow">' +
    lines.map(([l, v]) => '<div class="sim-an-line"><span>' + l + '</span><span class="' + (v < 0 ? 'neg' : 'pos') + '">' + (v > 0 ? '+' : '') + simFmtEUR(v) + '</span></div>').join('') +
    '<div class="sim-an-line sim-an-total"><span>Cash-flow net-net cumulé sur ' + f.H + ' ans</span><span>' + simFmtEUR(f.cfTotal) + '</span></div>' +
    '<div class="sim-an-line"><span>Votre apport de départ</span><span class="neg">' + simFmtEUR(-f.apport) + '</span></div>' +
    '<div class="sim-an-line sim-an-total"><span>Gain net, apport déduit (sans tenir compte du temps)</span><span class="' + (f.cfTotal - f.apport < 0 ? 'neg' : '') + '">' + simFmtEUR(f.cfTotal - f.apport) + '</span></div>' +
  '</div>';
  const opSum = f.cfTotal - (f.sale ? f.lastCF : 0);
  const opNote = f.sale && opSum < 0
    ? '<p>À noter : hors année de revente, les ' + (f.H - 1) + ' années d\'exploitation coûtent au total ' + simEur(-opSum) + ' (loyers insuffisants pour couvrir charges, crédit et impôts). <b>Tout le gain provient de la revente</b>, et donc de l\'hypothèse de prix de revente.</p>'
    : (f.sale && f.H > 1 ? '<p>Hors année de revente, les ' + (f.H - 1) + ' années d\'exploitation dégagent ' + simEur(opSum) + ' ; la revente apporte le reste.</p>' : '');
  P.push(['D\'où vient le résultat', '<p>Sur ' + f.H + ' ans, le régime ' + escHtml(r.label) + ' dégage un cash-flow net-net cumulé de ' + simEur(f.cfTotal) +
    '. Ce chiffre additionne tout ce qui entre et sort de votre poche année après année, <b>mais il ne retire pas votre apport</b> de ' + simFmtEUR(f.apport) + ' versé au départ.</p>' + opNote, table]);

  // 2. Cash-flow vs VAN vs TRI
  const van = r.van, tri = r.tri, gain = f.cfTotal - f.apport;
  const disc = 1 / Math.pow(1 + f.rate, f.H);
  let t = '';
  if (simIsNum(van)) {
    t += '<p>La VAN (valeur actuelle nette) part de votre apport, qu\'elle compte en négatif, puis ajoute chaque cash-flow annuel ramené en « euros d\'aujourd\'hui » au taux d\'actualisation de ' + simPctB(f.rate) +
      ' : 1 € encaissé dans ' + f.H + ' ans ne vaut que ' + '<b>' + disc.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €</b> aujourd\'hui. Elle répond à la question : ce projet rapporte-t-il plus que de placer mon apport à ' + simFmtPct(f.rate) + ' par an ?</p>';
    if (gain < 0) {
      t += '<p>Ici, les flux cumulés (' + simFmtEUR(f.cfTotal) + ') ne suffisent même pas à rendre l\'apport : il manque ' + simEur(-gain) + '. La VAN (' + simEur(van) + ') et le TRI sont donc mécaniquement négatifs' + (f.cf.some(v => v > 0) ? ', même si certaines années dégagent un cash-flow positif' : '') + '.</p>';
    } else if (van < 0) {
      const lastPV = f.lastCF * disc;
      t += '<p><b>Pourquoi un cash-flow positif mais une VAN négative ?</b> Le gain net de ' + simEur(gain) + ' existe bien, mais il arrive trop tard et trop lentement pour battre un placement à ' + simFmtPct(f.rate) + '.' +
        (f.sale && f.lastCF > 0 ? (f.lastCF >= 0.5 * f.cfTotal ? ' L\'essentiel' : ' Une partie') + ' arrive l\'année de la revente (' + simFmtEUR(f.lastCF) + '), qui ne vaut plus que ' + simEur(lastPV) + ' en euros d\'aujourd\'hui.' : '') +
        ' Résultat : la VAN est de ' + simEur(van) + '.</p>';
    } else {
      t += '<p>La VAN est positive (' + simEur(van) + ') : même en tenant compte du temps, le projet fait mieux qu\'un placement à ' + simFmtPct(f.rate) + ' par an. C\'est l\'excédent créé, en euros d\'aujourd\'hui.</p>';
    }
  }
  if (simIsNum(tri)) {
    const cmp = tri > f.rate ? 'supérieur' : 'inférieur';
    t += '<p>Le TRI (' + simPctB(tri) + ') est le rendement annuel équivalent de votre apport, tous flux compris. Il est ' + cmp + ' au taux d\'actualisation (' + simFmtPct(f.rate) + '), ce qui est cohérent avec une VAN ' + (tri > f.rate ? 'positive' : 'négative') + '.' +
      (f.apport < 1000 ? ' Avec un apport très faible, le TRI devient très élevé ou instable : il mesure le rendement de presque rien.' : '') + '</p>';
  } else {
    t += '<p>Il n\'y a pas de TRI calculable : les flux ne permettent pas de trouver un taux qui équilibre l\'apport et les gains (typiquement quand l\'apport n\'est jamais récupéré, ou quand il est nul).</p>';
  }
  if (simIsNum(r.drci) && r.drci > f.H) t += '<p>Le classeur indique un délai de récupération (DRCI) de <b>' + r.drci + ' ans</b> : l\'apport ne serait récupéré qu\'au-delà des ' + f.H + ' ans simulés, en prolongeant l\'exploitation.</p>';
  else if (simIsNum(r.drci)) t += '<p>Le délai de récupération (DRCI) est de ' + '<b>' + r.drci + ' an' + (r.drci > 1 ? 's' : '') + '</b> : c\'est l\'année où le cash-flow cumulé dépasse votre apport.</p>';
  else t += '<p>L\'apport n\'est pas récupéré sur la durée de la simulation (pas de DRCI).</p>';
  P.push(['Cash-flow, VAN et TRI : ce que chacun mesure', t]);

  // 3. Fiscalité
  let fis = '';
  const P_ = '⚙️ PARAMÈTRES';
  if (key === 'lmnp_reel' || key === 'lmp_reel') {
    fis += '<p>Au régime réel, le bien, les travaux et le mobilier sont <b>amortis</b> : ' + simEur(f.amort) + ' de charges comptables sur ' + f.H + ' ans, sans aucune sortie d\'argent. Elles effacent le bénéfice imposable : ' +
      '<b>' + f.yearsNoTax + ' année' + (f.yearsNoTax > 1 ? 's' : '') + ' sur ' + f.H + '</b> sans résultat imposable.</p>';
    if (key === 'lmp_reel') fis += '<p>En LMP, les bénéfices supportent aussi les cotisations sociales (environ ' + simFmtPct(wb.get(P_, 'M19')) + ', minimum ' + simFmtEUR(wb.get(P_, 'M18')) + ' par an), ce qui alourdit l\'impôt même quand le résultat est faible.</p>';
  } else if (key === 'lmnp_micro') {
    const ab = inputs.meubleTourisme === 'OUI' ? wb.get(P_, 'I18') : wb.get(P_, 'I17');
    fis += '<p>Au micro-BIC, l\'administration retient un abattement forfaitaire de ' + simPctB(ab) + ' sur les loyers, quelles que soient vos charges réelles. Pas d\'amortissement : l\'impôt et les prélèvements sociaux commencent dès la première année.</p>';
  } else if (key === 'rf_micro' || key === 'pinel_micro') {
    fis += '<p>Au micro-foncier, l\'abattement forfaitaire est de ' + simPctB(wb.get(P_, 'I16')) + ' sur les loyers, sans tenir compte des intérêts d\'emprunt ni des travaux.</p>';
  } else if (key === 'rf_reel' || key === 'pinel_reel') {
    fis += '<p>En location nue au réel, les charges, intérêts et travaux sont déductibles ; un déficit peut réduire vos autres revenus dans la limite de 10 700 € par an. En revanche, rien n\'est amorti : une fois les travaux déduits, les loyers deviennent imposables à votre tranche marginale plus 17,2 % de prélèvements sociaux.</p>';
  } else if (key === 'is_sans' || key === 'is_avec') {
    fis += '<p>En société à l\'IS, le bien est amorti (' + simEur(f.amort) + ' sur ' + f.H + ' ans) et le bénéfice est taxé à ' + simPctB(wb.get(P_, 'M6')) + ' jusqu\'à ' + simFmtEUR(wb.get(P_, 'L6')) + ' puis ' + simPctB(wb.get(P_, 'M7')) + '.' +
      (f.sale ? ' À la revente, la plus-value est calculée sur la valeur nette comptable (prix moins amortissements), ce qui alourdit l\'impôt sur la plus-value : ' + simEur(r.impPv) + '.' : '') + '</p>';
    if (key === 'is_avec') fis += '<p>Avec distribution, les bénéfices versés en dividendes sont taxés une seconde fois chez vous (' + (inputs.impositionDividendes === 'FLAT TAX' ? 'flat tax de ' + simFmtPct(wb.get(P_, 'Q8')) : 'barème progressif après abattement de ' + simFmtPct(wb.get(P_, 'Q7'))) + '), ce qui explique l\'écart avec la version sans distribution.</p>';
  }
  const taxed = possible.filter(x => simIsNum(x.impRev) && simIsNum(x.impPv)).map(x => ({ x, tot: x.impRev + x.impPv }));
  if (taxed.length > 1 && simIsNum(r.impRev)) {
    const me = r.impRev + (simIsNum(r.impPv) ? r.impPv : 0);
    const worst = taxed.reduce((a, b) => (b.tot > a.tot ? b : a));
    const bestT = taxed.reduce((a, b) => (b.tot < a.tot ? b : a));
    fis += '<p>Au total, ce régime coûte ' + simEur(me) + ' d\'impôts sur ' + f.H + ' ans (loyers ' + simFmtEUR(r.impRev) + ' + plus-value ' + simFmtEUR(simIsNum(r.impPv) ? r.impPv : 0) + '). ' +
      (bestT.x.key === key ? 'C\'est le régime possible le moins imposé' : 'Le moins imposé des régimes possibles est ' + escHtml(bestT.x.label) + ' (' + simFmtEUR(bestT.tot) + ')') +
      (worst.x.key !== key ? ', le plus imposé est ' + escHtml(worst.x.label) + ' (' + simFmtEUR(worst.tot) + ')' : '') + '.</p>';
  }
  if (fis) P.push(['Fiscalité', fis]);

  // 4. Points d'attention
  const warn = [];
  if (f.negYears) warn.push('<li>Effort d\'épargne : ' + f.negYears + ' année' + (f.negYears > 1 ? 's' : '') + ' avec un cash-flow négatif et un effort allant jusqu\'à ' + simEur(Math.abs(f.worstMonth)) + ' par mois.</li>');
  else if (f.firstYearMonth > 0) warn.push('<li>Le projet s\'autofinance dès la première année : ' + simEur(f.firstYearMonth) + ' par mois de cash-flow net en année 1.</li>');
  if (r.regle === 'NON') warn.push('<li>La règle de financement de la banque (' + simFmtPct(+inputs.reglesFinancementPct || 0, 0) + ' des loyers doivent couvrir la mensualité) n\'est pas respectée : le crédit pourrait être refusé ou demander plus d\'apport.</li>');
  if (r.impossible) warn.push('<li>Selon le classeur, ce régime est ' + escHtml(r.impossible.toLowerCase()) + ' : ses chiffres ne sont qu\'indicatifs.</li>');
  const imp = all.filter(x => x.impossible && x.key !== key);
  if (imp.length) warn.push('<li>Écartés car impossibles dans votre situation : ' + imp.map(x => escHtml(x.label) + ' (' + escHtml(x.impossible.replace(/^Impossible car /i, '').toLowerCase()) + ')').join(', ') + '.</li>');
  if (!f.sale) warn.push('<li>Sans revente, la valeur du bien en fin de période n\'est pas comptée : la VAN et le TRI sont donc prudents.</li>');
  if (warn.length) P.push(['Points d\'attention', '<ul class="sim-an-list">' + warn.join('') + '</ul>']);

  const sec = ([h, body, aside]) => '<section class="sim-an-sec' + (aside ? ' sim-an-split' : '') + '"><div><h3>' + h + '</h3>' + body + '</div>' + (aside ? '<div>' + aside + '</div>' : '') + '</section>';
  const [first, ...rest] = P;
  const pair = rest.filter(x => x[0] !== 'Points d\'attention'), tail = rest.filter(x => x[0] === 'Points d\'attention');
  return sec(first) + '<div class="sim-an-grid">' + pair.map(sec).join('') + '</div>' + tail.map(sec).join('') +
    '<p class="sim-an-foot">Analyse générée automatiquement à partir des chiffres du classeur pour cette simulation. Elle ne remplace pas le conseil personnalisé d\'un expert-comptable.</p>';
}

let SIM_ANALYSIS_KEY = null;
function simAnalysisCard(wb, inputs, defaultKey) {
  const key = SIM_ANALYSIS_KEY && SIM_REGIMES.some(r => r.key === SIM_ANALYSIS_KEY) ? SIM_ANALYSIS_KEY : defaultKey;
  const rows = simRegimeRows(wb, inputs);
  return '<div class="sim-card sim-analysis" id="sim-analysis">' +
    '<div class="sim-card-head"><div class="sim-card-h">Lecture des résultats</div>' +
      '<label class="sim-an-pick">Régime analysé <select onchange="SIM_ANALYSIS_KEY=this.value;simRefreshAnalysis()">' +
        rows.map(r => '<option value="' + r.key + '"' + (r.key === key ? ' selected' : '') + '>' + escHtml(r.label) + (r.impossible ? ' (impossible)' : '') + '</option>').join('') +
      '</select></label></div>' +
    '<div id="sim-analysis-body">' + simAnalysisHtml(wb, inputs, key) + '</div>' +
  '</div>';
}
function simRefreshAnalysis() {
  const body = document.getElementById('sim-analysis-body');
  if (!body || !SIM_LAST_RESULTS) return;
  const wb = simCompute(SIM_LAST_RESULTS.inputs);
  body.innerHTML = simAnalysisHtml(wb, SIM_LAST_RESULTS.inputs, SIM_ANALYSIS_KEY);
}
