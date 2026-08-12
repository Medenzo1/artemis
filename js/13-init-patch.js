// ══════════════════════════════════════════════════════
//  LOCATION DIRECTE (LCD)
// ══════════════════════════════════════════════════════

let _currentLcd = [];

function _getLcdAll() {
  const pending = JSON.parse(localStorage.getItem('artemis_lcd_pending') || '[]');
  const saved   = JSON.parse(localStorage.getItem('artemis_lcd') || '[]');
  if (!pending.length) return saved;
  if (!saved.length)   return pending;
  const pendingKeys = new Set(pending.map(a => a._srcLibelle + '|' + a._srcDate + '|' + a._srcMontant));
  return [...saved.filter(a => !pendingKeys.has(a._srcLibelle + '|' + a._srcDate + '|' + a._srcMontant)), ...pending];
}

function _lcdDetect(line) {
  // Détecter une ligne Location directe et créer une entrée pending
  if (!line || (line.cat || line.categorie || '') !== 'Location directe') return;
  const montant  = Math.abs(parseFloat(line.montantOrigine || line.montant || 0));
  const libelle  = line.libelle || '';
  const date     = line.date || '';
  const bienName = line.bienName || line.bien || '';
  const pending  = JSON.parse(localStorage.getItem('artemis_lcd_pending') || '[]');
  const saved    = JSON.parse(localStorage.getItem('artemis_lcd') || '[]');
  // Anti-doublon sur libellé + date + montant
  const exists = [...pending, ...saved].some(
    a => a._srcLibelle === libelle && a._srcDate === date && Math.abs((a._srcMontant||0) - montant) < 0.01
  );
  if (exists) {
    // Mettre à jour si montant ou bien a changé
    const matchP = pending.findIndex(a => a._srcLibelle === libelle && a._srcDate === date);
    const matchS = saved.findIndex(a => a._srcLibelle === libelle && a._srcDate === date);
    if (matchP >= 0) { pending[matchP].montant = montant; pending[matchP].bienName = bienName; localStorage.setItem('artemis_lcd_pending', JSON.stringify(pending)); }
    else if (matchS >= 0) { saved[matchS].montant = montant; saved[matchS].bienName = bienName; localStorage.setItem('artemis_lcd', JSON.stringify(saved)); }
    return false;
  }
  pending.push({
    libelle, bienName, montant,
    datePaiement: _normDateStr(date).display || date,
    dateDebut: '', dateFin: '', nuits: 0,
    locataire: '', contact: '',
    _srcLibelle: libelle, _srcDate: date, _srcMontant: montant,
    _pending: true,
  });
  localStorage.setItem('artemis_lcd_pending', JSON.stringify(pending));
  return true;
}

function renderLcdTable(rows) {
  _currentLcd = rows || _getLcdAll();
  const tbody = document.getElementById('lcd-tbody');
  const badge = document.getElementById('lcd-badge');
  const status = document.getElementById('lcd-import-status');
  if (!tbody) return;

  const inputStyle = 'width:100%;background:transparent;border:none;border-bottom:1px solid var(--border2);color:var(--text);font-size:11px;font-family:inherit;padding:2px 0;outline:none';

  tbody.innerHTML = _currentLcd.map((a, i) => {
    const isPending = !!a._pending;
    const rowBg = isPending ? 'background:rgba(34,211,200,.05)' : (i % 2 === 0 ? '' : 'background:rgba(255,255,255,.015)');
    const badge2 = isPending ? '<span style="font-size:9px;background:rgba(34,211,200,.12);border:1px solid rgba(34,211,200,.3);color:var(--cyan);border-radius:3px;padding:1px 5px;margin-left:5px">à compléter</span>' : '';
    // Bien options
    const p = getParams();
    const bienOpts = p.biens.map(b => `<option value="${escHtml(b.name)}" ${b.name===a.bienName?'selected':''}>${escHtml(b.name)}</option>`).join('');
    const selStyle = 'background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:10px;padding:3px 6px;font-family:inherit;width:100%';
    return `<tr style="border-bottom:1px solid var(--border);${rowBg}">
      <td style="padding:7px 10px;color:var(--text2);font-size:10px;font-family:monospace">${i+1}</td>
      <td style="padding:7px 10px;max-width:160px"><input value="${escHtml(a.libelle||'')}" oninput="updateLcdField(${i},'libelle',this.value)" style="${inputStyle}">${badge2}</td>
      <td style="padding:7px 10px"><select onchange="updateLcdField(${i},'bienName',this.value)" style="${selStyle}"><option value="">—</option>${bienOpts}</select></td>
      <td style="padding:7px 10px;text-align:right"><input type="number" min="0" step="0.01" value="${a.montant||0}" oninput="updateLcdField(${i},'montant',parseFloat(this.value)||0)" style="${inputStyle};width:80px;text-align:right;font-family:monospace;color:var(--green)"></td>
      <td style="padding:7px 10px"><input data-datemask value="${escHtml(a.datePaiement||'')}" placeholder="JJ/MM/AAAA" oninput="updateLcdField(${i},'datePaiement',this.value)" style="${inputStyle};width:90px"></td>
      <td style="padding:7px 10px"><input data-datemask value="${escHtml(a.dateDebut||'')}" placeholder="JJ/MM/AAAA" oninput="updateLcdField(${i},'dateDebut',this.value)" style="${inputStyle};width:90px"></td>
      <td style="padding:7px 10px"><input data-datemask value="${escHtml(a.dateFin||'')}" placeholder="JJ/MM/AAAA" oninput="updateLcdField(${i},'dateFin',this.value)" style="${inputStyle};width:90px"></td>
      <td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:var(--cyan)" id="lcd-nuits-${i}">${a.nuits||'—'}</td>
      <td style="padding:7px 10px"><input value="${escHtml(a.locataire||'')}" placeholder="Nom" oninput="updateLcdField(${i},'locataire',this.value)" style="${inputStyle};width:110px"></td>
      <td style="padding:7px 10px"><input value="${escHtml(a.contact||'')}" placeholder="Tel / email" oninput="updateLcdField(${i},'contact',this.value)" style="${inputStyle};width:120px"></td>
      <td style="padding:7px 6px;text-align:center"><button onclick="deleteLcdRow(${i})" style="background:rgba(220,50,50,.12);border:1px solid rgba(220,50,50,.3);cursor:pointer;color:var(--red);font-size:10px;font-weight:600;padding:3px 8px;border-radius:5px;font-family:inherit;white-space:nowrap" onmouseover="this.style.background='rgba(220,50,50,.25)'" onmouseout="this.style.background='rgba(220,50,50,.12)'">Supprimer</button></td>
    </tr>`;
  }).join('');

  const pending = _currentLcd.filter(a => a._pending);
  if (badge) {
    badge.textContent = _currentLcd.length + ' location' + (_currentLcd.length > 1 ? 's' : '');
    badge.style.display = _currentLcd.length ? '' : 'none';
  }
  if (status) {
    if (pending.length) {
      status.innerHTML = `<div style="background:rgba(34,211,200,.08);border:1px solid rgba(34,211,200,.25);border-radius:8px;padding:10px 14px;color:var(--cyan);font-size:12px"><strong>⚠️ ${pending.length} location(s) à compléter</strong> — renseigne les dates de séjour et le locataire, puis clique sur <strong>Enregistrer</strong>.</div>`;
    } else {
      status.innerHTML = '';
    }
  }
}

function _lcdCalcNuits(debut, fin) {
  // Parse JJ/MM/AAAA ou YYYY-MM-DD
  const parse = s => {
    if (!s) return null;
    const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1]);
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
    return null;
  };
  const d1 = parse(debut), d2 = parse(fin);
  if (!d1 || !d2) return 0;
  const diff = Math.round((d2 - d1) / 86400000);
  return diff > 0 ? diff : 0;
}

function updateLcdField(i, field, value) {
  if (!_currentLcd[i]) return;
  _currentLcd[i][field] = value;
  if (field === 'dateDebut' || field === 'dateFin') {
    _currentLcd[i].nuits = _lcdCalcNuits(_currentLcd[i].dateDebut, _currentLcd[i].dateFin);
    const nuitsTd = document.getElementById('lcd-nuits-' + i);
    if (nuitsTd) nuitsTd.textContent = _currentLcd[i].nuits || '—';
  }
  _saveLcdPending();
}

function _saveLcdPending() {
  const pending = _currentLcd.filter(a => a._pending);
  const saved   = _currentLcd.filter(a => !a._pending);
  localStorage.setItem('artemis_lcd', JSON.stringify(saved));
  if (pending.length) localStorage.setItem('artemis_lcd_pending', JSON.stringify(pending));
  else localStorage.removeItem('artemis_lcd_pending');
}

function saveLcdData() {
  // Retirer le flag _pending sur toutes les lignes et tout sauver dans artemis_lcd
  _currentLcd.forEach(a => delete a._pending);
  localStorage.setItem('artemis_lcd', JSON.stringify(_currentLcd));
  localStorage.removeItem('artemis_lcd_pending');
  renderLcdTable(_currentLcd);
  showToast('✅ ' + _currentLcd.length + ' location(s) enregistrée(s) !');
}

function clearLcdData() {
  _currentLcd = [];
  localStorage.removeItem('artemis_lcd');
  localStorage.removeItem('artemis_lcd_pending');
  renderLcdTable([]);
  showToast('Données LCD supprimées.', 'var(--text2)');
}

function loadLcdOnOpen() {
  // Migration : nettoyer _pending sur les données déjà sauvegardées
  const savedRaw = localStorage.getItem('artemis_lcd');
  if (savedRaw) {
    try {
      const s = JSON.parse(savedRaw);
      s.forEach(a => delete a._pending);
      localStorage.setItem('artemis_lcd', JSON.stringify(s));
    } catch(e) {}
  }
  const rows = _getLcdAll();
  if (!rows.length) {
    const tbody = document.getElementById('lcd-tbody');
    const status = document.getElementById('lcd-import-status');
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="padding:20px;text-align:center;color:var(--text2);font-size:12px">Aucune location directe détectée.</td></tr>';
    if (status) status.innerHTML = '';
    return;
  }
  renderLcdTable(rows);
}

function deleteLcdRow(i) {
  const rows = [..._currentLcd];
  if (!rows[i]) return;
  const label = rows[i].libelle || 'cette location';
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:24px;max-width:360px;width:90%;text-align:center';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px';
  title.textContent = 'Supprimer cette location ?';
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:12px;color:var(--text2);margin-bottom:20px';
  sub.textContent = label;
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:10px;justify-content:center';
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Annuler';
  btnCancel.style.cssText = 'background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--text);font-size:12px;padding:8px 20px;cursor:pointer;font-family:inherit';
  btnCancel.onclick = () => modal.remove();
  const btnOk = document.createElement('button');
  btnOk.textContent = 'Supprimer';
  btnOk.style.cssText = 'background:rgba(220,50,50,.15);border:1px solid rgba(220,50,50,.4);border-radius:7px;color:var(--red);font-size:12px;font-weight:700;padding:8px 20px;cursor:pointer;font-family:inherit';
  btnOk.onclick = () => {
    modal.remove();
    rows.splice(i, 1);
    _currentLcd = rows;
    _saveLcdPending();
    renderLcdTable(rows);
    showToast('Location supprimée.');
  };
  btns.appendChild(btnCancel);
  btns.appendChild(btnOk);
  inner.appendChild(title); inner.appendChild(sub); inner.appendChild(btns);
  modal.appendChild(inner);
  document.body.appendChild(modal);
}

function _dateInputMask(el) {
  el.addEventListener('keydown', function(e) {
    // Permettre : backspace, delete, tab, arrows, ctrl+A/C/V/X
    if ([8,9,37,38,39,40,46].includes(e.keyCode) || (e.ctrlKey||e.metaKey)) return;
    // Bloquer tout sauf chiffres
    if (e.key < '0' || e.key > '9') { e.preventDefault(); return; }
  });
  el.addEventListener('input', function(e) {
    let v = this.value.replace(/[^\d]/g, ''); // garder chiffres seulement
    let out = '';
    if (v.length >= 1) out = v.slice(0,2);
    if (v.length >= 3) out += '/' + v.slice(2,4);
    if (v.length >= 5) out += '/' + v.slice(4,8);
    // Éviter boucle infinie
    if (this.value !== out) {
      const pos = this.selectionStart;
      this.value = out;
      // Ajuster position curseur
      let newPos = pos;
      if (v.length === 2 || v.length === 4) newPos = out.length; // après le /
      try { this.setSelectionRange(newPos, newPos); } catch(e) {}
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  ARTEMIS DATE PICKER
// ═══════════════════════════════════════════════════════════════
(function(){
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MOIS_C=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const JOURS=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];

// ── CSS ──
const css=document.createElement('style');
css.textContent=`
.adp-wrap{display:inline-flex;align-items:center;position:relative}
.adp-btn{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:inherit;font-size:11px;padding:4px 8px;height:30px;cursor:pointer;white-space:nowrap;min-width:98px}
.adp-btn:hover{border-color:var(--cyan)}
.adp-pop{position:fixed;z-index:99999;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:14px;width:252px;box-shadow:0 12px 40px rgba(0,0,0,.55)}
.adp-pop button{border:none;cursor:pointer;font-family:inherit}
.adp-day,.adp-mo,.adp-yr{background:none;text-align:center;font-size:11px;padding:5px 2px;border-radius:5px;color:var(--text2);width:100%}
.adp-day:hover,.adp-mo:hover,.adp-yr:hover{background:var(--bg3);color:var(--text)}
.adp-day.sel,.adp-mo.sel,.adp-yr.sel{background:var(--cyan);color:#000;font-weight:700}
.adp-day.today{color:var(--cyan);font-weight:700}
.adp-day.other{opacity:.3}
`;
document.head.appendChild(css);

// ── State ──
let _pop=null, _input=null, _btn=null;
let _view='days', _vy=2025, _vm=0;

function _parseYMD(s){const m=s&&s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?{y:+m[1],m:+m[2]-1,d:+m[3]}:null;}
function _toYMD(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function _fmtDisp(s){const p=_parseYMD(s);return p?String(p.d).padStart(2,'0')+'/'+String(p.m+1).padStart(2,'0')+'/'+p.y:'——/——/————';}

function _close(){if(_pop){_pop.remove();_pop=null;_input=null;_btn=null;}}

function _open(btn,input){
  if(_input===input){_close();return;}
  _close();
  _btn=btn; _input=input;
  const p=_parseYMD(input.value)||{y:new Date().getFullYear(),m:new Date().getMonth(),d:1};
  _vy=p.y; _vm=p.m; _view='days';
  _pop=document.createElement('div');
  _pop.className='adp-pop';
  document.body.appendChild(_pop);
  _render();
}

function _pos(){
  if(!_pop||!_btn) return;
  const r=_btn.getBoundingClientRect();
  let top=r.bottom+4, left=r.left;
  if(top+310>window.innerHeight) top=r.top-310-4;
  if(left+252>window.innerWidth) left=window.innerWidth-260;
  _pop.style.top=top+'px';
  _pop.style.left=left+'px';
}

function _pick(y,m,d){
  const s=_toYMD(y,m,d);
  _input.value=s;
  if(_btn) _btn.querySelector('.adp-lbl').textContent=_fmtDisp(s);
  _input.dispatchEvent(new Event('change',{bubbles:true}));
  _input.dispatchEvent(new Event('input',{bubbles:true}));
  _close();
}

function _nav(dir){
  if(_view==='days'){_vm+=dir;if(_vm>11){_vm=0;_vy++;}else if(_vm<0){_vm=11;_vy--;}}
  else if(_view==='months'){_vy+=dir;}
  else{_vy+=dir*12;}
  _render();
}

function _render(){
  if(!_pop) return;
  const sel=_input?_parseYMD(_input.value):null;
  const tn=new Date(); const ty=tn.getFullYear(),tm=tn.getMonth(),td=tn.getDate();
  let h='';

  // Header
  let titleTxt='', titleClick='';
  if(_view==='days'){titleTxt=MOIS[_vm]+' '+_vy; titleClick="adpSetView('months')";}
  else if(_view==='months'){titleTxt=String(_vy); titleClick="adpSetView('years')";}
  else{const dec=Math.floor(_vy/12)*12; titleTxt=dec+' – '+(dec+11); titleClick='';}

  h+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <span onclick="${titleClick}" style="font-size:13px;font-weight:700;color:var(--text);${titleClick?'cursor:pointer;':''}padding:2px 6px;border-radius:6px;background:var(--bg3)">${titleTxt}</span>
    <div style="display:flex;flex-direction:column;gap:1px">
      <button onclick="adpNav(-1)" style="background:none;color:var(--text2);font-size:11px;padding:1px 5px;border-radius:4px" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='none'">↑</button>
      <button onclick="adpNav(1)"  style="background:none;color:var(--text2);font-size:11px;padding:1px 5px;border-radius:4px" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='none'">↓</button>
    </div>
  </div>`;

  if(_view==='days'){
    // Jours de semaine
    h+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:3px">`;
    JOURS.forEach(j=>{h+=`<div style="text-align:center;font-size:9px;font-weight:700;color:var(--text2);padding:2px 0">${j}</div>`;});
    h+=`</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;

    const first=new Date(_vy,_vm,1);
    const last=new Date(_vy,_vm+1,0);
    const startDow=(first.getDay()+6)%7;
    const prevLast=new Date(_vy,_vm,0).getDate();

    for(let i=startDow-1;i>=0;i--){
      const dd=prevLast-i;
      h+=`<button class="adp-day other" onclick="adpPick(${_vy},${_vm-1},${dd})">${dd}</button>`;
    }
    for(let d=1;d<=last.getDate();d++){
      const isT=(_vy===ty&&_vm===tm&&d===td);
      const isS=(sel&&_vy===sel.y&&_vm===sel.m&&d===sel.d);
      const cls='adp-day'+(isS?' sel':isT?' today':'');
      h+=`<button class="${cls}" onclick="adpPick(${_vy},${_vm},${d})">${d}</button>`;
    }
    const filled=startDow+last.getDate();
    const rem=filled%7===0?0:7-(filled%7);
    for(let d=1;d<=rem;d++){
      h+=`<button class="adp-day other" onclick="adpPick(${_vy},${_vm+1},${d})">${d}</button>`;
    }
    h+=`</div>`;

  } else if(_view==='months'){
    h+=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">`;
    MOIS_C.forEach((mo,i)=>{
      const isS=(sel&&_vy===sel.y&&i===sel.m);
      h+=`<button class="adp-mo${isS?' sel':''}" onclick="adpPickMonth(${i})">${mo}</button>`;
    });
    h+=`</div>`;

  } else {
    const dec=Math.floor(_vy/12)*12;
    h+=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">`;
    for(let y=dec;y<dec+12;y++){
      const isS=(sel&&y===sel.y);
      h+=`<button class="adp-yr${isS?' sel':''}" onclick="adpPickYear(${y})">${y}</button>`;
    }
    h+=`</div>`;
  }

  _pop.innerHTML=h;
  _pos();
}

// Fonctions globales appelées depuis le HTML inline
window.adpNav=function(d){_nav(d);};
window.adpSetView=function(v){_view=v;_render();};
window.adpPick=function(y,m,d){_pick(y,m,d);};
window.adpPickMonth=function(m){_vm=m;_view='days';_render();};
window.adpPickYear=function(y){_vy=y;_view='months';_render();};

// ── Patch un input[type=date] ──────────────────────────────
function patchInput(input){
  if(input._adp) return;
  input._adp=true;

  const wrap=document.createElement('span');
  wrap.className='adp-wrap';
  input.parentNode.insertBefore(wrap,input);
  wrap.appendChild(input);
  input.style.display='none';

  const btn=document.createElement('button');
  btn.type='button';
  btn.className='adp-btn';

  // Récupérer le style de l'input original
  const istyle=input.getAttribute('style')||'';
  if(istyle) btn.setAttribute('style', istyle.replace('display:none','') + ';display:inline-flex;align-items:center;justify-content:space-between');

  const lbl=document.createElement('span');
  lbl.className='adp-lbl';
  lbl.textContent=_fmtDisp(input.value);
  const ico=document.createElement('span');
  ico.textContent='▼';
  ico.style.cssText='font-size:8px;opacity:.5';
  btn.appendChild(lbl);
  btn.appendChild(ico);
  wrap.insertBefore(btn,input);

  btn.addEventListener('click',e=>{e.stopPropagation();_open(btn,input);});

  // Observer les changements programmatiques
  const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  Object.defineProperty(input,'value',{
    get(){return desc.get.call(this);},
    set(v){desc.set.call(this,v);lbl.textContent=_fmtDisp(v);}
  });
}

function patchAll(){document.querySelectorAll('input[type=date]').forEach(patchInput);}
function patchMasks(){document.querySelectorAll('input[data-datemask]').forEach(el=>{if(!el._datemask){el._datemask=true;_dateInputMask(el);}});}

document.addEventListener('DOMContentLoaded',()=>{patchAll();patchMasks();});
if(document.readyState!=='loading') setTimeout(()=>{patchAll();patchMasks();},100);

new MutationObserver(ms=>{
  ms.forEach(m=>m.addedNodes.forEach(n=>{
    if(n.nodeType!==1)return;
    if(n.tagName==='INPUT'&&n.type==='date') patchInput(n);
    else n.querySelectorAll&&n.querySelectorAll('input[type=date]').forEach(patchInput);
    if(n.tagName==='INPUT'&&n.hasAttribute('data-datemask')&&!n._datemask){n._datemask=true;_dateInputMask(n);}
    n.querySelectorAll&&n.querySelectorAll('input[data-datemask]').forEach(el=>{if(!el._datemask){el._datemask=true;_dateInputMask(el);}});
  }));
}).observe(document.body||document.documentElement,{childList:true,subtree:true});

document.addEventListener('click',e=>{
  if(_pop&&!_pop.contains(e.target)&&e.target!==_btn&&!(_btn&&_btn.contains(e.target))) _close();
},true);

})();
