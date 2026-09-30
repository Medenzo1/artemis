function switchKpiTab(btn) {
  _kpiTab = btn.dataset.ktab;
  document.querySelectorAll('[data-ktab]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderKpis();
}

function switchNavKpi(btn, ktab) {
  _kpiTab = ktab;
  btn.closest('.dnav-subs').querySelectorAll('.dnav-sub').forEach(b => {
    b.style.background = 'transparent';
    b.style.border = '1px solid transparent';
    b.style.color = 'var(--text2)';
  });
  btn.style.background = 'rgba(34,211,200,.12)';
  btn.style.border = '1px solid rgba(34,211,200,.3)';
  btn.style.color = 'var(--cyan)';
  renderKpis();
}

function renderKpis() {
  _applyDefaultDates();
  const el = document.getElementById('kpi-content');
  if (!el) return;
  _dashFillYears(_getDB());
  if (_kpiTab === 'lcd') _renderKpiLCD();
  else _renderKpiLLD();
}

function _kpiDelta(cur, prev) { return prev ? (cur-prev)/Math.abs(prev)*100 : null; }
function _kpiDeltaLabel(pct) { return pct===null?'':(pct>=0?'▲ ':'▼ ')+Math.abs(pct).toFixed(1)+'% vs N−1'; }
function _kpiDeltaColor(pct) { return pct===null?'var(--text2)':pct>=0?'var(--green)':'var(--red)'; }

// ── LCD ────────────────────────────────────────
function _renderKpiLCD() {
  const el = document.getElementById('kpi-content');
  if (!el) return;
  _dashFillYears(_getDB());

  const params = getParams();
  const lcdBienNames = (params.biens||[]).filter(b=>b.type==='LCD').map(b=>b.name);

  // Récupérer filtres
  const year     = _getV('kpi-year');
  const sciSel   = _msGetVals('kpi-sci');
  const bienSel2Raw = _msGetVals('kpi-bien2');
  const dateMin  = _getV('kpi-date-min') || window._artemisDateMin || '';
  const dateMax  = _getV('kpi-date-max') || window._artemisDateMax || '';

  // Si aucun bien sélectionné, utiliser uniquement les biens LCD qui ont des données réelles
  let bienSel2 = bienSel2Raw;
  if (!bienSel2 || !bienSel2.length) {
    // Détecter les biens LCD actifs (ceux qui ont au moins une ligne)
    const db0 = _getDB();
    const allL = Object.values(db0.periods||{}).flatMap(p => p.lines||[]);
    const activeBiens = new Set(allL.map(l => l.bienName||l.bien||'').filter(Boolean));
    bienSel2 = lcdBienNames.filter(n => activeBiens.has(n));
    if (!bienSel2.length) bienSel2 = undefined;
  }

  // Utiliser _synLines avec les filtres KPI pour avoir la ventilation correcte (FG, etc.)
  let allLines = _synLines({
    sci:  sciSel  && sciSel.length  ? sciSel  : undefined,
    bien: bienSel2 && bienSel2.length ? bienSel2 : undefined,
    year: year !== 'all' ? year : undefined,
    dmin: dateMin || undefined,
    dmax: dateMax || undefined,
  });
  const db = _getDB(); // pour le calcul des nuits disponibles

  // Restreindre aux biens LCD
  const lines = allLines.filter(l => {
    const bname = l.bienName||l.bien||'';
    return lcdBienNames.some(n => bname.includes(n)) || l.type==='LCD' || l.sourcePlatform==='Airbnb' || l.sourcePlatform==='Booking';
  });

  if (!lines.length) { el.innerHTML = _emptyState('Aucune donnée LCD pour cette sélection'); return; }

  // ── KPIs financiers ──
  const rev = lines.filter(l=>+l.montant>0).reduce((s,l)=>s+(+l.montant),0);
  const chg = lines.filter(l=>+l.montant<0).reduce((s,l)=>s+(+l.montant),0);
  const net = rev+chg;

  // Charges fixes hors remboursement capital (bilan, pas exploitation)
  const CF_EXCLU = new Set(['Remboursement emprunt', 'Versement emprunt']);
  const cf  = lines.filter(l=>{ const s=SCHEMA[l.cat||l.categorie||'']; return s&&s.cfcv==='Charge fixe'&&+l.montant<0&&!CF_EXCLU.has(l.cat||l.categorie||''); }).reduce((s,l)=>s+Math.abs(+l.montant),0);
  const cv  = lines.filter(l=>{ const s=SCHEMA[l.cat||l.categorie||'']; return s&&s.cfcv==='Charge variable'&&+l.montant<0; }).reduce((s,l)=>s+Math.abs(+l.montant),0);

  // ── Calcul des nuits depuis le store persistant ──
  const _toISO = d => {
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const m4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m4) return m4[3]+'-'+m4[2].padStart(2,'0')+'-'+m4[1].padStart(2,'0');
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m2) return '20'+m2[3]+'-'+m2[1].padStart(2,'0')+'-'+m2[2].padStart(2,'0');
    const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m3) return m3[3]+'-'+m3[1].padStart(2,'0')+'-'+m3[2].padStart(2,'0');
    return '';
  };

  const _inPeriod = isoDate => {
    if (!isoDate) return false; // exclure les entrées sans date
    if (dateMin && isoDate < dateMin) return false;
    if (dateMax && isoDate > dateMax) return false;
    if (year && year !== 'all' && !isoDate.startsWith(year)) return false;
    return true;
  };

  // Dotations aux amortissements pour la période — considérées comme charges fixes
  const cfAmort = _getAmortDotations(bienSel2 && bienSel2.length ? bienSel2 : null, dateMin, dateMax);
  const cfTotal = cf + cfAmort;
  

  // Airbnb + Booking depuis le store persistant
  const allReservations = _getReservations();

  // Construire un reverse map : nomLogement → bienName, pour filtrer par bien
  const _logementToBienName = {};
  const _params = getParams();
  (_params.biens||[]).filter(b=>b.type==='LCD').forEach(b => {
    _logementToBienName[b.nom] = b.name;
    _logementToBienName[b.name] = b.name;
  });
  if (typeof AIRBNB_MAP !== 'undefined') {
    Object.entries(AIRBNB_MAP).forEach(([logement, bienId]) => {
      const b = (_params.biens||[]).find(x=>x.id===bienId);
      if (b) _logementToBienName[logement] = b.name;
    });
  }
  if (typeof BOOKING_ID_MAP !== 'undefined') {
    Object.entries(BOOKING_ID_MAP).forEach(([idEtab, bienId]) => {
      const b = (_params.biens||[]).find(x=>x.id===bienId);
      if (b) _logementToBienName[b.nom] = b.name;
    });
  }

  const _resMatchesBien = (r) => {
    if (!bienSel2 || !bienSel2.length) return true;
    const bienName = _logementToBienName[r.logement];
    return bienName && bienSel2.includes(bienName);
  };

  let platformNuits = 0, platformSejours = 0;
  const biensAvecResa = new Set();
  allReservations.forEach(r => {
    const iso = _toISO(r.dateDebut);
    if (!_inPeriod(iso)) return;
    if (!_resMatchesBien(r)) return;
    platformNuits += r.nuits;
    platformSejours++;
    if (r.logement) biensAvecResa.add(r.logement);
  });

  // LCD depuis localStorage avec filtrage période et bien
  const lcdData = JSON.parse(localStorage.getItem('artemis_lcd')||'[]');
  let lcdNuits = 0, lcdSejours = 0;
  lcdData.forEach(a => {
    const iso = _toISO(a.dateDebut);
    if (!_inPeriod(iso)) return;
    if (bienSel2 && bienSel2.length && !bienSel2.includes(a.bienName)) return;
    const n = parseInt(a.nuits) || 0;
    lcdNuits += n;
    if (n > 0) { lcdSejours++; if (a.bienName) biensAvecResa.add(a.bienName); }
  });

  const nuitsLouees = platformNuits + lcdNuits;
  const nbSejours   = platformSejours + lcdSejours;
  const dms         = nbSejours > 0 ? nuitsLouees / nbSejours : 0;

  // 2. Nuits disponibles : jours calendaires × nb biens LCD actifs dans la période
  // On utilise le nb de biens LCD qui ont eu des réservations, sinon tous les biens LCD
  let joursPeriode = 0;
  if (dateMin && dateMax) {
    const d1 = new Date(dateMin), d2 = new Date(dateMax);
    joursPeriode = Math.max(0, Math.round((d2 - d1) / 86400000) + 1);
  } else {
    const periodsInDB = Object.values(db.periods||{});
    const filteredPeriods = year!=='all'
      ? periodsInDB.filter(p=>String(p.year)===year)
      : periodsInDB;
    filteredPeriods.forEach(p => {
      const [pY,pM] = (p.period||'').split('-').map(Number);
      if(pY&&pM) joursPeriode += new Date(pY,pM,0).getDate();
    });
  }
  // Nb biens actifs = biens LCD uniques ayant des réservations dans la période
  // On mappe les noms de logements aux bienIds via AIRBNB_MAP et les params
  const bienIdsActifs = new Set();
  biensAvecResa.forEach(logement => {
    // Airbnb map (nom logement → bienId)
    const idAir = (typeof AIRBNB_MAP !== 'undefined') ? AIRBNB_MAP[logement] : null;
    if (idAir) { bienIdsActifs.add(idAir); return; }
    // Fallback : chercher dans les biens LCD par nom partiel
    const p = getParams();
    const b = (p.biens||[]).find(b2 => b2.type==='LCD' && (b2.name===logement || b2.nom===logement || logement.includes(b2.name) || (b2.nom && logement.includes(b2.nom))));
    if (b) bienIdsActifs.add(b.id);
  });
  // Ajouter les biens LCD depuis les réservations directes
  const lcdDataIds = JSON.parse(localStorage.getItem('artemis_lcd')||'[]');
  lcdDataIds.forEach(a => { if (_inPeriod(_toISO(a.dateDebut)) && a.bienId) bienIdsActifs.add(a.bienId); });

  const nbBiensActifs = bienIdsActifs.size > 0 ? bienIdsActifs.size : lcdBienNames.length || 1;
  const nuitsDisponibles = (joursPeriode * nbBiensActifs) || 365;

  // Taux d'occupation
  const txOcc = nuitsDisponibles > 0 ? Math.min(nuitsLouees / nuitsDisponibles * 100, 100) : 0;

  // Point mort (nuits)
  // CF = charges fixes, MSCV par nuit = (CA - CV) / nuits louées
  // Point mort basé sur les nuits : CF / (MSCV par nuit louée) = nuits nécessaires
  const mscv      = rev - cv;
  const mscvNuit  = nuitsLouees > 0 ? mscv / nuitsLouees : 0;
  const pointMortNuits = mscvNuit > 0 ? Math.ceil(cfTotal / mscvNuit) : 0;
  const pointMortPct   = nuitsDisponibles > 0 ? Math.min(pointMortNuits / nuitsDisponibles * 100, 100) : 0;

  // RevPAR
  const revpar = nuitsDisponibles > 0 ? rev / nuitsDisponibles : 0;

  // ── Rendu HTML ──
  const gaugeId1 = 'gauge-occ-' + Date.now();
  const gaugeId2 = 'gauge-pm-' + Date.now() + 1;
  const fmt2 = n => n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:20px;align-items:stretch">

      <!-- Taux d'occupation vs Point mort (%) -->
      <div class="card" style="display:flex;flex-direction:column;align-items:center;padding:18px 14px 14px;margin-top:0!important;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin-bottom:12px;text-align:center">Taux d'occupation vs Point mort</div>
        <div class="ac-wrap" style="max-width:220px"><canvas id="${gaugeId1}"></canvas></div>
        <div style="display:flex;justify-content:space-between;width:100%;margin-top:6px;font-size:11px">
          <span style="color:var(--text2)">0%</span>
          <span style="color:var(--text2)">100%</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;justify-content:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--cyan);font-family:inherit">${txOcc.toFixed(1)}%</span>
            <span style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Occupation</span>
          </div>
          <div style="width:1px;background:var(--border2);margin:2px 0"></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--red);font-family:inherit">${pointMortPct.toFixed(1)}%</span>
            <span style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Point mort</span>
          </div>
        </div>
      </div>

      <!-- Jours d'occupation vs Point mort -->
      <div class="card" style="display:flex;flex-direction:column;align-items:center;padding:18px 14px 14px;margin-top:0!important;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin-bottom:12px;text-align:center">Jours d'occupation vs Point mort</div>
        <div class="ac-wrap" style="max-width:220px"><canvas id="${gaugeId2}"></canvas></div>
        <div style="display:flex;justify-content:space-between;width:100%;margin-top:6px;font-size:11px">
          <span style="color:var(--text2)">0</span>
          <span style="color:var(--text2)">${nuitsDisponibles} nuits dispo</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;justify-content:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--purple);font-family:inherit">${nuitsLouees}</span>
            <span style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Nuits louées</span>
          </div>
          <div style="width:1px;background:var(--border2);margin:2px 0"></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--red);font-family:inherit">${pointMortNuits}</span>
            <span style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Point mort</span>
          </div>
        </div>
      </div>

      <!-- Durée moyenne de séjour -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;padding:18px 14px;margin-top:0!important;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);margin-bottom:16px;text-align:center">Durée moyenne de séjour (en jour)</div>
        <div style="font-size:42px;font-weight:900;color:var(--text);font-family:inherit;line-height:1">${fmt2(dms)}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:10px">${nbSejours} séjour${nbSejours>1?'s':''} · ${nuitsLouees} nuits</div>
      </div>

      <!-- RevPAR -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;padding:18px 14px;margin-top:0!important;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);margin-bottom:16px;text-align:center">Revenu par nuit disponible</div>
        <div style="font-size:42px;font-weight:900;color:var(--text);font-family:inherit;line-height:1">${fmt2(revpar)}&thinsp;€</div>
        <div style="font-size:11px;color:var(--text2);margin-top:10px">CA&thinsp;${_fmtK(rev)} ÷ ${nuitsDisponibles} nuits dispo</div>
      </div>
    </div>

    <!-- Compte de résultat en paliers -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:14px;margin-top:14px">
      <div class="card" style="margin-top:0!important">
        <div class="card-title">Compte de résultat en paliers</div>
        <div class="ac-wrap"><canvas id="kpi-waterfall-cv"></canvas></div>
      </div>
      <div class="card" style="margin-top:0!important;padding:0;overflow:hidden">
        <div class="card-title" style="padding:14px 16px 0">Détail par catégorie</div>
        <div id="kpi-detail-table" style="overflow-y:auto;max-height:320px;position:relative"></div>
      </div>
    </div>

    <!-- Graphiques tendance CF + CV -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:14px;margin-top:14px">
      <div class="card" style="margin-top:0!important">
        <div class="card-title gold">Charges fixes — tendance et prévision à 10 mois</div>
        <div class="ac-wrap"><canvas id="kpi-trend-cf"></canvas></div>
      </div>
      <div class="card" style="margin-top:0!important">
        <div class="card-title">Charges variables — tendance et prévision à 10 mois</div>
        <div class="ac-wrap"><canvas id="kpi-trend-cv2"></canvas></div>
      </div>
    </div>`;

  // ── Dessiner les jauges demi-cercle ──
  requestAnimationFrame(() => {
    _drawGauge(gaugeId1, txOcc, pointMortPct, 100, '#22d3c8', txOcc.toFixed(1) + '%');
    _drawGauge(gaugeId2, nuitsLouees, pointMortNuits, nuitsDisponibles, '#9b6ef3', nuitsLouees);

    // ── Compte de résultat en paliers (barres centrées) ──
    const cv2 = document.getElementById('kpi-waterfall-cv');
    if (!cv2) return;
    const mscv = rev - cv;
    const result = mscv - cfTotal;
    const rows = [
      { label: "Chiffre d'affaires", val: rev,    color: '#22c97a' },
      { label: 'Charges variables',  val: cv,     color: '#f0566a' },
      { label: 'MSCV',              val: mscv,   color: '#22c97a' },
      { label: 'Charges fixes',     val: cfTotal, color: '#f0566a' },
      { label: 'Résultat net',      val: result, color: result >= 0 ? '#f5b731' : '#f0566a' },
    ];
    ArtCharts.funnel(cv2, { rows });

    // ── Tableau de détail par catégorie ──
    const tbl = document.getElementById('kpi-detail-table');
    if (tbl && nuitsDisponibles > 0) {
      const CF_EXCLU_TBL = new Set(['Remboursement emprunt', 'Versement emprunt', 'CCA remboursé', 'CCA apport']);
      const catMap = {};
      lines.forEach(l => {
        const cat = l.cat || l.categorie || 'Autre';
        if (CF_EXCLU_TBL.has(cat)) return;
        const m = +(l.montant) || 0;
        if (!catMap[cat]) catMap[cat] = 0;
        catMap[cat] += m;
      });
      // Ajouter les dotations aux amortissements
      if (cfAmort > 0) {
        catMap['Dotations aux amortissements'] = (catMap['Dotations aux amortissements'] || 0) - cfAmort;
      }
      window._kpiDetailRows = Object.entries(catMap).map(([cat, val]) => ({cat, val, perNuit: nuitsLouees > 0 ? val / nuitsLouees : 0}));
      window._kpiDetailNuits = nuitsLouees;
      _renderKpiDetailTable('val', 'desc');
    }

    // ── Graphiques tendance CF + CV ──
    _drawTrendChart('kpi-trend-cf', bienSel2, sciSel, 'cf', '#f5b731', CF_EXCLU);
    _drawTrendChart('kpi-trend-cv2', bienSel2, sciSel, 'cv', '#22d3c8', CF_EXCLU);

  });
}

// ── Graphique tendance CF/CV avec prévision ──
function _drawTrendChart(canvasId, bienSel, sciSel, type, color, cfExclu) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;

  // Construire série mensuelle depuis toute la DB (pas filtrée par période)
  const db = _getDB();
  const monthMap = {};

  // Normaliser une date vers YYYY-MM
  const _toYM = d => {
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(0,7);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,7);
    // M/D/YY SheetJS
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m) return '20'+m[3]+'-'+m[1].padStart(2,'0');
    // DD/MM/YYYY
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return m2[3]+'-'+m2[2].padStart(2,'0');
    return '';
  };
  Object.values(db.periods||{}).forEach(p => {
    (p.lines||[]).forEach(l => {
      const s = SCHEMA[l.cat||l.categorie||''];
      if (!s) return;
      if (bienSel && bienSel.length && !bienSel.includes(l.bienName||l.bien)) return;
      if (sciSel && sciSel.length && !sciSel.includes(l.sci)) return;
      const cat = l.cat||l.categorie||'';
      if (cfExclu && cfExclu.has(cat)) return;
      const m = +l.montant || 0;
      const ym = _toYM(l.date);
      if (!ym || ym.length < 7) return;
      if (!monthMap[ym]) monthMap[ym] = 0;
      if (type === 'cf' && s.cfcv === 'Charge fixe' && m < 0) monthMap[ym] += Math.abs(m);
      if (type === 'cv' && s.cfcv === 'Charge variable' && m < 0) monthMap[ym] += Math.abs(m);
    });
  });

  const sortedYMs = Object.keys(monthMap).sort();
  if (sortedYMs.length < 2) return;

  const vals = sortedYMs.map(ym => monthMap[ym]);
  const n = vals.length;
  const FORECAST = 10;

  // Régression linéaire
  const meanX = (n - 1) / 2;
  const meanY = vals.reduce((a,b) => a+b, 0) / n;
  let num = 0, den = 0;
  vals.forEach((v, i) => { num += (i - meanX) * (v - meanY); den += (i - meanX) ** 2; });
  const slope = den ? num / den : 0;
  const intercept = meanY - slope * meanX;
  const trend = (i) => intercept + slope * i;

  // Prévision avec intervalle de confiance (±1.5 * std résidus)
  const residuals = vals.map((v, i) => v - trend(i));
  const stdRes = Math.sqrt(residuals.reduce((a,b) => a + b*b, 0) / n);
  const CI = stdRes * 1.5;

  const forecastYMs = [];
  let [fy, fm] = sortedYMs[sortedYMs.length - 1].split('-').map(Number);
  for (let i = 1; i <= FORECAST; i++) { fm++; if (fm > 12) { fm = 1; fy++; } forecastYMs.push(fy + '-' + String(fm).padStart(2, '0')); }
  ArtCharts.forecast(cv, {
    labels: [...sortedYMs, ...forecastYMs], values: vals,
    trend: Array.from({ length: n + FORECAST }, (_, i) => Math.max(0, trend(i))), ci: CI,
    color, name: type === 'cf' ? 'Charges fixes' : 'Charges variables' });
}

// ── Tableau détail KPI ──
function _renderKpiDetailTable(sortCol, sortDir) {
  const tbl = document.getElementById('kpi-detail-table');
  if (!tbl || !window._kpiDetailRows) return;
  const rows = window._kpiDetailRows.slice();
  rows.sort((a, b) => {
    const v = sortCol === 'cat'
      ? a.cat.localeCompare(b.cat, 'fr')
      : sortCol === 'perNuit'
        ? a.perNuit - b.perNuit
        : a.val - b.val;
    return sortDir === 'asc' ? v : -v;
  });
  const _fmtV = v => Math.abs(v).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  const _fmtN = v => (v >= 0 ? '+' : '') + v.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const thStyle = (col) => `padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = (col) => `<span class="kpi-sort-arrow" data-col="${col}" style="margin-left:4px;opacity:${sortCol===col?'1':'.3'}">${sortCol===col?(sortDir==='asc'?'↑':'↓'):'↕'}</span>`;
  const totalVal = rows.reduce((s, r) => s + r.val, 0);
  const totalNuit = window._kpiDetailNuits > 0 ? totalVal / window._kpiDetailNuits : 0;
  const totalCol = totalVal >= 0 ? '#22c97a' : '#f0566a';
  const totalPrefix = totalVal >= 0 ? '+' : '−';

  tbl.innerHTML = `<table id="kpi-detail-tbl" style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:1px solid var(--border2);position:sticky;top:0;z-index:2;background:var(--bg3)">
      <th onclick="_sortKpiDetail('cat')" style="${thStyle('cat')}text-align:left">Catégorie ${arrow('cat')}</th>
      <th onclick="_sortKpiDetail('val')" style="${thStyle('val')}text-align:right">Flux ${arrow('val')}</th>
      <th onclick="_sortKpiDetail('perNuit')" style="${thStyle('perNuit')}text-align:right">/nuit ${arrow('perNuit')}</th>
    </tr></thead>
    <tbody>${rows.map(({cat, val, perNuit}) => {
      const col = val >= 0 ? '#22c97a' : '#f0566a';
      const prefix = val >= 0 ? '+' : '−';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
        <td style="padding:9px 14px;color:var(--text);font-size:13px">${cat}</td>
        <td style="padding:9px 14px;text-align:right;font-family:inherit;font-size:13px;font-weight:700;color:${col};white-space:nowrap">${prefix} ${_fmtV(val)}</td>
        <td style="padding:9px 14px;text-align:right;font-family:inherit;font-size:13px;color:${col};opacity:.8;white-space:nowrap">${_fmtN(perNuit)}</td>
      </tr>`;
    }).join('')}</tbody>
    <tfoot><tr style="border-top:2px solid var(--border2);background:var(--bg3);position:sticky;bottom:0;z-index:2">
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:var(--text)">Total</td>
      <td style="padding:10px 14px;text-align:right;font-family:inherit;font-size:13px;font-weight:700;color:${totalCol};white-space:nowrap">${totalPrefix} ${_fmtV(totalVal)}</td>
      <td style="padding:10px 14px;text-align:right;font-family:inherit;font-size:13px;font-weight:700;color:${totalCol};white-space:nowrap">${_fmtN(totalNuit)}</td>
    </tr></tfoot>
  </table>`;
  window._kpiDetailSort = {col: sortCol, dir: sortDir};
}

function _sortKpiDetail(col) {
  const cur = window._kpiDetailSort || {col: 'val', dir: 'desc'};
  const dir = cur.col === col ? (cur.dir === 'asc' ? 'desc' : 'asc') : 'desc';
  _renderKpiDetailTable(col, dir);
}

// ── Jauge demi-cercle ──
function _drawGauge(canvasId, value, threshold, maxVal, color, centerLabel) {
  ArtCharts.gauge(document.getElementById(canvasId), {
    value, max: maxVal || 100, threshold, color: color || '#22d3c8',
    label: centerLabel !== undefined ? centerLabel : ((value / (maxVal || 100)) * 100).toFixed(1) + '%' });
}

// ── LLD ────────────────────────────────────────
function _renderKpiLLD() {
  const el = document.getElementById('kpi-content');
  const params = getParams();
  const lldNames = (params.biens || []).filter(b => b.type === 'LLD').map(b => b.name);
  const isLLD = l => { const n = l.bienName || l.bien || ''; return lldNames.some(x => n.includes(x)) || l.type === 'LLD'; };

  const allLines = _dashLines(_getV('kpi-year'), 'all', 'all', _getV('kpi-bien'));
  const lines = allLines.filter(isLLD);
  if (!lines.length) { el.innerHTML = _emptyState('Aucune donnée LLD pour cette sélection'); return; }

  // Nature des flux : loyers = produits, charges = exploitation + financières,
  // crédit = capital + intérêts + assurance emprunt. Les flux de bilan (apports, déblocages) sont exclus.
  const CAP = new Set(['Remboursement emprunt', 'Versement emprunt']);
  const LOAN_COST = new Set(['Intérêts de crédit', 'Assurance emprunt']);
  const kind = l => _isCA(l) ? 'rev' : _isDep(l) ? 'chg' : CAP.has(l.cat || l.categorie) ? 'cap' : null;
  const months = [...new Set(allLines.map(l => l._period).filter(Boolean))].sort();

  const B = {};           // par bien
  const M = {};           // par mois
  const catChg = {};      // charges par poste
  months.forEach(m => M[m] = { rev: 0, chg: 0, cap: 0 });
  lines.forEach(l => {
    const k = kind(l); if (!k) return;
    const v = +l.montant || 0, b = l.bienName || l.bien || 'Non attribué', m = l._period, cat = l.cat || l.categorie || 'Autre';
    if (!B[b]) B[b] = { rev: 0, chg: 0, cap: 0, loan: 0, byM: {}, cashM: {} };
    B[b][k] += v;
    B[b].cashM[m] = (B[b].cashM[m] || 0) + v;
    if (k === 'cap' || LOAN_COST.has(cat)) B[b].loan += v;
    if (k === 'rev') B[b].byM[m] = (B[b].byM[m] || 0) + v;
    if (M[m]) M[m][k] += v;
    if (k === 'chg') catChg[cat] = (catChg[cat] || 0) - v;
  });
  const biens = Object.keys(B).sort((a, b) => B[b].rev - B[a].rev);
  const sum = k => biens.reduce((t, b) => t + B[b][k], 0);
  const rev = sum('rev'), chg = sum('chg'), cap = sum('cap'), loan = sum('loan');
  const cash = rev + chg + cap;

  // Occupation : un mois est « loué » dès qu'un loyer est encaissé (indépendant du montant, qui peut être révisé)
  let paid = 0, slots = 0;
  biens.forEach(b => {
    B[b].paid = months.filter(m => (B[b].byM[m] || 0) > 0).length;
    const lastRent = months.slice().reverse().find(m => (B[b].byM[m] || 0) > 0);
    B[b].lastRent = lastRent ? B[b].byM[lastRent] : 0;
    paid += B[b].paid; slots += months.length;
  });
  const tauxEnc = slots ? paid / slots * 100 : 0;
  const couverture = loan < 0 ? rev / -loan : null;
  const tauxChg = rev ? -chg / rev * 100 : 0;

  const pm = k => { const o = {}; months.forEach(m => o[m] = k === 'cash' ? M[m].rev + M[m].chg + M[m].cap : k === 'chg' ? -M[m].chg : M[m][k]); return o; };
  const last = months[months.length - 1];
  const revPM = pm('rev'), chgPM = pm('chg'), cashPM = pm('cash');
  const series = o => months.map(m => o[m]);
  const pct = v => (Math.abs(v) < 0.05 ? 0 : v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';

  const ratioCard = (icon, label, value, color, sub) =>
    `<div class="card kpi-card kpi-v2"><div class="kpi-v2-head"><div class="kpi-v2-lbl">${icon}<span>${label}</span></div></div>
      <div class="kpi-v2-val" style="color:${color}">${value}</div><div class="kpi-v2-sub">${sub}</div></div>`;

  // Grille cash-flow bien × mois : montant réel du mois, couleur selon le signe, intensité selon l'ampleur
  const monthShort = m => { const [y, mo] = m.split('-'); return ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'][+mo - 1] + ' ' + y; };
  const maxAbs = Math.max(1, ...biens.flatMap(b => months.map(m => Math.abs(B[b].cashM[m] || 0))));
  const compact = v => { const a = Math.abs(v); const t = a >= 1000 ? (a / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + 'k' : Math.round(a).toString(); return (v < 0 ? '−' : v > 0 ? '+' : '') + t; };
  const cell = (b, m) => {
    const v = B[b].cashM[m] || 0, noRent = !((B[b].byM[m] || 0) > 0);
    const a = Math.min(1, Math.abs(v) / maxAbs), alpha = v ? (0.18 + a * 0.62).toFixed(2) : 0;
    const bg = v > 0 ? `rgba(34,201,122,${alpha})` : v < 0 ? `rgba(240,86,106,${alpha})` : 'rgba(255,255,255,.03)';
    return `<div class="lld-cf${noRent ? ' lld-cf-empty' : ''}" style="background:${bg}" title="${b} · ${monthShort(m)} — cash-flow ${_fmtK(v)}${noRent ? ' · aucun loyer encaissé' : ' · loyer ' + _fmtK(B[b].byM[m])}">${v ? compact(v) : '0'}</div>`;
  };
  const heat = `<div class="lld-heat" style="grid-template-columns:auto repeat(${months.length},minmax(40px,1fr)) minmax(64px,auto)">
      <div class="lld-heat-h" style="text-align:left">${months[0].slice(0, 4)}${months[0].slice(0, 4) !== last.slice(0, 4) ? ' – ' + last.slice(0, 4) : ''}</div>${months.map(m => `<div class="lld-heat-h" title="${monthShort(m)}">${monthShort(m).split(' ')[0]}</div>`).join('')}<div class="lld-heat-h" style="text-align:right">Total</div>
      ${biens.map(b => { const t = B[b].rev + B[b].chg + B[b].cap; return `<div class="lld-heat-b">${b}</div>` + months.map(m => cell(b, m)).join('') + `<div class="lld-cf-tot" style="color:${t >= 0 ? 'var(--green)' : 'var(--red)'}">${t >= 0 ? '+' : ''}${_fmtK(t)}</div>`; }).join('')}
    </div>
    <div class="lld-heat-legend"><span><i class="lld-cf-key" style="background:rgba(34,201,122,.7)"></i>Mois positif</span><span><i class="lld-cf-key" style="background:rgba(240,86,106,.7)"></i>Mois négatif</span><span><i class="lld-cf-key lld-cf-empty"></i>Aucun loyer encaissé</span><span class="lld-heat-note">Cash-flow = loyers − charges − échéance bancaire (capital inclus) · hors apports et remboursements de CCA · couleur plus intense = montant plus élevé</span></div>`;

  const rows = biens.map(b => {
    const d = B[b], c = d.rev + d.chg + d.cap, cov = d.loan < 0 ? d.rev / -d.loan : null;
    return `<tr>
      <td style="font-weight:600">${b}</td>
      <td class="td-right">${d.lastRent ? _fmtK(d.lastRent) : '—'}</td>
      <td class="td-right" style="color:${d.paid === months.length ? 'var(--green)' : 'var(--gold)'}">${d.paid} / ${months.length}</td>
      <td class="td-pos">+${_fmtK(d.rev)}</td>
      <td class="td-neg">${_fmtK(d.chg)}</td>
      <td class="td-neg">${d.loan ? _fmtK(d.loan) : '—'}</td>
      <td class="td-right" style="color:${c >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${c >= 0 ? '+' : ''}${_fmtK(c)}</td>
      <td class="td-right td-muted">${d.rev ? pct(-d.chg / d.rev * 100) : '—'}</td>
      <td class="td-right" style="color:${cov === null ? 'var(--text2)' : cov >= 1 ? 'var(--green)' : 'var(--red)'}">${cov === null ? '—' : cov.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ×'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="dash-grid-3 lld-kpis">
      ${_kpiCard('🏡', 'Loyers encaissés', '+' + _fmtK(rev), 'var(--green)', months.length + ' mois', _varBadges(revPM[last], last, revPM, true), series(revPM))}
      ${_kpiCard('📉', 'Charges', _fmtK(chg), 'var(--red)', 'hors remboursement du capital', _varBadges(chgPM[last], last, chgPM, false), series(chgPM))}
      ${_kpiCard('💰', 'Cash-flow après crédit', (cash >= 0 ? '+' : '') + _fmtK(cash), cash >= 0 ? 'var(--cyan)' : 'var(--red)', 'loyers − charges − capital remboursé · hors CCA', _varBadges(cashPM[last], last, cashPM, true), series(cashPM))}
      ${ratioCard('✅', 'Mois loués', pct(tauxEnc), tauxEnc >= 95 ? 'var(--green)' : tauxEnc >= 80 ? 'var(--gold)' : 'var(--red)', `${paid} mois avec loyer sur ${slots} · vacance et impayés`)}
      ${ratioCard('🏦', 'Couverture du crédit', couverture === null ? '—' : couverture.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ×', couverture === null ? 'var(--text2)' : couverture >= 1.2 ? 'var(--green)' : couverture >= 1 ? 'var(--gold)' : 'var(--red)', couverture === null ? 'aucune échéance sur la période' : 'loyers ÷ échéances (capital + intérêts + assurance)')}
      ${ratioCard('⚖', 'Taux de charges', pct(tauxChg), tauxChg <= 30 ? 'var(--green)' : tauxChg <= 45 ? 'var(--gold)' : 'var(--red)', 'charges ÷ loyers encaissés')}
    </div>

    <div class="dash-grid-2 lld-mid" style="align-items:stretch">
      <div class="card">
        <div class="card-title">Loyers, charges et cash-flow par mois</div>
        <div class="ac-wrap"><canvas id="lld-combo"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title red">Répartition des charges</div>
        <div class="ac-wrap"><canvas id="lld-donut"></canvas></div>
        <div id="lld-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:1px"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-title">Cash-flow par bien et par mois</div>
      <div style="overflow-x:auto">${heat}</div>
    </div>

    <div class="card">
      <div class="card-title">Rentabilité par bien</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Bien</th><th style="text-align:right">Dernier loyer</th><th style="text-align:right">Mois loués</th><th style="text-align:right">Loyers</th><th style="text-align:right">Charges</th><th style="text-align:right">Crédit</th><th style="text-align:right" title="Loyers − charges − échéance bancaire, hors apports et remboursements de compte courant d'associé">Cash-flow</th><th style="text-align:right">Taux charges</th><th style="text-align:right">Couverture</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;

  requestAnimationFrame(() => {
    ArtCharts.combo(document.getElementById('lld-combo'), {
      labels: months,
      bars: [{ name: 'Loyers', values: series(revPM), color: '#22c97a' }, { name: 'Charges', values: series(chgPM).map(v => -v), color: '#f0566a' }],
      line: { name: 'Cash-flow après crédit', values: series(cashPM), color: '#22d3c8' }
    });
    ArtCharts.donut(document.getElementById('lld-donut'), {
      entries: Object.entries(catChg).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
      palette: ['#f0566a', '#f5b731', '#9b6ef3', '#fb923c', '#38bdf8', '#22d3c8'],
      centerLabel: 'Charges', sign: '-', valueColor: '#f0566a', legendEl: document.getElementById('lld-donut-legend'), height: 220
    });
  });
}

// ─────────────────────────────────────────────
//  5. PLATEFORMES
// ─────────────────────────────────────────────
function renderPlateformes() {
  const el = document.getElementById('plt-content');
  if (!el) return;
  _dashFillYears(_getDB());
  const yearSel = _getV('plt-year'), bienSel = _getV('plt-bien');
  const params = getParams();

  // ── Canaux ────────────────────────────────
  const CH = {
    'Airbnb':         { color: '#f5b731', icon: '✈' },
    'Booking':        { color: '#9b6ef3', icon: '🏨' },
    'Direct':         { color: '#22d3c8', icon: '🏡' },
    'Longue durée':   { color: '#22c97a', icon: '🏦' },
    'Revenus annexes':{ color: '#8a9ab2', icon: '✨' },
  };
  const LCD_CH = ['Airbnb', 'Booking', 'Direct'];
  const chanOf = l => {
    const c = l.cat || l.categorie || '';
    if (l.sourcePlatform === 'Airbnb' || c === 'Airbnb') return 'Airbnb';
    if (l.sourcePlatform === 'Booking' || c === 'Booking') return 'Booking';
    if (c === 'Location directe' || c === 'Stripe') return 'Direct';
    if (c === 'Loyer mensuel') return 'Longue durée';
    return 'Revenus annexes'; // ventes additionnelles, remboursements, régularisations…
  };

  // ── Revenus encaissés (relevés bancaires) — filtres Année / Bien de l'onglet ──
  const lines = _synLines({ sci: [], bien: [], cat: [], dmin: '', dmax: '' })
    .filter(l => _isCA(l) && +l.montant > 0)
    .filter(l => yearSel === 'all' || String(l._year) === String(yearSel))
    .filter(l => bienSel === 'all' || (l.bienName || l.bien) === bienSel);
  if (!lines.length) { el.innerHTML = _emptyState('Aucun revenu pour cette sélection'); return; }

  const months = [...new Set(lines.map(l => l._period))].sort();
  const C = {};
  Object.keys(CH).forEach(k => C[k] = { rev: 0, byM: {}, biens: {}, nuits: 0, sejours: 0, brut: 0, comm: 0, net: 0 });
  lines.forEach(l => {
    const k = chanOf(l), v = +l.montant, b = l.bienName || l.bien || 'Non attribué';
    C[k].rev += v; C[k].byM[l._period] = (C[k].byM[l._period] || 0) + v; C[k].biens[b] = (C[k].biens[b] || 0) + v;
  });

  // ── Réservations (exports Airbnb / Booking, réservations directes) ──
  const iso = d => (_normDateStr(d).sort || '').slice(0, 10);
  const bienOfLogement = lg => {
    const id = (typeof AIRBNB_MAP !== 'undefined' && AIRBNB_MAP) ? AIRBNB_MAP[lg] : null;
    const b = (params.biens || []).find(x => (id && x.id === id) || x.name === lg || x.nom === lg || (lg && (lg.includes(x.name) || (x.nom && lg.includes(x.nom)))));
    return b ? b.name : lg;
  };
  const keep = (date, bien) => {
    const d = iso(date);
    // Même fenêtre que les revenus bancaires : sinon le revenu par nuit compare des périodes différentes
    if (!d || d.slice(0, 7) < months[0] || d.slice(0, 7) > months[months.length - 1]) return false;
    if (yearSel !== 'all' && d.slice(0, 4) !== String(yearSel)) return false;
    if (bienSel !== 'all' && bien !== bienSel) return false;
    return !!d;
  };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  const seen = new Set();
  // Airbnb : seules les lignes « Réservation » portent le brut et les frais de service.
  // Les lignes « Versement du co-hôte » (même code, mêmes nuits) sont la part reversée au co-hôte :
  // elles ne comptent pas comme séjour mais viennent en déduction du net perçu.
  const airRows = read('artemis_airbnb_rows'), airCodes = new Set();
  airRows.forEach(r => {
    if (!Array.isArray(r) || String(r[2] || '') !== 'Réservation') return;
    const n = parseInt(r[8]) || 0, code = String(r[4] || '');
    if (!code || !keep(r[6], bienOfLogement(String(r[10] || '')))) return;
    // Montants : toutes les lignes du séjour (y compris un supplément à 0 nuit) ; nuits : une seule fois par code
    C.Airbnb.brut += _num(r[20]); C.Airbnb.comm += Math.abs(_num(r[16])); C.Airbnb.net += _num(r[14]);
    airCodes.add(code);
    if (n <= 0 || seen.has('a' + code)) return;
    seen.add('a' + code);
    C.Airbnb.nuits += n; C.Airbnb.sejours++;
  });
  airRows.forEach(r => {
    if (Array.isArray(r) && /co-h[oô]te/i.test(String(r[2] || '')) && airCodes.has(String(r[4] || ''))) C.Airbnb.net += _num(r[14]);
  });
  // Le bien est porté par la ligne « (Payout) » (ID établissement) : on le rattache via la référence de versement
  const bkRows = read('artemis_booking_rows'), bkBien = {};
  bkRows.forEach(r => {
    if (!Array.isArray(r) || String(r[0] || '') !== '(Payout)') return;
    const id = (typeof BOOKING_ID_MAP !== 'undefined' && BOOKING_ID_MAP) ? BOOKING_ID_MAP[String(r[9] || '')] : null;
    const b = (params.biens || []).find(x => x.id === id);
    bkBien[String(r[1] || '')] = b ? b.name : bienOfLogement(String(r[10] || ''));
  });
  bkRows.forEach(r => {
    if (!Array.isArray(r) || String(r[0] || '') !== 'Réservation') return;
    const n = parseInt(r[8]) || 0, code = String(r[2] || '');
    if (n <= 0 || !code || seen.has('b' + code)) return;
    if (!keep(r[3], bkBien[String(r[1] || '')])) return;
    seen.add('b' + code);
    C.Booking.nuits += n; C.Booking.sejours++;
    const bb = _num(r[15]), bc = Math.abs(_num(r[16])) + Math.abs(_num(r[18]));
    C.Booking.brut += bb; C.Booking.comm += bc; C.Booking.net += bb - bc;
  });
  // Direct : réservations saisies dans ARTEMIS
  read('artemis_lcd').forEach(a => {
    const n = parseInt(a.nuits) || 0;
    if (n <= 0 || !keep(a.dateDebut, a.bienName)) return;
    C.Direct.nuits += n; C.Direct.sejours++; C.Direct.brut += +a.montant || 0; C.Direct.net += +a.montant || 0;
  });

  // ── Indicateurs ───────────────────────────
  const active = Object.keys(CH).filter(k => C[k].rev > 0 || C[k].nuits > 0);
  const total = active.reduce((t, k) => t + C[k].rev, 0);
  const lcdRev = LCD_CH.reduce((t, k) => t + C[k].rev, 0);
  const platRev = C.Airbnb.rev + C.Booking.rev;
  const dep = lcdRev ? platRev / lcdRev * 100 : 0;
  const comm = C.Airbnb.comm + C.Booking.comm, brutPlat = C.Airbnb.brut + C.Booking.brut;
  const lcdNuits = LCD_CH.reduce((t, k) => t + C[k].nuits, 0);
  const netOf = k => C[k].net > 0 ? C[k].net : C[k].rev;   // net des réservations si l'export est importé
  const revNuit = lcdNuits ? LCD_CH.reduce((t, k) => t + (C[k].nuits ? netOf(k) : 0), 0) / lcdNuits : null;
  const pct = v => (Math.abs(v) < 0.05 ? 0 : v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
  const eur2 = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const totPM = {}; months.forEach(m => totPM[m] = active.reduce((t, k) => t + (C[k].byM[m] || 0), 0));
  const last = months[months.length - 1];
  const ratio = (icon, label, value, color, sub) => `<div class="card kpi-card kpi-v2"><div class="kpi-v2-head"><div class="kpi-v2-lbl">${icon}<span>${label}</span></div></div><div class="kpi-v2-val" style="color:${color}">${value}</div><div class="kpi-v2-sub">${sub}</div></div>`;

  // Fiche par canal
  const stat = (lbl, val) => `<div class="plt-stat"><span>${lbl}</span><b>${val}</b></div>`;
  const chanCard = k => {
    const d = C[k], col = CH[k].color, share = total ? d.rev / total * 100 : 0;
    let stats = '';
    if (LCD_CH.includes(k)) {
      stats = stat('Séjours', d.sejours || '—') + stat('Nuits', d.nuits || '—') +
        stat('Durée moyenne', d.sejours ? (d.nuits / d.sejours).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' nuits' : '—') +
        stat('Revenu net / nuit', d.nuits ? eur2(netOf(k) / d.nuits) : '—') +
        (k === 'Direct' ? stat('Commission', '0 %') : stat('Commission', d.brut ? pct(d.comm / d.brut * 100) : '—'));
    } else if (k === 'Longue durée') {
      const nb = Object.keys(d.biens).length, mois = months.filter(m => d.byM[m]).length || 1;
      stats = stat('Biens loués', nb) + stat('Loyer moyen / mois', _fmtK(d.rev / mois)) + stat('Mois encaissés', months.filter(m => d.byM[m]).length + ' / ' + months.length);
    } else {
      stats = stat('Opérations', lines.filter(l => chanOf(l) === k).length);
    }
    if (k === 'Revenus annexes') {
      const cats = {};
      lines.filter(l => chanOf(l) === k).forEach(l => { const c = l.cat || l.categorie || 'Autre'; cats[c] = (cats[c] || 0) + (+l.montant); });
      stats += `<div class="plt-note">Revenus hors loyers et nuitées</div>`;
      const byCat = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      return `<div class="card plt-card" style="--ch:${col}">
        <div class="plt-card-head"><span class="plt-card-name">${CH[k].icon} ${k}</span><span class="plt-card-share">${pct(share)} des revenus</span></div>
        <div class="plt-card-val">+${_fmtK(d.rev)}</div>
        <div class="plt-bar"><i style="width:${Math.max(2, Math.round(share))}%"></i></div>
        <div class="plt-stats">${stats}</div>
        <div class="plt-sub">Par catégorie</div>${byCat.map(([c, v]) => `<div class="plt-row"><span>${c}</span><b>+${_fmtK(v)}</b></div>`).join('')}
        <div class="plt-sub" style="margin-top:14px">Par bien</div>${Object.entries(d.biens).sort((a, b) => b[1] - a[1]).map(([bn, v]) => `<div class="plt-row"><span>${bn}</span><b>+${_fmtK(v)}</b></div>`).join('')}
      </div>`;
    }
    if (k === 'Direct' && !d.sejours) stats += `<div class="plt-note">Aucune réservation directe saisie (Paramètres › LCD) : séjours et nuits indisponibles</div>`;
    const top = Object.entries(d.biens).sort((a, b) => b[1] - a[1]);
    return `<div class="card plt-card" style="--ch:${col}">
      <div class="plt-card-head"><span class="plt-card-name">${CH[k].icon} ${k}</span><span class="plt-card-share">${pct(share)} des revenus</span></div>
      <div class="plt-card-val">+${_fmtK(d.rev)}</div>
      <div class="plt-bar"><i style="width:${Math.max(2, Math.round(share))}%"></i></div>
      <div class="plt-stats">${stats}</div>
      ${top.length ? `<div class="plt-sub">Par bien</div>${top.map(([b, v]) => `<div class="plt-row"><span>${b}</span><b>+${_fmtK(v)}</b></div>`).join('')}` : ''}
    </div>`;
  };

  // Matrice bien × canal
  const allBiens = [...new Set(active.flatMap(k => Object.keys(C[k].biens)))].sort((a, b) => active.reduce((t, k) => t + (C[k].biens[b] || 0), 0) - active.reduce((t, k) => t + (C[k].biens[a] || 0), 0));
  const matrix = `<div class="tbl-wrap"><table>
      <thead><tr><th>Bien</th>${active.map(k => `<th style="text-align:right;color:${CH[k].color}">${k}</th>`).join('')}<th style="text-align:right">Total</th><th style="text-align:right">Part plateformes</th></tr></thead>
      <tbody>${allBiens.map(b => {
        const t = active.reduce((s2, k) => s2 + (C[k].biens[b] || 0), 0);
        const lcd = LCD_CH.reduce((s2, k) => s2 + (C[k].biens[b] || 0), 0), pl = (C.Airbnb.biens[b] || 0) + (C.Booking.biens[b] || 0);
        return `<tr><td style="font-weight:600">${b}</td>${active.map(k => `<td class="td-right">${C[k].biens[b] ? _fmtK(C[k].biens[b]) : '<span style="color:var(--text3)">—</span>'}</td>`).join('')}<td class="td-right" style="font-weight:700">${_fmtK(t)}</td><td class="td-right td-muted">${lcd ? pct(pl / lcd * 100) : '—'}</td></tr>`;
      }).join('')}</tbody>
    </table></div>`;

  el.innerHTML = `
    <div class="dash-grid-4" style="margin-bottom:18px">
      ${_kpiCard('💰', 'Revenus encaissés', '+' + _fmtK(total), 'var(--green)', months.length + ' mois · ' + active.length + ' canaux', _varBadges(totPM[last], last, totPM, true), months.map(m => totPM[m]))}
      ${ratio('🔗', 'Dépendance plateformes', lcdRev ? pct(dep) : '—', dep > 80 ? 'var(--red)' : dep > 60 ? 'var(--gold)' : 'var(--green)', 'part Airbnb + Booking dans la courte durée')}
      ${ratio('💸', 'Commissions payées', comm ? _fmtK(comm) : '—', 'var(--red)', brutPlat ? pct(comm / brutPlat * 100) + ' du montant brut des réservations' : 'importez les exports Airbnb / Booking')}
      ${ratio('🌙', 'Revenu net par nuit', revNuit ? eur2(revNuit) : '—', 'var(--cyan)', lcdNuits ? lcdNuits + ' nuits vendues en courte durée' : 'aucune réservation courte durée')}
    </div>

    <div class="dash-grid-2 lld-mid" style="align-items:stretch">
      <div class="card">
        <div class="card-title">Revenus par canal et par mois</div>
        <div class="ac-wrap"><canvas id="plt-combo"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Répartition des revenus</div>
        <div class="ac-wrap"><canvas id="plt-donut"></canvas></div>
        <div id="plt-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:1px"></div>
      </div>
    </div>

    <div class="plt-cards">${active.slice().sort((a, b) => Object.keys(CH).indexOf(a) - Object.keys(CH).indexOf(b)).map(chanCard).join('')}</div>

    <div class="card" style="margin-top:18px">
      <div class="card-title">Revenus par bien et par canal</div>
      ${matrix}
    </div>`;

  requestAnimationFrame(() => {
    ArtCharts.combo(document.getElementById('plt-combo'), {
      labels: months, stacked: true,
      bars: active.map(k => ({ name: k, values: months.map(m => C[k].byM[m] || 0), color: CH[k].color }))
    });
    ArtCharts.donut(document.getElementById('plt-donut'), {
      entries: active.map(k => [k, C[k].rev]).sort((a, b) => b[1] - a[1]),
      palette: active.slice().sort((a, b) => C[b].rev - C[a].rev).map(k => CH[k].color),
      centerLabel: 'Revenus', sign: '+', valueColor: '#22c97a', legendEl: document.getElementById('plt-donut-legend'), height: 220
    });
  });
}

// ─────────────────────────────────────────────
//  EXPORT EXCEL
// ─────────────────────────────────────────────
function exportDashboardExcel() {
  if (typeof XLSX === 'undefined') { showToast('Librairie Excel non disponible', 'var(--red)'); return; }
  const lines = _dashLines();
  if (!lines.length) { showToast('Aucune donnée', 'var(--red)'); return; }
  const wb = XLSX.utils.book_new();
  const rows = lines.map(l => ({
    Période: l._period, Date: l.date, Libellé: l.libelle, Catégorie: l.cat,
    Bien: l.bienName||l.bien||'', SCI: l.sci||'', Lot: l.lot||'',
    'Montant (€)': +l.montant||0, N1: l.n1||'', N2: l.n2||'',
    Plateforme: l.sourcePlatform||'',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Export');
  XLSX.writeFile(wb, `artemis-${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('✅ Export téléchargé');
}


function enterDashboard() {
  // Hide home screen and canvas
  const hs = document.getElementById('homeScreen');
  if (hs) hs.style.display = 'none';
  const hc = document.getElementById('homeCanvas');
  if (hc) hc.style.display = 'none';
  window._homeCanvasStop = true;

  // Make sure the app container is visible
  const app = document.querySelector('.app');
  if (app) app.style.display = 'block';

  document.body.classList.add('dash-mode');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sc6').classList.add('active');
  document.getElementById('stepper').style.display = 'none';
  // Init unified nav: hide all sub-groups except synthese
  setTimeout(() => {
    document.querySelectorAll('.dnav-subs').forEach(d => d.style.display = 'none');
    const synSubs = document.querySelector('.dnav-group[data-group="synthese"] .dnav-subs');
    if (synSubs) synSubs.style.display = 'flex';
  }, 0);
  renderDashboard();
  // Forcer les dates après que tout soit rendu et visible
  setTimeout(_applyDefaultDates, 0);
  setTimeout(_applyDefaultDates, 100);
  setTimeout(_applyDefaultDates, 500);
}




