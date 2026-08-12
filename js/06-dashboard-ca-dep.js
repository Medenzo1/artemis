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
        '<span>CA — évolution '+gran+'</span>'+
        _chartModeToggleHtml('window._redrawCaChart')+
      '</div>'+
      '<div style="position:relative;width:100%;height:220px">'+
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
                '<th onclick="_sortCAOps(this,0)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="0" data-sort-dir="desc">DATE <span class="sort-arrow">↓</span></th>'+
                '<th onclick="_sortCAOps(this,1)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="1" data-sort-dir="">BIEN <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortCAOps(this,2)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="2" data-sort-dir="">CATÉGORIE <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortCAOps(this,3)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="3" data-sort-dir="">LIBELLÉ <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortCAOps(this,4)" style="padding:8px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="4" data-sort-dir="">MONTANT <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
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
        '<div style="padding:10px 0 2px;font-size:10px;color:var(--text2);text-align:right">'+lines.length+' opération'+(lines.length>1?'s':'')+' · total <span style="color:var(--green);font-weight:700">+'+_fmtK(totalCA)+'</span></div>'+
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
          '<div id="ca-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:5px"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card" id="ca-waterfall-card" style="margin-top:16px">'+
      '<div style="text-align:center;padding:20px;color:var(--text2);font-size:11px">Calcul des drivers en cours...</div>'+
    '</div>';


  // Equalise KPI card heights
  requestAnimationFrame(() => {
    const kpis = el.querySelectorAll('.kpi-card');
    if (kpis.length > 1) {
      kpis.forEach(k => k.style.height = '');
      const maxH = Math.max(...[...kpis].map(k => k.offsetHeight));
      kpis.forEach(k => k.style.height = maxH + 'px');
    }
  });

  // Draw area chart on canvas
  const _drawAreaChart = () => {
    const cv = document.getElementById(chartId);
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.parentElement.getBoundingClientRect();
    const W = rect.width || cv.parentElement.clientWidth; const H = rect.height || 220;
    cv.width  = W * dpr; cv.height = H * dpr;
    cv.style.width  = W + 'px'; cv.style.height = H + 'px';
    const cx = cv.getContext('2d');
    cx.scale(dpr, dpr);

    const PAD = { top: 28, right: 24, bottom: 44, left: 58 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top  - PAD.bottom;

    const rawVals = pEntries.map(([,v]) => v);
    const labels = pEntries.map(([l]) => l);
    // Cumulé ou mensuel selon le mode
    let cumul = 0;
    const vals = _chartMode === 'cumul'
      ? rawVals.map(v => { cumul += v; return cumul; })
      : rawVals;
    const maxV = Math.max(...vals, 1);
    const minV = Math.min(...vals, 0);
    const range = maxV - minV || 1;

    const scale = _niceScale(minV, maxV, 5);
    const axisMin = scale.min, axisMax = scale.max, axisTicks = scale.ticks;

    const xOf = i => PAD.left + (i / Math.max(vals.length - 1, 1)) * cW;
    const yOf = v => PAD.top  + cH - ((v - axisMin) / (axisMax - axisMin || 1)) * cH;

    // Grid lines (horizontal, dotted)
    cx.setLineDash([3, 5]);
    cx.lineWidth = 1;
    cx.strokeStyle = 'rgba(255,255,255,0.06)';
    axisTicks.forEach(v => {
      const y = yOf(v);
      if (y >= PAD.top - 2 && y <= PAD.top + cH + 2) {
        cx.beginPath(); cx.moveTo(PAD.left, y); cx.lineTo(PAD.left + cW, y); cx.stroke();
      }
    });
    cx.setLineDash([]);

    // Y axis labels
    cx.font = '10px Outfit, sans-serif';
    cx.fillStyle = 'rgba(126,143,168,0.8)';
    cx.textAlign = 'right';
    axisTicks.forEach(v => {
      const y = yOf(v);
      if (y >= PAD.top - 2 && y <= PAD.top + cH + 2) {
        const lbl = Math.round(v).toLocaleString('fr-FR')+' €';
        cx.fillText(lbl, PAD.left - 8, y + 3.5);
      }
    });

    // Area fill (gradient)
    const grad = cx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    grad.addColorStop(0,   'rgba(34,211,200,0.30)');
    grad.addColorStop(0.5, 'rgba(34,211,200,0.10)');
    grad.addColorStop(1,   'rgba(34,211,200,0.00)');
    cx.beginPath();
    cx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) cx.lineTo(xOf(i), yOf(vals[i]));
    cx.lineTo(xOf(vals.length - 1), PAD.top + cH);
    cx.lineTo(xOf(0), PAD.top + cH);
    cx.closePath();
    cx.fillStyle = grad;
    cx.fill();

    // Line stroke
    cx.beginPath();
    cx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) cx.lineTo(xOf(i), yOf(vals[i]));
    cx.strokeStyle = '#22d3c8';
    cx.lineWidth = 2.5;
    cx.lineJoin = 'round';
    cx.stroke();

    // Data point dots + labels
    cx.font = 'bold 9px Outfit, monospace';
    for (let i = 0; i < vals.length; i++) {
      const x = xOf(i); const y = yOf(vals[i]);
      // Dot
      cx.beginPath(); cx.arc(x, y, 3.5, 0, Math.PI*2);
      cx.fillStyle = '#22d3c8'; cx.fill();
      cx.strokeStyle = '#0b0d12'; cx.lineWidth = 1.5; cx.stroke();
      // Value label — only first, last, and on hover (too many = cluttered)
      const showLabel = vals.length <= 6 || i === 0 || i === vals.length - 1;
      if (showLabel && vals[i] > 0) {
        const lbl = Math.round(vals[i]).toLocaleString('fr-FR')+' €';
        // Adaptive alignment: left-align first point, right-align last, center others
        const isFirst = i === 0;
        const isLast  = i === vals.length - 1;
        cx.textAlign = isFirst ? 'left' : isLast ? 'right' : 'center';
        const lx = isFirst ? x + 6 : isLast ? x - 6 : x;
        const ly = y - 13;
        // Background pill for readability
        cx.font = 'bold 9px Outfit, monospace';
        const tw = cx.measureText(lbl).width;
        const pad = 4;
        const bx = cx.textAlign === 'left' ? lx - pad : cx.textAlign === 'right' ? lx - tw - pad : lx - tw/2 - pad;
        cx.fillStyle = 'rgba(11,13,18,0.72)';
        cx.beginPath();
        cx.roundRect(bx, ly - 9, tw + pad*2, 13, 3);
        cx.fill();
        // Text
        cx.fillStyle = 'rgba(34,211,200,0.95)';
        cx.fillText(lbl, lx, ly);
      }
    }

    // X axis labels
    cx.font = '9px Outfit, sans-serif';
    cx.fillStyle = 'rgba(126,143,168,0.7)';
    cx.textAlign = 'center';
    const step = vals.length <= 12 ? 1 : Math.ceil(vals.length / 12);
    for (let i = 0; i < labels.length; i += step) {
      cx.fillText(labels[i], xOf(i), PAD.top + cH + 16);
    }
  }; // end _drawAreaChart
  requestAnimationFrame(_drawAreaChart);
  window._redrawCaChart = _drawAreaChart;

  // Re-draw area chart on resize
  if (window._caAreaRO) window._caAreaRO.disconnect();
  window._caAreaRO = new ResizeObserver(() => requestAnimationFrame(_drawAreaChart));
  const areaCv = document.getElementById(chartId);
  if (areaCv) window._caAreaRO.observe(areaCv.parentElement);

  // ── Donut répartition par catégorie ─────────
  requestAnimationFrame(() => {
    const cv = document.getElementById('ca-donut-cv');
    if (!cv) return;

    const catMapD = {};
    lines.forEach(l => {
      const k = l.cat||l.categorie||'Autre';
      const v = parseFloat(l.montant||0);
      if (v > 0) catMapD[k] = (catMapD[k]||0) + v;
    });
    const entries = Object.entries(catMapD).sort((a,b)=>b[1]-a[1]);
    const total = entries.reduce((s,[,v])=>s+v, 0);
    if (!total) return;

    const PALETTE = ['#22d3c8','#22c97a','#9b6ef3','#f5b731','#f0566a','#38bdf8','#a3e635','#fb923c','#e879f9','#34d399'];

    const resizeAndDraw = () => {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.parentElement.clientWidth;
    const H = 260;
    cv.width  = W * dpr; cv.height = H * dpr;
    cv.style.width  = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx0 = W / 2, cy0 = H / 2 - 5;
    const R = Math.max(10, Math.min(W, H) / 2 - 14);
    const r = R * 0.52;

    // Build slice data with start/end angles
    const slices = [];
    let angle = -Math.PI / 2;
    entries.forEach(([cat, val], i) => {
      const sweep = (val / total) * Math.PI * 2;
      slices.push({ cat, val, color: PALETTE[i % PALETTE.length], a0: angle, a1: angle + sweep });
      angle += sweep;
    });

    // Draw function
    const draw = (hovered) => {
      ctx.clearRect(0, 0, W, H);
      slices.forEach((s, i) => {
        const isHov = i === hovered;
        const rOut  = isHov ? R + 6 : R;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.arc(cx0, cy0, rOut, s.a0, s.a1);
        ctx.closePath();
        ctx.fillStyle = isHov ? s.color : s.color + 'cc';
        ctx.fill();
        ctx.strokeStyle = '#111318';
        ctx.lineWidth   = isHov ? 2 : 1.5;
        ctx.stroke();
      });
      // Hole
      ctx.beginPath();
      ctx.arc(cx0, cy0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#111318';
      ctx.fill();
      // Center label
      if (hovered !== null && hovered >= 0 && slices[hovered]) {
        const s = slices[hovered];
        const pct = ((s.val/total)*100).toFixed(1);
        ctx.font = 'bold 13px Outfit,sans-serif';
        ctx.fillStyle = s.color;
        ctx.textAlign = 'center';
        const fmtV = Math.round(s.val).toLocaleString('fr-FR')+' €';
        ctx.fillText('+'+fmtV, cx0, cy0 + 2);
        ctx.font = '9px Outfit,sans-serif';
        ctx.fillStyle = 'rgba(126,143,168,0.8)';
        ctx.fillText(pct+'%', cx0, cy0 + 15);
      } else {
        ctx.font = 'bold 13px Outfit,sans-serif';
        ctx.fillStyle = '#e2e8f3';
        ctx.textAlign = 'center';
        const fmtT = Math.round(total).toLocaleString('fr-FR')+' €';
        ctx.fillText('+'+fmtT, cx0, cy0 + 2);
        ctx.font = '9px Outfit,sans-serif';
        ctx.fillStyle = 'rgba(126,143,168,0.8)';
        ctx.fillText('CA total', cx0, cy0 + 15);
      }
    };

    draw(null);

    // Tooltip hover
    const tip = document.getElementById('ca-donut-tip');
    const hitTest = (mx, my) => {
      const dx = mx - cx0, dy = my - cy0;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < r || dist > R + 8) return -1;
      let a = Math.atan2(dy, dx);
      if (a < -Math.PI/2) a += Math.PI*2;
      // normalize to start at -PI/2
      const aNorm = ((a + Math.PI/2) + Math.PI*2) % (Math.PI*2);
      for (let i = 0; i < slices.length; i++) {
        const a0 = ((slices[i].a0 + Math.PI/2) + Math.PI*2) % (Math.PI*2);
        const a1 = ((slices[i].a1 + Math.PI/2) + Math.PI*2) % (Math.PI*2);
        if (a0 <= a1 ? (aNorm >= a0 && aNorm < a1) : (aNorm >= a0 || aNorm < a1)) return i;
      }
      return -1;
    };

    // Remove previous listeners by replacing canvas clone
    cv.onmousemove = (e) => {
      const rect = cv.getBoundingClientRect();
      // Scale mouse coords to canvas logical size
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top)  * scaleY;
      const idx = hitTest(mx, my);
      draw(idx >= 0 ? idx : null);
      // Cursor: pointer only when over a real slice
      cv.style.cursor = idx >= 0 ? 'pointer' : 'default';
      if (idx >= 0 && tip) {
        const s = slices[idx];
        const pct = ((s.val/total)*100).toFixed(1);
        const fmtV = (()=>{const _v=s.val;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})();
        tip.style.display = 'block';
        tip.style.width = '170px';
        tip.innerHTML =
          '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">'+
            '<div style="width:9px;height:9px;border-radius:50%;background:'+s.color+';flex-shrink:0"></div>'+
            '<span style="font-weight:700;color:#e2e8f3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.cat+'</span>'+
          '</div>'+
          '<div style="font-family:monospace;font-size:14px;font-weight:800;color:var(--green);letter-spacing:.02em">+'+fmtV+' €</div>'+
          '<div style="font-size:10px;color:var(--text2);margin-top:4px">'+pct+'% du CA total</div>';
        // Position: follow cursor, keep inside canvas bounds
        const tipW = 182, tipH = 82;
        let tx = (e.clientX - rect.left) + 14;
        let ty = (e.clientY - rect.top)  - 30;
        if (tx + tipW > rect.width)  tx = (e.clientX - rect.left) - tipW - 10;
        if (ty < 4) ty = 4;
        if (ty + tipH > rect.height) ty = rect.height - tipH - 4;
        tip.style.left = tx + 'px';
        tip.style.top  = ty + 'px';
      } else if (tip) {
        tip.style.display = 'none';
      }
    };
    cv.onmouseleave = () => {
      draw(null);
      cv.style.cursor = 'default';
      if (tip) tip.style.display = 'none';
    };

    // Legend
    const legend = document.getElementById('ca-donut-legend');
    if (legend) {
      legend.innerHTML = entries.slice(0,6).map(([cat, val], i) => {
        const pct = ((val/total)*100).toFixed(1);
        const color = PALETTE[i % PALETTE.length];
        const fmtV = Math.round(val).toLocaleString('fr-FR')+' €';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer" onmouseenter="_donutHover('+i+')" onmouseleave="_donutHover(null)">'+
          '<div style="display:flex;align-items:center;gap:6px;min-width:0">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:'+color+';flex-shrink:0"></div>'+
            '<span style="font-size:10px;color:rgba(226,232,243,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+cat+'</span>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-shrink:0">'+
            '<span style="font-size:10px;font-family:monospace;color:var(--green);font-weight:600">+'+fmtV+'</span>'+
            '<span style="font-size:10px;color:var(--text2);width:36px;text-align:right">'+pct+'%</span>'+
          '</div>'+
        '</div>';
      }).join('');
      if (entries.length > 6) {
        const rest = entries.slice(6).reduce((s,[,v])=>s+v,0);
        const pct  = ((rest/total)*100).toFixed(1);
        const fmtV = Math.round(rest).toLocaleString('fr-FR')+' €';
        legend.innerHTML += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
          '<div style="display:flex;align-items:center;gap:6px">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:rgba(126,143,168,0.4);flex-shrink:0"></div>'+
            '<span style="font-size:10px;color:var(--text2)">Autres ('+(entries.length-6)+')</span>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-shrink:0">'+
            '<span style="font-size:10px;font-family:monospace;color:var(--green)">+'+fmtV+'</span>'+
            '<span style="font-size:10px;color:var(--text2);width:36px;text-align:right">'+pct+'%</span>'+
          '</div>'+
        '</div>';
      }
    }

    // Expose draw for legend hover
    window._caDonutDraw  = draw;
    window._caDonutSlices = slices;
    }; // end resizeAndDraw

    resizeAndDraw();

    // Re-draw on resize
    if (window._caDonutRO) window._caDonutRO.disconnect();
    window._caDonutRO = new ResizeObserver(() => {
      resizeAndDraw();
      if (window._caDonutDraw) window._caDonutDraw(null);
    });
    window._caDonutRO.observe(cv.parentElement);
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
        '<div style="font-size:10px;color:var(--text2)">P1 <span style="color:var(--cyan);font-weight:700;font-family:monospace">'+ fmtFR(p1Min)+' → '+fmtFR(p1Max)+'</span></div>'+
        '<div style="font-size:10px;color:var(--text2)">P2 <span style="color:var(--text);font-weight:600;font-family:monospace">'+ fmtFR(p2Min)+' → '+fmtFR(p2Max)+'</span></div>'+
      '</div>'+
      '<div style="font-size:12px;font-weight:700;color:'+(totalDelta>=0?'var(--green)':'var(--red)')+'">'+(totalDelta>=0?'+':'')+totalDelta.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €</div>'+
    '</div>'+
    '<div style="overflow:hidden;width:100%">'+
      '<canvas id="'+wfId+'" style="display:block;max-width:100%;height:'+Math.max(drivers.length*52+40, 120)+'px"></canvas>'+
    '</div>'+
    '<div id="ca-wf-narrative" style="margin-top:16px;border-top:1px solid var(--border);padding-top:4px"></div>';

  const _drawWaterfall = () => {
    const cv = document.getElementById(wfId);
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    // Use the card element width to avoid measuring an already-oversized canvas
    const W = Math.floor(wfEl.clientWidth - 32); // subtract card padding
    const rowH = 52;
    const H   = drivers.length * rowH + 40;
    cv.width  = W * dpr; cv.height = H * dpr;
    cv.style.width  = W + 'px'; cv.style.height = H + 'px';
    cv.style.height = H + 'px'; // also fix HTML height
    const cx = cv.getContext('2d');
    cx.scale(dpr, dpr);

    // Bidirectional: positive → right (green), negative → left (red)
    const LBL_W = 160, VAL_W = 90, PAD_L = 8, PAD_R = 4;
    // Bar zone: from LBL_W to W, split in half at AXIS_X
    // Each half = (W - LBL_W) / 2, minus VAL_W for the value label
    const HALF_ZONE = (W - LBL_W) / 2;
    const AXIS_X = LBL_W + HALF_ZONE;
    const halfMax = Math.max(10, HALF_ZONE - VAL_W);

    // Clip everything to canvas bounds
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); cx.clip();

    // Draw centre axis line
    cx.strokeStyle = 'rgba(255,255,255,0.12)';
    cx.lineWidth = 1; cx.setLineDash([]);
    cx.beginPath(); cx.moveTo(AXIS_X, 0); cx.lineTo(AXIS_X, H); cx.stroke();

    drivers.forEach((d, i) => {
      const y = i * rowH + 10;
      // CA: positive delta = good (green right), negative = bad (red left)
      const isPos = d.delta >= 0;
      const color = isPos ? '#22c97a' : '#f0566a';
      const colorFill = isPos ? 'rgba(34,201,122,0.18)' : 'rgba(240,86,106,0.18)';
      const barW = Math.min(halfMax, Math.max(4, (Math.abs(d.delta) / maxAbs) * halfMax));
      const pct  = d.p2 > 0 ? ((d.delta/d.p2)*100) : (d.delta > 0 ? 100 : -100);
      // Bar starts at axis, goes right (pos) or left (neg)
      const barX = isPos ? AXIS_X : AXIS_X - barW;

      // Label (left side)
      const parts = d.key.split(' · ');
      const catLbl = parts[0] || d.key, bienLbl = parts[1] || '';
      const maxLblW = LBL_W - PAD_L - 6;
      cx.font = 'bold 10px Outfit,sans-serif'; cx.fillStyle = 'rgba(226,232,243,0.9)'; cx.textAlign = 'left';
      let catTxt = catLbl;
      while (cx.measureText(catTxt).width > maxLblW && catTxt.length > 4) catTxt = catTxt.slice(0,-1);
      if (catTxt !== catLbl) catTxt += '…';
      cx.fillText(catTxt, PAD_L, y + 13);
      if (bienLbl) {
        cx.font = '9px Outfit,sans-serif'; cx.fillStyle = 'rgba(126,143,168,0.8)';
        let bTxt = bienLbl;
        while (cx.measureText(bTxt).width > maxLblW && bTxt.length > 4) bTxt = bTxt.slice(0,-1);
        if (bTxt !== bienLbl) bTxt += '…';
        cx.fillText(bTxt, PAD_L, y + 26);
      }

      // Bar background = exactly the half zone (clip handles the rest)
      const bgW = W - AXIS_X - 2;  // right half available
      cx.fillStyle = 'rgba(255,255,255,0.03)';
      cx.beginPath();
      if (isPos) cx.roundRect(AXIS_X, y+2, bgW, rowH-16, [0,4,4,0]);
      else       cx.roundRect(LBL_W, y+2, AXIS_X - LBL_W, rowH-16, [4,0,0,4]);
      cx.fill();

      // Bar fill
      cx.fillStyle = colorFill; cx.strokeStyle = color; cx.lineWidth = 1;
      cx.beginPath(); cx.roundRect(barX, y+2, barW, rowH-16, 4); cx.fill(); cx.stroke();

      // Value label: outside bar tip
      cx.font = 'bold 11px Outfit,monospace'; cx.fillStyle = color;
      const deltaStr = (d.delta>=0?'+':'')+Math.round(d.delta).toLocaleString('fr-FR')+' €';
      const pctStr = (pct>=0?'+':'')+pct.toFixed(0)+'%';
      if (isPos) {
        // Value to the right of bar, clamped to canvas right edge
        const vx = Math.min(AXIS_X + barW + 6, W - VAL_W + 2);
        cx.textAlign = 'left';
        cx.fillText(deltaStr, vx, y + 14);
        cx.font = '9px Outfit,sans-serif'; cx.fillStyle = 'rgba(126,143,168,0.7)';
        cx.fillText(pctStr, vx, y + 26);
      } else {
        // Value to the left of bar, clamped to left edge (LBL_W)
        const vx = Math.max(AXIS_X - barW - 6, LBL_W + 2);
        cx.textAlign = 'right';
        cx.fillText(deltaStr, vx, y + 14);
        cx.font = '9px Outfit,sans-serif'; cx.fillStyle = 'rgba(126,143,168,0.7)';
        cx.fillText(pctStr, vx, y + 26);
      }
      cx.textAlign = 'left';

      // Separator
      if (i < drivers.length - 1) {
        cx.strokeStyle = 'rgba(35,42,56,0.8)';
        cx.lineWidth = 1;
        cx.setLineDash([3,4]);
        cx.beginPath();
        cx.moveTo(0, y + rowH - 2);
        cx.lineTo(W, y + rowH - 2);
        cx.stroke();
        cx.setLineDash([]);
      }
    });

  }; // end _drawWaterfall
  requestAnimationFrame(_drawWaterfall);

  // Re-draw waterfall on resize
  if (window._caWfRO) window._caWfRO.disconnect();
  window._caWfRO = new ResizeObserver(() => requestAnimationFrame(_drawWaterfall));
  const wfCv = document.getElementById(wfId);
  if (wfCv) window._caWfRO.observe(wfCv.parentElement);

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
    const trend = totalDelta >= 0 ? '↑ Progression' : '↓ Recul';
    const trendColor = totalDelta >= 0 ? 'var(--green)' : 'var(--red)';
    bullets.push({
      icon: totalDelta >= 0 ? '📈' : '📉',
      color: trendColor,
      text: '<strong>'+trend+' globale</strong> — Le CA de P1 ('+p1Label+') '+
            (totalDelta>=0?'progresse de <strong style="color:var(--green)">+'+fmtAmt(Math.abs(totalDelta))+'</strong>':'recule de <strong style="color:var(--red)">-'+fmtAmt(Math.abs(totalDelta))+'</strong>')+
            ' par rapport à P2 ('+p2Label+') sur une fenêtre de <strong>'+mthLabel(driver)+'</strong>.'
    });

    // Bullet 2 — top hausses
    if (top3pos.length) {
      const items = top3pos.map(d => {
        const parts = d.key.split(' · ');
        const p = fmtPct(d.delta, d.p2);
        return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--green)">+'+fmtAmt(d.delta)+', '+p+'</span>)';
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
        '<span>Dépenses — évolution '+gran+'</span>'+
        _chartModeToggleHtml('window._redrawDepChart')+
      '</div>'+
      '<div style="position:relative;width:100%;height:220px">'+
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
                '<th onclick="_sortDepOps(this,0)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="0" data-sort-dir="desc">DATE <span class="sort-arrow">↓</span></th>'+
                '<th onclick="_sortDepOps(this,1)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="1" data-sort-dir="">BIEN <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortDepOps(this,2)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="2" data-sort-dir="">CATÉGORIE <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortDepOps(this,3)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="3" data-sort-dir="">LIBELLÉ <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortDepOps(this,4)" style="padding:8px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none" data-sort-col="4" data-sort-dir="">MONTANT <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
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
        '<div style="padding:10px 0 2px;font-size:10px;color:var(--text2);text-align:right">'+lines.length+' opération'+(lines.length>1?'s':'')+' · total <span style="color:var(--red);font-weight:700">-'+_fmtK(totalDep)+'</span></div>'+
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
          '<div id="dep-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:5px"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card" id="dep-wf-card" style="margin-top:18px"></div>';

  // Equalise KPI card heights
  requestAnimationFrame(() => {
    const kpis = el.querySelectorAll('.kpi-card');
    if (kpis.length > 1) {
      kpis.forEach(k => k.style.height = '');
      const maxH = Math.max(...[...kpis].map(k => k.offsetHeight));
      kpis.forEach(k => k.style.height = maxH + 'px');
    }
  });

  // Draw area chart — RED theme for depenses
  const _drawDepArea = () => {
    const cv = document.getElementById(chartId);
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.parentElement.getBoundingClientRect();
    const W = rect.width || cv.parentElement.clientWidth; const H = rect.height || 220;
    cv.width = W*dpr; cv.height = H*dpr;
    cv.style.width = W+'px'; cv.style.height = H+'px';
    const cx = cv.getContext('2d');
    cx.scale(dpr, dpr);

    const PAD = { top:28, right:24, bottom:44, left:58 };
    const cW = W-PAD.left-PAD.right;
    const cH = H-PAD.top-PAD.bottom;
    const rawVals = pEntries.map(([,v])=>v);
    const labels = pEntries.map(([l])=>l);
    let cumul2 = 0;
    const vals = _chartMode === 'cumul'
      ? rawVals.map(v => { cumul2 += v; return cumul2; })
      : rawVals;
    const maxV = Math.max(...vals,1);
    const minV2 = Math.min(...vals, 0);
    const scaleD = _niceScale(minV2, maxV, 5);
    const xOf = i => PAD.left+(i/Math.max(vals.length-1,1))*cW;
    const yOf = v => PAD.top+cH-((v-scaleD.min)/(scaleD.max-scaleD.min||1))*cH;

    // Grid
    cx.setLineDash([3,5]); cx.lineWidth=1; cx.strokeStyle='rgba(255,255,255,0.06)';
    scaleD.ticks.forEach(v => {
      const y=yOf(v);
      if(y>=PAD.top-2&&y<=PAD.top+cH+2){cx.beginPath();cx.moveTo(PAD.left,y);cx.lineTo(PAD.left+cW,y);cx.stroke();}
    });
    cx.setLineDash([]);

    // Y labels
    cx.font='10px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.8)'; cx.textAlign='right';
    scaleD.ticks.forEach(v => {
      const y=yOf(v);
      if(y>=PAD.top-2&&y<=PAD.top+cH+2)
        cx.fillText(Math.round(v).toLocaleString('fr-FR')+' €', PAD.left-8, y+3.5);
    });

    // Area fill — red gradient
    const grad = cx.createLinearGradient(0,PAD.top,0,PAD.top+cH);
    grad.addColorStop(0,'rgba(240,86,106,0.30)');
    grad.addColorStop(0.5,'rgba(240,86,106,0.10)');
    grad.addColorStop(1,'rgba(240,86,106,0.00)');
    cx.beginPath(); cx.moveTo(xOf(0),yOf(vals[0]));
    for(let i=1;i<vals.length;i++) cx.lineTo(xOf(i),yOf(vals[i]));
    cx.lineTo(xOf(vals.length-1),PAD.top+cH); cx.lineTo(xOf(0),PAD.top+cH);
    cx.closePath(); cx.fillStyle=grad; cx.fill();

    // Line
    cx.beginPath(); cx.moveTo(xOf(0),yOf(vals[0]));
    for(let i=1;i<vals.length;i++) cx.lineTo(xOf(i),yOf(vals[i]));
    cx.strokeStyle='#f0566a'; cx.lineWidth=2.5; cx.lineJoin='round'; cx.stroke();

    // Points + labels
    cx.font='bold 9px Outfit,monospace';
    for(let i=0;i<vals.length;i++){
      const x=xOf(i),y=yOf(vals[i]);
      cx.beginPath();cx.arc(x,y,3.5,0,Math.PI*2);
      cx.fillStyle='#f0566a';cx.fill();
      cx.strokeStyle='#0b0d12';cx.lineWidth=1.5;cx.stroke();
      const showLabel = vals.length <= 6 || i === 0 || i === vals.length - 1;
      if(showLabel && vals[i]>0){
        const lbl=Math.round(vals[i]).toLocaleString('fr-FR')+' €';
        const isFirst=i===0, isLast=i===vals.length-1;
        cx.textAlign = isFirst?'left':isLast?'right':'center';
        const lx=isFirst?x+6:isLast?x-6:x, ly=y-13;
        const tw=cx.measureText(lbl).width, pad=4;
        const bx=cx.textAlign==='left'?lx-pad:cx.textAlign==='right'?lx-tw-pad:lx-tw/2-pad;
        cx.fillStyle='rgba(11,13,18,0.72)';
        cx.beginPath();cx.roundRect(bx,ly-9,tw+pad*2,13,3);cx.fill();
        cx.fillStyle='rgba(240,86,106,0.95)';
        cx.fillText(lbl,lx,ly);
      }
    }

    // X labels
    cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.7)'; cx.textAlign='center';
    const step=vals.length<=12?1:Math.ceil(vals.length/12);
    for(let i=0;i<labels.length;i+=step) cx.fillText(labels[i],xOf(i),PAD.top+cH+16);
  }; // end _drawDepArea
  requestAnimationFrame(_drawDepArea);
  window._redrawDepChart = _drawDepArea;
  if (window._depAreaRO) window._depAreaRO.disconnect();
  window._depAreaRO = new ResizeObserver(() => requestAnimationFrame(_drawDepArea));
  const depAreaCv = document.getElementById(chartId);
  if (depAreaCv) window._depAreaRO.observe(depAreaCv.parentElement);

  // ── Donut dépenses par catégorie ─────────────
  requestAnimationFrame(() => {
    const cv = document.getElementById('dep-donut-cv');
    if (!cv) return;
    const DEP_PALETTE = ['#f0566a','#f5b731','#9b6ef3','#fb923c','#38bdf8','#22d3c8','#a3e635','#e879f9','#34d399','#22c97a'];
    const total = catEntries.reduce((s,[,v])=>s+v, 0);
    if (!total) return;

    const depDonutDraw = (hovered) => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.parentElement.clientWidth;
      const H = 260;
      cv.width  = W*dpr; cv.height = H*dpr;
      cv.style.width = W+'px'; cv.style.height = H+'px';
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      const cx0 = W/2, cy0 = H/2-5;
      const R = Math.max(10, Math.min(W,H)/2-14);
      const r = R*0.52;
      const slices = [];
      let angle = -Math.PI/2;
      catEntries.forEach(([cat,val],i) => {
        const sweep = (val/total)*Math.PI*2;
        slices.push({cat,val,color:DEP_PALETTE[i%DEP_PALETTE.length],a0:angle,a1:angle+sweep});
        angle += sweep;
      });
      ctx.clearRect(0,0,W,H);
      slices.forEach((s,i) => {
        const isHov = i===hovered;
        ctx.beginPath(); ctx.moveTo(cx0,cy0);
        ctx.arc(cx0,cy0,isHov?R+6:R,s.a0,s.a1); ctx.closePath();
        ctx.fillStyle = isHov ? s.color : s.color+'cc'; ctx.fill();
        ctx.strokeStyle='#111318'; ctx.lineWidth=isHov?2:1.5; ctx.stroke();
      });
      ctx.beginPath(); ctx.arc(cx0,cy0,r,0,Math.PI*2);
      ctx.fillStyle='#111318'; ctx.fill();
      if (hovered!==null && hovered>=0 && slices[hovered]) {
        const s=slices[hovered];
        const pct=((s.val/total)*100).toFixed(1);
        ctx.font='bold 13px Outfit,sans-serif'; ctx.fillStyle=s.color; ctx.textAlign='center';
        ctx.fillText('-'+Math.round(s.val).toLocaleString('fr-FR')+' €',cx0,cy0+2);
        ctx.font='9px Outfit,sans-serif'; ctx.fillStyle='rgba(126,143,168,0.8)';
        ctx.fillText(pct+'%',cx0,cy0+15);
      } else {
        ctx.font='bold 13px Outfit,sans-serif'; ctx.fillStyle='#e2e8f3'; ctx.textAlign='center';
        ctx.fillText('-'+(Math.round(total).toLocaleString('fr-FR')+' €'),cx0,cy0+2);
        ctx.font='9px Outfit,sans-serif'; ctx.fillStyle='rgba(126,143,168,0.8)';
        ctx.fillText('Dép. totales',cx0,cy0+15);
      }
      window._depDonutDraw   = depDonutDraw;
      window._depDonutSlices = slices;
      window._depDonutW = W; window._depDonutH = H;
    };
    depDonutDraw(null);

    const tip = document.getElementById('dep-donut-tip');
    const hitTest = (mx,my,W,H) => {
      const cx0=W/2, cy0=H/2-5;
      const R=Math.max(10,Math.min(W,H)/2-14), r=R*0.52;
      const dx=mx-cx0, dy=my-cy0;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (dist<r||dist>R+8) return -1;
      let a=Math.atan2(dy,dx);
      const aNorm=((a+Math.PI/2)+Math.PI*2)%(Math.PI*2);
      const slices=window._depDonutSlices||[];
      for(let i=0;i<slices.length;i++){
        const a0=((slices[i].a0+Math.PI/2)+Math.PI*2)%(Math.PI*2);
        const a1=((slices[i].a1+Math.PI/2)+Math.PI*2)%(Math.PI*2);
        if(a0<=a1?(aNorm>=a0&&aNorm<a1):(aNorm>=a0||aNorm<a1)) return i;
      }
      return -1;
    };
    cv.onmousemove = (e) => {
      const rect=cv.getBoundingClientRect();
      const W=window._depDonutW||cv.parentElement.clientWidth;
      const H=window._depDonutH||260;
      const mx=(e.clientX-rect.left)*(W/rect.width);
      const my=(e.clientY-rect.top)*(H/rect.height);
      const idx=hitTest(mx,my,W,H);
      if(window._depDonutDraw) window._depDonutDraw(idx>=0?idx:null);
      cv.style.cursor=idx>=0?'pointer':'default';
      if(idx>=0&&tip){
        const sl=(window._depDonutSlices||[])[idx];
        if(!sl){tip.style.display='none';return;}
        const pct=((sl.val/total)*100).toFixed(1);
        const fmtV=(()=>{const _v=sl.val;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})();
        tip.style.display='block'; tip.style.width='170px';
        tip.innerHTML=
          '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">'+
            '<div style="width:9px;height:9px;border-radius:50%;background:'+sl.color+';flex-shrink:0"></div>'+
            '<span style="font-weight:700;color:#e2e8f3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+sl.cat+'</span>'+
          '</div>'+
          '<div style="font-family:monospace;font-size:14px;font-weight:800;color:var(--red)">-'+fmtV+' €</div>'+
          '<div style="font-size:10px;color:var(--text2);margin-top:4px">'+pct+'% des dépenses</div>';
        const tipW=182,tipH=82;
        let tx=(e.clientX-rect.left)+14, ty=(e.clientY-rect.top)-30;
        if(tx+tipW>rect.width) tx=(e.clientX-rect.left)-tipW-10;
        if(ty<4) ty=4;
        if(ty+tipH>rect.height) ty=rect.height-tipH-4;
        tip.style.left=tx+'px'; tip.style.top=ty+'px';
      } else if(tip) tip.style.display='none';
    };
    cv.onmouseleave = () => { if(window._depDonutDraw)window._depDonutDraw(null); cv.style.cursor='default'; if(tip)tip.style.display='none'; };

    // Legend
    const legend=document.getElementById('dep-donut-legend');
    if(legend){
      legend.innerHTML=catEntries.slice(0,6).map(([cat,val],i)=>{
        const pct=((val/total)*100).toFixed(1);
        const color=DEP_PALETTE[i%DEP_PALETTE.length];
        const fmtV=Math.round(val).toLocaleString('fr-FR')+' €';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer" onmouseenter="_depDonutHover('+i+')" onmouseleave="_depDonutHover(null)">'+
          '<div style="display:flex;align-items:center;gap:6px;min-width:0">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:'+color+';flex-shrink:0"></div>'+
            '<span style="font-size:10px;color:rgba(226,232,243,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+cat+'</span>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-shrink:0">'+
            '<span style="font-size:10px;font-family:monospace;color:var(--red);font-weight:600">-'+fmtV+'</span>'+
            '<span style="font-size:10px;color:var(--text2);width:36px;text-align:right">'+pct+'%</span>'+
          '</div>'+
        '</div>';
      }).join('');
      if(catEntries.length>6){
        const rest=catEntries.slice(6).reduce((s,[,v])=>s+v,0);
        const pct=((rest/total)*100).toFixed(1);
        const fmtV=Math.round(rest).toLocaleString('fr-FR')+' €';
        legend.innerHTML+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
          '<div style="display:flex;align-items:center;gap:6px">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:rgba(126,143,168,0.4);flex-shrink:0"></div>'+
            '<span style="font-size:10px;color:var(--text2)">Autres ('+(catEntries.length-6)+')</span>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-shrink:0">'+
            '<span style="font-size:10px;font-family:monospace;color:var(--red)">-'+fmtV+'</span>'+
            '<span style="font-size:10px;color:var(--text2);width:36px;text-align:right">'+pct+'%</span>'+
          '</div>'+
        '</div>';
      }
    }
    // ResizeObserver for donut
    if(window._depDonutRO) window._depDonutRO.disconnect();
    window._depDonutRO=new ResizeObserver(()=>{if(window._depDonutDraw)window._depDonutDraw(null);});
    window._depDonutRO.observe(cv.parentElement);
  });

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
        '<div style="font-size:10px;color:var(--text2)">P1 <span style="color:var(--red);font-weight:700;font-family:monospace">'+fmtFR(p1Min)+' → '+fmtFR(p1Max)+'</span></div>'+
        '<div style="font-size:10px;color:var(--text2)">P2 <span style="color:var(--text);font-weight:600;font-family:monospace">'+fmtFR(p2Min)+' → '+fmtFR(p2Max)+'</span></div>'+
      '</div>'+
      '<div style="font-size:12px;font-weight:700;color:'+(totalDelta<=0?'var(--green)':'var(--red)')+'">'+(totalDelta<=0?'':'+')+(totalDelta).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €</div>'+
    '</div>'+
    '<div style="overflow:hidden;width:100%">'+
      '<canvas id="'+wfId+'" style="display:block;max-width:100%;height:'+Math.max(drivers.length*52+40,120)+'px"></canvas>'+
    '</div>'+
    '<div id="dep-wf-narrative" style="margin-top:16px;border-top:1px solid var(--border);padding-top:4px"></div>';

  const _drawDepWaterfall = () => {
    const cv=document.getElementById(wfId); if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    const W=Math.floor(wfEl.clientWidth-32);
    const rowH=52, H=drivers.length*rowH+40;
    cv.width=W*dpr; cv.height=H*dpr;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    const cx=cv.getContext('2d'); cx.scale(dpr,dpr);
    // Bidirectional: cost increase (bad) → left (red), cost decrease (good) → right (green)
    const LBL_W=160, VAL_W=90, PAD_L=8, PAD_R=4;
    const HALF_ZONE=(W-LBL_W)/2;
    const AXIS_X=LBL_W+HALF_ZONE;
    const halfMax=Math.max(10,HALF_ZONE-VAL_W);

    cx.save(); cx.beginPath(); cx.rect(0,0,W,H); cx.clip();
    cx.strokeStyle='rgba(255,255,255,0.12)'; cx.lineWidth=1; cx.setLineDash([]);
    cx.beginPath(); cx.moveTo(AXIS_X,0); cx.lineTo(AXIS_X,H); cx.stroke();

    drivers.forEach((d,i)=>{
      const y=i*rowH+10;
      // Dépenses: delta<0 = costs down = good (green right), delta>0 = costs up = bad (red left)
      const isGood=d.delta<=0;
      const color=isGood?'#22c97a':'#f0566a';
      const colorFill=isGood?'rgba(34,201,122,0.18)':'rgba(240,86,106,0.18)';
      const barW=Math.min(halfMax, Math.max(4,(Math.abs(d.delta)/maxAbs)*halfMax));
      const pct=d.p2>0?((d.delta/d.p2)*100):(d.delta>0?100:-100);
      const barX=isGood?AXIS_X:AXIS_X-barW;
      const parts=d.key.split(' · ');
      const catLbl=parts[0]||d.key, bienLbl=parts[1]||'';
      const maxLblW=LBL_W-PAD_L-6;
      cx.font='bold 10px Outfit,sans-serif'; cx.fillStyle='rgba(226,232,243,0.9)'; cx.textAlign='left';
      let cTxt=catLbl;
      while(cx.measureText(cTxt).width>maxLblW&&cTxt.length>4) cTxt=cTxt.slice(0,-1);
      if(cTxt!==catLbl) cTxt+='…';
      cx.fillText(cTxt,PAD_L,y+13);
      if(bienLbl){
        cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.8)';
        let bTxt=bienLbl;
        while(cx.measureText(bTxt).width>maxLblW&&bTxt.length>4) bTxt=bTxt.slice(0,-1);
        if(bTxt!==bienLbl) bTxt+='…';
        cx.fillText(bTxt,PAD_L,y+26);
      }
      const bgW=W-AXIS_X-2;
      cx.fillStyle='rgba(255,255,255,0.03)'; cx.beginPath();
      if(isGood) cx.roundRect(AXIS_X,y+2,bgW,rowH-16,[0,4,4,0]);
      else       cx.roundRect(LBL_W,y+2,AXIS_X-LBL_W,rowH-16,[4,0,0,4]);
      cx.fill();
      cx.fillStyle=colorFill; cx.strokeStyle=color; cx.lineWidth=1;
      cx.beginPath(); cx.roundRect(barX,y+2,barW,rowH-16,4); cx.fill(); cx.stroke();
      cx.font='bold 11px Outfit,monospace'; cx.fillStyle=color;
      const deltaStr=(d.delta>0?'+':'')+d.delta.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €';
      const pctStr=(pct>=0?'+':'')+pct.toFixed(0)+'%';
      if(isGood){
        const vx=Math.min(AXIS_X+barW+6, W-VAL_W+2);
        cx.textAlign='left';
        cx.fillText(deltaStr,vx,y+14);
        cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.7)';
        cx.fillText(pctStr,vx,y+26);
      } else {
        const vx=Math.max(AXIS_X-barW-6, LBL_W+2);
        cx.textAlign='right';
        cx.fillText(deltaStr,vx,y+14);
        cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.7)';
        cx.fillText(pctStr,vx,y+26);
      }
      cx.textAlign='left';
      if(i<drivers.length-1){
        cx.strokeStyle='rgba(35,42,56,0.8)'; cx.lineWidth=1; cx.setLineDash([3,4]);
        cx.beginPath(); cx.moveTo(0,y+rowH-2); cx.lineTo(W,y+rowH-2); cx.stroke();
        cx.setLineDash([]);
      }
    });
  };
  requestAnimationFrame(_drawDepWaterfall);
  if(window._depWfRO) window._depWfRO.disconnect();
  window._depWfRO=new ResizeObserver(()=>requestAnimationFrame(_drawDepWaterfall));
  const depWfCv=document.getElementById(wfId);
  if(depWfCv) window._depWfRO.observe(depWfCv.parentElement);

  // ── Narrative bullets ──────────────────────
  const narrativeEl=document.getElementById('dep-wf-narrative');
  if(!narrativeEl) return;
  const fmtAmt=v=>((v>=0?'+':'')+Math.round(v).toLocaleString('fr-FR')+' €');
  const fmtPct=(delta,base)=>base>0?((delta/base)*100).toFixed(0)+'%':(delta>0?'+100%':'-100%');
  const mthLabel=n=>n===1?'1 mois':n+' mois';
  const bullets=[];
  const sign=totalDelta>=0?'+':'';
  const trend=totalDelta<=0?'↓ Réduction des charges':'↑ Hausse des charges';
  const trendColor=totalDelta<=0?'var(--green)':'var(--red)';
  bullets.push({
    icon:totalDelta<=0?'📉':'📈',
    text:'<strong>'+trend+'</strong> — Les dépenses de P1 ('+fmtFR(p1Min)+' → '+fmtFR(p1Max)+') '+
         (totalDelta<=0?'reculent de <strong style="color:var(--green)">-'+fmtAmt(Math.abs(totalDelta))+'</strong>':'progressent de <strong style="color:var(--red)">+'+fmtAmt(Math.abs(totalDelta))+'</strong>')+
         ' vs P2 ('+fmtFR(p2Min)+' → '+fmtFR(p2Max)+') sur <strong>'+mthLabel(driver)+'</strong>.'
  });
  if(top3pos.length){
    const items=top3pos.map(d=>{
      const parts=d.key.split(' · ');
      return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--red)">+'+fmtAmt(d.delta)+', '+fmtPct(d.delta,d.p2)+'</span>)';
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
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;white-space:nowrap;font-family:monospace">'+l.dDisplay+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;word-break:break-word;line-height:1.4">'+l.bien+'</td>'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;word-break:break-word;line-height:1.4">'+l.cat+'</td>'+
      '<td style="padding:7px 10px;font-size:10px;color:var(--text2);word-break:break-word;line-height:1.4">'+l.lib+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:600;color:var(--red);white-space:nowrap">'+(()=>{const _v=l.amt;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+','+_d+' €'})()+'</td>'+
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

