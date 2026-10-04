// ══════════════════════════════════════════════
//  BUDGET — réel vs budget dans le dashboard
//
//  Règle de comparaison : seuls les mois qui ont à la fois un budget de référence ET un relevé
//  importé sont comparés (sinon un mois futur budgété mais pas encore importé creuserait un faux écart).
//  Les montants budgétés sont transformés en « lignes » de même forme que les lignes bancaires,
//  pour réutiliser les mêmes classements que le dashboard (_isCA, _isDep, _SIG_MAP…).
//  Écart = réel − budget en montant signé : positif = favorable (plus de recettes ou moins de dépenses).
// ══════════════════════════════════════════════

function budMonthsBetween(dmin, dmax) {
  const a = String(dmin || '').slice(0, 7), b = String(dmax || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b) || a > b) return [];
  const out = [];
  let [y, m] = a.split('-').map(Number);
  while (true) {
    const k = y + '-' + String(m).padStart(2, '0');
    if (k > b || out.length > 600) break;
    out.push(k);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
function budFmtMonths(months) {
  if (!months.length) return '';
  const lbl = k => { const [y, m] = k.split('-'); return BUD_MONTHS[+m - 1].toLowerCase() + ' ' + y; };
  if (months.length === 1) return lbl(months[0]);
  return lbl(months[0]) + ' – ' + lbl(months[months.length - 1]);
}

// Lignes budgétaires pour une liste de mois et des filtres { sci:[], bien:[], cat:[], ebit }
function budLinesFor(months, f, store) {
  f = f || {};
  store = store || budGetStore();
  const ents = {}; budEntities().forEach(e => ents[e.id] = e);
  const out = [];
  const byYear = {};
  months.forEach(p => (byYear[p.slice(0, 4)] = byYear[p.slice(0, 4)] || []).push(p));
  Object.entries(byYear).forEach(([y, ps]) => {
    const v = budRefVersion(+y, store);
    if (!v) return;
    Object.entries(v.rows || {}).forEach(([k, r]) => {
      const [eid, cat] = budSplitKey(k);
      const e = ents[eid] || budEntityInfo(eid);
      if (f.sci && f.sci.length && !f.sci.includes(e.sci)) return;
      if (f.bien && f.bien.length && !(e.type !== 'SCI' && f.bien.includes(e.bienName))) return;
      if (f.cat && f.cat.length && !f.cat.includes(cat)) return;
      if (f.ebit === 'oui' || f.ebit === 'non') {
        const s = SCHEMA[cat], isE = !!(s && s.ebit === 'OUI');
        if ((f.ebit === 'oui') !== isE) return;
      }
      ps.forEach(p => {
        const x = +r.m[+p.slice(5) - 1] || 0;
        if (!x) return;
        out.push({ _period: p, _year: y, cat, categorie: cat, montant: x, bienId: e.type === 'SCI' ? '' : eid,
          bienName: e.type === 'SCI' ? '' : e.bienName, bien: e.type === 'SCI' ? '' : e.bienName, sci: e.sci, _entity: eid, _budget: true });
      });
    });
  });
  return out;
}
function budImportedPeriods() { return new Set(Object.keys((getDB().periods) || {})); }
function budYearsWithBudget(store) { store = store || budGetStore(); return new Set(Object.values(store.versions).map(v => String(v.year))); }

// Périmètre de la synthèse : mois de la période filtrée qui ont un budget, et ceux qui sont comparables
function budSynScope() {
  const store = budGetStore();
  const dmin = _getV('syn-date-min') || window._artemisDateMin || '';
  const dmax = _getV('syn-date-max') || window._artemisDateMax || '';
  const years = budYearsWithBudget(store);
  const budgeted = budMonthsBetween(dmin, dmax).filter(p => years.has(p.slice(0, 4)) && budRefVersion(+p.slice(0, 4), store));
  const imported = budImportedPeriods();
  const compared = budgeted.filter(p => imported.has(p));
  const filters = { sci: _msGetVals('syn-sci'), bien: _msGetVals('syn-bien'), cat: _msGetVals('syn-cat'), ebit: _getV('syn-ebit') };
  const versions = [...new Set(budgeted.map(p => p.slice(0, 4)))].map(y => { const v = budRefVersion(+y, store); return v ? y + ' · ' + v.name : null; }).filter(Boolean);
  return { store, budgeted, compared, comparedSet: new Set(compared), filters, versions };
}

const BUD_KINDS = {
  ca:    { label: 'Chiffre d\'affaires', pred: l => _isCA(l), sign: 1 },
  dep:   { label: 'Dépenses',            pred: l => _isDep(l), sign: -1 },
  treso: { label: 'Solde de trésorerie', pred: () => true, sign: 1 },
};
const budSum = (lines, pred) => lines.reduce((s, l) => s + (pred(l) ? (+l.montant || 0) : 0), 0);

// Écart affiché (dans le sens de l'indicateur) + favorable ?
function budVar(real, bud, sign) {
  const d = (real - bud) * sign;                 // dans le sens de l'affichage
  const fav = (real - bud) >= 0;                 // en signé : plus d'entrées / moins de sorties
  const pct = bud ? (real - bud) / Math.abs(bud) * 100 * sign : null;
  return { d, fav, pct };
}
function budVarHtml(real, bud, sign, opts) {
  opts = opts || {};
  const v = budVar(real, bud, sign);
  const neutral = Math.abs(real - bud) < 0.5;
  const cls = neutral ? '' : v.fav ? 'pos' : 'neg';
  return `<span class="bud-var ${cls}">${budFmt(v.d, { signed: true, eur: !opts.noEur })}${opts.noPct || v.pct === null ? '' : ` <small>${budFmtPct(v.pct, true)}</small>`}</span>`;
}

// ── Bloc « Réel vs budget » des onglets CA / Dépenses / Trésorerie ──
function budStripHtml(kind) {
  if (typeof budGetStore !== 'function') return '';
  const K = BUD_KINDS[kind];
  const sc = budSynScope();
  if (!sc.budgeted.length) return '';
  if (!sc.compared.length) {
    return `<div class="card bud-strip bud-strip-empty"><div class="bud-strip-title">${icon('target', { size: 15 })}Réel vs budget</div>
      <p>Un budget existe pour ${budEsc(budFmtMonths(sc.budgeted))}, mais aucun relevé de ces mois n'est encore importé. La comparaison apparaîtra au premier mois importé.</p>
      <button class="bud-link" onclick="budOpenTab()">Voir le budget</button></div>`;
  }
  const actual = _synLines().filter(l => sc.comparedSet.has(l._period));
  const bud = budLinesFor(sc.compared, sc.filters, sc.store);
  const real = budSum(actual, K.pred) * K.sign, bb = budSum(bud, K.pred) * K.sign;
  const ratio = bb ? real / bb * 100 : null;

  // Par bien (clé = entité, pour rapprocher « hors bien » des deux côtés)
  const biens = getParams().biens || [];
  const by = {};
  actual.forEach(l => { if (!K.pred(l)) return; const e = budEntityOfLine(l, biens); (by[e] = by[e] || { r: 0, b: 0 }).r += +l.montant || 0; });
  bud.forEach(l => { if (!K.pred(l)) return; (by[l._entity] = by[l._entity] || { r: 0, b: 0 }).b += +l.montant || 0; });
  const rows = Object.entries(by).filter(([, x]) => Math.abs(x.r) >= 0.5 || Math.abs(x.b) >= 0.5)
    .sort((a, b) => Math.abs(b[1].b * K.sign) - Math.abs(a[1].b * K.sign) || Math.abs(b[1].r) - Math.abs(a[1].r));
  // Plus gros écarts par catégorie
  const byCat = {};
  actual.forEach(l => { if (!K.pred(l)) return; const c = l.cat || l.categorie || '—'; (byCat[c] = byCat[c] || { r: 0, b: 0 }).r += +l.montant || 0; });
  bud.forEach(l => { if (!K.pred(l)) return; (byCat[l.cat] = byCat[l.cat] || { r: 0, b: 0 }).b += +l.montant || 0; });
  const cats = Object.entries(byCat).map(([c, x]) => [c, x, x.r - x.b]).filter(x => Math.abs(x[2]) >= 1).sort((a, b) => a[2] - b[2]).slice(0, 5);

  const nM = sc.compared.length, partial = nM < sc.budgeted.length;
  return `<div class="card bud-strip">
    <div class="bud-strip-head">
      <div class="bud-strip-title">${icon('target', { size: 15 })}Réel vs budget · ${K.label.toLowerCase()}</div>
      <div class="bud-strip-meta">${budEsc(sc.versions.join(', '))} · ${budEsc(budFmtMonths(sc.compared))} (${nM} mois importé${nM > 1 ? 's' : ''}${partial ? ' sur ' + sc.budgeted.length + ' budgétés' : ''})</div>
      <button class="bud-link" onclick="budOpenTab()">Analyse détaillée</button>
    </div>
    <div class="bud-strip-body">
      <div class="bud-strip-figs">
        <div><span>Réel</span><b>${budFmt(real, { eur: true, signed: kind === 'treso' })}</b></div>
        <div><span>Budget</span><b>${budFmt(bb, { eur: true, signed: kind === 'treso' })}</b></div>
        <div><span>Écart</span><b>${budVarHtml(real * K.sign, bb * K.sign, K.sign)}</b></div>
        ${ratio !== null && kind !== 'treso' ? `<div class="bud-strip-bar"><span>${Math.round(ratio)} % du budget ${kind === 'dep' ? 'consommé' : 'réalisé'}</span>
          <div class="bud-bar-track"><div class="bud-bar-fill ${(kind === 'dep' ? ratio > 100 : ratio < 100) ? 'neg' : 'pos'}" style="width:${Math.max(0, Math.min(ratio, 100))}%"></div>${ratio > 100 ? '<div class="bud-bar-over"></div>' : ''}</div></div>` : ''}
      </div>
      <div class="bud-strip-table">
        <table class="bud-mini"><thead><tr><th>Par bien</th><th>Réel</th><th>Budget</th><th>Écart</th></tr></thead><tbody>
        ${rows.slice(0, 8).map(([e, x]) => `<tr><td>${budEsc(e === '@none' ? 'Non attribué' : budEntityLabel(e))}</td><td>${budFmt(x.r * K.sign)}</td><td>${budFmt(x.b * K.sign, { dashZero: true })}</td><td>${budVarHtml(x.r, x.b, K.sign, { noPct: true, noEur: true })}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div class="bud-strip-cats">
        <div class="bud-strip-sub">Écarts les plus défavorables</div>
        ${cats.filter(c => c[2] < 0).length ? cats.filter(c => c[2] < 0).map(([c, x]) => `<div class="bud-cat-row"><span>${budEsc(c)}</span>${budVarHtml(x.r, x.b, K.sign, { noPct: true })}</div>`).join('') : '<div class="bud-ok">Aucun écart défavorable</div>'}
      </div>
    </div>
  </div>`;
}
function budInjectStrip(el, kind) {
  try {
    const html = budStripHtml(kind);
    if (!html) return;
    const g = el.querySelector('.dash-grid-4');
    if (g) g.insertAdjacentHTML('afterend', html); else el.insertAdjacentHTML('afterbegin', html);
  } catch (e) { console.warn('[budget] bloc réel vs budget', e); }
}

// Série budget alignée sur les mois d'un graphique (null = pas de budget pour ce mois)
function budChartSeries(kind, periodKeys, realVals, cumul) {
  try {
    const K = BUD_KINDS[kind];
    const store = budGetStore();
    if (!Object.keys(store.versions).length) return null;
    const f = { sci: _msGetVals('syn-sci'), bien: _msGetVals('syn-bien'), cat: _msGetVals('syn-cat'), ebit: _getV('syn-ebit') };
    const vals = periodKeys.map(p => {
      if (!/^\d{4}-\d{2}$/.test(p) || !budRefVersion(+p.slice(0, 4), store)) return null;
      return budSum(budLinesFor([p], f, store), K.pred) * K.sign;
    });
    if (vals.every(x => x === null)) return null;
    if (!cumul) return vals;
    // Cumul : la trajectoire budget part du réel cumulé du mois qui précède le premier mois budgété
    const out = []; let acc = null, realAcc = 0;
    vals.forEach((x, i) => {
      if (x === null) { out.push(null); acc = null; }
      else { acc = (acc === null ? realAcc : acc) + x; out.push(acc); }
      realAcc += +realVals[i] || 0;
    });
    return out;
  } catch (e) { console.warn('[budget] série graphique', e); return null; }
}

// ── SIG : réel vs budget (hors amortissements, qui ne sont pas budgétés) ──
function budSigCardHtml() {
  const sc = budSynScope();
  if (!sc.compared.length) return '';
  const actual = _synLines().filter(l => sc.comparedSet.has(l._period));
  const bud = budLinesFor(sc.compared, sc.filters, sc.store);
  const agg = lines => {
    const g = {};
    lines.forEach(l => {
      const m = _SIG_MAP[l.cat || ''];
      if (!m || !m.g || m.g === 'Charge d\'exploitation' && m.s === 'Amortissements') return;
      g[m.g] = (g[m.g] || 0) + (+l.montant || 0);       // signé
    });
    const G = k => g[k] || 0;
    const r = {};
    r.pe = G("Produit d'exploitation"); r.ce = G("Charge d'exploitation");
    r.ebe = r.pe + r.ce;
    r.rfin = G('Produit financier') + G('Charge financière');
    r.rexc = G('Produit exceptionnel') + G('Charge exceptionnelle');
    r.is = G('Impôt sur les bénéfices');
    r.net = r.ebe + r.rfin + r.rexc + r.is;
    return r;
  };
  const R = agg(actual), B = agg(bud);
  const row = (label, k, strong, sign) => {
    sign = sign || 1;
    return `<tr class="${strong ? 'bud-row-strong' : ''}"><td>${label}</td><td>${budFmt(R[k] * sign, { signed: sign === 1 && strong })}</td><td>${budFmt(B[k] * sign, { signed: sign === 1 && strong })}</td><td>${budVarHtml(R[k], B[k], sign)}</td></tr>`;
  };
  return `<div class="card bud-sig">
    <div class="bud-strip-head">
      <div class="bud-strip-title">${icon('target', { size: 15 })}Soldes de gestion — réel vs budget</div>
      <div class="bud-strip-meta">${budEsc(sc.versions.join(', '))} · ${budEsc(budFmtMonths(sc.compared))} · avant amortissements (non budgétés)</div>
    </div>
    <div class="bud-grid-scroll"><table class="bud-table bud-table-sig"><thead><tr><th></th><th>Réel</th><th>Budget</th><th>Écart</th></tr></thead><tbody>
      ${row('Produits d\'exploitation', 'pe')}
      ${row('Charges d\'exploitation', 'ce', false, -1)}
      ${row('Excédent brut d\'exploitation (EBE)', 'ebe', true)}
      ${row('Résultat financier', 'rfin')}
      ${row('Résultat exceptionnel', 'rexc')}
      ${row('Impôt sur les bénéfices', 'is', false, -1)}
      ${row('Résultat net avant amortissements', 'net', true)}
    </tbody></table></div>
  </div>`;
}

// ── KPIs courte durée : objectifs vs réel ──
function budLcdCompare(months, bienIds) {
  const store = budGetStore();
  const ni = budNightsIndex();
  const { sum } = budActual();
  const out = {};
  bienIds.forEach(id => {
    const o = { nO: 0, nR: 0, caO: 0, caR: 0, days: 0, months: 0 };
    months.forEach(p => {
      const v = budRefVersion(+p.slice(0, 4), store);
      const t = v && v.lcd && v.lcd[id];
      if (!t) return;
      const mi = +p.slice(5) - 1;
      o.nO += +t.nuits[mi] || 0; o.caO += (+t.nuits[mi] || 0) * (+t.prix[mi] || 0);
      o.nR += (ni[id] || {})[p] || 0;
      BUD_LCD_CATS.forEach(c => { o.caR += sum.get(p + BUD_SEP + id + BUD_SEP + c) || 0; });
      o.days += budDaysInMonth(+p.slice(0, 4), mi); o.months++;
    });
    if (o.months) out[id] = o;
  });
  return out;
}
function budLcdKpiHtml(dmin, dmax, bienNames) {
  try {
    const store = budGetStore();
    if (!Object.keys(store.versions).length) return '';
    const imported = budImportedPeriods();
    const months = budMonthsBetween(dmin || window._artemisDateMin, dmax || window._artemisDateMax).filter(p => imported.has(p) && budRefVersion(+p.slice(0, 4), store));
    const lcd = (getParams().biens || []).filter(b => b.type === 'LCD' && (!bienNames || !bienNames.length || bienNames.includes(b.name)));
    const cmp = budLcdCompare(months, lcd.map(b => b.id));
    const ids = Object.keys(cmp);
    if (!ids.length) return '';
    const T = ids.reduce((a, id) => { Object.keys(a).forEach(k => a[k] += cmp[id][k]); return a; }, { nO: 0, nR: 0, caO: 0, caR: 0, days: 0, months: 0 });
    const line = (name, o, strong) => {
      const occR = o.days ? o.nR / o.days * 100 : 0, occO = o.days ? o.nO / o.days * 100 : 0;
      const pR = o.nR ? o.caR / o.nR : 0, pO = o.nO ? o.caO / o.nO : 0;
      const pt = (r, b) => { const d = r - b; return `<span class="bud-var ${Math.abs(d) < 0.05 ? '' : d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}${budNbsp}pt</span>`; };
      return `<tr class="${strong ? 'bud-row-strong' : ''}"><td>${budEsc(name)}</td>
        <td>${budFmt(o.nR)} / ${budFmt(o.nO)}</td><td>${budVarHtml(o.nR, o.nO, 1, { noEur: true })}</td>
        <td>${budFmtPct(occR)} / ${budFmtPct(occO)}</td><td>${pt(occR, occO)}</td>
        <td>${pR ? budFmt(pR, { eur: true }) : '—'} / ${pO ? budFmt(pO, { eur: true }) : '—'}</td><td>${pR && pO ? budVarHtml(pR, pO, 1, { noPct: false }) : '—'}</td>
        <td>${budFmt(o.caR, { eur: true })} / ${budFmt(o.caO, { eur: true })}</td><td>${budVarHtml(o.caR, o.caO, 1)}</td></tr>`;
    };
    const biens = getParams().biens || [];
    return `<div class="card bud-sig" style="margin-top:18px">
      <div class="bud-strip-head">
        <div class="bud-strip-title">${icon('target', { size: 15 })}Objectifs courte durée — réel / objectif</div>
        <div class="bud-strip-meta">${budEsc(budFmtMonths(months))} · nuits par date d'arrivée, CA hébergement encaissé (relevés)</div>
        <button class="bud-link" onclick="budOpenTab()">Analyse détaillée</button>
      </div>
      <div class="bud-grid-scroll"><table class="bud-table">
        <thead><tr><th>Bien</th><th>Nuits</th><th>Écart</th><th>Occupation</th><th>Écart</th><th>Prix moyen</th><th>Écart</th><th>CA hébergement</th><th>Écart</th></tr></thead>
        <tbody>${ids.map(id => line((biens.find(b => b.id === id) || {}).name || id, cmp[id])).join('')}${ids.length > 1 ? line('Total', T, true) : ''}</tbody>
      </table></div>
    </div>`;
  } catch (e) { console.warn('[budget] objectifs LCD', e); return ''; }
}

// ── KPIs longue durée : loyers, charges, capital, cash-flow ──
function budLldKpiHtml() {
  try {
    const sc = budSynScope();
    if (!sc.compared.length) return '';
    const lld = (getParams().biens || []).filter(b => b.type === 'LLD');
    if (!lld.length) return '';
    const ids = new Set(lld.map(b => b.id));
    const biens = getParams().biens || [];
    const CAP = new Set(['Remboursement emprunt', 'Versement emprunt']);
    const kind = l => _isCA(l) ? 'rev' : _isDep(l) ? 'chg' : CAP.has(l.cat || l.categorie) ? 'cap' : null;
    const acc = {};
    const add = (id, l, src) => { const k = kind(l); if (!k || !ids.has(id)) return; const o = acc[id] = acc[id] || { rev: [0, 0], chg: [0, 0], cap: [0, 0] }; o[k][src] += +l.montant || 0; };
    _synLines().filter(l => sc.comparedSet.has(l._period)).forEach(l => add(budEntityOfLine(l, biens), l, 0));
    budLinesFor(sc.compared, sc.filters, sc.store).forEach(l => add(l._entity, l, 1));
    const list = Object.keys(acc);
    if (!list.length) return '';
    const tot = list.reduce((a, id) => { ['rev', 'chg', 'cap'].forEach(k => { a[k][0] += acc[id][k][0]; a[k][1] += acc[id][k][1]; }); return a; }, { rev: [0, 0], chg: [0, 0], cap: [0, 0] });
    const line = (name, o, strong) => {
      const cR = o.rev[0] + o.chg[0] + o.cap[0], cB = o.rev[1] + o.chg[1] + o.cap[1];
      return `<tr class="${strong ? 'bud-row-strong' : ''}"><td>${budEsc(name)}</td>
        <td>${budFmt(o.rev[0])} / ${budFmt(o.rev[1])}</td><td>${budVarHtml(o.rev[0], o.rev[1], 1, { noEur: true })}</td>
        <td>${budFmt(-o.chg[0])} / ${budFmt(-o.chg[1])}</td><td>${budVarHtml(o.chg[0], o.chg[1], -1, { noEur: true })}</td>
        <td>${budFmt(-o.cap[0])} / ${budFmt(-o.cap[1])}</td>
        <td>${budFmt(cR, { signed: true })} / ${budFmt(cB, { signed: true })}</td><td>${budVarHtml(cR, cB, 1, { noEur: true })}</td></tr>`;
    };
    return `<div class="card bud-sig" style="margin-top:18px">
      <div class="bud-strip-head">
        <div class="bud-strip-title">${icon('target', { size: 15 })}Longue durée — réel / budget</div>
        <div class="bud-strip-meta">${budEsc(budFmtMonths(sc.compared))} · cash-flow après crédit = loyers − charges − capital remboursé</div>
        <button class="bud-link" onclick="budOpenTab()">Analyse détaillée</button>
      </div>
      <div class="bud-grid-scroll"><table class="bud-table">
        <thead><tr><th>Bien</th><th>Loyers</th><th>Écart</th><th>Charges</th><th>Écart</th><th>Capital</th><th>Cash-flow</th><th>Écart</th></tr></thead>
        <tbody>${list.map(id => line((biens.find(b => b.id === id) || {}).name || id, acc[id])).join('')}${list.length > 1 ? line('Total', tot, true) : ''}</tbody>
      </table></div>
    </div>`;
  } catch (e) { console.warn('[budget] LLD', e); return ''; }
}

// ── Plateformes : revenus par canal ──
function budChannelOf(cat) {
  if (cat === 'Airbnb') return 'Airbnb';
  if (cat === 'Booking') return 'Booking';
  if (cat === 'Location directe' || cat === 'Stripe') return 'Direct';
  if (cat === 'Loyer mensuel') return 'Longue durée';
  return 'Revenus annexes';
}
function budPltHtml(yearSel, bienSel) {
  try {
    const store = budGetStore();
    const years = yearSel && yearSel !== 'all' ? [String(yearSel)] : [...budYearsWithBudget(store)];
    const imported = budImportedPeriods();
    const months = years.flatMap(y => BUD_MONTHS.map((_, i) => budPeriod(y, i))).filter(p => imported.has(p) && budRefVersion(+p.slice(0, 4), store)).sort();
    if (!months.length) return '';
    const set = new Set(months);
    const f = { bien: bienSel && bienSel !== 'all' ? [bienSel] : [] };
    const real = _synLines({ sci: [], bien: f.bien, cat: [], dmin: '', dmax: '' }).filter(l => set.has(l._period) && _isCA(l) && +l.montant > 0);
    const bud = budLinesFor(months, f, store).filter(l => _isCA(l));
    const C = {};
    const chanOfLine = l => l.sourcePlatform === 'Airbnb' ? 'Airbnb' : l.sourcePlatform === 'Booking' ? 'Booking' : budChannelOf(l.cat || l.categorie || '');
    real.forEach(l => { const k = chanOfLine(l); (C[k] = C[k] || [0, 0])[0] += +l.montant; });
    bud.forEach(l => { const k = budChannelOf(l.cat); (C[k] = C[k] || [0, 0])[1] += +l.montant; });
    const order = ['Airbnb', 'Booking', 'Direct', 'Longue durée', 'Revenus annexes'].filter(k => C[k]);
    const T = order.reduce((a, k) => [a[0] + C[k][0], a[1] + C[k][1]], [0, 0]);
    return `<div class="card bud-sig" style="margin-top:18px">
      <div class="bud-strip-head">
        <div class="bud-strip-title">${icon('target', { size: 15 })}Revenus par canal — réel vs budget</div>
        <div class="bud-strip-meta">${budEsc(budFmtMonths(months))} · ${months.length} mois importé${months.length > 1 ? 's' : ''}</div>
        <button class="bud-link" onclick="budOpenTab()">Analyse détaillée</button>
      </div>
      <div class="bud-grid-scroll"><table class="bud-table bud-table-sig"><thead><tr><th>Canal</th><th>Réel</th><th>Budget</th><th>Écart</th><th>Réalisé</th></tr></thead><tbody>
      ${order.map(k => `<tr><td>${k}</td><td>${budFmt(C[k][0], { eur: true })}</td><td>${budFmt(C[k][1], { eur: true, dashZero: true })}</td><td>${budVarHtml(C[k][0], C[k][1], 1)}</td><td>${C[k][1] ? Math.round(C[k][0] / C[k][1] * 100) + budNbsp + '%' : '—'}</td></tr>`).join('')}
      <tr class="bud-row-strong"><td>Total</td><td>${budFmt(T[0], { eur: true })}</td><td>${budFmt(T[1], { eur: true })}</td><td>${budVarHtml(T[0], T[1], 1)}</td><td>${T[1] ? Math.round(T[0] / T[1] * 100) + budNbsp + '%' : '—'}</td></tr>
      </tbody></table></div>
    </div>`;
  } catch (e) { console.warn('[budget] plateformes', e); return ''; }
}

// ══════════════════════════════════════════════
//  ONGLET « BUDGET » DU DASHBOARD
// ══════════════════════════════════════════════
const _budTab = { year: null, vid: null, sci: 'all', bien: 'all', metric: 'res', view: 'cat' };

function budOpenTab() {
  const btn = document.querySelector('.dnav-head[data-tab="budget"]');
  if (btn) switchNavHead(btn);
}

function renderBudgetTab() {
  const el = document.getElementById('bud-dash-content');
  const fl = document.getElementById('bud-dash-filters');
  if (!el) return;
  const store = budGetStore();
  const versions = budVersionsList(store);
  if (!versions.length) {
    if (fl) fl.innerHTML = '';
    el.innerHTML = `<div class="bud-empty">
      <div class="bud-empty-ico">${icon('target', { size: 30 })}</div>
      <h2>Aucun budget</h2>
      <p>Définissez un budget pour une année. Le dashboard comparera ensuite le réel au budget dans chaque onglet, et cet onglet affichera l'analyse détaillée des écarts et l'atterrissage de fin d'année.</p>
      <button class="btn btn-cyan" onclick="showBudget('dashboard')">${icon('plus', { size: 15 })}Créer un budget</button></div>`;
    return;
  }
  const years = [...new Set(versions.map(v => +v.year))].sort((a, b) => b - a);
  const nowY = new Date().getFullYear();
  if (!_budTab.year || !years.includes(_budTab.year)) _budTab.year = years.includes(nowY) ? nowY : years[0];
  const yv = versions.filter(v => +v.year === _budTab.year);
  if (!_budTab.vid || !yv.some(v => v.id === _budTab.vid)) _budTab.vid = (budRefVersion(_budTab.year, store) || yv[0]).id;
  const v = store.versions[_budTab.vid];
  const ref = budRefVersion(_budTab.year, store);
  const p = getParams();
  const scis = p.scis || [];
  const biensF = (p.biens || []).filter(b => _budTab.sci === 'all' || b.sci === _budTab.sci);
  if (_budTab.bien !== 'all' && !biensF.some(b => b.id === _budTab.bien)) _budTab.bien = 'all';

  if (fl) fl.innerHTML = `
    <div class="dash-filter-group"><label class="lbl">Année</label>
      <select class="sel dash-sel" onchange="_budTab.year=+this.value;_budTab.vid=null;renderBudgetTab()">${years.map(y => `<option${y === _budTab.year ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
    <div class="dash-filter-group"><label class="lbl">Version</label>
      <select class="sel dash-sel" onchange="_budTab.vid=this.value;renderBudgetTab()">${yv.map(x => `<option value="${x.id}"${x.id === v.id ? ' selected' : ''}>${budEsc(x.name)}${ref && ref.id === x.id ? ' (référence)' : ''}</option>`).join('')}</select></div>
    <div class="dash-filter-group"><label class="lbl">Société</label>
      <select class="sel dash-sel" onchange="_budTab.sci=this.value;renderBudgetTab()"><option value="all">Toutes</option>${scis.map(s => `<option${s === _budTab.sci ? ' selected' : ''}>${budEsc(s)}</option>`).join('')}</select></div>
    <div class="dash-filter-group"><label class="lbl">Bien</label>
      <select class="sel dash-sel" onchange="_budTab.bien=this.value;renderBudgetTab()"><option value="all">Tous</option>${biensF.map(b => `<option value="${budAttr(b.id)}"${b.id === _budTab.bien ? ' selected' : ''}>${budEsc(b.name)}</option>`).join('')}</select></div>
    <button class="btn btn-outline bud-edit-btn" onclick="showBudget('dashboard','${v.id}')">${icon('pencil', { size: 14 })}Modifier le budget</button>`;

  // ── Données : réel (index par entité) et budget de la version choisie, mois par mois ──
  const year = _budTab.year;
  const imported = budImportedPeriods();
  const closed = BUD_MONTHS.map((_, i) => imported.has(budPeriod(year, i)));
  const nClosed = closed.filter(Boolean).length;
  const ents = budEntities().filter(e => (_budTab.sci === 'all' || e.sci === _budTab.sci) && (_budTab.bien === 'all' || e.id === _budTab.bien));
  const entSet = new Set(ents.map(e => e.id));
  if (_budTab.bien === 'all' && _budTab.sci === 'all') entSet.add('@none');
  const { sum } = budActual();
  // cell[cat][entity] = { r:[12], b:[12] }
  const cell = {};
  const get = (cat, e) => { cell[cat] = cell[cat] || {}; return cell[cat][e] = cell[cat][e] || { r: BUD_MONTHS.map(() => 0), b: BUD_MONTHS.map(() => 0) }; };
  sum.forEach((x, k) => {
    if (!k.startsWith(year + '-')) return;
    const parts = k.split(BUD_SEP), per = parts[0], e = parts[1], cat = parts.slice(2).join(BUD_SEP);
    if (!entSet.has(e)) return;
    get(cat, e).r[+per.slice(5) - 1] += x;
  });
  Object.entries(v.rows || {}).forEach(([k, r]) => {
    const [e, cat] = budSplitKey(k);
    if (!entSet.has(e)) return;
    const c = get(cat, e);
    r.m.forEach((x, i) => c.b[i] += +x || 0);
  });

  // Agrégats par section (signés)
  const secOf = cat => budSectionOf(cat);
  const S = {}; ['prod', 'exp', 'fin', 'bil'].forEach(s => S[s] = { r: BUD_MONTHS.map(() => 0), b: BUD_MONTHS.map(() => 0) });
  Object.entries(cell).forEach(([cat, byE]) => Object.values(byE).forEach(c => { const s = S[secOf(cat)]; c.r.forEach((x, i) => s.r[i] += x); c.b.forEach((x, i) => s.b[i] += x); }));
  const comb = (keys, f) => BUD_MONTHS.map((_, i) => keys.reduce((a, k) => a + S[k][f][i], 0));
  const M = {
    ca:   { label: 'Chiffre d\'affaires', r: S.prod.r, b: S.prod.b, sign: 1 },
    chg:  { label: 'Charges', r: comb(['exp', 'fin'], 'r'), b: comb(['exp', 'fin'], 'b'), sign: -1 },
    res:  { label: 'Résultat (hors amort.)', r: comb(['prod', 'exp', 'fin'], 'r'), b: comb(['prod', 'exp', 'fin'], 'b'), sign: 1, signed: true },
    cash: { label: 'Cash-flow net', r: comb(['prod', 'exp', 'fin', 'bil'], 'r'), b: comb(['prod', 'exp', 'fin', 'bil'], 'b'), sign: 1, signed: true },
  };
  const atDate = arr => arr.reduce((a, x, i) => a + (closed[i] ? x : 0), 0);
  const rest = arr => arr.reduce((a, x, i) => a + (closed[i] ? 0 : x), 0);
  const total = arr => arr.reduce((a, x) => a + x, 0);
  const land = m => atDate(m.r) + rest(m.b);

  const kpi = (key) => {
    const m = M[key], s = m.sign;
    const r = atDate(m.r) * s, b = atDate(m.b) * s, ba = total(m.b) * s, at = land(m) * s;
    return `<div class="card kpi-card bud-kpi-card">
      <div class="bud-kpi-l">${m.label}</div>
      <div class="bud-kpi-v ${m.signed && r < 0 ? 'neg' : ''}">${budFmt(r, { eur: true, signed: m.signed })}</div>
      <div class="bud-kpi-s">budget à date ${budFmt(b, { eur: true, signed: m.signed })} · ${budVarHtml(r * s, b * s, s)}</div>
      <div class="bud-kpi-s2">Atterrissage ${budFmt(at, { eur: true, signed: m.signed })} <span class="bud-muted">pour ${budFmt(ba, { eur: true, signed: m.signed })} budgétés</span></div>
    </div>`;
  };

  const landRows = [['Chiffre d\'affaires', 'prod', 1], ['Charges d\'exploitation', 'exp', -1], ['Charges financières et impôt', 'fin', -1]];
  const landRow = (label, r, b, s, strong) => {
    const vR = atDate(r) * s, vB = atDate(b) * s, vA = total(b) * s, vL = (atDate(r) + rest(b)) * s, vRest = rest(b) * s;
    return `<tr class="${strong ? 'bud-row-strong' : ''}"><td>${label}</td><td>${budFmt(vA, { signed: strong })}</td><td>${budFmt(vR, { signed: strong })}</td><td>${budFmt(vB, { signed: strong })}</td>
      <td>${budVarHtml(vR * s, vB * s, s, { noEur: true })}</td><td>${budFmt(vRest, { signed: strong, dashZero: true })}</td><td class="bud-strong">${budFmt(vL, { signed: strong })}</td><td>${budVarHtml(vL * s, vA * s, s, { noEur: true })}</td></tr>`;
  };

  const metricKeys = ['ca', 'chg', 'res', 'cash'];
  const chartId = 'bud-combo-' + Date.now();

  // Tableau détaillé : par catégorie ou par bien
  const detailRows = () => {
    if (_budTab.view === 'bien') {
      const byE = {};
      Object.entries(cell).forEach(([cat, m]) => Object.entries(m).forEach(([e, c]) => {
        const o = byE[e] = byE[e] || { rR: 0, bR: 0, cR: 0, cB: 0, cA: 0, cL: 0 };
        const sec = secOf(cat);
        if (sec !== 'bil') { o.rR += atDate(c.r); o.bR += atDate(c.b); }
        o.cR += atDate(c.r); o.cB += atDate(c.b); o.cA += total(c.b); o.cL += atDate(c.r) + rest(c.b);
      }));
      const list = Object.entries(byE).sort((a, b) => Math.abs(b[1].cA) - Math.abs(a[1].cA));
      return `<thead><tr><th class="bud-c-cat">Bien</th><th>Résultat réel</th><th>Résultat budget</th><th>Écart</th><th>Cash-flow réel</th><th>Cash-flow budget</th><th>Écart</th><th>Budget annuel</th><th>Atterrissage</th></tr></thead><tbody>
        ${list.map(([e, o]) => `<tr><td class="bud-c-cat">${budEsc(e === '@none' ? 'Non attribué' : budEntityLabel(e))}</td><td>${budFmt(o.rR, { signed: true })}</td><td>${budFmt(o.bR, { signed: true })}</td><td>${budVarHtml(o.rR, o.bR, 1, { noEur: true })}</td>
          <td>${budFmt(o.cR, { signed: true })}</td><td>${budFmt(o.cB, { signed: true })}</td><td>${budVarHtml(o.cR, o.cB, 1, { noEur: true })}</td><td>${budFmt(o.cA, { signed: true })}</td><td class="bud-strong">${budFmt(o.cL, { signed: true })}</td></tr>`).join('')}
      </tbody>`;
    }
    return `<thead><tr><th class="bud-c-cat">Catégorie</th><th>Réel à date</th><th>Budget à date</th><th>Écart</th><th>Écart %</th><th>Budget annuel</th><th>Atterrissage</th><th>Consommé</th></tr></thead>
      ${BUD_SECTIONS.map(sec => {
        const cats = Object.keys(cell).filter(c => secOf(c) === sec.id).map(c => {
          const r = BUD_MONTHS.map(() => 0), b = BUD_MONTHS.map(() => 0);
          Object.values(cell[c]).forEach(x => { x.r.forEach((y, i) => r[i] += y); x.b.forEach((y, i) => b[i] += y); });
          return { c, r, b, d: budDir(c) };
        }).filter(o => o.r.some(x => Math.abs(x) >= 0.5) || o.b.some(x => Math.abs(x) >= 0.5))
          .sort((a, b) => (atDate(a.r) - atDate(a.b)) - (atDate(b.r) - atDate(b.b)));
        if (!cats.length) return '';
        const ds = sec.id === 'prod' ? 1 : sec.id === 'bil' ? 1 : -1;
        const tr = S[sec.id];
        return `<tbody><tr class="bud-sec-head"><th colspan="8"><span>${sec.label}</span></th></tr>
          ${cats.map(o => {
            const R = atDate(o.r) * o.d, B = atDate(o.b) * o.d, A = total(o.b) * o.d, L = (atDate(o.r) + rest(o.b)) * o.d;
            const v = budVar(R * o.d, B * o.d, o.d);
            const used = A ? R / A * 100 : null;
            return `<tr><td class="bud-c-cat">${budEsc(o.c)}</td><td>${budFmt(R)}</td><td>${budFmt(B, { dashZero: true })}</td><td>${budVarHtml(R * o.d, B * o.d, o.d, { noPct: true, noEur: true })}</td>
              <td class="${Math.abs(R - B) < 0.5 ? '' : v.fav ? 'pos' : 'neg'}">${v.pct === null ? (A ? 'prévu plus tard' : 'non budgété') : budFmtPct(v.pct, true)}</td><td>${budFmt(A, { dashZero: true })}</td><td class="bud-strong">${budFmt(L)}</td>
              <td>${used === null ? '—' : `<div class="bud-used"><div class="bud-bar-track"><div class="bud-bar-fill ${o.d < 0 ? (used > 100 ? 'neg' : 'pos') : (used >= 100 ? 'pos' : 'mid')}" style="width:${Math.max(0, Math.min(used, 100))}%"></div></div><span>${Math.round(used)}${budNbsp}%</span></div>`}</td></tr>`;
          }).join('')}
          <tr class="bud-sec-total"><td class="bud-c-cat">Total ${sec.label.toLowerCase()}</td><td>${budFmt(atDate(tr.r) * ds, { signed: sec.id === 'bil' })}</td><td>${budFmt(atDate(tr.b) * ds, { signed: sec.id === 'bil' })}</td><td>${budVarHtml(atDate(tr.r), atDate(tr.b), ds, { noPct: true, noEur: true })}</td><td></td><td>${budFmt(total(tr.b) * ds, { signed: sec.id === 'bil' })}</td><td class="bud-strong">${budFmt((atDate(tr.r) + rest(tr.b)) * ds, { signed: sec.id === 'bil' })}</td><td></td></tr>
        </tbody>`;
      }).join('')}`;
  };

  // Objectifs courte durée de la version choisie
  const lcdHtml = (() => {
    const lcdB = (p.biens || []).filter(b => b.type === 'LCD' && entSet.has(b.id) && v.lcd && v.lcd[b.id]);
    if (!lcdB.length) return '';
    const ni = budNightsIndex();
    const rows = lcdB.map(b => {
      const o = v.lcd[b.id];
      let nR = 0, nO = 0, caR = 0, caO = 0, days = 0, nA = 0;
      BUD_MONTHS.forEach((_, i) => {
        nA += +o.nuits[i] || 0;
        if (!closed[i]) return;
        const per = budPeriod(year, i);
        nR += (ni[b.id] || {})[per] || 0; nO += +o.nuits[i] || 0; caO += (+o.nuits[i] || 0) * (+o.prix[i] || 0);
        BUD_LCD_CATS.forEach(c => caR += sum.get(per + BUD_SEP + b.id + BUD_SEP + c) || 0);
        days += budDaysInMonth(year, i);
      });
      return `<tr><td class="bud-c-cat">${budEsc(b.name)}</td><td>${budFmt(nR)}</td><td>${budFmt(nO)}</td><td>${budVarHtml(nR, nO, 1, { noEur: true })}</td>
        <td>${days ? budFmtPct(nR / days * 100) : '—'}</td><td>${days ? budFmtPct(nO / days * 100) : '—'}</td>
        <td>${nR ? budFmt(caR / nR, { eur: true }) : '—'}</td><td>${nO ? budFmt(caO / nO, { eur: true }) : '—'}</td><td>${budFmt(nA)}</td></tr>`;
    }).join('');
    return `<div class="card" style="margin-top:18px"><div class="card-title">Objectifs courte durée — à date (${nClosed} mois)</div>
      <div class="bud-grid-scroll"><table class="bud-table"><thead><tr><th class="bud-c-cat">Bien</th><th>Nuits réelles</th><th>Nuits objectif</th><th>Écart</th><th>Occupation réelle</th><th>Occupation objectif</th><th>Prix moyen réel</th><th>Prix moyen objectif</th><th>Nuits objectif (année)</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  })();

  el.innerHTML = `
    <div class="bud-dash-note">${ref && ref.id === v.id ? `« ${budEsc(v.name)} » est la version comparée au réel ${year} dans les autres onglets.` : `Version consultée : « ${budEsc(v.name)} ». Les autres onglets comparent le réel à « ${budEsc(ref ? ref.name : '—')} ».`}
      ${nClosed ? `Réel à date : ${nClosed} mois importé${nClosed > 1 ? 's' : ''} (${budEsc(BUD_MONTHS.filter((_, i) => closed[i]).map(m => m.toLowerCase()).join(', '))}).` : `Aucun relevé ${year} importé : l'atterrissage est égal au budget.`}</div>
    <div class="dash-grid-4" style="margin-bottom:18px">${metricKeys.map(kpi).join('')}</div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-title bud-card-title" style="justify-content:space-between"><span>Mois par mois — réel vs budget ${year}<span class="bud-leg"><i style="background:#22d3c8"></i>Réel<i style="background:#5b6980"></i>Budget</span></span>
        <span class="bud-seg">${metricKeys.map(k => `<button class="${_budTab.metric === k ? 'active' : ''}" onclick="_budTab.metric='${k}';renderBudgetTab()">${M[k].label}</button>`).join('')}</span></div>
      <div class="ac-wrap"><canvas id="${chartId}"></canvas></div>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">Atterrissage fin ${year} — réel des mois importés + budget des mois restants</div>
      <div class="bud-grid-scroll"><table class="bud-table">
        <thead><tr><th class="bud-c-cat"></th><th>Budget annuel</th><th>Réel à date</th><th>Budget à date</th><th>Écart à date</th><th>Budget restant</th><th>Atterrissage</th><th>vs budget annuel</th></tr></thead>
        <tbody>
          ${landRows.map(([l, k, s]) => landRow(l, S[k].r, S[k].b, s)).join('')}
          ${landRow('Résultat (hors amortissements)', M.res.r, M.res.b, 1, true)}
          ${landRow('Hors résultat (capital, travaux, apports…)', S.bil.r, S.bil.b, 1)}
          ${landRow('Cash-flow net', M.cash.r, M.cash.b, 1, true)}
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-title bud-card-title" style="justify-content:space-between"><span>Détail des écarts à date</span>
        <span class="bud-seg"><button class="${_budTab.view === 'cat' ? 'active' : ''}" onclick="_budTab.view='cat';renderBudgetTab()">Par catégorie</button><button class="${_budTab.view === 'bien' ? 'active' : ''}" onclick="_budTab.view='bien';renderBudgetTab()">Par bien</button></span></div>
      <div class="bud-grid-scroll"><table class="bud-table bud-table-detail">${detailRows()}</table></div>
      <div class="bud-legend"><span class="pos">vert</span> = favorable (plus de recettes ou moins de dépenses que prévu) · <span class="neg">rouge</span> = défavorable. Les charges sont affichées en positif.</div>
    </div>
    ${lcdHtml}`;

  requestAnimationFrame(() => {
    const m = M[_budTab.metric] || M.res, s = m.sign;
    ArtCharts.combo(document.getElementById(chartId), {
      labels: BUD_MONTHS.map((_, i) => budPeriod(year, i)),
      bars: [
        { name: 'Réel', values: m.r.map((x, i) => closed[i] ? x * s : 0), color: '#22d3c8' },
        { name: 'Budget', values: m.b.map(x => x * s), color: '#5b6980' },
      ],
      height: 260,
    });
  });
}

// Insère un bloc juste après le premier élément d'un onglet (sous la rangée d'indicateurs)
function _budAfterFirst(el, html) {
  try {
    if (!html || !el) return;
    const first = el.firstElementChild;
    if (first) first.insertAdjacentHTML('afterend', html); else el.insertAdjacentHTML('beforeend', html);
  } catch (e) { console.warn('[budget]', e); }
}
