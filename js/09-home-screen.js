// ════════════════════════════════════════════
//  HOME SCREEN
// ════════════════════════════════════════════


// Scroll animations for home
function _initHomeScroll() {
  const hs = document.getElementById('homeScreen');
  if (!hs) return;

  const topbar = document.getElementById('home-topbar');
  hs.addEventListener('scroll', () => {
    if (topbar) topbar.classList.toggle('scrolled', hs.scrollTop > 60);
    _checkHomeReveal(hs);
  });

  // Sections always visible — scroll animation is a progressive enhancement only
  setTimeout(() => {
    // Never hide sections: just mark them visible immediately
    document.querySelectorAll('.h-section').forEach(el => {
      el.classList.add('anim', 'visible');
    });
    document.querySelectorAll('.h-kpi-item').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.1) + 's';
      el.classList.add('anim', 'visible');
    });
  }, 50);
}

function _checkHomeReveal(hs) {
  const hsRect = hs.getBoundingClientRect();
  document.querySelectorAll('.h-section.anim:not(.visible)').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < hsRect.bottom - 80) el.classList.add('visible');
  });
}

// showMarketplace()/exitMarketplace() : voir js/14-marketplace.js

function showHome() {
  const ls  = document.getElementById('loginScreen');
  const hs  = document.getElementById('homeScreen');
  const sb  = document.getElementById('sidebar');
  const app = document.querySelector('.app');
  if (ls)  ls.style.display  = 'none';
  if (hs)  hs.style.display  = 'block';
  if (sb)  sb.style.display  = 'none';
  if (app) app.style.display = 'none';
  // Deactivate all tool screens and hide header/stepper
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const hdr = document.querySelector('header');
  const stp = document.getElementById('stepper');
  if (hdr) hdr.style.display = 'none';
  if (stp) stp.style.display = 'none';
  document.body.classList.remove('dash-mode');
  window._homeCanvasStop = false;
  const hcv = document.getElementById('homeCanvas');
  if (hcv) hcv.style.display = 'block';
  try { _startHomeCanvas(); }   catch(e) {}
  try { _renderHomeKpis(); }     catch(e) {}
  try { _renderHomeKpis(); }    catch(e) {}
  try { _initHomeDate(); }      catch(e) {}
  try { _initHomeQuote(); }     catch(e) {}
  try { _renderHomeMedia(); } catch(e) { console.warn('media err',e); }
  try { _initHomeScroll(); }  catch(e) {}
}

function enterTools() {
  document.getElementById('homeScreen').style.display = 'none';
  const hc = document.getElementById('homeCanvas');
  if (hc) hc.style.display = 'none';
  window._homeCanvasStop = true;
  document.getElementById('sidebar').style.display = '';
  document.querySelector('.app').style.display = '';
  // Restore header
  const hdr = document.querySelector('header');
  if (hdr) hdr.style.display = '';
  setTimeout(() => { navTo(1); renderRecentActivity(); }, 0);
}

// exitDashboard goes back home (not to tools)
function exitDashboard(targetScreen) {
  document.body.classList.remove('dash-mode');
  document.getElementById('sc6').classList.remove('active');
  if (targetScreen) {
    enterTools();
    setTimeout(() => navTo(targetScreen), 50);
  } else {
    showHome();
  }
}

// Add a ← Accueil button in tools sidebar nav (for going back home from tools)
function _initHomeBackBtn() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || document.getElementById('nav-home')) return;
  const btn = document.createElement('div');
  btn.id = 'nav-home';
  btn.className = 'sb-item';
  btn.setAttribute('tabindex','0');
  btn.style.cssText = 'color:rgba(34,211,200,.6);margin-top:auto';
  btn.innerHTML = '<span class="sb-icon">🏠</span><span class="sb-label">Accueil</span>';
  btn.onclick = () => {
    // Deactivate all nav items
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    enterTools._fromHome = false;
    showHome();
  };
  // Insert before the last sep+logout
  const seps = sidebar.querySelectorAll('.sb-sep');
  const lastSep = seps.length ? seps[seps.length - 1] : null;
  if (lastSep) sidebar.insertBefore(btn, lastSep); else sidebar.appendChild(btn);
}

function _renderHomeKpis() {
  var el = document.getElementById('home-kpis');
  if (!el) return;
  var db = getDB();
  var periods = Object.values(db.periods || {}).sort(function(a,b){return a.period.localeCompare(b.period);});
  var caPM={}, depPM={}, soldePM={};
  periods.forEach(function(p) {
    var l=p.lines||[];
    caPM[p.period]   =l.filter(function(x){return _isCA(x);}).reduce(function(s,x){return s+(+x.montant);},0);
    depPM[p.period]  =l.filter(function(x){return _isDep(x);}).reduce(function(s,x){return s+(+x.montant);},0);
    soldePM[p.period]=l.reduce(function(s,x){return s+(+x.montant);},0);
  });
  var keys=Object.keys(caPM).sort(), last=keys.length?keys[keys.length-1]:null;
  var ca=last?caPM[last]:0, dep=last?Math.abs(depPM[last]):0, sol=last?soldePM[last]:0;
  var sub=periods.length?periods.length+' p\u00e9riode'+(periods.length>1?'s':''):'';
  var fmt=function(n){return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);};
  var caSpark=keys.map(function(k){return caPM[k];});
  var depSpark=keys.map(function(k){return Math.abs(depPM[k]||0);});
  var solSpark=keys.map(function(k){return soldePM[k];});
  // depPM garde le signe d'origine (n\u00e9gatif) pour les autres \u00e9crans, mais "dep" ci-dessus
  // est affich\u00e9 en valeur absolue : il faut comparer M-1 sur la m\u00eame base, sinon l'\u00e9cart
  // calcul\u00e9 (positif - n\u00e9gatif) est artificiellement gonfl\u00e9.
  var depAbsPM={}; keys.forEach(function(k){ depAbsPM[k]=Math.abs(depPM[k]||0); });
  el.innerHTML =
    _kpiCard('CA', "Chiffre d'affaires", periods.length?fmt(ca):'\u2014', 'var(--green)', '', _varBadges(ca,last,caPM,true), caSpark) +
    _kpiCard('DE', 'Charges totales', periods.length?'-'+fmt(dep):'\u2014', 'var(--red)', '', _varBadges(dep,last,depAbsPM,false), depSpark) +
    _kpiCard('TR', 'Solde net', periods.length?(sol>=0?'+':'')+fmt(sol):'\u2014', sol>=0?'var(--cyan)':'var(--red)', '', _varBadges(sol,last,soldePM,true), solSpark);
}

function _startHomeCanvas() {
  const cv = document.getElementById('homeCanvas');
  if (!cv || cv._running) return;
  cv._running = true;
  const cx = cv.getContext('2d');
  let W, H, pts = [], orbs = [];

  function resize() {
    W = cv.width  = innerWidth;
    H = cv.height = innerHeight;
    pts  = Array.from({length: 160}, mkPt);
    orbs = [
      { x: W * .75, y: H * .12, r: Math.min(W,H) * .22, c: '34,211,200' },
      { x: W * .18, y: H * .78, r: Math.min(W,H) * .18, c: '155,110,243' },
      { x: W * .88, y: H * .70, r: Math.min(W,H) * .13, c: '34,211,200' },
    ];
  }

  function mkPt() {
    return { x: Math.random()*W, y: Math.random()*H,
             r: Math.random()*.8+.1, a: Math.random()*.5+.1,
             vx: (Math.random()-.5)*.18, vy: (Math.random()-.5)*.18 };
  }

  let t = 0, raf;
  function draw() {
    if (document.getElementById('homeScreen').style.display === 'none') {
      cv._running = false; return;
    }
    t += .004;
    cx.clearRect(0, 0, W, H);

    // Deep background gradient
    const bg = cx.createRadialGradient(W*.5, H*.5, 0, W*.5, H*.5, Math.max(W,H)*.7);
    bg.addColorStop(0,   'rgba(8,14,26,1)');
    bg.addColorStop(1,   'rgba(4,6,12,1)');
    cx.fillStyle = bg;
    cx.fillRect(0, 0, W, H);

    // Grid
    cx.strokeStyle = 'rgba(0,150,220,.018)'; cx.lineWidth = .5;
    for (let x = 0; x < W; x += 60) { cx.beginPath(); cx.moveTo(x,0); cx.lineTo(x,H); cx.stroke(); }
    for (let y = 0; y < H; y += 60) { cx.beginPath(); cx.moveTo(0,y); cx.lineTo(W,y); cx.stroke(); }

    // Glowing orbs
    orbs.forEach((o, i) => {
      const pulse = 1 + .08 * Math.sin(t * 1.2 + i * 2.1);
      const radius = o.r * pulse;
      if (!radius || radius <= 0) return;
      const g = cx.createRadialGradient(o.x, o.y, 0, o.x, o.y, radius);
      g.addColorStop(0,   `rgba(${o.c},.18)`);
      g.addColorStop(.4,  `rgba(${o.c},.06)`);
      g.addColorStop(1,   `rgba(${o.c},0)`);
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(o.x, o.y, o.r * pulse, 0, 6.28); cx.fill();
    });

    // Stars
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      cx.globalAlpha = p.a * (.4 + .6 * Math.sin(t * 1.8 + p.x * .01));
      cx.fillStyle = '#a0d8ff';
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill();
    });
    cx.globalAlpha = 1;

    // Scan line
    const scanY = (H * (.3 + .7 * ((t * .08) % 1)));
    const sg = cx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    sg.addColorStop(0,   'rgba(34,211,200,0)');
    sg.addColorStop(.5,  'rgba(34,211,200,.04)');
    sg.addColorStop(1,   'rgba(34,211,200,0)');
    cx.fillStyle = sg; cx.fillRect(0, scanY - 60, W, 120);

    raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}



// ════════════════════════════════════════════
//  HOME - QUOTES + NEWS (Claude-powered)
// ════════════════════════════════════════════

// _initHomeQuote defined above

function _initHomeDate() {
  const el = document.getElementById('home-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}


// Override showHome to also init quote/date/news






// ════════════════════════════════════════════
//  HOME NEWS - Contenu éditorialisé statique
//  Rotatif à chaque visite, 0 réseau, 0 frais
// ════════════════════════════════════════════



// ════════════════════════════════════════════
//  HOME - LIENS MÉDIAS (vrais sources, 0 API)
// ════════════════════════════════════════════


