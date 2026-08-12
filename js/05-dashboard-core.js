function _niceScale(minVal, maxVal, targetTicks) {
  targetTicks = targetTicks || 5;
  const range = maxVal - minVal || 1;
  const rawStep = range / targetTicks;
  // Puissance de 10 inférieure au step brut
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  // Arrondir le step à 1, 2, 2.5 ou 5 × la magnitude
  const niceSteps = [1, 2, 5, 10];
  let step = mag;
  for (const ns of niceSteps) {
    const candidate = ns * mag;
    if (candidate >= rawStep) { step = candidate; break; }
  }
  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1000) / 1000); // éviter les flottants
  }
  return { ticks, min: niceMin, max: niceMax };
}


let _chartMode = 'mensuel'; // 'mensuel' | 'cumul'
function _toggleChartMode(btn, redrawFn) {
  _chartMode = _chartMode === 'mensuel' ? 'cumul' : 'mensuel';
  // Met à jour tous les toggles visibles
  document.querySelectorAll('.chart-mode-toggle').forEach(b => {
    const isCumul = _chartMode === 'cumul';
    b.querySelector('.cmt-mensuel').style.background = isCumul ? 'transparent' : 'var(--bg4)';
    b.querySelector('.cmt-mensuel').style.color = isCumul ? 'var(--text2)' : 'var(--cyan)';
    b.querySelector('.cmt-cumul').style.background = isCumul ? 'var(--bg4)' : 'transparent';
    b.querySelector('.cmt-cumul').style.color = isCumul ? 'var(--cyan)' : 'var(--text2)';
  });
  if (redrawFn) redrawFn();
}
function _chartModeToggleHtml(redrawFnName) {
  const isCumul = _chartMode === 'cumul';
  return `<div class="chart-mode-toggle" style="display:inline-flex;align-items:center;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;overflow:hidden;font-size:10px;font-weight:700">
    <button class="cmt-mensuel" onclick="_toggleChartMode(this,${redrawFnName})" style="padding:4px 10px;border:none;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.04em;transition:all .15s;background:${isCumul?'transparent':'var(--bg4)'};color:${isCumul?'var(--text2)':'var(--cyan)'}">Mensuel</button>
    <button class="cmt-cumul"   onclick="_toggleChartMode(this,${redrawFnName})" style="padding:4px 10px;border:none;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.04em;transition:all .15s;background:${isCumul?'var(--bg4)':'transparent'};color:${isCumul?'var(--cyan)':'var(--text2)'}">Cumulé</button>
  </div>`;
}



let _dashTab = 'synthese';

function switchDashTab(btn) {
  _dashTab = btn.dataset.tab;
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dash-panel').forEach(p => p.style.display = 'none');
  document.getElementById('dp-' + _dashTab).style.display = 'block';
  _renderDashTab();
}

function switchNavHead(btn) {
  const tab = btn.dataset.tab;
  _dashTab = tab;

  // Reset all heads styling
  document.querySelectorAll('.dnav-head').forEach(b => {
    b.style.color = 'var(--text2)';
    b.style.borderBottom = '3px solid transparent';
  });
  // Active head
  btn.style.color = 'var(--cyan)';
  btn.style.borderBottom = '3px solid var(--cyan)';

  // Hide all sub groups, show only this one
  document.querySelectorAll('.dnav-subs').forEach(d => d.style.display = 'none');
  const subs = btn.closest('.dnav-group').querySelector('.dnav-subs');
  if (subs) subs.style.display = 'flex';

  // Remettre syn-filters dans dp-synthese si on quitte le SIG
  if (tab !== 'resultat') {
    const synFilters = document.getElementById('syn-filters');
    const synParent  = document.getElementById('dp-synthese');
    if (synFilters && synParent && !synParent.contains(synFilters)) {
      synParent.insertBefore(synFilters, synParent.firstChild);
    }
  }

  // Switch panel
  document.querySelectorAll('.dash-panel').forEach(p => p.style.display = 'none');
  document.getElementById('dp-' + tab).style.display = 'block';
  _renderDashTab();
}

function switchNavSub(btn, tab) {
  _synTab = btn.dataset.stab;
  btn.closest('.dnav-subs').querySelectorAll('.dnav-sub').forEach(b => {
    b.style.background = 'transparent';
    b.style.border = '1px solid transparent';
    b.style.color = 'var(--text2)';
  });
  btn.style.background = 'rgba(34,211,200,.12)';
  btn.style.border = '1px solid rgba(34,211,200,.3)';
  btn.style.color = 'var(--cyan)';
  _adjustSynFilters();
  renderSynTab();
}

function renderDashboard() {
  _migrateDBImmo();
  const db = getDB(); // _computeArtemisDateBounds appelé automatiquement
  _dashFillYears(db);
  _applyDefaultDates();
  _renderDashTab();
}

function _applyDefaultDates() {
  try {
    const raw = localStorage.getItem('artemis_db') || '{"periods":{}}';
    const db = JSON.parse(raw);
    const lines = Object.values(db.periods||{}).flatMap(p => p.lines||[]);
    const normD = d => {
      if (!d) return '';
      const s = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
      // DD/MM/YYYY français
      const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m1) return m1[3]+'-'+m1[2].padStart(2,'0')+'-'+m1[1].padStart(2,'0');
      // M/D/YY SheetJS (mois/jour/année 2 chiffres)
      const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (m2) return '20'+m2[3]+'-'+m2[1].padStart(2,'0')+'-'+m2[2].padStart(2,'0');
      return '';
    };
    const dates = lines.map(l=>normD(l.date)).filter(d=>d&&d.length===10).sort();
    if (!dates.length) return;
    const dMin = dates[0];
    const dMax = dates[dates.length-1];
    window._artemisDateMin = dMin;
    window._artemisDateMax = dMax;
    document.querySelectorAll('[id="syn-date-min"],[id="kpi-date-min"]').forEach(el => { if (!el.value) el.value = dMin; });
    document.querySelectorAll('[id="syn-date-max"],[id="kpi-date-max"]').forEach(el => { if (!el.value) el.value = dMax; });
  } catch(e) {}
}

function _renderDashTab() {
  _applyDefaultDates();
  const tab = _dashTab;
  if (tab === 'synthese')    renderSynthese();
  else if (tab === 'bilan')       renderBilan();
  else if (tab === 'resultat') {
    // Activer le premier sous-onglet par défaut si aucun actif
    const firstResBtn = document.querySelector('.res-stab');
    if (firstResBtn && !document.querySelector('.res-stab[style*="rgba(34,211"]')) switchResSubTab(firstResBtn);
    else renderResultat();
  }
  else if (tab === 'kpis')        renderKpis();
  else if (tab === 'plateformes') renderPlateformes();
}

// ── Shared helpers ──────────────────────────
function _getDB() { return getDB(); }

function _dashLines(yearSel, sciSel, lotSel, bienSel) {
  // Legacy wrapper - delegates to new filter system
  return _synLines();
}

// New unified filter function reading all syn-filters
function _synLines(opts) {
  opts = opts || {};
  const db = _getDB();
  let lines = Object.values(db.periods || {}).flatMap(p =>
    (p.lines || []).map(l => ({...l, _period: p.period, _year: String(p.year), _monthName: p.monthName}))
  );

  const sciSel   = opts.sci  !== undefined ? opts.sci  : _msGetVals('syn-sci');
  const bienSel  = opts.bien !== undefined ? opts.bien : _msGetVals('syn-bien');
  const catSel   = opts.cat  !== undefined ? opts.cat  : _msGetVals('syn-cat');
  const ebitSel  = opts.ebit !== undefined ? opts.ebit : _getV('syn-ebit');
  const dateMin  = opts.dmin !== undefined ? opts.dmin : (_getV('syn-date-min') || window._artemisDateMin || '');
  const dateMax  = opts.dmax !== undefined ? opts.dmax : (_getV('syn-date-max') || window._artemisDateMax || '');

  // sciSel/bienSel/catSel sont maintenant des tableaux ([] = tout, [a,b] = filtre multiple)
  if (sciSel && sciSel.length)  lines = lines.filter(l => sciSel.includes(l.sci));
  // NOTE: bienSel filter is applied AFTER _expandFG so FG lines get ventilated first
  if (catSel && catSel.length)  lines = lines.filter(l => catSel.includes(l.categorie||l.cat));

  if (ebitSel === 'oui') {
    lines = lines.filter(l => {
      const s = SCHEMA[l.categorie||l.cat||''];
      return s && s.ebit === 'OUI';
    });
  } else if (ebitSel === 'non') {
    lines = lines.filter(l => {
      const s = SCHEMA[l.categorie||l.cat||''];
      return !s || s.ebit !== 'OUI';
    });
  }

  // Normalize l.date to YYYY-MM-DD for comparison
  const normDate = d => {
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    // DD/MM/YYYY ou MM/DD/YYYY (année 4 chiffres)
    const m4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m4) return m4[3] + '-' + m4[2].padStart(2,'0') + '-' + m4[1].padStart(2,'0');
    // MM/D/YY (SheetJS raw:false, année 2 chiffres)
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m2) return '20'+m2[3] + '-' + m2[1].padStart(2,'0') + '-' + m2[2].padStart(2,'0');
    if (/^\d{4}-\d{2}$/.test(s)) return s + '-01';
    return '';
  };
  if (dateMin) lines = lines.filter(l => normDate(l.date) >= dateMin);
  if (dateMax) lines = lines.filter(l => normDate(l.date) <= dateMax);

  // Ventile les frais généraux PUIS filtre par bien
  lines = _expandFG(lines);
  if (bienSel && bienSel.length) lines = lines.filter(l => bienSel.includes(l.bienName||l.bien));

  return lines;
}

// ── Ventilation frais généraux → lignes par bien ──────────────────────────
// Remplace chaque ligne "Frais généraux" par N sous-lignes ventilées via QP
function _expandFG(lines) {
  const params = getParams();
  const qp = params.qp || {};
  const biens = params.biens || [];
  const result = [];

  for (const l of lines) {
    const isFG = l.isFG === true
      || l.bienName === 'Frais généraux' || l.bienName === 'Frais generaux'
      || l.bien     === 'Frais généraux' || l.bien     === 'Frais generaux';
    if (!isFG) {
      result.push(l);
      continue;
    }

    const cat = l.cat || l.categorie || '';
    const lot = l.lot || '';
    const montantOrig = parseFloat(l.montantOrigine || l.montant || 0);
    const qpCat = qp[cat];

    // No QP rule → keep as-is (will appear as "Frais généraux" unventilated)
    if (!qpCat) {
      console.warn('[ARTEMIS FG] Pas de règle QP pour catégorie:', JSON.stringify(cat), '| lot:', JSON.stringify(lot), '| QP disponibles:', Object.keys(qp));
      result.push(l);
      continue;
    }

    // Find matching group by lot
    let grp = qpCat.find(g => g.lot === lot);
    // Fallback: if no exact lot match, take first group
    if (!grp) grp = qpCat[0];

    if (!grp || !grp.biens || !Object.keys(grp.biens).length) {
      console.warn('[ARTEMIS FG] Groupe QP vide pour cat:', JSON.stringify(cat), '| lot:', JSON.stringify(lot), '| groupes:', JSON.stringify(qpCat));
      result.push(l);
      continue;
    }

    // Expand into one line per bien
    let expanded = false;
    const bienEntries = Object.entries(grp.biens).filter(([bienId, pct]) => {
      const bien = biens.find(b => b.id === bienId || b.name === bienId);
      return bien && pct > 0;
    });
    let distributed = 0;
    bienEntries.forEach(([bienId, pct], idx) => {
      const bien = biens.find(b => b.id === bienId || b.name === bienId);
      const isLast = idx === bienEntries.length - 1;
      const montantVentil = isLast
        ? Math.round((montantOrig - distributed) * 100) / 100
        : Math.round(montantOrig * pct * 100) / 100;
      distributed += montantVentil;
      if (montantVentil === 0) return;
      result.push({
        ...l,
        bienName: bien.name,
        bien: bien.name,
        bienId: bien.id,
        sci: bien.sci,
        lot: bien.lot || lot,
        montant: montantVentil,
        montantOrigine: montantOrig,
        _ventilated: true,
        _ventilPct: pct,
        _ventilSrc: 'Frais généraux'
      });
      expanded = true;
    });

    // If nothing expanded (biens not found), keep original
    if (!expanded) {
      console.warn('[ARTEMIS FG] Aucun bien trouvé pour cat:', JSON.stringify(cat), '| grp.biens:', JSON.stringify(grp.biens), '| biens dispo:', biens.map(b=>b.id));
      result.push(l);
    }
  }

  return result;
}

// Driver: returns {current, previous} line sets based on driver + date max
function _synLinesWithDriver() {
  const driver  = parseInt(_getV('syn-driver')) || 3;
  const dateMax = _getV('syn-date-max');

  if (!dateMax) {
    return { current: _synLines(), previous: [], driver };
  }

  // Safe date helper - parse YYYY-MM-DD without timezone issues
  const parseLocal = str => {
    const [y, m, d] = (str || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  // Format local date to YYYY-MM-DD
  const fmtLocal = d => {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };

  const dMax = parseLocal(dateMax);
  if (!dMax) return { current: _synLines(), previous: [], driver };

  // Current window: first day of (dMax.month - driver + 1) → dMax
  const dCurMin = new Date(dMax.getFullYear(), dMax.getMonth() - driver + 1, 1);
  // Previous window: one day before dCurMin → dPrevMax; go back driver months for dPrevMin
  const dPrevMax = new Date(dCurMin.getFullYear(), dCurMin.getMonth(), 0); // last day of prev month
  const dPrevMin = new Date(dPrevMax.getFullYear(), dPrevMax.getMonth() - driver + 1, 1);

  const curMinStr  = fmtLocal(dCurMin);
  const dMaxStr    = fmtLocal(dMax);
  const prevMinStr = fmtLocal(dPrevMin);
  const prevMaxStr = fmtLocal(dPrevMax);

  const current  = _synLines({ dmin: curMinStr,  dmax: dMaxStr });
  const previous = _synLines({ dmin: prevMinStr, dmax: prevMaxStr });

  return { current, previous, driver, dCurMin: curMinStr, dMax: dMaxStr, dPrevMin: prevMinStr, dPrevMax: prevMaxStr };
}

function _dashPeriods(yearSel, sciSel) {
  const db = _getDB();
  let periods = Object.values(db.periods || {});
  if (yearSel && yearSel !== 'all') periods = periods.filter(p => String(p.year) === yearSel);
  periods.sort((a,b) => a.period.localeCompare(b.period));
  return periods;
}

function _getV(id) { const el = document.getElementById(id); return el ? el.value : 'all'; }

function _fmtK(n) {
  const abs = Math.round(Math.abs(n||0));
  const s = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '-' : '') + s + ' €';
}
function _fmtDec(n) {
  const v = n || 0;
  const abs = Math.abs(v);
  const intPart = Math.floor(abs);
  const dec = Math.round((abs - intPart) * 100).toString().padStart(2, '0');
  const s = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
  return (v < 0 ? '-' : '') + s + ' €';
}
function _pct(n) { return (n||0).toFixed(1) + ' %'; }

function _sparkline(vals, color) {
  if (!vals || vals.length < 2) return '';
  const W = 100, H = 48;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const padX = 4, padY = 6;
  const xs = vals.map((_, i) => padX + (i / (vals.length - 1)) * (W - padX * 2));
  const ys = vals.map(v => padY + (1 - (v - min) / range) * (H - padY * 2));
  const line = xs.map((x, i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + ys[i].toFixed(1)).join(' ');
  const area = line + ' L' + xs[xs.length-1].toFixed(1) + ',' + H + ' L' + padX + ',' + H + ' Z';
  const lastX = xs[xs.length-1].toFixed(1);
  const lastY = ys[ys.length-1].toFixed(1);
  const gId = 'sg' + Math.random().toString(36).slice(2,8);
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;overflow:visible">'
    + '<defs><linearGradient id="' + gId + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.3"/>'
    + '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/>'
    + '</linearGradient></defs>'
    + '<path d="' + area + '" fill="url(#' + gId + ')"/>'
    + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + lastX + '" cy="' + lastY + '" r="3" fill="' + color + '"/>'
    + '</svg>';
}

function _kpiCard(icon, label, value, color, sub, varBadges, sparkData) {
  // varBadges: [{delta, pct, label, isGood}]
  const badgeHtml = varBadges && varBadges.length ? varBadges.map(b => {
    if (b.nodata) return (
      '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;margin-top:2px">'
      + '<span style="font-size:10px;color:rgba(126,143,168,0.55);font-weight:600;min-width:36px">'+b.label+'</span>'
      + '<span style="font-size:10px;color:rgba(126,143,168,0.35)">n/d</span>'
      + '</div>'
    );
    const col  = b.isGood ? '#22c97a' : '#f0566a';
    const sign = b.delta >= 0 ? '+' : '';
    const fmtD = (()=>{const _v=Math.round(b.delta);const _s=String(Math.abs(_v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f');return sign+_s+'\u202f€';})();
    const fmtP = (b.pct >= 0 ? '+' : '')+b.pct.toFixed(0)+'%';
    return (
      '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;margin-top:2px">'
      + '<span style="font-size:10px;color:rgba(126,143,168,0.7);font-weight:600;min-width:36px">'+b.label+'</span>'
      + '<span style="font-size:10px;font-weight:700;color:'+col+';font-family:monospace;">'+fmtD+'</span>'
      + '<span style="font-size:10px;font-weight:600;color:'+col+';font-family:monospace;opacity:.8">'+fmtP+'</span>'
      + '</div>'
    );
  }).join('') : '';
  const spark = sparkData && sparkData.length >= 2 ? _sparkline(sparkData, color) : '';
  return '<div class="card kpi-card" style="padding:0">'
    + '<div style="flex:1;min-width:0;padding:14px 0 14px 16px;overflow:hidden">'
    + '<div style="font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text2);margin-bottom:6px">' + icon + '&nbsp;' + label + '</div>'
    + '<div style="font-size:26px;font-weight:800;color:' + color + ';font-family:monospace;letter-spacing:-.02em;line-height:1;margin-bottom:' + (sub||badgeHtml?'6':'0') + 'px">' + value + '</div>'
    + (sub ? '<div style="font-size:10px;color:var(--text2);margin-bottom:5px">' + sub + '</div>' : '')
    + (badgeHtml ? '<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:6px">' + badgeHtml + '</div>' : '')
    + '</div>'
    + (spark ? '<div style="flex-shrink:0;padding:0 14px;display:flex;align-items:center;opacity:.85">' + spark + '</div>' : '')
    + '</div>';
}

// Helper: compute M-1 and N-1 variation badges for a given value and period map
function _varBadges(currentVal, currentPeriod, periodMap, higherIsBetter) {
  // currentPeriod: 'YYYY-MM', periodMap: {'YYYY-MM': value}
  if (!currentPeriod || !periodMap) return [];
  const [y, m] = currentPeriod.split('-').map(Number);
  const badges = [];

  // M-1
  const pm1 = new Date(y, m-2, 1); // month is 0-indexed
  const pm1Key = pm1.getFullYear()+'-'+String(pm1.getMonth()+1).padStart(2,'0');
  if (periodMap[pm1Key] != null && periodMap[pm1Key] !== 0) {
    const prev = periodMap[pm1Key];
    const delta = currentVal - prev;
    const pct = (delta / Math.abs(prev)) * 100;
    badges.push({ delta, pct, label: 'vs M-1', isGood: higherIsBetter ? delta >= 0 : delta <= 0 });
  } else {
    badges.push({ nodata: true, label: 'M-1' });
  }

  // N-1 (same month, previous year)
  const pn1Key = (y-1)+'-'+String(m).padStart(2,'0');
  if (periodMap[pn1Key] != null && periodMap[pn1Key] !== 0) {
    const prev = periodMap[pn1Key];
    const delta = currentVal - prev;
    const pct = (delta / Math.abs(prev)) * 100;
    badges.push({ delta, pct, label: 'vs N-1', isGood: higherIsBetter ? delta >= 0 : delta <= 0 });
  } else {
    badges.push({ nodata: true, label: 'N-1' });
  }

  return badges;
}

function _kpiCardBig(icon, label, value, color, bienEntries, decoIcon) {
  const n = parseInt(value) || 0;
  const deco = decoIcon || '🏘️';
  return `<div class="card kpi-card" style="padding:14px 16px;flex-direction:row;align-items:center;gap:0;position:relative;overflow:hidden">
    <div style="flex:1;min-width:0">
      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text2);margin-bottom:8px">${label}</div>
      <div style="font-size:38px;font-weight:900;color:${color};font-family:monospace;line-height:1">${n}</div>
    </div>
    <div style="font-size:52px;opacity:.35;flex-shrink:0;line-height:1;user-select:none">${deco}</div>
  </div>`;
}

function _kpiCardTop(icon, label, name, color, amount, pctNum, bienEntries) {
  const pct = parseFloat(pctNum) || 0;
  return `<div class="card kpi-card" style="padding:14px 16px;flex-direction:row;align-items:center;gap:0;position:relative;overflow:hidden">
    <div style="flex:1;min-width:0;overflow:hidden">
      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text2);margin-bottom:6px">${label}</div>
      <div style="font-size:13px;font-weight:700;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">${name}</div>
      <div style="font-size:22px;font-weight:800;font-family:monospace;color:${color};line-height:1">${amount}</div>
      <div style="font-size:10px;color:var(--text2);margin-top:4px">${pct.toFixed(1)}% du CA</div>
    </div>
    <div style="font-size:48px;opacity:.5;flex-shrink:0;line-height:1;user-select:none;color:#f5b731">${icon}</div>
  </div>`;
}

function _emptyState(msg) {
  return `<div class="dash-empty">📭 ${msg || 'Aucune donnée pour cette sélection'}</div>`;
}

function _barRow(label, val, maxVal, color, rightLabel) {
  const w = Math.max(Math.round((val / Math.max(maxVal,1)) * 100), 2);
  return `<div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
      <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${label}</span>
      <span style="color:${color};font-family:monospace;font-size:11px;white-space:nowrap">${rightLabel}</span>
    </div>
    <div style="background:var(--bg3);border-radius:3px;height:5px;overflow:hidden">
      <div style="background:${color};height:100%;width:${w}%;border-radius:3px;opacity:.85;transition:width .35s ease"></div>
    </div>
  </div>`;
}

function _sectionTitle(label) {
  return `<div class="dash-section-title">${label}</div>`;
}

function _dashFillYears(db) {
  const periods = Object.values(db.periods || {});
  const years = [...new Set(periods.map(p => String(p.year)).filter(Boolean))].sort((a,b) => b-a);
  const scis  = [...new Set(periods.flatMap(p => (p.lines||[]).map(l => l.sci).filter(Boolean)))].sort();
  const lots  = [...new Set(periods.flatMap(p => (p.lines||[]).map(l => l.lot).filter(Boolean)))].sort();
  const biens = [...new Set(periods.flatMap(p => (p.lines||[]).map(l => l.bienName||l.bien).filter(Boolean)))].sort();

  // Calculer la première et dernière date importée
  const allDates = periods.flatMap(p => (p.lines||[]).map(l => l.date).filter(Boolean)).sort();
  const _firstDate = allDates[0] ? allDates[0].slice(0,10) : '';
  const _lastDate  = allDates[allDates.length-1] ? allDates[allDates.length-1].slice(0,10) : '';

  // Injecter les dates par défaut si le champ est vide (KPIs uniquement — syn utilise le slider)
  const _setDefaultDate = (id, val) => {
    const el = document.getElementById(id);
    if (el && !el.value && val) el.value = val;
  };
  if (_firstDate && _lastDate) {
    _setDefaultDate('kpi-date-min', _firstDate);
    _setDefaultDate('kpi-date-max', _lastDate);
  }

  const fill = (id, items, allLabel) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="all">${allLabel}</option>` +
      items.map(v => `<option value="${v}" ${v===cur?'selected':''}>${v.replace('SCI - ','')}</option>`).join('');
  };

  // Synthèse
  fill('syn-year', years, 'Toutes années');
  _msFill('syn-sci',  scis,  'Toutes');
  fill('syn-lot',  lots,  'Tous');
  // Bilan
  fill('bil-year', years, 'Dernière période');
  fill('bil-sci',  scis,  'Toutes');
  // Résultat
  fill('res-year', years, 'Toutes années');
  fill('res-sci',  scis,  'Toutes');
  // KPIs — uniquement les biens en courte durée
  const lcdBiens = (getParams().biens||[]).filter(b => b.type === 'LCD').map(b => b.name).sort();
  fill('kpi-year', years, 'Toutes années');
  fill('kpi-bien', lcdBiens.length ? lcdBiens : biens, 'Tous les biens');
  _msFill('kpi-sci',   scis,     'Toutes');
  _msFill('kpi-bien2', lcdBiens.length ? lcdBiens : biens, 'Tous');
  // Plateformes
  fill('plt-year', years, 'Toutes années');
  fill('plt-bien', biens, 'Tous les biens');
}

// ─────────────────────────────────────────────
//  1. SYNTHESE FINANCIERE
// ─────────────────────────────────────────────
let _synTab = 'ca';

function switchSynTab(btn) {
  _synTab = btn.dataset.stab;
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _adjustSynFilters();
  renderSynTab();
}

function _adjustSynFilters() {
  // Show/hide filters depending on sub-tab
  const bienFilter = document.getElementById('syn-filter-bien');
  const granFilter = document.getElementById('syn-filter-gran');
  if (bienFilter) bienFilter.style.display = ['ca','depenses'].includes(_synTab) ? 'flex' : 'none';
  if (granFilter) granFilter.style.display = 'flex';
}

function renderSynTab() {
  _dashFillYearsSyn();
  if (_synTab === 'recap')          _renderSynRecap();
  else if (_synTab === 'ca')        _renderSynCA();
  else if (_synTab === 'depenses')  _renderSynDepenses();
  else if (_synTab === 'tresorerie') _renderSynTresorerie();
  else if (_synTab === 'resultat')  _renderSynResultat();
  // Si le SIG est visible, le re-rendre aussi (filtres partagés)
  const sigPanel = document.getElementById('res-panel-sig');
  if (sigPanel && sigPanel.style.display !== 'none') _renderSIG();
}

function renderSynthese() {
  _dashFillYears(_getDB());
  _dashFillYearsSyn();
  _adjustSynFilters();
  renderSynTab();
}

// ── Date range slider ────────────────────────────────────────
let _synDateTicks = []; // sorted array of all date strings YYYY-MM-DD

// Called when user picks a date directly in the native picker
function _synDateInputChange() {
  const dmin = document.getElementById('syn-date-min');
  const dmax = document.getElementById('syn-date-max');
  if (!dmin || !dmax) return;

  const vMin = dmin.value; // YYYY-MM-DD or ''
  const vMax = dmax.value;

  // Validate: must be a complete date (10 chars YYYY-MM-DD)
  const valid = v => v && v.length === 10 && !isNaN(new Date(v).getTime());

  // Auto-correct: if min > max, align the other bound
  if (valid(vMin) && valid(vMax) && vMin > vMax) {
    if (document.activeElement === dmin) dmax.value = vMin;
    else dmin.value = vMax;
  }

  // Sync slider thumbs to match picked dates
  if (_synDateTicks.length) {
    const findTick = val => {
      if (!val) return -1;
      let best = 0;
      for (let i = 0; i < _synDateTicks.length; i++) {
        if (_synDateTicks[i] <= val) best = i;
      }
      return best;
    };
    const rMin = document.getElementById('syn-date-min-r');
    const rMax = document.getElementById('syn-date-max-r');
    if (rMin && valid(dmin.value)) rMin.value = findTick(dmin.value);
    if (rMax && valid(dmax.value)) rMax.value = findTick(dmax.value);
    _synSliderRender();
  }

  // Only render if both dates are valid or both empty
  if ((!vMin || valid(vMin)) && (!vMax || valid(vMax))) {
    renderSynTab();
  }
}

function _synSliderInit(dates) {
  // dates: sorted unique array of YYYY-MM-DD strings
  _synDateTicks = dates;
  const n = dates.length - 1;
  if (n < 1) return;

  const rMin = document.getElementById('syn-date-min-r');
  const rMax = document.getElementById('syn-date-max-r');
  if (!rMin || !rMax) return;

  rMin.min = 0; rMin.max = n; rMin.value = 0;
  rMax.min = 0; rMax.max = n; rMax.value = n;

  // Remplir les inputs date avec les valeurs min/max par défaut
  const dMin = document.getElementById('syn-date-min');
  const dMax = document.getElementById('syn-date-max');
  if (dMin && !dMin.value && dates[0]) dMin.value = dates[0];
  if (dMax && !dMax.value && dates[n]) {
    const [y, m] = dates[n].split('-');
    const lastDay = new Date(+y, +m, 0).getDate();
    dMax.value = y + '-' + m + '-' + String(lastDay).padStart(2,'0');
  }

  _synSliderRender();
}

function _synSliderChange() {
  const rMin = document.getElementById('syn-date-min-r');
  const rMax = document.getElementById('syn-date-max-r');
  if (!rMin || !rMax) return;

  let vMin = parseInt(rMin.value), vMax = parseInt(rMax.value);
  if (vMin >= vMax) {
    if (document.activeElement === rMin) { vMin = Math.max(0, vMax - 1); rMin.value = vMin; }
    else { vMax = Math.min(_synDateTicks.length - 1, vMin + 1); rMax.value = vMax; }
  }

  _synSliderRender();

  const dMin = document.getElementById('syn-date-min');
  const dMax = document.getElementById('syn-date-max');
  // Min: first day of selected month
  if (dMin) dMin.value = _synDateTicks[vMin] || '';
  // Max: last day of selected month so the full month is included
  if (dMax && _synDateTicks[vMax]) {
    const [y, m] = _synDateTicks[vMax].split('-');
    const lastDay = new Date(+y, +m, 0).getDate();
    dMax.value = y + '-' + m + '-' + String(lastDay).padStart(2,'0');
  }

  renderSynTab();
}

function _synSliderRender() {
  const rMin = document.getElementById('syn-date-min-r');
  const rMax = document.getElementById('syn-date-max-r');
  const fill = document.getElementById('syn-slider-fill');
  const lblMin = document.getElementById('syn-date-min-lbl');
  const lblMax = document.getElementById('syn-date-max-lbl');
  if (!rMin || !rMax || !fill) return;

  const n    = _synDateTicks.length - 1 || 1;
  const vMin = parseInt(rMin.value);
  const vMax = parseInt(rMax.value);
  const pMin = (vMin / n) * 100;
  const pMax = (vMax / n) * 100;

  // Account for slider thumb offset (like Power BI)
  const wrap = fill.parentElement;
  const W = wrap ? wrap.offsetWidth : 0;
  const thumbW = 10; // half thumb width in px
  const pxMin = W > 0 ? (pMin/100) * (W - thumbW*2) + thumbW : 0;
  const pxMax = W > 0 ? (pMax/100) * (W - thumbW*2) + thumbW : W;
  if (W > 0) {
    fill.style.left  = pxMin + 'px';
    fill.style.width = (pxMax - pxMin) + 'px';
  } else {
    fill.style.left  = pMin + '%';
    fill.style.width = (pMax - pMin) + '%';
  }

  // Labels are now the native date inputs - no separate label update needed
}


// ════════════════════════════════════════════════
// MULTI-SELECT DROPDOWN — version stable
// ════════════════════════════════════════════════

// État interne : valeurs sélectionnées par id ([] = tout)
const _msState = {};
let _msRenderTimer = null;

// Fermer tous les dropdowns si on clique ailleurs
document.addEventListener('click', function(e) {
  if (!e.target.closest('.ms-wrap')) {
    document.querySelectorAll('.ms-wrap.open').forEach(w => w.classList.remove('open'));
  }
}, true);

function _msToggle(wrap) {
  const wasOpen = wrap.classList.contains('open');
  document.querySelectorAll('.ms-wrap.open').forEach(w => {
    if (w !== wrap) w.classList.remove('open');
  });
  wrap.classList.toggle('open', !wasOpen);
}

function _msBuild(wrap, items) {
  const id       = wrap.dataset.msid;
  const allLabel = wrap.dataset.all || 'Tous';
  const dropdown = wrap.querySelector('.ms-dropdown');
  if (!dropdown) return;

  const sel = new Set(_msState[id] || []);
  const allChecked = sel.size === 0;

  dropdown.innerHTML =
    `<label class="ms-item ms-all">
      <input type="checkbox" ${allChecked ? 'checked' : ''} data-val="__all__">
      <span>${allLabel}</span>
    </label>` +
    items.map(it =>
      `<label class="ms-item">
        <input type="checkbox" ${(allChecked || sel.has(it.value)) ? 'checked' : ''} data-val="${it.value.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">
        <span>${it.label}</span>
      </label>`
    ).join('');

  // Label du bouton
  function _updateLabel() {
    const labelEl = wrap.querySelector('.ms-label');
    if (!labelEl) return;
    const vals = _msState[id] || [];
    if (!vals.length) {
      labelEl.textContent = allLabel;
    } else if (vals.length === 1) {
      const cb = dropdown.querySelector('input[data-val="' + vals[0].replace(/"/g,'&quot;') + '"]');
      labelEl.textContent = cb ? cb.closest('label').querySelector('span').textContent : vals[0];
    } else {
      labelEl.textContent = 'Plusieurs';
    }
  }

  // Un seul listener stable sur onchange
  dropdown.onchange = function(e) {
    const cb  = e.target;
    if (cb.tagName !== 'INPUT') return;
    const val = cb.dataset.val;
    const allItems = [...dropdown.querySelectorAll('input[type=checkbox]:not([data-val="__all__"])')];
    const allCb    = dropdown.querySelector('input[data-val="__all__"]');

    if (val === '__all__') {
      allItems.forEach(c => { c.checked = true; });
      cb.checked = true;
      _msState[id] = [];
    } else {
      if (!cb.checked && allCb) allCb.checked = false;
      const checked = allItems.filter(c => c.checked).map(c => c.dataset.val);
      if (checked.length === allItems.length) {
        if (allCb) allCb.checked = true;
        _msState[id] = [];
      } else {
        _msState[id] = checked;
      }
    }

    _updateLabel();
    clearTimeout(_msRenderTimer);
    const cbName = wrap.dataset.onchange || 'renderSynTab';
    const cbFn = window[cbName];
    _msRenderTimer = setTimeout(() => { if (typeof cbFn === 'function') cbFn(); }, 80);
  };

  _updateLabel();
}

function _msFill(id, items, allLabel) {
  const wrap = document.getElementById('ms-' + id);
  if (!wrap) return;
  const normalized = items.map(v =>
    typeof v === 'string' ? {value: v, label: v.replace('SCI - ','')} : v
  );
  wrap.dataset.all = allLabel;
  // Filtrer l'état courant pour ne garder que les valeurs encore valides
  const validVals = new Set(normalized.map(it => it.value));
  if (_msState[id]) _msState[id] = _msState[id].filter(v => validVals.has(v));
  _msBuild(wrap, normalized);
}

function _msGetVals(id) {
  return _msState[id] || [];
}

function _dashFillYearsSyn() {
  const db = _getDB();
  const periods = Object.values(db.periods || {});
  const allLines = periods.flatMap(p => p.lines || []);

  const scis  = [...new Set(allLines.map(l=>l.sci).filter(Boolean))].sort();
  const biens = [...new Set(allLines.map(l=>l.bienName||l.bien).filter(Boolean))].filter(b => b !== 'Frais généraux' && b !== 'Frais generaux').sort();
  const cats  = [...new Set(allLines.map(l=>l.categorie||l.cat).filter(Boolean))].sort();

  const fill = (id, items, allLabel) => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="all">'+allLabel+'</option>' +
      items.map(v => '<option value="'+v+'"'+(v===cur?' selected':'')+'>'+v.replace('SCI - ','')+'</option>').join('');
  };

  _msFill('syn-sci',  scis,  'Toutes');
  _msFill('syn-bien', biens, 'Tous');
  _msFill('syn-cat',  cats,  'Toutes');

  // Build sorted unique date ticks (one per month: YYYY-MM-01)
  // l.date is stored as DD/MM/YYYY - parse accordingly
  const normD = d => {
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(0,7); // already YYYY-MM
    const m2 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m2) return m2[3] + '-' + m2[2].padStart(2,'0');
    return '';
  };
  const monthSet = new Set(
    allLines.map(l => { const ym = normD(l.date); return ym ? ym + '-01' : null; }).filter(Boolean)
  );
  const ticks = [...monthSet].sort();

  // Set date inputs to full range on first load only
  const dmin = document.getElementById('syn-date-min');
  const dmax = document.getElementById('syn-date-max');
  if (dmin && !dmin.value && ticks.length) dmin.value = ticks[0];
  if (dmax && !dmax.value && ticks.length) {
    // Last day of the last month
    const [y, m] = ticks[ticks.length-1].split('-');
    const lastDay = new Date(+y, +m, 0).getDate();
    dmax.value = y + '-' + m + '-' + String(lastDay).padStart(2,'0');
  }
  // Forcer sur tous les éléments (gestion du double DOM)
  if (ticks.length) {
    const _lastTick = ticks[ticks.length-1];
    const [_y, _m] = _lastTick.split('-');
    const _lastDay = new Date(+_y, +_m, 0).getDate();
    const _dMaxVal = _y + '-' + _m + '-' + String(_lastDay).padStart(2,'0');
    document.querySelectorAll('[id="syn-date-min"]').forEach(el => { if (!el.value) el.value = ticks[0]; });
    document.querySelectorAll('[id="syn-date-max"]').forEach(el => { if (!el.value) el.value = _dMaxVal; });
    document.querySelectorAll('[id="kpi-date-min"]').forEach(el => { if (!el.value) el.value = ticks[0]; });
    document.querySelectorAll('[id="kpi-date-max"]').forEach(el => { if (!el.value) el.value = _dMaxVal; });
  }
  if (typeof _applyDefaultDates === 'function') _applyDefaultDates();
}

// ── RÉCAP ──────────────────────────────────────
function _renderSynRecap() {
  const el = document.getElementById('syn-content'); if (!el) return;
  const lines   = _synLines();
  const periods = [...new Set(lines.map(l=>l._period))].sort().map(p => ({period:p, lines: lines.filter(l=>l._period===p)}));

  if (!lines.length) { el.innerHTML = _emptyState(); return; }

  // ── Period helpers ──────────────────────────
  const allPeriodKeys = periods.map(p => p.period);
  const lastP   = periods[periods.length - 1];
  const prevMP  = periods[periods.length - 2];

  // CA strict = Produits d'exploitation uniquement (selon schéma de gestion)
  // CA_CATS_R remplacé par _isCA/_isDep (globaux)
  const isRevLine = l => _isCA(l);
  const isChgLine = l => _isDep(l);
  const sumLines = (ls) => ({
    rev: ls.filter(isRevLine).reduce((s,l)=>s+(+l.montant),0),
    chg: ls.filter(isChgLine).reduce((s,l)=>s+(+l.montant),0)
  });
  const periodLines = (p) => p ? (p.lines||[]) : [];

  const cur  = sumLines(lines);
  const curM = sumLines(periodLines(lastP));
  const preM = sumLines(periodLines(prevMP));

  // N-1: same periods but year -1
  // Driver-based comparison window
  const { current: driverCur, previous: driverPrev, driver, dMax: dMaxStr } = _synLinesWithDriver();
  const prevYear = null; // legacy - using driver
  const linesN1  = driverPrev;
  const curN1    = sumLines(linesN1);

  const treso   = lines.reduce((s,l)=>s+(+l.montant),0);
  const tresoM  = periodLines(lastP).reduce((s,l)=>s+(+l.montant),0);
  const tresoPreM = periodLines(prevMP).reduce((s,l)=>s+(+l.montant),0);
  const tresoN1 = linesN1.reduce((s,l)=>s+(+l.montant),0);

  // ── Delta helpers ───────────────────────────
  const delta = (cur, prev) => prev !== 0 ? (cur - prev) : null;
  const pct   = (cur, prev) => prev !== 0 ? ((cur - prev) / Math.abs(prev) * 100) : null;
  const dFmt  = (val, isAbs) => {
    if (val === null) return '';
    const s = isAbs ? _fmtK(Math.abs(val)) : Math.abs(val).toFixed(1) + ' %';
    return (val >= 0 ? '▲ +' : '▼ ') + s;
  };
  const dColor = (val) => val === null ? 'var(--text2)' : val >= 0 ? 'var(--green)' : 'var(--red)';

  // ── Sparkline (SVG polyline from monthly values) ───
  const sparkline = (vals, color) => {
    if (vals.length < 2) return '';
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const range = mx - mn || 1;
    const W = 80, H = 28, pad = 2;
    const pts = vals.map((v,i) => {
      const x = pad + (i / (vals.length-1)) * (W - 2*pad);
      const y = H - pad - ((v - mn) / range) * (H - 2*pad);
      return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    return `<svg width="${W}" height="${H}" style="display:block"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>`;
  };

  const caByM  = periods.map(p => (p.lines||[]).filter(isRevLine).reduce((s,l)=>s+(+l.montant),0));
  const chgByM = periods.map(p => (p.lines||[]).filter(l=>+l.montant<0).reduce((s,l)=>s+Math.abs(+l.montant),0));
  const netByM = caByM.map((r,i) => r - chgByM[i]);
  const tresoByM = periods.map(p => (p.lines||[]).reduce((s,l)=>s+(+l.montant),0));

  // ── KPI card builder ────────────────────────
  const kpiPBI = (label, mainVal, mainColor, spark, dm1abs, dm1pct, dn1abs, dn1pct, tab) => {
    const dm1c = dColor(dm1abs), dn1c = dColor(dn1abs);
    return `<div class="card" onclick="_jumpToSynTab('${tab}')" style="cursor:pointer;padding:16px 18px;transition:transform .15s,box-shadow .15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.35)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text2);margin-bottom:8px">${label}</div>
      <div style="font-size:22px;font-weight:800;font-family:monospace;color:${mainColor};margin-bottom:10px;line-height:1">${mainVal}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div style="font-size:10px;line-height:1.8">
          ${dm1abs!==null?`<div><span style="color:var(--text2);margin-right:4px">Δ M−1</span><span style="color:${dm1c};font-family:monospace">${dFmt(dm1abs,true)}</span><span style="color:${dm1c};font-family:monospace;margin-left:6px;opacity:.75">${dFmt(dm1pct,false)}</span></div>`:''}
          ${dn1abs!==null?`<div><span style="color:var(--text2);margin-right:4px">Δ N−1</span><span style="color:${dn1c};font-family:monospace">${dFmt(dn1abs,true)}</span><span style="color:${dn1c};font-family:monospace;margin-left:6px;opacity:.75">${dFmt(dn1pct,false)}</span></div>`:''}
        </div>
        <div style="opacity:.7">${spark}</div>
      </div>
    </div>`;
  };

  // ── Variation EBIT - top movers by category (driver-based) ─
  const catCurMap = {}, catPrevMap = {};
  driverCur.forEach(l  => { const k=l.cat||l.categorie||'Autre'; catCurMap[k]=(catCurMap[k]||0)+(+l.montant); });
  driverPrev.forEach(l => { const k=l.cat||l.categorie||'Autre'; catPrevMap[k]=(catPrevMap[k]||0)+(+l.montant); });
  const allCats = [...new Set([...Object.keys(catCurMap),...Object.keys(catPrevMap)])];
  const movers = allCats.map(k => ({ cat:k, delta:(catCurMap[k]||0)-(catPrevMap[k]||0) }))
    .filter(m => Math.abs(m.delta) > 0.01)
    .sort((a,b) => b.delta - a.delta);
  const topPos = movers.filter(m=>m.delta>0).slice(0,4);
  const topNeg = movers.filter(m=>m.delta<0).slice(0,4);

  const moverRow = (m, isPos) =>
    `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${m.cat}</span>
      <span style="font-family:monospace;color:${isPos?'var(--green)':'var(--red)'};white-space:nowrap">${isPos?'▲ +':'▼ '}${_fmtK(Math.abs(m.delta))}</span>
    </div>`;

  // ── EBIT by year chart ───────────────────────
  const db = _getDB();
  const allPeriods = Object.values(db.periods||{}).sort((a,b)=>a.period.localeCompare(b.period));
  const yearMap = {};
  allPeriods.forEach(p => {
    const y = String(p.year);
    if (!yearMap[y]) yearMap[y] = 0;
    yearMap[y] += (p.lines||[]).reduce((s,l)=>s+(+l.montant),0);
  });
  const yearEntries = Object.entries(yearMap).sort((a,b)=>a[0]-b[0]);
  const maxAbsEbit  = Math.max(...yearEntries.map(([,v])=>Math.abs(v)),1);
  const BAR_H = 120;

  // Build a fixed window of years centered around actual data
  const curYear = new Date().getFullYear();
  const dataYears = yearEntries.map(([y])=>+y);
  const minY = dataYears.length ? Math.min(...dataYears) : curYear;
  const maxY = dataYears.length ? Math.max(...dataYears) : curYear;
  // Show 3 years before first data and 2 after last (min 7 slots total)
  const displayStart = Math.min(minY - 2, curYear - 3);
  const displayEnd   = Math.max(maxY + 2, curYear + 1);
  const allYears = [];
  for (let y = displayStart; y <= displayEnd; y++) allYears.push(String(y));

  const ebitBars = allYears.map(yr => {
    const val = yearMap[yr] ?? null;
    const hasData = val !== null;
    const h   = hasData ? Math.round(Math.abs(val)/maxAbsEbit * BAR_H) : 0;
    const col = !hasData ? 'transparent' : val>=0 ? 'var(--cyan)' : 'var(--red)';
    const labelCol = !hasData ? 'var(--border)' : val>=0 ? 'var(--cyan)' : 'var(--red)';
    const label = !hasData ? '' : `${val>=0?'+':''}${Math.abs(val)>=1000?Math.round(val/1000)+'k':Math.round(val)+'€'}`;
    return `<div style="width:64px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="font-size:9px;font-family:monospace;color:${labelCol};height:14px;line-height:14px">${label}</div>
      <div style="height:${BAR_H}px;display:flex;align-items:flex-end;justify-content:center;width:100%;position:relative">
        ${hasData && val >= 0 ? `<div style="width:58%;background:${col};opacity:.85;border-radius:4px 4px 0 0;height:${Math.max(h,3)}px;transition:height .4s ease"></div>` : ''}
        ${hasData && val < 0  ? `<div style="width:58%;background:${col};opacity:.85;border-radius:0 0 4px 4px;height:${Math.max(h,3)}px;position:absolute;top:0;transition:height .4s ease"></div>` : ''}
        ${!hasData ? `<div style="width:2px;height:100%;background:var(--border);opacity:.3;border-radius:1px"></div>` : ''}
      </div>
      <div style="font-size:9px;color:${yr==String(curYear)?'var(--cyan)':'var(--text2)'};font-weight:${yr==String(curYear)?'700':'400'}">${yr}</div>
    </div>`;
  }).join('');

  // ── Carte GPS des biens ─
  const params = getParams();
  const biensWithAddr = (params.biens||[]).map(b=>({...b, lat:String(b.lat||'').replace(',','.'), lng:String(b.lng||'').replace(',','.')})).filter(b=>b.lat&&b.lng&&!isNaN(+b.lat)&&!isNaN(+b.lng));
  const mapSection = '';

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:18px">
      ${kpiPBI('Chiffre d\'affaires (P&L)', (cur.rev>=0?'+':'')+_fmtK(cur.rev), 'var(--green)',
        sparkline(caByM,'var(--green)'),
        delta(curM.rev,preM.rev), pct(curM.rev,preM.rev),
        prevYear?delta(cur.rev,curN1.rev):null, prevYear?pct(cur.rev,curN1.rev):null, 'ca')}
      ${kpiPBI('Dépenses (P&L)', _fmtK(cur.chg), 'var(--red)',
        sparkline(chgByM,'var(--red)'),
        delta(curM.chg,preM.chg), pct(curM.chg,preM.chg),
        prevYear?delta(cur.chg,curN1.chg):null, prevYear?pct(cur.chg,curN1.chg):null, 'depenses')}
      ${kpiPBI('Trésorerie', (treso>=0?'+':'')+_fmtK(treso), treso>=0?'var(--cyan)':'var(--red)',
        sparkline(tresoByM, treso>=0?'var(--cyan)':'var(--red)'),
        delta(tresoM,tresoPreM), pct(tresoM,tresoPreM),
        prevYear?delta(treso,tresoN1):null, prevYear?pct(treso,tresoN1):null, 'tresorerie')}
      ${kpiPBI('Résultat net', (cur.rev+cur.chg>=0?'+':'')+_fmtK(cur.rev+cur.chg), (cur.rev+cur.chg)>=0?'var(--cyan)':'var(--red)',
        sparkline(netByM,(cur.rev+cur.chg)>=0?'var(--cyan)':'var(--red)'),
        delta(curM.rev+curM.chg,preM.rev+preM.chg), pct(curM.rev+curM.chg,preM.rev+preM.chg),
        prevYear?delta(cur.rev+cur.chg,curN1.rev+curN1.chg):null, prevYear?pct(cur.rev+cur.chg,curN1.rev+curN1.chg):null, 'resultat')}
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;margin-bottom:18px;max-width:100%">
      <div class="card">
        <div class="card-title">EBIT par année</div>
        <div style="overflow-x:auto">
          <div style="display:flex;align-items:flex-end;gap:0;width:100%;justify-content:space-between;padding:0 4px">
            ${ebitBars}
          </div>
        </div>
        <div style="height:1px;background:var(--border2);margin:6px 0 2px"></div>
        <div style="font-size:9px;color:var(--text2);text-align:center;letter-spacing:.05em">Année</div>
      </div>

      <div class="card">
        <div class="card-title">Variation EBIT${prevYear?' vs N−1':' - top mouvements'}</div>
        ${movers.length === 0 ? `<div style="color:var(--text2);font-size:12px;padding:12px 0">${prevYear?'Sélectionnez une année pour comparer':'Aucune donnée'}</div>` : `
        <div style="margin-bottom:10px">
          <div style="font-size:9px;font-weight:700;color:var(--green);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Impact positif</div>
          ${topPos.length ? topPos.map(m=>moverRow(m,true)).join('') : '<div style="font-size:11px;color:var(--text2);padding:4px 0">-</div>'}
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--red);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Impact négatif</div>
          ${topNeg.length ? topNeg.map(m=>moverRow(m,false)).join('') : '<div style="font-size:11px;color:var(--text2);padding:4px 0">-</div>'}
        </div>`}
      </div>
    </div>

    ${mapSection}`;

  // Render map after DOM is set
  if (biensWithAddr.length) setTimeout(() => _renderSynMap(biensWithAddr), 100);
}

function _renderSynMap(biens) {
  const container = document.getElementById('syn-map');
  if (!container) return;

  const COLS = {'LCD':'#22d3c8','LLD':'#f5b731'};

  container.style.cssText = 'border-radius:12px;overflow:hidden';
  container.innerHTML = `
    <div style="background:#0d1520;border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4a6080">📍 Portefeuille immobilier</span>
        <span style="font-size:11px;color:#4a6080">&mdash; ${biens.length} bien${biens.length>1?'s':''}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1px;background:rgba(255,255,255,.04)">
        ${biens.map(b => {
          const col = COLS[b.type] || '#9b6ef3';
          const sci = (b.sci||'').replace('SCI - ','');
          return `<div style="background:#0d1520;padding:14px 16px;transition:background .15s" onmouseover="this.style.background='#111d2e'" onmouseout="this.style.background='#0d1520'">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="background:${col}18;color:${col};border:1px solid ${col}30;border-radius:5px;font-size:9px;font-weight:700;padding:2px 7px;letter-spacing:.06em">${b.type||'LCD'}</span>
              <span style="font-size:9px;color:#2a3a50">${sci}</span>
            </div>
            <div style="font-size:13px;font-weight:700;color:#eaf0ff;margin-bottom:4px">${b.name}</div>
            <div style="font-size:10px;color:#4a6080">${b.lot||''}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}


// ── CHIFFRE D'AFFAIRES ────────────────────────

// ════════════════════════════════════════════════
// FILTRES PAR N2 — règles strictes de périmètre
// ════════════════════════════════════════════════
const _N2_CA      = new Set(["Produits d'exploitation", "Produits financiers", "Produits exceptionnels"]);
const _N2_DEP     = new Set(["Charges d'exploitation", "Charges financières", "Charges exceptionnelles"]);
const _N2_RESULT  = new Set([...Array.from(_N2_CA), ...Array.from(_N2_DEP)]);
const _N2_BILAN   = new Set(["Passifs financiers", "Immobilisations", "Trésorerie", "Actifs courants"]);

function _n2(l) {
  const s = SCHEMA[l.cat || l.categorie || ''];
  return s ? s.n2 : null;
}
function _isCA(l)     { return _N2_CA.has(_n2(l)); }
function _isDep(l)    { return _N2_DEP.has(_n2(l)); }
function _isResult(l) { return _N2_RESULT.has(_n2(l)); }
function _isBilan(l)  { return _N2_BILAN.has(_n2(l)); }
// Trésorerie = toutes les lignes bancaires = tout sauf amortissements (pas de ligne amort dans la base)
function _isTreso(l)  { return true; }

