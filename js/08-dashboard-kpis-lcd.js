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
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-bottom:20px;align-items:stretch">

      <!-- Taux d'occupation vs Point mort (%) -->
      <div class="card" style="display:flex;flex-direction:column;align-items:center;padding:18px 14px 14px;margin-top:0!important;">
        <div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin-bottom:12px;text-align:center">Taux d'occupation vs Point mort</div>
        <canvas id="${gaugeId1}" width="180" height="100" style="display:block;max-width:180px;flex:1;min-height:80px;max-height:120px"></canvas>
        <div style="display:flex;justify-content:space-between;width:100%;margin-top:6px;font-size:10px">
          <span style="color:var(--text2)">0%</span>
          <span style="color:var(--text2)">100%</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;justify-content:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--cyan);font-family:monospace">${txOcc.toFixed(1)}%</span>
            <span style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Occupation</span>
          </div>
          <div style="width:1px;background:var(--border2);margin:2px 0"></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--red);font-family:monospace">${pointMortPct.toFixed(1)}%</span>
            <span style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Point mort</span>
          </div>
        </div>
      </div>

      <!-- Jours d'occupation vs Point mort -->
      <div class="card" style="display:flex;flex-direction:column;align-items:center;padding:18px 14px 14px;margin-top:0!important;">
        <div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin-bottom:12px;text-align:center">Jours d'occupation vs Point mort</div>
        <canvas id="${gaugeId2}" width="180" height="100" style="display:block;max-width:180px;flex:1;min-height:80px;max-height:120px"></canvas>
        <div style="display:flex;justify-content:space-between;width:100%;margin-top:6px;font-size:10px">
          <span style="color:var(--text2)">0</span>
          <span style="color:var(--text2)">${nuitsDisponibles} nuits dispo</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;justify-content:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--purple);font-family:monospace">${nuitsLouees}</span>
            <span style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Nuits louées</span>
          </div>
          <div style="width:1px;background:var(--border2);margin:2px 0"></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:18px;font-weight:900;color:var(--red);font-family:monospace">${pointMortNuits}</span>
            <span style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Point mort</span>
          </div>
        </div>
      </div>

      <!-- Durée moyenne de séjour -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;padding:18px 14px;margin-top:0!important;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);margin-bottom:16px;text-align:center">Durée moyenne de séjour (en jour)</div>
        <div style="font-size:42px;font-weight:900;color:var(--text);font-family:monospace;line-height:1">${fmt2(dms)}</div>
        <div style="font-size:10px;color:var(--text2);margin-top:10px">${nbSejours} séjour${nbSejours>1?'s':''} · ${nuitsLouees} nuits</div>
      </div>

      <!-- RevPAR -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;padding:18px 14px;margin-top:0!important;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);margin-bottom:16px;text-align:center">Revenu par nuit disponible</div>
        <div style="font-size:42px;font-weight:900;color:var(--text);font-family:monospace;line-height:1">${fmt2(revpar)}&thinsp;€</div>
        <div style="font-size:10px;color:var(--text2);margin-top:10px">CA&thinsp;${_fmtK(rev)} ÷ ${nuitsDisponibles} nuits dispo</div>
      </div>
    </div>

    <!-- Compte de résultat en paliers -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
      <div class="card" style="margin-top:0!important">
        <div class="card-title">Compte de résultat en paliers</div>
        <canvas id="kpi-waterfall-cv" style="width:100%;display:block"></canvas>
      </div>
      <div class="card" style="margin-top:0!important;padding:0;overflow:hidden">
        <div class="card-title" style="padding:14px 16px 0">Détail par catégorie</div>
        <div id="kpi-detail-table" style="overflow-y:auto;max-height:320px;position:relative"></div>
      </div>
    </div>

    <!-- Graphiques tendance CF + CV -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
      <div class="card" style="margin-top:0!important">
        <div class="card-title">Évolution CF + Courbe de tendance + Prévision à M+10</div>
        <canvas id="kpi-trend-cf" style="width:100%;display:block;height:180px"></canvas>
      </div>
      <div class="card" style="margin-top:0!important">
        <div class="card-title">Évolution CV + Courbe de tendance + Prévision à M+10</div>
        <canvas id="kpi-trend-cv2" style="width:100%;display:block;height:180px"></canvas>
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
    const maxAbs = Math.max(...rows.map(r => Math.abs(r.val)), 1);
    const dpr = window.devicePixelRatio || 1;
    const W = cv2.parentElement.clientWidth - 44;
    const ROW_H = 36, GAP = 10, PAD_L = 110, PAD_R = 16, PAD_T = 8, PAD_B = 8;
    const H = rows.length * (ROW_H + GAP) - GAP + PAD_T + PAD_B;
    cv2.width = W * dpr; cv2.height = H * dpr;
    cv2.style.width = W + 'px'; cv2.style.height = H + 'px';
    const ctx = cv2.getContext('2d');
    ctx.scale(dpr, dpr);

    const barAreaW = W - PAD_L - PAD_R;

    rows.forEach((r, i) => {
      const y = PAD_T + i * (ROW_H + GAP);
      const pct = Math.abs(r.val) / maxAbs;
      const bw = Math.round(pct * barAreaW);
      const bx = PAD_L + (barAreaW - bw) / 2; // centré

      // Label
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillStyle = '#7e8fa8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, PAD_L - 8, y + ROW_H / 2);

      // Fond barre
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.roundRect(PAD_L, y, barAreaW, ROW_H, 5);
      ctx.fill();

      // Barre centrée
      ctx.fillStyle = r.color + 'cc';
      ctx.beginPath();
      ctx.roundRect(bx, y, bw, ROW_H, 5);
      ctx.fill();

      // Valeur dans la barre
      const lbl = _fmtK(Math.abs(r.val));
      ctx.font = 'bold 11px Outfit, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0b0d12';
      ctx.fillText(lbl, bx + bw / 2, y + ROW_H / 2);
    });

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

  const dpr = window.devicePixelRatio || 1;
  const W = cv.parentElement.clientWidth - 32;
  const H = 180;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = {t:16, r:16, b:32, l:56};
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const totalPts = n + FORECAST;
  const allTrend = Array.from({length: totalPts}, (_, i) => trend(i));
  const maxV = Math.max(...vals, ...allTrend.map(t => t + CI)) * 1.1;
  const minV = 0;
  const scX = i => PAD.l + (i / (totalPts - 1)) * plotW;
  const scY = v => PAD.t + plotH - ((v - minV) / (maxV - minV)) * plotH;

  // Fond
  ctx.clearRect(0, 0, W, H);

  // Grilles Y
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.t + (plotH / 4) * i;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
    const val = maxV - (maxV - minV) * (i / 4);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(_fmtK(val), PAD.l - 4, y + 3);
  }

  // Séparateur historique/prévision
  const sepX = scX(n - 1);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sepX, PAD.t); ctx.lineTo(sepX, H - PAD.b); ctx.stroke();
  ctx.setLineDash([]);

  // Zone de confiance (prévision)
  ctx.fillStyle = color + '22';
  ctx.beginPath();
  ctx.moveTo(scX(n - 1), scY(allTrend[n - 1] + CI));
  for (let i = n; i < totalPts; i++) ctx.lineTo(scX(i), scY(allTrend[i] + CI));
  for (let i = totalPts - 1; i >= n - 1; i--) ctx.lineTo(scX(i), scY(allTrend[i] - CI));
  ctx.closePath(); ctx.fill();

  // Ligne de tendance (historique)
  ctx.strokeStyle = 'rgba(180,180,180,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) { i === 0 ? ctx.moveTo(scX(i), scY(allTrend[i])) : ctx.lineTo(scX(i), scY(allTrend[i])); }
  ctx.stroke();
  ctx.setLineDash([]);

  // Ligne de tendance (prévision)
  ctx.strokeStyle = color + 'aa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(scX(n - 1), scY(allTrend[n - 1]));
  for (let i = n; i < totalPts; i++) ctx.lineTo(scX(i), scY(allTrend[i]));
  ctx.stroke();

  // Courbe principale
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  vals.forEach((v, i) => { i === 0 ? ctx.moveTo(scX(i), scY(v)) : ctx.lineTo(scX(i), scY(v)); });
  ctx.stroke();

  // Générer les YM de prévision (nécessaire pour tooltip et labels)
  const forecastYMs = [];
  const lastYM = sortedYMs[sortedYMs.length - 1];
  let [fy, fm] = lastYM.split('-').map(Number);
  for (let i = 1; i <= FORECAST; i++) {
    fm++;
    if (fm > 12) { fm = 1; fy++; }
    forecastYMs.push(fy + '-' + String(fm).padStart(2,'0'));
  }
  const allYMs = [...sortedYMs, ...forecastYMs];
  let savedImage = null; // sera rempli après le dessin complet

  // ── Tooltip au survol ──
  const tooltip = document.getElementById('kpi-trend-tooltip') || (() => {
    const t = document.createElement('div');
    t.id = 'kpi-trend-tooltip';
    t.style.cssText = 'position:fixed;pointer-events:none;display:none;background:#1a1f2e;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 14px;font-size:12px;font-family:Outfit,sans-serif;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);min-width:140px';
    document.body.appendChild(t);
    return t;
  })();

  cv.onmousemove = (e) => {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let closest = 0, minDist = Infinity;
    for (let i = 0; i < totalPts; i++) {
      const d = Math.abs(scX(i) - mx);
      if (d < minDist) { minDist = d; closest = i; }
    }
    const isHistory = closest < n;
    const ym = allYMs[closest];
    const parts = ym.split('-');
    const label = new Date(+parts[0], +parts[1]-1, 1).toLocaleDateString('fr-FR', {month:'long', year:'numeric'});
    const val = isHistory ? vals[closest] : null;
    const trendVal = allTrend[closest];
    const ciLow = Math.max(0, trendVal - CI);
    const ciHigh = trendVal + CI;
    const typeLabel = type === 'cf' ? 'Charges fixes' : 'Charges variables';

    tooltip.innerHTML = `
      <div style="font-weight:700;color:#fff;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px">${label}</div>
      ${isHistory ? `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px"><span style="color:rgba(255,255,255,0.5)">${typeLabel}</span><span style="color:${color};font-weight:700">${_fmtK(val)} €</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px"><span style="color:rgba(255,255,255,0.5)">Tendance</span><span style="color:rgba(200,200,200,0.9)">${_fmtK(trendVal)} €</span></div>
      ${!isHistory ? `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:2px"><span style="color:rgba(255,255,255,0.5)">Intervalle bas</span><span style="color:${color}88">${_fmtK(ciLow)} €</span></div><div style="display:flex;justify-content:space-between;gap:16px"><span style="color:rgba(255,255,255,0.5)">Intervalle haut</span><span style="color:${color}88">${_fmtK(ciHigh)} €</span></div>` : ''}
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top  = (e.clientY - 10) + 'px';

    // Restaurer le canvas original puis dessiner overlay
    if (savedImage) ctx.putImageData(savedImage, 0, 0);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.moveTo(scX(closest), PAD.t);
    ctx.lineTo(scX(closest), H - PAD.b);
    ctx.stroke();
    ctx.setLineDash([]);
    if (isHistory) {
      ctx.beginPath();
      ctx.arc(scX(closest), scY(vals[closest]), 4, 0, Math.PI*2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  };

  cv.onmouseleave = () => {
    tooltip.style.display = 'none';
    if (savedImage) ctx.putImageData(savedImage, 0, 0);
  };

  // Labels axe X (quelques mois)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px Outfit, sans-serif';
  ctx.textAlign = 'center';
  const step = Math.ceil(allYMs.length / 8);
  allYMs.forEach((ym, i) => {
    if (i % step !== 0 && i !== allYMs.length - 1) return;
    const parts = ym.split('-');
    const label = new Date(+parts[0], +parts[1] - 1, 1).toLocaleDateString('fr-FR', {month:'short', year:'2-digit'});
    ctx.fillText(label, scX(i), H - PAD.b + 12);
  });

  // Sauvegarder après tout le dessin (labels inclus)
  savedImage = ctx.getImageData(0, 0, cv.width, cv.height);
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
  const thStyle = (col) => `padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);cursor:pointer;user-select:none;white-space:nowrap;`;
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
        <td style="padding:9px 14px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:${col};white-space:nowrap">${prefix} ${_fmtV(val)}</td>
        <td style="padding:9px 14px;text-align:right;font-family:monospace;font-size:13px;color:${col};opacity:.8;white-space:nowrap">${_fmtN(perNuit)}</td>
      </tr>`;
    }).join('')}</tbody>
    <tfoot><tr style="border-top:2px solid var(--border2);background:var(--bg3);position:sticky;bottom:0;z-index:2">
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:var(--text)">Total</td>
      <td style="padding:10px 14px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:${totalCol};white-space:nowrap">${totalPrefix} ${_fmtV(totalVal)}</td>
      <td style="padding:10px 14px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:${totalCol};white-space:nowrap">${_fmtN(totalNuit)}</td>
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
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.offsetWidth || 180, H = cv.offsetHeight || 100;
  cv.width  = W * dpr; cv.height = H * dpr;
  cv.style.width = W+'px'; cv.style.height = H+'px';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = W / 2, cy = H - 10;
  const R = Math.min(W, H * 2) / 2 - 8;
  const startA = Math.PI;
  const max = maxVal || 100;
  const valuePct  = Math.min(value / max, 1);
  const threshPct = Math.min(threshold / max, 1);
  const arcColor  = color || '#22d3c8';

  // Fond gris
  ctx.beginPath();
  ctx.arc(cx, cy, R, startA, startA + Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arc valeur
  const valA = startA + valuePct * Math.PI;
  if (valuePct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, startA, valA);
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Marqueur point mort (trait rouge épais)
  const pmA  = startA + threshPct * Math.PI;
  const pmX  = cx + (R + 6) * Math.cos(pmA);
  const pmY  = cy + (R + 6) * Math.sin(pmA);
  const pmX2 = cx + (R - 20) * Math.cos(pmA);
  const pmY2 = cy + (R - 20) * Math.sin(pmA);
  ctx.beginPath();
  ctx.moveTo(pmX, pmY);
  ctx.lineTo(pmX2, pmY2);
  ctx.strokeStyle = '#f0566a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Valeur centrale
  ctx.font = 'bold 16px Outfit, monospace';
  ctx.fillStyle = '#e2e8f3';
  ctx.textAlign = 'center';
  ctx.fillText(centerLabel !== undefined ? String(centerLabel) : (valuePct * 100).toFixed(1) + '%', cx, cy - R * 0.25);
}

// ── LLD ────────────────────────────────────────
function _renderKpiLLD() {
  const el = document.getElementById('kpi-content');
  const year    = _getV('kpi-year');
  const bienSel = _getV('kpi-bien');
  const doCmp   = _getV('kpi-cmp') === 'prev';
  const params  = getParams();

  const lldBienNames = (params.biens||[]).filter(b=>b.type==='LLD').map(b=>b.name);

  const allLines = _dashLines(year,'all','all',bienSel);
  const lines = allLines.filter(l => {
    const bname = l.bienName||l.bien||'';
    return lldBienNames.some(n=>bname.includes(n)) || l.type==='LLD';
  });

  const prevYear = doCmp && year!=='all' ? String(+year-1) : null;
  const linesP = prevYear ? _dashLines(prevYear,'all','all',bienSel).filter(l=>{
    const bname=l.bienName||l.bien||'';
    return lldBienNames.some(n=>bname.includes(n))||l.type==='LLD';
  }) : [];

  if (!lines.length) { el.innerHTML = _emptyState('Aucune donnée LLD pour cette sélection'); return; }

  const rev  = lines.filter(l=>+l.montant>0).reduce((s,l)=>s+(+l.montant),0);
  const chg  = lines.filter(l=>+l.montant<0).reduce((s,l)=>s+(+l.montant),0);
  const net  = rev+chg;
  const revP = linesP.filter(l=>+l.montant>0).reduce((s,l)=>s+(+l.montant),0);
  const chgP = linesP.filter(l=>+l.montant<0).reduce((s,l)=>s+(+l.montant),0);

  const dRev = _kpiDelta(rev,revP), dChg = _kpiDelta(chg,chgP), dNet = _kpiDelta(net,revP+chgP);

  // By bien
  const bienMap = {};
  lines.forEach(l => {
    const k = l.bienName||l.bien||'Non attribué';
    if(!bienMap[k]) bienMap[k]={rev:0,chg:0};
    if(+l.montant>0) bienMap[k].rev+=(+l.montant);
    else bienMap[k].chg+=(+l.montant);
  });

  // Monthly revenue trend
  const periods = _dashPeriods(year,'all');
  const revByM = periods.map(p=>(p.lines||[]).filter(l=>{
    const bname=l.bienName||l.bien||'';
    return (lldBienNames.some(n=>bname.includes(n))||l.type==='LLD')&&+l.montant>0;
  }).reduce((s,l)=>s+(+l.montant),0));
  const _mNames2 = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const mLabels = periods.map(p => {
    const [pY2, pM2] = (p.period||'').split('-');
    const nm = _mNames2[(parseInt(pM2)||1)-1] || pM2 || '';
    return nm + ' ' + (pY2 || p.year || '');
  });
  const maxM = Math.max(...revByM,1);
  const barW = Math.max(periods.length*64,300);

  const mBars = periods.map((p,i)=>{
    const h=Math.round((revByM[i]/maxM)*90);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:56px">
      <div style="font-size:8px;font-family:monospace;color:var(--gold)">+${Math.round(revByM[i]/1000*10)/10}k</div>
      <div style="height:90px;display:flex;align-items:flex-end;width:100%;justify-content:center">
        <div style="width:65%;background:var(--gold);opacity:.8;border-radius:3px 3px 0 0;height:${Math.max(h,2)}px"></div>
      </div>
      <div style="font-size:8px;color:var(--text2);text-align:center">${mLabels[i]}</div>
    </div>`;
  }).join('');

  const bienRows = Object.entries(bienMap).sort((a,b)=>b[1].rev-a[1].rev).map(([bien,d])=>{
    const n=d.rev+d.chg;
    return `<tr>
      <td style="font-weight:600">${bien}</td>
      <td class="td-pos">+${_fmtK(d.rev)}</td>
      <td class="td-neg">${_fmtK(d.chg)}</td>
      <td class="td-right" style="color:${n>=0?'var(--gold)':'var(--red)'};font-weight:700">${n>=0?'+':''}${_fmtK(n)}</td>
      <td class="td-right td-muted">${d.rev?_pct(Math.abs(d.chg)/d.rev*100):'-'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="dash-grid-4" style="margin-bottom:18px">
      ${_kpiCard('🏡','Loyers encaissés','+'+_fmtK(rev),'var(--gold)',dRev!==null?`<span style="color:${_kpiDeltaColor(dRev)}">${_kpiDeltaLabel(dRev)}</span>`:'')}
      ${_kpiCard('📉','Charges LLD',_fmtK(chg),'var(--red)',dChg!==null?`<span style="color:${_kpiDeltaColor(dChg)}">${_kpiDeltaLabel(dChg)}</span>`:'')}
      ${_kpiCard('📊','Résultat LLD',(net>=0?'+':'')+_fmtK(net),net>=0?'var(--gold)':'var(--red)',dNet!==null?`<span style="color:${_kpiDeltaColor(dNet)}">${_kpiDeltaLabel(dNet)}</span>`:'')}
      ${_kpiCard('🏠','Nb biens LLD',Object.keys(bienMap).length,'var(--cyan)')}
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">Loyers - évolution mensuelle</div>
      <div style="overflow-x:auto"><div style="display:flex;align-items:flex-end;gap:4px;min-width:${barW}px;padding:4px">${mBars}</div></div>
    </div>
    <div class="card">
      <div class="card-title">KPIs par bien - LLD</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Bien</th><th style="text-align:right">Loyers</th><th style="text-align:right">Charges</th><th style="text-align:right">Net</th><th style="text-align:right">Taux charge</th></tr></thead>
        <tbody>${bienRows||'<tr><td colspan="5" style="color:var(--text2)">Aucune donnée LLD</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

// ─────────────────────────────────────────────
//  5. PLATEFORMES
// ─────────────────────────────────────────────
function renderPlateformes() {
  const el = document.getElementById('plt-content');
  if (!el) return;
  _dashFillYears(_getDB());

  const lines = _dashLines(_getV('plt-year'), 'all', 'all', _getV('plt-bien'));
  if (!lines.length) { el.innerHTML = _emptyState(); return; }

  const pltMap = {};
  lines.filter(l=>+l.montant>0).forEach(l => {
    const plt = l.sourcePlatform || 'Direct / Autre';
    if (!pltMap[plt]) pltMap[plt] = {rev:0, biens:{}};
    pltMap[plt].rev += +l.montant;
    const b = l.bienName||l.bien||'?';
    pltMap[plt].biens[b] = (pltMap[plt].biens[b]||0)+(+l.montant);
  });

  const total  = Object.values(pltMap).reduce((s,v)=>s+v.rev,0);
  const maxPlt = Math.max(...Object.values(pltMap).map(v=>v.rev),1);

  const PLT_COLORS = {
    'Airbnb': 'var(--gold)',
    'Booking': 'var(--purple)',
    'Direct / Autre': 'var(--cyan)',
  };

  const pltCards = Object.entries(pltMap).sort((a,b)=>b[1].rev-a[1].rev).map(([plt,d]) => {
    const color = PLT_COLORS[plt] || 'var(--text2)';
    const pct   = total ? d.rev/total*100 : 0;
    const bienRows = Object.entries(d.biens).sort((a,b)=>b[1]-a[1]).map(([b,v]) =>
      `<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span>${b}</span>
        <span style="font-family:monospace;color:${color}">+${_fmtK(v)}</span>
      </div>`
    ).join('');
    return `<div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:13px;font-weight:700;color:${color}">${plt}</span>
        <span style="font-size:11px;color:var(--text2)">${_pct(pct)} du total</span>
      </div>
      <div style="font-size:20px;font-weight:800;color:${color};font-family:monospace;margin-bottom:12px">+${_fmtK(d.rev)}</div>
      <div style="background:var(--bg3);border-radius:3px;height:4px;margin-bottom:16px;overflow:hidden">
        <div style="background:${color};height:100%;width:${Math.round(pct)}%;border-radius:3px;opacity:.85"></div>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--text2);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Par bien</div>
      ${bienRows || '<div style="color:var(--text2);font-size:11px">-</div>'}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="dash-grid-4" style="margin-bottom:20px">
      ${_kpiCard('🏠','Total revenus','+'+_fmtK(total),'var(--green)')}
      ${Object.entries(pltMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,3).map(([plt,d]) =>
        _kpiCard('-', plt, '+'+_fmtK(d.rev), PLT_COLORS[plt]||'var(--text2)', _pct(total?d.rev/total*100:0)+' du total')
      ).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      ${pltCards || _emptyState()}
    </div>`;
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




