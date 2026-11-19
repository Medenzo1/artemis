// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Calendrier
//  Deux vues : « Mois » (agenda des événements) et « Planning »
//  (occupation par bien, façon tableau de réservations).
//  Sources (lecture seule) : réservations importées Airbnb / Booking,
//  locations directes, tableaux d'emprunt, opérations bancaires
//  importantes, rappels (import du mois, budget).
// ════════════════════════════════════════════════════════════════

const HCAL_COL = { airbnb: '#ff5a5f', booking: '#2f74f0', direct: '#16a35f', blocked: '#9aa0a6', loan: '#7c5cf5', op: '#8d7f84', todo: 'var(--acc)' };
const HCAL_LBL = { airbnb: 'Airbnb', booking: 'Booking', direct: 'Direct', blocked: 'Bloqué', loan: 'Échéance de prêt', op: 'Opération bancaire', todo: 'Rappel' };
// Libellés de séjour : voyageur, personnes et prix quand Smoobu les fournit
function hcalStayWho(s) { return s.guest ? ' — ' + s.guest : ''; }
function hcalStaySub(s, extra) {
  const parts = [s.channel || HCAL_LBL[s.src] || ''];
  if (extra) parts.push(extra); else parts.push(s.nuits + ' nuit' + (s.nuits > 1 ? 's' : ''));
  const pers = (s.adults || 0) + (s.children || 0);
  if (pers) parts.push(pers + ' pers.');
  if (s.price != null && s.price !== '') parts.push(hEur(+s.price) + (s.paid ? ' payé' : ''));
  return parts.filter(Boolean).join(' · ');
}
const HCAL_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const _hcal = { month: null, view: 'month', bien: 'all', day: null, show: { user: true, stays: true, loan: true, op: true, todo: true } };

function hcalISO(d) {
  if (!d) return '';
  if (d instanceof Date) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  try { const s = _normDateStr(d).sort || ''; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; } catch (e) { return ''; }
}
function hcalAdd(iso, n) { const [y, m, d] = iso.split('-').map(Number); return hcalISO(new Date(y, m - 1, d + n)); }
function hcalToday() { return hcalISO(new Date()); }

// ── Données ──
function hcalBienOf(logement) {
  const p = getParams();
  const lg = String(logement || '');
  const id = (typeof AIRBNB_MAP_LIVE !== 'undefined' && AIRBNB_MAP_LIVE) ? AIRBNB_MAP_LIVE[lg] : null;
  const b = (p.biens || []).find(x => (id && x.id === id) || x.name === lg || x.nom === lg || (lg && (lg.includes(x.name) || (x.nom && lg.includes(x.nom)))));
  return b ? b.name : (lg || 'Logement inconnu');
}
function hcalStays() {
  const out = [];
  try {
    (typeof _getReservations === 'function' ? _getReservations() : []).forEach(r => {
      const a = hcalISO(r.dateDebut), n = parseInt(r.nuits) || 0;
      if (!a || n <= 0) return;
      const z = hcalISO(r.dateFin) || hcalAdd(a, n);
      out.push({ src: r.source === 'booking' ? 'booking' : 'airbnb', bien: hcalBienOf(r.logement), start: a, end: z > a ? z : hcalAdd(a, n), nuits: n, code: r.codeConf || '' });
    });
  } catch (e) {}
  try {
    JSON.parse(localStorage.getItem('artemis_lcd') || '[]').forEach(r => {
      const a = hcalISO(r.dateDebut), n = parseInt(r.nuits) || 0;
      if (!a || n <= 0) return;
      out.push({ src: 'direct', bien: r.bienName || 'Location directe', start: a, end: hcalAdd(a, n), nuits: n, montant: +r.montant || 0 });
    });
  } catch (e) {}
  return out;
}
function hcalEvents(month) {
  const ev = [];
  const p = getParams();
  const db = getDB();
  // Échéances de prêt (tableau d'amortissement importé) : jour tiré du dernier prélèvement connu
  try {
    const lastDay = {};
    Object.values(db.periods || {}).forEach(per => (per.lines || []).forEach(l => {
      if (l.loanRef) { const d = hcalISO(l.date); if (d && (!lastDay[l.loanRef] || d > lastDay[l.loanRef].d)) lastDay[l.loanRef] = { d }; }
    }));
    (p.loans || []).forEach(L => {
      let row = (typeof LOAN_TABLE_LIVE !== 'undefined' && LOAN_TABLE_LIVE[L.ref] || {})[month];
      if (!row) Object.entries((p.loanTable || {})[L.ref] || {}).forEach(([k, v]) => {
        const ym = typeof _parseYM === 'function' ? String(_parseYM(k) || '').slice(0, 7) : String(k).slice(0, 7);
        if (ym === month) row = v;
      });
      if (!row) return;
      const amt = (Array.isArray(row) ? row : [row]).reduce((s, v) => s + (+v || 0), 0);
      const day = lastDay[L.ref] ? +lastDay[L.ref].d.slice(8) : 5;
      const dim = new Date(+month.slice(0, 4), +month.slice(5), 0).getDate();
      ev.push({ date: month + '-' + String(Math.min(day, dim)).padStart(2, '0'), type: 'loan', label: L.label || ('Prêt ' + L.ref), sub: 'Échéance · ' + hEur(amt), amount: amt });
    });
  } catch (e) {}
  // Opérations bancaires importantes du mois (hors loyers, plateformes, crédits)
  try {
    const per = db.periods && db.periods[month];
    (per ? per.lines || [] : []).forEach(l => {
      const v = +l.montant || 0, cat = l.cat || l.categorie || '';
      if (Math.abs(v) < 300 || l.loanRef || /airbnb|booking|loyer|stripe|emprunt|intérêts/i.test(cat)) return;
      const d = hcalISO(l.date);
      if (d && d.startsWith(month)) ev.push({ date: d, type: 'op', label: cat || l.libelle || 'Opération', sub: hEur(v, true) + (l.bienName || l.bien ? ' · ' + (l.bienName || l.bien) : ''), amount: v });
    });
  } catch (e) {}
  // Rappels
  try {
    const keys = Object.keys(db.periods || {}).sort();
    const prev = hShift(month, -1);
    const today = hcalToday();
    if (month >= today.slice(0, 7) && !keys.includes(prev) && (!keys.length || prev > keys[keys.length - 1])) {
      ev.push({ date: month + '-05', type: 'todo', label: 'Importer ' + hMonthLbl(prev), sub: 'Relevé bancaire et exports du mois', go: "haloGo('import')" });
    }
    if (month.slice(5) === '10') {
      const ny = +month.slice(0, 4) + 1;
      if (typeof budRefVersion === 'function' && !budRefVersion(ny)) ev.push({ date: month + '-15', type: 'todo', label: 'Préparer le budget ' + ny, sub: 'Repartir du réel et ajuster en %', go: "haloGo('budget')" });
    }
  } catch (e) {}
  return ev;
}

// ── Écran ──
function hcalEnsureScreen() {
  let el = document.getElementById('calendarScreen');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'calendarScreen';
  el.style.display = 'none';
  el.innerHTML = '<div class="hov-top hs-top"><div><div class="hov-title"><b>Calendrier</b><small>Séjours, échéances et rappels de votre patrimoine</small></div></div>'
    + '<div class="hpage-actions" id="hcal-actions"></div></div><div id="hcal-content"></div>';
  (document.getElementById('mainContent') || document.body).appendChild(el);
  return el;
}
function showCalendar() {
  const el = hcalEnsureScreen();
  const hs = document.getElementById('homeScreen'); if (hs) hs.style.display = 'none';
  el.style.display = 'block'; el.scrollTop = 0;
  if (!_hcal.month) _hcal.month = hcalToday().slice(0, 7);
  hcalRender();
}
function hcalNav(d) { _hcal.month = d === 0 ? hcalToday().slice(0, 7) : hShift(_hcal.month, d); _hcal.day = null; hcalRender('month'); }
// Clic sur un jour : seul le panneau de droite et la case sélectionnée changent (pas de rechargement)
function hcalSet(k, v) {
  if (k === 'day') { _hcal.day = (v === _hcal.day ? null : v); return hcalRender('day'); }
  _hcal[k] = v; _hcal.day = null; hcalRender(k === 'month' ? 'month' : 'soft');
}
function hcalToggle(k) { _hcal.show[k] = !_hcal.show[k]; hcalRender('soft'); }

function hcalRender(mode) {
  const box = document.getElementById('hcal-content');
  if (!box) return;
  const m = _hcal.month, [Y, M] = m.split('-').map(Number);
  const first = m + '-01', dim = new Date(Y, M, 0).getDate(), last = m + '-' + String(dim).padStart(2, '0');
  const p = getParams();
  const allStays = hcalStays();
  const stays = allStays.filter(s => s.start <= last && s.end > first && (_hcal.bien === 'all' || s.bien === _hcal.bien));
  const events = hcalEvents(m).filter(e => _hcal.bien === 'all' || !e.sub || e.type === 'loan' || e.type === 'todo' || (e.sub || '').includes(_hcal.bien));
  events.push(...hcalUserForMonth(m).filter(e => _hcal.bien === 'all' || !e.bien || e.bien === _hcal.bien));
  const biensLCD = (p.biens || []).filter(b => (b.mode || b.type) === 'LCD').map(b => b.name);
  const biensList = [...new Set([...(p.biens || []).map(b => b.name), ...allStays.map(s => s.bien)])];

  // Barre d'actions
  const act = document.getElementById('hcal-actions');
  if (act) act.innerHTML = '<button class="hbtn hbtn-dark" onclick="hcalEdit(null, _hcal.day)">' + hIco('plus', 15) + 'Événement</button><div class="hseg">' + [['month', 'Mois'], ['planning', 'Planning']].map(([v, l]) => '<button class="' + (_hcal.view === v ? 'on' : '') + '" onclick="hcalSet(\'view\',\'' + v + '\')">' + l + '</button>').join('') + '</div>'
    + '<select class="sel hcal-sel" onchange="hcalSet(\'bien\', this.value)"><option value="all">Tous les biens</option>' + biensList.map(b => '<option value="' + hEsc(b) + '"' + (_hcal.bien === b ? ' selected' : '') + '>' + hEsc(b) + '</option>').join('') + '</select>';

  // Résumé du mois
  const nightsIn = s => { const a = s.start < first ? first : s.start, z = s.end > hcalAdd(last, 1) ? hcalAdd(last, 1) : s.end; return Math.max(0, Math.round((new Date(z) - new Date(a)) / 864e5)); };
  const nights = stays.reduce((t, s) => t + nightsIn(s), 0);
  const nbL = _hcal.bien === 'all' ? Math.max(1, biensLCD.length) : 1;
  const occ = nights / (dim * nbL) * 100;
  const arrivals = stays.filter(s => s.start >= first && s.start <= last).length;
  const loans = events.filter(e => e.type === 'loan');

  const head = '<div class="hcal-head"><div class="hcal-nav"><button class="hbtn hbtn-light hcal-arrow" onclick="hcalNav(-1)" aria-label="Mois précédent">' + hIco('chevron-left', 16) + '</button>'
    + '<h2>' + hMonthLbl(m).replace(/^./, c => c.toUpperCase()) + '</h2><button class="hbtn hbtn-light hcal-arrow" onclick="hcalNav(1)" aria-label="Mois suivant">' + hIco('chevron-right', 16) + '</button>'
    + '<button class="hbtn hbtn-light" onclick="hcalNav(0)">Aujourd\'hui</button></div>'
    + '<div class="hcal-legend">' + [['user', 'Événements', 'var(--ink)'], ['stays', 'Séjours', 'linear-gradient(90deg,#ff5a5f,#2f74f0,#16a35f)'], ['loan', 'Échéances', HCAL_COL.loan], ['op', 'Opérations', HCAL_COL.op], ['todo', 'Rappels', 'var(--acc)']]
      .map(([k, l, c]) => '<button class="' + (_hcal.show[k] ? 'on' : '') + '" onclick="hcalToggle(\'' + k + '\')"><i style="background:' + c + '"></i>' + l + '</button>').join('') + '</div></div>';

  const kpi = (ico, v, l, krgb) => '<div class="hg hh-kpi hk hcal-kpi" style="--krgb:' + krgb + '"><span class="hh-kpi-ico">' + hIco(ico, 16) + '</span><div><b>' + v + '</b><small>' + l + '</small></div></div>';
  const kpis = '<div class="hcal-kpis">' + kpi('bed-double', nights.toLocaleString('fr-FR'), 'nuits réservées', '255,90,95')
    + kpi('percent', (biensLCD.length || _hcal.bien !== 'all' ? hPct(occ) : '—'), 'occupation courte durée', '47,116,240')
    + kpi('calendar', arrivals, 'arrivées dans le mois', '22,163,95')
    + kpi('landmark', loans.length ? hEur(loans.reduce((t, e) => t + (e.amount || 0), 0)) : '—', 'échéances de prêt', '124,92,245') + '</div>';

  let body = _hcal.view === 'planning' ? hcalPlanning(m, dim, stays, biensLCD) : hcalMonth(m, dim, stays, events);

  // Aucun séjour ce mois-ci : proposer d'aller au dernier mois connu
  let empty = '';
  if (!stays.length && allStays.length) {
    const lastStay = allStays.map(s => s.start).sort().pop().slice(0, 7);
    if (lastStay !== m) empty = '<div class="hcal-empty">' + hIco('info', 15) + '<span>Aucun séjour importé pour ce mois. Les réservations arrivent avec les exports Airbnb / Booking.</span><button class="hbtn hbtn-light" onclick="hcalSet(\'month\',\'' + lastStay + '\')">Voir ' + hMonthLbl(lastStay) + '</button></div>';
  } else if (!allStays.length) {
    empty = '<div class="hcal-empty">' + hIco('info', 15) + '<span>Aucune réservation importée pour l\'instant : importez un export Airbnb ou Booking pour voir les séjours ici.</span><button class="hbtn hbtn-light" onclick="haloGo(\'import\')">Importer</button></div>';
  }

  if (mode === 'day' && box.querySelector('.hcal-side')) {
    box.querySelectorAll('.hcal-cell[data-d]').forEach(c => c.classList.toggle('sel', c.dataset.d === _hcal.day));
    box.querySelector('.hcal-side').outerHTML = hcalSide(m, stays, events);
    return;
  }
  box.innerHTML = head + kpis + empty + '<div class="hcal-main' + (_hcal.view === 'planning' ? ' plan' : '') + (mode === 'month' ? ' hcal-swap' : '') + '">' + body + hcalSide(m, stays, events) + '</div>';
}

// Vue Mois : grille 7 colonnes
function hcalMonth(m, dim, stays, events) {
  const [Y, M] = m.split('-').map(Number);
  const startDow = (new Date(Y, M - 1, 1).getDay() + 6) % 7;
  const today = hcalToday();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(m + '-' + String(d).padStart(2, '0'));
  while (cells.length % 7) cells.push(null);
  const byDay = {};
  const push = (d, it) => (byDay[d] = byDay[d] || []).push(it);
  if (_hcal.show.stays) stays.forEach(s => {
    if (s.start.startsWith(m)) push(s.start, { c: HCAL_COL[s.src], t: '→ ' + s.bien, k: 0 });
    if (s.end.startsWith(m)) push(s.end, { c: HCAL_COL[s.src], t: '← ' + s.bien, k: 1, out: true });
  });
  events.forEach(e => { if (_hcal.show[e.type]) push(e.date, { c: e.color || HCAL_COL[e.type], t: (e.time ? e.time + ' ' : '') + e.label, k: e.type === 'user' ? -2 : e.type === 'todo' ? -1 : 2, id: e.id }); });
  const occBy = {};
  if (_hcal.show.stays) stays.forEach(s => { for (let d = s.start; d < s.end; d = hcalAdd(d, 1)) if (d.startsWith(m)) occBy[d] = (occBy[d] || 0) + 1; });
  let html = '<section class="hg hcal-month"><div class="hcal-dow">' + HCAL_DAYS.map(d => '<span>' + d + '</span>').join('') + '</div><div class="hcal-grid">';
  cells.forEach(d => {
    if (!d) { html += '<div class="hcal-cell off"></div>'; return; }
    const its = (byDay[d] || []).sort((a, b) => a.k - b.k);
    const occ = occBy[d] || 0;
    html += '<button data-d="' + d + '" class="hcal-cell' + (d === today ? ' today' : '') + (d === _hcal.day ? ' sel' : '') + (d.slice(8) && new Date(d).getDay() % 6 === 0 ? ' we' : '') + '" onclick="hcalSet(\'day\',\'' + d + '\')" ondblclick="hcalEdit(null,\'' + d + '\')" title="Double-clic : ajouter un événement">'
      + '<span class="hcal-n">' + (+d.slice(8)) + '</span>' + (occ ? '<span class="hcal-occ" title="' + occ + ' logement(s) occupé(s)">' + hIco('bed-double', 11) + occ + '</span>' : '')
      + '<span class="hcal-its">' + its.slice(0, 3).map(it => '<i class="' + (it.out ? 'out' : '') + (it.id ? ' ev' : '') + '" style="--c:' + it.c + '"' + (it.id ? ' onclick="event.stopPropagation();hcalEdit(\'' + it.id + '\')" title="Modifier"' : '') + '>' + hEsc(it.t) + '</i>').join('') + (its.length > 3 ? '<em>+' + (its.length - 3) + ' autre' + (its.length > 4 ? 's' : '') + '</em>' : '') + '</span></button>';
  });
  return html + '</div></section>';
}

// Vue Planning : une ligne par bien, une colonne par jour
function hcalPlanning(m, dim, stays, biensLCD) {
  const first = m + '-01', today = hcalToday();
  const biens = _hcal.bien !== 'all' ? [_hcal.bien] : [...new Set([...biensLCD, ...stays.map(s => s.bien)])];
  let html = '<section class="hg hcal-plan"><div class="hcal-plan-scroll"><div class="hcal-plan-in" style="--days:' + dim + '">';
  html += '<div class="hcal-pr hcal-ph"><div class="hcal-pb">Bien</div><div class="hcal-pd">';
  for (let d = 1; d <= dim; d++) {
    const iso = m + '-' + String(d).padStart(2, '0'), dow = (new Date(iso).getDay() + 6) % 7;
    html += '<span class="' + (dow >= 5 ? 'we' : '') + (iso === today ? ' today' : '') + '"><small>' + HCAL_DAYS[dow].slice(0, 1) + '</small>' + d + '</span>';
  }
  html += '</div><div class="hcal-po">Occ.</div></div>';
  if (!biens.length) html += '<div class="hcal-none">Aucun bien en courte durée</div>';
  biens.forEach(b => {
    const ss = stays.filter(s => s.bien === b);
    let n = 0;
    const bars = ss.map(s => {
      const a = Math.max(1, s.start < first ? 1 : +s.start.slice(8));
      const endIso = s.end, endDay = endIso.slice(0, 7) > m ? dim + 1 : +endIso.slice(8);
      const span = Math.max(1, endDay - a);
      n += span;
      return '<i class="hcal-bar" style="--c:' + HCAL_COL[s.src] + ';grid-column:' + a + ' / span ' + span + '" title="' + hEsc((s.guest ? s.guest + ' · ' : '') + hcalStaySub(s) + ' · ' + s.start.split('-').reverse().join('/') + ' → ' + s.end.split('-').reverse().join('/')) + '">' + (span >= 4 && s.guest ? hEsc(s.guest.split(' ')[0]) + ' · ' + s.nuits + ' n.' : span >= 2 ? s.nuits + ' n.' : '') + '</i>';
    }).join('');
    html += '<div class="hcal-pr"><div class="hcal-pb" title="' + hEsc(b) + '">' + hEsc(b) + '</div><div class="hcal-pd hcal-pgrid">' + bars + '</div><div class="hcal-po"><b>' + Math.round(Math.min(n, dim) / dim * 100) + '%</b><small>' + n + ' n.</small></div></div>';
  });
  return html + '</div></div><div class="hcal-plan-leg">' + ['airbnb', 'booking', 'direct', 'blocked'].map(k => '<span><i style="background:' + HCAL_COL[k] + '"></i>' + HCAL_LBL[k] + '</span>').join('') + '</div></section>';
}

// Colonne de droite : détail du jour sélectionné, sinon à venir dans le mois
function hcalSide(m, stays, events) {
  const day = _hcal.day;
  const fmtD = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  let items = [];
  if (day) {
    stays.forEach(s => {
      if (s.start === day) items.push({ c: HCAL_COL[s.src], t: 'Arrivée · ' + s.bien + hcalStayWho(s), s: hcalStaySub(s) + (s.notice ? ' · « ' + s.notice.slice(0, 80) + ' »' : '') });
      else if (s.end === day) items.push({ c: HCAL_COL[s.src], t: 'Départ · ' + s.bien + hcalStayWho(s), s: hcalStaySub(s, s.checkOut ? 'départ ' + s.checkOut : '') });
      else if (s.start < day && s.end > day) items.push({ c: HCAL_COL[s.src], t: 'Occupé · ' + s.bien + hcalStayWho(s), s: hcalStaySub(s, 'jusqu\'au ' + s.end.split('-').reverse().slice(0, 2).join('/')) });
    });
    events.filter(e => e.date === day).forEach(e => items.push({ c: e.color || HCAL_COL[e.type], t: (e.time ? e.time + ' · ' : '') + e.label, s: e.sub, go: e.go }));
  } else {
    const all = [];
    stays.forEach(s => { if (s.start.startsWith(m)) all.push({ d: s.start, c: HCAL_COL[s.src], t: 'Arrivée · ' + s.bien + hcalStayWho(s), s: hcalStaySub(s) }); });
    const seen = new Set();
    events.forEach(e => { if (!_hcal.show[e.type] || (e.id && seen.has(e.id))) return; if (e.id) seen.add(e.id); all.push({ d: e.date, c: e.color || HCAL_COL[e.type], t: (e.time ? e.time + ' · ' : '') + e.label, s: e.sub, go: e.go }); });
    items = all.sort((a, b) => a.d.localeCompare(b.d)).map(x => Object.assign(x, { tag: new Date(x.d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }));
  }
  const title = day ? fmtD(day).replace(/^./, c => c.toUpperCase()) : 'Ce mois-ci';
  const list = items.length ? items.slice(0, 40).map(i => '<div class="hh-ev"' + (i.go ? ' onclick="' + i.go + '" style="cursor:pointer"' : '') + '>' + (i.tag ? '<span class="hh-ev-tag">' + i.tag + '</span>' : '') + '<i style="background:' + i.c + '"></i><div><b>' + hEsc(i.t) + '</b><small>' + hEsc(i.s || '') + '</small></div></div>').join('')
    : '<div class="hh-ev hh-ev-empty">' + hIco('check-circle', 16) + '<div><b>Rien de prévu</b><small>' + (day ? 'Aucun événement ce jour-là' : 'Aucun événement ce mois-ci') + '</small></div></div>';
  return '<aside class="hg hcal-side"><div class="hcal-side-h"><b>' + title + '</b>' + (day ? '<span class="hcal-side-a"><button class="hbtn hbtn-dark" onclick="hcalEdit(null,\'' + day + '\')">' + hIco('plus', 13) + 'Ajouter</button><button class="hbtn hbtn-light" onclick="hcalSet(\'day\', null)">Tout le mois</button></span>' : '<small>' + items.length + ' élément' + (items.length > 1 ? 's' : '') + '</small>') + '</div><div class="hh-evs">' + list + '</div></aside>';
}

// ════════════ Événements personnels ════════════
const HCAL_EV_KEY = 'artemis_events';
const HCAL_CATS = [
  ['rdv', 'Rendez-vous', '#2f74f0'], ['travaux', 'Travaux', '#ef7d1f'], ['menage', 'Ménage', '#0fa595'],
  ['admin', 'Administratif', '#7c5cf5'], ['perso', 'Personnel', '#e0559b'], ['autre', 'Autre', '#5c6170'],
];
function hcalUserEvents() { try { const a = JSON.parse(localStorage.getItem(HCAL_EV_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function hcalSaveUserEvents(a) { try { localStorage.setItem(HCAL_EV_KEY, JSON.stringify(a)); } catch (e) { showToast('⚠ Enregistrement impossible : ' + e.message, '#e0353f'); } }
function hcalCat(id) { return HCAL_CATS.find(c => c[0] === id) || HCAL_CATS[HCAL_CATS.length - 1]; }
// Un élément par jour couvert (pour la grille) ; le panneau dédoublonne par id
function hcalUserForMonth(m) {
  const out = [];
  hcalUserEvents().forEach(ev => {
    if (!ev.date) return;
    const end = ev.end && ev.end >= ev.date ? ev.end : ev.date;
    if (end.slice(0, 7) < m || ev.date.slice(0, 7) > m) return;
    const cat = hcalCat(ev.cat);
    const sub = cat[1] + (ev.by && ev.by !== haloUserName() ? ' · par ' + ev.by : '') + (ev.bien ? ' · ' + ev.bien : '') + (end !== ev.date ? ' · jusqu\'au ' + end.split('-').reverse().slice(0, 2).join('/') : '') + (ev.note ? ' · ' + ev.note : '');
    for (let d = ev.date; d <= end; d = hcalAdd(d, 1)) {
      if (d.slice(0, 7) === m) out.push({ id: ev.id, date: d, type: 'user', label: ev.title, sub, color: cat[2], time: d === ev.date ? ev.time || '' : '', bien: ev.bien || '', go: "hcalEdit('" + ev.id + "')" });
    }
  });
  return out;
}
// Fenêtre de création / modification
function hcalEdit(id, date) {
  const evs = hcalUserEvents();
  const ev = id ? evs.find(e => e.id === id) : null;
  if (id && !ev) return;
  const d0 = ev ? ev.date : (date || (_hcal.month === hcalToday().slice(0, 7) ? hcalToday() : _hcal.month + '-01'));
  const cur = ev || { title: '', date: d0, end: '', time: '', cat: 'rdv', bien: '', note: '' };
  let p = { biens: [] }; try { p = getParams(); } catch (e) {}
  const m = document.createElement('div');
  m.id = 'hcal-modal';
  m.innerHTML = '<div class="hcal-mbox" role="dialog" aria-label="' + (ev ? 'Modifier' : 'Nouvel') + ' événement">'
    + '<div class="hcal-mh"><b>' + (ev ? 'Modifier l\'événement' : 'Nouvel événement') + '</b><button class="hcal-mx" onclick="hcalCloseEdit()" aria-label="Fermer">' + hIco('x', 16) + '</button></div>'
    + '<label class="hcal-f"><span>Titre</span><input id="hce-title" type="text" maxlength="80" placeholder="Ex. : Visite du plombier, AG de copropriété…" value="' + hEsc(cur.title) + '"></label>'
    + '<div class="hcal-f2"><label class="hcal-f"><span>Date</span><input id="hce-date" type="date" value="' + cur.date + '"></label>'
    + '<label class="hcal-f"><span>Jusqu\'au <small>(facultatif)</small></span><input id="hce-end" type="date" value="' + (cur.end || '') + '"></label>'
    + '<label class="hcal-f"><span>Heure <small>(facultatif)</small></span><input id="hce-time" type="time" value="' + (cur.time || '') + '"></label></div>'
    + '<div class="hcal-f"><span>Catégorie</span><div class="hcal-cats" id="hce-cats">' + HCAL_CATS.map(c => '<button type="button" class="' + (c[0] === cur.cat ? 'on' : '') + '" data-cat="' + c[0] + '" style="--c:' + c[2] + '" onclick="document.querySelectorAll(\'#hce-cats button\').forEach(b=>b.classList.toggle(\'on\', b===this))"><i></i>' + c[1] + '</button>').join('') + '</div></div>'
    + '<label class="hcal-f"><span>Bien concerné <small>(facultatif)</small></span><select id="hce-bien" class="sel"><option value="">Aucun</option>' + (p.biens || []).map(b => '<option' + (b.name === cur.bien ? ' selected' : '') + '>' + hEsc(b.name) + '</option>').join('') + '</select></label>'
    + '<label class="hcal-f"><span>Note <small>(facultatif)</small></span><textarea id="hce-note" rows="2" maxlength="300" placeholder="Détails, contact, montant…">' + hEsc(cur.note || '') + '</textarea></label>'
    + '<div class="hcal-mf">' + (ev ? '<button class="hbtn hbtn-light hcal-del" onclick="hcalDeleteEvent(\'' + ev.id + '\')">' + hIco('trash-2', 14) + 'Supprimer</button>' : '<span></span>')
    + '<span><button class="hbtn hbtn-light" onclick="hcalCloseEdit()">Annuler</button><button class="hbtn hbtn-dark" onclick="hcalSaveEvent(' + (ev ? '\'' + ev.id + '\'' : 'null') + ')">' + hIco('check', 14) + 'Enregistrer</button></span></div></div>';
  m.addEventListener('mousedown', e => { if (e.target === m) hcalCloseEdit(); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') hcalCloseEdit(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') hcalSaveEvent(ev ? ev.id : null); });
  hcalCloseEdit();
  document.body.appendChild(m);
  setTimeout(() => { const t = document.getElementById('hce-title'); if (t) t.focus(); }, 30);
}
function hcalCloseEdit() { const m = document.getElementById('hcal-modal'); if (m) m.remove(); }
function hcalSaveEvent(id) {
  const v = k => (document.getElementById('hce-' + k) || {}).value || '';
  const title = v('title').trim(), date = v('date');
  if (!title) { document.getElementById('hce-title').focus(); showToast('Donne un titre à l\'événement', '#e0353f'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('Choisis une date', '#e0353f'); return; }
  let end = v('end');
  if (end && end < date) { showToast('La date de fin est avant la date de début', '#e0353f'); return; }
  if (end === date) end = '';
  const on = document.querySelector('#hce-cats button.on');
  const data = { title, date, end, time: v('time'), cat: on ? on.dataset.cat : 'autre', bien: v('bien'), note: v('note').trim(), updated: new Date().toISOString() };
  const evs = hcalUserEvents();
  if (id) { const i = evs.findIndex(e => e.id === id); if (i >= 0) evs[i] = Object.assign(evs[i], data); }
  else evs.push(Object.assign({ id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: data.updated, by: haloUserName() || '' }, data));
  hcalSaveUserEvents(evs);
  hcalCloseEdit();
  _hcal.month = date.slice(0, 7); _hcal.day = date;
  hcalRender('soft');
  showToast(id ? 'Événement modifié' : 'Événement ajouté');
}
function hcalDeleteEvent(id) {
  const ev = hcalUserEvents().find(e => e.id === id);
  if (!ev || !confirm('Supprimer l\'événement « ' + ev.title + ' » ?')) return;
  hcalSaveUserEvents(hcalUserEvents().filter(e => e.id !== id));
  hcalCloseEdit();
  hcalRender('soft');
  showToast('Événement supprimé');
}

// ── Branchement dans la navigation ──
(function () {
  const i = HALO_NAV.findIndex(n => n.id === 'budget');
  HALO_NAV.splice(i + 1, 0, { id: 'calendar', label: 'Calendrier', ico: 'calendar', hint: 'Séjours, échéances de prêt et rappels' });
  const baseGo = window.haloGo;
  window.haloGo = function (route) {
    const c = document.getElementById('calendarScreen');
    if (route === 'calendar') {
      const s = document.getElementById('settingsScreen'); if (s) s.style.display = 'none';
      haloCloseOverlays();
      try { if (document.body.classList.contains('dash-mode')) { document.body.classList.remove('dash-mode'); document.getElementById('sc6').classList.remove('active'); } } catch (e) {}
      showCalendar();
      haloSetActive('calendar');
      return;
    }
    if (c) c.style.display = 'none';
    return baseGo.apply(this, arguments);
  };
  ['showHome', 'enterDashboard', 'enterTools', 'showBudget', 'showSimulateur', 'showMarketplace', 'showSettings'].forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    const w = function () { const c = document.getElementById('calendarScreen'); if (c) c.style.display = 'none'; return o.apply(this, arguments); };
    Object.assign(w, o); window[n] = w;
  });
  const baseRoot = window._haloRouteRoot;
  if (typeof baseRoot === 'function') window._haloRouteRoot = r => r === 'calendar' ? document.getElementById('calendarScreen') : baseRoot(r);
})();
