// ════════════════════════════════════════════
//  PRÉ-MAPPING PAR RÈGLES
// ════════════════════════════════════════════
// Historique basé sur le libellé court (colonne "Libellé" de la banque) :
// pour une charge récurrente (loyer, abonnement, prélèvement...), la banque
// réutilise le même libellé court d'un mois à l'autre, contrairement au
// libellé complet qui contient des références/dates qui varient. On compare
// donc ce libellé court tel quel (juste espaces/casse normalisés) aux
// lignes déjà validées des 5 derniers mois, et on reprend exactement le
// même mapping trouvé le plus récemment.
const HISTORY_MONTHS_LOOKBACK = 5;
let _historyIndex = null;
function _libKey(s) { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }

function getHistoryIndex() {
  if (_historyIndex) return _historyIndex;
  const db = getDB();
  const recentPeriodKeys = Object.keys(db.periods).sort().slice(-HISTORY_MONTHS_LOOKBACK);
  const recentLines = recentPeriodKeys.flatMap(k => db.periods[k].lines || []);
  const valid = recentLines.filter(l => l.cat && l.libelle);
  const idx = {};
  valid.forEach(l => {
    const key = _libKey(l.libelle);
    if (!idx[key]) idx[key] = [];
    idx[key].push(l);
  });
  _historyIndex = idx;
  return idx;
}

function normaliseLib(s) {
  // Nettoyage utilisé pour l'affichage (tableaux du dashboard) : retire montants,
  // dates et références pour ne garder que les mots utiles.
  return s.toLowerCase()
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '')   // dates
    .replace(/\d+[.,]\d+/g, '')               // amounts
    .replace(/ref[:\s]+\S+/gi, '')             // refs
    .replace(/n°\S+/gi, '')                    // n°xxx
    .replace(/[^a-záàâéèêëîïôùûüç\s]/gi, ' ') // keep only letters
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupHistory(r) {
  const idx = getHistoryIndex();
  const key = _libKey(r.libelle);
  if (!key || !idx[key] || !idx[key].length) return null;
  const m = idx[key][idx[key].length - 1]; // occurrence la plus récente
  return { cat: m.cat, bien: m.bienName || m.bien, lot: m.lot, sci: m.sci || sciForBien(m.bienName || m.bien || ''), conf: 'high', fromHistory: true };
}

function sciForBien(nomOrId) {
  const b = BIENS.find(b=>b.id===nomOrId || b.nom===nomOrId || b.name===nomOrId);
  return b ? b.sci : '';
}

function preMapRow(r) {
  const lib = (r.libelle + ' ' + r.full).toLowerCase();
  const amt  = r.montant;

  // helpers
  function bienNom(id)  { return BIENS.find(b=>b.id===id)?.nom || ''; }
  function bienSci(id)  { return BIENS.find(b=>b.id===id)?.sci || ''; }
  // Shortcut: return {cat,bien,lot,sci,conf} with sci auto-filled
  function hit(cat, bienId, lot, conf) {
    const b = BIENS.find(x=>x.id===bienId);
    return { cat, bien: b?.nom||bienId, lot: lot||b?.lot||'', sci: b?.sci||'', conf };
  }

  // ── 0. PRIORITÉ ABSOLUE : historique validé ──
  // Data validated by user in previous months = 100% reliable
  if (!r.isAirbnb && !r.isBooking && !r.isLoan) {
    const hist = lookupHistory(r);
    if (hist) return hist;
  }

  // ── 1. Lignes déjà gérées automatiquement ──
  if (r.isAirbnb || r.isBooking || r.isLoan) return null; // handled elsewhere

  // ── 2. Revenus Airbnb / Booking / Stripe (positif) ──
  if (amt > 0) {
    if (/airbnb/i.test(lib)) {
      if (/romeo|roméo/i.test(lib))            return hit('Airbnb','romeo',         null,'high');
      if (/proche|chateau|château/i.test(lib)) return hit('Airbnb','proche_chateau', null,'high');
      if (/blosne/i.test(lib))                 return hit('Airbnb','blosne',         null,'high');
      if (/vannes/i.test(lib))                 return hit('Airbnb','vannes',         null,'high');
      if (/folleville|folle/i.test(lib))       return hit('Airbnb','folleville',     null,'high');
      if (/juliette/i.test(lib))               return hit('Airbnb','juliette_s',     null,'high');
      return {cat:'Airbnb', bien:null, lot:null, sci:null, conf:'medium'};
    }
    if (/booking/i.test(lib)) {
      if (/romeo|roméo/i.test(lib))            return hit('Booking','romeo',         null,'high');
      if (/proche|chateau|château/i.test(lib)) return hit('Booking','proche_chateau', null,'high');
      if (/blosne/i.test(lib))                 return hit('Booking','blosne',         null,'high');
      if (/vannes/i.test(lib))                 return hit('Booking','vannes',         null,'high');
      if (/folleville|folle/i.test(lib))       return hit('Booking','folleville',     null,'high');
      if (/juliette/i.test(lib))               return hit('Booking','juliette_s',     null,'high');
      return {cat:'Booking', bien:null, lot:null, sci:null, conf:'medium'};
    }
    if (/stripe/i.test(lib)) {
      // Stripe = direct rental income, try to find bien from libellé
      if (/romeo|roméo/i.test(lib))          return hit('Stripe','romeo',        null,'high');
      if (/proche|chateau|château/i.test(lib)) return hit('Stripe','proche_chateau',null,'high');
      if (/blosne/i.test(lib))               return hit('Stripe','blosne',        null,'high');
      if (/vannes/i.test(lib))               return hit('Stripe','vannes',        null,'high');
      if (/folleville|folle/i.test(lib))     return hit('Stripe','folleville',    null,'high');
      if (/juliette/i.test(lib))             return hit('Stripe','juliette_s',    null,'high');
      return {cat:'Stripe', bien:null, lot:null, sci:null, conf:'medium'}; // bien unknown
    }
    if (/loyer|virement loc|loc mens/i.test(lib)) return {cat:'Loyer mensuel', bien:null, lot:null, conf:'medium'};
    if (/vannes/i.test(lib))   return {cat:'Loyer mensuel', bien:bienNom('vannes'), lot:'Vannes',         conf:'high'};
    if (/blosne/i.test(lib))   return {cat:'Loyer mensuel', bien:bienNom('blosne'), lot:'Le Blosne',      conf:'high'};
  }

  // ── 3. Emprunts (déjà détectés via LOAN_REF_MAP, mais fallback) ──
  if (/remboursement|echeance|prêt|pret|emprunt/i.test(lib) && amt < 0) {
    return {cat:'Remboursement emprunt', bien:'Frais généraux', lot:null, conf:'medium'};
  }

  // ── 4. Assurances ──
  if (/assur/i.test(lib) && amt < 0) {
    if (/emprunt|credit|pret/i.test(lib)) return {cat:'Assurance emprunt',    bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};
    if (/habitation|mrh|multirisque/i.test(lib)) return {cat:'Assurance habitation', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};
    return {cat:'Assurance diverse', bien:'Frais généraux', lot:'Juliette drouet', conf:'medium'};
  }

  // ── 5. Charges courantes ──
  if (amt < 0) {
    // Énergie
    if (/edf|enedis|engie|electricite|électricité|elec/i.test(lib)) {
      if (/blosne/i.test(lib)) return {cat:'Électricité - Le Blosne',       bien:'Frais généraux', lot:'Le Blosne',      conf:'high'};
      return                          {cat:'Électricité - Juliette Drouet', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};
    }
    if (/gaz|grdf|gazpar/i.test(lib)) {
      if (/blosne/i.test(lib)) return {cat:'Gaz - Le Blosne',       bien:'Frais généraux', lot:'Le Blosne',      conf:'high'};
      return                          {cat:'Gaz - Juliette Drouet', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};
    }
    if (/eau|saur|veolia|suez/i.test(lib))       return {cat:'Eau',              bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Frais bancaires
    if (/frais (de )?tenue|cotis|commission banq|interbank|agios/i.test(lib)) return {cat:'Frais bancaires', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};
    if (/frais virement|frais carte|frais cb/i.test(lib))                     return {cat:'Frais bancaires', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Internet / téléphone
    if (/free|orange|sfr|bouygue|numericable|fibre|internet|bbox/i.test(lib)) return {cat:'Abonnements internet', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Plateformes
    if (/airbnb.*fee|commission airbnb/i.test(lib)) return {cat:'Commission Airbnb',   bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};
    if (/booking.*fee|commission booking/i.test(lib)) return {cat:'Commission Booking', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Abonnements logiciels/plateformes
    if (/notion|slack|google|microsoft|adobe|dropbox|canva|chatgpt|openai/i.test(lib)) return {cat:'Abonnements plateformes', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Expert-comptable / juridique
    if (/compta|expertise|comptable|audit|juridique|avocat/i.test(lib)) return {cat:'Expert-comptable', bien:'Frais généraux', lot:'Juliette Drouet & Le Blosne', conf:'high'};

    // Ménage / nettoyage
    if (/menage|ménage|nettoyage|cleaning|femme de menage/i.test(lib)) return {cat:'Ménage', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Travaux / rénovation
    if (/travaux|renovation|rénovation|artisan|plombier|électricien|peinture|maçon/i.test(lib)) return {cat:'Immobilisation - Travaux', bien:null, lot:null, conf:'medium'};

    // Mobilier / équipements
    if (/ikea|but|conforama|maison du monde|leroy|bricomarche|bricoman/i.test(lib)) return {cat:'Immobilisation - Mobilier', bien:null, lot:null, conf:'medium'};
    if (/amazon|fnac|darty|boulanger|cdiscount/i.test(lib)) return {cat:'Immobilisation - Équipements', bien:null, lot:null, conf:'low'};

    // Taxe foncière
    if (/taxe fonciere|taxe fonc|impots locaux|direction generale des finances/i.test(lib)) return {cat:'Taxe foncière', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // Transport
    if (/sncf|ratp|blablacar|uber|taxi|parking|péage|autoroute/i.test(lib)) return {cat:'Transport', bien:'Frais généraux', lot:'Juliette drouet', conf:'medium'};

    // Restauration
    if (/restaurant|brasserie|bistro|mcdo|mcdonald|burger|pizza|deliveroo|ubereats/i.test(lib)) return {cat:'Restauration pro', bien:'Frais généraux', lot:'Juliette drouet', conf:'low'};

    // Publicité
    if (/facebook ads|meta ads|google ads|publicité|pub /i.test(lib)) return {cat:'Publicité', bien:'Frais généraux', lot:'Juliette drouet', conf:'high'};

    // IS / impôts
    if (/impot|impôt|dgfip|tresor public|is |acompte is/i.test(lib)) return {cat:'IS', bien:'Frais généraux', lot:'Juliette Drouet & Le Blosne', conf:'medium'};

    // Intérêts crédit
    if (/interets|intérêts|interest/i.test(lib)) return {cat:'Intérêts de crédit', bien:'Frais généraux', lot:'Juliette drouet', conf:'medium'};

    // Virements perso
    if (/virement (vers|a|à)|prelevement perso/i.test(lib) && amt < -200) return {cat:'Virements vers compte perso', bien:'Frais généraux', lot:'Juliette drouet', conf:'low'};

    // Consommables
    if (/monoprix|carrefour|leclerc|intermarche|lidl|aldi|action|gifi/i.test(lib)) return {cat:'Consommables', bien:'Frais généraux', lot:'Juliette drouet', conf:'low'};
  }

  // ── 6. Correspondance via libellés SCHEMA (n2/catégorie) ──
  // Match CATS keys directly in libellé words
  const libWords = lib.replace(/[^a-záàâéèêëîïôùûüç\s]/gi,' ').split(/\s+/).filter(w=>w.length>3);
  const catMatch = CATS.find(c => {
    const cw = c.toLowerCase().split(/[\s\-\/]+/);
    return cw.filter(w=>w.length>3).some(w => libWords.includes(w));
  });
  if (catMatch) {
    return { cat: catMatch, bien: null, lot: null, sci: null, conf: 'medium' };
  }

  // ── 7. Apprendre de l'historique en base ──
  // (already checked at top with priority - see historyMatch above)
  return null; // no suggestion
}

function applyPreMapping() {
  if (!rowMeta.length) return;
  let applied = 0;

  rowMeta.forEach((r, i) => {
    if (r.isAirbnb || r.isBooking || r.isLoan) return;
    if (r._cat && r._bien && r._lot) return; // already filled

    const s = preMapRow(r);
    if (!s) return;

    r._cat  = s.cat  || r._cat  || '';
    r._bien = s.bien || r._bien || '';
    r._lot  = s.lot  || r._lot  || '';
    r._sci  = s.sci  || r._sci  || '';
    r._conf = s.conf;
    r._fromHistory = s.fromHistory || false;
    applied++;
  });

  buildMappingTable();

  // Même règle que goValidate() : catégorie + bien + lot obligatoires. On le
  // signale ici pour ne pas laisser croire que tout est prêt après le pré-mapping.
  const incomplete = rowMeta.filter(r => !r.isAirbnb && !r.isBooking && !r.isLoan
    && (!r._cat || !r._bien || !r._lot)).length;

  let msg, color;
  if (applied && !incomplete) { msg = '✨ ' + applied + ' ligne' + (applied>1?'s':'') + ' pré-mappée' + (applied>1?'s':'') + ' — tout est complet'; color = 'var(--cyan)'; }
  else if (applied)           { msg = '✨ ' + applied + ' ligne' + (applied>1?'s':'') + ' pré-mappée' + (applied>1?'s':'') + ' · ⚠️ ' + incomplete + ' encore à compléter'; color = '#f5b731'; }
  else if (incomplete)        { msg = '⚠️ Aucune suggestion — ' + incomplete + ' ligne(s) à compléter manuellement'; color = '#f0566a'; }
  else                        { msg = 'Rien à pré-mapper'; color = '#f0566a'; }
  showToast(msg, color);
}

function startMapping() {
period = getSelectedPeriod ? getSelectedPeriod() : period;
enrichBankRows();
buildMappingTable();
goScreen(2);
}

function startWithPreMap() {
period = getSelectedPeriod ? getSelectedPeriod() : period;
enrichBankRows();
applyPreMapping(); // sets _cat/_bien/_lot/_conf on rowMeta before building table
goScreen(2);
}

// Normalise une date vers DD/MM/YYYY (display) et YYYY-MM-DD (sort)
function _normDateStr(d) {
  if (!d) return { sort: '', display: '' };
  const s = String(d).trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return { sort: m1[3]+'-'+m1[2].padStart(2,'0')+'-'+m1[1].padStart(2,'0'), display: m1[1].padStart(2,'0')+'/'+m1[2].padStart(2,'0')+'/'+m1[3] };
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m2) { const yy=m2[3].length===2?'20'+m2[3]:m2[3]; return { sort: yy+'-'+m2[1].padStart(2,'0')+'-'+m2[2].padStart(2,'0'), display: m2[2].padStart(2,'0')+'/'+m2[1].padStart(2,'0')+'/'+yy }; }
  const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return { sort: s.slice(0,10), display: m3[3]+'/'+m3[2]+'/'+m3[1] };
  return { sort: s, display: s };
}
function buildMappingTable() {
const catOpts = CATS.map(c => `<option value="${c}">${c}</option>`).join('');
const sciOpts = SCIS.map(s => `<option value="${s}">${s}</option>`).join('');
const bienOpts = BIENS_NOMS.map(b => `<option value="${b}">${b}</option>`).join('');
const lotOpts = LOTS.map(l => `<option value="${l}">${l}</option>`).join('');

const hasAirbnbUnresolved = rowMeta.some(r => r.isAirbnb && !r.airbnbResolved);
const hasBookingUnresolved = rowMeta.some(r => r.isBooking && !r.bookingResolved);
document.getElementById('airbnbMissingBanner').style.display = hasAirbnbUnresolved ? 'block' : 'none';
document.getElementById('bookingMissingBanner').style.display = hasBookingUnresolved ? 'block' : 'none';

const tbody = document.getElementById('mappingBody');
tbody.innerHTML = '';

rowMeta.forEach((r, i) => {
const pos = r.montant > 0;

if(r.isAirbnb) {
const resolved = r.airbnbResolved;
const tr = document.createElement('tr');
tr.className = resolved ? 'row-airbnb' : 'row-blocked';
tr.id = `row-${i}`;

if(resolved) {
const ventilSummary = r.airbnbVentil.map(v =>
`<span class="badge badge-airbnb">${v.bienName} ${fmt(v.montant)}</span>`
).join(' ');
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-airbnb"></span></td>
<td style="max-width:260px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500;font-size:12px">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:1px">${_normDateStr(r.date).display}</div>
</td>
<td class="td-${pos?'pos':'neg'}" style="text-align:right;font-family:monospace;white-space:nowrap;font-size:12px">${fmt(r.montant)}</td>
<td colspan="3" style="padding:6px 10px">
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    <span class="badge badge-airbnb" style="font-size:9px">✈ Airbnb</span>
    <span style="font-size:10px;color:var(--text2)">${ventilSummary}</span>
  </div>
</td>`;
} else {
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-err"></span></td>
<td style="max-width:260px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500;font-size:12px">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:1px">${_normDateStr(r.date).display}</div>
</td>
<td class="td-${pos?'pos':'neg'}" style="text-align:right;font-family:monospace;font-size:12px">${fmt(r.montant)}</td>
<td colspan="3" style="padding:6px 10px"><span class="badge badge-blocked" style="font-size:9px">🚫 Export Airbnb requis</span></td>`;
}
tbody.appendChild(tr);

// detail panel removed - ventilation visible en validation

} else if(r.isBooking) {
const v = r.bookingVentil;
const resolved = r.bookingResolved && v && !v.unknown;
const tr = document.createElement('tr');
tr.className = resolved ? 'row-booking' : 'row-blocked';
tr.id = `row-${i}`;
const pos = r.montant > 0;

if(resolved) {
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-booking"></span></td>
<td style="max-width:260px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500;font-size:12px">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:1px">${_normDateStr(r.date).display}</div>
</td>
<td class="td-${pos?'pos':'neg'}" style="text-align:right;font-family:monospace;white-space:nowrap;font-size:12px">${fmt(r.montant)}</td>
<td colspan="3" style="padding:6px 10px">
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    <span class="badge badge-booking" style="font-size:9px">🏨 Booking</span>
    <span style="font-size:10px;color:var(--text2)">${v.bienName}</span>
  </div>
</td>`;
} else {
const reason = !Object.keys(bookingIndex).length
? '🚫 BLOQUÉ - Export Booking requis'
: v?.unknown ? `🚫 ID établissement ${v.idEtab} non mappé` : "🚫 Référence introuvable dans l'export";
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-err"></span></td>
<td style="max-width:260px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500;font-size:12px">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:1px">${_normDateStr(r.date).display}</div>
</td>
<td class="td-${pos?'pos':'neg'}" style="text-align:right;font-family:monospace;font-size:12px">${fmt(r.montant)}</td>
<td colspan="3" style="padding:6px 10px"><span class="badge badge-blocked" style="font-size:9px">${reason}</span></td>`;
}
tbody.appendChild(tr);

// booking detail panel removed

} else if(r.isLoan) {
const s = r.loanSplit;
const resolved = s && !s.unknown;
const tr = document.createElement('tr');
tr.className = resolved ? 'row-loan' : 'row-blocked';
tr.id = `row-${i}`;
const pos = r.montant >= 0;

if(resolved) {
const totalCap = s.lines.reduce((a,l) => a + l.capital, 0);
const totalInt = s.lines.reduce((a,l) => a + l.interets, 0);
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-loan"></span></td>
<td style="max-width:260px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500;font-size:12px">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:1px">${_normDateStr(r.date).display}</div>
</td>
<td class="td-neg" style="text-align:right;font-family:monospace;white-space:nowrap;font-size:12px">${fmt(r.montant)}</td>
<td colspan="3" style="padding:6px 10px">
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    <span class="badge badge-loan" style="font-size:9px">🏦 Emprunt</span>
    <span style="font-size:10px;color:var(--text2)">Cap. ${fmt(totalCap)} · Int. ${fmt(totalInt)}</span>
  </div>
</td>`;
} else {
const reason = s?.unknown ? ('🚫 Échéance introuvable (' + s.ym + ')') : '🚫 Référence emprunt inconnue';
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-err"></span></td>
<td style="max-width:260px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500;font-size:12px">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:1px">${_normDateStr(r.date).display}</div>
</td>
<td class="td-neg" style="text-align:right;font-family:monospace;font-size:12px">${fmt(r.montant)}</td>
<td colspan="3" style="padding:6px 10px"><span class="badge badge-blocked" style="font-size:9px">${reason}</span></td>`;}
tbody.appendChild(tr);

if(resolved) {
const trDetail = document.createElement('tr');
trDetail.className = 'row-expanded';
const subRows = s.lines.flatMap(l => [
`<tr><td style="padding-left:32px" class="sub-bien">↳ ${l.bienName} · Capital</td><td class="td-muted">${l.sci}</td><td class="td-muted">${l.lot}</td><td class="td-muted" style="font-size:10px">${(l.pct*100).toFixed(0)}%</td><td class="sub-amt" style="color:var(--red)">${fmt(l.capital)}</td></tr>`,
`<tr><td style="padding-left:32px;opacity:.7" class="sub-bien">↳ ${l.bienName} · Intérêts</td><td class="td-muted" style="opacity:.7">${l.sci}</td><td class="td-muted" style="opacity:.7">${l.lot}</td><td class="td-muted" style="font-size:10px;opacity:.7">${(l.pct*100).toFixed(0)}%</td><td class="sub-amt" style="color:var(--red);opacity:.8">${fmt(l.interets)}</td></tr>`
]).join('');

trDetail.innerHTML = `<td colspan="9"><div class="airbnb-panel" style="border-top-color:rgba(34,201,122,.15);background:rgba(34,201,122,.03)"><div style="width:100%"><table class="airbnb-sub-table" style="width:100%"><thead><tr><th style="padding-left:32px;color:var(--green)">Bien · Nature</th><th>SCI</th><th>Lot</th><th>%</th><th style="text-align:right;color:var(--red)">Montant</th></tr></thead><tbody>${subRows}</tbody><tfoot><tr style="border-top:1px solid var(--border2)"><td colspan="3" style="padding-left:32px;font-size:10px;color:var(--text2)">Total échéance</td><td></td><td style="text-align:right;font-size:12px;font-weight:700;color:var(--red)">${fmt(r.montant)}</td></tr></tfoot></table></div></div></td>`;
tbody.appendChild(trDetail);
}

} else {
// Use stored values to check completion at build time
const isComplete = !!(r._cat && r._bien && r._lot);

// Build the row normally, but hide it if complete and showCompleted is false
// We still render it fully so values are preserved

const tr = document.createElement('tr');
tr.id = `row-${i}`;

const prefCat  = r._cat  || '';
const prefSci  = r._sci  || '';
const prefBien = r._bien || '';
const prefLot  = r._lot  || '';

const confBadge = r._conf ? {
  high:   '<span style="font-size:9px;font-weight:700;color:#22c97a;background:rgba(34,201,122,.1);border:1px solid rgba(34,201,122,.25);border-radius:4px;padding:1px 5px;margin-left:4px">' + (r._fromHistory ? '📚 Historique' : '🟢 Sûr') + '</span>',
  medium: '<span style="font-size:9px;font-weight:700;color:var(--gold);background:rgba(245,183,49,.1);border:1px solid rgba(245,183,49,.25);border-radius:4px;padding:1px 5px;margin-left:4px">🟡 À vérifier</span>',
  low:    '<span style="font-size:9px;font-weight:700;color:var(--red);background:rgba(240,86,106,.1);border:1px solid rgba(240,86,106,.25);border-radius:4px;padding:1px 5px;margin-left:4px">🔴 Incertain</span>',
}[r._conf] || '' : '';
tr.innerHTML = `
<td style="width:24px"><span class="dot dot-pending" id="dot-${i}"></span></td>
<td style="max-width:220px">
  <div class="td-trunc" title="${r.full}" style="font-weight:500">${r.libelle}</div>
  <div style="font-size:10px;color:var(--text2);margin-top:2px">${_normDateStr(r.date).display} ${confBadge}</div>
</td>
<td class="td-${pos?'pos':'neg'}" style="text-align:right;font-family:monospace;white-space:nowrap">${fmt(r.montant)}</td>
<td><select class="sel" id="cat-${i}" onchange="onCat(${i})" style="min-width:150px"><option value="">- Catégorie -</option>
${CATS.map(c=>`<option value="${c}" ${c===prefCat?'selected':''}>${c}</option>`).join('')}
</select></td>
<td>
  <select class="sel" id="bien-${i}" onchange="onBien(${i})" style="min-width:140px"><option value="">- Bien -</option>
  ${BIENS_NOMS.map(b=>`<option value="${b}" ${b===prefBien?'selected':''}>${b}</option>`).join('')}
  </select>
  <select class="sel" id="sci-${i}" onchange="onRow(${i})" style="display:none" aria-hidden="true">
  ${SCIS.map(s=>`<option value="${s}" ${s===prefSci?'selected':''}>${s}</option>`).join('')}
  </select>
  <div id="sci-label-${i}" style="font-size:9px;color:var(--text2);margin-top:3px;letter-spacing:.04em">${prefSci||''}</div>
</td>
<td><select class="sel" id="lot-${i}" onchange="onRow(${i})" style="min-width:120px"><option value="">- Lot -</option>
${LOTS.map(l=>`<option value="${l}" ${l===prefLot?'selected':''}>${l}</option>`).join('')}
</select></td>`;

tbody.appendChild(tr);
onRow(i);
// Tint row background by confidence
if (r._conf && !isComplete) {
  tr.style.background = {
    high:   'rgba(34,201,122,.03)',
    medium: 'rgba(245,183,49,.03)',
    low:    'rgba(240,86,106,.04)',
  }[r._conf] || '';
}
// Hide if complete and toggle is off
if (isComplete && !showCompleted) {
  tr.style.display = 'none';
}
}
});

updateProgress();
}

function onCat(i) {
const cat = document.getElementById('cat-'+i)?.value;
if(cat && QP[cat]?.length === 1) {
const lotEl = document.getElementById('lot-'+i);
if(lotEl && !lotEl.value) lotEl.value = QP[cat][0].lot;
}
onBien(i);
}

function onBien(i) {
const bien = document.getElementById('bien-'+i)?.value || '';
if(bien && bien !== 'Frais généraux') {
const b = BIENS.find(x => x.nom === bien);
if(b) {
  // Auto-fill lot
  const lotEl = document.getElementById('lot-'+i);
  if(lotEl && !lotEl.value) lotEl.value = b.lot;
  // Auto-fill SCI (hidden select + visible label)
  const sciEl = document.getElementById('sci-'+i);
  if(sciEl) sciEl.value = b.sci;
  const sciLabel = document.getElementById('sci-label-'+i);
  if(sciLabel) sciLabel.textContent = b.sci;
}
}
onRow(i);
}

function onRow(i) {
const r = rowMeta[i];
if(!r || r.isAirbnb) return;

const cat  = document.getElementById('cat-'+i)?.value  || '';
const bien = document.getElementById('bien-'+i)?.value || '';
const lot  = document.getElementById('lot-'+i)?.value  || '';
const dot  = document.getElementById('dot-'+i);
const ap   = document.getElementById('apercu-'+i); // removed column

const complete = cat && bien && lot;
if(dot) dot.className = 'dot ' + (complete ? 'dot-ok' : 'dot-pending');
  if (complete && !showCompleted) {
    // Fade out and hide the row after a short delay so user sees it's done
    const rowEl = document.getElementById('row-'+i);
    if (rowEl) {
      rowEl.style.transition = 'opacity .5s, transform .4s';
      rowEl.style.opacity = '0';
      rowEl.style.transform = 'translateX(20px)';
      setTimeout(() => {
        rowEl.style.display = 'none';
      }, 500);
    }
  }

if(!ap) return;

if(!complete) { ap.innerHTML = ''; updateProgress(); return; }

if(bien === 'Frais généraux') {
const rule = QP[cat]?.find(m => m.lot === lot);
if(rule) {
ap.innerHTML = Object.entries(rule.biens)
.filter(([,p]) => p > 0)
.map(([id,p]) => {
const b = BIENS.find(x => x.id === id);
const name = b ? b.name : id;
const isLLD = b?.type === 'LLD';
return `<span class="badge ${isLLD?'badge-ventil':'badge-direct'}" style="margin-bottom:2px">${name} ${(p*100).toFixed(0)}%</span>`;
}).join(' ');
} else {
ap.innerHTML = `<span style="font-size:10px;color:var(--red)">Règle manquante</span>`;
}
} else {
const b = BIENS.find(x => x.nom === bien);
ap.innerHTML = `<span class="badge badge-direct">${b?.name || bien}</span>`;
}
updateProgress();
}

function toggleCompleted() {
  showCompleted = !showCompleted;
  const btn = document.getElementById('btnToggleCompleted');
  if (btn) {
    btn.innerHTML = showCompleted
      ? '✅ <span style="font-size:10px">Masquer traitées (<span id=\"completedCount\">' + document.getElementById('completedCount').textContent + '</span>)</span>'
      : '👁 <span style="font-size:10px">Voir traitées (<span id=\"completedCount\">' + document.getElementById('completedCount').textContent + '</span>)</span>';
    btn.style.background = showCompleted ? 'rgba(34,201,122,.15)' : '';
    btn.style.borderColor = showCompleted ? 'rgba(34,201,122,.6)' : 'rgba(34,201,122,.3)';
  }
  // Show/hide completed rows in DOM without rebuilding the table
  rowMeta.forEach((r, i) => {
    if (r.isAirbnb || r.isBooking || r.isLoan) return;
    const cat  = document.getElementById('cat-'+i)?.value  || r._cat  || '';
    const bien = document.getElementById('bien-'+i)?.value || r._bien || '';
    const lot  = document.getElementById('lot-'+i)?.value  || r._lot  || '';
    const complete = !!(cat && bien && lot);
    if (!complete) return;
    const rowEl = document.getElementById('row-'+i);
    if (!rowEl) return;
    if (showCompleted) {
      rowEl.style.display = '';
      rowEl.style.opacity = '1';
      rowEl.style.transform = 'none';
    } else {
      rowEl.style.display = 'none';
    }
  });
}

function updateProgress() {
let done = 0, total = rowMeta.length;
rowMeta.forEach((r, i) => {
if(r.isAirbnb) {
if(r.airbnbResolved) done++;
} else if(r.isBooking) {
if(r.bookingResolved && r.bookingVentil && !r.bookingVentil.unknown) done++;
} else if(r.isLoan) {
if(r.loanSplit && !r.loanSplit.unknown) done++;
} else {
const cat  = document.getElementById('cat-'+i)?.value;
const bien = document.getElementById('bien-'+i)?.value;
const lot  = document.getElementById('lot-'+i)?.value;
if(cat && bien && lot) done++;
}
});
document.getElementById('progFill').style.width = (total ? done/total*100 : 0) + '%';

const ca       = bankRows.reduce((a,r) => a+(r.montant>0?r.montant:0), 0);
const charges  = bankRows.reduce((a,r) => a+(r.montant<0?r.montant:0), 0);
const airbnbBlocked = rowMeta.filter(r => r.isAirbnb && !r.airbnbResolved).length;
const airbnbOk      = rowMeta.filter(r => r.isAirbnb && r.airbnbResolved).length;
const bookingBlocked = rowMeta.filter(r => r.isBooking && (!r.bookingResolved || r.bookingVentil?.unknown)).length;
const bookingOk      = rowMeta.filter(r => r.isBooking && r.bookingResolved && !r.bookingVentil?.unknown).length;
let chips = `
<span class="chip chip-blue">${done}/${total} mappés</span><span class="chip chip-green">CA : ${fmt(ca)}</span><span class="chip chip-red">Charges : ${fmt(charges)}</span>`;
const loanOk      = rowMeta.filter(r => r.isLoan && r.loanSplit && !r.loanSplit.unknown).length;
const loanBlocked = rowMeta.filter(r => r.isLoan && (!r.loanSplit || r.loanSplit.unknown)).length;
if(airbnbOk)      chips += `<span class="chip chip-gold">✈ ${airbnbOk} Airbnb</span>`;
if(airbnbBlocked) chips += `<span class="chip chip-red">🚫 ${airbnbBlocked} Airbnb bloqué${airbnbBlocked>1?'s':''}</span>`;
if(bookingOk)     chips += `<span class="chip chip-blue" style="border-color:rgba(155,110,243,.3);color:var(--purple)">🏨 ${bookingOk} Booking</span>`;
if(bookingBlocked)chips += `<span class="chip chip-red">🚫 ${bookingBlocked} Booking bloqué${bookingBlocked>1?'s':''}</span>`;
if(loanOk)        chips += `<span class="chip chip-green">🏦 ${loanOk} emprunt${loanOk>1?'s':''} splittés</span>`;
if(loanBlocked)   chips += `<span class="chip chip-red">🚫 ${loanBlocked} emprunt bloqué${loanBlocked>1?'s':''}</span>`;
document.getElementById('mappingChips').innerHTML = chips;

  // Update completed count badge
  let completedManual = 0;
  rowMeta.forEach((r, i) => {
    if (!r.isAirbnb && !r.isBooking && !r.isLoan) {
      const cat  = document.getElementById('cat-'+i)?.value  || r._cat  || '';
      const bien = document.getElementById('bien-'+i)?.value || r._bien || '';
      const lot  = document.getElementById('lot-'+i)?.value  || r._lot  || '';
      if (cat && bien && lot) completedManual++;
    }
  });
  const countEl = document.getElementById('completedCount');
  if (countEl) countEl.textContent = completedManual;
}

function goValidate() {
const airbnbBlocked = rowMeta.filter(r => r.isAirbnb && !r.airbnbResolved).length;
const bookingBlocked = rowMeta.filter(r => r.isBooking && (!r.bookingResolved || r.bookingVentil?.unknown)).length;
if(airbnbBlocked > 0) {
showToast(`🚫 ${airbnbBlocked} ligne(s) Airbnb bloquée(s) - importe l'export Airbnb`, '#f0566a');
return;
}
if(bookingBlocked > 0) {
showToast(`🚫 ${bookingBlocked} ligne(s) Booking bloquée(s) - importe l'export Booking`, '#f0566a');
return;
}
const loanBlockedVal = rowMeta.filter(r => r.isLoan && (!r.loanSplit || r.loanSplit.unknown)).length;
if(loanBlockedVal > 0) {
showToast(`🚫 ${loanBlockedVal} ligne(s) emprunt introuvable(s) dans les tableaux`, '#f0566a');
return;
}

// Catégorie, bien et lot sont obligatoires sur toute ligne saisie manuellement :
// sans ce contrôle, une ligne incomplète disparaît silencieusement de l'import
// au lieu d'être bloquée.
let incompleteCount = 0;
let missingFgRuleCount = 0;
rowMeta.forEach((r, i) => {
if(r.isAirbnb || r.isBooking || r.isLoan) return;
const cat  = document.getElementById('cat-'+i)?.value  || '';
const bien = document.getElementById('bien-'+i)?.value || '';
const lot  = document.getElementById('lot-'+i)?.value  || '';
if(!cat || !bien || !lot) { incompleteCount++; return; }
if(bien === 'Frais généraux' && !QP[cat]?.find(m => m.lot === lot)) missingFgRuleCount++;
});
if(incompleteCount > 0) {
showToast(`🚫 ${incompleteCount} ligne(s) incomplète(s) — catégorie, bien et lot doivent être renseignés`, '#f0566a');
return;
}
if(missingFgRuleCount > 0) {
showToast(`🚫 ${missingFgRuleCount} ligne(s) "Frais généraux" sans quote-part configurée pour ce lot — vérifie Paramètres > Quote-parts`, '#f0566a');
return;
}

ventilLines = [];

rowMeta.forEach((r, i) => {
if(r.isAirbnb && r.airbnbResolved) {
r.airbnbVentil.forEach(v => {
ventilLines.push({
date: r.date, libelle: r.libelle, full: r.full,
cat: 'Airbnb', sci: v.sci, lot: v.lot,
bienId: v.bienId, bienName: v.bienName, bienNom: v.bienNom,
montantOrigine: r.montant, montant: v.montant,
isFG: false, sourcePlatform: 'Airbnb', platformRef: r.airbnbCode,
...SCHEMA['Airbnb']
});
});
} else if(r.isBooking && r.bookingResolved && r.bookingVentil && !r.bookingVentil.unknown) {
const v = r.bookingVentil;
ventilLines.push({
date: r.date, libelle: r.libelle, full: r.full,
cat: 'Booking', sci: v.sci, lot: v.lot,
bienId: v.bienId, bienName: v.bienName, bienNom: v.bienNom,
montantOrigine: r.montant, montant: v.montant,
isFG: false, sourcePlatform: 'Booking', platformRef: r.bookingRef,
...SCHEMA['Booking']
});
} else if(r.isLoan && r.loanSplit && !r.loanSplit.unknown) {
r.loanSplit.lines.forEach(l => {
ventilLines.push({
date: r.date, libelle: r.libelle, full: r.full,
cat: 'Remboursement emprunt', sci: l.sci, lot: l.lot,
bienId: l.bienId, bienName: l.bienName, bienNom: l.bienNom,
montantOrigine: r.montant, montant: l.capital,
isFG: false, sourcePlatform: null, platformRef: null, loanRef: r.loanRef,
n1:'Bilan', n2:'Passifs financiers', ebitda:'NON', ebit:'NON', cfcv:'Charge fixe',
sousType: 'Capital',
});
ventilLines.push({
date: r.date, libelle: r.libelle, full: r.full,
cat: 'Intérêts de crédit', sci: l.sci, lot: l.lot,
bienId: l.bienId, bienName: l.bienName, bienNom: l.bienNom,
montantOrigine: r.montant, montant: l.interets,
isFG: false, sourcePlatform: null, platformRef: null, loanRef: r.loanRef,
n1:'Compte de résultat', n2:'Charges financières', ebitda:'NON', ebit:'NON', cfcv:'Charge fixe',
sousType: 'Intérêts',
});
});
} else if(!r.isAirbnb && !r.isBooking && !r.isLoan) {
const cat  = document.getElementById('cat-'+i)?.value  || '';
const sci  = document.getElementById('sci-'+i)?.value  || '';
const bien = document.getElementById('bien-'+i)?.value || '';
const lot  = document.getElementById('lot-'+i)?.value  || '';
if(!cat) return;

const schema = SCHEMA[cat] || {n1:'?',n2:'?',ebitda:'?',ebit:'?',cfcv:'?'};

if(bien === 'Frais généraux') {
const rule = QP[cat]?.find(m => m.lot === lot);
if(rule) {
const entries = Object.entries(rule.biens).filter(([,pct]) => pct > 0);
let distributed = 0;
entries.forEach(([bienId, pct], idx) => {
const b = BIENS.find(x => x.id === bienId);
const isLast = idx === entries.length - 1;
const montantVentil = isLast
  ? Math.round((r.montant - distributed) * 100) / 100
  : Math.round(r.montant * pct * 100) / 100;
distributed += montantVentil;
ventilLines.push({
date: r.date, libelle: r.libelle, full: r.full,
cat, sci: b?.sci||sci, lot,
bienId, bienName: b?.name||bienId, bienNom: b?.nom||bienId,
montantOrigine: r.montant, montant: montantVentil,
isFG: true, sourceAirbnb: false, ...schema
});
});
}
} else {
const b = BIENS.find(x => x.nom === bien);
ventilLines.push({
date: r.date, libelle: r.libelle, full: r.full,
cat, sci: b?.sci||sci, lot,
bienId: b?.id||'?', bienName: b?.name||bien, bienNom: bien,
montantOrigine: r.montant, montant: r.montant,
isFG: false, sourceAirbnb: false, ...schema
});
}
}
});

renderValidation();
goScreen(3);
}

function renderValidation() {
const tbody = document.getElementById('previewBody');
tbody.innerHTML = ventilLines.map(v => {
const pos = v.montant >= 0;
const src = v.sourcePlatform === 'Airbnb' ? '<span class="badge badge-airbnb">✈</span>' : v.sourcePlatform === 'Booking' ? '<span class="badge badge-booking">🏨</span>' : v.loanRef ? '<span class="badge badge-loan">🏦</span>' : '';
const fg  = v.isFG ? '<span class="badge badge-ventil">FG</span>' : '';
return `<tr><td>${src}${fg}</td><td class="td-mono td-muted">${v.date}</td><td class="td-trunc">${v.libelle}</td><td class="td-muted" style="font-size:11px">${v.cat}</td><td><span class="badge ${v.isFG?'badge-ventil':'badge-direct'}">${v.bienName}</span></td><td class="td-muted" style="font-size:11px">${v.sci||''}</td><td class="td-muted" style="font-size:11px">${v.lot||''}</td><td class="td-${pos?'pos':'neg'}" style="font-size:11px">${fmt(v.montantOrigine)}</td><td class="td-${pos?'pos':'neg'}" style="font-weight:700">${fmt(v.montant)}</td></tr>`;
}).join('');

const totals = {};
BIENS.forEach(b => { totals[b.id]={name:b.name,sci:b.sci,ca:0,charges:0,bilan:0}; });
ventilLines.forEach(v => {
if(!totals[v.bienId]) return;
if(v.n1==='Bilan') totals[v.bienId].bilan += v.montant;
else if(v.montant>=0) totals[v.bienId].ca += v.montant;
else totals[v.bienId].charges += v.montant;
});

document.getElementById('summaryGrid').innerHTML = Object.values(totals)
.filter(t => t.ca||t.charges)
.map(t => {
const net = t.ca+t.charges;
return `<div class="sum-card"><div class="sum-name">${t.name}</div><div class="sum-row"><span class="sum-lbl">CA</span><span class="sum-val" style="color:var(--green)">${fmt(t.ca)}</span></div><div class="sum-row"><span class="sum-lbl">Charges</span><span class="sum-val" style="color:var(--red)">${fmt(t.charges)}</span></div>
${t.bilan?`<div class="sum-row"><span class="sum-lbl">Bilan</span><span class="sum-val" style="color:var(--purple)">${fmt(t.bilan)}</span></div>`:''}
<div class="sum-divider"></div><div class="sum-net"><span class="sum-net-lbl">Résultat</span><span class="sum-net-val" style="color:${net>=0?'var(--green)':'var(--red)'}">${fmt(net)}</span></div></div>`;
}).join('');

const caTotal = ventilLines.filter(v=>v.n1!=='Bilan'&&v.montant>0).reduce((a,v)=>a+v.montant,0);
const chTotal = ventilLines.filter(v=>v.n1!=='Bilan'&&v.montant<0).reduce((a,v)=>a+v.montant,0);
const airbnbLines  = ventilLines.filter(v=>v.sourcePlatform==='Airbnb').length;
const bookingLines = ventilLines.filter(v=>v.sourcePlatform==='Booking').length;
const loanLines    = ventilLines.filter(v=>v.loanRef).length;
document.getElementById('valChips').innerHTML = `
<span class="chip chip-blue">${ventilLines.length} lignes ventilées</span><span class="chip chip-green">CA : ${fmt(caTotal)}</span><span class="chip chip-red">Charges : ${fmt(chTotal)}</span><span class="chip chip-gold">Net : ${fmt(caTotal+chTotal)}</span>
${airbnbLines?`<span class="chip chip-gold">✈ ${airbnbLines} Airbnb</span>`:''}
${bookingLines?`<span class="chip chip-blue" style="border-color:rgba(155,110,243,.3);color:var(--purple)">🏨 ${bookingLines} Booking</span>`:''}
${loanLines?`<span class="chip chip-green">🏦 ${loanLines} lignes emprunt</span>`:''}`;
}

function setColWidths(ws, w) {
const range = XLSX.utils.decode_range(ws['!ref']||'A1');
ws['!cols'] = Array.from({length:range.e.c+1},()=>({wch:w}));
}

function loadDemo() {
showToast('Demo désactivée - importe tes vrais fichiers !');
}

let _currentScreen = 1;
function goScreen(n) {
  _currentScreen = n;
document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
document.getElementById('sc'+n).classList.add('active');
if(n===1) renderRecentActivity();
if(n===4) renderDatabase();
if(n===5) renderParams();
if(n===6) { enterDashboard(); return; }
document.querySelectorAll('.step-item').forEach((s,i)=>{
s.classList.remove('active','done');
if(i+1===n) s.classList.add('active');
else if(i+1<n) s.classList.add('done');
});
const navIds=['nav-import','nav-mapping','nav-validation','nav-base','nav-params','nav-dashboard'];
document.querySelectorAll('.sb-item').forEach(el=>el.classList.remove('active'));
const navId=navIds[n-1];
if(navId){const el=document.getElementById(navId);if(el)el.classList.add('active');}
updateDBBadge();
window.scrollTo({top:0,behavior:'smooth'});
if(n===1){initPeriodPicker();checkPeriodConflict();}
if(n===4) renderDatabase();
if(n===5) renderParams();
if(n===6) { enterDashboard(); return; }

}
function navTo(n) {
if(n<=3 && n===2 && !rowMeta.length){showToast('Importe d\'abord une extraction');return;}
if(n===3 && !ventilLines.length){goValidate();return;}
goScreen(n);
const titles = {1:'Import',2:'Mapping',3:'Validation',4:'Base',5:'Paramètres',6:'Dashboard'};
const el = document.getElementById('header-section');
if(el) el.textContent = titles[n] || 'Import';
const stepper = document.getElementById('stepper');
if(stepper) stepper.style.display = (n >= 4) ? 'none' : 'flex';
}
function updateDBBadge(){
const db=getDB();
const count=Object.keys(db.periods).length;
// badge DB removed
}

function fmt(n) {
return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0);
}
function showToast(msg, bg='#22c97a') {
const t=document.getElementById('toast');
t.textContent=msg; t.style.background=bg;
t.classList.add('show');
setTimeout(()=>t.classList.remove('show'),3000);
}

function saveSession() {
if(!rowMeta.length) { showToast("Rien à sauvegarder - charge une extraction bancaire d'abord", '#f0566a'); return; }

const mappingState = rowMeta.map((r, i) => {
if(r.isAirbnb || r.isBooking || r.isLoan) return null;
return {
i,
cat: document.getElementById('cat-'+i)?.value || '',
sci: document.getElementById('sci-'+i)?.value || '',
bien: document.getElementById('bien-'+i)?.value || '',
lot: document.getElementById('lot-'+i)?.value || '',
};
}).filter(Boolean);

const session = {
version: 2,
savedAt: new Date().toISOString(),
period,
bankRows,
airbnbIndex,
bookingIndex,
mappingState,
};

const blob = new Blob([JSON.stringify(session)], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `artemis-session-${period || 'draft'}.json`;
a.click();
URL.revokeObjectURL(url);
showToast('💾 Session sauvegardée !');
}

function loadSession(input) {
const file = input.files[0];
if(!file) return;
const reader = new FileReader();
reader.onload = e => {
try {
const session = JSON.parse(e.target.result);
if(!session.version || !session.bankRows) throw new Error('Format invalide');

period = session.period || '';
bankRows = session.bankRows;
airbnbIndex = session.airbnbIndex || {};
bookingIndex = session.bookingIndex || {};

if(bankRows.length) {
document.getElementById('stBankDot').className = 'dot dot-ok';
document.getElementById('stBankText').textContent = `Extraction bancaire - ${bankRows.length} lignes`;
document.getElementById('stBankSub').textContent = period + ' (session restaurée)';
}
const nbAirbnb = Object.keys(airbnbIndex).length;
if(nbAirbnb) {
document.getElementById('stAirbnbDot').className = 'dot dot-ok';
document.getElementById('stAirbnbDot').style.background = 'var(--gold)';
document.getElementById('stAirbnbText').textContent = `Export Airbnb - ${nbAirbnb} Payouts`;
}
const nbBooking = Object.keys(bookingIndex).length;
if(nbBooking) {
document.getElementById('stBookingDot').className = 'dot dot-ok';
document.getElementById('stBookingDot').style.background = 'var(--purple)';
document.getElementById('stBookingText').textContent = `Export Booking - ${nbBooking} Payouts`;
}

enrichBankRows();

if(session.mappingState) {
session.mappingState.forEach(s => {
if(rowMeta[s.i]) {
rowMeta[s.i]._cat = s.cat;
rowMeta[s.i]._sci = s.sci;
rowMeta[s.i]._bien = s.bien;
rowMeta[s.i]._lot = s.lot;
}
});
}

buildMappingTable();
goScreen(2);
checkReadyToMap();
showToast(`📂 Session restaurée - ${bankRows.length} lignes`);

} catch(err) {
showToast('Fichier de session invalide : ' + err.message, '#f0566a');
}
};
reader.readAsText(file);
input.value = ''; }

const DB_KEY      = 'artemis_db';
const AIRBNB_KEY  = 'artemis_airbnb_rows';
const BOOKING_KEY = 'artemis_booking_rows';




function getDB() {
try {
const db = JSON.parse(localStorage.getItem(DB_KEY) || '{"periods":{}}');
if(!db || !db.periods) return {periods:{}};
_computeArtemisDateBounds(db);
return db;
} catch(e) { return {periods:{}}; }
}
function saveDB(db) {
localStorage.setItem(DB_KEY, JSON.stringify(db));
_computeArtemisDateBounds(db);
}

function _computeArtemisDateBounds(db) {
  try {
    const normD = d => {
      if (!d) return '';
      const s = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
      return '';
    };
    const dates = Object.values(db.periods||{})
      .flatMap(p => (p.lines||[]).map(l => normD(l.date)))
      .filter(d => d && d.length===10).sort();
    if (dates.length) {
      window._artemisDateMin = dates[0];
      window._artemisDateMax = dates[dates.length-1];
    }
  } catch(e) {}
}


// ── Restore Airbnb/Booking indexes from persisted rows ──
function restorePlatformIndexes(silent) {
  let airbnbOk = false, bookingOk = false;

  try {
    const raw = localStorage.getItem(AIRBNB_KEY);
    if (raw) {
      const rows = JSON.parse(raw);
      // Re-run parseAirbnbFile logic silently (don't touch DOM)
      airbnbIndex = {};
      let currentCode = null;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const type = String(r[2]||'');
        if (type === 'Payout') {
          currentCode = r[12];
          if (currentCode) airbnbIndex[currentCode] = {
            code_ref: currentCode, date: r[0], mapping: r[3],
            montant_verse: parseFloat(r[15])||0, reservations: []
          };
        } else if (currentCode && airbnbIndex[currentCode]) {
          airbnbIndex[currentCode].reservations.push({
            type, code_conf: r[4],
            date_debut: r[6], date_fin: r[7], nuits: r[8],
            voyageur: r[9], logement: String(r[10]||''),
            montant: parseFloat(r[14])||0,
            frais_service: parseFloat(r[16])||0,
            frais_menage: parseFloat(r[18])||0,
            revenus_bruts: parseFloat(r[20])||0,
          });
        }
      }
      const nb = Object.keys(airbnbIndex).length;
      if (nb > 0) {
        airbnbOk = true;
        if (!silent) {
          const el = document.getElementById('stAirbnbText');
          if (el) el.textContent = `Export Airbnb - ${nb} Payouts (mémoire)`;
          const dot = document.getElementById('stAirbnbDot');
          if (dot) { dot.className = 'dot dot-ok'; dot.style.background = 'var(--gold)'; }
          const sub = document.getElementById('stAirbnbSub');
          if (sub) sub.textContent = 'Chargé depuis la mémoire';
          const dz = document.getElementById('dzAirbnb');
          if (dz) dz.classList.add('upload-ok');
        }
      }
    }
  } catch(e) {}

  try {
    const raw = localStorage.getItem(BOOKING_KEY);
    if (raw) {
      const rows = JSON.parse(raw);
      bookingIndex = {};
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const type = String(r[0]||'');
        if (type === '(Payout)') {
          const libRef = String(r[1]||''); const idEtab = String(r[9]||'');
          if (!libRef) continue;
          bookingIndex[libRef] = {
            libRef, idEtab, nomEtab: String(r[10]||''),
            montant: parseFloat(r[25])||0,
            dateVersement: r[27], reservations: []
          };
        } else if (type === 'Réservation') {
          const libRef = String(r[1]||'');
          if (bookingIndex[libRef]) {
            bookingIndex[libRef].reservations.push({
              numRef: String(r[2]||''), dateArrivee: r[3], dateDepart: r[4],
              nuits: r[8], montantBrut: parseFloat(r[15])||0,
              commission: parseFloat(r[16])||0,
              fraisPaiement: parseFloat(r[18])||0,
              montantTransaction: parseFloat(r[21])||0,
            });
          }
        }
      }
      const nb = Object.keys(bookingIndex).length;
      if (nb > 0) {
        bookingOk = true;
        if (!silent) {
          const el = document.getElementById('stBookingText');
          if (el) el.textContent = `Export Booking - ${nb} Payouts (mémoire)`;
          const dot = document.getElementById('stBookingDot');
          if (dot) { dot.className = 'dot dot-ok'; dot.style.background = 'var(--purple)'; }
          const sub = document.getElementById('stBookingSub');
          if (sub) sub.textContent = 'Chargé depuis la mémoire';
          const dz = document.getElementById('dzBooking');
          if (dz) dz.classList.add('upload-ok');
        }
      }
    }
  } catch(e) {}

  if (!silent) checkReadyToMap();
  return { airbnbOk, bookingOk };
}

function clearPlatformMemory() {
  askConfirm('Effacer la mémoire Airbnb et Booking ?\nVous devrez les recharger manuellement.', () => {
    localStorage.removeItem(AIRBNB_KEY);
    localStorage.removeItem(BOOKING_KEY);
    airbnbIndex = {};
    bookingIndex = {};
    showToast('Mémoire plateformes effacée');
    // Reset UI
    ['stAirbnbText','stBookingText'].forEach((id,i) => {
      const el = document.getElementById(id);
      if(el) el.textContent = i===0 ? 'Export Airbnb - non chargé' : 'Export Booking - non chargé';
    });
    ['dzAirbnb','dzBooking'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.remove('upload-ok');
    });
    checkReadyToMap();
  }, 'Effacer', 'var(--red)');
}

function initPeriodPicker() {
if(!document.getElementById('periodDisplay')) return;
renderPeriodDisplay();
checkPeriodConflict();
document.addEventListener('click', e => {
const popup = document.getElementById('periodPickerPopup');
if(popup && !popup.closest('.card')?.contains(e.target)) popup.style.display='none';
}, true);
}

function renderPeriodDisplay() {
const disp = document.getElementById('periodDisplay');
if(disp) disp.textContent = MONTH_FULL[_pickerMonth-1] + ' ' + _pickerYear;
renderPeriodPopup();
checkPeriodConflict();
}

function renderPeriodPopup() {
const yr = document.getElementById('periodPickerYear');
if(yr) yr.textContent = _pickerYear;
const grid = document.getElementById('periodMonths');
if(!grid) return;
const db = getDB();
grid.innerHTML = MONTH_NAMES.map((name, i) => {
const m = i + 1;
const key = _pickerYear + '-' + String(m).padStart(2,'0');
const hasDat = !!db.periods[key];
const isSel = _pickerMonth === m;
return '<button class="pmb' + (isSel?' selected':'') + (hasDat?' has-data':'') + '" onclick="selectPickerMonth(' + m + ')">' + name + '</button>';
}).join('');
}

function selectPickerMonth(m) {
_pickerMonth = m;
renderPeriodDisplay();
document.getElementById('periodPickerPopup').style.display = 'none';
}

function togglePeriodPicker() {
const p = document.getElementById('periodPickerPopup');
if(!p) return;
p.style.display = p.style.display === 'none' ? 'block' : 'none';
if(p.style.display === 'block') renderPeriodPopup();
}

function shiftPeriod(dir) {
_pickerMonth += dir;
if(_pickerMonth > 12) { _pickerMonth = 1; _pickerYear++; }
if(_pickerMonth < 1)  { _pickerMonth = 12; _pickerYear--; }
renderPeriodDisplay();
}

function shiftYear(dir) {
_pickerYear += dir;
renderPeriodPopup();
document.getElementById('periodPickerYear').textContent = _pickerYear;
}

function getSelectedPeriod() {
return _pickerYear + '-' + String(_pickerMonth).padStart(2,'0');
}

function checkPeriodConflict() {
const db = getDB();
const p = getSelectedPeriod();
const el = document.getElementById('periodConflict');
if (el) el.style.display = db.periods[p] ? 'block' : 'none';
}

function saveToDatabase() {
if (!ventilLines.length) { showToast('Aucune ligne à enregistrer', '#f0566a'); return; }
const periodKey = getSelectedPeriod();
const [year, month] = periodKey.split('-');
const db = getDB();
const monthNames = [''].concat(MONTH_FULL);

db.periods[periodKey] = {
period: periodKey,
year: parseInt(year),
month: parseInt(month),
monthName: monthNames[parseInt(month)],
lines: ventilLines.map(v => ({...v, bien: v.bienName})),
linesCount: ventilLines.length,
savedAt: new Date().toISOString(),
};
saveDB(db);
_historyIndex = null; // ce mois vient d'être enregistré : le prochain pré-mapping doit en tenir compte

// Détecter les lignes Immobilisation et créer des entrées pending dans amortissements
const immoLines = ventilLines.filter(v => v.cat && v.cat.startsWith('Immobilisation - '));
if (immoLines.length) {
  const existingPending = JSON.parse(localStorage.getItem('artemis_amort_pending') || '[]');
  const existingSaved   = JSON.parse(localStorage.getItem('artemis_amort') || '[]');
  immoLines.forEach(v => {
    // Éviter les doublons : même libellé + même date + même montant
    const alreadyExists = [...existingPending, ...existingSaved].some(
      a => a._srcLibelle === v.libelle && a._srcDate === v.date && Math.abs((a._srcMontant||0) - Math.abs(parseFloat(v.montant||0))) < 0.01
    );
    if (!alreadyExists) {
      existingPending.push({
        libelle:   v.libelle || '',
        dateAchat: v.date ? (function(d){ const n=_normDateStr(d); return n.display||d; })(v.date) : '',
        valeurHT:  Math.abs(parseFloat(v.montant||0)),
        duree:     0,
        methode:   'Linéaire',
        lot:       v.lot || '',
        bienId:    v.bienId || '',
        categorie: v.cat || '',
        _srcLibelle: v.libelle,
        _srcDate:    v.date,
        _srcMontant: Math.abs(parseFloat(v.montant||0)),
        _fromImport: true,
      });
    }
  });
  localStorage.setItem('artemis_amort_pending', JSON.stringify(existingPending));
  showToast('✅ ' + monthNames[parseInt(month)] + ' ' + year + ' enregistré — ' + immoLines.length + ' immobilisation(s) à compléter dans Paramètres > Amortissements');
} else {
  showToast('✅ ' + monthNames[parseInt(month)] + ' ' + year + ' enregistré !');
}
// Détecter les lignes Location directe
const lcdLines = ventilLines.filter(v => (v.cat||v.categorie||'') === 'Location directe');
lcdLines.forEach(v => _lcdDetect(v));
goScreen(4);
renderDatabase();
renderRecentActivity();
}

function kpiCard(ic,lb,val,col){return '<div class="card kpi-card"><div class="kpi-icon">'+ic+'</div><div class="kpi-label">'+lb+'</div><div class="kpi-val" style="color:'+col+'">'+val+'</div></div>';}


function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  if (!el) return;
  const db = getDB();
  const periods = Object.values(db.periods)
    .sort((a,b) => b.period.localeCompare(a.period))
    .slice(0, 6);

  if (!periods.length) { el.innerHTML = ''; return; }

  const fmt2 = v => {
    const n = parseFloat(v||0);
    const s = Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0});
    return (n>=0?'+':'-')+' '+s+' €';
  };

  const cards = periods.map(p => {
    const rev = p.lines.filter(l=>parseFloat(l.montant||0)>0).reduce((s,l)=>s+parseFloat(l.montant||0),0);
    const chg = p.lines.filter(l=>parseFloat(l.montant||0)<0).reduce((s,l)=>s+parseFloat(l.montant||0),0);
    const net = rev + chg;
    const netPos = net >= 0;
    const pct = rev > 0 ? Math.round((rev+chg)/rev*100) : 0;

    // Status: fully mapped = all lines have cat+bien+lot
    const total = p.lines.filter(l=>!l.sourcePlatform||l.sourcePlatform==='manual').length || p.lines.length;
    const mapped = p.lines.filter(l=>l.cat&&(l.bienName||l.bien)&&l.lot).length;
    const complete = mapped >= p.linesCount;

    return `<div style="
      background:var(--bg2);
      border:1px solid var(--border);
      border-radius:12px;
      padding:16px 18px;
      display:flex;
      flex-direction:column;
      gap:10px;
      cursor:pointer;
      transition:border-color .18s,transform .18s;
      position:relative;
      overflow:hidden;
    " onmouseenter="this.style.borderColor='rgba(0,229,255,.25)';this.style.transform='translateY(-2px)'"
       onmouseleave="this.style.borderColor='var(--border)';this.style.transform='none'"
       onclick="jumpToPeriod('${p.period}')"
       title="Cliquer pour reprendre ${p.monthName} ${p.year}">

      <!-- Accent bar top -->
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${complete?'linear-gradient(90deg,var(--green),var(--cyan))':'linear-gradient(90deg,var(--gold),var(--red))'}"></div>

      <!-- Header: period + status -->
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${p.monthName} ${p.year}</div>
          <div style="font-size:10px;color:var(--text2);margin-top:1px">${p.linesCount} ligne${p.linesCount>1?'s':''}</div>
        </div>
        <span style="
          font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
          padding:3px 9px;border-radius:20px;
          background:${complete?'rgba(34,201,122,.1)':'rgba(245,183,49,.1)'};
          border:1px solid ${complete?'rgba(34,201,122,.3)':'rgba(245,183,49,.3)'};
          color:${complete?'var(--green)':'var(--gold)'};
        ">${complete?'✓ Complet':'⏳ Partiel'}</span>
      </div>

      <!-- Figures -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <div style="background:var(--bg3);border-radius:7px;padding:8px 10px">
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Revenus</div>
          <div style="font-size:12px;font-weight:700;color:var(--green);font-family:monospace">+${Math.round(rev).toLocaleString('fr-FR')} €</div>
        </div>
        <div style="background:var(--bg3);border-radius:7px;padding:8px 10px">
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Charges</div>
          <div style="font-size:12px;font-weight:700;color:var(--red);font-family:monospace">${Math.round(chg).toLocaleString('fr-FR')} €</div>
        </div>
        <div style="background:var(--bg3);border-radius:7px;padding:8px 10px">
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Net</div>
          <div style="font-size:12px;font-weight:700;color:${netPos?'var(--green)':'var(--red)'};font-family:monospace">${netPos?'+':''}${Math.round(net).toLocaleString('fr-FR')} €</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text2);margin-bottom:4px">
          <span>Mapping</span>
          <span>${mapped}/${p.linesCount}</span>
        </div>
        <div style="height:3px;background:var(--border);border-radius:2px">
          <div style="height:3px;border-radius:2px;background:${complete?'var(--green)':'var(--gold)'};width:${Math.min(100,Math.round(mapped/p.linesCount*100))}%;transition:width .4s ease"></div>
        </div>
      </div>
      <!-- Consult button -->
      <div style="margin-top:10px;display:flex;justify-content:flex-end" onclick="event.stopPropagation()">
        <button onclick="consultPeriod('${p.period}')"
          style="background:rgba(34,211,200,.07);border:1px solid rgba(34,211,200,.2);color:var(--cyan);font-size:10px;font-weight:700;letter-spacing:.05em;padding:5px 12px;border-radius:6px;cursor:pointer;font-family:inherit;transition:all .15s"
          onmouseover="this.style.background='rgba(34,211,200,.15)'"
          onmouseout="this.style.background='rgba(34,211,200,.07)'"
        >👁 Consulter</button>
      </div>
    </div>`;
  });

  el.innerHTML = `
    <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text2);display:flex;align-items:center;gap:8px">
        <span style="display:block;width:3px;height:13px;background:var(--cyan);border-radius:2px"></span>
        Activité récente
      </div>
      <span style="font-size:10px;color:var(--text3)">${periods.length} période${periods.length>1?'s':''} · cliquer pour reprendre</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${cards.join('')}
    </div>`;
}

function jumpToPeriod(periodKey) {
  const db = getDB();
  const p = db.periods[periodKey];
  if (!p) return;
  const [y, m] = periodKey.split('-');
  _pickerYear = parseInt(y); _pickerMonth = parseInt(m); renderPeriodDisplay();
  navTo(4);
  showToast('📅 ' + p.monthName + ' ' + p.year);
}

function consultPeriod(periodKey) {
  const db = getDB();
  const p = db.periods[periodKey];
  if (!p) return;

  const lines = p.lines || [];
  const MONTH_NAMES = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  // Group by category for summary
  const catMap = {};
  lines.forEach(l => {
    const k = l.cat || l.categorie || 'Non catégorisé';
    if (!catMap[k]) catMap[k] = { count:0, total:0, n2: l.n2 || '' };
    catMap[k].count++;
    catMap[k].total += +l.montant || 0;
  });

  const rows = lines.map((l, i) => {
    const amt = +l.montant || 0;
    const cls = amt >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    const schema = SCHEMA[l.cat||''] || {};
    return `<tr>
      <td style="color:var(--text2);font-size:10px">${l.date||''}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${(l.full||l.libelle||'').replace(/"/g,'')}">${l.full||l.libelle||'-'}</td>
      <td><span style="background:rgba(34,211,200,.08);border:1px solid rgba(34,211,200,.15);color:var(--cyan);font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px">${l.cat||'-'}</span></td>
      <td style="font-size:10px;color:var(--text2)">${schema.n2||''}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700;${cls}">${amt>=0?'+':''}${(()=>{const _v=amt;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()} €</td>
      <td style="font-size:10px;color:var(--text2)">${l.bienName||l.bien||'-'}</td>
    </tr>`;
  }).join('');

  const total = lines.reduce((s,l)=>s+(+l.montant||0),0);
  const totalCA = lines.filter(l=>_isCA(l)).reduce((s,l)=>s+(+l.montant),0);
  const totalChg = lines.filter(l=>{ const s=SCHEMA[l.cat||'']; return s&&s.n1==="Compte de résultat"&&s.n2!=="Produits d'exploitation"; }).reduce((s,l)=>s+(+l.montant),0);

  const modal = document.getElementById('consultModal');
  const body  = document.getElementById('consultBody');
  if (!modal || !body) return;

  document.getElementById('consultTitle').textContent = (MONTH_NAMES[p.month]||'') + ' ' + p.year + ' - ' + lines.length + ' opérations';
  document.getElementById('consultSummary').innerHTML = `
    <span style="margin-right:16px">💰 <b style="color:var(--green)">CA : +${(()=>{const _v=totalCA;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()} €</b></span>
    <span style="margin-right:16px">📉 <b style="color:var(--red)">Charges : ${(()=>{const _v=totalChg;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()} €</b></span>
    <span>⚖️ <b style="color:${total>=0?'var(--cyan)':'var(--red)'}">Net : ${total>=0?'+':''}${(()=>{const _v=total;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()} €</b></span>
  `;
  body.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:var(--bg3);border-bottom:1px solid var(--border)">
          <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap">DATE</th>
          <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">LIBELLÉ</th>
          <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">CATÉGORIE</th>
          <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">TYPE</th>
          <th style="padding:8px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">MONTANT</th>
          <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">BIEN</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  modal.style.display = 'flex';
}

function closeConsultModal() {
  const m = document.getElementById('consultModal');
  if (m) m.style.display = 'none';
}

// ── Diagnostic trésorerie ──────────────────────────────────────
function openDiagTreso() {
  const db = getDB();
  const bienSel = _msGetVals('syn-bien');
  const dateMin = _getV('syn-date-min');
  const dateMax = _getV('syn-date-max');

  const allLines = _synLines();

  // Reconstituer le solde ligne par ligne
  const rows = allLines.map(l => ({
    date:    l.date || '',
    bien:    l.bienName || l.bien || '?',
    cat:     l.cat || '?',
    n2:      l.n2 || (SCHEMA[l.cat||'']?.n2) || '?',
    libelle: (l.libelle||'').slice(0,40),
    montant: +(+l.montant).toFixed(2),
  })).sort((a,b) => a.date.localeCompare(b.date));

  const total = rows.reduce((s,r) => s + r.montant, 0);

  // Construire le HTML
  const rowsHtml = rows.map(r => {
    const cls = r.montant >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    return `<tr style="border-bottom:1px solid var(--border);font-size:10px">
      <td style="padding:4px 6px;color:var(--text2);font-family:monospace;white-space:nowrap">${_normDateStr(r.date).display}</td>
      <td style="padding:4px 6px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.bien}</td>
      <td style="padding:4px 6px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${r.cat}</td>
      <td style="padding:4px 6px;color:var(--text2);white-space:nowrap;font-size:9px">${r.n2}</td>
      <td style="padding:4px 6px;text-align:right;font-family:monospace;font-weight:600;${cls};white-space:nowrap">${r.montant>=0?'+':''}${r.montant.toFixed(2)} €</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);z-index:9998;display:flex;align-items:center;justify-content:center" id="diagTresoModal">
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:14px;width:90vw;max-width:820px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div>
            <div style="font-size:13px;font-weight:700">🔍 Diagnostic Trésorerie</div>
            <div style="font-size:10px;color:var(--text2);margin-top:2px">${rows.length} lignes · Filtre bien : ${bienSel.length ? bienSel.join(', ') : 'Tous'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:13px;font-weight:700;color:${total>=0?'var(--cyan)':'var(--red)'}">${total>=0?'+':''}${total.toFixed(2)} €</span>
            <button onclick="document.getElementById('diagTresoModal').remove()" style="background:none;border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;padding:4px 10px;cursor:pointer">✕ Fermer</button>
          </div>
        </div>
        <div style="overflow-y:auto;flex:1">
          <table style="width:100%;border-collapse:collapse">
            <thead style="position:sticky;top:0;background:var(--bg3);z-index:1">
              <tr style="font-size:9px;color:var(--text2);font-weight:700;letter-spacing:.07em;text-transform:uppercase">
                <th style="padding:6px 6px;text-align:left">Date</th>
                <th style="padding:6px 6px;text-align:left">Bien</th>
                <th style="padding:6px 6px;text-align:left">Catégorie</th>
                <th style="padding:6px 6px;text-align:left">N2</th>
                <th style="padding:6px 6px;text-align:right">Montant</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr style="background:var(--bg3);font-weight:700;font-size:11px">
                <td colspan="4" style="padding:8px 6px">TOTAL (${rows.length} lignes)</td>
                <td style="padding:8px 6px;text-align:right;font-family:monospace;color:${total>=0?'var(--cyan)':'var(--red)'}">${total>=0?'+':''}${total.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}


function renderDatabase() {
const db = getDB();
const periods = Object.values(db.periods).sort((a,b) => b.period.localeCompare(a.period));

const allLines = periods.flatMap(p => p.lines);
const totalRev = allLines.filter(l => parseFloat(l.montant||0) > 0).reduce((s,l) => s + parseFloat(l.montant||0), 0);
const totalChg = allLines.filter(l => parseFloat(l.montant||0) < 0).reduce((s,l) => s + parseFloat(l.montant||0), 0);
const net = totalRev + totalChg;
document.getElementById('dbSummaryCards').innerHTML = [
['💰', 'Revenus cumulés', '+' + fmt(totalRev), 'var(--green)'],
['📉', 'Charges cumulées', fmt(totalChg), 'var(--red)'],
['📊', 'Résultat net', (net>=0?'+':'') + fmt(net), net>=0?'var(--green)':'var(--red)'],
['📅', 'Périodes', periods.length + ' mois', 'var(--cyan)'],
].map(([ic,lb,val,col])=>kpiCard(ic,lb,val,col)).join('');

if (!periods.length) {
document.getElementById('dbPeriodList').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-size:13px">Aucune période enregistrée.<br>Commence par importer et valider un mois.</div>';
return;
}

document.getElementById('dbPeriodList').innerHTML = periods.map(p => {
const rev = p.lines.filter(l => parseFloat(l.montant||0)>0).reduce((s,l)=>s+parseFloat(l.montant||0),0);
const chg = p.lines.filter(l => parseFloat(l.montant||0)<0).reduce((s,l)=>s+parseFloat(l.montant||0),0);
const net = rev + chg;
return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);gap:12px"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:13px;font-weight:700;color:var(--cyan)">${p.period}</div><div style="font-size:13px;color:var(--text1)">${p.monthName} ${p.year}</div><div style="font-size:11px;color:var(--text2)">${p.linesCount} lignes</div></div><div style="display:flex;gap:16px;align-items:center"><span style="font-size:12px;color:var(--green)">+${fmt(rev)}</span><span style="font-size:12px;color:var(--red)">${fmt(chg)}</span><span style="font-size:13px;font-weight:700;color:${net>=0?'var(--green)':'var(--red)'}">${net>=0?'+':''}${fmt(net)}</span><button class="btn btn-outline" style="font-size:10px;padding:4px 10px;border-color:rgba(34,211,200,.2);color:var(--cyan)" onclick="consultPeriod('${p.period}')">👁 Consulter</button><button class="btn btn-outline" style="font-size:10px;padding:4px 10px;border-color:rgba(240,86,106,.3);color:#f0566a" onclick="deletePeriod('${p.period}')">✕</button><button class="btn btn-outline" style="font-size:10px;padding:4px 10px;border-color:rgba(0,229,255,.3);color:var(--cyan)" onclick="editPeriod('${p.period}')">✎ Éditer</button></div></div>`;
}).join('');
}


function askConfirm(msg, onYes, yesLabel, yesColor) {
  const modal = document.getElementById('confirmModal');
  const msgEl  = document.getElementById('confirmMsg');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn  = document.getElementById('confirmNo');
  msgEl.textContent = msg;
  if (yesLabel) yesBtn.textContent = yesLabel;
  if (yesColor) { yesBtn.style.background = yesColor; yesBtn.style.borderColor = yesColor; }
  modal.style.display = 'flex';
  const close = () => { modal.style.display = 'none'; yesBtn.onclick = null; noBtn.onclick = null; };
  yesBtn.onclick = () => { close(); onYes(); };
  noBtn.onclick  = close;
  modal.onclick  = e => { if(e.target===modal) close(); };
}
function deletePeriod(key) {
  askConfirm('Supprimer la période ' + key + ' ?', () => {
    const db = getDB();
    delete db.periods[key];
    saveDB(db);
    renderDatabase();
    renderRecentActivity();
    showToast('Période supprimée');
  }, 'Supprimer', 'var(--red)');
}

function clearDatabase() {
  askConfirm('Vider toute la base ?\nCette action est irréversible.', () => {
    localStorage.removeItem(DB_KEY);
    renderDatabase();
    renderRecentActivity();
    showToast('Base vidée');
  }, 'Vider', 'var(--red)');
}

function exportDatabase() {
  const db   = getDB();
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'artemis-database-' + new Date().toISOString().slice(0,10) + '.json';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
  showToast('✅ Export JSON téléchargé');
}

function editPeriod(key) {
  const db = getDB();
  const p  = db.periods[key];
  if (!p) { showToast('Période introuvable', '#f0566a'); return; }
  openEditModal(key);
}

function openEditModal(periodKey) {
  const db = getDB();
  const p  = db.periods[periodKey];
  if (!p) return;

  const MONTH_NAMES = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const cats = typeof CATS !== 'undefined' ? CATS : Object.keys(SCHEMA).sort();
  const biens = (getParams().biens || []);
  const scis  = (getParams().scis  || []);

  const rows = (p.lines || []).map((l, i) => {
    const amt = +l.montant || 0;
    const amtCls = amt >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    const catOpts = cats.map(c => `<option value="${c}" ${c===l.cat?'selected':''}>${c}</option>`).join('');
    const bienOpts = ['Frais généraux',...biens.map(b=>b.name)].map(b=>`<option value="${b}" ${b===(l.bienName||l.bien||'')?'selected':''}>${b}</option>`).join('');
    return `<tr id="erow-${i}" style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 8px;color:var(--text2);font-size:10px;white-space:nowrap">${l.date||''}</td>
      <td style="padding:6px 8px;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(l.full||l.libelle||'').replace(/"/g,'')}">${l.full||l.libelle||'-'}</td>
      <td style="padding:6px 4px">
        <select data-idx="${i}" data-field="cat" onchange="_editLineChange(this,'${periodKey}')"
          style="background:var(--bg3);border:1px solid var(--border2);color:var(--cyan);font-size:10px;padding:3px 4px;border-radius:4px;width:100%">
          <option value="">-</option>${catOpts}
        </select>
      </td>
      <td style="padding:6px 4px">
        <select data-idx="${i}" data-field="bien" onchange="_editLineChange(this,'${periodKey}')"
          style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);font-size:10px;padding:3px 4px;border-radius:4px;width:100%">
          <option value="">-</option>${bienOpts}
        </select>
      </td>
      <td style="padding:6px 4px">
        <select data-idx="${i}" data-field="lot" onchange="_editLineChange(this,'${periodKey}')"
          style="background:var(--bg3);border:1px solid rgba(245,183,49,.3);color:var(--gold);font-size:10px;padding:3px 4px;border-radius:4px;width:100%">
          <option value="">-</option>${lotOptions(l.lot, getParams())}
        </select>
      </td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:700;font-size:11px;${amtCls}">${amt>=0?'+':''}${(()=>{const _v=amt;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()} €</td>
    </tr>`;
  }).join('');

  const modal = document.getElementById('editLineModal');
  if (!modal) return;
  document.getElementById('editLineTitle').textContent = (MONTH_NAMES[p.month]||'') + ' ' + p.year + ' - ' + (p.lines||[]).length + ' lignes';
  document.getElementById('editLineBody').innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3);border-bottom:1px solid var(--border)">
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">DATE</th>
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">LIBELLÉ</th>
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">CATÉGORIE</th>
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">BIEN</th>
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--gold)">LOT</th>
        <th style="padding:7px 8px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2)">MONTANT</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  modal.style.display = 'flex';
  modal.dataset.periodKey = periodKey;
}

function _editLineChange(sel, periodKey) {
  const db   = getDB();
  const p    = db.periods[periodKey];
  if (!p) return;
  const idx   = parseInt(sel.dataset.idx);
  const field = sel.dataset.field;
  const val   = sel.value;
  if (!p.lines[idx]) return;

  if (field === 'cat') {
    p.lines[idx].cat = val;
    p.lines[idx].categorie = val;
    const schema = SCHEMA[val] || {};
    Object.assign(p.lines[idx], schema); // update n1,n2,ebit,etc
  } else if (field === 'bien') {
    const biens = getParams().biens || [];
    const b = biens.find(x => x.name === val);
    p.lines[idx].bienName = val;
    p.lines[idx].bien     = val;
    if (b) {
      p.lines[idx].bienId = b.id;
      p.lines[idx].sci = b.sci;
      p.lines[idx].isFG = false;
    } else if (val === 'Frais généraux' || val === 'Frais generaux') {
      p.lines[idx].isFG = true;
      p.lines[idx].bienId = null;
      p.lines[idx].sci = null;
    }
  } else if (field === 'lot') {
    p.lines[idx].lot = val;
  }
  saveDB(db);

  // Si la nouvelle catégorie est une immobilisation, créer ou mettre à jour l'entrée pending
  if (field === 'cat' && val && val.startsWith('Immobilisation - ')) {
    const line = p.lines[idx];
    const montantReel = Math.abs(parseFloat(line.montantOrigine || line.montant || 0));
    const existingPending = JSON.parse(localStorage.getItem('artemis_amort_pending') || '[]');
    const existingSaved   = JSON.parse(localStorage.getItem('artemis_amort') || '[]');
    // Chercher une entrée existante sur libellé + date (peu importe le montant)
    const matchIdx = existingPending.findIndex(a => a._srcLibelle === line.libelle && a._srcDate === line.date);
    const matchSavedIdx = existingSaved.findIndex(a => a._srcLibelle === line.libelle && a._srcDate === line.date);
    if (matchIdx >= 0) {
      // Mettre à jour l'entrée pending existante
      existingPending[matchIdx].valeurHT    = montantReel;
      existingPending[matchIdx]._srcMontant = montantReel;
      existingPending[matchIdx].categorie   = val;
      existingPending[matchIdx]._fromImport = true;
      localStorage.setItem('artemis_amort_pending', JSON.stringify(existingPending));
      showToast('✓ Immobilisation mise à jour dans Amortissements', 'var(--gold)');
    } else if (matchSavedIdx >= 0) {
      // Mettre à jour l'entrée sauvegardée et la repasser en pending
      existingSaved[matchSavedIdx].valeurHT    = montantReel;
      existingSaved[matchSavedIdx]._srcMontant = montantReel;
      existingSaved[matchSavedIdx].categorie   = val;
      existingSaved[matchSavedIdx]._fromImport = true;
      localStorage.setItem('artemis_amort', JSON.stringify(existingSaved));
      showToast('✓ Immobilisation mise à jour dans Amortissements', 'var(--gold)');
    } else {
      // Créer une nouvelle entrée
      existingPending.push({
        libelle:     line.libelle || '',
        dateAchat:   line.date ? _normDateStr(line.date).display || line.date : '',
        valeurHT:    montantReel,
        duree:       0,
        methode:     'Linéaire',
        lot:         line.lot || '',
        bienId:      line.bienId || '',
        categorie:   val,
        _srcLibelle: line.libelle,
        _srcDate:    line.date,
        _srcMontant: montantReel,
        _fromImport: true,
      });
      localStorage.setItem('artemis_amort_pending', JSON.stringify(existingPending));
      showToast('✓ Ligne modifiée — immobilisation à compléter dans Amortissements', 'var(--gold)');
    }
  } else {
    // Vérifier si la nouvelle catégorie est Location directe
    if (field === 'cat' && val === 'Location directe') {
      const line = p.lines[idx];
      const detected = _lcdDetect(line);
      if (detected) showToast('✓ Ligne modifiée — location directe à compléter dans LCD', 'var(--cyan)');
      else showToast('✓ Ligne modifiée et sauvegardée');
    } else {
      showToast('✓ Ligne modifiée et sauvegardée');
    }
  }

  // Refresh dashboard silently in background
  try { _renderDashTab(); } catch(e) {}
  try { if (typeof renderRecentActivity === 'function') renderRecentActivity(); } catch(e) {}
  // Show saved indicator on row
  const row = document.getElementById('erow-' + idx);
  if (row) { row.style.background = 'rgba(34,211,200,.06)'; setTimeout(()=>row.style.background='',1200); }
}

function closeEditLineModal() {
  const m = document.getElementById('editLineModal');
  if (m) m.style.display = 'none';
  renderDatabase(); // refresh list after edits
  // Refresh dashboard & home if visible
  try { _renderDashTab(); } catch(e) {}
  try { if (typeof renderRecentActivity === 'function') renderRecentActivity(); } catch(e) {}
}
function _doEditPeriod(key) {
  const db = getDB();
  const p  = db.periods[key];
  if (!p) { showToast('Période introuvable', '#f0566a'); return; }

  // ── Reconstruire les bankRows (1 ligne par transaction bancaire d'origine) ──
  // Les ventilLines sauvegardées peuvent avoir plusieurs entrées par transaction
  // (ex: Airbnb ventilé sur N biens, ou emprunt multi-SCI).
  // On regroupe par date+libelle+montantOrigine pour retrouver les transactions uniques.
  const txMap = new Map(); // clé → première ligne sauvegardée représentative
  p.lines.forEach(l => {
    const amt = parseFloat(l.montantOrigine || l.montant || 0);
    const k   = (l.date||'') + '|' + (l.libelle||'') + '|' + amt;
    if (!txMap.has(k)) txMap.set(k, l);
  });

  bankRows = Array.from(txMap.values()).map(l => ({
    date:    l.date,
    libelle: l.libelle,
    full:    l.full || l.libelle,
    montant: parseFloat(l.montantOrigine || l.montant || 0),
  }));

  // Trier par date pour retrouver l'ordre original
  bankRows.sort((a, b) => _normDateStr(a.date).sort.localeCompare(_normDateStr(b.date).sort));

  if (!bankRows.length) { showToast('Aucune ligne à restaurer', '#f0566a'); return; }

  const [year, month] = key.split('-');
  _pickerYear  = parseInt(year);
  _pickerMonth = parseInt(month);
  renderPeriodDisplay();
  restorePlatformIndexes(true); // reload Airbnb/Booking silently before enriching
  enrichBankRows(); // reconstructs rowMeta from bankRows

  // ── Restaurer les valeurs de mapping sur chaque rowMeta ──
  // Pour les lignes manuelles : retrouver par date+libelle
  // Pour Airbnb/Booking/Loan : enrichBankRows les a déjà détectés via les libellés
  rowMeta.forEach((row, i) => {
    // Trouver une ligne sauvegardée correspondant à cette transaction
    const match = p.lines.find(l => {
      const amt = parseFloat(l.montantOrigine || l.montant || 0);
      return l.date === row.date &&
             l.libelle === row.libelle &&
             Math.abs(amt - Math.abs(row.montant)) < 0.01;
    });
    if (!match) return;

    // Pour les lignes manuelles, restaurer cat/sci/bien/lot
    if (!row.isAirbnb && !row.isBooking && !row.isLoan) {
      row._cat  = match.cat     || '';
      row._sci  = match.sci     || '';
      row._bien = match.bienNom || match.bienName || match.bien || '';
      row._lot  = match.lot     || '';
      row._conf = 'high';
      row._fromHistory = true;
    }
  });

  buildMappingTable();
  goScreen(2);
  showToast('✎ Édition de ' + key + ' · ' + bankRows.length + ' lignes');
}


