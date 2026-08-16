var HOME_QUOTES = [
  { text: "L'immobilier ne perd jamais sa valeur - si vous l'avez acheté au bon prix.", author: "Warren Buffett" },
  { text: "Ne pas investir, c'est prendre le risque le plus grand qui soit.", author: "Peter Lynch" },
  { text: "L'immobilier est le seul investissement que vous pouvez habiter.", author: "Louis Glickman" },
  { text: "Le temps dans le marché bat le timing du marché.", author: "Ken Fisher" },
  { text: "Acheter de la terre - ils n'en fabriquent plus.", author: "Mark Twain" },
  { text: "La richesse se bâtit en achetant ce que les autres vendent par peur.", author: "Baron Rothschild" },
  { text: "L'investissement le plus sûr est celui que vous comprenez.", author: "Benjamin Graham" },
  { text: "Le bien immobilier est l'actif le plus sûr pour traverser l'inflation.", author: "Robert Kiyosaki" },
  { text: "Ne cherchez pas la perfection, cherchez le progrès.", author: "Winston Churchill" },
  { text: "La diversification est la seule gratuité en finance.", author: "John Bogle" }
];

function _initHomeQuote() {
  const el = document.getElementById('home-quote');
  if (!el) return;
  const q = HOME_QUOTES[Math.floor(Math.random() * HOME_QUOTES.length)];
  el.innerHTML = '<div style="font-family:\'DM Serif Display\',serif;font-size:clamp(24px,3.5vw,42px);font-style:italic;color:rgba(234,240,255,.9);line-height:1.45;margin-bottom:20px">&ldquo;' + q.text + '&rdquo;</div><div style="font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#4a6080">&mdash;&nbsp;' + q.author + '</div>';
}

function _initHomeDate() {
  const el = document.getElementById('home-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

var HOME_MEDIA = [
  { tag:"Taux crédit", color:"#22d3c8",
    title:"Taux immobiliers août 2026 : 3,10 % sur 20 ans, légère détente estivale",
    summary:"La BCE a maintenu ses taux inchangés le 23 juillet. Les banques affichent 3,10 % sur 20 ans en taux moyen, avec les meilleurs profils à 3,00 %. Une légère remontée est attendue à la rentrée selon les experts, en lien avec la tension sur l'OAT français.",
    url:"https://www.immobilier-danger.com/taux-immobilier-aout-2026.html", date:"1 août 2026" },
  { tag:"Marché immobilier", color:"#f5b731",
    title:"Immobilier août 2026 : reprise prudente, +157 000 chantiers au 1er semestre",
    summary:"Le marché de l'ancien se stabilise après deux ans de baisse. Plus de 157 000 logements mis en chantier au 1er semestre 2026, signe d'une reprise du neuf. Les prix reculent encore dans certaines villes comme Nantes (-7,9 % sur 2 ans) mais résistent dans les villes moyennes.",
    url:"https://www.medicis-patrimoine.com/actualites-immobilier-neuf/2026/08.html", date:"3 août 2026" },
  { tag:"LCD / Airbnb", color:"#9b6ef3",
    title:"Loi Le Meur : enregistrement national obligatoire depuis le 20 mai 2026",
    summary:"Depuis le 20 mai 2026, tout meublé de tourisme doit être enregistré sur le téléservice national (règlement UE 2024/1028). Plafond abaissé à 90 jours dans les zones tendues, micro-BIC réduit à 30 %, DPE G interdit à la location. Amendes jusqu'à 50 000 €.",
    url:"https://blog.checkmyguest.fr/blog/reglementation-airbnb-2026-ce-qui-change-pour-les-proprietaires-en-france", date:"4 juin 2026" },
  { tag:"Fiscalité LMNP", color:"#22d3c8",
    title:"LMNP 2026 : micro-BIC à 30 % pour les non classés, classement quasi obligatoire",
    summary:"La loi Le Meur a réduit l'abattement micro-BIC des meublés non classés de 50 % à 30 %, plafond 15 000 €. Pour un bien générant plus de 20 000 €/an, le classement meublé de tourisme (150-300 €, valable 5 ans) devient indispensable pour préserver la rentabilité fiscale.",
    url:"https://rield-rm.com/reglementation-airbnb-2026/", date:"13 avr. 2026" },
  { tag:"SCI & Patrimoine", color:"#f5b731",
    title:"SCI à l'IS vs LMNP : l'arbitrage bascule avec la réforme des plus-values 2025",
    summary:"La réintégration des amortissements dans le calcul de la plus-value LMNP (réforme 2025) redonne de l'attrait à la SCI à l'IS pour les patrimoines multi-biens avec revente à moyen terme. Pour 1 à 2 biens sans revente prévue, le LMNP réel reste avantageux.",
    url:"https://www.hagnere-patrimoine.fr/guides-patrimoine/investissement-immobilier/location-courte-duree-airbnb", date:"10 mai 2026" },
  { tag:"Investissement", color:"#9b6ef3",
    title:"Villes moyennes été 2026 : Limoges, Vendée, Hyères — où investir sans se tromper",
    summary:"Limoges affiche 1 654 €/m² avec une demande portée par 18 000 étudiants. Hyères voit ses prix grimper de 3,2 % en un an. La Vendée et la Charente-Maritime offrent encore des opportunités sous 2 500 €/m² à deux pas des plages — des marchés à surveiller avant la rentrée.",
    url:"https://www.pap.fr/actualites", date:"5 août 2026" }
];

function _renderHomeMedia() {
  const grid = document.getElementById('home-media-grid');
  if (!grid) return;
  grid.innerHTML = HOME_MEDIA.map(n => {
    return `<div class="news-card" onclick="window.open('${n.url}','_blank')" title="Lire l'article">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span class="news-tag" style="background:${n.color}18;color:${n.color};border:1px solid ${n.color}30;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px">${n.tag}</span>
        <span style="font-size:10px;color:#2a3a50;transition:color .2s" onmouseover="this.style.color='#22d3c8'" onmouseout="this.style.color='#2a3a50'">↗ Lire</span>
      </div>
      <div class="news-title" style="font-size:13px;font-weight:600;color:#eaf0ff;line-height:1.45;margin:6px 0 4px">${n.title}</div>
      <div class="news-summary" style="font-size:11px;color:rgba(200,216,240,.45);line-height:1.6;flex:1">${n.summary}</div>
      ${n.date ? `<div style="font-size:10px;color:#2a3a50;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.05)">${n.date}</div>` : ''}
    </div>`;
  }).join('');
}





let _pickerYear = new Date().getFullYear();
let _pickerMonth = new Date().getMonth() + 1;
const MONTH_NAMES=['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTH_FULL=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];


Object.defineProperty(window,'BIENS',         {get:()=>BIENS_LIVE,          configurable:true});
Object.defineProperty(window,'SCIS',          {get:()=>SCIS_LIVE,           configurable:true});
Object.defineProperty(window,'LOTS',          {get:()=>LOTS_LIVE,           configurable:true});
Object.defineProperty(window,'AIRBNB_MAP',    {get:()=>AIRBNB_MAP_LIVE,     configurable:true});
Object.defineProperty(window,'BOOKING_ID_MAP',{get:()=>BOOKING_ID_MAP_LIVE, configurable:true});
Object.defineProperty(window,'QP',            {get:()=>QP_LIVE,             configurable:true});
Object.defineProperty(window,'LOAN_REF_MAP',  {get:()=>LOAN_REF_MAP_LIVE,   configurable:true});
Object.defineProperty(window,'LOAN_TABLE',    {get:()=>LOAN_TABLE_LIVE,     configurable:true});
Object.defineProperty(window,'BIENS_NOMS',    {get:()=>['Frais generaux',...BIENS_LIVE.map(b=>b.nom)], configurable:true});



const CATS = ['Airbnb','Booking','Stripe','Location directe','Loyer mensuel','Vente additionnelle',
'Consulting','Autres prestations','Revenus annexes','Intérêts reçus','Dividendes','Plus-values','Cash-out',
'Remboursements divers','Régularisations','Autres produits exceptionnels',
'Matériel divers','Consommables','Réparations mineures','Petit outillage','Ménage','Prestataires divers',
'Expert-comptable','Publicité','Réseaux sociaux','Transport','Restauration pro','Hôtels',
'Formations en ligne','Séminaires','Abonnements plateformes','Abonnements internet',
'Assurance habitation','Assurance RC pro','Assurance diverse','Assurance emprunt',
'Frais bancaires','Électricité - Juliette Drouet','Eau','Gaz - Juliette Drouet',
'Électricité - Le Blosne','Gaz - Le Blosne','Taxe foncière',"Taxe d'habitation",
'Autres taxes','Charge copro','Courses','Restaurants','Loisirs','Voyages',
'Virements vers compte perso','Frais divers','Intérêts de crédit','IS',
'Pénalités diverses','Amendes','Immobilisation - Travaux','Immobilisation - Rénovations','Immobilisation - Mobilier','Immobilisation - Acquisition',
'Immobilisation - Informatique','Immobilisation - Équipements','Immobilisation - Notaire','Dépôt de garantie (location)',
'Caution Airbnb / plateforme','Autres cautions','Remboursement emprunt',
'Encaissement emprunt','Commission Airbnb','Commission Booking','Commission plateformes',
'Autres commissions','CCA apport','CCA remboursé','Versement emprunt','Amortissement'].sort();

const QP = {
'Expert-comptable':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}},{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Consommables':[{lot:'Juliette drouet',biens:{proche_chateau:.3,romeo:.7}}],
'Abonnements plateformes':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}},{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}}],
'Frais bancaires':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}},{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Frais divers':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}},{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Assurance emprunt':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:.2348,romeo:.2348,blosne:.5304}},{lot:'Juliette drouet',biens:{proche_chateau:.5977,romeo:.4023}}],
'Assurance habitation':[{lot:'Juliette drouet',biens:{proche_chateau:.5977,romeo:.4023}},{lot:'Vannes',biens:{vannes:1}}],
'Assurance diverse':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}},{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Abonnements internet':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}},{lot:'Le Blosne',biens:{blosne:1}}],
'Gaz - Juliette Drouet':[{lot:'Juliette drouet',biens:{proche_chateau:.75,romeo:.25}}],
'Électricité - Juliette Drouet':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Électricité - Le Blosne':[{lot:'Le Blosne',biens:{blosne:1}}],
'Eau':[{lot:'Juliette drouet',biens:{proche_chateau:.6,romeo:.4}},{lot:'Le Blosne',biens:{blosne:1}}],
'Taxe foncière':[{lot:'Juliette drouet',biens:{proche_chateau:.5977,romeo:.4023}}],
'Ménage':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Restaurants':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}}],
'Loisirs':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}},{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Publicité':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Petit outillage':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Réparations mineures':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Remboursement emprunt':[{lot:'Juliette drouet',biens:{proche_chateau:.5977,romeo:.4023}},{lot:'Le Blosne',biens:{blosne:1}},{lot:'Vannes',biens:{vannes:1}}],
'CCA remboursé':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}}],
'CCA apport':[{lot:'Juliette drouet',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}}],
'Travaux':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}},{lot:'FolleVille',biens:{folleville:1}}],
'Mobilier':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'Équipements':[{lot:'Juliette drouet',biens:{proche_chateau:.5,romeo:.5}}],
'IS':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:1/3,romeo:1/3,blosne:1/3}}],
'Intérêts de crédit':[{lot:'Juliette drouet',biens:{proche_chateau:.5977,romeo:.4023}},{lot:'Le Blosne',biens:{blosne:1}},{lot:'Vannes',biens:{vannes:1}}],
};

const SCHEMA = {
'Airbnb':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Booking':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Stripe':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Location directe':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Loyer mensuel':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Vente additionnelle':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Expert-comptable':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Ménage':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Consommables':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Petit outillage':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Abonnements plateformes':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Abonnements internet':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Assurance habitation':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Assurance emprunt':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Assurance diverse':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Frais bancaires':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Électricité - Juliette Drouet':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Électricité - Le Blosne':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Gaz - Juliette Drouet':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Eau':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Taxe foncière':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Publicité':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Restaurants':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Loisirs':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Frais divers':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Intérêts de crédit':{n1:'Compte de résultat',n2:'Charges financières',ebitda:'NON',ebit:'NON',cfcv:'Charge fixe'},
'IS':{n1:'Compte de résultat',n2:'Charges financières',ebitda:'NON',ebit:'NON',cfcv:'Charge variable'},
'Remboursement emprunt':{n1:'Bilan',n2:'Passifs financiers',ebitda:'NON',ebit:'NON',cfcv:'Charge fixe'},
'CCA remboursé':{n1:'Bilan',n2:'Passifs financiers',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'CCA apport':{n1:'Bilan',n2:'Passifs financiers',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Immobilisation - Travaux':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Immobilisation - Mobilier':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Immobilisation - Équipements':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
// ── Produits supplémentaires ──
'Consulting':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Autres prestations':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Revenus annexes':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Intérêts reçus':{n1:'Compte de résultat',n2:'Produits financiers',ebitda:'NON',ebit:'NON',cfcv:'CA'},
'Dividendes':{n1:'Compte de résultat',n2:'Produits financiers',ebitda:'NON',ebit:'NON',cfcv:'CA'},
'Plus-values':{n1:'Compte de résultat',n2:'Produits exceptionnels',ebitda:'NON',ebit:'NON',cfcv:'CA'},
'Cash-out':{n1:'Bilan',n2:'Trésorerie',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Remboursements divers':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Régularisations':{n1:'Compte de résultat',n2:"Produits d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'CA'},
'Autres produits exceptionnels':{n1:'Compte de résultat',n2:'Produits exceptionnels',ebitda:'NON',ebit:'NON',cfcv:'CA'},
// ── Charges d'exploitation supplémentaires ──
'Matériel divers':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Réparations mineures':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Prestataires divers':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Réseaux sociaux':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Transport':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Restauration pro':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Hôtels':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Formations en ligne':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Séminaires':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Assurance RC pro':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Gaz - Le Blosne':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
"Taxe d'habitation":{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Autres taxes':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Charge copro':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge fixe'},
'Courses':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Voyages':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Virements vers compte perso':{n1:'Bilan',n2:'Trésorerie',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Pénalités diverses':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Amendes':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Immobilisation - Rénovations':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Immobilisation - Acquisition':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Immobilisation - Informatique':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Immobilisation - Notaire':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
"Dépôt de garantie (location)":{n1:'Bilan',n2:'Actifs courants',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Caution Airbnb / plateforme':{n1:'Bilan',n2:'Actifs courants',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Autres cautions':{n1:'Bilan',n2:'Actifs courants',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Encaissement emprunt':{n1:'Bilan',n2:'Passifs financiers',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Commission Airbnb':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Commission Booking':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Commission plateformes':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Autres commissions':{n1:'Compte de résultat',n2:"Charges d'exploitation",ebitda:'OUI',ebit:'OUI',cfcv:'Charge variable'},
'Versement emprunt':{n1:'Bilan',n2:'Passifs financiers',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
'Amortissement':{n1:'Bilan',n2:'Immobilisations',ebitda:'NON',ebit:'NON',cfcv:'Aucun'},
};

let bankRows     = [];   let airbnbIndex  = {};   let bookingIndex = {};   let rowMeta      = [];   let ventilLines  = [];   let period       = '';   let showCompleted = false;


// Auto-restore session
const PARAMS_KEY = 'artemis_params';

const DEFAULT_PARAMS = {
  scis: ['SCI - Vulcain 1','SCI - Le Vieux Cours','SCI - Ramses II'],
  lots: ['Juliette drouet','Juliette Drouet & Le Blosne','Le Blosne','Vannes','FolleVille'],
  biens: [
    {id:'proche_chateau',name:'T3 Proche château',   nom:'Proche château - Calme, Confortable, Tout équipé',sci:'SCI - Vulcain 1',   type:'LCD',lot:'Juliette drouet',lat:'',lng:''},
    {id:'romeo',         name:'Ô Roméo',              nom:'Ô Roméo - Suite privée',                          sci:'SCI - Vulcain 1',   type:'LCD',lot:'Juliette drouet',lat:'',lng:''},
    {id:'blosne',        name:'Le Blosne',             nom:'Le Blosne',                                       sci:'SCI - Vulcain 1',   type:'LLD',lot:'Le Blosne',lat:'',lng:''},
    {id:'vannes',        name:'Vannes',                nom:'Vannes',                                          sci:'SCI - Le Vieux Cours',type:'LLD',lot:'Vannes',lat:'',lng:''},
    {id:'folleville',    name:'Maison FolleVille',     nom:'Maison FolleVille',                               sci:'SCI - Ramses II',   type:'LCD',lot:'FolleVille',lat:'',lng:''},
    {id:'juliette_s',    name:'Ô Juliette',            nom:'Ô Juliette - Suite privée',                       sci:'SCI - Ramses II',   type:'LCD',lot:'FolleVille',lat:'',lng:''},
  ],
  airbnbMap: {
    'Proche château - Calme, Confortable, Tout équipé':'proche_chateau',
    'Ô Roméo - Suite Privée Balnéothérapie':'romeo',
    'Ô Roméo - Suite privée':'romeo',
    'Le Blosne':'blosne',
  },
  bookingMap: {'11543558':'romeo','11543936':'proche_chateau'},
  qp: {
    'Expert-comptable':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}},{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Consommables':[{lot:'Juliette drouet',biens:{proche_chateau:0.3,romeo:0.7}}],
    'Abonnements plateformes':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}},{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}}],
    'Frais bancaires':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}},{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Frais divers':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}},{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Assurance emprunt':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.2348,romeo:0.2348,blosne:0.5304}},{lot:'Juliette drouet',biens:{proche_chateau:0.5977,romeo:0.4023}}],
    'Assurance habitation':[{lot:'Juliette drouet',biens:{proche_chateau:0.5977,romeo:0.4023}},{lot:'Vannes',biens:{vannes:1}}],
    'Assurance diverse':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}},{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Abonnements internet':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}},{lot:'Le Blosne',biens:{blosne:1}}],
    'Gaz - Juliette Drouet':[{lot:'Juliette drouet',biens:{proche_chateau:0.75,romeo:0.25}}],
    'Électricité - Juliette Drouet':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Électricité - Le Blosne':[{lot:'Le Blosne',biens:{blosne:1}}],
    'Eau':[{lot:'Juliette drouet',biens:{proche_chateau:0.6,romeo:0.4}},{lot:'Le Blosne',biens:{blosne:1}}],
    'Taxe foncière':[{lot:'Juliette drouet',biens:{proche_chateau:0.5977,romeo:0.4023}}],
    'Ménage':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Restaurants':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}}],
    'Loisirs':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}},{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Publicité':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Petit outillage':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Réparations mineures':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Remboursement emprunt':[{lot:'Juliette drouet',biens:{proche_chateau:0.5977,romeo:0.4023}},{lot:'Le Blosne',biens:{blosne:1}},{lot:'Vannes',biens:{vannes:1}}],
    'CCA remboursé':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}}],
    'CCA apport':[{lot:'Juliette drouet',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}}],
    'Travaux':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}},{lot:'FolleVille',biens:{folleville:1}}],
    'Mobilier':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'Équipements':[{lot:'Juliette drouet',biens:{proche_chateau:0.5,romeo:0.5}}],
    'IS':[{lot:'Juliette Drouet & Le Blosne',biens:{proche_chateau:0.3333,romeo:0.3333,blosne:0.3334}}],
    'Intérêts de crédit':[{lot:'Juliette drouet',biens:{proche_chateau:0.5977,romeo:0.4023}},{lot:'Le Blosne',biens:{blosne:1}},{lot:'Vannes',biens:{vannes:1}}],
  },
  loans: [
    {ref:'10001846861',label:'Emprunt Juliette Drouet',lot:'Juliette drouet',biens:['proche_chateau','romeo'],pcts:[0.5977,0.4023]},
    {ref:'10002172071',label:'Emprunt Le Blosne',      lot:'Le Blosne',      biens:['blosne'],               pcts:[1]},
    {ref:'10000794859',label:'Emprunt Vannes',         lot:'Vannes',         biens:['vannes'],               pcts:[1]},
  ],
  loanTable: {},
};

function _migrateParams(p) {
  // Migration: renommer les clés QP mal orthographiées + passage Immo
  const renames = {
    'Electrique - Juliette Drouet': 'Électricité - Juliette Drouet',
    'Electrique - Le Blosne':       'Électricité - Le Blosne',
    'Travaux':      'Immobilisation - Travaux',
    'Rénovations':  'Immobilisation - Rénovations',
    'Mobilier':     'Immobilisation - Mobilier',
    'Acquisition':  'Immobilisation - Acquisition',
    'Informatique': 'Immobilisation - Informatique',
    'Équipements':  'Immobilisation - Équipements',
    'Notaire':      'Immobilisation - Notaire',
  };
  if (p.qp) {
    Object.entries(renames).forEach(([oldKey, newKey]) => {
      if (p.qp[oldKey] && !p.qp[newKey]) {
        p.qp[newKey] = p.qp[oldKey];
        delete p.qp[oldKey];
      }
    });
  }
  return p;
}

// Migration base : renommer catégories immo existantes
function _migrateDBImmo() {
  const db = getDB();
  if (!db.periods || !Object.keys(db.periods).length) return;
  const MAP = {
    'Travaux':'Immobilisation - Travaux','Rénovations':'Immobilisation - Rénovations',
    'Mobilier':'Immobilisation - Mobilier','Acquisition':'Immobilisation - Acquisition',
    'Informatique':'Immobilisation - Informatique','Équipements':'Immobilisation - Équipements',
    'Notaire':'Immobilisation - Notaire'
  };
  let changed = 0;
  Object.values(db.periods).forEach(period => {
    (period.lines||[]).forEach(line => {
      if (MAP[line.cat]) { line.cat = MAP[line.cat]; changed++; }
      if (MAP[line.categorie]) { line.categorie = MAP[line.categorie]; changed++; }
    });
  });
  if (changed) { saveDB(db); console.log('[ARTEMIS] Migration immo DB:', changed, 'lignes migrées'); }
}
function getParams() {
  try {
    const stored = JSON.parse(localStorage.getItem(PARAMS_KEY) || 'null');
    if (!stored) return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    const base = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    const p = _migrateParams(Object.assign(base, stored));
    // Persiste la migration si les QP ont changé
    if (stored.qp && JSON.stringify(stored.qp) !== JSON.stringify(p.qp)) localStorage.setItem(PARAMS_KEY, JSON.stringify(p));
    return p;
  } catch(e) { return JSON.parse(JSON.stringify(DEFAULT_PARAMS)); }
}
function saveParams(p) {
  localStorage.setItem(PARAMS_KEY, JSON.stringify(p));
  _rebuildLiveVars(p);
}

// Live variables fed from params - used everywhere else in the app
let BIENS_LIVE = [], SCIS_LIVE = [], LOTS_LIVE = [],
    AIRBNB_MAP_LIVE = {}, BOOKING_ID_MAP_LIVE = {},
    QP_LIVE = {}, LOAN_REF_MAP_LIVE = {}, LOAN_TABLE_LIVE = {};

function _rebuildLiveVars(p) {
  if (!p) p = getParams();
  BIENS_LIVE          = p.biens   || [];
  SCIS_LIVE           = p.scis    || [];
  LOTS_LIVE           = p.lots    || [];
  AIRBNB_MAP_LIVE     = p.airbnbMap  || {};
  BOOKING_ID_MAP_LIVE = p.bookingMap || {};
  QP_LIVE             = p.qp         || {};
  LOAN_TABLE_LIVE     = {};
  // Normaliser les clés du loanTable vers YYYY-MM
  Object.entries(p.loanTable || {}).forEach(([ref, tbl]) => {
    const normalized = {};
    Object.entries(tbl).forEach(([k, v]) => {
      const ym = _parseYM(k);
      if (ym && ym.length >= 7) normalized[ym.slice(0,7)] = v;
    });
    LOAN_TABLE_LIVE[ref] = normalized;
  });
  LOAN_REF_MAP_LIVE   = {};
  (p.loans || []).forEach(l => {
    LOAN_REF_MAP_LIVE[l.ref] = {lot:l.lot, biens:l.biens, pcts:l.pcts};
  });
}


document.addEventListener('DOMContentLoaded', function(){
_auth.onAuthStateChanged(async function(user){
  if (user) {
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('mainContent').style.display='flex';
    document.getElementById('mainContent').style.width='100%';
    await _pullCloudData(); // récupère les dernières données partagées avant de peupler l'écran
    _rebuildLiveVars();
    initPeriodPicker();
    restorePlatformIndexes();  // reload Airbnb/Booking from localStorage
    renderDatabase();
    renderRecentActivity();
    showHome();
    try { _initHomeBackBtn(); } catch(e) {}
  } else {
    document.getElementById('loginScreen').style.display='flex';
  }
});
});

function setupDropZone(dzId, inputId, onLoad) {
const dz = document.getElementById(dzId);
const inp = document.getElementById(inputId);
inp.addEventListener('change', e => { if(e.target.files[0]) readXlsx(e.target.files[0], onLoad); });
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => {
e.preventDefault(); dz.classList.remove('drag');
if(e.dataTransfer.files[0]) readXlsx(e.dataTransfer.files[0], onLoad);
});
}

function readXlsx(file, cb) {
const reader = new FileReader();
reader.onload = e => {
const wb = XLSX.read(e.target.result, {type:'binary', cellDates:false});
const ws = wb.Sheets[wb.SheetNames[0]];
// raw:false + dateNF forces SheetJS to format dates as strings in dd/mm/yyyy, avoiding timezone shifts
cb(file.name, XLSX.utils.sheet_to_json(ws, {defval:null, header:1, raw:false, dateNF:'dd/mm/yyyy'}));
};
reader.readAsBinaryString(file);
}

setupDropZone('dzBank','fileBank', (name, rows) => {
parseBankFile(name, rows);
});
setupDropZone('dzAirbnb','fileAirbnb', (name, rows) => {
parseAirbnbFile(name, rows);
});
setupDropZone('dzBooking','fileBooking', (name, rows) => {
parseBookingFile(name, rows);
});

function loadPlatformInline(input, platform) {
if(!input.files[0]) return;
readXlsx(input.files[0], (name, rows) => {
if(platform === 'airbnb') {
parseAirbnbFile(name, rows);
document.getElementById('airbnbMissingBanner').style.display = 'none';
showToast('✓ Airbnb chargé, lignes débloquées');
} else {
parseBookingFile(name, rows);
document.getElementById('bookingMissingBanner').style.display = 'none';
showToast('✓ Booking chargé, lignes débloquées');
}
enrichBankRows();
buildMappingTable();
});
}

// Certains exports bancaires (format comptable) notent les montants négatifs entre
// parenthèses — ex. "(982,37 €)" — au lieu d'un signe moins. Sans ça, le signe est perdu
// silencieusement, ce qui casse entre autres la détection des échéances d'emprunt (montant < 0).
function _parseMontantCell(raw) {
  const s = String(raw || '');
  const isParenNegative = /\(\s*[\d.,\s   ]+\s*\)/.test(s);
  const n = parseFloat(s.replace(/[\s   ]/g,'').replace(',','.').replace(/[^0-9.\-]/g,'')) || 0;
  return (isParenNegative && n > 0) ? -n : n;
}

function parseBankFile(name, rows) {
period = name.replace(/\.xlsx?|\.csv/gi,'');
const headers = rows[0] || [];
const idx = {
// Prioritise "Date opération" / "Date operation" before any generic "date" column
date:    findCol(headers,/date.op/i) >= 0 ? findCol(headers,/date.op/i)
       : findCol(headers,/op.+date|date.+op/i) >= 0 ? findCol(headers,/op.+date|date.+op/i)
       : findCol(headers,/^date$/i) >= 0 ? findCol(headers,/^date$/i)
       : findCol(headers,/date/i),
libelle: findCol(headers,/libell|label/i),
full:    findCol(headers,/complet|full/i),
montant: findCol(headers,/mont|amount/i),
};
bankRows = rows.slice(1).map(r => {
if(!r) return null;
let d = r[idx.date];
if(d instanceof Date) { const _dd=String(d.getUTCDate()).padStart(2,'0'),_mm=String(d.getUTCMonth()+1).padStart(2,'0'),_yy=d.getUTCFullYear(); d=_dd+'/'+_mm+'/'+_yy; }
const montant = _parseMontantCell(r[idx.montant]);
if(!montant) return null;
return {
date:    String(d||''),
libelle: String(r[idx.libelle]||''),
full:    String(r[idx.full]||''),
montant,
};
}).filter(Boolean);

const el = document.getElementById('bankStatus');
el.style.display = 'block';
el.style.color = 'var(--green)';
el.textContent = `✓ ${bankRows.length} lignes chargées`;
document.getElementById('dzBank').classList.add('upload-ok');
document.getElementById('stBankDot').className = 'dot dot-ok';
document.getElementById('stBankText').textContent = `Extraction bancaire - ${bankRows.length} lignes`;
document.getElementById('stBankSub').textContent = name;
checkReadyToMap();
}

function parseAirbnbFile(name, rows) {
airbnbIndex = {};
let currentCode = null;

for(let i = 1; i < rows.length; i++) {
const r = rows[i]; if(!r) continue;
const type = String(r[2]||'');
if(type === 'Payout') {
currentCode = r[12]; if(currentCode) airbnbIndex[currentCode] = {
code_ref:   currentCode,
date:       r[0],
mapping:    r[3],
montant_verse: parseFloat(r[15]) || 0,
reservations: []
};
} else if(currentCode && airbnbIndex[currentCode]) {
airbnbIndex[currentCode].reservations.push({
type,
code_conf: r[4],
date_debut: r[6], date_fin: r[7], nuits: r[8],
voyageur:   r[9],
logement:   String(r[10]||''),
montant:    parseFloat(r[14]) || 0,
frais_service:  parseFloat(r[16]) || 0,
frais_menage:   parseFloat(r[18]) || 0,
revenus_bruts:  parseFloat(r[20]) || 0,
});
}
}

// Persist raw rows so they survive page reloads and edit sessions
try { localStorage.setItem(AIRBNB_KEY, JSON.stringify(rows)); } catch(e) {}
// Persist reservations in dedicated store
_mergeReservations('airbnb', airbnbIndex);
const nb = Object.keys(airbnbIndex).length;
document.getElementById('airbnbStatus').style.display = 'block';
document.getElementById('airbnbStatus').style.color = 'var(--green)';
document.getElementById('airbnbStatus').textContent = `✓ ${nb} Payouts indexés`;
document.getElementById('dzAirbnb').classList.add('upload-ok');
document.getElementById('stAirbnbDot').className = 'dot dot-ok';
document.getElementById('stAirbnbDot').style.background = 'var(--gold)';
document.getElementById('stAirbnbText').textContent = `Export Airbnb - ${nb} Payouts`;
document.getElementById('stAirbnbSub').textContent = name;
checkReadyToMap();
}

function parseBookingFile(name, rows) {
bookingIndex = {};
for(let i = 1; i < rows.length; i++) {
const r = rows[i]; if(!r) continue;
const type = String(r[0]||'');
if(type === '(Payout)') {
const libRef = String(r[1]||'');   const idEtab = String(r[9]||'');   if(!libRef) continue;
bookingIndex[libRef] = {
libRef,
idEtab,
nomEtab:      String(r[10]||''),          montant:      parseFloat(r[25]) || 0,      dateVersement: r[27],                      reservations: []
};
} else if(type === 'Réservation') {
const libRef = String(r[1]||'');
if(bookingIndex[libRef]) {
bookingIndex[libRef].reservations.push({
numRef:      String(r[2]||''),   dateArrivee: r[3],
dateDepart:  r[4],
nuits:       r[8],
montantBrut: parseFloat(r[15]) || 0,
commission:  parseFloat(r[16]) || 0,
fraisPaiement: parseFloat(r[18]) || 0,
montantTransaction: parseFloat(r[21]) || 0,
});
}
}
}
// Persist raw rows
try { localStorage.setItem(BOOKING_KEY, JSON.stringify(rows)); } catch(e) {}
// Persist reservations in dedicated store
_mergeReservations('booking', bookingIndex);
const nb = Object.keys(bookingIndex).length;
document.getElementById('bookingStatus').style.display = 'block';
document.getElementById('bookingStatus').style.color = 'var(--green)';
document.getElementById('bookingStatus').textContent = `✓ ${nb} Payouts Booking indexés`;
document.getElementById('dzBooking').classList.add('upload-ok');
document.getElementById('stBookingDot').className = 'dot dot-ok';
document.getElementById('stBookingDot').style.background = 'var(--purple)';
document.getElementById('stBookingText').textContent = `Export Booking - ${nb} Payouts`;
document.getElementById('stBookingSub').textContent = name;
checkReadyToMap();
}

function findCol(headers, regex) {
const i = headers.findIndex(h => regex.test(String(h||'')));
return i >= 0 ? i : -1;
}

// ── Store persistant des réservations (Airbnb + Booking) ──
const RESERVATIONS_KEY = 'artemis_reservations';

function _mergeReservations(source, index) {
  try {
    const existing = JSON.parse(localStorage.getItem(RESERVATIONS_KEY) || '[]');
    // Supprimer les anciennes entrées de cette source
    const kept = existing.filter(r => r.source !== source);
    // Extraire les nouvelles réservations
    const newEntries = [];
    const seen = new Set();
    Object.values(index).forEach(payout => {
      (payout.reservations || []).forEach(r => {
        const nuits = parseInt(r.nuits) || 0;
        if (nuits <= 0) return;
        const code = source === 'airbnb' ? String(r.code_conf||'') : String(r.numRef||'');
        // Dédupliqer par code de confirmation
        if (code && seen.has(code)) return;
        if (code) seen.add(code);
        newEntries.push({
          source,
          dateDebut: source === 'airbnb' ? String(r.date_debut||'') : String(r.dateArrivee||''),
          dateFin:   source === 'airbnb' ? String(r.date_fin||'')   : String(r.dateDepart||''),
          nuits,
          logement:  source === 'airbnb' ? String(r.logement||'')   : String(payout.nomEtab||''),
          codeConf:  code,
        });
      });
    });
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify([...kept, ...newEntries]));
    console.log(`[ARTEMIS] Réservations ${source} sauvegardées: ${newEntries.length} (total store: ${kept.length + newEntries.length})`);
  } catch(e) { console.warn('_mergeReservations error', e); }
}

function _getReservations() {
  try { return JSON.parse(localStorage.getItem(RESERVATIONS_KEY) || '[]'); } catch(e) { return []; }
}

// Expose reset helper for debugging
window._resetReservations = () => {
  localStorage.removeItem(RESERVATIONS_KEY);
  console.log('[ARTEMIS] Store réservations vidé. Réimportez vos fichiers Airbnb et Booking.');
};

function checkReadyToMap() {
const ready = bankRows.length > 0;
document.getElementById('btnStartMapping').disabled = !ready;
const btnPM = document.getElementById('btnPreMap');
if (btnPM) btnPM.disabled = !ready;
document.getElementById('importWarning').textContent = ready
? (Object.keys(airbnbIndex).length ? '✓ Banque + Airbnb chargés - prêt !' : '⚠ Airbnb non chargé - sera nécessaire si virements Airbnb détectés')
: "Charge au minimum l'extraction bancaire";
document.getElementById('importWarning').style.color = ready ? 'var(--green)' : 'var(--text3)';
}

function resolveLoanSplit(ref, dateStr, montant) {
try {
let ym;
if(dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
  ym = dateStr.slice(0,7);
} else if(dateStr && dateStr.includes('/')) {
  const parts = dateStr.split('/');
  if(parts.length === 3) {
    // MM/D/YY (SheetJS raw:false, année 2 chiffres)
    if(parts[2].length === 2) { ym = '20'+parts[2]+'-'+parts[0].padStart(2,'0'); }
    // DD/MM/YYYY (français, année 4 chiffres)
    else { ym = parts[2]+'-'+parts[1].padStart(2,'0'); }
  }
} else if(dateStr) {
  ym = dateStr.slice(0,7);
}
if(!ym) return null;
const loanDef = LOAN_REF_MAP[ref];
const table = LOAN_TABLE[ref];
if(!loanDef || !table) return null;
const entry = table[ym];
if(!entry) {
const fallback = Object.entries(table).find(([,v]) => v && Math.abs((v[0]+v[1]) + montant) < 0.11);
if(!fallback) return { unknown: true, ref, ym };
return buildLoanSplit(ref, loanDef, fallback[1], montant);
}
return buildLoanSplit(ref, loanDef, entry, montant);
} catch(e) { return null; }
}

function buildLoanSplit(ref, loanDef, entry, montantBancaire) {
const capTotal = Array.isArray(entry) ? entry[0] : entry.c;
const intTotal = Array.isArray(entry) ? entry[1] : entry.i;
let capDistributed = 0, intDistributed = 0;
const lines = loanDef.biens.map((bienId, idx) => {
const pct    = loanDef.pcts[idx];
const isLast = idx === loanDef.biens.length - 1;
const bien   = BIENS.find(b => b.id === bienId);
const cap    = isLast ? Math.round((-capTotal - capDistributed) * 100) / 100 : Math.round(-capTotal * pct * 100) / 100;
const inte   = isLast ? Math.round((-intTotal - intDistributed) * 100) / 100 : Math.round(-intTotal * pct * 100) / 100;
capDistributed += cap;
intDistributed += inte;
return {
bienId,
bienName: bien ? bien.name : bienId,
bienNom:  bien ? bien.nom  : bienId,
sci:      bien ? bien.sci  : loanDef.scis[0],
lot:      loanDef.lot,
pct,
capital:  cap,
interets: inte,
echeance: Math.round((cap + inte) * 100) / 100,
};
});
return { ref, lot: loanDef.lot, lines, montantBancaire };
}

function enrichBankRows() {
rowMeta = bankRows.map(r => {
const combined = r.full + ' ' + r.libelle;
const meta = {
...r,
isAirbnb: false, airbnbCode: null, airbnbVentil: [], airbnbResolved: false,
isBooking: false, bookingRef: null, bookingVentil: null, bookingResolved: false,
isLoan:   false, loanRef:   null,  loanSplit:   null,
};

if(/airbnb/i.test(combined)) {
const match = combined.match(/G-(?:[A-Z0-9](?![a-z]))+/);
if(match) {
meta.isAirbnb   = true;
meta.airbnbCode = match[0];
meta.airbnbVentil   = resolveAirbnbVentil(match[0]);
meta.airbnbResolved = meta.airbnbVentil.length > 0;
}
}

if(!meta.isAirbnb && !meta.isBooking && r.montant < 0) {
const loanRef = Object.keys(LOAN_REF_MAP).find(ref => combined.includes(ref));
if(loanRef) {
meta.isLoan    = true;
meta.loanRef   = loanRef;
meta.loanSplit = resolveLoanSplit(loanRef, r.date, r.montant);
}
}

if(!meta.isAirbnb && /booking/i.test(combined)) {
const noMatch = combined.match(/NO\.([A-Za-z0-9]+)/);
const idMatch = combined.match(/\/ID\.(\d+)/);
if(noMatch) {
meta.isBooking  = true;
meta.bookingRef = noMatch[1];   meta.bookingIdEtab = idMatch ? idMatch[1] : null;
const resolved = resolveBookingVentil(noMatch[1], idMatch ? idMatch[1] : null, r.montant);
meta.bookingVentil   = resolved;
meta.bookingResolved = resolved !== null;
}
}

return meta;
});
}

function resolveAirbnbVentil(code, montantBancaire) {
const payout = airbnbIndex[code];
if(!payout) return [];

const byLogement = {};
payout.reservations.forEach(r => {
if(!r.logement) return;
if(!byLogement[r.logement]) byLogement[r.logement] = 0;
if(r.type === 'Réservation' || r.type === 'Versement du co-hôte' || r.type.includes('Régularisation')) {
byLogement[r.logement] += r.montant;
}
});

return Object.entries(byLogement)
.filter(([,amt]) => amt !== 0)
.map(([logement, montantNet]) => {
const bienId  = AIRBNB_MAP[logement];
const bien    = BIENS.find(b => b.id === bienId);
return {
logement,
bienId:   bienId || null,
bienName: bien ? bien.name : logement,
bienNom:  bien ? bien.nom  : logement,
sci:      bien ? bien.sci  : 'SCI - Vulcain 1',
lot:      bien ? bien.lot  : 'Juliette drouet',
montant:  Math.round(montantNet * 100) / 100,
};
});
}

function resolveBookingVentil(libRef, idEtab, montant) {
const payout = bookingIndex[libRef];
const id = payout ? payout.idEtab : idEtab;
const bienId = id ? BOOKING_ID_MAP[id] : null;
const bien = BIENS.find(b => b.id === bienId);

if(!bien) {
if(id) return { unknown: true, idEtab: id };
return null;
}

return {
bienId:   bien.id,
bienName: bien.name,
bienNom:  bien.nom,
sci:      bien.sci,
lot:      bien.lot,
montant,
payout,   libRef,
idEtab:   id,
};
}


