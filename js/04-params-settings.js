// ════════════════════════════════════════════
//  PARAMS UI FUNCTIONS
// ════════════════════════════════════════════
function switchParamTab(btn) {
  // Remettre la barre d'onglets et le header visibles (cachés pour LCD)
  document.querySelectorAll('#paramsTabs').forEach(el=>el.style.display='');
  document.querySelectorAll('#paramsActionBar').forEach(el=>el.style.display='');
  if (btn.dataset.tab === 'tab-amort') setTimeout(loadAmortOnOpen, 50);
  if (btn.dataset.tab === 'tab-lcd') setTimeout(loadLcdOnOpen, 50);
  document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.param-tab').forEach(t=>t.style.display='none');
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).style.display='';
}
function renderParams() {
  const p=getParams();
  // S'assurer que tab-lcd est masqué et tab-biens actif par défaut
  document.querySelectorAll('#tab-lcd').forEach(t=>t.style.display='none');
  document.querySelectorAll('#tab-biens').forEach(t=>t.style.display='');
  document.querySelectorAll('#paramsTabs').forEach(el=>el.style.display='');
  document.querySelectorAll('#paramsActionBar').forEach(el=>el.style.display='');
  renderScisList(p); renderBiensList(p);
  renderAirbnbMapList(p); renderBookingMapList(p);
  renderQpList(p); renderLoansList(p);
}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/'/g,'&#39;');}
function sciOptions(sel,p){return (p||getParams()).scis.map(s=>`<option value="${escHtml(s)}" ${s===sel?'selected':''}>${escHtml(s)}</option>`).join('');}
function bienOptions(sel,p){return (p||getParams()).biens.map(b=>`<option value="${b.id}" ${b.id===sel?'selected':''}>${escHtml(b.name)}</option>`).join('');}
function lotOptions(sel,p){return (p||getParams()).lots.map(l=>`<option value="${escHtml(l)}" ${l===sel?'selected':''}>${escHtml(l)}</option>`).join('');}

// SCIs
function renderScisList(p){
  if(!p)p=getParams();
  document.getElementById('scis-list').innerHTML=p.scis.map((s,i)=>`
    <div class="param-row" style="grid-template-columns:1fr auto">
      <input value="${escHtml(s)}" oninput="updateSci(${i},this.value)" placeholder="Nom SCI">
      <button class="param-del" onclick="delSci(${i})">&#x2715;</button>
    </div>`).join('');
}
function updateSci(i,v){const p=getParams();p.scis[i]=v;saveParamsAndSync(p);}
function delSci(i){const p=getParams();p.scis.splice(i,1);saveParamsAndSync(p);renderParams();}
function addSci(){const p=getParams();p.scis.push('Nouvelle SCI');saveParamsAndSync(p);renderParams();}

// Biens
function renderBiensList(p){
  if(!p)p=getParams();
  const hdr=['Nom court','Nom long (Airbnb)','Type','SCI','Lot',''].map(h=>`<div style="font-size:9px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.07em">${h}</div>`).join('');
  const rows=p.biens.map((b,i)=>`
    <div class="param-row" style="grid-template-columns:1fr 1.8fr 70px 1fr 1fr auto">
      <input value="${escHtml(b.name)}" oninput="updateBien(${i},'name',this.value)">
      <input value="${escHtml(b.nom)}" oninput="updateBien(${i},'nom',this.value)">
      <select onchange="updateBien(${i},'type',this.value)">
        <option ${b.type==='LCD'?'selected':''}>LCD</option>
        <option ${b.type==='LLD'?'selected':''}>LLD</option>
        <option ${b.type==='SC'?'selected':''}>SC</option>
      </select>
      <select onchange="updateBien(${i},'sci',this.value)">${sciOptions(b.sci,p)}</select>
      <select onchange="updateBien(${i},'lot',this.value)">${lotOptions(b.lot,p)}</select>
      <button class="param-del" onclick="delBien(${i})">&#x2715;</button>
    </div>`).join('');
  document.getElementById('biens-list').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1.8fr 70px 1fr 1fr auto;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);margin-bottom:4px">${hdr}</div>${rows}`;
}
function _slugify(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function addBien(){const p=getParams();p.biens.push({id:'nouveau',name:'Nouveau bien',nom:'Nom complet',sci:p.scis[0]||'',type:'LCD',lot:p.lots[0]||'',lat:'',lng:''});saveParamsAndSync(p);renderParams();}
function updateBien(i,f,v){const p=getParams();if(f==='lat'||f==='lng')v=v.replace(',','.');p.biens[i][f]=v;if(f==='name')p.biens[i].id=_slugify(v)||'bien_'+i;saveParamsAndSync(p);}

// ══════════════════════════════════════════════
// AMORTISSEMENTS — Import & gestion
// ══════════════════════════════════════════════

const AMORT_CATS = ['Immobilisation - Travaux','Immobilisation - Mobilier','Immobilisation - Équipements','Immobilisation - Rénovations','Immobilisation - Acquisition','Immobilisation - Informatique','Immobilisation - Notaire'];
const AMORT_METHODS = ['Lin\u00e9aire','D\u00e9gressif','Non amortissable'];

function importAmortFile(input) {
  const file = input.files[0]; if (!file) return;
  const status = document.getElementById('amort-import-status');
  status.innerHTML = '<span style="color:var(--text2)">\u23f3 Lecture du fichier\u2026</span>';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // raw:true -> numbers stay numeric (avoids "16 140,00 €" formatted strings)
      // dates come as JS Date objects thanks to cellDates:true
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, dateNF: 'dd/mm/yyyy' });
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i].filter(c => c && String(c).trim()).length >= 3) { headerIdx = i; break; }
      }
      const headers = rows[headerIdx].map(h => String(h||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());
      const colIdx = (kws) => { for (const kw of kws) { const i = headers.findIndex(h => h.includes(kw)); if (i >= 0) return i; } return -1; };
      const iLib  = colIdx(['libel','label','design','intitul','nom']);
      const iDate = colIdx(['date','achat','acqui','mise en service']);
      const iVal  = colIdx(['valeur','montant','ht','prix','cout']);
      const iDur  = colIdx(['duree','mois','periode','economique']);
      const missing = [];
      if (iLib  < 0) missing.push('Libell\u00e9');
      if (iDate < 0) missing.push("Date d'achat");
      if (iVal  < 0) missing.push('Valeur HT');
      if (iDur  < 0) missing.push('Dur\u00e9e \u00e9conomique');
      if (missing.length) {
        status.innerHTML = '<span style="color:var(--red)">\u274c Colonnes introuvables\u00a0: <strong>' + missing.join(', ') + '</strong>.<br>V\u00e9rifie que ton fichier contient bien ces en-t\u00eates.</span>';
        return;
      }
      const dataRows = rows.slice(headerIdx + 1).filter(r => r[iLib] && String(r[iLib]).trim());
      if (!dataRows.length) { status.innerHTML = '<span style="color:var(--red)">\u274c Aucune ligne trouv\u00e9e.</span>'; return; }
      const amorts = dataRows.map(r => ({
        libelle:   String(r[iLib]||'').trim(),
        dateAchat: (function(v){ if(!v) return ''; if(v instanceof Date){ var d=v.getDate().toString().padStart(2,'0'), m=(v.getMonth()+1).toString().padStart(2,'0'), y=v.getFullYear(); return d+'/'+m+'/'+y; } return String(v).trim(); })(r[iDate]),
        valeurHT:  (function(v){ if(typeof v==='number') return Math.round(v*100)/100; var s=String(v||'0').replace(/[\s\u00a0\u202f\u2009\u200a]+/g,'').replace(/[\u20ac$\xa3]/g,'').trim(); if(!s||s==='-') return 0; var hasDot=s.indexOf('.')>=0,hasComma=s.indexOf(',')>=0; if(hasDot&&hasComma){ if(s.lastIndexOf('.')>s.lastIndexOf(',')){ s=s.replace(/,/g,''); } else { s=s.replace(/\./g,'').replace(',','.'); } } else if(hasComma){ var p=s.split(','); if(p.length===2&&p[1].length<=2){ s=s.replace(',','.'); } else { s=s.replace(/,/g,''); } } var r2=parseFloat(s); return isNaN(r2)?0:Math.round(r2*100)/100; })(r[iVal]),
        duree:     parseInt(String(r[iDur]||'0').replace(/[^\d]/g,'')) || 0,
        methode:   'Lin\u00e9aire',
        lot:       '',
        bienId:    '',
        categorie: ''
      }));
      // Fusionner avec les entrées pending existantes (détectées depuis mapping bancaire)
      const existingPending = JSON.parse(localStorage.getItem('artemis_amort_pending') || '[]');
      const existingSaved   = JSON.parse(localStorage.getItem('artemis_amort') || '[]');
      // Garder les entrées _fromImport (détectées depuis mapping) qui ne viennent pas du fichier
      const fromBanking = existingPending.filter(e => e._fromImport);
      const merged = [...fromBanking, ...amorts];
      localStorage.setItem('artemis_amort_pending', JSON.stringify(merged));
      status.innerHTML = '<span style="color:var(--green)">\u2705 ' + amorts.length + ' actif' + (amorts.length > 1 ? 's' : '') + ' import\u00e9' + (amorts.length > 1 ? 's' : '') + ' \u2014 compl\u00e8te les informations ci-dessous puis clique sur <strong>Enregistrer</strong>.</span>';
      renderAmortTable(merged);
      input.value = '';
    } catch(err) {
      status.innerHTML = '<span style="color:var(--red)">\u274c Erreur\u00a0: ' + err.message + '</span>';
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderAmortTable(amorts) {
  _currentAmorts = amorts;
  const card  = document.getElementById('amort-table-card');
  const tbody = document.getElementById('amort-tbody');
  const badge = document.getElementById('amort-badge');
  const countLabel = document.getElementById('amort-count-label');
  if (!card || !tbody) return;
  card.style.display = '';
  const p = getParams();
  const lotOpts  = '<option value="">\u2014</option>' + p.lots.map(l => '<option value="' + escHtml(l) + '">' + escHtml(l) + '</option>').join('');
  const bienOpts = '<option value="">\u2014 Tous \u2014</option>' + p.biens.map(b => '<option value="' + b.id + '">' + escHtml(b.name) + '</option>').join('');
  tbody.innerHTML = amorts.map(function(a, i) {
    // Ligne "à compléter" seulement si _fromImport ET champs essentiels manquants
    const isIncomplete = !!a._fromImport && (!a.valeurHT || !a.duree || !a.bienId);
    const rowBg = isIncomplete ? 'background:rgba(245,183,49,.06)' : (i % 2 === 0 ? '' : 'background:rgba(255,255,255,.015)');
    const selStyle = 'background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:10px;padding:4px 6px;font-family:inherit;width:100%';
    const inputStyle = 'width:100%;background:transparent;border:none;border-bottom:1px solid var(--border2);color:var(--text);font-size:11px;font-family:inherit;padding:2px 0;outline:none';
    const numStyle = 'width:100%;background:transparent;border:none;border-bottom:1px solid var(--border2);color:var(--text);font-size:11px;font-family:monospace;padding:2px 0;outline:none;text-align:right';
    const methSel = AMORT_METHODS.map(m => '<option value="' + m + '" ' + (m===a.methode?'selected':'') + '>' + m + '</option>').join('');
    const catSel  = '<option value="">\u2014 Choisir \u2014</option>' + AMORT_CATS.map(c => '<option value="' + escHtml(c) + '" ' + (c===a.categorie?'selected':'') + '>' + escHtml(c) + '</option>').join('');
    const lotSelRow  = '<option value="">\u2014</option>' + p.lots.map(l => '<option value="' + escHtml(l) + '" ' + (l===a.lot?'selected':'') + '>' + escHtml(l) + '</option>').join('');
    const bienSelRow = '<option value="">\u2014 Choisir \u2014</option>' + '<option value="frais_generaux" ' + (a.bienId==='frais_generaux'?'selected':'') + '>Frais g\u00e9n\u00e9raux</option>' + p.biens.map(b => '<option value="' + b.id + '" ' + (b.id===a.bienId?'selected':'') + '>' + escHtml(b.name) + '</option>').join('');
    const newBadge = isIncomplete ? '<span style="font-size:9px;background:rgba(245,183,49,.15);border:1px solid rgba(245,183,49,.4);color:var(--gold);border-radius:3px;padding:1px 5px;margin-left:5px;vertical-align:middle">\u00e0 compléter</span>' : '';
    const srcHint = a._fromImport && a._srcMontant ? '<div style="font-size:9px;color:var(--text2);margin-top:2px">Montant bancaire\u00a0: ' + a._srcMontant.toLocaleString('fr-FR',{minimumFractionDigits:2}) + '\u00a0\u20ac</div>' : '';
    return '<tr style="border-bottom:1px solid var(--border);' + rowBg + '" onmouseover="this.style.background=\'rgba(255,255,255,.025)\'" onmouseout="this.style.background=\'' + (isIncomplete?'rgba(245,183,49,.06)':i%2===0?'':'rgba(255,255,255,.015)') + '\'">' +
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;font-family:monospace">' + (i+1) + '</td>' +
      '<td style="padding:7px 10px;max-width:180px"><input value="' + escHtml(a.libelle) + '" oninput="updateAmortField(' + i + ',\'libelle\',this.value)" style="' + inputStyle + '">' + newBadge + srcHint + '</td>' +
      '<td style="padding:7px 10px"><input value="' + escHtml(a.dateAchat||'') + '" placeholder="JJ/MM/AAAA" data-datemask oninput="updateAmortField(' + i + ',\'dateAchat\',this.value)" style="' + inputStyle + ';width:90px"></td>' +
      '<td style="padding:7px 10px"><input type="number" min="0" step="0.01" value="' + (a.valeurHT||0) + '" oninput="updateAmortField(' + i + ',\'valeurHT\',parseFloat(this.value)||0)" style="' + numStyle + ';width:80px"></td>' +
      '<td style="padding:7px 10px"><input type="number" min="0" step="1" value="' + (a.duree||0) + '" oninput="updateAmortField(' + i + ',\'duree\',parseInt(this.value)||0)" style="' + numStyle + ';width:50px"></td>' +
      '<td style="padding:7px 10px"><select onchange="updateAmortField(' + i + ',\'methode\',this.value)" style="' + selStyle + '">' + methSel + '</select></td>' +
      '<td id="amort-lot-td-' + i + '" style="padding:7px 10px' + (a.bienId==='frais_generaux'?';outline:1px solid rgba(245,183,49,.5);border-radius:5px':'') + '"><select onchange="updateAmortField(' + i + ',\'lot\',this.value)" style="' + selStyle + (a.bienId==='frais_generaux'?';border-color:rgba(245,183,49,.6)':'') + '">' + lotSelRow + '</select></td>' +
      '<td style="padding:7px 10px"><select id="amort-bien-' + i + '" onchange="updateAmortField(' + i + ',\'bienId\',this.value);_amortHighlightLot(' + i + ',this.value)" style="' + selStyle + '">' + bienSelRow + '</select></td>' +
      '<td style="padding:7px 10px"><select onchange="updateAmortField(' + i + ',\'categorie\',this.value)" style="' + selStyle + '">' + catSel + '</select></td>' +
      '<td style="padding:7px 6px;text-align:center"><button onclick="deleteAmortRow(' + i + ')" style="background:rgba(220,50,50,.12);border:1px solid rgba(220,50,50,.3);cursor:pointer;color:var(--red);font-size:10px;font-weight:600;padding:3px 8px;border-radius:5px;font-family:inherit;white-space:nowrap" onmouseover="this.style.background=\'rgba(220,50,50,.25)\'" onmouseout="this.style.background=\'rgba(220,50,50,.12)\'">Supprimer</button></td>' +
    '</tr>';
  }).join('');
  if (badge) { badge.textContent = amorts.length + ' actif' + (amorts.length > 1 ? 's' : ''); badge.style.display = ''; }
  if (countLabel) countLabel.textContent = amorts.length + ' actif' + (amorts.length > 1 ? 's' : '') + ' \u2014 modifie les champs puis clique sur Enregistrer';
  // Mettre à jour la bannière "à compléter"
  const _statusEl = document.getElementById('amort-import-status');
  if (_statusEl) {
    const _incomplete = amorts.filter(a => a._fromImport && (!a.valeurHT || !a.duree || !a.bienId));
    if (_incomplete.length) {
      _statusEl.innerHTML = '<div style="background:rgba(245,183,49,.1);border:1px solid rgba(245,183,49,.35);border-radius:8px;padding:10px 14px;color:var(--gold);font-size:12px">'
        + '<strong>⚠️ ' + _incomplete.length + ' immobilisation(s) à compléter</strong> — renseigne la valeur HT, la durée et le bien pour chaque ligne marquée <span style="font-size:10px;background:rgba(245,183,49,.15);border:1px solid rgba(245,183,49,.4);border-radius:3px;padding:1px 5px">à compléter</span>, puis clique sur <strong>Enregistrer</strong>.</div>';
    } else if (_statusEl.querySelector && _statusEl.querySelector('strong')) {
      _statusEl.innerHTML = '';
    }
  }
}

function _amortHighlightLot(i, bienId) {
  const td = document.getElementById('amort-lot-td-' + i);
  const sel = td ? td.querySelector('select') : null;
  if (!td || !sel) return;
  if (bienId === 'frais_generaux') {
    td.style.outline = '1px solid rgba(245,183,49,.5)';
    td.style.borderRadius = '5px';
    sel.style.borderColor = 'rgba(245,183,49,.6)';
    sel.title = 'Requis pour la ventilation par quote-part';
  } else {
    td.style.outline = '';
    td.style.borderRadius = '';
    sel.style.borderColor = 'var(--border2)';
    sel.title = '';
  }
}

function updateAmortField(i, field, value) {
  const amorts = [..._currentAmorts];
  if (!amorts[i]) return;
  amorts[i][field] = value;
  // Retirer le flag _fromImport dès que la ligne est complète
  if (amorts[i]._fromImport && amorts[i].valeurHT > 0 && amorts[i].duree > 0 && amorts[i].bienId) {
    delete amorts[i]._fromImport;
  }
  // Sauvegarder : pending = lignes _fromImport, saved = reste
  const pending = amorts.filter(a => a._fromImport);
  const saved   = amorts.filter(a => !a._fromImport);
  localStorage.setItem('artemis_amort', JSON.stringify(saved));
  if (pending.length) localStorage.setItem('artemis_amort_pending', JSON.stringify(pending));
  else localStorage.removeItem('artemis_amort_pending');
  renderAmortTable(amorts);
}

let _currentAmorts = [];

function _getAmortStorage() {
  // Retourne {data, key} — pending en priorité, sinon saved
  const pendingRaw = localStorage.getItem('artemis_amort_pending');
  if (pendingRaw) return { data: JSON.parse(pendingRaw), key: 'artemis_amort_pending' };
  const savedRaw = localStorage.getItem('artemis_amort');
  if (savedRaw) return { data: JSON.parse(savedRaw), key: 'artemis_amort' };
  return { data: [], key: 'artemis_amort_pending' };
}

function _getAllAmorts() {
  // Retourne la liste fusionnée complète (pending + saved sans doublons)
  const pending = JSON.parse(localStorage.getItem('artemis_amort_pending') || '[]');
  const saved   = JSON.parse(localStorage.getItem('artemis_amort') || '[]');
  if (!pending.length) return { data: saved, key: 'artemis_amort' };
  if (!saved.length)   return { data: pending, key: 'artemis_amort_pending' };
  // Fusionner : pending remplace saved sur même libellé+date
  const pendingKeys = new Set(pending.map(a => a.libelle + '|' + a._srcDate));
  const merged = [...saved.filter(a => !pendingKeys.has(a.libelle + '|' + a._srcDate)), ...pending];
  return { data: merged, key: 'artemis_amort_pending' };
}

function deleteAmortRow(i) {
  const amorts = [..._currentAmorts];
  if (!amorts.length || !amorts[i]) return;
  const label = amorts[i].libelle || 'cette immobilisation';
  const existing = document.getElementById('adel-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'adel-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:24px;max-width:360px;width:90%;text-align:center';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px';
  title.textContent = 'Supprimer cette immobilisation ?';
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
  btnOk.onclick = () => { modal.remove(); _confirmDeleteAmort(i); };
  btns.appendChild(btnCancel);
  btns.appendChild(btnOk);
  inner.appendChild(title);
  inner.appendChild(sub);
  inner.appendChild(btns);
  modal.appendChild(inner);
  document.body.appendChild(modal);
}

function _confirmDeleteAmort(i) {
  const amorts = [..._currentAmorts];
  if (!amorts[i]) return;
  amorts.splice(i, 1);
  const pending = amorts.filter(a => a._fromImport);
  const saved   = amorts.filter(a => !a._fromImport);
  localStorage.setItem('artemis_amort', JSON.stringify(saved));
  if (pending.length) localStorage.setItem('artemis_amort_pending', JSON.stringify(pending));
  else localStorage.removeItem('artemis_amort_pending');
  _currentAmorts = amorts;
  renderAmortTable(amorts);
  showToast('Immobilisation supprimée');
}

function saveAmortData(btn) {
  const pendingRaw = localStorage.getItem('artemis_amort_pending');
  if (!pendingRaw) { showToast('Aucune donn\u00e9e \u00e0 enregistrer.', 'var(--red)'); return; }
  // Fusionner pending avec les actifs déjà sauvegardés
  const pending = JSON.parse(pendingRaw);
  const saved   = JSON.parse(localStorage.getItem('artemis_amort') || '[]');
  // Les pending remplacent les saved (ils contiennent déjà la fusion banking+fichier)
  // On dédoublonne par libellé+dateAchat pour éviter les doublons
  const allKeys = new Set(pending.map(a => a.libelle + '|' + a.dateAchat));
  const keptSaved = saved.filter(a => !allKeys.has(a.libelle + '|' + a.dateAchat));
  const merged = [...keptSaved, ...pending];
  // Nettoyer _fromImport sur toutes les lignes (sauvegardées = considérées complètes)
  merged.forEach(a => { delete a._fromImport; });
  localStorage.setItem('artemis_amort', JSON.stringify(merged));
  localStorage.removeItem('artemis_amort_pending');
  const amorts = merged;
  // Toast
  showToast('\u2705 ' + amorts.length + ' actif' + (amorts.length > 1 ? 's' : '') + ' enregistr\u00e9' + (amorts.length > 1 ? 's' : '') + ' !');
  // Badge
  const badge = document.getElementById('amort-badge');
  if (badge) { badge.textContent = amorts.length + ' actif' + (amorts.length > 1 ? 's' : '') + ' enregistr\u00e9' + (amorts.length > 1 ? 's' : ''); badge.style.display = ''; }
  // Button feedback
  if (btn) {
    const orig = btn.innerHTML;
    const origStyle = btn.style.cssText;
    btn.innerHTML = '\u2705 Enregistr\u00e9';
    btn.style.background = 'rgba(34,201,122,.15)';
    btn.style.borderColor = 'rgba(34,201,122,.4)';
    btn.style.color = 'var(--green)';
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = orig; btn.style.cssText = origStyle; btn.disabled = false; }, 2500);
  }
  // Status line
  const status = document.getElementById('amort-import-status');
  if (status) status.innerHTML = '<span style="color:var(--green)">\u2705 ' + amorts.length + ' actif' + (amorts.length > 1 ? 's' : '') + ' enregistr\u00e9' + (amorts.length > 1 ? 's' : '') + ' avec succ\u00e8s.</span>';
}

function clearAmortData() {
  localStorage.removeItem('artemis_amort');
  localStorage.removeItem('artemis_amort_pending');
  const card = document.getElementById('amort-table-card');
  const badge = document.getElementById('amort-badge');
  const status = document.getElementById('amort-import-status');
  if (card) card.style.display = 'none';
  if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
  if (status) status.innerHTML = '<span style="color:var(--text2)">Données supprimées.</span>';
}

function loadAmortOnOpen() {
  // Migration : nettoyer _fromImport sur les données déjà sauvegardées (artemis_amort)
  const savedRaw = localStorage.getItem('artemis_amort');
  if (savedRaw) {
    try {
      const savedAmorts = JSON.parse(savedRaw);
      let changed = false;
      savedAmorts.forEach(a => { if (a._fromImport) { delete a._fromImport; changed = true; } });
      if (changed) localStorage.setItem('artemis_amort', JSON.stringify(savedAmorts));
    } catch(e) {}
  }
  const pending = localStorage.getItem('artemis_amort_pending');
  const saved   = localStorage.getItem('artemis_amort');
  const raw = pending || saved;
  if (!raw) return;
  try {
    const amorts = JSON.parse(raw);
    if (!amorts || !amorts.length) return;
    renderAmortTable(amorts);
    // Bannière si des lignes viennent d'imports bancaires
    const fromImport = amorts.filter(a => a._fromImport);
    const status = document.getElementById('amort-import-status');
    if (fromImport.length && status) {
      status.innerHTML = '<div style="background:rgba(245,183,49,.1);border:1px solid rgba(245,183,49,.35);border-radius:8px;padding:10px 14px;color:var(--gold);font-size:12px">'
        + '<strong>⚠️ ' + fromImport.length + ' immobilisation(s) à compléter</strong> — détectées lors d\'un import bancaire. '
        + 'Renseigne la valeur HT, la durée et le bien pour chaque ligne marquée <span style="font-size:10px;background:rgba(245,183,49,.15);border:1px solid rgba(245,183,49,.4);border-radius:3px;padding:1px 5px">à compléter</span>, '
        + 'puis clique sur <strong>Enregistrer</strong>.</div>';
    }
  } catch(e) {}
}


// ══════════════════════════════════════════════
// MOTEUR DE CALCUL DES DOTATIONS
// ══════════════════════════════════════════════

function computeAmortSchedule(actif) {
  const { valeurHT, duree, methode, dateAchat } = actif;
  if (!valeurHT || !duree || methode === 'Non amortissable') return [];
  let startDate;
  if (dateAchat instanceof Date) {
    startDate = new Date(dateAchat.getFullYear(), dateAchat.getMonth(), dateAchat.getDate());
  } else if (typeof dateAchat === 'string') {
    const p = dateAchat.includes('/') ? dateAchat.split('/').reverse() : dateAchat.split('-');
    startDate = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  }
  if (!startDate || isNaN(startDate)) return [];

  const totalMonths = duree;
  const dureeAns = totalMonths / 12;
  let coeff = 1;
  if (methode === 'D\u00e9gressif') {
    if (dureeAns <= 4) coeff = 1.25;
    else if (dureeAns <= 6) coeff = 1.75;
    else coeff = 2.25;
  }
  const tauxDeg = (1 / dureeAns) * coeff;
  const daysInStart = new Date(startDate.getFullYear(), startDate.getMonth()+1, 0).getDate();
  const prorataFirst = (daysInStart - startDate.getDate() + 1) / daysInStart;

  const schedule = [];
  let vnc = valeurHT;

  if (methode === 'Lin\u00e9aire') {
    const mensualite = valeurHT / totalMonths;
    for (let m = 0; m < totalMonths && vnc > 0.005; m++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth()+m, 1);
      const ym = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const prorata = m === 0 ? prorataFirst : 1;
      const dot = Math.min(Math.round(mensualite * prorata * 100)/100, vnc);
      vnc = Math.round((vnc - dot)*100)/100;
      schedule.push({ yearMonth: ym, dotation: dot, vnc });
    }
  } else {
    // D\u00e9gressif : calcul annuel r\u00e9parti en mensualit\u00e9s
    let moisTraites = 0, annee = 0;
    while (vnc > 0.005 && moisTraites < totalMonths) {
      const anneesRestantes = (totalMonths - moisTraites) / 12;
      const dotDeg = vnc * tauxDeg;
      const dotLin = anneesRestantes > 0 ? vnc / anneesRestantes : vnc;
      const dotAnnuelle = Math.max(dotDeg, dotLin);
      let moisAnnee;
      if (annee === 0) {
        moisAnnee = Math.min((12 - startDate.getMonth() - 1) + prorataFirst, totalMonths - moisTraites);
      } else {
        moisAnnee = Math.min(12, totalMonths - moisTraites);
      }
      const dotAnnuellePro = annee === 0 ? dotAnnuelle * (moisAnnee / 12) : dotAnnuelle;
      const mensualite = dotAnnuellePro / moisAnnee;
      for (let m = 0; m < moisAnnee && vnc > 0.005; m++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth()+moisTraites, 1);
        const ym = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
        const prorata = moisTraites === 0 ? prorataFirst : 1;
        const dot = Math.min(Math.round(mensualite * prorata * 100)/100, vnc);
        vnc = Math.round((vnc - dot)*100)/100;
        schedule.push({ yearMonth: ym, dotation: dot, vnc });
        moisTraites++;
      }
      annee++;
    }
  }
  if (vnc > 0 && schedule.length > 0) {
    schedule[schedule.length-1].dotation = Math.round((schedule[schedule.length-1].dotation + vnc)*100)/100;
    schedule[schedule.length-1].vnc = 0;
  }
  return schedule;
}

function toggleAmortSchedule(btn) {
  const card = document.getElementById('amort-schedule-card');
  if (!card) return;
  const visible = card.style.display !== 'none';
  if (visible) {
    card.style.display = 'none';
    btn.textContent = '\uD83D\uDCCA Voir dotations';
    btn.style.color = '';
    btn.style.borderColor = '';
  } else {
    card.style.display = '';
    btn.textContent = '\u2715 Masquer dotations';
    btn.style.color = 'var(--cyan)';
    btn.style.borderColor = 'rgba(34,211,200,.4)';
    _populateAmortFilters();
    renderAmortSchedule();
  }
}

function _populateAmortFilters() {
  const p = getParams();
  const lotSel = document.getElementById('amort-f-lot');
  const bienSel = document.getElementById('amort-f-bien');
  const yearSel = document.getElementById('amort-f-year');
  if (!lotSel || !bienSel || !yearSel) return;

  const raw = localStorage.getItem('artemis_amort');
  const amorts = raw ? JSON.parse(raw) : [];

  // Years
  const years = new Set();
  amorts.forEach(a => {
    const sched = computeAmortSchedule(a);
    sched.forEach(s => years.add(s.yearMonth.split('-')[0]));
  });
  const curYear = yearSel.value;
  yearSel.innerHTML = '<option value="">Toutes ann\u00e9es</option>' +
    [...years].sort().map(y => '<option value="'+y+'" '+(y===curYear?'selected':'')+'>'+y+'</option>').join('');

  // Lots
  const curLot = lotSel.value;
  lotSel.innerHTML = '<option value="">Tous les lots</option>' +
    p.lots.map(l => '<option value="'+escHtml(l)+'" '+(l===curLot?'selected':'')+'>'+escHtml(l)+'</option>').join('');

  // Biens
  const curBien = bienSel.value;
  bienSel.innerHTML = '<option value="">Tous les biens</option>' +
    p.biens.map(b => '<option value="'+b.id+'" '+(b.id===curBien?'selected':'')+'>'+escHtml(b.name)+'</option>').join('');
}

function renderAmortSchedule() {
  const body = document.getElementById('amort-schedule-body');
  if (!body) return;

  const raw = localStorage.getItem('artemis_amort');
  if (!raw) { body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:12px">Aucun actif enregistr\u00e9. Importe et enregistre un fichier d\u2019abord.</div>'; return; }

  const amorts = JSON.parse(raw);
  const p = getParams();

  const fCat  = (document.getElementById('amort-f-cat')  || {}).value || '';
  const fLot  = (document.getElementById('amort-f-lot')  || {}).value || '';
  const fBien = (document.getElementById('amort-f-bien') || {}).value || '';
  const fYear = (document.getElementById('amort-f-year') || {}).value || '';

  // Ventiler les actifs frais_generaux via QP → une entrée par bien
  const qp = p.qp || {};
  const expanded = [];
  amorts.forEach(a => {
    if (a.bienId !== 'frais_generaux') {
      expanded.push(a);
      return;
    }
    if (a.methode === 'Non amortissable') { expanded.push(a); return; }
    const lot = a.lot || '';
    const aCat = a.categorie || '';
    // Chercher d'abord dans qp[categorie de l'actif], puis fallback sur toutes les catégories
    let grp = null;
    const findGrp = (grpList) => grpList ? (grpList.find(g => g.lot === lot) || null) : null;
    if (aCat && qp[aCat]) grp = findGrp(qp[aCat]);
    if (!grp) {
      for (const grpList of Object.values(qp)) {
        const g = grpList.find(g => g.lot === lot);
        if (g && g.biens && Object.keys(g.biens).length) { grp = g; break; }
      }
    }
    if (!grp) { expanded.push(a); return; } // pas de règle QP → garder tel quel
    // Créer une entrée virtuelle par bien
    for (const [bienId, pct] of Object.entries(grp.biens)) {
      if (!pct) continue;
      const bien = p.biens.find(b => b.id === bienId || b.name === bienId);
      if (!bien) continue;
      expanded.push({
        ...a,
        _label_display: a.libelle + ' (FG → ' + bien.name + ' ' + Math.round(pct*100) + '%)',
        bienId: bien.id,
        lot: bien.lot || lot,
        valeurHT: Math.round(a.valeurHT * pct * 100) / 100,
        _ventilPct: pct,
        _isFGVentil: true,
      });
    }
  });

  // Filter actifs
  const filtered = expanded.filter(a => {
    if (fCat  && a.categorie !== fCat)  return false;
    if (fLot  && a.lot       !== fLot)  return false;
    if (fBien && a.bienId    !== fBien) return false;
    return true;
  });

  if (!filtered.length) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:12px">Aucun actif ne correspond aux filtres.</div>';
    return;
  }

  // Get bien name helper
  const bienName = (id) => {
    if (!id || id === '') return '\u2014';
    if (id === 'frais_generaux') return 'Frais g\u00e9n\u00e9raux';
    const b = p.biens.find(b => b.id === id);
    return b ? b.name : id;
  };

  // Totaux globaux pour la p\u00e9riode filtr\u00e9e
  let grandTotal = 0;

  const rows = filtered.map(a => {
    const sched = computeAmortSchedule(a);
    const schedFiltered = fYear ? sched.filter(s => s.yearMonth.startsWith(fYear)) : sched;

    if (!schedFiltered.length && fYear) return '';

    const totalDot = schedFiltered.reduce((s, r) => s+r.dotation, 0);
    grandTotal += totalDot;

    const MONTH_NAMES = ['Jan','F\u00e9v','Mar','Avr','Mai','Jun','Jul','Ao\u00fb','Sep','Oct','Nov','D\u00e9c'];

    // Group by year for display
    const byYear = {};
    schedFiltered.forEach(s => {
      const [y, m] = s.yearMonth.split('-');
      if (!byYear[y]) byYear[y] = Array(12).fill(null);
      byYear[y][parseInt(m)-1] = s.dotation;
    });

    const yearRows = Object.keys(byYear).sort().map(yr => {
      const months = byYear[yr];
      const yearTotal = months.reduce((s, v) => s + (v||0), 0);
      const cells = months.map(v => v !== null
        ? '<td style="padding:5px 7px;text-align:right;font-family:monospace;font-size:10px;color:var(--text)">'
          + v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '</td>'
        : '<td style="padding:5px 7px;text-align:right;color:var(--border2);font-size:10px">\u2014</td>'
      ).join('');
      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:5px 10px;font-size:10px;font-weight:700;color:var(--text2);white-space:nowrap">'+yr+'</td>'
        + cells
        + '<td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:var(--cyan)">'
          + yearTotal.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '</td>'
        + '</tr>';
    }).join('');

    const vnc0 = sched.length ? sched[0].vnc + sched[0].dotation : a.valeurHT;
    const vncFin = sched.length ? sched[sched.length-1].vnc : 0;
    const dureeAns = (a.duree/12).toFixed(1).replace('.0','');

    return '<div style="margin-bottom:18px">'
      // Header actif
      + '<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:8px 8px 0 0;padding:10px 14px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">'
      + '<span style="font-size:12px;font-weight:700;color:var(--text);flex:1">' + escHtml(a._label_display || a.libelle) + '</span>'
      + '<span style="font-size:10px;color:var(--text2)">' + (a.dateAchat||'\u2014') + '</span>'
      + '<span style="font-size:11px;font-weight:700;color:var(--gold);font-family:monospace">' + a.valeurHT.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' \u20ac</span>'
      + '<span style="font-size:10px;background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:2px 8px;color:var(--text2)">' + (a.methode||'\u2014') + ' \u00b7 ' + dureeAns + ' ans</span>'
      + '<span style="font-size:10px;color:var(--text2)">' + escHtml(a.categorie||'\u2014') + '</span>'
      + '<span style="font-size:10px;color:var(--cyan)">' + bienName(a.bienId) + '</span>'
      + '<span style="font-size:10px;font-family:monospace;color:var(--text2)">VNC\u00a0fin\u00a0: <strong style="color:'+(vncFin>0?'var(--gold)':'var(--green)')+'">'+vncFin.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' \u20ac</strong></span>'
      + '</div>'
      // Tableau mensuel
      + '<div style="overflow-x:auto;border:1px solid var(--border2);border-top:none;border-radius:0 0 8px 8px">'
      + '<table style="width:100%;border-collapse:collapse;min-width:800px">'
      + '<thead><tr style="background:var(--bg4)">'
      + '<th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2);white-space:nowrap">Ann\u00e9e</th>'
      + MONTH_NAMES.map(m=>'<th style="padding:6px 7px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text2)">'+m+'</th>').join('')
      + '<th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2)">Total</th>'
      + '</tr></thead>'
      + '<tbody>' + yearRows + '</tbody>'
      + '</table></div>'
      + '</div>';
  }).join('');

  // Grand total banner
  const totalBanner = '<div style="background:rgba(34,211,200,.06);border:1px solid rgba(34,211,200,.2);border-radius:8px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<span style="font-size:11px;font-weight:700;color:var(--text2)">'+(fYear||'Toutes ann\u00e9es')+' \u2014 '+filtered.length+' actif'+(filtered.length>1?'s':'')+' s\u00e9lectionn\u00e9'+(filtered.length>1?'s':'')+' </span>'
    + '<span style="font-family:monospace;font-size:14px;font-weight:800;color:var(--cyan)">'+grandTotal.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' \u20ac</span>'
    + '</div>';

  body.innerHTML = totalBanner + rows;
}

function downloadAmortTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Libell\u00e9', "Date d'achat", 'Valeur HT', 'Dur\u00e9e \u00e9conomique (mois)'],
    ['Exemple - Travaux cuisine', '15/03/2023', 12500, 120],
    ['Exemple - Mobilier salon', '01/06/2023', 3200, 60],
    ['Exemple - Acquisition immeuble', '10/01/2022', 180000, 360],
  ]);
  ws['!cols'] = [{wch:32},{wch:18},{wch:14},{wch:26}];
  XLSX.utils.book_append_sheet(wb, ws, 'Amortissements');
  XLSX.writeFile(wb, 'ARTEMIS_modele_amortissements.xlsx');
}


// Airbnb map
function renderAirbnbMapList(p){
  if(!p)p=getParams();
  const entries=Object.entries(p.airbnbMap||{});
  document.getElementById('airbnb-map-list').innerHTML=entries.length?entries.map(([nom,bId],i)=>`
    <div class="param-row" style="grid-template-columns:2fr 1fr auto">
      <input value="${escHtml(nom)}" oninput="updateAirbnbKey(${i},this.value)">
      <select onchange="updateAirbnbVal(${i},this.value)">${bienOptions(bId,p)}</select>
      <button class="param-del" onclick="delAirbnbMap(${i})">&#x2715;</button>
    </div>`).join(''):'<div style="font-size:11px;color:var(--text2);padding:8px 0">Aucune correspondance</div>';
}
function updateAirbnbKey(i,nk){const p=getParams();const e=Object.entries(p.airbnbMap);const ok=e[i][0],v=e[i][1];delete p.airbnbMap[ok];p.airbnbMap[nk]=v;saveParamsAndSync(p);}
function updateAirbnbVal(i,v){const p=getParams();const k=Object.keys(p.airbnbMap)[i];p.airbnbMap[k]=v;saveParamsAndSync(p);}
function delAirbnbMap(i){const p=getParams();delete p.airbnbMap[Object.keys(p.airbnbMap)[i]];saveParamsAndSync(p);renderParams();}
function addAirbnbMap(){const p=getParams();p.airbnbMap['Nouveau logement']=p.biens[0]?.id||'';saveParamsAndSync(p);renderParams();}

// Booking map
function renderBookingMapList(p){
  if(!p)p=getParams();
  const entries=Object.entries(p.bookingMap||{});
  document.getElementById('booking-map-list').innerHTML=entries.length?entries.map(([id,bId],i)=>`
    <div class="param-row" style="grid-template-columns:1fr 1fr auto">
      <input value="${escHtml(id)}" oninput="updateBookingKey(${i},this.value)" placeholder="ID établissement">
      <select onchange="updateBookingVal(${i},this.value)">${bienOptions(bId,p)}</select>
      <button class="param-del" onclick="delBookingMap(${i})">&#x2715;</button>
    </div>`).join(''):'<div style="font-size:11px;color:var(--text2);padding:8px 0">Aucune correspondance</div>';
}
function updateBookingKey(i,nk){const p=getParams();const e=Object.entries(p.bookingMap);const ok=e[i][0],v=e[i][1];delete p.bookingMap[ok];p.bookingMap[nk]=v;saveParamsAndSync(p);}
function updateBookingVal(i,v){const p=getParams();const k=Object.keys(p.bookingMap)[i];p.bookingMap[k]=v;saveParamsAndSync(p);}
function delBookingMap(i){const p=getParams();delete p.bookingMap[Object.keys(p.bookingMap)[i]];saveParamsAndSync(p);renderParams();}
function addBookingMap(){const p=getParams();p.bookingMap['ID_ETAB']=p.biens[0]?.id||'';saveParamsAndSync(p);renderParams();}

// QP
let _selectedQpCat = null;

function renderQpList(p){
  if(!p) p = getParams();
  _renderQpCatList(p);
  // Keep selected cat in sync; fall back to first if gone
  const cats = Object.keys(p.qp || {}).sort((a,b) => a.localeCompare(b,'fr'));
  if(_selectedQpCat && !p.qp[_selectedQpCat]) _selectedQpCat = cats[0] || null;
  if(!_selectedQpCat && cats.length) _selectedQpCat = cats[0];
  _renderQpDetail(p);
}

function _renderQpCatList(p){
  if(!p) p = getParams();
  const el = document.getElementById('qp-cat-list');
  if(!el) return;
  const cats = Object.keys(p.qp || {}).sort((a,b) => a.localeCompare(b,'fr'));
  if(!cats.length){
    el.innerHTML = '<div style="font-size:11px;color:var(--text2);padding:6px 4px">Aucune catégorie</div>';
    return;
  }
  el.innerHTML = cats.map(cat => {
    const groups = p.qp[cat] || [];
    const allOk = groups.every(g => Math.abs(Object.values(g.biens||{}).reduce((a,v)=>a+v,0) - 1) < 0.005);
    const isActive = cat === _selectedQpCat;
    return `<div onclick="selectQpCat('${escHtml(cat)}')" style="
      display:flex;align-items:center;justify-content:space-between;
      padding:7px 10px;border-radius:7px;cursor:pointer;
      background:${isActive ? 'rgba(34,211,200,.1)' : 'transparent'};
      border:1px solid ${isActive ? 'rgba(34,211,200,.25)' : 'transparent'};
      transition:all .15s"
      onmouseover="if('${cat}'!==_selectedQpCat)this.style.background='rgba(255,255,255,.03)'"
      onmouseout="if('${cat}'!==_selectedQpCat)this.style.background='transparent'">
      <span style="font-size:11px;font-weight:${isActive?'700':'500'};color:${isActive?'var(--cyan)':'var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${escHtml(cat)}</span>
      <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${allOk?'var(--green)':'var(--red)'}"></span>
    </div>`;
  }).join('');
}

function selectQpCat(cat){
  _selectedQpCat = cat;
  renderQpList();
}

function _renderQpDetail(p){
  if(!p) p = getParams();
  const el = document.getElementById('qp-detail-pane');
  if(!el) return;
  if(!_selectedQpCat || !p.qp[_selectedQpCat]){
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text2);font-size:12px">← Sélectionner une catégorie</div>';
    return;
  }
  const cat = _selectedQpCat;
  const groups = p.qp[cat];
  const gHtml = groups.map((g, gi) => {
    const bHtml = Object.entries(g.biens||{}).map(([bId,pct],bi) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <select style="flex:1;background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:11px;padding:5px 8px"
          data-action="qp-bien" data-gi="${gi}" data-bi="${bi}">${bienOptions(bId,p)}</select>
        <input type="number" min="0" max="100" step="0.01" value="${(pct*100).toFixed(2)}"
          data-action="qp-pct" data-gi="${gi}" data-bi="${bi}"
          style="width:80px;background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-family:monospace;font-size:12px;padding:5px 8px;text-align:right;outline:none">
        <span style="font-size:11px;color:var(--text2);width:10px">%</span>
        <button class="param-del" data-action="qp-del-bien" data-gi="${gi}" data-bi="${bi}">✕</button>
      </div>`).join('');
    const tot = Object.values(g.biens||{}).reduce((a,v)=>a+v,0);
    const totOk = Math.abs(tot-1) < 0.005;
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:10px;color:var(--text2);font-weight:600;min-width:26px">Lot</span>
        <select style="flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:11px;padding:5px 8px"
          data-action="qp-lot" data-gi="${gi}">${lotOptions(g.lot,p)}</select>
        <span style="font-size:11px;font-weight:700;min-width:44px;text-align:right;color:${totOk?'var(--green)':'var(--red)'}">${(tot*100).toFixed(1)}%</span>
        <button class="param-del" data-action="qp-del-group" data-gi="${gi}">✕</button>
      </div>
      ${bHtml}
      <button data-action="qp-add-bien" data-gi="${gi}" style="background:none;border:1px dashed var(--border2);border-radius:5px;color:var(--text2);font-size:10px;padding:3px 12px;cursor:pointer;margin-top:2px">+ Bien</button>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:14px;font-weight:700">${escHtml(cat)}</div>
        <div style="font-size:10px;color:var(--text2);margin-top:2px">${groups.length} groupe${groups.length>1?'s':''} de répartition</div>
      </div>
      <div style="display:flex;gap:8px">
        <button data-action="qp-add-group" class="btn btn-outline" style="font-size:10px;padding:5px 12px">+ Groupe</button>
        <button data-action="qp-del-cat" class="btn btn-red" style="font-size:10px;padding:5px 12px">Supprimer</button>
      </div>
    </div>
    ${gHtml || '<div style="font-size:11px;color:var(--text2)">Aucun groupe - cliquez &quot;+ Groupe&quot;</div>'}
  </div>`;

  // Délégation d'événements — aucun inline string avec cat
  el.onclick = function(e) {
    const btn = e.target.closest('[data-action]');
        if (!btn) return;
    const action = btn.dataset.action;
        const gi = parseInt(btn.dataset.gi ?? -1);
    const bi = parseInt(btn.dataset.bi ?? -1);
    const p2 = getParams();
    if (action === 'qp-add-bien')      { const used=Object.keys(p2.qp[cat][gi].biens||{}); const id=(p2.biens.find(b=>!used.includes(b.id))||p2.biens[0])?.id||''; if(!id) return; p2.qp[cat][gi].biens[id]=0; saveParamsAndSync(p2); renderQpList(p2); }
    else if (action === 'qp-add-group'){ p2.qp[cat].push({lot:p2.lots[0]||'',biens:{}}); saveParamsAndSync(p2); renderQpList(p2); }
    else if (action === 'qp-del-cat')  { delete p2.qp[cat]; if(_selectedQpCat===cat)_selectedQpCat=Object.keys(p2.qp)[0]||null; saveParamsAndSync(p2); renderQpList(p2); }
    else if (action === 'qp-del-group'){ p2.qp[cat].splice(gi,1); saveParamsAndSync(p2); renderQpList(p2); }
    else if (action === 'qp-del-bien') { const k=Object.keys(p2.qp[cat][gi].biens)[bi]; delete p2.qp[cat][gi].biens[k]; saveParamsAndSync(p2); renderQpList(p2); }
  };
  el.onchange = function(e) {
    const sel = e.target.closest('[data-action]');
    if (!sel) return;
    const action = sel.dataset.action;
    const gi = parseInt(sel.dataset.gi ?? -1);
    const bi = parseInt(sel.dataset.bi ?? -1);
    const p2 = getParams();
    if (action === 'qp-lot')  { p2.qp[cat][gi].lot = sel.value; saveParamsAndSync(p2); renderQpList(p2); }
    else if (action === 'qp-bien') { const keys=Object.keys(p2.qp[cat][gi].biens); const old=keys[bi]; const pct=p2.qp[cat][gi].biens[old]; delete p2.qp[cat][gi].biens[old]; p2.qp[cat][gi].biens[sel.value]=pct; saveParamsAndSync(p2); renderQpList(p2); }
  };
  el.oninput = function(e) {
    const inp = e.target.closest('[data-action]');
    if (!inp || inp.dataset.action !== 'qp-pct') return;
    const gi = parseInt(inp.dataset.gi);
    const bi = parseInt(inp.dataset.bi);
    const p2 = getParams();
    const k = Object.keys(p2.qp[cat][gi].biens)[bi];
    p2.qp[cat][gi].biens[k] = parseFloat(inp.value||0)/100;
    saveParamsAndSync(p2);
    // Rafraîchir juste le % total sans re-render complet
    const grp = p2.qp[cat][gi];
    const tot = Object.values(grp.biens).reduce((a,v)=>a+v,0);
    const totOk = Math.abs(tot-1)<0.005;
    const totEl = inp.closest('div[style*="border-radius:9px"]')?.querySelector('span[style*="min-width:44px"]');
    if (totEl) { totEl.textContent = (tot*100).toFixed(1)+'%'; totEl.style.color = totOk?'var(--green)':'var(--red)'; }
  };
}
// Fonctions legacy gardées pour compatibilité mais plus utilisées en interne
function updateQpLot(cat,gi,v){const p=getParams();p.qp[cat][gi].lot=v;saveParamsAndSync(p);renderQpList(p);}
function updateQpBien(cat,gi,bi,v){const p=getParams();const keys=Object.keys(p.qp[cat][gi].biens);const old=keys[bi];const pct=p.qp[cat][gi].biens[old];delete p.qp[cat][gi].biens[old];p.qp[cat][gi].biens[v]=pct;saveParamsAndSync(p);renderQpList(p);}
function updateQpPct(cat,gi,bi,v){const p=getParams();const k=Object.keys(p.qp[cat][gi].biens)[bi];p.qp[cat][gi].biens[k]=parseFloat(v||0)/100;saveParamsAndSync(p);}
function delQpBien(cat,gi,bi){const p=getParams();const k=Object.keys(p.qp[cat][gi].biens)[bi];delete p.qp[cat][gi].biens[k];saveParamsAndSync(p);renderQpList(p);}
function addQpBien(cat,gi){const p=getParams();const id=p.biens[0]?.id||'';p.qp[cat][gi].biens[id]=0;saveParamsAndSync(p);renderQpList(p);}
function addQpGroup(cat){const p=getParams();p.qp[cat].push({lot:p.lots[0]||'',biens:{}});saveParamsAndSync(p);renderQpList(p);}
function delQpGroup(cat,gi){const p=getParams();p.qp[cat].splice(gi,1);saveParamsAndSync(p);renderQpList(p);}
function delQpCat(cat){const p=getParams();delete p.qp[cat];if(_selectedQpCat===cat)_selectedQpCat=Object.keys(p.qp)[0]||null;saveParamsAndSync(p);renderQpList(p);}
function toggleAddQpForm(btn, forceClose) {
  const form = document.getElementById('qp-add-form');
  if (!form) return;
  const isVisible = form.style.display !== 'none';
  if (forceClose || isVisible) {
    form.style.display = 'none';
    const sel = document.getElementById('qp-new-cat-input');
    if (sel) sel.value = '';
  } else {
    // Peupler le select avec les catégories du SCHEMA sans règle QP existante
    const sel = document.getElementById('qp-new-cat-input');
    if (sel) {
      const p = getParams();
      const existing = Object.keys(p.qp || {});
      const allCats = Object.keys(SCHEMA).sort((a, b) => a.localeCompare(b, 'fr'));
      const available = allCats.filter(c => !existing.includes(c));
      sel.innerHTML = '<option value="">— Choisir une catégorie —</option>' +
        available.map(c => '<option value="' + c.replace(/"/g, '&quot;') + '">' + c + '</option>').join('');
    }
    form.style.display = 'block';
    const sel2 = document.getElementById('qp-new-cat-input');
    if (sel2) setTimeout(() => sel2.focus(), 50);
  }
}
function confirmAddQp(inp) {
  const cat = (inp ? inp.value : '').trim();
  if (!cat) return;
  const p = getParams();
  if (!p.qp[cat]) p.qp[cat] = [{lot: p.lots[0] || '', biens: {}}];
  _selectedQpCat = cat;
  saveParamsAndSync(p);
  // Trier les clés QP par ordre alphabétique
  const sorted = {};
  Object.keys(p.qp).sort((a,b) => a.localeCompare(b,'fr')).forEach(k => { sorted[k] = p.qp[k]; });
  p.qp = sorted;
  saveParamsAndSync(p);
  renderQpList(p);
  toggleAddQpForm(null, true);
}
function addQp() { toggleAddQpForm(); } // compat legacy

// Loans
function renderLoansList(p){
  if(!p)p=getParams();
  const el=document.getElementById('loans-list');
  if(!p.loans||!p.loans.length){el.innerHTML='<div style="color:var(--text2);font-size:11px;padding:8px 0">Aucun emprunt configuré</div>';return;}
  el.innerHTML=p.loans.map((l,i)=>{
    const months=Object.keys((p.loanTable||{})[l.ref]||{}).length;
    const bHtml=(l.biens||[]).map((bId,bi)=>`
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <select style="flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:11px;padding:4px 8px" onchange="updateLoanBien(${i},${bi},this.value)">${bienOptions(bId,p)}</select>
        <input type="number" min="0" max="100" step="0.01" value="${((l.pcts[bi]||0)*100).toFixed(2)}" oninput="updateLoanPct(${i},${bi},this.value)" style="width:76px;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:11px;padding:4px 8px;text-align:right">
        <span style="font-size:10px;color:var(--text2)">%</span>
        <button class="param-del" onclick="delLoanBien(${i},${bi})">&#x2715;</button>
      </div>`).join('');
    const totPct=(l.pcts||[]).reduce((a,v)=>a+v,0);
    const totCls=Math.abs(totPct-1)<0.005?'pct-total-ok':'pct-total-bad';
    return `<div class="loan-card">
      <div class="loan-card-head">
        <div>
          <div class="loan-ref">${escHtml(l.ref)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${escHtml(l.label)} · <span style="color:var(--cyan)">${months} échéances</span></div>
        </div>
        <button class="param-del" onclick="delLoan(${i})">&#x2715;</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div>
          <div style="font-size:9px;color:var(--text2);font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px">Référence</div>
          <input value="${escHtml(l.ref)}" oninput="updateLoan(${i},'ref',this.value)" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--cyan);font-family:monospace;font-size:12px;padding:5px 8px">
        </div>
        <div>
          <div style="font-size:9px;color:var(--text2);font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px">Libellé</div>
          <input value="${escHtml(l.label)}" oninput="updateLoan(${i},'label',this.value)" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:12px;padding:5px 8px">
        </div>
        <div>
          <div style="font-size:9px;color:var(--text2);font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px">Lot</div>
          <select style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:12px;padding:5px 8px" onchange="updateLoan(${i},'lot',this.value)">${lotOptions(l.lot,p)}</select>
        </div>
      </div>
      <div style="font-size:9px;color:var(--text2);font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px">
        Répartition <span class="${totCls}">${(totPct*100).toFixed(1)}%</span>
      </div>
      ${bHtml}
      <button onclick="addLoanBien(${i})" style="background:none;border:1px dashed var(--border2);border-radius:5px;color:var(--text2);font-size:10px;padding:3px 10px;cursor:pointer">+ Bien</button>
      <button onclick="_repairLoanLinesByRef(this)" data-ref="${escHtml(l.ref)}" style="background:rgba(240,86,106,.1);border:1px solid rgba(240,86,106,.3);border-radius:5px;color:var(--red);font-size:10px;padding:3px 10px;cursor:pointer;margin-left:6px">🔧 Réparer les montants</button>
      <button onclick="_swapCapInt(this)" data-ref="${escHtml(l.ref)}" style="background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.3);border-radius:5px;color:orange;font-size:10px;padding:3px 10px;cursor:pointer;margin-left:6px" title="Inverser capital et intérêts si importés dans le mauvais sens">🔄 Inverser cap/int</button>
      ${(()=>{
        const tbl=(p.loanTable||{})[l.ref]||{};
        const allKeys=Object.keys(tbl).sort(); const keys=[...allKeys.slice(0,2),...allKeys.slice(-2)];
        if(!keys.length) return '';
        const rows=keys.map(ym=>{
          const [cap,int]=tbl[ym]||[0,0];
          const tot=cap+int;
          const ok=Math.abs(tot)>0;
          return `<tr>
            <td style="color:var(--text2);font-size:10px;font-family:monospace;padding:2px 6px">${ym}</td>
            <td style="text-align:right;font-family:monospace;font-size:10px;padding:2px 6px;color:var(--red)">${cap.toFixed(2)} €</td>
            <td style="text-align:right;font-family:monospace;font-size:10px;padding:2px 6px;color:var(--gold)">${int.toFixed(2)} €</td>
            <td style="text-align:right;font-family:monospace;font-size:10px;padding:2px 6px;color:${ok?'var(--cyan)':'var(--text2)'}">${tot.toFixed(2)} €</td>
          </tr>`;
        }).join('');
        return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
          <div style="font-size:9px;color:var(--text2);font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px">Premières &amp; dernières échéances</div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="font-size:9px;color:var(--text2);text-align:left;padding:2px 6px;font-weight:600">Période</th>
              <th style="font-size:9px;color:var(--text2);text-align:right;padding:2px 6px;font-weight:600">Capital</th>
              <th style="font-size:9px;color:var(--text2);text-align:right;padding:2px 6px;font-weight:600">Intérêts</th>
              <th style="font-size:9px;color:var(--text2);text-align:right;padding:2px 6px;font-weight:600">Total échéance</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      })()}
    </div>`;
  }).join('');
}
function updateLoan(i,f,v){const p=getParams();p.loans[i][f]=v;saveParamsAndSync(p);}
function updateLoanBien(i,bi,v){const p=getParams();p.loans[i].biens[bi]=v;saveParamsAndSync(p);}
function updateLoanPct(i,bi,v){const p=getParams();p.loans[i].pcts[bi]=parseFloat(v||0)/100;saveParamsAndSync(p);}
function delLoanBien(i,bi){const p=getParams();p.loans[i].biens.splice(bi,1);p.loans[i].pcts.splice(bi,1);saveParamsAndSync(p);renderLoansList(p);}
function addLoanBien(i){const p=getParams();p.loans[i].biens.push(p.biens[0]?.id||'');p.loans[i].pcts.push(0);saveParamsAndSync(p);renderLoansList(p);}
function delLoan(i){const p=getParams();p.loans.splice(i,1);saveParamsAndSync(p);renderLoansList(p);}
function addLoan(){const p=getParams();p.loans.push({ref:'REF',label:'Nouvel emprunt',lot:p.lots[0]||'',biens:[],pcts:[]});saveParamsAndSync(p);renderLoansList(p);}

// Loan import modal
let _limRows=null,_limFileName="";
function openLoanImportModal(input){
  if(!input.files[0])return;
  _limFileName=input.files[0].name;
  readXlsx(input.files[0],(name,rows)=>{
    _limRows=rows; _populateLimModal(rows);
    document.getElementById("loanImportModal").style.display="flex";
  });
  input.value="";
}
function _populateLimModal(rows){
  document.getElementById("lim-filename").textContent=_limFileName;
  var p=getParams();
  document.getElementById("lim-loan-sel").innerHTML=(p.loans||[]).map((l,i)=>"<option value='"+i+"'>"+(l.label||l.ref)+" ("+l.ref+")</option>").join("");
  var hds=(rows[0]||[]).map((h,i)=>({h:String(h||"col "+(i+1)),i}));
  var opts=hds.map(x=>"<option value='"+x.i+"'>"+(x.h)+"</option>").join("");
  ["lim-col-date","lim-col-cap","lim-col-int"].forEach(function(id){document.getElementById(id).innerHTML=opts;});
  var guess=function(rx){return hds.findIndex(function(x){return rx.test(x.h);});};
  document.getElementById("lim-col-date").value=Math.max(0,guess(/date|pér|period/i));
  var iC=guess(/capital.am|cap.*am|amort/i),iI=guess(/int[eé]r/i);
  document.getElementById("lim-col-cap").value=iC>=0?iC:4;
  document.getElementById("lim-col-int").value=iI>=0?iI:5;
  updateLimPreview();
}
function _parseYM(v){
  if(v instanceof Date)return v.toISOString().slice(0,7);
  var s=String(v||"").trim();
  // YYYY-MM ou YYYY-MM-DD
  var m2=s.match(/^(\d{4})-(\d{2})/);
  if(m2)return m2[1]+"-"+m2[2];
  // DD/MM/YYYY (français 4 chiffres)
  var m1=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m1)return m1[3]+"-"+m1[2];
  // M/DD/YY ou MM/DD/YY (SheetJS, année 2 chiffres)
  var m3=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(m3)return '20'+m3[3]+'-'+m3[1].padStart(2,'0');
  // M/DD/YYYY (SheetJS, année 4 chiffres)
  var m4=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m4)return m4[3]+'-'+m4[1].padStart(2,'0');
  return s.slice(0,7);
}
function updateLimPreview(){
  if(!_limRows)return;
  var iD=+document.getElementById("lim-col-date").value;
  var iC=+document.getElementById("lim-col-cap").value;
  var iI=+document.getElementById("lim-col-int").value;
  var data=_limRows.slice(1).filter(Boolean).slice(0,3);
  var f=function(v){return (()=>{const _v=parseFloat(v||0);const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()+" €";};
  document.getElementById("lim-preview").innerHTML=
    "<div style='font-size:9px;color:var(--text2);margin-bottom:8px'>Aperçu - 3 premières lignes</div>"+
    (data.length?data.map(function(r){
      return "<div style='margin-bottom:5px'><span style='color:var(--text)'>"+_parseYM(r[iD])+"</span>"
        +" · Cap. <span style='color:var(--cyan);font-family:monospace'>"+f(r[iC])+"</span>"
        +" · Int. <span style='color:var(--gold);font-family:monospace'>"+f(r[iI])+"</span></div>";
    }).join(""):"<span>Aucune donnée</span>");
}
function closeLoanImportModal(){document.getElementById("loanImportModal").style.display="none";_limRows=null;}
function confirmLoanImport(){
  if(!_limRows)return;
  var p=getParams();
  var li=+document.getElementById("lim-loan-sel").value;
  var loan=(p.loans||[])[li];
  if(!loan){showToast("Aucun emprunt sélectionné");return;}
  var iD=+document.getElementById("lim-col-date").value;
  var iC=+document.getElementById("lim-col-cap").value;
  var iI=+document.getElementById("lim-col-int").value;
  if(!p.loanTable)p.loanTable={};
  if(!p.loanTable[loan.ref])p.loanTable[loan.ref]={};
  var n=0;
  _limRows.slice(1).forEach(function(r){
    if(!r)return;
    var ym=_parseYM(r[iD]),cap=parseFloat(r[iC]||0),int=parseFloat(r[iI]||0);
    if(!ym||ym.length<7||(!cap&&!int))return;
    p.loanTable[loan.ref][ym]=[cap,int]; n++;
  });
  saveParamsAndSync(p);
  closeLoanImportModal();
  document.getElementById("loan-import-status").textContent="✅ "+n+" échéances - "+loan.label;
  renderLoansList(p);
  showToast("✅ "+loan.label+" : "+n+" échéances importées");
}

// Resynchronise les QP (ventilation FG) sur toutes les lignes en base
function _resyncAllFG() {
  const db = getDB();
  if (!db.length) { showToast('Base vide, rien à faire.', 'info'); return; }

  // Séparer lignes FG et lignes directes déjà ventilées depuis FG
  const nonFG = db.filter(l => {
    const isFG = l.isFG === true
      || l.bienName === 'Frais généraux' || l.bienName === 'Frais generaux'
      || l.bien     === 'Frais généraux' || l.bien     === 'Frais generaux';
    const isVentiled = l._ventilated === true;
    return !isFG && !isVentiled;
  });
  const fgOrig = db.filter(l => {
    const isFG = l.isFG === true
      || l.bienName === 'Frais généraux' || l.bienName === 'Frais generaux'
      || l.bien     === 'Frais généraux' || l.bien     === 'Frais generaux';
    return isFG && !l._ventilated;
  });

  if (!fgOrig.length) { showToast('Aucune ligne FG trouvée en base.', 'info'); return; }

  // Ré-appliquer _expandFG sur les lignes FG originales
  const reexpanded = _expandFG(fgOrig);

  // Reconstruire la base : lignes non-FG + lignes FG réexpansées
  const newDB = [...nonFG, ...reexpanded];

  // Trier par date
  newDB.sort((a, b) => {
    const da = new Date(a.date || 0), db2 = new Date(b.date || 0);
    return da - db2;
  });

  saveDB(newDB);

  const avant = db.length;
  const apres = newDB.length;
  showToast(`✅ Resync OK — ${fgOrig.length} lignes FG réventilées (base : ${avant} → ${apres} lignes)`, 'success');
  if (typeof renderSynTab === 'function') renderSynTab();
}

// Répare les lignes emprunt dont le montant a été écrasé par _applyRetroactively
function _swapCapInt(el) {
  const ref = el.dataset ? el.dataset.ref : el;
  if (!confirm('Inverser capital et intérêts pour "' + ref + '" ?\nCette action modifie le tableau d\'amortissement ET recalcule toutes les lignes en base.')) return;
  const p = getParams();
  const tbl = (p.loanTable || {})[ref];
  if (!tbl) { showToast('Tableau d\'amortissement introuvable pour ' + ref, 'var(--red)'); return; }
  Object.keys(tbl).forEach(ym => {
    const entry = tbl[ym];
    if (Array.isArray(entry)) tbl[ym] = [entry[1], entry[0]];
    else if (entry && typeof entry === 'object') { const tmp = entry.c; entry.c = entry.i; entry.i = tmp; }
  });
  saveParams(p);
  _repairLoanLines();
  showToast('🔄 Cap/int inversés pour ' + ref + ' — lignes recalculées');
}
function _repairLoanLinesByRef(el) {
  // Bouton par emprunt - appelle simplement la réparation globale
  _repairLoanLines();
}

function _repairLoanLines() {
  const db = getDB();
  const p  = getParams();
  if (!Object.keys(db.periods||{}).length) return;
  let fixed = 0;
  Object.values(db.periods).forEach(period => {
    (period.lines||[]).forEach(line => {
      if (!line.loanRef || !line.montantOrigine) return;
      const loanDef = LOAN_REF_MAP[line.loanRef];
      const table   = LOAN_TABLE[line.loanRef];
      if (!loanDef || !table) return;
      let ym;
      const d = line.date||'';
      // Normalise vers YYYY-MM quel que soit le format de date stocké
      if (/^\d{4}-\d{2}/.test(d)) {
        ym = d.slice(0,7); // YYYY-MM-DD ou YYYY-MM
      } else if (d.includes('/')) {
        const pts = d.split('/');
        if (pts.length === 3) {
          // DD/MM/YYYY → pts[2]=YYYY, pts[1]=MM
          // MM/D/YY (SheetJS) → pts[0]=MM, pts[1]=D, pts[2]=YY
          const y = pts[2].length === 2 ? '20'+pts[2] : pts[2];
          const m = pts[2].length === 2 ? pts[0].padStart(2,'0') : pts[1].padStart(2,'0');
          ym = y + '-' + m;
        }
      } else ym = d.slice(0,7);
      const entry = table[ym] || Object.entries(table).find(([,v])=>v&&Math.abs((v[0]+v[1])+parseFloat(line.montantOrigine||0))<0.11)?.[1];
      if (!entry) return;
      const capTotal = Array.isArray(entry)?entry[0]:entry.c;
      const intTotal = Array.isArray(entry)?entry[1]:entry.i;
      const bienIdx = loanDef.biens.indexOf(line.bienId);
      if (bienIdx < 0) return;
      const isLast = bienIdx === loanDef.biens.length - 1;
      // Recalculer avec logique "dernière part = reste" pour éviter les écarts d'arrondi
      let capDistributed = 0, intDistributed = 0;
      loanDef.biens.forEach((bid, idx) => {
        const pct = loanDef.pcts[idx];
        const last = idx === loanDef.biens.length - 1;
        const c = last ? Math.round((-capTotal - capDistributed)*100)/100 : Math.round(-capTotal*pct*100)/100;
        const i = last ? Math.round((-intTotal - intDistributed)*100)/100 : Math.round(-intTotal*pct*100)/100;
        capDistributed += c;
        intDistributed += i;
        if (idx === bienIdx) {
          if (line.cat === 'Remboursement emprunt' && Math.abs(line.montant - c) > 0.005) { line.montant = c; fixed++; }
          else if (line.cat === 'Intérêts de crédit'   && Math.abs(line.montant - i) > 0.005) { line.montant = i; fixed++; }
        }
      });
    });
  });
  if (fixed) { saveDB(db); showToast('🔧 '+fixed+' ligne(s) emprunt corrigée(s)'); if(typeof renderSynTab==='function') renderSynTab(); }
  else showToast('✓ Aucune correction nécessaire');
}

function saveParamsAndSync(p){
  saveParams(p);
  _applyRetroactively(p);
}
function _applyRetroactively(p){
  const db=getDB();
  if(!Object.keys(db.periods||{}).length)return;
  let changed=0;
  const biens=p.biens||[];
  const qp=p.qp||{};
  Object.values(db.periods).forEach(period=>{
    (period.lines||[]).forEach(line=>{
      if(line.bienId){
        const b=biens.find(b=>b.id===line.bienId);
        if(b){
          if(line.bienName!==b.name||line.sci!==b.sci){
            line.bienName=b.name; line.bienNom=b.nom;
            line.sci=b.sci; line.lot=b.lot||line.lot;
            changed++;
          }
        }
      }
      // Ne recalculer le montant QP que sur les lignes issues de ventilation FG
      // (jamais sur les lignes affectées directement à un bien)
      if(line._ventilated&&line.cat&&qp[line.cat]&&!line.sourcePlatform&&!line.loanRef&&line.bienId){
        const grp=qp[line.cat].find(g=>g.lot===line.lot);
        if(grp){
          const pct=grp.biens[line.bienId];
          if(pct!==undefined){
            const orig=line.montantOrigine||line.montant;
            const nm=Math.round(orig*pct*100)/100;
            if(Math.abs(nm-line.montant)>0.005){line.montant=nm;changed++;}
          }
        }
      }
    });
  });
  if(changed){saveDB(db);_historyIndex=null;showToast('♻ '+changed+' ligne(s) mise(s) à jour');}
}




// ── Nice scale helper — graduations arrondies pour les graphiques ──
