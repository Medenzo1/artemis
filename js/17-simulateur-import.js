// ════════════════════════════════════════════
//  SIMULATEUR — IMPORT DU CLASSEUR EXCEL
//  Le contenu du classeur (formules, libellés) n'est pas publié avec le site : l'utilisateur
//  importe une fois son fichier « Simulateur de Rentabilité » ; ses formules sont extraites ici,
//  dans le navigateur, puis rangées dans les données privées synchronisées (artemis_sim_model,
//  Firestore, accessible seulement après connexion).
//  Même transformation que tools/simulateur/build_model.py : chaque référence est réécrite en
//  [feuille|ligne|colonne] absolue ou relative (~n), une formule recopiée sur 25 colonnes n'est
//  stockée qu'une fois.
// ════════════════════════════════════════════

const SIM_MODEL_KEY = 'artemis_sim_model';
let SIM_MODEL = null;
let SIM_MODEL_INFO = null;

// Analyse lexicale identique à xl_oracle.py (références au format A1)
const SIM_A1_TOK = /\s+|("(?:[^"]|"")*")|(#(?:N\/A|VALUE!|DIV\/0!|REF!|NUM!|NAME\?|NULL!))|((?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)?!?\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)|(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Z][A-Z0-9.]*\()|(TRUE|FALSE)|(<>|<=|>=|[-+*\/^&=<>%(),:!])/y;

function simColNum(letters) { let c = 0; for (const ch of letters) c = c * 26 + ch.charCodeAt(0) - 64; return c; }

function simConvertFormula(src, sheet, row, col, sheetIndex) {
  const out = [];
  SIM_A1_TOK.lastIndex = 0;
  while (SIM_A1_TOK.lastIndex < src.length) {
    const i = SIM_A1_TOK.lastIndex;
    const m = SIM_A1_TOK.exec(src);
    if (!m || SIM_A1_TOK.lastIndex === i) throw new Error('Formule illisible (' + sheet + ') : ' + src.slice(i, i + 40));
    if (m[3] === undefined) { if (m[0].trim()) out.push(m[0]); continue; }
    const text = m[3];
    let sh = sheet, a = text;
    const bang = text.lastIndexOf('!');
    if (bang >= 0) {
      sh = text.slice(0, bang); a = text.slice(bang + 1);
      if (sh[0] === "'") sh = sh.slice(1, -1).replace(/''/g, "'");
    } else if (!/^\$?[A-Z]{1,3}\$?\d+(:\$?[A-Z]{1,3}\$?\d+)?$/.test(text)) {
      throw new Error('Référence inattendue : ' + text);
    }
    const parts = [];
    a.split(':').forEach(p => {
      const q = /^(\$?)([A-Z]+)(\$?)(\d+)$/.exec(p);
      const c = simColNum(q[2]), r = +q[4];
      parts.push(q[3] === '$' ? String(r) : '~' + (r - row));
      parts.push(q[1] === '$' ? String(c) : '~' + (c - col));
    });
    if (!(sh in sheetIndex)) throw new Error('Onglet inconnu dans une formule : ' + sh);
    out.push('[' + (sh === sheet ? '' : sheetIndex[sh]) + '|' + parts.join('|') + ']');
  }
  return out.join('');
}

function simNumberFormatCode(nf) {
  nf = nf || 'General';
  if (nf.includes('%')) { const m = /0\.(0+)%/.exec(nf); return 'p' + (m ? m[1].length : 0); }
  if (/#,##0\.0[^0]/.test(nf + ' ')) return 'n1';
  if (nf.includes('€') || nf.includes('_(*')) return 'e';
  if (nf.startsWith('#,##0') || nf === '0') return 'i';
  return 'g';
}

// SheetJS workbook (lu avec cellFormula, cellNF, cellStyles, sheetStubs) → modèle du moteur
function simBuildModel(wb) {
  const sheets = wb.SheetNames.slice();
  const sheetIndex = {};
  sheets.forEach((s, i) => { sheetIndex[s] = i; });
  const templates = [], tplId = new Map(), f = [], k = [], meta = [];
  sheets.forEach(name => {
    const ws = wb.Sheets[name];
    const fc = [], kc = [];
    const cells = Object.keys(ws).filter(a => a[0] !== '!').map(a => {
      const q = /^([A-Z]+)(\d+)$/.exec(a);
      return { a, r: +q[2], c: simColNum(q[1]), cell: ws[a] };
    }).sort((x, y) => x.r - y.r || x.c - y.c);
    cells.forEach(({ r, c, cell }) => {
      if (cell.f) {
        const t = simConvertFormula(cell.f, name, r, c, sheetIndex);
        if (!tplId.has(t)) { tplId.set(t, templates.length); templates.push(t); }
        fc.push(cell.F ? [r, c, tplId.get(t), 1] : [r, c, tplId.get(t)]);
      } else if (cell.t === 'n' || cell.t === 's' || cell.t === 'b') {
        if (cell.t === 's' && cell.v === '') return;
        kc.push([r, c, cell.v]);
      }
    });
    f.push(fc); k.push(kc);
    // Lignes avec un libellé en colonne B : repliée dans Excel ? format des montants (colonne D)
    const rowsInfo = ws['!rows'] || [];
    const rows = [];
    const maxRow = cells.length ? cells[cells.length - 1].r : 0;
    for (let r = 1; r <= maxRow; r++) {
      const b = ws['B' + r];
      if (!b || (b.v === undefined && !b.f)) continue;
      const ri = rowsInfo[r - 1] || {};
      const d = ws['D' + r];
      rows.push([r, (ri.hidden || ri.level) ? 1 : 0, simNumberFormatCode(d && d.z)]);
    }
    meta.push(rows);
  });
  return { sheets, t: templates, f, k, m: meta };
}

// ── Stockage compressé (gzip + base64) dans les données synchronisées ──
async function simGzip(str) {
  if (typeof CompressionStream === 'undefined') return { raw: str };
  const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  let bin = '';
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { gz: btoa(bin) };
}
async function simGunzip(stored) {
  if (stored.raw) return stored.raw;
  const bin = atob(stored.gz);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

// Charge le modèle importé (null si aucun classeur n'a encore été importé)
async function simEnsureModel() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(SIM_MODEL_KEY) || 'null'); } catch (e) { stored = null; }
  if (!stored) { SIM_MODEL = null; SIM_MODEL_INFO = null; return null; }
  if (SIM_MODEL && SIM_MODEL_INFO && SIM_MODEL_INFO.importedAt === stored.importedAt) return SIM_MODEL;
  SIM_MODEL = JSON.parse(await simGunzip(stored));
  SIM_MODEL_INFO = { name: stored.name, importedAt: stored.importedAt, formulas: stored.formulas };
  _simWB = null; // le moteur sera reconstruit sur ce modèle
  return SIM_MODEL;
}

// Contrôles de structure : on vérifie qu'il s'agit bien du simulateur attendu
function simCheckModel(m) {
  const need = [SIM_SHEET_IN, '💰 SYNTHÈSE', '🔎 EMPRUNT'].concat(SIM_REGIMES.map(r => r.sheet));
  const missing = need.filter(s => !m.sheets.includes(s));
  if (missing.length > 2) throw new Error("Ce fichier n'est pas le « Simulateur de Rentabilité » : ses onglets de calcul sont introuvables.");
  if (missing.length) throw new Error('Onglet(s) introuvable(s) dans ce classeur : ' + missing.join(', ') + '.');
  const wb = new SimXL.Workbook(m);
  const v = wb.get('💰 SYNTHÈSE', 'H6');
  if (SimXL.isErr(v)) throw new Error('Le calcul de la synthèse échoue sur ce fichier (' + v.code + ').');
}

async function simImportWorkbook(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const box = document.getElementById('sim-import-status');
  const say = (t, err) => { if (box) { box.textContent = t; box.style.color = err ? 'var(--red)' : 'var(--text2)'; } };
  try {
    say('Lecture du classeur…');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true, sheetStubs: true, bookVBA: false });
    say('Extraction des formules…');
    const model = simBuildModel(wb);
    simCheckModel(model);
    const formulas = model.f.reduce((t, l) => t + l.length, 0);
    const packed = await simGzip(JSON.stringify(model));
    const stored = Object.assign({ name: file.name, importedAt: new Date().toISOString(), formulas }, packed);
    localStorage.setItem(SIM_MODEL_KEY, JSON.stringify(stored));
    SIM_MODEL = null;
    await simEnsureModel();
    simToast('Classeur importé : ' + formulas.toLocaleString('fr-FR') + ' formules. Il est synchronisé sur vos autres appareils.');
    simShowView('form');
  } catch (e) {
    console.error('[simulateur] import', e);
    say(e.message || String(e), true);
  }
}

function simImportCard(replace) {
  return '<div class="sim-card sim-import">' +
    '<div class="sim-import-ico">' + icon('file-spreadsheet', {size:22}) + '</div>' +
    '<div class="sim-import-txt">' +
      '<div class="sim-card-h">' + (replace ? 'Remplacer le classeur de calcul' : 'Importez votre classeur de calcul') + '</div>' +
      '<div class="sim-card-note">Le simulateur applique les formules de votre fichier « Simulateur de Rentabilité » (.xlsm). ' +
      'Importez-le une seule fois : il reste privé, dans vos données synchronisées, et sert sur tous vos appareils. ' +
      'Pour une nouvelle version du classeur, il suffit de la réimporter.</div>' +
      '<div id="sim-import-status" class="sim-card-note" style="margin-top:8px"></div>' +
    '</div>' +
    '<label class="btn btn-green sim-import-btn">' + icon('upload', {size:13}) + ' Choisir le fichier' +
      '<input type="file" accept=".xlsm,.xlsx" style="display:none" onchange="simImportWorkbook(this)"></label>' +
  '</div>';
}
