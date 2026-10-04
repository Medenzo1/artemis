// ══════════════════════════════════════════════
//  BUDGET — données, réel de référence (N-1) et écran de saisie
//
//  Un budget = une version (ex. « Budget 2027 — initial ») pour une année civile.
//  Montants saisis par bien (ou « hors bien » d'une SCI) × catégorie × mois, avec la
//  même convention de signe que la base bancaire : + = entrée, − = sortie.
//  À l'écran, chaque ligne est affichée dans son sens naturel (une charge de 180 € s'affiche 180).
//  La version de référence de chaque année est celle que le dashboard compare au réel.
//  Stockage : localStorage « artemis_budget » (synchronisé dans le cloud, cf. _SYNC_KEYS).
// ══════════════════════════════════════════════

const BUDGET_KEY = 'artemis_budget';
const BUD_MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const BUD_MONTHS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const BUD_SEP = '||';
// Catégories de bilan qui sont des entrées d'argent (les autres sorties de bilan sont des décaissements)
const BUD_INFLOW_BILAN = new Set(['CCA apport', 'Encaissement emprunt', 'Cash-out']);
// Jamais budgétées : écriture comptable sans flux bancaire
const BUD_EXCLUDED_CATS = new Set(['Amortissement']);
// Catégories de revenu « hébergement » (objectifs courte durée)
const BUD_LCD_CATS = new Set(['Airbnb', 'Booking', 'Location directe', 'Stripe']);

const BUD_SECTIONS = [
  { id: 'prod', label: 'Produits', hint: 'loyers, plateformes, autres revenus' },
  { id: 'exp',  label: 'Charges d\'exploitation', hint: 'ménage, énergie, assurances, taxes…' },
  { id: 'fin',  label: 'Charges financières et impôt', hint: 'intérêts, IS, exceptionnel' },
  { id: 'bil',  label: 'Hors résultat (trésorerie)', hint: 'capital remboursé, travaux immobilisés, apports…' },
];

function budSectionOf(cat) {
  const s = (typeof SCHEMA !== 'undefined' && SCHEMA[cat]) || null;
  const n2 = s ? s.n2 : '';
  if (n2 === "Produits d'exploitation" || n2 === 'Produits financiers' || n2 === 'Produits exceptionnels') return 'prod';
  if (n2 === "Charges d'exploitation") return 'exp';
  if (n2 === 'Charges financières' || n2 === 'Charges exceptionnelles') return 'fin';
  return 'bil';
}
// Sens naturel d'une catégorie : +1 entrée, −1 sortie
function budDir(cat) {
  const sec = budSectionOf(cat);
  if (sec === 'prod') return 1;
  if (sec === 'bil') return BUD_INFLOW_BILAN.has(cat) ? 1 : -1;
  return -1;
}
function budAllCats() {
  const set = new Set([...(typeof CATS !== 'undefined' ? CATS : []), ...Object.keys(typeof SCHEMA !== 'undefined' ? SCHEMA : {})]);
  return [...set].filter(c => !BUD_EXCLUDED_CATS.has(c)).sort((a, b) => a.localeCompare(b, 'fr'));
}

// ── Stockage ────────────────────────────────
function budGetStore() {
  try {
    const s = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null');
    if (s && typeof s === 'object' && s.versions) { s.ref = s.ref || {}; return s; }
  } catch (e) {}
  return { versions: {}, ref: {} };
}
function budSaveStore(s) {
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(s)); }
  catch (e) { showToast('⚠ Enregistrement du budget impossible : ' + e.message, '#f0566a'); }
}
function budVersionsList(store) {
  store = store || budGetStore();
  return Object.values(store.versions).sort((a, b) => b.year - a.year || String(b.updated || '').localeCompare(String(a.updated || '')));
}
// Version comparée au réel pour une année : celle marquée « référence », sinon la plus récemment modifiée
function budRefVersion(year, store) {
  store = store || budGetStore();
  const id = store.ref[year];
  if (id && store.versions[id]) return store.versions[id];
  const vs = budVersionsList(store).filter(v => +v.year === +year);
  return vs[0] || null;
}
function budNewId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function budRowKey(entity, cat) { return entity + BUD_SEP + cat; }
function budSplitKey(k) { const i = k.indexOf(BUD_SEP); return [k.slice(0, i), k.slice(i + BUD_SEP.length)]; }

// ── Entités : biens, et « hors bien » de chaque SCI ──
function budEntities() {
  const p = getParams();
  const list = (p.biens || []).map(b => ({ id: b.id, label: b.name, sci: b.sci || '', type: b.type || '', bienName: b.name }));
  (p.scis || []).forEach(s => list.push({ id: '@sci:' + s, label: 'Hors bien', sci: s, type: 'SCI', bienName: '' }));
  return list;
}
function budEntityInfo(id) {
  const e = budEntities().find(x => x.id === id);
  if (e) return e;
  if (id.startsWith('@sci:')) return { id, label: 'Hors bien', sci: id.slice(5), type: 'SCI', bienName: '' };
  return { id, label: 'Non attribué', sci: '', type: '', bienName: '' };
}
function budEntityLabel(id) {
  const e = budEntityInfo(id);
  return e.type === 'SCI' ? 'Hors bien — ' + e.sci : e.label;
}
// Entité d'une ligne réelle (après ventilation des frais généraux)
function budEntityOfLine(l, biens) {
  const n = l.bienName || l.bien || '';
  const b = biens.find(x => (l.bienId && x.id === l.bienId) || (n && x.name === n));
  if (b) return b.id;
  if (l.sci) return '@sci:' + l.sci;
  return '@none';
}

// ── Réel indexé par mois × entité × catégorie (mis en cache) ──
let _budActualCache = null;
function budActual() {
  const rawDb = localStorage.getItem('artemis_db') || '';
  const rawP = localStorage.getItem('artemis_params') || '';
  if (_budActualCache && _budActualCache.rawDb === rawDb && _budActualCache.rawP === rawP) return _budActualCache;
  const db = getDB();
  const biens = getParams().biens || [];
  const periods = new Set(Object.keys(db.periods || {}));
  let lines = Object.values(db.periods || {}).flatMap(p => (p.lines || []).map(l => ({ ...l, _period: p.period })));
  lines = _expandFG(lines);
  const sum = new Map();          // 'YYYY-MM||entité||cat' → montant signé
  lines.forEach(l => {
    const cat = l.cat || l.categorie || '';
    if (!cat || BUD_EXCLUDED_CATS.has(cat)) return;
    const k = l._period + BUD_SEP + budEntityOfLine(l, biens) + BUD_SEP + cat;
    sum.set(k, (sum.get(k) || 0) + (+l.montant || 0));
  });
  _budActualCache = { rawDb, rawP, periods, sum };
  return _budActualCache;
}
const _pad2 = n => String(n).padStart(2, '0');
function budPeriod(year, mi) { return year + '-' + _pad2(mi + 1); }

// Année de référence de chaque mois d'un budget : dernier mois civil identique déjà importé avant l'année budgétée
// (ex. budget 2027 préparé en octobre 2026 : janv.–sept. 2026 et oct.–déc. 2025).
function budBaseYears(year) {
  const { periods } = budActual();
  return BUD_MONTHS.map((_, mi) => {
    for (let y = year - 1; y >= year - 6; y--) if (periods.has(budPeriod(y, mi))) return y;
    return null;
  });
}
function budBaseLabel(year) {
  const ys = budBaseYears(year);
  if (ys.every(y => y === null)) return 'aucun réel importé avant ' + year;
  const parts = [];
  let i = 0;
  while (i < 12) {
    const y = ys[i]; let j = i;
    while (j + 1 < 12 && ys[j + 1] === y) j++;
    parts.push(y === null ? BUD_MONTHS[i].toLowerCase() + (j > i ? '–' + BUD_MONTHS[j].toLowerCase() : '') + ' : aucun' : BUD_MONTHS[i].toLowerCase() + (j > i ? '–' + BUD_MONTHS[j].toLowerCase() : '') + ' ' + y);
    i = j + 1;
  }
  return parts.join(', ');
}
// Réel de référence (signé) d'une ligne entité × catégorie, mois par mois
function budBaseRow(entity, cat, year, baseYears) {
  const { sum } = budActual();
  baseYears = baseYears || budBaseYears(year);
  return baseYears.map((y, mi) => y === null ? 0 : Math.round((sum.get(budPeriod(y, mi) + BUD_SEP + entity + BUD_SEP + cat) || 0) * 100) / 100);
}
// Toutes les lignes entité × catégorie ayant du réel de référence
function budBaseKeys(year, baseYears) {
  const { sum } = budActual();
  baseYears = baseYears || budBaseYears(year);
  const wanted = new Set(baseYears.map((y, mi) => y === null ? null : budPeriod(y, mi)).filter(Boolean));
  const keys = new Set();
  sum.forEach((v, k) => {
    if (!v) return;
    const p = k.slice(0, 7);
    if (wanted.has(p)) keys.add(k.slice(7 + BUD_SEP.length));
  });
  return [...keys];
}

// ── Réel courte durée : nuits par bien × mois (exports Airbnb / Booking + réservations directes) ──
function budResBienId(logement, biens, airbnbMap) {
  if (!logement) return null;
  const id = airbnbMap[logement];
  if (id && biens.some(b => b.id === id)) return id;
  const b = biens.find(x => x.name === logement || x.nom === logement || logement.includes(x.name) || (x.nom && logement.includes(x.nom)));
  return b ? b.id : null;
}
function budNightsIndex() {
  const p = getParams(), biens = p.biens || [], am = p.airbnbMap || {};
  const idx = {};   // bienId → { 'YYYY-MM': nuits }
  const add = (id, date, n) => {
    const d = (_normDateStr(date).sort || '').slice(0, 7);
    if (!id || !/^\d{4}-\d{2}$/.test(d) || !(n > 0)) return;
    (idx[id] = idx[id] || {})[d] = (idx[id][d] || 0) + n;
  };
  (typeof _getReservations === 'function' ? _getReservations() : []).forEach(r => add(budResBienId(r.logement, biens, am), r.dateDebut, +r.nuits || 0));
  let direct = [];
  try { direct = JSON.parse(localStorage.getItem('artemis_lcd') || '[]'); } catch (e) {}
  direct.forEach(a => {
    const id = a.bienId || (biens.find(b => b.name === a.bienName) || {}).id;
    add(id, a.dateDebut, parseInt(a.nuits) || 0);
  });
  return idx;
}
function budDaysInMonth(year, mi) { return new Date(year, mi + 1, 0).getDate(); }
// Base courte durée d'un bien : nuits mois par mois et prix moyen par nuit (moyenne annuelle de la base)
function budLcdBase(bienId, year, baseYears, nightsIdx) {
  baseYears = baseYears || budBaseYears(year);
  nightsIdx = nightsIdx || budNightsIndex();
  const nb = nightsIdx[bienId] || {};
  const nuits = baseYears.map((y, mi) => y === null ? 0 : (nb[budPeriod(y, mi)] || 0));
  let ca = 0;
  BUD_LCD_CATS.forEach(cat => budBaseRow(bienId, cat, year, baseYears).forEach(v => ca += v));
  const tot = nuits.reduce((a, b) => a + b, 0);
  const prix = tot > 0 && ca > 0 ? Math.round(ca / tot) : 0;
  return { nuits, prix: nuits.map(() => prix), ca };
}

// ── Construction d'une version ──
// source : { kind:'base', pctProd, pctChg } | { kind:'copy', from } | { kind:'empty' }
function budBuildVersion(name, year, source) {
  const v = { id: budNewId(), name, year: +year, created: new Date().toISOString(), updated: new Date().toISOString(), rows: {}, lcd: {} };
  if (source.kind === 'copy') {
    const src = budGetStore().versions[source.from];
    if (src) { v.rows = JSON.parse(JSON.stringify(src.rows || {})); v.lcd = JSON.parse(JSON.stringify(src.lcd || {})); }
  } else if (source.kind === 'base') {
    budFillFromBase(v, source.pctProd || 0, source.pctChg || 0, true);
  }
  return v;
}
// Remplit (ou recalcule) une version depuis le réel de référence, avec un ajustement en % sur les produits et sur les charges
function budFillFromBase(v, pctProd, pctChg, withLcd) {
  const by = budBaseYears(v.year);
  v.rows = {};
  budBaseKeys(v.year, by).forEach(k => {
    const [ent, cat] = budSplitKey(k);
    if (ent === '@none') return;
    const pct = budDir(cat) > 0 ? pctProd : pctChg;
    const base = budBaseRow(ent, cat, v.year, by);
    if (!base.some(x => x)) return;
    v.rows[k] = { m: base.map(x => Math.round(x * (1 + pct / 100))), pct };
  });
  if (withLcd) {
    v.lcd = {};
    const ni = budNightsIndex();
    (getParams().biens || []).filter(b => b.type === 'LCD').forEach(b => {
      const base = budLcdBase(b.id, v.year, by, ni);
      if (!base.nuits.some(x => x) && !base.prix.some(x => x)) return;
      v.lcd[b.id] = { nuits: base.nuits.slice(), prix: base.prix.map(x => Math.round(x * (1 + pctProd / 100))), pctN: 0, pctP: pctProd };
    });
  }
}

// ══════════════════════════════════════════════
//  ÉCRAN DE SAISIE
// ══════════════════════════════════════════════
const _bud = { vid: null, entity: null, tab: 'montants', from: 'home' };

function showBudget(from, vid) {
  _bud.from = from || 'home';
  const scr = document.getElementById('budgetScreen');
  const hs = document.getElementById('homeScreen');
  if (_bud.from === 'home' && hs) hs.style.display = 'none';
  if (scr) { scr.style.display = 'block'; scr.scrollTop = 0; }
  const store = budGetStore();
  if (vid && store.versions[vid]) _bud.vid = vid;
  if (!_bud.vid || !store.versions[_bud.vid]) {
    const thisYear = new Date().getFullYear();
    const v = budRefVersion(thisYear + 1, store) || budRefVersion(thisYear, store) || budVersionsList(store)[0];
    _bud.vid = v ? v.id : null;
  }
  budRender();
}
function exitBudget() {
  const scr = document.getElementById('budgetScreen');
  if (scr) scr.style.display = 'none';
  if (_bud.from === 'dashboard') { try { _renderDashTab(); } catch (e) {} }
  else if (_bud.from === 'tools') { /* l'écran Outils est resté en place */ }
  else showHome();
}

function budCurrent() { const s = budGetStore(); return _bud.vid ? s.versions[_bud.vid] || null : null; }
function budMutate(fn) {
  const s = budGetStore();
  const v = s.versions[_bud.vid];
  if (!v) return null;
  fn(v, s);
  v.updated = new Date().toISOString();
  budSaveStore(s);
  return v;
}

// Formats
const budNbsp = ' ';
function budFmt(v, opts) {
  opts = opts || {};
  if (v === null || v === undefined || isNaN(v)) return '—';
  const r = Math.round(v);
  if (!r && opts.dashZero) return '—';
  const s = Math.abs(r).toLocaleString('fr-FR').replace(/\s/g, budNbsp);
  return (r < 0 ? '−' : opts.signed && r > 0 ? '+' : '') + s + (opts.eur ? budNbsp + '€' : '');
}
function budFmtPct(v, signed) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const r = Math.round(v * 10) / 10;
  return (r < 0 ? '−' : signed && r > 0 ? '+' : '') + Math.abs(r).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + budNbsp + '%';
}
function budParse(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).replace(/[\s  €]/g, '').replace('−', '-').replace(',', '.');
  if (t === '' || t === '-') return 0;
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}
const budEsc = s => (typeof escHtml === 'function' ? escHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const budAttr = s => budEsc(s).replace(/`/g, '&#96;');

function budRender() {
  const head = document.getElementById('bud-header-actions');
  const el = document.getElementById('bud-content');
  if (!el) return;
  const store = budGetStore();
  const versions = budVersionsList(store);
  const v = budCurrent();

  if (head) head.innerHTML = v ? `
    <button class="bud-btn" onclick="budExportXlsx()">${icon('download', { size: 14 })}Exporter</button>
    <label class="bud-btn">${icon('upload', { size: 14 })}Importer<input type="file" accept=".xlsx,.xls" style="display:none" onchange="budImportXlsx(this)"></label>` : '';

  if (!versions.length || !v) {
    el.innerHTML = `
      <div class="bud-empty">
        <div class="bud-empty-ico">${icon('target', { size: 30 })}</div>
        <h2>Aucun budget pour l'instant</h2>
        <p>Créez un budget pour une année : il peut reprendre le réel de l'année précédente, mois par mois, avec un ajustement en %. Vous pourrez ensuite modifier chaque montant en euros.</p>
        <button class="btn btn-cyan" onclick="budOpenNew()">${icon('plus', { size: 15 })}Créer un budget</button>
      </div>`;
    return;
  }

  const isRef = budRefVersion(v.year, store) && budRefVersion(v.year, store).id === v.id;
  const opts = versions.map(x => {
    const r = budRefVersion(x.year, store);
    return `<option value="${x.id}"${x.id === v.id ? ' selected' : ''}>${budEsc(x.year + ' · ' + x.name)}${r && r.id === x.id ? ' (référence)' : ''}</option>`;
  }).join('');

  el.innerHTML = `
    <div class="bud-bar">
      <div class="bud-bar-main">
        <select class="sel bud-version-sel" onchange="_bud.vid=this.value;_bud.entity=null;budRender()" aria-label="Version du budget">${opts}</select>
        ${isRef ? `<span class="bud-chip bud-chip-ref">${icon('check', { size: 13 })}Comparée au réel dans le dashboard</span>`
                : `<button class="bud-link" onclick="budSetRef()">Comparer cette version au réel ${v.year}</button>`}
      </div>
      <div class="bud-bar-actions">
        <button class="bud-btn" onclick="budOpenNew()">${icon('plus', { size: 14 })}Nouveau</button>
        <button class="bud-btn" onclick="budDuplicate()">${icon('copy', { size: 14 })}Dupliquer</button>
        <button class="bud-btn" onclick="budRename()">${icon('pencil', { size: 14 })}Renommer</button>
        <button class="bud-btn" onclick="budOpenRebase()">${icon('refresh-cw', { size: 14 })}Repartir du réel</button>
        <button class="bud-btn bud-btn-danger" onclick="budDelete()">${icon('trash-2', { size: 14 })}Supprimer</button>
      </div>
    </div>
    <div class="bud-base-note">Réel de référence (N-1) : ${budEsc(budBaseLabel(v.year))}</div>
    <div class="bud-tabs" role="tablist">
      ${[['montants', 'Montants par bien'], ['lcd', 'Objectifs courte durée'], ['overview', 'Vue d\'ensemble']].map(([k, l]) =>
        `<button role="tab" aria-selected="${_bud.tab === k}" class="bud-tab${_bud.tab === k ? ' active' : ''}" onclick="_bud.tab='${k}';budRender()">${l}</button>`).join('')}
    </div>
    <div id="bud-tab-body"></div>`;

  if (_bud.tab === 'lcd') budRenderLcd(v);
  else if (_bud.tab === 'overview') budRenderOverview(v);
  else budRenderMontants(v);
}

// ── Totaux d'une version ──
function budRowTotal(r) { return (r && r.m ? r.m : []).reduce((a, b) => a + (+b || 0), 0); }
function budEntityTotals(v, entity) {
  const t = { prod: 0, exp: 0, fin: 0, bil: 0 };
  Object.entries(v.rows || {}).forEach(([k, r]) => {
    const [e, cat] = budSplitKey(k);
    if (entity && e !== entity) return;
    t[budSectionOf(cat)] += budRowTotal(r);
  });
  t.res = t.prod + t.exp + t.fin;
  t.cash = t.res + t.bil;
  return t;
}

// ── Onglet « Montants par bien » ──
function budRenderMontants(v) {
  const body = document.getElementById('bud-tab-body');
  const ents = budEntities();
  const used = new Set(Object.keys(v.rows || {}).map(k => budSplitKey(k)[0]));
  // Entités : biens + « hors bien » des SCI qui ont du budget ou du réel
  const baseEnts = new Set(budBaseKeys(v.year).map(k => budSplitKey(k)[0]));
  const shown = ents.filter(e => e.type !== 'SCI' || used.has(e.id) || baseEnts.has(e.id));
  if (!_bud.entity || !shown.some(e => e.id === _bud.entity)) _bud.entity = shown[0] ? shown[0].id : null;

  const bySci = {};
  shown.forEach(e => (bySci[e.sci || '—'] = bySci[e.sci || '—'] || []).push(e));
  const side = Object.entries(bySci).map(([sci, list]) => `
    <div class="bud-side-sci">${budEsc(sci)}</div>
    ${list.map(e => {
      const t = budEntityTotals(v, e.id);
      return `<button class="bud-side-item${e.id === _bud.entity ? ' active' : ''}" onclick="_bud.entity='${budAttr(e.id).replace(/'/g, '\\\'')}';budRender()">
        <span class="bud-side-name">${budEsc(e.label)}${e.type && e.type !== 'SCI' ? `<span class="bud-side-type">${budEsc(e.type)}</span>` : ''}</span>
        <span class="bud-side-val ${t.cash < 0 ? 'neg' : ''}">${budFmt(t.cash, { signed: true, eur: true })}</span>
      </button>`;
    }).join('')}`).join('');

  body.innerHTML = `
    <div class="bud-layout">
      <aside class="bud-side" aria-label="Biens">
        <div class="bud-side-head">Cash-flow budgété ${v.year}</div>
        ${side}
      </aside>
      <section class="bud-main" id="bud-grid-wrap"></section>
    </div>`;
  budRenderGrid(v);
}

function budRenderGrid(v) {
  const wrap = document.getElementById('bud-grid-wrap');
  if (!wrap || !_bud.entity) { if (wrap) wrap.innerHTML = '<div class="bud-empty-small">Aucun bien dans les paramètres.</div>'; return; }
  const ent = _bud.entity, info = budEntityInfo(ent);
  const by = budBaseYears(v.year);
  const baseKeys = new Set(budBaseKeys(v.year, by).filter(k => budSplitKey(k)[0] === ent).map(k => budSplitKey(k)[1]));
  const rowCats = new Set(Object.keys(v.rows || {}).filter(k => budSplitKey(k)[0] === ent).map(k => budSplitKey(k)[1]));
  const cats = [...new Set([...rowCats, ...baseKeys])];

  const sectionRows = BUD_SECTIONS.map(sec => {
    const list = cats.filter(c => budSectionOf(c) === sec.id).sort((a, b) => {
      const ra = v.rows[budRowKey(ent, a)], rb = v.rows[budRowKey(ent, b)];
      return Math.abs(budRowTotal(rb)) - Math.abs(budRowTotal(ra)) || a.localeCompare(b, 'fr');
    });
    const addable = budAllCats().filter(c => budSectionOf(c) === sec.id && !list.includes(c));
    const rowsHtml = list.map(cat => budGridRow(v, ent, cat, by)).join('');
    return `
      <tbody class="bud-sec" data-sec="${sec.id}">
        <tr class="bud-sec-head"><th colspan="17"><div class="bud-stick"><span>${sec.label}</span><small>${sec.hint}</small></div></th></tr>
        ${rowsHtml || `<tr class="bud-row-empty"><td colspan="17"><div class="bud-stick">Aucune ligne. Ajoutez une catégorie ci-dessous.</div></td></tr>`}
        <tr class="bud-sec-total" id="bud-st-${sec.id}"></tr>
        <tr class="bud-add-row"><td colspan="17"><div class="bud-stick">
          <select class="bud-add" onchange="budAddRow(this.value);this.value=''" aria-label="Ajouter une catégorie à ${budAttr(sec.label)}">
            <option value="">+ Ajouter une catégorie</option>
            ${addable.map(c => `<option value="${budAttr(c)}">${budEsc(c)}</option>`).join('')}
          </select>
        </div></td></tr>
      </tbody>`;
  }).join('');

  wrap.innerHTML = `
    <div class="bud-grid-head">
      <div>
        <h3>${budEsc(info.type === 'SCI' ? 'Hors bien — ' + info.sci : info.label)}</h3>
        <p>${info.type === 'SCI' ? 'Flux de la SCI non rattachés à un bien (après ventilation des frais généraux).' : budEsc(info.sci) + (info.type ? ' · ' + budEsc(info.type) : '')}
          · Montants en euros, dans leur sens naturel (une charge est saisie en positif). Le « % » recalcule la ligne à partir du réel N-1 ; le total annuel est modifiable et se répartit sur les mois.</p>
      </div>
      <div class="bud-grid-tools">
        <button class="bud-btn" onclick="budApplyEntityPct()">${icon('percent', { size: 14 })}Ajuster tout le bien…</button>
      </div>
    </div>
    <div class="bud-grid-scroll">
      <table class="bud-grid">
        <thead><tr>
          <th class="bud-c-cat">Catégorie</th>
          <th class="bud-c-base" title="Réel de référence sur 12 mois">Réel N-1</th>
          <th class="bud-c-pct" title="Ajustement appliqué au réel N-1">% vs N-1</th>
          ${BUD_MONTHS.map(m => `<th class="bud-c-m">${m}</th>`).join('')}
          <th class="bud-c-tot">Total</th>
          <th class="bud-c-del"><span class="sr-only">Supprimer</span></th>
        </tr></thead>
        ${sectionRows}
        <tbody class="bud-foot">
          <tr class="bud-grand" id="bud-gt-res"></tr>
          <tr class="bud-grand bud-grand-cash" id="bud-gt-cash"></tr>
        </tbody>
      </table>
    </div>`;
  budRefreshTotals();
}

function budGridRow(v, ent, cat, by) {
  const k = budRowKey(ent, cat), r = v.rows[k];
  const d = budDir(cat);
  const base = budBaseRow(ent, cat, v.year, by);
  const baseTot = base.reduce((a, b) => a + b, 0) * d;
  const m = r ? r.m : BUD_MONTHS.map(() => 0);
  const ka = budAttr(k);
  const pct = r && r.pct !== null && r.pct !== undefined ? String(r.pct).replace('.', ',') : '';
  return `<tr data-k="${ka}">
    <td class="bud-c-cat" title="${budAttr(cat)}">${budEsc(cat)}${!r ? '<span class="bud-tag">non budgété</span>' : ''}</td>
    <td class="bud-c-base">${budFmt(baseTot, { dashZero: true })}</td>
    <td class="bud-c-pct"><input class="bud-in bud-in-pct" inputmode="decimal" value="${pct}" placeholder="${baseTot ? '0' : ''}" ${baseTot ? '' : 'disabled title="Pas de réel N-1 pour cette ligne"'} aria-label="% vs N-1 — ${budAttr(cat)}" onchange="budSetPct(this)"></td>
    ${m.map((x, i) => `<td class="bud-c-m"><input class="bud-in" inputmode="decimal" data-m="${i}" value="${x ? budFmt(x * d) : ''}" placeholder="${base[i] ? budFmt(base[i] * d) : '0'}" aria-label="${budAttr(cat)} — ${BUD_MONTHS_L[i]}" onchange="budSetCell(this)" onfocus="this.select()"></td>`).join('')}
    <td class="bud-c-tot"><input class="bud-in bud-in-tot" inputmode="decimal" value="${budFmt(budRowTotal(r) * d)}" aria-label="Total annuel — ${budAttr(cat)}" onchange="budSetTotal(this)" onfocus="this.select()"></td>
    <td class="bud-c-del"><button class="bud-del" title="Retirer la ligne du budget" aria-label="Retirer ${budAttr(cat)}" onclick="budDelRow(this)">${icon('x', { size: 13 })}</button></td>
  </tr>`;
}

function _budRowFromInput(inp) {
  const tr = inp.closest('tr');
  return { tr, k: tr.dataset.k, cat: budSplitKey(tr.dataset.k)[1] };
}
function budEnsureRow(v, k) { if (!v.rows[k]) v.rows[k] = { m: BUD_MONTHS.map(() => 0), pct: null }; return v.rows[k]; }

function budSetCell(inp) {
  const { tr, k, cat } = _budRowFromInput(inp);
  const mi = +inp.dataset.m, val = Math.round(budParse(inp.value) * 100) / 100;
  const v = budMutate(v => { const r = budEnsureRow(v, k); r.m[mi] = val * budDir(cat); r.pct = null; });
  inp.value = val ? budFmt(val) : '';
  budUpdateRowDom(tr, v.rows[k], cat);
  budRefreshTotals();
}
function budSetPct(inp) {
  const { tr, k, cat } = _budRowFromInput(inp);
  const raw = inp.value.trim();
  const v0 = budCurrent();
  const [ent] = budSplitKey(k);
  const base = budBaseRow(ent, cat, v0.year);
  if (raw === '') { budMutate(v => { if (v.rows[k]) v.rows[k].pct = null; }); return; }
  const p = budParse(raw);
  const v = budMutate(v => { const r = budEnsureRow(v, k); r.m = base.map(x => Math.round(x * (1 + p / 100))); r.pct = p; });
  inp.value = String(p).replace('.', ',');
  budUpdateRowDom(tr, v.rows[k], cat, true);
  budRefreshTotals();
}
// Répartit un total annuel : selon le profil de la ligne, sinon celui du réel N-1, sinon à parts égales
function budSpread(total, profile) {
  const w = profile.map(x => Math.abs(+x || 0)), s = w.reduce((a, b) => a + b, 0);
  const out = w.map(x => s > 0 ? Math.round(total * x / s) : Math.round(total / 12));
  const diff = Math.round(total) - out.reduce((a, b) => a + b, 0);
  let last = 11; if (s > 0) while (last > 0 && !w[last]) last--;
  out[last] += diff;
  return out;
}
function budSetTotal(inp) {
  const { tr, k, cat } = _budRowFromInput(inp);
  const d = budDir(cat), tot = budParse(inp.value) * d;
  const v0 = budCurrent();
  const [ent] = budSplitKey(k);
  const cur = v0.rows[k] ? v0.rows[k].m : null;
  const profile = cur && cur.some(x => x) ? cur : budBaseRow(ent, cat, v0.year);
  const v = budMutate(v => { const r = budEnsureRow(v, k); r.m = budSpread(tot, profile); r.pct = null; });
  budUpdateRowDom(tr, v.rows[k], cat, true);
  budRefreshTotals();
}
function budUpdateRowDom(tr, r, cat, months) {
  const d = budDir(cat);
  if (months) tr.querySelectorAll('input[data-m]').forEach(i => { const x = r.m[+i.dataset.m]; i.value = x ? budFmt(x * d) : ''; });
  const pi = tr.querySelector('.bud-in-pct');
  if (pi && document.activeElement !== pi) pi.value = r.pct !== null && r.pct !== undefined ? String(r.pct).replace('.', ',') : '';
  const ti = tr.querySelector('.bud-in-tot');
  if (ti) ti.value = budFmt(budRowTotal(r) * d);
  const tag = tr.querySelector('.bud-tag'); if (tag) tag.remove();
}
function budAddRow(cat) {
  if (!cat) return;
  budMutate(v => budEnsureRow(v, budRowKey(_bud.entity, cat)));
  budRenderMontants(budCurrent());
}
function budDelRow(btn) {
  const { k } = _budRowFromInput(btn);
  budMutate(v => { delete v.rows[k]; });
  budRenderMontants(budCurrent());
}

function budRefreshTotals() {
  const v = budCurrent(); if (!v) return;
  const ent = _bud.entity;
  const secM = {}; BUD_SECTIONS.forEach(s => secM[s.id] = BUD_MONTHS.map(() => 0));
  const secBase = {}; BUD_SECTIONS.forEach(s => secBase[s.id] = 0);
  const by = budBaseYears(v.year);
  Object.entries(v.rows).forEach(([k, r]) => {
    const [e, cat] = budSplitKey(k); if (e !== ent) return;
    r.m.forEach((x, i) => secM[budSectionOf(cat)][i] += +x || 0);
  });
  budBaseKeys(v.year, by).forEach(k => {
    const [e, cat] = budSplitKey(k); if (e !== ent) return;
    secBase[budSectionOf(cat)] += budBaseRow(e, cat, v.year, by).reduce((a, b) => a + b, 0);
  });
  const cell = (x, d) => `<td class="bud-c-m">${budFmt(x * d, { dashZero: true })}</td>`;
  BUD_SECTIONS.forEach(s => {
    const tr = document.getElementById('bud-st-' + s.id); if (!tr) return;
    const d = s.id === 'bil' ? 1 : s.id === 'prod' ? 1 : -1;
    const tot = secM[s.id].reduce((a, b) => a + b, 0);
    tr.innerHTML = `<td class="bud-c-cat">Total ${s.label.toLowerCase()}${s.id === 'bil' ? ' <small>(signé)</small>' : ''}</td>
      <td class="bud-c-base">${budFmt(secBase[s.id] * d, { dashZero: true })}</td><td class="bud-c-pct">${secBase[s.id] ? budFmtPct((tot / secBase[s.id] - 1) * 100, true) : ''}</td>
      ${secM[s.id].map(x => cell(x, d)).join('')}<td class="bud-c-tot">${budFmt(tot * d)}</td><td></td>`;
  });
  const res = BUD_MONTHS.map((_, i) => secM.prod[i] + secM.exp[i] + secM.fin[i]);
  const cash = res.map((x, i) => x + secM.bil[i]);
  const resBase = secBase.prod + secBase.exp + secBase.fin, cashBase = resBase + secBase.bil;
  const grand = (id, label, arr, base) => {
    const tr = document.getElementById(id); if (!tr) return;
    const tot = arr.reduce((a, b) => a + b, 0);
    tr.innerHTML = `<td class="bud-c-cat">${label}</td><td class="bud-c-base">${budFmt(base, { signed: true, dashZero: true })}</td><td class="bud-c-pct"></td>
      ${arr.map(x => `<td class="bud-c-m ${x < 0 ? 'neg' : ''}">${budFmt(x, { signed: true, dashZero: true })}</td>`).join('')}
      <td class="bud-c-tot ${tot < 0 ? 'neg' : ''}">${budFmt(tot, { signed: true })}</td><td></td>`;
  };
  grand('bud-gt-res', 'Résultat (hors amortissements)', res, resBase);
  grand('bud-gt-cash', 'Cash-flow net', cash, cashBase);
  // Barre latérale : cash-flow du bien
  const t = budEntityTotals(v, ent);
  const act = document.querySelector('.bud-side-item.active .bud-side-val');
  if (act) { act.textContent = budFmt(t.cash, { signed: true, eur: true }); act.classList.toggle('neg', t.cash < 0); }
}

// ── Petites fenêtres (création, renommage, ajustements) ──
function budModal(title, bodyHtml, okLabel, onOk) {
  let m = document.getElementById('bud-modal');
  if (!m) { m = document.createElement('div'); m.id = 'bud-modal'; m.className = 'bud-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="bud-modal-box" role="dialog" aria-modal="true" aria-labelledby="bud-modal-title">
      <h3 id="bud-modal-title">${title}</h3>
      <div class="bud-modal-body">${bodyHtml}</div>
      <div class="bud-modal-actions">
        <button class="btn btn-outline" id="bud-modal-no">Annuler</button>
        <button class="btn btn-cyan" id="bud-modal-ok">${okLabel}</button>
      </div></div>`;
  m.style.display = 'flex';
  const close = () => { m.style.display = 'none'; m.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && e.target.tagName !== 'SELECT') { e.preventDefault(); ok(); } };
  const ok = () => { if (onOk(m) !== false) close(); };
  document.getElementById('bud-modal-no').onclick = close;
  document.getElementById('bud-modal-ok').onclick = ok;
  m.onclick = e => { if (e.target === m) close(); };
  document.addEventListener('keydown', onKey);
  const first = m.querySelector('input,select'); if (first) setTimeout(() => first.focus(), 30);
}

function budOpenNew() {
  const store = budGetStore();
  const y = new Date().getFullYear();
  const years = [y - 1, y, y + 1, y + 2];
  const defYear = budRefVersion(y, store) ? y + 1 : y;
  const copyOpts = budVersionsList(store).map(x => `<option value="${x.id}">${budEsc(x.year + ' · ' + x.name)}</option>`).join('');
  budModal('Nouveau budget', `
    <label class="lbl">Année</label>
    <select class="sel" id="bud-new-year" onchange="document.getElementById('bud-new-base').textContent=budBaseLabel(+this.value)">${years.map(x => `<option${x === defYear ? ' selected' : ''}>${x}</option>`).join('')}</select>
    <label class="lbl" style="margin-top:14px">Nom de la version</label>
    <input class="bud-text" id="bud-new-name" value="Budget initial" maxlength="60">
    <label class="lbl" style="margin-top:14px">Point de départ</label>
    <div class="bud-radio">
      <label><input type="radio" name="bud-src" value="base" checked> Réel N-1, avec un ajustement
        <span class="bud-src-detail">Produits <input class="bud-text bud-text-sm" id="bud-new-pp" value="0" inputmode="decimal"> %
        · Charges <input class="bud-text bud-text-sm" id="bud-new-pc" value="0" inputmode="decimal"> %</span>
        <small id="bud-new-base">${budEsc(budBaseLabel(defYear))}</small></label>
      ${copyOpts ? `<label><input type="radio" name="bud-src" value="copy"> Copie d'une version <select class="sel bud-sel-inline" id="bud-new-from">${copyOpts}</select></label>` : ''}
      <label><input type="radio" name="bud-src" value="empty"> Budget vide</label>
    </div>`, 'Créer', m => {
    const year = +m.querySelector('#bud-new-year').value;
    const name = m.querySelector('#bud-new-name').value.trim() || 'Budget';
    const kind = (m.querySelector('input[name="bud-src"]:checked') || {}).value || 'base';
    const src = kind === 'copy' ? { kind, from: m.querySelector('#bud-new-from').value }
      : kind === 'base' ? { kind, pctProd: budParse(m.querySelector('#bud-new-pp').value), pctChg: budParse(m.querySelector('#bud-new-pc').value) } : { kind };
    const v = budBuildVersion(name, year, src);
    const s = budGetStore();
    s.versions[v.id] = v;
    if (!budRefVersion(year, s) || !s.ref[year]) s.ref[year] = s.ref[year] && s.versions[s.ref[year]] ? s.ref[year] : v.id;
    budSaveStore(s);
    _bud.vid = v.id; _bud.entity = null; _bud.tab = 'montants';
    budRender();
    showToast('Budget ' + year + ' créé');
  });
}
function budSetRef() {
  const v = budCurrent(); if (!v) return;
  const s = budGetStore(); s.ref[v.year] = v.id; budSaveStore(s);
  budRender(); showToast('« ' + v.name + ' » est comparée au réel ' + v.year);
}
function budDuplicate() {
  const v = budCurrent(); if (!v) return;
  budModal('Dupliquer la version', `<label class="lbl">Nom de la copie</label><input class="bud-text" id="bud-dup-name" value="${budAttr(v.name + ' (révisé)')}" maxlength="60">`, 'Dupliquer', m => {
    const nv = budBuildVersion(m.querySelector('#bud-dup-name').value.trim() || v.name, v.year, { kind: 'copy', from: v.id });
    const s = budGetStore(); s.versions[nv.id] = nv; budSaveStore(s);
    _bud.vid = nv.id; budRender(); showToast('Version dupliquée');
  });
}
function budRename() {
  const v = budCurrent(); if (!v) return;
  budModal('Renommer la version', `<label class="lbl">Nom</label><input class="bud-text" id="bud-ren-name" value="${budAttr(v.name)}" maxlength="60">`, 'Renommer', m => {
    const n = m.querySelector('#bud-ren-name').value.trim(); if (!n) return false;
    budMutate(x => { x.name = n; }); budRender();
  });
}
function budDelete() {
  const v = budCurrent(); if (!v) return;
  askConfirm('Supprimer la version « ' + v.year + ' · ' + v.name + ' » ? Les montants saisis seront perdus.', () => {
    const s = budGetStore();
    delete s.versions[v.id];
    if (s.ref[v.year] === v.id) delete s.ref[v.year];
    budSaveStore(s);
    _bud.vid = null; _bud.entity = null;
    const nx = budVersionsList(s)[0]; _bud.vid = nx ? nx.id : null;
    budRender(); showToast('Version supprimée', '#f0566a');
  }, 'Supprimer', '#f0566a');
}
function budOpenRebase() {
  const v = budCurrent(); if (!v) return;
  budModal('Repartir du réel N-1', `
    <p class="bud-modal-p">Tous les montants de « ${budEsc(v.name)} » seront remplacés par le réel de référence (${budEsc(budBaseLabel(v.year))}), ajusté des pourcentages ci-dessous. Les objectifs courte durée ne changent pas.</p>
    <div class="bud-src-detail">Produits <input class="bud-text bud-text-sm" id="bud-rb-pp" value="0" inputmode="decimal"> %
      · Charges <input class="bud-text bud-text-sm" id="bud-rb-pc" value="0" inputmode="decimal"> %</div>`, 'Remplacer les montants', m => {
    const pp = budParse(m.querySelector('#bud-rb-pp').value), pc = budParse(m.querySelector('#bud-rb-pc').value);
    budMutate(x => budFillFromBase(x, pp, pc, false));
    budRender(); showToast('Montants recalculés depuis le réel');
  });
}
function budApplyEntityPct() {
  const v = budCurrent(); if (!v || !_bud.entity) return;
  budModal('Ajuster tout le bien', `
    <p class="bud-modal-p">Recalcule chaque ligne de « ${budEsc(budEntityLabel(_bud.entity))} » à partir du réel N-1. Les lignes sans réel N-1 ne changent pas.</p>
    <div class="bud-src-detail">Produits <input class="bud-text bud-text-sm" id="bud-ep-pp" value="0" inputmode="decimal"> %
      · Charges <input class="bud-text bud-text-sm" id="bud-ep-pc" value="0" inputmode="decimal"> %</div>`, 'Appliquer', m => {
    const pp = budParse(m.querySelector('#bud-ep-pp').value), pc = budParse(m.querySelector('#bud-ep-pc').value);
    const by = budBaseYears(v.year);
    budMutate(x => {
      budBaseKeys(x.year, by).forEach(k => {
        const [e, cat] = budSplitKey(k); if (e !== _bud.entity) return;
        const p = budDir(cat) > 0 ? pp : pc;
        x.rows[k] = { m: budBaseRow(e, cat, x.year, by).map(b => Math.round(b * (1 + p / 100))), pct: p };
      });
    });
    budRender();
  });
}

// ── Onglet « Objectifs courte durée » ──
function budRenderLcd(v) {
  const body = document.getElementById('bud-tab-body');
  const lcd = (getParams().biens || []).filter(b => b.type === 'LCD');
  if (!lcd.length) { body.innerHTML = '<div class="bud-empty-small">Aucun bien en courte durée dans les paramètres.</div>'; return; }
  const by = budBaseYears(v.year), ni = budNightsIndex();
  body.innerHTML = `
    <p class="bud-intro">Objectifs de nuits louées et de prix moyen par nuit, comparés aux KPIs courte durée du dashboard. Le taux d'occupation et le CA hébergement en découlent. Le CA hébergement budgété dans « Montants » est rappelé pour vérifier la cohérence.</p>
    ${lcd.map(b => budLcdCard(v, b, by, ni)).join('')}`;
}
function budLcdCard(v, b, by, ni) {
  const o = (v.lcd || {})[b.id] || { nuits: BUD_MONTHS.map(() => 0), prix: BUD_MONTHS.map(() => 0), pctN: null, pctP: null };
  const base = budLcdBase(b.id, v.year, by, ni);
  const days = BUD_MONTHS.map((_, i) => budDaysInMonth(v.year, i));
  const occ = o.nuits.map((n, i) => n / days[i] * 100);
  const ca = o.nuits.map((n, i) => n * (o.prix[i] || 0));
  const totN = o.nuits.reduce((a, c) => a + (+c || 0), 0), totCa = ca.reduce((a, c) => a + c, 0);
  const totDays = days.reduce((a, c) => a + c, 0);
  let caMontants = 0;
  BUD_LCD_CATS.forEach(cat => { caMontants += budRowTotal(v.rows[budRowKey(b.id, cat)]); });
  const baseN = base.nuits.reduce((a, c) => a + c, 0);
  const id = budAttr(b.id);
  const inRow = (field, arr, label, pct) => `<tr data-b="${id}" data-f="${field}">
      <td class="bud-c-cat">${label}</td>
      <td class="bud-c-base">${field === 'nuits' ? budFmt(baseN, { dashZero: true }) : budFmt(base.prix[0], { dashZero: true })}</td>
      <td class="bud-c-pct"><input class="bud-in bud-in-pct" inputmode="decimal" value="${pct !== null && pct !== undefined ? String(pct).replace('.', ',') : ''}" aria-label="% vs N-1 — ${label}" onchange="budLcdPct(this)"></td>
      ${arr.map((x, i) => `<td class="bud-c-m"><input class="bud-in" inputmode="decimal" data-m="${i}" value="${x ? budFmt(x) : ''}" placeholder="${field === 'nuits' ? (base.nuits[i] || '0') : (base.prix[i] || '0')}" aria-label="${label} — ${BUD_MONTHS_L[i]}" onchange="budLcdCell(this)" onfocus="this.select()"></td>`).join('')}
      <td class="bud-c-tot">${field === 'nuits' ? budFmt(totN) : (totN ? budFmt(totCa / totN) : '—')}</td>
    </tr>`;
  const coh = caMontants ? `CA hébergement budgété dans « Montants » : <b>${budFmt(caMontants, { eur: true })}</b>. Les objectifs (nuits × prix) donnent <b>${budFmt(totCa, { eur: true })}</b>, soit ${budFmtPct((totCa / caMontants - 1) * 100, true)}.` : 'Aucun CA hébergement (Airbnb, Booking, location directe) dans « Montants » pour ce bien.';
  return `<div class="bud-lcd-card">
    <div class="bud-grid-head"><div><h3>${budEsc(b.name)}</h3><p>${budEsc(b.sci || '')} · réel N-1 : ${budFmt(baseN)} nuits${base.prix[0] ? ', ' + budFmt(base.prix[0], { eur: true }) + ' par nuit en moyenne' : ''}</p></div></div>
    <div class="bud-grid-scroll"><table class="bud-grid bud-grid-lcd">
      <thead><tr><th class="bud-c-cat">Objectif</th><th class="bud-c-base">Réel N-1</th><th class="bud-c-pct">% vs N-1</th>${BUD_MONTHS.map(m => `<th class="bud-c-m">${m}</th>`).join('')}<th class="bud-c-tot">Année</th></tr></thead>
      <tbody>
        ${inRow('nuits', o.nuits, 'Nuits louées', o.pctN)}
        ${inRow('prix', o.prix, 'Prix moyen / nuit (€)', o.pctP)}
        <tr class="bud-sec-total"><td class="bud-c-cat">Taux d'occupation</td><td class="bud-c-base">${budFmtPct(baseN / totDays * 100)}</td><td></td>${occ.map(x => `<td class="bud-c-m">${x ? Math.round(x) + budNbsp + '%' : '—'}</td>`).join('')}<td class="bud-c-tot">${budFmtPct(totN / totDays * 100)}</td></tr>
        <tr class="bud-sec-total"><td class="bud-c-cat">CA hébergement (nuits × prix)</td><td class="bud-c-base">${budFmt(base.ca, { dashZero: true })}</td><td></td>${ca.map(x => `<td class="bud-c-m">${budFmt(x, { dashZero: true })}</td>`).join('')}<td class="bud-c-tot">${budFmt(totCa)}</td></tr>
      </tbody></table></div>
    <div class="bud-coh">${coh}</div>
  </div>`;
}
function budLcdEnsure(v, id) {
  v.lcd = v.lcd || {};
  if (!v.lcd[id]) v.lcd[id] = { nuits: BUD_MONTHS.map(() => 0), prix: BUD_MONTHS.map(() => 0), pctN: null, pctP: null };
  return v.lcd[id];
}
function budLcdCell(inp) {
  const tr = inp.closest('tr'), id = tr.dataset.b, f = tr.dataset.f, mi = +inp.dataset.m;
  const val = Math.max(0, Math.round(budParse(inp.value)));
  budMutate(v => { const o = budLcdEnsure(v, id); o[f][mi] = f === 'nuits' ? Math.min(val, budDaysInMonth(v.year, mi)) : val; o[f === 'nuits' ? 'pctN' : 'pctP'] = null; });
  budRenderLcd(budCurrent());
}
function budLcdPct(inp) {
  const tr = inp.closest('tr'), id = tr.dataset.b, f = tr.dataset.f;
  const raw = inp.value.trim();
  const v0 = budCurrent();
  const base = budLcdBase(id, v0.year);
  budMutate(v => {
    const o = budLcdEnsure(v, id);
    if (raw === '') { o[f === 'nuits' ? 'pctN' : 'pctP'] = null; return; }
    const p = budParse(raw);
    o[f] = base[f].map((x, i) => { const r = Math.round(x * (1 + p / 100)); return f === 'nuits' ? Math.min(r, budDaysInMonth(v.year, i)) : r; });
    o[f === 'nuits' ? 'pctN' : 'pctP'] = p;
  });
  budRenderLcd(budCurrent());
}

// ── Onglet « Vue d'ensemble » ──
function budRenderOverview(v) {
  const body = document.getElementById('bud-tab-body');
  const ents = budEntities();
  const by = budBaseYears(v.year);
  const baseTot = {};
  budBaseKeys(v.year, by).forEach(k => {
    const [e, cat] = budSplitKey(k);
    const t = baseTot[e] = baseTot[e] || { prod: 0, exp: 0, fin: 0, bil: 0 };
    t[budSectionOf(cat)] += budBaseRow(e, cat, v.year, by).reduce((a, b) => a + b, 0);
  });
  const usedEnts = new Set([...Object.keys(v.rows).map(k => budSplitKey(k)[0]), ...Object.keys(baseTot)]);
  const list = ents.filter(e => usedEnts.has(e.id));
  const tot = budEntityTotals(v, null);
  const bt = Object.values(baseTot).reduce((a, t) => { Object.keys(t).forEach(k => a[k] += t[k]); return a; }, { prod: 0, exp: 0, fin: 0, bil: 0 });
  bt.res = bt.prod + bt.exp + bt.fin; bt.cash = bt.res + bt.bil;
  const varCell = (cur, base, good) => {
    if (!base) return '<td class="bud-c-var">—</td>';
    const p = (cur - base) / Math.abs(base) * 100;
    const fav = good === 'up' ? cur >= base : cur <= base;
    return `<td class="bud-c-var ${Math.abs(p) < 0.5 ? '' : fav ? 'pos' : 'neg'}">${budFmtPct(p, true)}</td>`;
  };
  const rowsHtml = list.map(e => {
    const t = budEntityTotals(v, e.id);
    const b = baseTot[e.id] ? Object.assign({}, baseTot[e.id]) : { prod: 0, exp: 0, fin: 0, bil: 0 };
    b.res = b.prod + b.exp + b.fin; b.cash = b.res + b.bil;
    return `<tr class="bud-ov-row" onclick="_bud.tab='montants';_bud.entity='${budAttr(e.id).replace(/'/g, '\\\'')}';budRender()" title="Modifier">
      <td class="bud-c-cat">${budEsc(budEntityLabel(e.id))}<small>${budEsc(e.sci)}</small></td>
      <td>${budFmt(t.prod)}</td>${varCell(t.prod, b.prod, 'up')}
      <td>${budFmt(-t.exp)}</td>${varCell(-t.exp, -b.exp, 'down')}
      <td>${budFmt(-t.fin)}</td>
      <td class="${t.res < 0 ? 'neg' : ''}">${budFmt(t.res, { signed: true })}</td>
      <td>${budFmt(t.bil, { signed: true })}</td>
      <td class="bud-strong ${t.cash < 0 ? 'neg' : ''}">${budFmt(t.cash, { signed: true })}</td>${varCell(t.cash, b.cash, 'up')}
    </tr>`;
  }).join('');
  // Profil mensuel de la version
  const M = { prod: BUD_MONTHS.map(() => 0), exp: BUD_MONTHS.map(() => 0), fin: BUD_MONTHS.map(() => 0), bil: BUD_MONTHS.map(() => 0) };
  Object.entries(v.rows).forEach(([k, r]) => { const sec = budSectionOf(budSplitKey(k)[1]); r.m.forEach((x, i) => M[sec][i] += +x || 0); });
  const res = BUD_MONTHS.map((_, i) => M.prod[i] + M.exp[i] + M.fin[i]), cash = res.map((x, i) => x + M.bil[i]);
  const mRow = (label, arr, sign, cls) => `<tr class="${cls || ''}"><td class="bud-c-cat">${label}</td>${arr.map(x => `<td class="${sign && x * sign < 0 ? 'neg' : ''}">${budFmt(x * (sign || 1), { signed: !!cls, dashZero: true })}</td>`).join('')}<td class="bud-strong">${budFmt(arr.reduce((a, b) => a + b, 0) * (sign || 1), { signed: !!cls })}</td></tr>`;

  body.innerHTML = `
    <div class="bud-ov-kpis">
      ${[['Produits', tot.prod, bt.prod, 'up'], ['Charges', -(tot.exp + tot.fin), -(bt.exp + bt.fin), 'down'], ['Résultat (hors amort.)', tot.res, bt.res, 'up'], ['Cash-flow net', tot.cash, bt.cash, 'up']].map(([l, x, b, g]) => {
        const p = b ? (x - b) / Math.abs(b) * 100 : null, fav = g === 'up' ? x >= b : x <= b;
        return `<div class="bud-kpi"><div class="bud-kpi-l">${l} ${v.year}</div><div class="bud-kpi-v ${x < 0 ? 'neg' : ''}">${budFmt(x, { eur: true, signed: l.startsWith('Rés') || l.startsWith('Cash') })}</div>
          <div class="bud-kpi-s">${p === null ? 'pas de réel N-1' : `<span class="${Math.abs(p) < 0.5 ? '' : fav ? 'pos' : 'neg'}">${budFmtPct(p, true)}</span> vs réel N-1 (${budFmt(b, { eur: true })})`}</div></div>`;
      }).join('')}
    </div>
    <div class="bud-card">
      <h3 class="bud-h3">Par bien</h3>
      <div class="bud-grid-scroll"><table class="bud-table">
        <thead><tr><th class="bud-c-cat">Bien</th><th>Produits</th><th>vs N-1</th><th>Charges expl.</th><th>vs N-1</th><th>Charges fin.</th><th>Résultat</th><th>Hors résultat</th><th>Cash-flow</th><th>vs N-1</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="10" class="bud-empty-small">Aucun montant.</td></tr>'}</tbody>
        <tfoot><tr><td class="bud-c-cat">Total</td><td>${budFmt(tot.prod)}</td>${varCell(tot.prod, bt.prod, 'up')}<td>${budFmt(-tot.exp)}</td>${varCell(-tot.exp, -bt.exp, 'down')}<td>${budFmt(-tot.fin)}</td><td class="${tot.res < 0 ? 'neg' : ''}">${budFmt(tot.res, { signed: true })}</td><td>${budFmt(tot.bil, { signed: true })}</td><td class="bud-strong ${tot.cash < 0 ? 'neg' : ''}">${budFmt(tot.cash, { signed: true })}</td>${varCell(tot.cash, bt.cash, 'up')}</tr></tfoot>
      </table></div>
    </div>
    <div class="bud-card">
      <h3 class="bud-h3">Mois par mois</h3>
      <div class="bud-grid-scroll"><table class="bud-table">
        <thead><tr><th class="bud-c-cat"></th>${BUD_MONTHS.map(m => `<th>${m}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>
          ${mRow('Produits', M.prod, 1)}
          ${mRow('Charges d\'exploitation', M.exp, -1)}
          ${mRow('Charges financières et impôt', M.fin, -1)}
          ${mRow('Résultat (hors amortissements)', res, 1, 'bud-row-strong')}
          ${mRow('Hors résultat (trésorerie)', M.bil, 1, 'bud-row-muted')}
          ${mRow('Cash-flow net', cash, 1, 'bud-row-strong')}
        </tbody>
      </table></div>
    </div>`;
}

// ── Export / import Excel (même format dans les deux sens) ──
function budExportXlsx() {
  const v = budCurrent(); if (!v || typeof XLSX === 'undefined') return;
  const head = ['Bien', 'SCI', 'Catégorie', 'Section', ...BUD_MONTHS, 'Total'];
  const rows = Object.entries(v.rows).map(([k, r]) => {
    const [e, cat] = budSplitKey(k), info = budEntityInfo(e), d = budDir(cat);
    const m = r.m.map(x => Math.round((+x || 0) * d * 100) / 100);
    return [info.type === 'SCI' ? 'Hors bien' : info.label, info.sci, cat, (BUD_SECTIONS.find(s => s.id === budSectionOf(cat)) || {}).label, ...m, m.reduce((a, b) => a + b, 0)];
  }).sort((a, b) => (a[1] + a[0] + a[2]).localeCompare(b[1] + b[0] + b[2], 'fr'));
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 26 }, ...BUD_MONTHS.map(() => ({ wch: 9 })), { wch: 11 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Budget ' + v.year);
  const lcd = Object.entries(v.lcd || {});
  if (lcd.length) {
    const l = [['Bien', 'Objectif', ...BUD_MONTHS]];
    lcd.forEach(([id, o]) => { const n = budEntityInfo(id).label; l.push([n, 'Nuits louées', ...o.nuits]); l.push([n, 'Prix moyen / nuit', ...o.prix]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(l), 'Objectifs LCD');
  }
  XLSX.writeFile(wb, ('Budget ' + v.year + ' - ' + v.name).replace(/[\\/:*?"<>|]/g, '-') + '.xlsx');
}
function budImportXlsx(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const v = budCurrent(); if (!v) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      const hdr = (aoa[0] || []).map(x => String(x || '').trim().toLowerCase());
      const iB = hdr.indexOf('bien'), iS = hdr.indexOf('sci'), iC = hdr.indexOf('catégorie'), iM = hdr.findIndex(h => h.startsWith('janv'));
      if (iB < 0 || iC < 0 || iM < 0) { showToast('⚠ Fichier non reconnu : utilisez le format de « Exporter »', '#f0566a'); return; }
      const ents = budEntities(), rows = {};
      let n = 0, skipped = 0;
      aoa.slice(1).forEach(r => {
        if (!r || !r[iC]) return;
        const bien = String(r[iB] || '').trim(), sci = iS >= 0 ? String(r[iS] || '').trim() : '', cat = String(r[iC]).trim();
        const ent = bien === 'Hors bien' ? ents.find(x => x.type === 'SCI' && x.sci === sci) : ents.find(x => x.type !== 'SCI' && x.label === bien);
        if (!ent) { skipped++; return; }
        const d = budDir(cat);
        rows[budRowKey(ent.id, cat)] = { m: BUD_MONTHS.map((_, i) => Math.round(_num(r[iM + i]) * 100) / 100 * d), pct: null };
        n++;
      });
      askConfirm('Remplacer les montants de « ' + v.name + ' » par les ' + n + ' lignes du fichier ?' + (skipped ? ' (' + skipped + ' ligne(s) ignorée(s) : bien inconnu)' : ''), () => {
        budMutate(x => { x.rows = rows; });
        budRender(); showToast('Budget importé : ' + n + ' lignes');
      }, 'Remplacer');
    } catch (err) { showToast('⚠ Lecture impossible : ' + err.message, '#f0566a'); }
    finally { input.value = ''; }
  };
  reader.readAsArrayBuffer(f);
}
