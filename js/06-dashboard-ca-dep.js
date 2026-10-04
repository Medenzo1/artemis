function _renderSynCA() {
  const el = document.getElementById('syn-content'); if (!el) return;
  const year  = _getV('syn-year');
  const sci   = _getV('syn-sci');
  const lot   = _getV('syn-lot');
  const bien  = _getV('syn-bien');
  const gran  = 'mensuel';

  const _allLines = _synLines();
  // CA = only lines whose category is "Produits d'exploitation" in SCHEMA
  // CA strictement = n1:"Compte de résultat" + n2:"Produits d'exploitation" + montant > 0
  const lines = _allLines.filter(l => _isCA(l));
  const periods = [...new Set(_allLines.map(l=>l._period))].sort().map(p=>({period:p,lines:_allLines.filter(l=>l._period===p)}));
  if (!lines.length) { el.innerHTML = _emptyState('Aucun chiffre d\'affaires'); return; }

  const totalCA = lines.reduce((s,l)=>s+(+l.montant),0);

  // CA by bien
  const bienMap = {};
  lines.forEach(l => {
    const k = l.bienName||l.bien||'Non attribué';
    bienMap[k] = (bienMap[k]||0)+(+l.montant);
  });
  const bienEntries = Object.entries(bienMap).sort((a,b)=>b[1]-a[1]);
  const maxBien = bienEntries[0]?.[1]||1;

  // CA by period
  let periodMap = {};
  if (gran === 'mensuel') {
    periods.forEach(p => {
      const rev = (p.lines||[]).filter(l=>_isCA(l)).reduce((s,l)=>s+(+l.montant),0);
      const [pY, pM] = (p.period||'').split('-');
      const mNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
      const mLbl = mNames[(parseInt(pM)||1)-1] || pM;
      periodMap[mLbl + ' ' + pY] = rev;
    });
  } else {
    lines.forEach(l => {
      const y = l._year||'?';
      periodMap[y] = (periodMap[y]||0)+(+l.montant);
    });
  }
  const pEntries = Object.entries(periodMap);
  const maxP = Math.max(...pEntries.map(([,v])=>v),1);
  const barW = Math.max(pEntries.length*72,400);

  const bienRows = bienEntries.map(([b,v]) =>
    '<tr>'+
      '<td>'+b+'</td>'+
      '<td class="td-pos">+'+_fmtK(v)+'</td>'+
      '<td class="td-right" style="color:var(--text2);font-size:11px">'+_pct(v/totalCA*100)+'</td>'+
    '</tr>'
  ).join('');

  const chartId = 'ca-area-chart-' + Date.now();

  // Build monthly CA map for M-1 / N-1 badges
  const caPeriodMap = {};
  periods.forEach(p => {
    caPeriodMap[p.period] = (p.lines||[]).filter(l => _isCA(l)).reduce((s,l) => s+(+l.montant), 0);
  });
  const lastCaPeriod = periods.length ? periods[periods.length-1].period : null;
  const lastCaVal = lastCaPeriod ? (caPeriodMap[lastCaPeriod]||0) : totalCA;

  el.innerHTML =
    '<div class="dash-grid-4" style="margin-bottom:20px">'+
      _kpiCard('💰','CA total','+'+_fmtK(totalCA),'var(--green)',pEntries.length+' période'+(pEntries.length>1?'s':''), _varBadges(lastCaVal, lastCaPeriod, caPeriodMap, true), Object.keys(caPeriodMap).sort().map(k=>caPeriodMap[k]))+
      _kpiCardBig('🏠','Nb biens actifs',''+bienEntries.length,'var(--cyan)', bienEntries)+
      _kpiCard('📈','Moy / période','+'+_fmtK(totalCA/Math.max(pEntries.length,1)),'var(--gold)', '', (()=>{ const moyMap={}; Object.entries(caPeriodMap).forEach(([p,v])=>{ moyMap[p]=v; }); return _varBadges(lastCaVal, lastCaPeriod, moyMap, true); })(), Object.keys(caPeriodMap).sort().map(k=>caPeriodMap[k]))+
      _kpiCardTop('🥇','Meilleur bien',bienEntries[0]?.[0]||'-','var(--purple)', bienEntries[0]?'+'+_fmtK(bienEntries[0][1]):'-', bienEntries[0]&&totalCA?((bienEntries[0][1]/totalCA)*100).toFixed(1):0, bienEntries)+
    '</div>'+
    '<div class="card" style="margin-bottom:18px">'+
      '<div class="card-title" style="justify-content:space-between">'+
        '<span>CA — évolution mensuelle</span>'+
        _chartModeToggleHtml('window._redrawCaChart')+
      '</div>'+
      '<div class="ac-wrap">'+
        '<canvas id="'+chartId+'" style="width:100%;height:100%"></canvas>'+
      '</div>'+
    '</div>'+
    '<div class="dash-grid-2" style="align-items:stretch">'+
      '<div class="card" style="display:flex;flex-direction:column;height:100%">'+
        '<div class="card-title">Opérations CA</div>'+
        '<div id="ca-ops-wrap" style="overflow-y:auto;max-height:660px;border-radius:8px;border:1px solid var(--border)">'+
          '<table id="ca-ops-table" style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">'+
            '<colgroup>'+
              '<col style="width:90px">'+   
              '<col style="width:115px">'+  
              '<col style="width:130px">'+  
              '<col style="width:130px">'+  
              '<col style="width:95px">'+   
            '</colgroup>'+
            '<thead style="position:sticky;top:0;z-index:2">'+
              '<tr style="background:var(--bg3);border-bottom:1px solid var(--border2)">'+
                '<th onclick="_sortCAOps(this,0)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="0" data-sort-dir="desc">DATE <span class="sort-arrow">↓</span></th>'+
                '<th onclick="_sortCAOps(this,1)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="1" data-sort-dir="">BIEN <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortCAOps(this,2)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="2" data-sort-dir="">CATÉGORIE <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortCAOps(this,3)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="3" data-sort-dir="">LIBELLÉ <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortCAOps(this,4)" style="padding:8px 10px;text-align:right;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="4" data-sort-dir="">MONTANT <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
              '</tr>'+
            '</thead>'+
            '<tbody id="ca-ops-body">'+
              (()=>{ window._caOpsLines = lines.slice().map(l=>({
                d: (()=>{ const raw=l.date||''; if(/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10); const m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); return l._period||''; })(),
                dDisplay: (()=>{ const raw=l.date||''; if(/^\d{4}-\d{2}-\d{2}/.test(raw)){const[y,m,d]=raw.slice(0,10).split('-');return d+'/'+m+'/'+y;} const m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if(m) return m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/'+m[3]; return l._period||'-'; })(),
                bien: l.bienName||l.bien||'—',
                cat: l.cat||l.categorie||'—',
                lib: (typeof normaliseLib==='function' ? normaliseLib(l.libelle||l.label||l.description||'') : (l.libelle||l.label||l.description||'—')) || '—',
                amt: +l.montant
              }));
              window._caOpsSortCol = 0; window._caOpsSortDir = 'desc';
              return _buildCAOpsRows(window._caOpsLines.slice().sort((a,b)=>b.d.localeCompare(a.d)));})() +
            '</tbody>'+
          '</table>'+
        '</div>'+
        '<div style="padding:10px 0 2px;font-size:11px;color:var(--text2);text-align:right">'+lines.length+' opération'+(lines.length>1?'s':'')+' · total <span style="color:var(--green);font-weight:700">+'+_fmtK(totalCA)+'</span></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:16px;height:100%">'+
        '<div class="card">'+
          '<div class="card-title">Détail CA par bien</div>'+
          '<div class="tbl-wrap"><table>'+
            '<thead><tr><th>Bien</th><th style="text-align:right">CA</th><th style="text-align:right">Part</th></tr></thead>'+
            '<tbody>'+bienRows+'</tbody>'+
            '<tfoot><tr style="border-top:2px solid var(--border2)">'+
              '<td style="font-weight:700">Total</td>'+
              '<td class="td-pos" style="font-weight:700">+'+_fmtK(totalCA)+'</td>'+
              '<td class="td-right" style="color:var(--text2)">100%</td>'+
            '</tr></tfoot>'+
          '</table></div>'+
        '</div>'+
        '<div class="card" id="ca-cat-donut-card" style="flex:1;display:flex;flex-direction:column">'+
          '<div class="card-title">Répartition par catégorie</div>'+
          '<div style="position:relative;display:inline-block;width:100%">'+
            '<canvas id="ca-donut-cv" style="display:block;width:100%;height:260px;cursor:default"></canvas>'+
            '<div id="ca-donut-tip" style="display:none;position:absolute;pointer-events:none;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:140px;z-index:10"></div>'+
          '</div>'+
          '<div id="ca-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:1px"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card" id="ca-waterfall-card" style="margin-top:16px">'+
      '<div style="text-align:center;padding:20px;color:var(--text2);font-size:11px">Calcul des drivers en cours...</div>'+
    '</div>';


  budInjectStrip(el, 'ca');   // bloc réel vs budget (js/21)

  // Equalise KPI card heights
  requestAnimationFrame(() => {
    const kpis = el.querySelectorAll('.kpi-card');
    if (kpis.length > 1) {
      kpis.forEach(k => k.style.height = '');
      const maxH = Math.max(...[...kpis].map(k => k.offsetHeight));
      // hauteur égale par ligne : assurée par la grille CSS (align-items:stretch)
    }
  });

  // Courbe d'évolution (moteur commun ArtCharts)
  const _drawAreaChart = () => {
    const raw = pEntries.map(([,v]) => v); let c = 0;
    ArtCharts.area(document.getElementById(chartId), {
      labels: pEntries.map(([l]) => l), values: _chartMode === 'cumul' ? raw.map(v => c += v) : raw,
      color: '#22d3c8', name: _chartMode === 'cumul' ? 'CA cumulé' : 'CA',
      budget: budChartSeries('ca', periods.map(p => p.period), raw, _chartMode === 'cumul') });
  };
  requestAnimationFrame(_drawAreaChart);
  window._redrawCaChart = _drawAreaChart;

  // ── Anneau répartition par catégorie ────────
  requestAnimationFrame(() => {
    const catMapD = {};
    lines.forEach(l => { const k = l.cat||l.categorie||'Autre', v = parseFloat(l.montant||0); if (v > 0) catMapD[k] = (catMapD[k]||0) + v; });
    ArtCharts.donut(document.getElementById('ca-donut-cv'), {
      entries: Object.entries(catMapD).sort((a,b)=>b[1]-a[1]), palette: ['#22d3c8','#22c97a','#9b6ef3','#f5b731','#38bdf8','#fb923c'],
      centerLabel: 'CA total', sign: '+', valueColor: '#22c97a', legendEl: document.getElementById('ca-donut-legend') });
  });

  // ── Waterfall drivers ────────────────────────
  requestAnimationFrame(() => _renderCaWaterfall(el));
}

function _donutHover(idx) {
  if (window._caDonutDraw) window._caDonutDraw(idx);
}

// ── CA WATERFALL — drivers P1 vs P2 ────────────
function _renderCaWaterfall(el) {
  const wfEl = document.getElementById('ca-waterfall-card');
  if (!wfEl) return;

  // ── Compute P1 / P2 from driver + date max ──
  const driver = parseInt(_getV('syn-driver')) || 3; // months
  const rawMax = _getV('syn-date-max');

  const parseYMD = s => {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0,10));
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return new Date(m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'));
    return null;
  };
  const toYMD = d => d.toISOString().slice(0,10);
  const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth()+n); return r; };
  const subDays   = (d, n) => { const r = new Date(d); r.setDate(r.getDate()-n); return r; };
  const fmtFR = d => d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});

  // Snap to full months
  const firstOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const lastOfMonth  = d => new Date(d.getFullYear(), d.getMonth()+1, 0);

  let p1Max, p1Min, p2Max, p2Min;
  if (rawMax) {
    // Snap p1Max to last day of its month
    p1Max = lastOfMonth(parseYMD(rawMax));
  } else {
    const db = _getDB();
    const periods = Object.keys(db.periods||{}).sort();
    if (!periods.length) { wfEl.innerHTML = '<div class="dash-empty">Aucune donnée</div>'; return; }
    const last = periods[periods.length-1];
    const [ly, lm] = last.split('-');
    p1Max = new Date(+ly, +lm, 0);
  }
  // P1 starts on the 1st of the month, `driver` months back
  p1Min = firstOfMonth(addMonths(new Date(p1Max), -(driver-1)));
  // P2 ends last day of month just before P1
  p2Max = lastOfMonth(addMonths(new Date(p1Min), -1));
  // P2 starts `driver` months before P2Max
  p2Min = firstOfMonth(addMonths(new Date(p2Max), -(driver-1)));

  const p1MinS = toYMD(p1Min), p1MaxS = toYMD(p1Max);
  const p2MinS = toYMD(p2Min), p2MaxS = toYMD(p2Max);

  // ── Filter lines to CA only ──
  const CA_CATS = new Set(
    Object.entries(SCHEMA)
      .filter(([,s]) => s.n1==='Compte de résultat' && s.n2==="Produits d'exploitation")
      .map(([k])=>k)
  );
  const normDateWF = d => {
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s+'-01';
    return _normDateStr(s).sort;
  };
  const allLines = _synLines({ dmin: p2MinS, dmax: p1MaxS });
  const caLines = allLines.filter(l => {
    const cat = l.cat||l.categorie||'';
    return CA_CATS.has(cat) && parseFloat(l.montant||0) > 0;
  });

  const inP1 = l => { const d = normDateWF(l.date||l._period); return d >= p1MinS && d <= p1MaxS; };
  const inP2 = l => { const d = normDateWF(l.date||l._period); return d >= p2MinS && d <= p2MaxS; };

  // ── Aggregate by cat × bien ──
  const agg = (lines, pred) => {
    const map = {};
    lines.filter(pred).forEach(l => {
      const cat  = l.cat||l.categorie||'?';
      const bien = l.bienName||l.bien||'Non attribué';
      const key  = cat + ' · ' + bien;
      map[key] = (map[key]||0) + parseFloat(l.montant||0);
    });
    return map;
  };

  const m1 = agg(caLines, inP1);
  const m2 = agg(caLines, inP2);
  const allKeys = new Set([...Object.keys(m1), ...Object.keys(m2)]);

  const deltas = [...allKeys].map(k => ({
    key: k,
    p1:  m1[k]||0,
    p2:  m2[k]||0,
    delta: (m1[k]||0) - (m2[k]||0)
  })).filter(x => Math.abs(x.delta) > 0.5);

  deltas.sort((a,b) => b.delta - a.delta);
  const top3pos = deltas.filter(x => x.delta > 0).slice(0,3);
  const top3neg = deltas.filter(x => x.delta < 0).slice(-3).reverse();
  const drivers = [...top3pos, ...top3neg];

  if (!drivers.length) {
    wfEl.innerHTML =
      '<div class="card-title">Drivers CA — P1 vs P2</div>'+
      '<div class="dash-empty" style="padding:20px 0">Pas assez de données pour comparer les deux périodes</div>';
    return;
  }

  const totalP1 = caLines.filter(inP1).reduce((s,l)=>s+parseFloat(l.montant||0),0);
  const totalP2 = caLines.filter(inP2).reduce((s,l)=>s+parseFloat(l.montant||0),0);
  const totalDelta = totalP1 - totalP2;
  const maxAbs = Math.max(...drivers.map(d=>Math.abs(d.delta)), 1);

  // ── Build waterfall canvas HTML ──
  const wfId = 'wf-canvas-' + Date.now();
  const driverMths = driver === 1 ? '1 mois' : driver + ' mois';

  wfEl.innerHTML =
    '<div class="card-title">📊 Drivers CA — P1 vs P2</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">'+
      '<div style="display:flex;gap:16px">'+
        '<div style="font-size:11px;color:var(--text2)">P1 <span style="color:var(--cyan);font-weight:700;font-family:inherit">'+ fmtFR(p1Min)+' → '+fmtFR(p1Max)+'</span></div>'+
        '<div style="font-size:11px;color:var(--text2)">P2 <span style="color:var(--text);font-weight:600;font-family:inherit">'+ fmtFR(p2Min)+' → '+fmtFR(p2Max)+'</span></div>'+
      '</div>'+
      '<div style="font-size:12px;font-weight:700;color:'+(totalDelta>=0?'var(--green)':'var(--red)')+'">'+(totalDelta>=0?'+':'')+totalDelta.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €</div>'+
    '</div>'+
    '<div style="overflow:hidden;width:100%">'+
      '<canvas id="'+wfId+'" style="display:block;max-width:100%;height:'+Math.max(drivers.length*52+40, 120)+'px"></canvas>'+
    '</div>'+
    '<div id="ca-wf-narrative" style="margin-top:16px;border-top:1px solid var(--border);padding-top:4px"></div>';

  const _wfRows = drivers.map(d => { const parts = d.key.split(' · ');
    return { label: parts[0] || d.key, sub: parts[1] || '', delta: d.delta, p1: d.p1, p2: d.p2,
             pct: d.p2 ? d.delta / Math.abs(d.p2) * 100 : undefined }; });
  requestAnimationFrame(() => ArtCharts.diverging(document.getElementById(wfId), {
    rows: _wfRows, upIsGood: true, p1Label: 'P1 · '+fmtFR(p1Min)+' → '+fmtFR(p1Max), p2Label: 'P2 · '+fmtFR(p2Min)+' → '+fmtFR(p2Max) }));

    // ── Narrative bullets ────────────────────
    const narrativeEl = document.getElementById('ca-wf-narrative');
    if (!narrativeEl) return;

    const fmtAmt = v => ((v>=0?'+':'')+Math.round(v).toLocaleString('fr-FR')+' €');
    const fmtPct = (delta, base) => base > 0 ? ((delta/base)*100).toFixed(0)+'%' : (delta>0?'+100%':'-100%');
    const mthLabel = n => n===1?'1 mois':n+' mois';
    const p1Label = fmtFR(p1Min)+' → '+fmtFR(p1Max);
    const p2Label = fmtFR(p2Min)+' → '+fmtFR(p2Max);

    const bullets = [];

    // Bullet 1 — résumé global
    const sign = totalDelta >= 0 ? '+' : '';
    const trend = totalDelta >= 0 ? 'Progression globale' : 'Recul global';
    const trendColor = totalDelta >= 0 ? 'var(--green)' : 'var(--red)';
    bullets.push({
      icon: totalDelta >= 0 ? '📈' : '📉',
      color: trendColor,
      text: '<strong>'+trend+'</strong> — Le CA de P1 ('+p1Label+') '+
            (totalDelta>=0?'progresse de <strong style="color:var(--green)">'+fmtAmt(totalDelta)+'</strong>':'recule de <strong style="color:var(--red)">'+fmtAmt(totalDelta)+'</strong>')+
            ' par rapport à P2 ('+p2Label+') sur une fenêtre de <strong>'+mthLabel(driver)+'</strong>.'
    });

    // Bullet 2 — top hausses
    if (top3pos.length) {
      const items = top3pos.map(d => {
        const parts = d.key.split(' · ');
        const p = fmtPct(d.delta, d.p2);
        return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--green)">'+fmtAmt(d.delta)+', '+p+'</span>)';
      });
      bullets.push({
        icon: '✅',
        color: 'var(--green)',
        text: '<strong>Moteurs de hausse</strong> — '+items.join(' ; ')+'.'
      });
    }

    // Bullet 3 — top baisses
    if (top3neg.length) {
      const items = top3neg.map(d => {
        const parts = d.key.split(' · ');
        const p = fmtPct(d.delta, d.p2);
        return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--red)">'+fmtAmt(d.delta)+', '+p+'</span>)';
      });
      bullets.push({
        icon: '⚠️',
        color: 'var(--red)',
        text: '<strong>Points de vigilance</strong> — '+items.join(' ; ')+'.'
      });
    } else {
      bullets.push({
        icon: '✅',
        color: 'var(--text2)',
        text: '<strong>Points de vigilance</strong> — Aucune variation négative significative sur la période.'
      });
    }

    // Bullet 4 — concentration
    const topKey = top3pos[0] || top3neg[0];
    if (topKey && totalDelta !== 0) {
      const share = Math.abs(topKey.delta / totalDelta * 100).toFixed(0);
      const parts = topKey.key.split(' · ');
      bullets.push({
        icon: '🔍',
        color: 'var(--text2)',
        text: '<strong>Concentration</strong> — Le principal driver (<em>'+(parts[0])+(parts[1]?' · '+parts[1]:'')+'</em>) représente <strong>'+share+'%</strong> de la variation totale.'
      });
    }

    narrativeEl.innerHTML = bullets.map(b =>
      '<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border)">'+
        '<span style="font-size:13px;flex-shrink:0;margin-top:1px">'+b.icon+'</span>'+
        '<span style="font-size:11px;color:var(--text2);line-height:1.6">'+b.text+'</span>'+
      '</div>'
    ).join('');
}

// ── DÉPENSES (placeholder) ─────────────────────
function _renderSynDepenses() {
  const el = document.getElementById('syn-content'); if (!el) return;
  const gran = 'mensuel';

  const _allLines = _synLines();
  const lines = _allLines.filter(l => _isDep(l));
  const periods = [...new Set(_allLines.map(l=>l._period))].sort().map(p=>({period:p,lines:_allLines.filter(l=>l._period===p)}));
  if (!lines.length) { el.innerHTML = _emptyState('Aucune dépense pour cette sélection'); return; }

  const totalDep = lines.reduce((s,l)=>s-(+l.montant),0);

  // Dépenses par bien
  const bienMap = {};
  lines.forEach(l => {
    const k = l.bienName||l.bien||'Non attribué';
    bienMap[k] = (bienMap[k]||0)-(+l.montant);
  });
  const bienEntries = Object.entries(bienMap).sort((a,b)=>b[1]-a[1]);
  const maxBien = bienEntries[0]?.[1]||1;

  // Dépenses par catégorie
  const catMap = {};
  lines.forEach(l => {
    const k = l.cat||l.categorie||'Autre';
    catMap[k] = (catMap[k]||0)-(+l.montant);
  });
  const catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);

  // Dépenses par période
  let periodMap = {};
  if (gran === 'mensuel') {
    periods.forEach(p => {
      const dep = (p.lines||[]).filter(l=>_isDep(l)).reduce((s,l)=>s-(+l.montant),0);
      const [pY, pM] = (p.period||'').split('-');
      const mNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
      const mLbl = mNames[(parseInt(pM)||1)-1] || pM;
      periodMap[mLbl + ' ' + pY] = dep;
    });
  } else {
    lines.forEach(l => {
      const y = l._year||'?';
      periodMap[y] = (periodMap[y]||0)-(+l.montant);
    });
  }
  const pEntries = Object.entries(periodMap);

  const bienRows = bienEntries.map(([b,v]) =>
    '<tr>'+
      '<td>'+b+'</td>'+
      '<td class="td-neg" style="color:var(--red)">-'+_fmtK(v)+'</td>'+
      '<td class="td-right" style="color:var(--text2);font-size:11px">'+_pct(v/totalDep*100)+'</td>'+
    '</tr>'
  ).join('');

  const chartId = 'dep-area-chart-' + Date.now();

  // Build monthly dep map for M-1 / N-1 badges
  const depPeriodMap = {};
  periods.forEach(p => {
    depPeriodMap[p.period] = (p.lines||[]).filter(l => _isDep(l)).reduce((s,l) => s-(+l.montant), 0);
  });
  const lastDepPeriod = periods.length ? periods[periods.length-1].period : null;
  const lastDepVal = lastDepPeriod ? (depPeriodMap[lastDepPeriod]||0) : totalDep;

  el.innerHTML =
    '<div class="dash-grid-4" style="margin-bottom:20px">'+
      _kpiCard('💸','Dépenses totales','-'+_fmtK(totalDep),'var(--red)',pEntries.length+' période'+(pEntries.length>1?'s':''), _varBadges(lastDepVal, lastDepPeriod, depPeriodMap, false), Object.keys(depPeriodMap).sort().map(k=>depPeriodMap[k]))+
      _kpiCardBig('🏠','Nb biens',''+bienEntries.length,'var(--cyan)')+
      _kpiCard('📉','Moy / période','-'+_fmtK(totalDep/Math.max(pEntries.length,1)),'var(--gold)', '', _varBadges(lastDepVal, lastDepPeriod, depPeriodMap, false), Object.keys(depPeriodMap).sort().map(k=>depPeriodMap[k]))+
      _kpiCardTop('🚨','Poste principal',catEntries[0]?.[0]||'-','var(--purple)', catEntries[0]?'-'+_fmtK(catEntries[0][1]):'-', catEntries[0]&&totalDep?((catEntries[0][1]/totalDep)*100).toFixed(1)+'% des charges':'')+
    '</div>'+
    '<div class="card" style="margin-bottom:18px">'+
      '<div class="card-title" style="justify-content:space-between">'+
        '<span>Dépenses — évolution mensuelle</span>'+
        _chartModeToggleHtml('window._redrawDepChart')+
      '</div>'+
      '<div class="ac-wrap">'+
        '<canvas id="'+chartId+'" style="width:100%;height:100%"></canvas>'+
      '</div>'+
    '</div>'+
    '<div class="dash-grid-2" style="align-items:stretch">'+
      '<div class="card" style="display:flex;flex-direction:column;height:100%">'+
        '<div class="card-title">Opérations dépenses</div>'+
        '<div id="dep-ops-wrap" style="overflow-y:auto;max-height:660px;border-radius:8px;border:1px solid var(--border)">'+
          '<table id="dep-ops-table" style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">'+
            '<colgroup>'+
              '<col style="width:90px"><col style="width:115px"><col style="width:130px"><col style="width:130px"><col style="width:95px">'+
            '</colgroup>'+
            '<thead style="position:sticky;top:0;z-index:2">'+
              '<tr style="background:var(--bg3);border-bottom:1px solid var(--border2)">'+
                '<th onclick="_sortDepOps(this,0)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="0" data-sort-dir="desc">DATE <span class="sort-arrow">↓</span></th>'+
                '<th onclick="_sortDepOps(this,1)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="1" data-sort-dir="">BIEN <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortDepOps(this,2)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="2" data-sort-dir="">CATÉGORIE <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortDepOps(this,3)" style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="3" data-sort-dir="">LIBELLÉ <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortDepOps(this,4)" style="padding:8px 10px;text-align:right;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="4" data-sort-dir="">MONTANT <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
              '</tr>'+
            '</thead>'+
            '<tbody id="dep-ops-body">'+
              (()=>{ window._depOpsLines = lines.slice().map(l=>({
                d: (()=>{ const r=l.date||''; if(/^\d{4}-\d{2}-\d{2}/.test(r)) return r.slice(0,10); if(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/.test(r)){const[,dd,mm,yy]=r.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);return yy+'-'+mm+'-'+dd;} return l._period||''; })(),
                dDisplay: (()=>{ const r=l.date||''; if(/^\d{4}-\d{2}-\d{2}/.test(r)){const[y,m,d]=r.slice(0,10).split('-');return d+'/'+m+'/'+y;} if(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/.test(r)) return r.slice(0,10); return l._period||'-'; })(),
                bien: l.bienName||l.bien||'—',
                cat: l.cat||l.categorie||'—',
                lib: (typeof normaliseLib==='function' ? normaliseLib(l.libelle||l.label||'') : (l.libelle||l.label||'—'))||'—',
                amt: -(+l.montant)
              }));
              return _buildDepOpsRows(window._depOpsLines.slice().sort((a,b)=>b.d.localeCompare(a.d)));})() +
            '</tbody>'+
          '</table>'+
        '</div>'+
        '<div style="padding:10px 0 2px;font-size:11px;color:var(--text2);text-align:right">'+lines.length+' opération'+(lines.length>1?'s':'')+' · total <span style="color:var(--red);font-weight:700">-'+_fmtK(totalDep)+'</span></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:16px;height:100%">'+
        '<div class="card">'+
          '<div class="card-title">Détail dépenses par bien</div>'+
          '<div class="tbl-wrap"><table>'+
            '<thead><tr><th>Bien</th><th style="text-align:right">Dépenses</th><th style="text-align:right">Part</th></tr></thead>'+
            '<tbody>'+bienRows+'</tbody>'+
            '<tfoot><tr style="border-top:2px solid var(--border2)">'+
              '<td style="font-weight:700">Total</td>'+
              '<td style="text-align:right;font-weight:700;color:var(--red)">-'+_fmtK(totalDep)+'</td>'+
              '<td style="text-align:right;color:var(--text2)">100%</td>'+
            '</tr></tfoot>'+
          '</table></div>'+
        '</div>'+
        '<div class="card" id="dep-cat-donut-card" style="flex:1;display:flex;flex-direction:column">'+
          '<div class="card-title">Répartition par catégorie</div>'+
          '<div style="position:relative;display:inline-block;width:100%">'+
            '<canvas id="dep-donut-cv" style="display:block;width:100%;height:260px;cursor:default"></canvas>'+
            '<div id="dep-donut-tip" style="display:none;position:absolute;pointer-events:none;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:140px;z-index:10"></div>'+
          '</div>'+
          '<div id="dep-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:1px"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card" id="dep-wf-card" style="margin-top:18px"></div>';

  budInjectStrip(el, 'dep');

  // Equalise KPI card heights
  requestAnimationFrame(() => {
    const kpis = el.querySelectorAll('.kpi-card');
    if (kpis.length > 1) {
      kpis.forEach(k => k.style.height = '');
      const maxH = Math.max(...[...kpis].map(k => k.offsetHeight));
      // hauteur égale par ligne : assurée par la grille CSS (align-items:stretch)
    }
  });

  // Courbe d'évolution (moteur commun ArtCharts)
  const _drawDepArea = () => {
    const raw = pEntries.map(([,v]) => v); let c = 0;
    ArtCharts.area(document.getElementById(chartId), {
      labels: pEntries.map(([l]) => l), values: _chartMode === 'cumul' ? raw.map(v => c += v) : raw,
      color: '#f0566a', name: _chartMode === 'cumul' ? 'Dépenses cumulées' : 'Dépenses', deltaGoodWhenUp: false,
      budget: budChartSeries('dep', periods.map(p => p.period), raw, _chartMode === 'cumul') });
  };
  requestAnimationFrame(_drawDepArea);
  window._redrawDepChart = _drawDepArea;

  // ── Anneau dépenses par catégorie ───────────
  requestAnimationFrame(() => ArtCharts.donut(document.getElementById('dep-donut-cv'), {
    entries: catEntries, palette: ['#f0566a','#f5b731','#9b6ef3','#fb923c','#38bdf8','#22d3c8'], centerLabel: 'Dépenses totales', sign: '-',
    valueColor: '#f0566a', legendEl: document.getElementById('dep-donut-legend') }));

  // ── Waterfall Dépenses P1 vs P2 ──────────────
  requestAnimationFrame(() => _renderDepWaterfall(el));
}

function _depDonutHover(idx) {
  if (window._depDonutDraw) window._depDonutDraw(idx);
}

function _renderDepWaterfall(el) {
  const wfEl = document.getElementById('dep-wf-card');
  if (!wfEl) return;

  const rawMax = _getV('syn-date-max');
  const driver = parseInt(_getV('syn-driver')||'3');
  const parseYMD = s => { const [y,m,d]=(s||'').split('-'); return new Date(+y,+m-1,+d); };
  const addMonths = (d,n) => { const r=new Date(d); r.setMonth(r.getMonth()+n); return r; };
  const fmtFR = d => d ? (String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()) : '';
  const firstOfMonth = d => new Date(d.getFullYear(),d.getMonth(),1);
  const lastOfMonth  = d => new Date(d.getFullYear(),d.getMonth()+1,0);

  let p1Max, p1Min, p2Max, p2Min;
  if (rawMax) {
    p1Max = lastOfMonth(parseYMD(rawMax));
  } else {
    const db = _getDB();
    const periods = Object.keys(db.periods||{}).sort();
    if (!periods.length) { wfEl.innerHTML = '<div class="dash-empty">Aucune donnée</div>'; return; }
    const last = periods[periods.length-1];
    const [ly,lm] = last.split('-');
    p1Max = new Date(+ly,+lm,0);
  }
  p1Min = firstOfMonth(addMonths(new Date(p1Max),-(driver-1)));
  p2Max = lastOfMonth(addMonths(new Date(p1Min),-1));
  p2Min = firstOfMonth(addMonths(new Date(p2Max),-(driver-1)));

  const inRange = (d,mn,mx) => d>=mn && d<=mx;
  const toDate = s => { if(!s) return null; const n=_normDateStr(String(s).trim()).sort; if(!n) return null; return new Date(n); };

  const allLines = _synLines();
  const DEP_CATS2 = new Set(Object.entries(SCHEMA).filter(([,s])=>s.n1==='Compte de résultat'&&(s.n2||'').includes('Charges')).map(([k])=>k));
  const depLines = allLines.filter(l=>DEP_CATS2.has(l.cat||l.categorie||'')&&+l.montant<0);

  const aggP = (mn,mx) => {
    const map={};
    depLines.forEach(l=>{
      const d=toDate(l.date||l._period+'-01');
      if(!d||!inRange(d,mn,mx)) return;
      const key=(l.cat||l.categorie||'Autre')+' · '+(l.bienName||l.bien||'Non attribué');
      map[key]=(map[key]||0)-(+l.montant);
    });
    return map;
  };
  const p1map=aggP(p1Min,p1Max), p2map=aggP(p2Min,p2Max);
  const allKeys=new Set([...Object.keys(p1map),...Object.keys(p2map)]);
  const deltas=[];
  allKeys.forEach(k=>{ const d=(p1map[k]||0)-(p2map[k]||0); if(Math.abs(d)>0.01) deltas.push({key:k,delta:d,p1:p1map[k]||0,p2:p2map[k]||0}); });
  deltas.sort((a,b)=>b.delta-a.delta);
  const top3pos=deltas.filter(d=>d.delta>0).slice(0,3);
  const top3neg=deltas.filter(d=>d.delta<0).slice(-3).reverse();
  const drivers=[...top3pos,...top3neg];
  const totalDelta=drivers.reduce((s,d)=>s+d.delta,0);
  const maxAbs=Math.max(...drivers.map(d=>Math.abs(d.delta)),1);
  const wfId='dep-wf-canvas-'+Date.now();

  wfEl.innerHTML=
    '<div class="card-title">📊 Drivers Dépenses — P1 vs P2</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">'+
      '<div style="display:flex;gap:16px">'+
        '<div style="font-size:11px;color:var(--text2)">P1 <span style="color:var(--red);font-weight:700;font-family:inherit">'+fmtFR(p1Min)+' → '+fmtFR(p1Max)+'</span></div>'+
        '<div style="font-size:11px;color:var(--text2)">P2 <span style="color:var(--text);font-weight:600;font-family:inherit">'+fmtFR(p2Min)+' → '+fmtFR(p2Max)+'</span></div>'+
      '</div>'+
      '<div style="font-size:12px;font-weight:700;color:'+(totalDelta<=0?'var(--green)':'var(--red)')+'">'+(totalDelta<=0?'':'+')+(totalDelta).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €</div>'+
    '</div>'+
    '<div style="overflow:hidden;width:100%">'+
      '<canvas id="'+wfId+'" style="display:block;max-width:100%;height:'+Math.max(drivers.length*52+40,120)+'px"></canvas>'+
    '</div>'+
    '<div id="dep-wf-narrative" style="margin-top:16px;border-top:1px solid var(--border);padding-top:4px"></div>';

  const _wfRows = drivers.map(d => { const parts = d.key.split(' · ');
    return { label: parts[0] || d.key, sub: parts[1] || '', delta: d.delta, p1: d.p1, p2: d.p2,
             pct: d.p2 ? d.delta / Math.abs(d.p2) * 100 : undefined }; });
  requestAnimationFrame(() => ArtCharts.diverging(document.getElementById(wfId), {
    rows: _wfRows, upIsGood: false, p1Label: 'P1 · '+fmtFR(p1Min)+' → '+fmtFR(p1Max), p2Label: 'P2 · '+fmtFR(p2Min)+' → '+fmtFR(p2Max) }));

  // ── Narrative bullets ──────────────────────
  const narrativeEl=document.getElementById('dep-wf-narrative');
  if(!narrativeEl) return;
  const fmtAmt=v=>((v>=0?'+':'')+Math.round(v).toLocaleString('fr-FR')+' €');
  const fmtPct=(delta,base)=>base>0?((delta/base)*100).toFixed(0)+'%':(delta>0?'+100%':'-100%');
  const mthLabel=n=>n===1?'1 mois':n+' mois';
  const bullets=[];
  const sign=totalDelta>=0?'+':'';
  const trend=totalDelta<=0?'Réduction des charges':'Hausse des charges';
  const trendColor=totalDelta<=0?'var(--green)':'var(--red)';
  bullets.push({
    icon:totalDelta<=0?'📉':'📈',
    text:'<strong>'+trend+'</strong> — Les dépenses de P1 ('+fmtFR(p1Min)+' → '+fmtFR(p1Max)+') '+
         (totalDelta<=0?'reculent de <strong style="color:var(--green)">'+fmtAmt(totalDelta)+'</strong>':'progressent de <strong style="color:var(--red)">'+fmtAmt(totalDelta)+'</strong>')+
         ' vs P2 ('+fmtFR(p2Min)+' → '+fmtFR(p2Max)+') sur <strong>'+mthLabel(driver)+'</strong>.'
  });
  if(top3pos.length){
    const items=top3pos.map(d=>{
      const parts=d.key.split(' · ');
      return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--red)">'+fmtAmt(d.delta)+', '+fmtPct(d.delta,d.p2)+'</span>)';
    });
    bullets.push({icon:'⚠️',text:'<strong>Postes en hausse</strong> — '+items.join(' ; ')+'.'});
  }
  if(top3neg.length){
    const items=top3neg.map(d=>{
      const parts=d.key.split(' · ');
      return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--green)">'+fmtAmt(d.delta)+', '+fmtPct(d.delta,d.p2)+'</span>)';
    });
    bullets.push({icon:'✅',text:'<strong>Postes en baisse</strong> — '+items.join(' ; ')+'.'});
  } else {
    bullets.push({icon:'✅',text:'<strong>Postes en baisse</strong> — Aucune réduction de charges significative sur la période.'});
  }
  const topKey=top3pos[0]||top3neg[0];
  if(topKey&&totalDelta!==0){
    const share=Math.abs(topKey.delta/totalDelta*100).toFixed(0);
    const parts=topKey.key.split(' · ');
    bullets.push({icon:'🔍',text:'<strong>Concentration</strong> — Le principal driver (<em>'+(parts[0])+(parts[1]?' · '+parts[1]:'')+'</em>) représente <strong>'+share+'%</strong> de la variation totale.'});
  }
  narrativeEl.innerHTML=bullets.map(b=>
    '<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border)">'+
      '<span style="font-size:13px;flex-shrink:0;margin-top:1px">'+b.icon+'</span>'+
      '<span style="font-size:11px;color:var(--text2);line-height:1.6">'+b.text+'</span>'+
    '</div>'
  ).join('');
}

function _buildDepOpsRows(rows) {
  return rows.map(l =>
    '<tr style="border-bottom:1px solid var(--border);transition:background .12s" onmouseover="this.style.background=&quot;rgba(255,255,255,.03)&quot;" onmouseout="this.style.background=&quot;&quot;">'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:11px;white-space:nowrap;font-family:inherit">'+l.dDisplay+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;word-break:break-word;line-height:1.4">'+l.bien+'</td>'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:11px;word-break:break-word;line-height:1.4">'+l.cat+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;color:var(--text2);word-break:break-word;line-height:1.4">'+l.lib+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:inherit;font-weight:600;color:var(--red);white-space:nowrap">'+(()=>{const _v=l.amt;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+','+_d+' €'})()+'</td>'+
    '</tr>'
  ).join('');
}

function _sortDepOps(th, col) {
  const table = document.getElementById('dep-ops-table');
  if (!table) return;
  const allTh = table.querySelectorAll('thead th[data-sort-col]');
  const newDir = (th.dataset.sortDir==='asc') ? 'desc' : 'asc';
  allTh.forEach(h => { h.dataset.sortDir=''; const a=h.querySelector('.sort-arrow'); if(a){a.textContent='↕';a.style.opacity='.3';} });
  th.dataset.sortDir = newDir;
  const arr = th.querySelector('.sort-arrow');
  if(arr){arr.textContent=newDir==='asc'?'↑':'↓';arr.style.opacity='1';}
  const rows = (window._depOpsLines||[]).slice();
  rows.sort((a,b)=>{
    if      (col===0) return newDir==='asc'?a.d.localeCompare(b.d):b.d.localeCompare(a.d);
    else if (col===1) return newDir==='asc'?a.bien.localeCompare(b.bien,'fr'):b.bien.localeCompare(a.bien,'fr');
    else if (col===2) return newDir==='asc'?a.cat.localeCompare(b.cat,'fr'):b.cat.localeCompare(a.cat,'fr');
    else if (col===3) return newDir==='asc'?a.lib.localeCompare(b.lib,'fr'):b.lib.localeCompare(a.lib,'fr');
    else if (col===4) return newDir==='asc'?a.amt-b.amt:b.amt-a.amt;
    return 0;
  });
  const tbody = document.getElementById('dep-ops-body');
  if(tbody) tbody.innerHTML = _buildDepOpsRows(rows);
}

