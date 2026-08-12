
// ── CA Ops table — tri par colonne ─────────────────────────────
function _buildCAOpsRows(rows) {
  return rows.map(l => {
    const amt = l.amt;
    return '<tr style="border-bottom:1px solid var(--border);transition:background .12s" onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'\'">'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;white-space:nowrap;font-family:monospace">'+l.dDisplay+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;word-break:break-word;line-height:1.4">'+l.bien+'</td>'+
      '<td style="padding:7px 10px;color:var(--text2);font-size:10px;word-break:break-word;line-height:1.4">'+l.cat+'</td>'+
      '<td style="padding:7px 10px;font-size:10px;color:var(--text2);word-break:break-word;line-height:1.4">'+l.lib+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:600;color:var(--green);white-space:nowrap">+'+(()=>{const _v=amt;const _a=Math.abs(_v);const _i=Math.floor(_a);const _d=Math.round((_a-_i)*100).toString().padStart(2,'0');return ((_v<0?'-':'')+String(_i).replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f')+','+_d+'\u202f€')})()+'</td>'+
    '</tr>';
  }).join('');
}

function _sortCAOps(th, col) {
  const table = document.getElementById('ca-ops-table');
  if (!table) return;
  const allTh = table.querySelectorAll('thead th[data-sort-col]');
  // Toggle direction
  const curDir = th.dataset.sortDir || '';
  const newDir = (curDir === 'asc') ? 'desc' : 'asc';
  // Reset all arrows
  allTh.forEach(h => {
    h.dataset.sortDir = '';
    const arr = h.querySelector('.sort-arrow');
    if (arr) { arr.textContent = '↕'; arr.style.opacity = '.3'; }
  });
  th.dataset.sortDir = newDir;
  const arr = th.querySelector('.sort-arrow');
  if (arr) { arr.textContent = newDir === 'asc' ? '↑' : '↓'; arr.style.opacity = '1'; }
  // Sort
  const rows = (window._caOpsLines || []).slice();
  rows.sort((a, b) => {
    let va, vb;
    if      (col === 0) { va = a.d;    vb = b.d;    return newDir==='asc' ? va.localeCompare(vb)      : vb.localeCompare(va); }
    else if (col === 1) { va = a.bien; vb = b.bien;  return newDir==='asc' ? va.localeCompare(vb,'fr') : vb.localeCompare(va,'fr'); }
    else if (col === 2) { va = a.cat;  vb = b.cat;   return newDir==='asc' ? va.localeCompare(vb,'fr') : vb.localeCompare(va,'fr'); }
    else if (col === 3) { va = a.lib;  vb = b.lib;   return newDir==='asc' ? va.localeCompare(vb,'fr') : vb.localeCompare(va,'fr'); }
    else if (col === 4) { va = a.amt;  vb = b.amt;   return newDir==='asc' ? va - vb                   : vb - va; }
    return 0;
  });
  const tbody = document.getElementById('ca-ops-body');
  if (tbody) tbody.innerHTML = _buildCAOpsRows(rows);
}


