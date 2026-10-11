// ══════════════════════════════════════════════
//  GUIDES — « Comment ça marche » des 5 modules de l'accueil
//
//  Un bouton « Guide » en haut de chaque module ouvre une fenêtre de 5 pages : une courte
//  vidéo (motion design réalisé à partir de captures du site, données fictives) et une
//  explication. Navigation : flèches, points, clavier (← → Échap), glissement du doigt sur
//  mobile. La vidéo de la page affichée se lance seule ; « Revoir » la rejoue.
//  Fichiers : img/guides/<module>-<n>.mp4 et .jpg (image d'attente).
// ══════════════════════════════════════════════

const GUIDES = {
  outils: {
    label: 'Outils', color: '#22d3c8', icon: 'settings', open: () => enterTools(),
    pages: [
      { t: 'Importez vos fichiers',
        p: 'Chaque mois, déposez l\'extraction de votre banque (Excel ou CSV). Si vous louez en courte durée, ajoutez les exports Airbnb et Booking : ARTEMIS s\'en sert pour répartir chaque virement de plateforme entre vos logements. Choisissez ensuite la période importée.' },
      { t: 'Pré-mappez automatiquement',
        p: '« Pré-mapper automatiquement » propose pour chaque ligne une catégorie, un bien, une SCI et un lot, à partir de vos mois précédents et de règles connues (loyers, énergie, assurances…). Les virements Airbnb et Booking sont rapprochés des exports au centime près. Il ne reste qu\'à vérifier.' },
      { t: 'Validez la ventilation',
        p: 'L\'écran de validation montre chaque ligne telle qu\'elle sera enregistrée, avec le bien imputé, puis une synthèse par bien : chiffre d\'affaires, charges et résultat. Les charges communes sont réparties selon vos clés de répartition.' },
      { t: 'Retrouvez votre historique',
        p: '« Enregistrer dans la base » ajoute le mois à votre historique. La Base liste toutes les périodes avec leurs revenus, leurs charges et leur résultat. Chaque mois peut être consulté, modifié ou supprimé, et la base exportée.' },
      { t: 'Paramétrez votre patrimoine',
        p: 'Les Paramètres décrivent vos SCI et vos biens (courte ou longue durée), les correspondances avec les noms Airbnb et les identifiants Booking, les quote-parts des charges communes, les emprunts et les amortissements. Chaque modification s\'applique à toute la base.' },
    ],
  },
  dashboard: {
    label: 'Dashboard', color: '#9b6ef3', icon: 'bar-chart', open: () => enterDashboard(),
    pages: [
      { t: 'La synthèse',
        p: 'La Synthèse résume vos revenus : total, moyenne par période, meilleur bien, évolution mois par mois et détail par bien. Filtrez par société, bien, période ou catégorie. Si un budget existe, le réel est comparé au prévu.' },
      { t: 'Dépenses et trésorerie',
        p: 'Les onglets Dépenses et Trésorerie suivent vos sorties d\'argent et votre solde mois par mois, avec la liste des opérations, le détail par bien et la répartition par catégorie.' },
      { t: 'Le résultat',
        p: 'L\'onglet Résultat présente vos soldes intermédiaires de gestion : produits, charges d\'exploitation, excédent brut d\'exploitation (EBE), résultat financier, jusqu\'au résultat net.' },
      { t: 'Les KPIs',
        p: 'En courte durée : taux d\'occupation, nuits louées face au point mort, durée moyenne de séjour, revenu par nuit disponible et compte de résultat en paliers. En longue durée : cash-flow après crédit, grille bien par mois et rentabilité de chaque bien.' },
      { t: 'Les plateformes',
        p: 'Comparez vos canaux : Airbnb, Booking, location directe et longue durée. Séjours, nuits, durée moyenne, revenu net par nuit et commissions payées sont calculés à partir de vos exports, rapprochés des virements bancaires.' },
    ],
  },
  marketplace: {
    label: 'Marketplace', color: '#ffb400', icon: 'store', open: () => showMarketplace(),
    pages: [
      { t: 'Les annonces',
        p: 'La Marketplace rassemble les biens que vous étudiez. Chaque annonce affiche son type, sa ville, sa surface, son prix et une note sur 10 calculée par ARTEMIS.' },
      { t: 'Déposez une annonce',
        p: 'Choisissez le type de bien, saisissez l\'adresse (proposée automatiquement pendant la frappe), le prix, la surface, le loyer attendu, et ajoutez jusqu\'à 4 photos. ARTEMIS récupère les ventes comparables du secteur (données publiques DVF).' },
      { t: 'Le score en direct',
        p: 'Un questionnaire adapté au type de bien (prix face au marché, état, emplacement, environnement…) complète le rendement brut et le DPE. La note sur 10 se met à jour à chaque réponse.' },
      { t: 'La fiche du bien',
        p: 'Chaque fiche montre l\'emplacement sur une carte satellite, le prix comparé au marché du secteur et les caractéristiques du bien. Un dossier PDF complet peut être téléchargé pour le partager.' },
      { t: 'Le détail du score',
        p: 'Le score est détaillé critère par critère, avec son poids, puis résumé dans une analyse écrite : niveau du rendement, écart au prix du marché, point fort et point de vigilance.' },
    ],
  },
  simulateur: {
    label: 'Simulateur', color: '#34d399', icon: 'calculator', open: () => showSimulateur(),
    pages: [
      { t: 'Décrivez le projet',
        p: 'Renseignez le prix, les frais, les travaux, le financement, les loyers et les charges. L\'aperçu à droite calcule en direct le coût total, la mensualité et la règle des 70 %. « Exemple du classeur » remplit un cas type.' },
      { t: 'Réglez l\'amortissement',
        p: 'En LMNP, en LMP et en société à l\'IS, le bien s\'amortit par composants : gros œuvre, toiture, agencements, électricité, étanchéité. Leurs parts et leurs durées sont modifiables. Le terrain n\'est jamais amorti.' },
      { t: 'Comparez les régimes',
        p: '« Calculer » compare 7 régimes fiscaux : LMNP réel et micro-BIC, LMP, revenus fonciers réel et micro-foncier, société à l\'IS avec ou sans distribution. Cash-flow cumulé, impôts, rendement, VAN, TRI et délai de récupération : les calculs reprennent les formules du classeur Excel.' },
      { t: 'Comprenez les résultats',
        p: 'La lecture des résultats explique d\'où vient le cash-flow, ce que mesurent la VAN et le TRI, la fiscalité du régime choisi et les points d\'attention. Elle propose ensuite des leviers d\'amélioration, recalculés sur votre simulation.' },
      { t: 'Le détail année par année',
        p: '« Voir le détail » ouvre un régime : chiffres clés, cash-flow de chaque année, tableaux de résultat, d\'impôt et d\'emprunt. Enregistrez vos simulations pour les retrouver dans « Mes simulations ».' },
    ],
  },
  budget: {
    label: 'Budget', color: '#4f9eff', icon: 'target', open: () => showBudget('home'),
    pages: [
      { t: 'Créez un budget',
        p: 'Créez une version de budget pour une année : à partir du réel d\'une année passée, avec un ajustement en % sur les produits et sur les charges, en copiant une autre version, ou en partant de zéro.' },
      { t: 'Ajustez les montants',
        p: 'Le budget se règle par bien et par catégorie, mois par mois, à côté du réel de l\'année de référence. Un total annuel saisi est réparti automatiquement sur les mois.' },
      { t: 'Fixez vos objectifs de courte durée',
        p: 'Pour chaque logement en courte durée, fixez un nombre de nuits et un prix moyen par nuit. ARTEMIS en déduit le taux d\'occupation et le chiffre d\'affaires d\'hébergement visés, comparés ensuite à vos KPIs.' },
      { t: 'Réel contre budget',
        p: 'L\'onglet Budget du dashboard compare chaque mois le réel importé au budget : chiffre d\'affaires, charges, résultat et cash-flow, avec les écarts en euros et en %. Les autres onglets affichent aussi leur écart au budget.' },
      { t: 'L\'atterrissage de fin d\'année',
        p: 'L\'atterrissage additionne le réel des mois importés et le budget des mois restants pour estimer votre fin d\'année, poste par poste. Le détail des écarts montre où vous êtes en avance ou en retard.' },
    ],
  },
};

const GD_ICON = {
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
};
const gdSvg = (n, s) => `<svg width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GD_ICON[n]}</svg>`;

let _gd = { key: null, i: 0, lastFocus: null, x0: null };

function openGuide(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const g = GUIDES[key]; if (!g) return;
  _gd = { key, i: 0, lastFocus: document.activeElement, x0: null };
  let ov = document.getElementById('gd-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'gd-overlay'; ov.className = 'gd-overlay';
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeGuide(); });
    document.body.appendChild(ov);
  }
  ov.style.setProperty('--gd', g.color);
  ov.innerHTML = `
    <div class="gd-dialog" role="dialog" aria-modal="true" aria-labelledby="gd-title">
      <div class="gd-head">
        <h2 id="gd-title"><span class="gd-mark"></span>Comment fonctionne ${escHtml(g.label)}</h2>
        <span class="gd-count" id="gd-count" aria-live="polite"></span>
        <button class="gd-close" type="button" onclick="closeGuide()" aria-label="Fermer le guide">${gdSvg('x', 18)}</button>
      </div>
      <div class="gd-viewport" id="gd-viewport">
        <div class="gd-track" id="gd-track">
          ${g.pages.map((pg, i) => `
            <section class="gd-slide" aria-roledescription="page" aria-label="Page ${i + 1} sur ${g.pages.length}">
              <figure class="gd-fig">
                <video muted playsinline preload="none" poster="img/guides/${key}-${i + 1}.jpg" aria-label="${escHtml(pg.t)} : démonstration en vidéo" onended="this.parentNode.classList.add('ended')">
                  <source src="img/guides/${key}-${i + 1}.mp4" type="video/mp4"></video>
                <button class="gd-replay" type="button" onclick="guidePlay(this.parentNode.querySelector('video'))">${gdSvg('replay', 16)}Revoir</button>
              </figure>
              <div class="gd-text"><h3>${escHtml(pg.t)}</h3><p>${escHtml(pg.p)}</p></div>
            </section>`).join('')}
        </div>
      </div>
      <div class="gd-foot">
        <button class="gd-btn gd-prev" type="button" id="gd-prev" onclick="guideGo(_gd.i - 1)">${gdSvg('chevron-left', 16)}Précédent</button>
        <div class="gd-dots" role="tablist" aria-label="Pages du guide">
          ${g.pages.map((pg, i) => `<button type="button" role="tab" class="gd-dot" onclick="guideGo(${i})" aria-label="Page ${i + 1} : ${escHtml(pg.t)}"></button>`).join('')}
        </div>
        <button class="gd-btn gd-next" type="button" id="gd-next" onclick="guideNext()"></button>
      </div>
    </div>`;
  const vp = ov.querySelector('#gd-viewport');
  vp.addEventListener('touchstart', e => { _gd.x0 = e.touches[0].clientX; }, { passive: true });
  vp.addEventListener('touchend', e => {
    if (_gd.x0 == null) return;
    const dx = e.changedTouches[0].clientX - _gd.x0; _gd.x0 = null;
    if (Math.abs(dx) > 50) guideGo(_gd.i + (dx < 0 ? 1 : -1));
  });
  document.addEventListener('keydown', _guideKeys);
  document.documentElement.classList.add('gd-lock');
  ov.classList.add('open');
  guideGo(0, true);
  requestAnimationFrame(() => { const n = document.getElementById('gd-next'); if (n) n.focus(); });
}

function guideGo(i, instant) {
  const g = GUIDES[_gd.key]; if (!g) return;
  const n = g.pages.length;
  _gd.i = Math.max(0, Math.min(n - 1, i));
  const track = document.getElementById('gd-track');
  if (track) { track.style.transition = instant ? 'none' : ''; track.style.transform = `translateX(${-_gd.i * 100}%)`; }
  document.querySelectorAll('#gd-track .gd-slide').forEach((s, k) => { s.setAttribute('aria-hidden', k !== _gd.i); s.inert = k !== _gd.i; });
  document.querySelectorAll('.gd-dot').forEach((d, k) => { d.classList.toggle('on', k === _gd.i); d.setAttribute('aria-selected', k === _gd.i); });
  document.querySelectorAll('#gd-track video').forEach((v, k) => {
    if (k === _gd.i) guidePlay(v);
    else { v.pause(); if (k === _gd.i + 1) v.preload = 'auto'; }
  });
  document.getElementById('gd-count').textContent = `${_gd.i + 1} / ${n}`;
  const prev = document.getElementById('gd-prev');
  prev.disabled = _gd.i === 0;
  document.getElementById('gd-next').innerHTML = _gd.i === n - 1
    ? `Ouvrir ${escHtml(g.label)}${gdSvg('arrow-right', 16)}`
    : `Suivant${gdSvg('chevron-right', 16)}`;
}

function guidePlay(v) {
  if (!v) return;
  v.parentNode.classList.remove('ended');
  v.preload = 'auto';
  try { v.currentTime = 0; } catch (e) {}
  const p = v.play(); if (p && p.catch) p.catch(() => {});
}

function guideNext() {
  const g = GUIDES[_gd.key]; if (!g) return;
  if (_gd.i < g.pages.length - 1) return guideGo(_gd.i + 1);
  const open = g.open;
  closeGuide(true);
  open();
}

function closeGuide(skipFocus) {
  const ov = document.getElementById('gd-overlay');
  if (ov) { ov.querySelectorAll('video').forEach(v => v.pause()); ov.classList.remove('open'); ov.innerHTML = ''; }
  document.removeEventListener('keydown', _guideKeys);
  document.documentElement.classList.remove('gd-lock');
  if (!skipFocus && _gd.lastFocus && _gd.lastFocus.focus) _gd.lastFocus.focus();
  _gd.key = null;
}

function _guideKeys(e) {
  if (!_gd.key) return;
  if (e.key === 'Escape') { e.preventDefault(); closeGuide(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); guideGo(_gd.i + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); guideGo(_gd.i - 1); }
  else if (e.key === 'Tab') {   // garder le focus dans la fenêtre
    const f = [...document.querySelectorAll('#gd-overlay button:not([disabled])')].filter(b => !b.closest('[inert]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

// Bouton « Guide » en haut de chaque module (à côté du nom du module : zone jamais redessinée)
function guideButtons() {
  const place = (key, anchor, where) => {
    if (!anchor || anchor.querySelector(':scope > .gd-pill') || (anchor.parentNode && anchor.parentNode.querySelector(':scope > .gd-pill'))) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gd-pill';
    b.style.setProperty('--gd', GUIDES[key].color);
    b.setAttribute('aria-label', 'Guide : comment fonctionne ' + GUIDES[key].label);
    b.innerHTML = gdSvg('help', 14) + '<span>Guide</span>';
    b.addEventListener('click', e => openGuide(key, e));
    if (where === 'before') anchor.parentNode.insertBefore(b, anchor); else anchor.appendChild(b);
  };
  document.querySelectorAll('.app > header .logo').forEach(a => place('outils', a));
  document.querySelectorAll('button[onclick="exportDashboardExcel()"]').forEach(a => place('dashboard', a, 'before'));
  place('marketplace', document.querySelector('#marketplaceScreen .mkt-topbar > div'));
  place('simulateur', document.querySelector('#sim-topbar > div'));
  place('budget', document.querySelector('#bud-topbar > div'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guideButtons); else guideButtons();
