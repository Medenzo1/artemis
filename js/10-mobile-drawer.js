
// ══ DASHBOARD MOBILE DRAWER ══
function openDashDrawer() {
  document.getElementById('dash-drawer').classList.add('open');
  document.getElementById('dash-drawer-overlay').classList.add('open');
  _syncMirrorSelects();
}
function closeDashDrawer() {
  document.getElementById('dash-drawer').classList.remove('open');
  document.getElementById('dash-drawer-overlay').classList.remove('open');
}
function dashDrawerTab(btn) {
  const tab = btn.dataset.tab;
  // Visual state in drawer
  document.querySelectorAll('.ddrawer-tab').forEach(b => {
    b.classList.remove('active');
    const arr = b.querySelector('.ddrawer-tab-arrow');
    if (arr) arr.textContent = '›';
  });
  document.querySelectorAll('.ddrawer-subs').forEach(d => d.classList.remove('open'));
  btn.classList.add('active');
  const arr = btn.querySelector('.ddrawer-tab-arrow');
  if (arr) arr.textContent = '▾';
  const subs = document.getElementById('ddrawer-subs-' + tab);
  if (subs) subs.classList.add('open');
  // Update FAB label
  const label = btn.querySelector('.ddrawer-tab-label').textContent;
  const fabLabel = document.getElementById('dash-fab-label');
  if (fabLabel) fabLabel.textContent = label;
  // Switch panel DIRECTLY — no need for desktop button
  _dashTab = tab;
  document.querySelectorAll('.dash-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('dp-' + tab);
  if (panel) panel.style.display = 'block';
  _renderDashTab();
  // If no sub-items, close immediately
  if (!['synthese','kpis'].includes(tab)) setTimeout(closeDashDrawer, 180);
}
function dashDrawerSub(btn, group) {
  document.querySelectorAll('#ddrawer-subs-' + group + ' .ddrawer-sub').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Switch sub tab directly
  _synTab = btn.dataset.stab;
  try { _adjustSynFilters(); } catch(e) {}
  try { renderSynTab(); } catch(e) {}
  setTimeout(closeDashDrawer, 150);
}
function _syncMirrorSelects() {
  const pairs = [
    ['bil-year','m-bil-year'],['bil-sci','m-bil-sci'],
    ['res-year','m-res-year'],['res-sci','m-res-sci'],
    ['kpi-year','m-kpi-year'],['kpi-bien','m-kpi-bien'],
    ['plt-year','m-plt-year'],
  ];
  pairs.forEach(([realId, mirrorId]) => {
    const real = document.getElementById(realId);
    const mirror = document.getElementById(mirrorId);
    if (!real || !mirror) return;
    mirror.innerHTML = real.innerHTML;
    mirror.value = real.value;
  });
}

