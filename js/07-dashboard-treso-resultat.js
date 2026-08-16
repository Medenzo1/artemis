// ── TRÉSORERIE ────────────────────────────────
function _renderSynTresorerie() {
  const el = document.getElementById('syn-content'); if (!el) return;
  const gran = 'mensuel';

  const allLines = _synLines();
  if (!allLines.length) { el.innerHTML = _emptyState('Aucune donnée pour cette sélection'); return; }

  // Trésorerie = 100% des mouvements bancaires filtrés
  const lines = allLines;

  const totalIn  = lines.filter(l => +l.montant > 0).reduce((s,l) => s + (+l.montant), 0);
  const totalOut = lines.filter(l => +l.montant < 0).reduce((s,l) => s + Math.abs(+l.montant), 0);
  const solde    = totalIn - totalOut;

  // By période
  const periods = [...new Set(lines.map(l => l._period))].sort();
  const mNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const pEntries = periods.map(p => {
    const pLines = lines.filter(l => l._period === p);
    const inn  = pLines.filter(l => +l.montant > 0).reduce((s,l) => s + (+l.montant), 0);
    const out  = pLines.filter(l => +l.montant < 0).reduce((s,l) => s + Math.abs(+l.montant), 0);
    const net  = inn - out;
    const [pY, pM] = p.split('-');
    const lbl = gran === 'mensuel' ? (mNames[(parseInt(pM)||1)-1] + ' ' + pY) : pY;
    return { p, lbl, inn, out, net };
  });

  // Cumulative solde
  let cumul = 0;
  const cumulVals = pEntries.map(e => { cumul += e.net; return cumul; });

  // Bien map for detail table
  const bienMap = {};
  lines.forEach(l => {
    const k = l.bienName||l.bien||'Non attribué';
    if (!bienMap[k]) bienMap[k] = { inn:0, out:0 };
    if (+l.montant > 0) bienMap[k].inn += +l.montant;
    else bienMap[k].out += Math.abs(+l.montant);
  });
  const bienEntries = Object.entries(bienMap).sort((a,b) => (b[1].inn-b[1].out) - (a[1].inn-a[1].out));

  const bienRows = bienEntries.map(([b,v]) => {
    const net = v.inn - v.out;
    return '<tr>'+
      '<td>'+b+'</td>'+
      '<td style="text-align:right;color:var(--green);font-family:monospace">+'+_fmtK(v.inn)+'</td>'+
      '<td style="text-align:right;color:var(--red);font-family:monospace">-'+_fmtK(v.out)+'</td>'+
      '<td style="text-align:right;font-family:monospace;font-weight:700;color:'+(net>=0?'var(--cyan)':'var(--red)')+'">'+(net>=0?'+':'')+_fmtK(net)+'</td>'+
    '</tr>';
  }).join('');

  // Ops table — all ops sorted by date desc
  const opsLines = lines.slice().map(l => ({
    d: (()=>{ const r=l.date||''; if(/^\d{4}-\d{2}-\d{2}/.test(r)) return r.slice(0,10); if(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/.test(r)){const[,dd,mm,yy]=r.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);return yy+'-'+mm+'-'+dd;} return l._period||''; })(),
    dDisplay: (()=>{ const r=l.date||''; if(/^\d{4}-\d{2}-\d{2}/.test(r)){const[y,m,d]=r.slice(0,10).split('-');return d+'/'+m+'/'+y;} if(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/.test(r)) return r.slice(0,10); return l._period||'-'; })(),
    bien: l.bienName||l.bien||'—',
    cat:  l.cat||l.categorie||'—',
    lib:  (typeof normaliseLib==='function'?normaliseLib(l.libelle||l.label||''):(l.libelle||l.label||'—'))||'—',
    amt:  +l.montant
  })).sort((a,b) => b.d.localeCompare(a.d));
  window._tresOpsLines = opsLines;

  const chartId = 'tres-area-chart-' + Date.now();

  // Build monthly maps for badges
  const tresPeriodMapIn  = {}, tresPeriodMapOut = {}, tresPeriodMapSolde = {};
  pEntries.forEach(e => {
    tresPeriodMapIn[e.p]    = e.inn;
    tresPeriodMapOut[e.p]   = e.out;
    tresPeriodMapSolde[e.p] = e.net;
  });
  const lastTresPeriod = pEntries.length ? pEntries[pEntries.length-1].p : null;
  const lastIn    = lastTresPeriod ? (tresPeriodMapIn[lastTresPeriod]||0)    : totalIn;
  const lastOut   = lastTresPeriod ? (tresPeriodMapOut[lastTresPeriod]||0)   : totalOut;
  const lastSolde = lastTresPeriod ? (tresPeriodMapSolde[lastTresPeriod]||0) : solde;

  el.innerHTML =
    '<div class="dash-grid-4" style="margin-bottom:20px">'+
      _kpiCard('💰','Total entrées','+'+_fmtK(totalIn),'var(--green)', periods.length+' période'+(periods.length>1?'s':''), _varBadges(lastIn, lastTresPeriod, tresPeriodMapIn, true), Object.keys(tresPeriodMapIn).sort().map(k=>tresPeriodMapIn[k]))+
      _kpiCard('💸','Total sorties','-'+_fmtK(totalOut),'var(--red)', '', _varBadges(lastOut, lastTresPeriod, tresPeriodMapOut, false), Object.keys(tresPeriodMapOut).sort().map(k=>tresPeriodMapOut[k]))+
      _kpiCard('📊','Solde net',(solde>=0?'+':'')+_fmtK(solde), solde>=0?'var(--cyan)':'var(--red)', '', _varBadges(lastSolde, lastTresPeriod, tresPeriodMapSolde, true), Object.keys(tresPeriodMapSolde).sort().map(k=>tresPeriodMapSolde[k]))+
      _kpiCardBig('💳','Nb opérations',''+lines.length,'var(--gold)', null, '💳')+
    '</div>'+
    '<div style="text-align:right;margin-bottom:12px">'+
      '<button onclick="openDiagTreso()" style="background:rgba(34,211,200,.08);border:1px solid rgba(34,211,200,.2);border-radius:7px;color:var(--cyan);font-size:11px;padding:5px 14px;cursor:pointer">🔍 Diagnostic lignes</button>'+
    '</div>'+
    '<div class="card" style="margin-bottom:18px">'+
      '<div class="card-title" style="justify-content:space-between">'+
        '<span>Trésorerie — '+ (_chartMode==='cumul'?'solde cumulé':'solde mensuel') +'</span>'+
        _chartModeToggleHtml('window._redrawTresChart')+
      '</div>'+
      '<div style="position:relative;width:100%;height:220px">'+
        '<canvas id="'+chartId+'" style="width:100%;height:100%"></canvas>'+
      '</div>'+
    '</div>'+
    '<div class="dash-grid-2" style="align-items:stretch">'+
      '<div class="card" style="display:flex;flex-direction:column;height:100%">'+
        '<div class="card-title">Opérations</div>'+
        '<div id="tres-ops-wrap" style="overflow-y:auto;max-height:660px;border-radius:8px;border:1px solid var(--border)">'+
          '<table id="tres-ops-table" style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">'+
            '<colgroup>'+
              '<col style="width:90px"><col style="width:115px"><col style="width:130px"><col style="width:130px"><col style="width:95px">'+
            '</colgroup>'+
            '<thead style="position:sticky;top:0;z-index:2">'+
              '<tr style="background:var(--bg3);border-bottom:1px solid var(--border2)">'+
                '<th onclick="_sortTresOps(this,0)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);cursor:pointer;user-select:none" data-sort-col="0" data-sort-dir="desc">DATE <span class="sort-arrow">↓</span></th>'+
                '<th onclick="_sortTresOps(this,1)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);cursor:pointer;user-select:none" data-sort-col="1" data-sort-dir="">BIEN <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortTresOps(this,2)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);cursor:pointer;user-select:none" data-sort-col="2" data-sort-dir="">CATÉGORIE <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortTresOps(this,3)" style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);cursor:pointer;user-select:none" data-sort-col="3" data-sort-dir="">LIBELLÉ <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
                '<th onclick="_sortTresOps(this,4)" style="padding:8px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text2);cursor:pointer;user-select:none" data-sort-col="4" data-sort-dir="">MONTANT <span class="sort-arrow" style="opacity:.3">↕</span></th>'+
              '</tr>'+
            '</thead>'+
            '<tbody id="tres-ops-body">'+_buildTresOpsRows(opsLines)+'</tbody>'+
          '</table>'+
        '</div>'+
        '<div style="padding:10px 0 2px;font-size:10px;color:var(--text2);text-align:right">'+lines.length+' opération'+(lines.length>1?'s':'')+' · solde <span style="color:'+(solde>=0?'var(--cyan)':'var(--red)')+';font-weight:700">'+(solde>=0?'+':'')+_fmtK(solde)+'</span></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:16px;height:100%">'+
        '<div class="card">'+
          '<div class="card-title">Détail par bien</div>'+
          '<div class="tbl-wrap"><table>'+
            '<thead><tr><th>Bien</th><th style="text-align:right">Entrées</th><th style="text-align:right">Sorties</th><th style="text-align:right">Solde</th></tr></thead>'+
            '<tbody>'+bienRows+'</tbody>'+
            '<tfoot><tr style="border-top:2px solid var(--border2)">'+
              '<td style="font-weight:700">Total</td>'+
              '<td style="text-align:right;color:var(--green);font-weight:700">+'+_fmtK(totalIn)+'</td>'+
              '<td style="text-align:right;color:var(--red);font-weight:700">-'+_fmtK(totalOut)+'</td>'+
              '<td style="text-align:right;font-weight:700;color:'+(solde>=0?'var(--cyan)':'var(--red)')+'">'+(solde>=0?'+':'')+_fmtK(solde)+'</td>'+
            '</tr></tfoot>'+
          '</table></div>'+
        '</div>'+
        '<div class="card" id="tres-cat-donut-card" style="flex:1;display:flex;flex-direction:column">'+
          '<div class="card-title">Répartition entrées par catégorie</div>'+
          '<div style="position:relative;display:inline-block;width:100%">'+
            '<canvas id="tres-donut-cv" style="display:block;width:100%;height:260px;cursor:default"></canvas>'+
            '<div id="tres-donut-tip" style="display:none;position:absolute;pointer-events:none;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:140px;z-index:10"></div>'+
          '</div>'+
          '<div id="tres-donut-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:5px"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card" id="tres-wf-card" style="margin-top:18px"></div>';

  // ── KPI equalizer
  requestAnimationFrame(() => {
    const kpis = el.querySelectorAll('.kpi-card');
    if (kpis.length > 1) {
      kpis.forEach(k => k.style.height = '');
      const maxH = Math.max(...[...kpis].map(k => k.offsetHeight));
      kpis.forEach(k => k.style.height = maxH + 'px');
    }
  });

  // ── Area chart — cumul solde (cyan/teal)
  const _drawTresArea = () => {
    const cv = document.getElementById(chartId); if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.parentElement.clientWidth || 600; const H = 220;
    cv.width = W*dpr; cv.height = H*dpr;
    cv.style.width = W+'px'; cv.style.height = H+'px';
    const cx = cv.getContext('2d'); cx.scale(dpr, dpr);

    const PAD = { top:28, right:24, bottom:44, left:64 };
    const cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom;
    const netVals = pEntries.map(e => e.net);
    const vals = _chartMode === 'cumul' ? cumulVals : netVals;
    const labels = pEntries.map(e => e.lbl);
    const maxV = Math.max(...vals, 1), minV = Math.min(...vals, 0);
    const scaleT = _niceScale(minV, maxV, 5);
    const xOf = i => PAD.left+(i/Math.max(vals.length-1,1))*cW;
    const yOf = v => PAD.top + cH - ((v - scaleT.min) / (scaleT.max - scaleT.min || 1)) * cH;

    // Grid
    cx.setLineDash([3,5]); cx.lineWidth=1; cx.strokeStyle='rgba(255,255,255,0.06)';
    scaleT.ticks.forEach(v => {
      const y=yOf(v);
      if(y>=PAD.top-2&&y<=PAD.top+cH+2){cx.beginPath();cx.moveTo(PAD.left,y);cx.lineTo(PAD.left+cW,y);cx.stroke();}
    });
    cx.setLineDash([]);

    // Zero line if needed
    if (scaleT.min < 0 && scaleT.max > 0) {
      const y0 = yOf(0);
      cx.strokeStyle='rgba(255,255,255,0.15)'; cx.lineWidth=1;
      cx.beginPath(); cx.moveTo(PAD.left,y0); cx.lineTo(PAD.left+cW,y0); cx.stroke();
    }

    // Y labels
    cx.font='10px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.8)'; cx.textAlign='right';
    scaleT.ticks.forEach(v => {
      const y=yOf(v);
      if(y>=PAD.top-2&&y<=PAD.top+cH+2)
        cx.fillText(Math.round(v).toLocaleString('fr-FR')+' €', PAD.left-8, y+3.5);
    });

    // Area fill — cyan gradient
    const grad = cx.createLinearGradient(0,PAD.top,0,PAD.top+cH);
    grad.addColorStop(0,'rgba(245,183,49,0.28)');
    grad.addColorStop(0.5,'rgba(245,183,49,0.08)');
    grad.addColorStop(1,'rgba(245,183,49,0.00)');
    cx.beginPath(); cx.moveTo(xOf(0),yOf(vals[0]));
    for(let i=1;i<vals.length;i++) cx.lineTo(xOf(i),yOf(vals[i]));
    cx.lineTo(xOf(vals.length-1),yOf(0)); cx.lineTo(xOf(0),yOf(0));
    cx.closePath(); cx.fillStyle=grad; cx.fill();

    // Line
    cx.beginPath(); cx.moveTo(xOf(0),yOf(vals[0]));
    for(let i=1;i<vals.length;i++) cx.lineTo(xOf(i),yOf(vals[i]));
    cx.strokeStyle='#f5b731'; cx.lineWidth=2.5; cx.lineJoin='round'; cx.stroke();

    // Points + labels
    cx.font='bold 9px Outfit,monospace';
    for(let i=0;i<vals.length;i++){
      const x=xOf(i),y=yOf(vals[i]);
      const col = vals[i] >= 0 ? '#f5b731' : '#f0566a';
      cx.beginPath();cx.arc(x,y,3.5,0,Math.PI*2);
      cx.fillStyle=col;cx.fill();
      cx.strokeStyle='#0b0d12';cx.lineWidth=1.5;cx.stroke();
      const showLabel = vals.length <= 6 || i === 0 || i === vals.length - 1;
      if(showLabel){
        const lbl=Math.round(vals[i]).toLocaleString('fr-FR')+' €';
        const isFirst=i===0, isLast=i===vals.length-1;
        cx.textAlign = isFirst?'left':isLast?'right':'center';
        const lx=isFirst?x+6:isLast?x-6:x, ly=y-13;
        const tw=cx.measureText(lbl).width, pad=4;
        const bx=cx.textAlign==='left'?lx-pad:cx.textAlign==='right'?lx-tw-pad:lx-tw/2-pad;
        cx.fillStyle='rgba(11,13,18,0.72)';
        cx.beginPath();cx.roundRect(bx,ly-9,tw+pad*2,13,3);cx.fill();
        cx.fillStyle=col;
        cx.fillText(lbl,lx,ly);
      }
    }

    // X labels
    cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.7)'; cx.textAlign='center';
    const step=vals.length<=12?1:Math.ceil(vals.length/12);
    for(let i=0;i<labels.length;i+=step) cx.fillText(labels[i],xOf(i),PAD.top+cH+16);
  };
  requestAnimationFrame(_drawTresArea);
  window._redrawTresChart = _drawTresArea;
  if(window._tresAreaRO) window._tresAreaRO.disconnect();
  window._tresAreaRO = new ResizeObserver(() => requestAnimationFrame(_drawTresArea));
  const tresAreaCv = document.getElementById(chartId);
  if(tresAreaCv) window._tresAreaRO.observe(tresAreaCv.parentElement);

  // ── Donut entrées par catégorie ───────────────
  requestAnimationFrame(() => {
    const cv = document.getElementById('tres-donut-cv'); if (!cv) return;
    const TRES_PALETTE = ['#22d3c8','#22c97a','#38bdf8','#9b6ef3','#f5b731','#f0566a','#a3e635','#fb923c','#e879f9','#34d399'];
    const catMapT = {};
    lines.filter(l => +l.montant > 0).forEach(l => {
      const k = l.cat||l.categorie||'Autre';
      catMapT[k] = (catMapT[k]||0) + (+l.montant);
    });
    const catEntriesT = Object.entries(catMapT).sort((a,b) => b[1]-a[1]);
    const totalT = catEntriesT.reduce((s,[,v]) => s+v, 0);
    if (!totalT) return;

    const tresDonutDraw = (hovered) => {
      const dpr = window.devicePixelRatio||1;
      const W = cv.parentElement.clientWidth; const H = 260;
      cv.width=W*dpr; cv.height=H*dpr;
      cv.style.width=W+'px'; cv.style.height=H+'px';
      const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr);
      const cx0=W/2, cy0=H/2-5;
      const R=Math.max(10,Math.min(W,H)/2-14), r=R*0.52;
      const slices=[];
      let angle=-Math.PI/2;
      catEntriesT.forEach(([cat,val],i) => {
        const sweep=(val/totalT)*Math.PI*2;
        slices.push({cat,val,color:TRES_PALETTE[i%TRES_PALETTE.length],a0:angle,a1:angle+sweep});
        angle+=sweep;
      });
      ctx.clearRect(0,0,W,H);
      slices.forEach((s,i) => {
        const isHov=i===hovered;
        ctx.beginPath(); ctx.moveTo(cx0,cy0);
        ctx.arc(cx0,cy0,isHov?R+6:R,s.a0,s.a1); ctx.closePath();
        ctx.fillStyle=isHov?s.color:s.color+'cc'; ctx.fill();
        ctx.strokeStyle='#111318'; ctx.lineWidth=isHov?2:1.5; ctx.stroke();
      });
      ctx.beginPath(); ctx.arc(cx0,cy0,r,0,Math.PI*2);
      ctx.fillStyle='#111318'; ctx.fill();
      if(hovered!==null && hovered>=0 && slices[hovered]){
        const s=slices[hovered];
        const pct=((s.val/totalT)*100).toFixed(1);
        ctx.font='bold 13px Outfit,sans-serif'; ctx.fillStyle=s.color; ctx.textAlign='center';
        ctx.fillText('+'+Math.round(s.val).toLocaleString('fr-FR')+' €',cx0,cy0+2);
        ctx.font='9px Outfit,sans-serif'; ctx.fillStyle='rgba(126,143,168,0.8)';
        ctx.fillText(pct+'%',cx0,cy0+15);
      } else {
        ctx.font='bold 13px Outfit,sans-serif'; ctx.fillStyle='#e2e8f3'; ctx.textAlign='center';
        ctx.fillText('+'+Math.round(totalT).toLocaleString('fr-FR')+' €',cx0,cy0+2);
        ctx.font='9px Outfit,sans-serif'; ctx.fillStyle='rgba(126,143,168,0.8)';
        ctx.fillText('Entrées',cx0,cy0+15);
      }
      window._tresDonutDraw=tresDonutDraw;
      window._tresDonutSlices=slices;
      window._tresDonutW=W; window._tresDonutH=H;
    };
    tresDonutDraw(null);

    const tip=document.getElementById('tres-donut-tip');
    cv.onmousemove=(e)=>{
      const rect=cv.getBoundingClientRect();
      const W=window._tresDonutW||cv.parentElement.clientWidth, H=window._tresDonutH||260;
      const mx=(e.clientX-rect.left)*(W/rect.width), my=(e.clientY-rect.top)*(H/rect.height);
      const cx0=W/2, cy0=H/2-5;
      const R=Math.max(10,Math.min(W,H)/2-14), r=R*0.52;
      const dx=mx-cx0, dy=my-cy0, dist=Math.sqrt(dx*dx+dy*dy);
      let idx=-1;
      if(dist>=r && dist<=R+8){
        let a=Math.atan2(dy,dx);
        const aN=((a+Math.PI/2)+Math.PI*2)%(Math.PI*2);
        const sl=window._tresDonutSlices||[];
        for(let i=0;i<sl.length;i++){
          const a0=((sl[i].a0+Math.PI/2)+Math.PI*2)%(Math.PI*2);
          const a1=((sl[i].a1+Math.PI/2)+Math.PI*2)%(Math.PI*2);
          if(a0<=a1?(aN>=a0&&aN<a1):(aN>=a0||aN<a1)){idx=i;break;}
        }
      }
      if(window._tresDonutDraw) window._tresDonutDraw(idx>=0?idx:null);
      cv.style.cursor=idx>=0?'pointer':'default';
      if(idx>=0&&tip){
        const sl=(window._tresDonutSlices||[])[idx]; if(!sl){tip.style.display='none';return;}
        const pct=((sl.val/totalT)*100).toFixed(1);
        const fmtV=(()=>{const _v=sl.val;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})();
        tip.style.display='block'; tip.style.width='170px';
        tip.innerHTML='<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">'+
          '<div style="width:9px;height:9px;border-radius:50%;background:'+sl.color+';flex-shrink:0"></div>'+
          '<span style="font-weight:700;color:#e2e8f3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+sl.cat+'</span>'+
          '</div>'+
          '<div style="font-family:monospace;font-size:14px;font-weight:800;color:var(--green)">+'+fmtV+' €</div>'+
          '<div style="font-size:10px;color:var(--text2);margin-top:4px">'+pct+'% des entrées</div>';
        const tipW=182,tipH=82;
        let tx=(e.clientX-rect.left)+14, ty=(e.clientY-rect.top)-30;
        if(tx+tipW>rect.width) tx=(e.clientX-rect.left)-tipW-10;
        if(ty<4) ty=4; if(ty+tipH>rect.height) ty=rect.height-tipH-4;
        tip.style.left=tx+'px'; tip.style.top=ty+'px';
      } else if(tip) tip.style.display='none';
    };
    cv.onmouseleave=()=>{ if(window._tresDonutDraw)window._tresDonutDraw(null); cv.style.cursor='default'; if(tip)tip.style.display='none'; };

    const legend=document.getElementById('tres-donut-legend');
    if(legend){
      legend.innerHTML=catEntriesT.slice(0,6).map(([cat,val],i)=>{
        const pct=((val/totalT)*100).toFixed(1);
        const color=TRES_PALETTE[i%TRES_PALETTE.length];
        const fmtV=Math.round(val).toLocaleString('fr-FR')+' €';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer" onmouseenter="_tresDonutHover('+i+')" onmouseleave="_tresDonutHover(null)">'+
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
      if(catEntriesT.length>6){
        const rest=catEntriesT.slice(6).reduce((s,[,v])=>s+v,0);
        const pct=((rest/totalT)*100).toFixed(1);
        const fmtV=Math.round(rest).toLocaleString('fr-FR')+' €';
        legend.innerHTML+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
          '<div style="display:flex;align-items:center;gap:6px">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:rgba(126,143,168,0.4);flex-shrink:0"></div>'+
            '<span style="font-size:10px;color:var(--text2)">Autres ('+(catEntriesT.length-6)+')</span>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-shrink:0">'+
            '<span style="font-size:10px;font-family:monospace;color:var(--green)">+'+fmtV+'</span>'+
            '<span style="font-size:10px;color:var(--text2);width:36px;text-align:right">'+pct+'%</span>'+
          '</div>'+
        '</div>';
      }
    }
    if(window._tresDonutRO) window._tresDonutRO.disconnect();
    window._tresDonutRO=new ResizeObserver(()=>{ if(window._tresDonutDraw)window._tresDonutDraw(null); });
    window._tresDonutRO.observe(cv.parentElement);
  });

  // ── Waterfall Trésorerie P1 vs P2 ─────────────
  requestAnimationFrame(() => _renderTresWaterfall(el));
}

function _tresDonutHover(idx) { if(window._tresDonutDraw) window._tresDonutDraw(idx); }

function _buildTresOpsRows(rows) {
  return rows.map(l => {
    const isIn = l.amt >= 0;
    const col = isIn ? 'var(--green)' : 'var(--red)';
    const amtStr = (isIn?'+':'')+(()=>{const _v=l.amt;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+','+_d+' €'})();
    return '<tr style="border-bottom:1px solid var(--border);transition:background .12s" onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'\'">'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;white-space:nowrap;font-family:monospace">'+l.dDisplay+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;word-break:break-word;line-height:1.4">'+l.bien+'</td>'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;word-break:break-word;line-height:1.4">'+l.cat+'</td>'+
      '<td style="padding:7px 10px;font-size:10px;color:var(--text2);word-break:break-word;line-height:1.4">'+l.lib+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:600;color:'+col+';white-space:nowrap">'+amtStr+'</td>'+
    '</tr>';
  }).join('');
}

function _sortTresOps(th, col) {
  const table = document.getElementById('tres-ops-table'); if (!table) return;
  const allTh = table.querySelectorAll('thead th[data-sort-col]');
  const newDir = th.dataset.sortDir==='asc' ? 'desc' : 'asc';
  allTh.forEach(h => { h.dataset.sortDir=''; const a=h.querySelector('.sort-arrow'); if(a){a.textContent='↕';a.style.opacity='.3';} });
  th.dataset.sortDir=newDir;
  const arr=th.querySelector('.sort-arrow'); if(arr){arr.textContent=newDir==='asc'?'↑':'↓';arr.style.opacity='1';}
  const rows=(window._tresOpsLines||[]).slice();
  rows.sort((a,b)=>{
    if(col===0) return newDir==='asc'?a.d.localeCompare(b.d):b.d.localeCompare(a.d);
    if(col===1) return newDir==='asc'?a.bien.localeCompare(b.bien,'fr'):b.bien.localeCompare(a.bien,'fr');
    if(col===2) return newDir==='asc'?a.cat.localeCompare(b.cat,'fr'):b.cat.localeCompare(a.cat,'fr');
    if(col===3) return newDir==='asc'?a.lib.localeCompare(b.lib,'fr'):b.lib.localeCompare(a.lib,'fr');
    if(col===4) return newDir==='asc'?a.amt-b.amt:b.amt-a.amt;
    return 0;
  });
  const tbody=document.getElementById('tres-ops-body'); if(tbody) tbody.innerHTML=_buildTresOpsRows(rows);
}

function _renderTresWaterfall(el) {
  const wfEl = document.getElementById('tres-wf-card'); if (!wfEl) return;
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
    const db=_getDB(), periods=Object.keys(db.periods||{}).sort();
    if(!periods.length){wfEl.innerHTML='<div class="dash-empty">Aucune donnée</div>';return;}
    const [ly,lm]=periods[periods.length-1].split('-');
    p1Max=new Date(+ly,+lm,0);
  }
  p1Min=firstOfMonth(addMonths(new Date(p1Max),-(driver-1)));
  p2Max=lastOfMonth(addMonths(new Date(p1Min),-1));
  p2Min=firstOfMonth(addMonths(new Date(p2Max),-(driver-1)));

  const inRange=(d,mn,mx)=>d>=mn&&d<=mx;
  const toDate=s=>{ if(!s)return null; const n=_normDateStr(String(s).trim()).sort; if(!n)return null; return new Date(n); };

  const allLines=_synLines();
  const aggP=(mn,mx)=>{
    const map={};
    allLines.forEach(l=>{
      const d=toDate(l.date||l._period+'-01');
      if(!d||!inRange(d,mn,mx))return;
      const key=(l.cat||l.categorie||'Autre')+' · '+(l.bienName||l.bien||'Non attribué');
      map[key]=(map[key]||0)+(+l.montant);
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
  const wfId='tres-wf-canvas-'+Date.now();

  wfEl.innerHTML=
    '<div class="card-title">📊 Drivers Trésorerie — P1 vs P2</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">'+
      '<div style="display:flex;gap:16px">'+
        '<div style="font-size:10px;color:var(--text2)">P1 <span style="color:var(--cyan);font-weight:700;font-family:monospace">'+fmtFR(p1Min)+' → '+fmtFR(p1Max)+'</span></div>'+
        '<div style="font-size:10px;color:var(--text2)">P2 <span style="color:var(--text);font-weight:600;font-family:monospace">'+fmtFR(p2Min)+' → '+fmtFR(p2Max)+'</span></div>'+
      '</div>'+
      '<div style="font-size:12px;font-weight:700;color:'+(totalDelta>=0?'var(--green)':'var(--red)')+'\">'+(totalDelta>=0?'+':'')+totalDelta.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €</div>'+
    '</div>'+
    '<div style="overflow:hidden;width:100%">'+
      '<canvas id="'+wfId+'" style="display:block;max-width:100%;height:'+Math.max(drivers.length*52+40,120)+'px"></canvas>'+
    '</div>'+
    '<div id="tres-wf-narrative" style="margin-top:16px;border-top:1px solid var(--border);padding-top:4px"></div>';

  const _drawTresWaterfall=()=>{
    const cv=document.getElementById(wfId); if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    const W=Math.floor(wfEl.clientWidth-32);
    const rowH=52, H=drivers.length*rowH+40;
    cv.width=W*dpr; cv.height=H*dpr;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    const cx=cv.getContext('2d'); cx.scale(dpr,dpr);
    cx.save(); cx.beginPath(); cx.rect(0,0,W,H); cx.clip();

    const LBL_W=160, VAL_W=90, PAD_L=8;
    const HALF_ZONE=(W-LBL_W)/2;
    const AXIS_X=LBL_W+HALF_ZONE;
    const halfMax=Math.max(10,HALF_ZONE-VAL_W);

    cx.strokeStyle='rgba(255,255,255,0.12)'; cx.lineWidth=1; cx.setLineDash([]);
    cx.beginPath(); cx.moveTo(AXIS_X,0); cx.lineTo(AXIS_X,H); cx.stroke();

    drivers.forEach((d,i)=>{
      const y=i*rowH+10;
      const isPos=d.delta>=0;
      const color=isPos?'#22c97a':'#f0566a';
      const colorFill=isPos?'rgba(34,201,122,0.18)':'rgba(240,86,106,0.18)';
      const barW=Math.min(halfMax,Math.max(4,(Math.abs(d.delta)/maxAbs)*halfMax));
      const pct=d.p2!==0?((d.delta/Math.abs(d.p2))*100):(d.delta>0?100:-100);
      const barX=isPos?AXIS_X:AXIS_X-barW;
      const parts=d.key.split(' · ');
      const catLbl=parts[0]||d.key, bienLbl=parts[1]||'';
      const maxLblW=LBL_W-PAD_L-6;
      cx.font='bold 10px Outfit,sans-serif'; cx.fillStyle='rgba(226,232,243,0.9)'; cx.textAlign='left';
      let cTxt=catLbl; while(cx.measureText(cTxt).width>maxLblW&&cTxt.length>4) cTxt=cTxt.slice(0,-1);
      if(cTxt!==catLbl) cTxt+='…'; cx.fillText(cTxt,PAD_L,y+13);
      if(bienLbl){
        cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.8)';
        let bTxt=bienLbl; while(cx.measureText(bTxt).width>maxLblW&&bTxt.length>4) bTxt=bTxt.slice(0,-1);
        if(bTxt!==bienLbl) bTxt+='…'; cx.fillText(bTxt,PAD_L,y+26);
      }
      const bgW=W-AXIS_X-2;
      cx.fillStyle='rgba(255,255,255,0.03)'; cx.beginPath();
      if(isPos) cx.roundRect(AXIS_X,y+2,bgW,rowH-16,[0,4,4,0]);
      else      cx.roundRect(LBL_W,y+2,AXIS_X-LBL_W,rowH-16,[4,0,0,4]);
      cx.fill();
      cx.fillStyle=colorFill; cx.strokeStyle=color; cx.lineWidth=1;
      cx.beginPath(); cx.roundRect(barX,y+2,barW,rowH-16,4); cx.fill(); cx.stroke();
      cx.font='bold 11px Outfit,monospace'; cx.fillStyle=color;
      const deltaStr=(d.delta>=0?'+':'')+Math.round(d.delta).toLocaleString('fr-FR')+' €';
      const pctStr=(pct>=0?'+':'')+pct.toFixed(0)+'%';
      if(isPos){
        const vx=Math.min(AXIS_X+barW+6,W-VAL_W+2); cx.textAlign='left';
        cx.fillText(deltaStr,vx,y+14);
        cx.font='9px Outfit,sans-serif'; cx.fillStyle='rgba(126,143,168,0.7)';
        cx.fillText(pctStr,vx,y+26);
      } else {
        const vx=Math.max(AXIS_X-barW-6,LBL_W+2); cx.textAlign='right';
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
  requestAnimationFrame(_drawTresWaterfall);
  if(window._tresWfRO) window._tresWfRO.disconnect();
  window._tresWfRO=new ResizeObserver(()=>requestAnimationFrame(_drawTresWaterfall));
  const tresWfCv=document.getElementById(wfId);
  if(tresWfCv) window._tresWfRO.observe(tresWfCv.parentElement);

  // ── Narrative bullets ──────────────────────────
  const narrativeEl=document.getElementById('tres-wf-narrative'); if(!narrativeEl) return;
  const fmtAmt=v=>((v>=0?'+':'')+Math.round(v).toLocaleString('fr-FR')+' €');
  const fmtPct=(delta,base)=>Math.abs(base)>0?((delta/Math.abs(base))*100).toFixed(0)+'%':(delta>0?'+100%':'-100%');
  const mthLabel=n=>n===1?'1 mois':n+' mois';
  const bullets=[];
  const trendUp=totalDelta>=0;
  bullets.push({
    icon:trendUp?'📈':'📉',
    text:'<strong>'+(trendUp?'↑ Amélioration':'↓ Détérioration')+' de la trésorerie</strong> — Le solde net de P1 ('+fmtFR(p1Min)+' → '+fmtFR(p1Max)+') '+
         (trendUp?'progresse de <strong style="color:var(--green)">'+fmtAmt(totalDelta)+'</strong>':'recule de <strong style="color:var(--red)">'+fmtAmt(totalDelta)+'</strong>')+
         ' vs P2 ('+fmtFR(p2Min)+' → '+fmtFR(p2Max)+') sur <strong>'+mthLabel(driver)+'</strong>.'
  });
  if(top3pos.length){
    const items=top3pos.map(d=>{
      const parts=d.key.split(' · ');
      return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--green)">'+fmtAmt(d.delta)+', '+fmtPct(d.delta,d.p2)+'</span>)';
    });
    bullets.push({icon:'✅',text:'<strong>Moteurs de hausse</strong> — '+items.join(' ; ')+'.'});
  }
  if(top3neg.length){
    const items=top3neg.map(d=>{
      const parts=d.key.split(' · ');
      return '<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em> (<span style="color:var(--red)">'+fmtAmt(d.delta)+', '+fmtPct(d.delta,d.p2)+'</span>)';
    });
    bullets.push({icon:'⚠️',text:'<strong>Points de vigilance</strong> — '+items.join(' ; ')+'.'});
  } else {
    bullets.push({icon:'✅',text:'<strong>Points de vigilance</strong> — Aucune variation négative significative sur la période.'});
  }
  const topKey=top3pos[0]||top3neg[0];
  if(topKey&&totalDelta!==0){
    const share=Math.abs(topKey.delta/totalDelta*100).toFixed(0);
    const parts=topKey.key.split(' · ');
    bullets.push({icon:'🔍',text:'<strong>Concentration</strong> — Le principal driver (<em>'+parts[0]+(parts[1]?' · '+parts[1]:'')+'</em>) représente <strong>'+share+'%</strong> de la variation.'});
  }
  narrativeEl.innerHTML=bullets.map(b=>
    '<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border)">'+
      '<span style="font-size:13px;flex-shrink:0;margin-top:1px">'+b.icon+'</span>'+
      '<span style="font-size:11px;color:var(--text2);line-height:1.6">'+b.text+'</span>'+
    '</div>'
  ).join('');
}

// ── RÉSULTAT NET (placeholder) ─────────────────
function _renderSynResultat() {
  const el = document.getElementById('syn-content');
  if (!el) return;
  const year = _getV('syn-year') || _getV('res-year') || 'all';
  const sci  = _getV('syn-sci')  || _getV('res-sci')  || 'all';
  const bien = _msGetVals('syn-bien');
  el.innerHTML = _buildResultatHTML(year, sci, bien);
}

// ─────────────────────────────────────────────
//  2. BILAN COMPTABLE
// ─────────────────────────────────────────────
function renderBilan() {
  const el = document.getElementById('bil-content');
  if (!el) { return; }
  _dashFillYears(_getDB());
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px">
      <div class="card">
        ${_sectionTitle('Emprunts en cours')}
        <div id="bil-loans-content">${_renderBilanLoans()}</div>
      </div>
      <div class="card">
        ${_sectionTitle('Trésorerie cumulée')}
        <div id="bil-tres-content">${_renderBilanTreso()}</div>
      </div>
    </div>`;
}

function _renderBilanLoans() {
  const p = getParams();
  if (!p.loans || !p.loans.length) return _emptyState('Aucun emprunt configuré');
  const rows = p.loans.map(loan => {
    const table = (p.loanTable||{})[loan.ref] || {};
    const periods = Object.keys(table).sort();
    const capTotal = periods.reduce((s,ym) => s+(table[ym]?.[0]||0), 0);
    const intTotal = periods.reduce((s,ym) => s+(table[ym]?.[1]||0), 0);
    return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;font-weight:600">${loan.label}</span>
        <span style="font-size:10px;font-family:monospace;color:var(--text2)">${loan.ref}</span>
      </div>
      <div style="display:flex;gap:20px;font-size:11px">
        <span>Cap. remboursé : <strong style="color:var(--cyan)">${_fmtK(capTotal)}</strong></span>
        <span>Intérêts payés : <strong style="color:var(--gold)">${_fmtK(intTotal)}</strong></span>
      </div>
    </div>`;
  }).join('');
  return rows || _emptyState('Aucune donnée de tableau d\'amortissement');
}

function _renderBilanTreso() {
  const lines = _dashLines(_getV('bil-year'), _getV('bil-sci'));
  if (!lines.length) return _emptyState();
  const byPeriod = {};
  lines.forEach(l => {
    if (!byPeriod[l._period]) byPeriod[l._period] = 0;
    byPeriod[l._period] += +l.montant||0;
  });
  let cumul = 0;
  const rows = Object.keys(byPeriod).sort().map(ym => {
    cumul += byPeriod[ym];
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="color:var(--text2)">${ym}</span>
      <span style="font-family:monospace;color:${byPeriod[ym]>=0?'var(--green)':'var(--red)'}">${byPeriod[ym]>=0?'+':''}${_fmtK(byPeriod[ym])}</span>
      <span style="font-family:monospace;font-weight:700;color:${cumul>=0?'var(--cyan)':'var(--red)'}">Σ ${_fmtK(cumul)}</span>
    </div>`;
  }).join('');
  return `<div style="max-height:360px;overflow-y:auto">${rows}</div>`;
}

// ─────────────────────────────────────────────
//  3. COMPTE DE RESULTAT
// ─────────────────────────────────────────────

// ══════════════════════════════════════════════
// RÉSULTAT NET — moteur commun
// ══════════════════════════════════════════════

function _getAmortDotations(bienParam, optDateMin, optDateMax) {
  // Calcule les dotations pour les mois dans la fenêtre filtrée, avec ventilation QP pour frais_generaux
  const saved   = JSON.parse(localStorage.getItem('artemis_amort')         || '[]');
  const pending = JSON.parse(localStorage.getItem('artemis_amort_pending') || '[]');
  // Fusionner les deux sources en évitant les doublons (pending prioritaire)
  const pendingIds = new Set(pending.map(a => a.id).filter(Boolean));
  const amorts = [...pending, ...saved.filter(a => !pendingIds.has(a.id))];
  if (!amorts.length) return 0;
  const p = getParams();

  const dateMin = optDateMin !== undefined ? optDateMin : (_getV('syn-date-min') || window._artemisDateMin || '');
  const dateMax = optDateMax !== undefined ? optDateMax : (_getV('syn-date-max') || window._artemisDateMax || '');
  const sciSel  = _getV('syn-sci')  || 'all';
  // bienParam passé explicitement depuis _buildResultatHTML (évite la lecture de syn-bien qui peut être 'all' hors contexte)
  // bienParam est soit une string (depuis _buildResultatHTML) soit un tableau (_msGetVals)
  let bienSel;
  if (bienParam && bienParam !== 'all' && bienParam !== '') {
    bienSel = Array.isArray(bienParam) ? bienParam : [bienParam];
  } else {
    bienSel = _msGetVals('syn-bien');
  }
  // Tableau vide = pas de filtre bien (afficher tout)
  if (!bienSel || bienSel.length === 0) bienSel = null;

  const ymMin = dateMin ? dateMin.slice(0,7) : '';
  const ymMax = dateMax ? dateMax.slice(0,7) : '';

  let total = 0;

  amorts.forEach(a => {
    if (a.methode === 'Non amortissable') return;

    // Calculer la dotation totale sur la fenêtre pour cet actif
    const sched = computeAmortSchedule(a);
    let dotActif = 0;
    sched.forEach(s => {
      if (ymMin && s.yearMonth < ymMin) return;
      if (ymMax && s.yearMonth > ymMax) return;
      dotActif += s.dotation;
    });
    if (dotActif === 0) return;


    if (a.bienId === 'frais_generaux') {
      // Ventiler via QP selon le lot de l'actif
      const qp = p.qp || {};
      const lot = a.lot || '';
      const lotLow2 = lot.toLowerCase();
      const aCat = a.categorie || '';
      // Trouver le groupe QP pour ce lot (comparaison insensible à la casse)
      let grp = null;
      if (aCat && qp[aCat]) grp = qp[aCat].find(g => (g.lot||'').toLowerCase() === lotLow2) || null;
      if (!grp) {
        for (const grpList of Object.values(qp)) {
          const g = grpList.find(g => (g.lot||'').toLowerCase() === lotLow2);
          if (g && g.biens && Object.keys(g.biens).length) { grp = g; break; }
        }
      }
      if (bienSel && bienSel.length) {
        // Sommer les QP de tous les biens sélectionnés qui appartiennent à ce lot
        let pctTotal = 0;
        const lotLow = lot.toLowerCase();
        bienSel.forEach(bName => {
          const bienObj = p.biens.find(b => b.name === bName);
          if (!bienObj || (bienObj.lot||'').toLowerCase() !== lotLow) return;
          const pct = grp ? (grp.biens[bienObj.id] || grp.biens[bienObj.name] || 0) : 0;
          pctTotal += pct;
        });
        if (pctTotal > 0) {
          total += dotActif * pctTotal;
        }
      } else {
        // Pas de filtre bien : inclure la totalité
        if (sciSel && sciSel !== 'all') {
          // Vérifier si au moins un bien du lot est dans cette SCI
          const biensDuLot = p.biens.filter(b => b.lot === a.lot && b.sci === sciSel);
          if (!biensDuLot.length) return;
          // Calculer la part QP correspondant à cette SCI
          const qpS = p.qp || {};
          const aCatS = a.categorie || '';
          let grpS = null;
          if (aCatS && qpS[aCatS]) grpS = qpS[aCatS].find(g => g.lot === a.lot) || null;
          if (!grpS) {
            for (const gl of Object.values(qpS)) {
              const g = gl.find(g => g.lot === a.lot);
              if (g && g.biens && Object.keys(g.biens).length) { grpS = g; break; }
            }
          }
          let pctSci = 0;
          if (grpS) biensDuLot.forEach(b => { pctSci += grpS.biens[b.id] || grpS.biens[b.name] || 0; });
          total += dotActif * pctSci;
        } else {
          total += dotActif;
        }
      }
    } else {
      // Actif directement attribué à un bien
      const bienActif = p.biens.find(b => b.id === a.bienId);
      if (bienSel && bienSel.length) {
        // bienSel est un tableau de noms de biens
        if (!bienActif || !bienSel.includes(bienActif.name)) {
          return;
        }
      }
      if (sciSel && sciSel !== 'all') {
        if (!bienActif || bienActif.sci !== sciSel) return;
      }
      total += dotActif;
    }
  });

  return total;
}

function _buildResultatHTML(year, sci, bienParam) {
  const lines = _dashLines(year, sci);
  const _dateMin = _getV('syn-date-min') || '';
  const _dateMax = _getV('syn-date-max') || '';

  // ── Groupes N2 ──
  const BLOCS = [
    { key: "Produits d'exploitation",  type: 'produit', color: 'var(--green)',  icon: '📈' },
    { key: 'Produits financiers',       type: 'produit', color: 'var(--cyan)',   icon: '💹' },
    { key: 'Produits exceptionnels',    type: 'produit', color: 'var(--purple)', icon: '⭐' },
    { key: "Charges d'exploitation",   type: 'charge',  color: 'var(--red)',    icon: '🔧' },
    { key: 'Charges financi\u00e8res',  type: 'charge',  color: 'var(--gold)',   icon: '🏦' },
    { key: 'Charges exceptionnelles',   type: 'charge',  color: 'var(--red)',    icon: '⚠️' },
  ];

  // Agréger par n2 -> cat
  const grouped = {};
  BLOCS.forEach(b => { grouped[b.key] = {}; });

  lines.forEach(l => {
    const s = SCHEMA[l.cat || ''];
    const n2 = s ? s.n2 : null;
    if (!n2 || !grouped[n2]) return;
    const cat = l.cat || 'Autre';
    const bloc = BLOCS.find(b => b.key === n2);
    // Pour les charges : -(montant) pour que les avoirs positifs réduisent le total
    // Pour les produits : +(montant) normalement positifs
    const contribution = bloc && bloc.type === 'charge' ? -(+l.montant || 0) : +(+l.montant || 0);
    grouped[n2][cat] = (grouped[n2][cat] || 0) + contribution;
  });

  // Ajouter dotations aux amortissements dans Charges d'exploitation
  const totalDotations = _getAmortDotations(bienParam, _dateMin, _dateMax);
  if (totalDotations > 0) {
    grouped["Charges d'exploitation"]['Dotations aux amortissements'] =
      (grouped["Charges d'exploitation"]['Dotations aux amortissements'] || 0) + totalDotations;
  }

  // Totaux par type
  let totalProduits = 0, totalCharges = 0;
  BLOCS.forEach(b => {
    const t = Object.values(grouped[b.key]).reduce((s, v) => s + v, 0);
    if (b.type === 'produit') totalProduits += t;
    else totalCharges += t;
  });
  const resultatNet = totalProduits - totalCharges;
  const resultatAvantPassifs = totalProduits - totalCharges;

  // ── KPI cards ──
  const kpis = `
    <div class="dash-grid-4" style="margin-bottom:20px">
      ${_kpiCard('📈', 'Produits totaux', '+' + _fmtK(totalProduits), 'var(--green)')}
      ${_kpiCard('🔧', 'Charges totales', _fmtK(-totalCharges), 'var(--red)')}
      ${_kpiCard('💰', 'R\u00e9sultat net', (resultatNet >= 0 ? '+' : '') + _fmtK(resultatNet), resultatNet >= 0 ? 'var(--cyan)' : 'var(--red)')}
      ${_kpiCard('%', 'Taux de charge', _pct(totalCharges / Math.max(totalProduits, 1) * 100), totalCharges / Math.max(totalProduits, 1) > 0.7 ? 'var(--red)' : 'var(--gold)')}
    </div>`;

  // ── Barre de cascade ──
  function _blocSection(bloc) {
    const entries = Object.entries(grouped[bloc.key]).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!total && bloc.key !== "Charges d'exploitation") return '';
    const maxV = Math.max(...entries.map(([, v]) => v), 1);
    const sign = bloc.type === 'produit' ? '+' : '-';
    const isDotAmort = (cat) => cat === 'Dotations aux amortissements';

    const rows = entries.map(([cat, val]) => {
      const pct = (val / maxV * 100).toFixed(1);
      const isDot = isDotAmort(cat);
      const barColor = isDot ? 'rgba(155,110,243,.5)' : bloc.color;
      const dotTag = isDot ? '<span style="font-size:9px;background:rgba(155,110,243,.15);border:1px solid rgba(155,110,243,.3);color:var(--purple);border-radius:4px;padding:1px 6px;margin-left:6px">non d\u00e9caiss\u00e9e</span>' : '';
      return `<div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span style="color:var(--text)">${escHtml(cat)}${dotTag}</span>
          <span style="font-family:monospace;font-weight:600;color:${bloc.color}">${sign}${_fmtK(val)}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px">
          <div style="height:4px;width:${pct}%;background:${barColor};border-radius:2px;transition:width .4s"></div>
        </div>
      </div>`;
    }).join('');

    return `<div class="card" style="margin-bottom:14px">
      <div class="card-title" style="justify-content:space-between">
        <span>${bloc.icon} ${escHtml(bloc.key)}</span>
        <span style="font-family:monospace;font-size:13px;font-weight:800;color:${bloc.color}">${sign}${_fmtK(total)}</span>
      </div>
      ${rows || '<div style="font-size:11px;color:var(--text2);padding:8px 0">Aucune donn\u00e9e</div>'}
    </div>`;
  }

  const produitsHTML = BLOCS.filter(b => b.type === 'produit').map(_blocSection).join('');
  const chargesHTML  = BLOCS.filter(b => b.type === 'charge').map(_blocSection).join('');

  // ── Ligne résultat net ──
  const netColor = resultatNet >= 0 ? 'var(--green)' : 'var(--red)';
  const netBg    = resultatNet >= 0 ? 'rgba(34,201,122,.06)' : 'rgba(240,86,106,.06)';
  const netBorder= resultatNet >= 0 ? 'rgba(34,201,122,.25)' : 'rgba(240,86,106,.25)';
  const netLine  = `<div style="background:${netBg};border:1px solid ${netBorder};border-radius:10px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <span style="font-size:13px;font-weight:700">R\u00e9sultat net</span>
    <span style="font-family:monospace;font-size:20px;font-weight:800;color:${netColor}">${resultatNet >= 0 ? '+' : ''}${_fmtK(resultatNet)}</span>
  </div>`;

  if (!lines.length && totalDotations === 0) return _emptyState();

  return kpis +
    `<div class="dash-grid-2">
      <div>${produitsHTML}</div>
      <div>${chargesHTML}${netLine}</div>
    </div>`;
}

function switchResSubTab(btn) {
  const rtab = btn.dataset.rstab;
  // Styler les boutons
  btn.closest('.dnav-subs').querySelectorAll('.res-stab').forEach(b => {
    b.style.background = 'transparent';
    b.style.border = '1px solid transparent';
    b.style.color = 'var(--text2)';
  });
  btn.style.background = 'rgba(34,211,200,.12)';
  btn.style.border = '1px solid rgba(34,211,200,.3)';
  btn.style.color = 'var(--cyan)';
  // Déplacer syn-filters : dans le panel SIG si onglet SIG, sinon dans dp-synthese
  const synFilters = document.getElementById('syn-filters');
  const sigPanel   = document.getElementById('res-panel-sig');
  const synParent  = document.getElementById('dp-synthese');
  if (synFilters && sigPanel && synParent) {
    if (rtab === 'sig') {
      if (!sigPanel.contains(synFilters)) sigPanel.insertBefore(synFilters, sigPanel.firstChild);
    } else {
      if (!synParent.contains(synFilters)) synParent.insertBefore(synFilters, synParent.firstChild);
    }
  }
  // Afficher le bon panel
  document.getElementById('res-panel-compte').style.display = rtab === 'compte' ? '' : 'none';
  document.getElementById('res-panel-sig').style.display    = rtab === 'sig'    ? '' : 'none';
  if (rtab === 'compte') renderResultat();
  else if (rtab === 'sig') _renderSIG();
}

// ─────────────────────────────────────────────
//  SIG — Soldes Intermédiaires de Gestion
// ─────────────────────────────────────────────
const _SIG_MAP = {
  'Airbnb':{'g':'Produit d\'exploitation','s':'Revenus courte durée'},
  'Booking':{'g':'Produit d\'exploitation','s':'Revenus courte durée'},
  'Autres plateformes':{'g':'Produit d\'exploitation','s':'Revenus courte durée'},
  'Stripe':{'g':'Produit d\'exploitation','s':'Revenus autre'},
  'Location directe':{'g':'Produit d\'exploitation','s':'Revenus courte durée'},
  'Vente additionnelle':{'g':'Produit d\'exploitation','s':'Revenus autre'},
  'Loyer mensuel':{'g':'Produit d\'exploitation','s':'Revenus longue durée'},
  'Consulting':{'g':'Produit d\'exploitation','s':'Chiffre d\'affaires'},
  'Autres prestations':{'g':'Produit d\'exploitation','s':'Chiffre d\'affaires'},
  'Cash-out':{'g':'Produit d\'exploitation','s':'Chiffre d\'affaires'},
  'Revenus annexes':{'g':'Produit d\'exploitation','s':'Autres produits d\'exploitation'},
  'Intérêts reçus':{'g':'Produit financier','s':'Résultat financier'},
  'Dividendes':{'g':'Produit financier','s':'Résultat financier'},
  'Plus-values':{'g':'Produit exceptionnel','s':'Résultat exceptionnel'},
  'Autres produits exceptionnels':{'g':'Produit exceptionnel','s':'Résultat exceptionnel'},
  'Remboursements divers':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Régularisations':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Matériel divers':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Consommables':{'g':'Charge d\'exploitation','s':'Consommations'},
  'Réparations mineures':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Petit outillage':{'g':'Charge d\'exploitation','s':'Maintenance'},
  'Ménage':{'g':'Charge d\'exploitation','s':'Prestations externes'},
  'Prestataires divers':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Expert-comptable':{'g':'Charge d\'exploitation','s':'Prestations externes'},
  'Publicité':{'g':'Charge d\'exploitation','s':'Autres charges d\'exploitation'},
  'Réseaux sociaux':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Transport':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Restauration pro':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Hôtels':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Formations en ligne':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Séminaires':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Abonnements plateformes':{'g':'Charge d\'exploitation','s':'Abonnements'},
  'Abonnements internet':{'g':'Charge d\'exploitation','s':'Abonnements'},
  'Assurance habitation':{'g':'Charge d\'exploitation','s':'Assurances'},
  'Assurance RC pro':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Assurance diverse':{'g':'Charge d\'exploitation','s':'Assurances'},
  'Assurance emprunt':{'g':'Charge financière','s':'Résultat financier'},
  'Frais bancaires':{'g':'Charge financière','s':'Résultat financier'},
  'Électricité - Juliette Drouet':{'g':'Charge d\'exploitation','s':'Énergies'},
  'Électricité - Le Blosne':{'g':'Charge d\'exploitation','s':'Énergies'},
  'Eau':{'g':'Charge d\'exploitation','s':'Énergies'},
  'Gaz - Juliette Drouet':{'g':'Charge d\'exploitation','s':'Énergies'},
  'Gaz - Le Blosne':{'g':'Charge d\'exploitation','s':'Énergies'},
  'Taxe foncière':{'g':'Charge d\'exploitation','s':'Impôts et taxes'},
  'Taxe d\'habitation':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Autres taxes':{'g':'Charge d\'exploitation','s':'Impôts et taxes'},
  'Charge copro':{'g':'Charge d\'exploitation','s':'Autres charges d\'exploitation'},
  'Courses':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Voyages':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Frais divers':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Loisirs':{'g':'Charge d\'exploitation','s':'Autres charges d\'exploitation'},
  'Restaurants':{'g':'Charge d\'exploitation','s':'Autres charges d\'exploitation'},
  'Mobilier':{'g':null,'s':null},
  'Équipements':{'g':null,'s':null},
  'Intérêts de crédit':{'g':'Charge financière','s':'Résultat financier'},
  'IS':{'g':'Impôt sur les bénéfices','s':'Impôt sur les bénéfices'},
  'Pénalités diverses':{'g':'Charge exceptionnelle','s':'Résultat exceptionnel'},
  'Amendes':{'g':'Charge exceptionnelle','s':'Résultat exceptionnel'},
  'Commission Airbnb':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Commission Booking':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Commission plateformes':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Autres commissions':{'g':'Charge d\'exploitation','s':'Charges d\'exploitation'},
  'Dotations aux amortissements':{'g':'Charge d\'exploitation','s':'Amortissements'},
  'Immobilisation - Travaux':{'g':null,'s':null},
  'Immobilisation - Rénovations':{'g':null,'s':null},
  'Immobilisation - Mobilier':{'g':null,'s':null},
  'Immobilisation - Acquisition':{'g':null,'s':null},
  'Immobilisation - Informatique':{'g':null,'s':null},
  'Immobilisation - Équipements':{'g':null,'s':null},
  'Immobilisation - Notaire':{'g':null,'s':null},
  'CCA remboursé':{'g':null,'s':null},
  'CCA apport':{'g':null,'s':null},
  'Remboursement emprunt':{'g':null,'s':null}, // hors SIG (passif)
};

const _SIG_GROUPES = [
  { id:'Produit d\'exploitation',  type:'produit', icon:'📈', color:'var(--green)' },
  { id:'Produit financier',        type:'produit', icon:'💹', color:'var(--cyan)'  },
  { id:'Produit exceptionnel',     type:'produit', icon:'⭐', color:'var(--purple)'},
  { id:'Charge d\'exploitation',   type:'charge',  icon:'🔧', color:'var(--red)'  },
  { id:'Charge financière',        type:'charge',  icon:'🏦', color:'var(--gold)' },
  { id:'Charge exceptionnelle',    type:'charge',  icon:'⚠️', color:'var(--red)'  },
  { id:'Impôt sur les bénéfices',  type:'charge',  icon:'🏛️', color:'var(--red)'  },
];

// Soldes intermédiaires calculés en cascade
const _SIG_SOLDES = [
  { id:'rex',   label:'Résultat d\'exploitation',   formula: g => g['Produit d\'exploitation'] - g['Charge d\'exploitation'],   color:'var(--cyan)'  },
  { id:'rfin',  label:'Résultat financier',          formula: g => g['Produit financier'] - g['Charge financière'],             color:'var(--gold)'  },
  { id:'rexc',  label:'Résultat exceptionnel',       formula: g => g['Produit exceptionnel'] - g['Charge exceptionnelle'],      color:'var(--purple)'},
  { id:'rcai',  label:'Résultat courant avant IS',   formula: g => (g['Produit d\'exploitation'] - g['Charge d\'exploitation']) + (g['Produit financier'] - g['Charge financière']) + (g['Produit exceptionnel'] - g['Charge exceptionnelle']), color:'var(--cyan)' },
  { id:'rnet',  label:'Résultat net',                formula: g => (g['Produit d\'exploitation'] - g['Charge d\'exploitation']) + (g['Produit financier'] - g['Charge financière']) + (g['Produit exceptionnel'] - g['Charge exceptionnelle']) - g['Impôt sur les bénéfices'], color:'var(--green)' },
];

function _renderSIG() {
  const el = document.getElementById('res-panel-sig');
  if (!el) return;

  const lines = _synLines();
  const bien  = _msGetVals('syn-bien');

  // ── Agréger ──
  const totals = {}, subs = {}, cats = {};
  _SIG_GROUPES.forEach(g => { totals[g.id] = 0; subs[g.id] = {}; cats[g.id] = {}; });
  lines.forEach(l => {
    const map = _SIG_MAP[l.cat || ''];
    if (!map || !map.g) return;
    const grpDef = _SIG_GROUPES.find(x => x.id === map.g);
    if (!grpDef) return;
    const v = grpDef.type === 'produit' ? +(+l.montant||0) : -(+l.montant||0);
    totals[map.g] = (totals[map.g]||0) + v;
    subs[map.g][map.s] = (subs[map.g][map.s]||0) + v;
    if (!cats[map.g][map.s]) cats[map.g][map.s] = {};
    cats[map.g][map.s][l.cat] = (cats[map.g][map.s][l.cat]||0) + v;
  });
  const dot = _getAmortDotations(bien && bien.length ? bien : null);
  if (dot > 0) {
    totals["Charge d'exploitation"] = (totals["Charge d'exploitation"]||0) + dot;
    subs["Charge d'exploitation"]["Amortissements"] = (subs["Charge d'exploitation"]["Amortissements"]||0) + dot;
    if (!cats["Charge d'exploitation"]["Charges d'exploitation"]) cats["Charge d'exploitation"]["Charges d'exploitation"] = {};
    if (!cats["Charge d'exploitation"]["Amortissements"]) cats["Charge d'exploitation"]["Amortissements"] = {};
    cats["Charge d'exploitation"]["Amortissements"]["Dotations aux amortissements"] = (cats["Charge d'exploitation"]["Amortissements"]["Dotations aux amortissements"]||0) + dot;
  }

  // ── Soldes ──
  const rex  = (totals["Produit d'exploitation"]||0)  - (totals["Charge d'exploitation"]||0);
  const rfin = (totals["Produit financier"]||0)        - (totals["Charge financière"]||0);
  const rexc = (totals["Produit exceptionnel"]||0)     - (totals["Charge exceptionnelle"]||0);
  const rcai = rex + rfin + rexc;
  const rnet = rcai - (totals["Impôt sur les bénéfices"]||0);

  // ── Couleurs par groupe ──
  const COLORS = {
    "Produit d'exploitation":  { bg:'rgba(34,201,122,.09)', bgL:'rgba(34,201,122,.06)', border:'rgba(34,201,122,.6)',  txt:'var(--green)' },
    "Produit financier":       { bg:'rgba(34,211,200,.09)', bgL:'rgba(34,211,200,.06)', border:'rgba(34,211,200,.6)',  txt:'var(--cyan)'  },
    "Produit exceptionnel":    { bg:'rgba(155,110,243,.09)',bgL:'rgba(155,110,243,.06)',border:'rgba(155,110,243,.6)', txt:'var(--purple)'},
    "Charge d'exploitation":   { bg:'rgba(240,86,106,.09)', bgL:'rgba(240,86,106,.06)', border:'rgba(240,86,106,.6)',  txt:'var(--red)'   },
    "Charge financière":       { bg:'rgba(255,179,0,.09)',  bgL:'rgba(255,179,0,.06)',  border:'rgba(255,179,0,.6)',   txt:'var(--gold)'  },
    "Charge exceptionnelle":   { bg:'rgba(240,86,106,.09)', bgL:'rgba(240,86,106,.06)', border:'rgba(240,86,106,.6)',  txt:'var(--red)'   },
    "Impôt sur les bénéfices": { bg:'rgba(240,86,106,.09)', bgL:'rgba(240,86,106,.06)', border:'rgba(240,86,106,.6)',  txt:'var(--red)'   },
  };

  // ── Helpers ──
  const fmtM = v => {
    if (v == null || v === 0) return '<span style="color:var(--text2);font-family:monospace">—</span>';
    const col = v >= 0 ? 'var(--green)' : 'var(--red)';
    return `<span style="font-family:monospace;color:${col}">${v>=0?'+':''}${_fmtK(v)}</span>`;
  };
  const fmtN = v => {
    if (!v) return '<span style="color:var(--text2);font-family:monospace">—</span>';
    return `<span style="font-family:monospace;color:var(--text)">${_fmtK(Math.abs(v))}</span>`;
  };

  // ── Construction des lignes ──
  let rows = '';

  _SIG_GROUPES.forEach(grp => {
    const total = totals[grp.id]||0;
    const subEntries = Object.entries(subs[grp.id]||{}).filter(([,v])=>v!==0).sort((a,b)=>{
      if (a[0]==='Amortissements') return 1;
      if (b[0]==='Amortissements') return -1;
      return Math.abs(b[1])-Math.abs(a[1]);
    });
    if (!total && !subEntries.length) return;
    const c = COLORS[grp.id] || { bg:'rgba(255,255,255,.04)', border:'var(--border)', txt:'var(--text)' };
    const sign = grp.type === 'produit' ? '+' : '-';

    // En-tête groupe
    rows += `<tr>
      <td colspan="3" style="padding: 4px 0 0">
        <div style="background:${c.bg};border-left:3px solid ${c.border};border-radius:0 6px 6px 0;padding:8px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:var(--text2);letter-spacing:.06em;text-transform:uppercase">${escHtml(grp.id)}</span>
          <span style="font-family:monospace;font-size:14px;font-weight:700;color:${c.txt}">${sign}${_fmtK(total)}</span>
        </div>
      </td>
    </tr>`;

    // Sous-rubriques dépliables
    subEntries.forEach(([subLabel, subVal]) => {
      const catEntries = Object.entries(cats[grp.id][subLabel]||{}).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
      const uid = 'sig' + (grp.id+subLabel).replace(/[^a-z0-9]/gi,'');
      rows += `<tr onclick="var tb=document.getElementById('${uid}');var open=tb.style.display!=='none';tb.style.display=open?'none':'';this.querySelector('.sarr').textContent=open?'▸':'▾'" style="cursor:pointer;border-top:1px solid var(--border);background:${c.bgL||c.bg}">
        <td style="padding:7px 0 7px 16px;font-size:12px;color:var(--text)">
          <span class="sarr" style="font-size:9px;margin-right:6px;opacity:.6">▸</span>${escHtml(subLabel)}
        </td>
        <td style="text-align:right;padding:7px 12px;font-size:11px;color:var(--text2)">${catEntries.length} poste${catEntries.length>1?'s':''}</td>
        <td style="text-align:right;padding:7px 0;font-family:monospace;font-size:12px;font-weight:600;color:var(--text)">${_fmtK(Math.abs(subVal))}</td>
      </tr>
      <tbody id="${uid}" style="display:none">
        ${catEntries.map(([cat, val]) => {
          const isDot = cat === 'Dotations aux amortissements';
          const dotTag = isDot ? `<span style="font-size:9px;background:rgba(155,110,243,.12);border:1px solid rgba(155,110,243,.25);color:var(--purple);border-radius:3px;padding:1px 5px;margin-left:5px">non décaissée</span>` : '';
          return `<tr style="border-top:1px solid rgba(128,128,128,.08)">
            <td style="padding:5px 0 5px 32px;font-size:11px;color:var(--text2)">${escHtml(cat)}${dotTag}</td>
            <td></td>
            <td style="text-align:right;padding:5px 0;font-family:monospace;font-size:11px;color:var(--text2)">${_fmtK(Math.abs(val))}</td>
          </tr>`;
        }).join('')}
      </tbody>`;
    });

    rows += `<tr><td colspan="3" style="height:10px"></td></tr>`;
  });

  // ── Séparateur avant soldes ──
  rows += `<tr><td colspan="3" style="border-top:1px solid var(--border);padding:0"></td></tr>`;

  // ── Soldes en cascade ──
  const solde = (label, val, large) => {
    const col = val >= 0 ? 'var(--green)' : 'var(--red)';
    const sz = large ? '15px' : '12px';
    const py = large ? '11px' : '7px';
    rows += `<tr style="border-top:${large?'1px':'0.5px'} solid var(--border)">
      <td colspan="2" style="padding:${py} 0;font-size:${large?'13':'12'}px;font-weight:${large?'700':'400'};color:${large?'var(--text)':'var(--text2)'}">${escHtml(label)}</td>
      <td style="text-align:right;padding:${py} 0;font-family:monospace;font-size:${sz};font-weight:${large?'800':'600'};color:${col}">${val>=0?'+':''}${_fmtK(val)}</td>
    </tr>`;
  };

  solde("Résultat d'exploitation", rex, false);
  solde("Résultat financier", rfin, false);
  solde("Résultat exceptionnel", rexc, false);
  solde("Résultat courant avant IS (RCAI)", rcai, false);
  rows += `<tr><td colspan="3" style="border-top:2px solid var(--border2);padding:0"></td></tr>`;
  solde("Résultat net", rnet, true);

  let sigBody = el.querySelector('#sig-table-body');
  if (!sigBody) { sigBody = document.createElement('div'); sigBody.id = 'sig-table-body'; el.appendChild(sigBody); }
  sigBody.innerHTML = `<div style="padding:16px">
    <table style="width:100%;border-collapse:collapse">
      <colgroup><col style="width:56%"><col style="width:14%"><col style="width:30%"></colgroup>
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:0 0 8px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2)">Rubrique</th>
          <th style="text-align:right;padding:0 12px 8px 0;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2)">Détail</th>
          <th style="text-align:right;padding:0 0 8px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2)">Montant</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}





function renderResultat() {
  const el = document.getElementById('res-content');
  if (!el) return;
  _dashFillYears(_getDB());
  // Utiliser syn-bien si disponible (même sélecteur partagé)
  const bien = _msGetVals('syn-bien');
  el.innerHTML = _buildResultatHTML(_getV('res-year'), _getV('res-sci'), bien);
}

// ─────────────────────────────────────────────
//  4. KPIS
// ─────────────────────────────────────────────
let _kpiTab = 'lcd';

