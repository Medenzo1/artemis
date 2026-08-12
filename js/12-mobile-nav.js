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

    case 'tools':
      if (typeof enterTools === 'function') {
        enterTools();
      }
      // Make sure app is visible
      const appEl = document.querySelector('.app');
      const homeEl = document.getElementById('homeScreen');
      if (appEl) appEl.style.display = '';
      if (homeEl) homeEl.style.display = 'none';
      // Navigate to first tools screen (sc1)
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const sc1 = document.getElementById('sc1');
      if (sc1) sc1.classList.add('active');
      break;

    case 'dash':
      if (typeof enterDash === 'function') {
        enterDash();
      } else {
        // Fallback: activate dashboard screen
        const appElD = document.querySelector('.app');
        const homeElD = document.getElementById('homeScreen');
        if (appElD) appElD.style.display = '';
        if (homeElD) homeElD.style.display = 'none';
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const sc6 = document.getElementById('sc6');
        if (sc6) sc6.classList.add('active');
        // Also activate dash mode if available
        document.body.classList.add('dash-mode');
      }
      break;

    case 'params':
      // Navigate to params screen (sc5)
      const appElP = document.querySelector('.app');
      const homeElP = document.getElementById('homeScreen');
      if (appElP) appElP.style.display = '';
      if (homeElP) homeElP.style.display = 'none';
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const sc5 = document.getElementById('sc5');
      if (sc5) sc5.classList.add('active');
      // Remove dash-mode if active
      document.body.classList.remove('dash-mode');
      break;
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

  // Determine which section was clicked
  const icon = sbItem.querySelector('.sb-icon');
  if (!icon) return;
  const iconText = icon.textContent.trim();

  // Map icons to nav sections
  const iconMap = {
    '🏠': 'home',
    '📥': 'tools',
    '🗺️': 'tools',
    '✅': 'tools',
    '🗃️': 'tools',
    '📊': 'dash',
    '⚙️': 'params',
    '🔧': 'params',
  };
  const section = iconMap[iconText];
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
