// ─── Détection mobile ───────────────────────────────────────
function isMobile() {
  return window.innerWidth <= 768;
}

// ─── Navigation mobile bottom bar ───────────────────────────
function mobileNav(section) {
  if (!isMobile()) return;

  // Update active state on nav items
  document.querySelectorAll('.mn-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.getElementById('mn-' + section);
  if (activeEl) activeEl.classList.add('active');

  // Route to the correct section
  switch(section) {
    case 'home':
      // Go to home screen
      if (typeof showHome === 'function') {
        showHome();
      } else if (typeof enterHome === 'function') {
        enterHome();
      } else {
        // Fallback: show homeScreen
        const hs = document.getElementById('homeScreen');
        const mc = document.getElementById('mainContent');
        if (hs && mc) {
          mc.style.display = 'flex';
          hs.style.display = 'block';
          // hide sidebar app
          const app = document.querySelector('.app');
          if (app) app.style.display = 'none';
        }
      }
      break;

    // Mêmes chemins que la barre latérale sur ordinateur : chaque écran est rendu, titre compris
    case 'tools':
      if (typeof enterTools === 'function') enterTools();
      break;

    case 'dash':
      if (typeof enterDashboard === 'function') enterDashboard();
      break;

    case 'params': {
      if (typeof enterTools === 'function') enterTools();
      // enterTools() ouvre Import au tick suivant : on passe aux Paramètres juste après
      setTimeout(() => {
        const p = document.getElementById('nav-params');
        if (p) p.click(); else if (typeof navTo === 'function') navTo(5);
      }, 0);
      break;
    }
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Sync bottom nav with sidebar state ─────────────────────
// Observe sidebar item clicks to keep bottom nav in sync
document.addEventListener('click', function(e) {
  if (!isMobile()) return;
  const sbItem = e.target.closest('.sb-item');
  if (!sbItem) return;

  // Section déduite de l'identifiant de l'entrée (les icônes sont des SVG, plus des emojis)
  const idMap = {
    'nav-home': 'home',
    'nav-import': 'tools', 'nav-mapping': 'tools', 'nav-validation': 'tools', 'nav-base': 'tools',
    'nav-params': 'params', 'nav-loans': 'params', 'nav-lcd': 'params', 'nav-amort': 'params',
  };
  const section = idMap[sbItem.id];
  if (section) {
    document.querySelectorAll('.mn-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById('mn-' + section);
    if (activeEl) activeEl.classList.add('active');
  }
});

// ─── Init: set initial bottom nav state based on visible screen ─
document.addEventListener('DOMContentLoaded', function() {
  // The active tab reflects wherever the app starts
  // Default to home
  const activeItem = document.getElementById('mn-home');
  if (activeItem) activeItem.classList.add('active');
});

// ─── Onglet actif de la barre du bas = écran réellement affiché ─
// (les entrées se font aussi depuis l'accueil, la sidebar ou le code, pas seulement via mobileNav)
(function () {
  const setActive = s => document.querySelectorAll('.mn-item').forEach(el => el.classList.toggle('active', el.id === 'mn-' + s));
  const wrap = (fn, section) => {
    const orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () { const r = orig.apply(this, arguments); setActive(typeof section === 'function' ? section.apply(this, arguments) : section); return r; };
  };
  wrap('showHome', 'home');
  wrap('enterTools', 'tools');
  wrap('enterDashboard', 'dash');
  wrap('navTo', n => (n >= 5 ? 'params' : 'tools'));
})();
