// ══════════════════════════════════════════════
//  GUIDES — « Comment ça marche » de chaque module
//
//  Un bouton « Guide » en haut de chaque module ouvre une visite animée. Chaque écran du site est
//  redessiné en vectoriel (23-guide-screens.js, données fictives) ; pour chaque étape, la caméra se
//  centre sur l'élément expliqué (toujours entier et au milieu), le met en lumière et rejoue ses
//  animations, et l'explication s'affiche dessous. Lecture automatique avec pause, étape
//  précédente / suivante, clavier (← → espace Échap) et glissement du doigt sur mobile.
//  Étape : [id de l'élément (data-gd), titre, texte, { st: état de l'écran }?] ; id null = vue d'ensemble.
// ══════════════════════════════════════════════

const GUIDES = {
  outils: {
    label: 'Outils', color: '#22d3c8', open: () => enterTools(),
    pages: [
      { name: 'Import', scr: 'import', steps: [
        [null, "L'écran d'import", "Chaque mois commence ici : on dépose les fichiers, on choisit la période, puis on lance la répartition des lignes (le mapping)."],
        ['zbank', "Extraction bancaire (obligatoire)", "Le relevé de votre banque, en Excel ou en CSV. ARTEMIS y lit, pour chaque ligne, la date d'opération, le libellé et le montant."],
        ['zair', "Export Airbnb", "À déposer si vous louez sur Airbnb : le fichier des versements téléchargé sur Airbnb. Il détaille chaque virement par réservation et par logement, ce qui permet de répartir un virement entre plusieurs biens."],
        ['zbook', "Export Booking", "À déposer si vous louez sur Booking : le relevé des paiements. Chaque versement y est rattaché à un établissement, donc à l'un de vos biens."],
        ['zall', "Fichiers chargés", "Une fois déposé, chaque cadre passe au vert et indique ce qui a été lu : ici 23 lignes bancaires, 52 versements Airbnb et 42 versements Booking. Les exports Airbnb et Booking restent en mémoire d'un mois sur l'autre.", { st: 'loaded' }],
        ['period', "Période d'import", "Le mois auquel appartiennent les lignes. Les flèches changent de mois. Si ce mois existe déjà dans la base, un avertissement s'affiche avant d'écraser quoi que ce soit."],
        ['state', "État des imports et lancement", "Le récapitulatif des fichiers chargés. « Démarrer le mapping » ouvre la répartition ligne par ligne, « Pré-mapper automatiquement » la remplit d'avance. « Sauvegarder » enregistre l'import en cours dans un fichier, « Reprendre » le recharge pour le terminer plus tard."],
      ] },
      { name: 'Mapping', scr: 'mapping', steps: [
        [null, "Le mapping", "Chaque ligne du relevé reçoit une catégorie, un bien et un lot. Le pré-mapping a déjà tout proposé : il reste à vérifier et, si besoin, à corriger."],
        ['sum', "Le résumé du mois", "Nombre de lignes complètes (23 sur 23), total des encaissements du mois (CA), total des sorties (charges), et nombre de virements Airbnb et Booking reconnus."],
        ['r1', "Une ligne bancaire", "À gauche, le libellé et la date ; puis le montant, en vert pour une entrée et en rouge pour une sortie. Le badge « Historique » indique que la proposition vient d'une ligne identique d'un mois précédent."],
        ['cat', "Catégorie, bien, SCI et lot", "La catégorie classe l'opération (loyer, ménage, intérêts…). Le bien désigne le logement concerné, et la SCI s'en déduit. Le lot sert à répartir les charges communes. Tout se modifie dans les listes."],
        ['air', "Virement Airbnb", "Le virement est retrouvé dans l'export Airbnb grâce à sa référence (G-…). ARTEMIS sait à quel logement appartient chaque réservation et répartit le montant au centime près : rien à saisir."],
        ['book', "Virement Booking", "Même principe avec la référence du versement et l'identifiant d'établissement Booking. Si un identifiant n'est associé à aucun bien, la ligne reste bloquée jusqu'à ce que la correspondance soit ajoutée dans les Paramètres."],
        ['all', "Toutes les lignes", "La liste complète du mois. Une pastille verte signale une ligne complète. « Masquer traitées » n'affiche que les lignes restant à compléter. Quand tout est prêt, « Valider » ouvre l'écran de contrôle."],
      ] },
      { name: 'Validation', scr: 'valid', steps: [
        [null, "La validation", "Dernier contrôle avant l'enregistrement : chaque ligne apparaît exactement telle qu'elle sera stockée dans la base."],
        ['sum', "Le résumé", "Lignes ventilées, chiffre d'affaires, charges et net du mois, virements de plateformes. Les charges ne comptent que les charges de résultat : le capital d'emprunt remboursé est classé à part, au bilan."],
        ['lines', "Toutes les lignes ventilées", "Date, libellé, catégorie, bien imputé, SCI, lot, montant de la ligne bancaire et montant attribué au bien. Une charge commune répartie entre plusieurs biens apparaît sur plusieurs lignes, une par bien, avec sa part."],
        ['perbien', "Synthèse par bien", "Pour chaque bien : chiffre d'affaires, charges, mouvements de bilan (capital d'emprunt remboursé, immobilisations) et résultat du mois, c'est-à-dire chiffre d'affaires moins charges."],
        ['actions', "Corriger ou enregistrer", "« Corriger » revient au mapping. « Enregistrer dans la base » ajoute le mois à l'historique ; les achats classés en immobilisation sont envoyés dans Amortissements pour y être complétés."],
      ] },
      { name: 'Base', scr: 'base', steps: [
        [null, "La base", "L'historique de tous les mois enregistrés, avec leurs totaux."],
        ['k1', "Revenus cumulés", "La somme de toutes les entrées d'argent enregistrées, tous mois confondus."],
        ['k2', "Charges cumulées", "La somme de toutes les sorties d'argent : charges, intérêts, mais aussi capital d'emprunt remboursé."],
        ['k3', "Résultat net", "Revenus cumulés moins charges cumulées. Comme le capital remboursé est inclus, ce chiffre correspond à la trésorerie dégagée."],
        ['k4', "Périodes", "Le nombre de mois enregistrés dans la base."],
        ['periods', "Périodes enregistrées", "Un mois par ligne, du plus récent au plus ancien : nombre de lignes, revenus, charges et solde. « Consulter » affiche le détail du mois, « Éditer » permet de corriger une catégorie, un bien ou un lot, la croix supprime le mois. « Export JSON » sauvegarde toute la base dans un fichier, « Vider la base » efface tout."],
      ] },
      { name: 'Paramètres', scr: 'params', steps: [
        [null, "Les paramètres", "La description de votre patrimoine. Toute modification s'applique immédiatement à l'ensemble de la base."],
        ['sci', "Sociétés (SCI)", "La liste de vos sociétés. Chaque bien appartient à l'une d'elles, ce qui permet de filtrer tout le dashboard par SCI."],
        ['biens', "Biens", "Pour chaque logement : le nom court utilisé partout dans ARTEMIS, le nom long tel qu'il apparaît sur Airbnb, le type (LCD = courte durée, LLD = longue durée), la SCI propriétaire et le lot."],
        ['air', "Correspondances Airbnb", "Associe chaque nom de logement de l'export Airbnb à un bien ARTEMIS. C'est ce qui permet de répartir les virements Airbnb automatiquement."],
        ['book', "Correspondances Booking", "Associe chaque identifiant d'établissement Booking à un bien ARTEMIS."],
      ] },
      { name: 'Quote-parts', scr: 'qp', steps: [
        [null, "Les quote-parts", "Les règles qui répartissent les charges communes (internet, comptable, assurance…) entre plusieurs biens."],
        ['cats', "Catégories", "Chaque catégorie de dépense a ses propres règles de répartition. Un clic sur une catégorie affiche ses groupes ; « + Ajouter » crée une nouvelle catégorie."],
        ['groups', "Groupes de répartition", "Un groupe associe un lot à la part de chaque bien, en %, pour un total de 100 %. Quand une ligne est imputée aux frais généraux avec ce lot, elle est découpée selon ces pourcentages. « + Groupe » ajoute un lot, « + Bien » ajoute un bien au groupe."],
      ] },
      { name: 'Emprunts', scr: 'loans', steps: [
        [null, "Les emprunts", "Ce qui permet de séparer automatiquement, dans chaque échéance prélevée, le capital remboursé et les intérêts."],
        ['loans', "Emprunts configurés", "Chaque emprunt est reconnu par sa référence bancaire, celle qui figure dans le libellé du prélèvement. Il a un libellé, un lot et une répartition entre biens en %. Le nombre d'échéances indique combien de lignes du tableau d'amortissement sont chargées."],
        ['impt', "Importer un tableau d'amortissement", "Déposez le tableau fourni par la banque, en Excel. ARTEMIS repère les colonnes Date, Capital amorti et Intérêts, puis vous demande à quel emprunt l'affecter. Les échéances importées ensuite sont découpées automatiquement."],
      ] },
      { name: 'Locations directes', scr: 'lcdp', steps: [
        [null, "Les locations directes", "Les séjours réservés sans plateforme, en direct avec le voyageur."],
        ['list', "Liste des locations directes", "Une ligne bancaire classée « Location directe » crée automatiquement une entrée ici. Complétez les dates de début et de fin du séjour, le nombre de nuits et le locataire : ces nuits sont alors comptées dans le taux d'occupation et le revenu par nuit des KPIs. « Enregistrer » valide la liste."],
      ] },
      { name: 'Amortissements', scr: 'amort', steps: [
        [null, "Les amortissements", "Les achats durables (travaux, mobilier, équipements) dont le coût est étalé sur plusieurs années."],
        ['imp', "Import du tableau d'amortissements", "Importez votre liste d'immobilisations en Excel : au minimum libellé, date d'achat, valeur HT et durée en mois. « Télécharger le modèle » fournit un fichier prêt à remplir."],
        ['assets', "Actifs à amortir", "Chaque immobilisation avec sa date d'achat, sa valeur hors taxes, sa durée d'amortissement en mois, la méthode (linéaire, dégressif ou non amortissable), le lot, le bien et la catégorie. Les achats classés en immobilisation lors d'un import arrivent ici à compléter. « Voir dotations » affiche la charge de chaque année, reprise dans le Résultat et les KPIs."],
      ] },
    ],
  },

  dashboard: {
    label: 'Dashboard', color: '#9b6ef3', open: () => enterDashboard(),
    pages: [
      { name: 'Synthèse · Chiffre d\'affaires', scr: 'dash', steps: [
        [null, "La synthèse du chiffre d'affaires", "Toutes les entrées de revenus issues de vos relevés : loyers, Airbnb, Booking, locations directes. Les onglets CA, Dépenses et Trésorerie partagent les mêmes filtres."],
        ['filters', "Les filtres", "Société, bien, période (du… au…) et catégorie : tous les chiffres se recalculent. « Driver » fixe la durée, en mois, des deux périodes comparées dans « Drivers CA » en bas de page."],
        ['k1', "CA total", "La somme des revenus sur la période (21 mois ici) et sa courbe mensuelle. « vs M-1 » compare le dernier mois au mois précédent, « vs N-1 » au même mois de l'année précédente."],
        ['k2', "Nombre de biens actifs", "Le nombre de biens qui ont encaissé au moins un revenu sur la période."],
        ['k3', "Moyenne par période", "Le chiffre d'affaires moyen d'un mois : le CA total divisé par le nombre de mois de la période."],
        ['k4', "Meilleur bien", "Le bien qui a rapporté le plus sur la période, avec sa part du chiffre d'affaires total."],
        ['budget', "Réel contre budget", "Affiché quand un budget existe pour l'année : chiffre d'affaires réel et budgété depuis janvier, écart en euros et en %, part du budget réalisée, détail par bien et écarts les plus défavorables. « Analyse détaillée » ouvre l'onglet Budget."],
        ['chart', "Évolution mensuelle", "Le chiffre d'affaires de chaque mois (ligne pleine) face au budget (pointillés). « Cumulé » affiche le total qui s'additionne mois après mois."],
        ['ops', "Opérations CA", "Toutes les lignes de revenus de la période, triables par date, bien, catégorie, libellé ou montant."],
        ['detail', "Détail CA par bien", "Le chiffre d'affaires de chaque bien et sa part du total."],
        ['repart', "Répartition par catégorie", "La part de chaque source de revenus : Airbnb, loyers, Booking, locations directes."],
        ['drivers', "Drivers CA : P1 contre P2", "Compare les derniers mois (P1) aux mois précédents de même durée (P2) et montre, catégorie par catégorie, ce qui a fait monter ou baisser le chiffre d'affaires."],
      ] },
      { name: 'Synthèse · Dépenses', scr: 'dep', steps: [
        [null, "Les dépenses", "Toutes les sorties d'argent de vos relevés, hors capital d'emprunt remboursé (qui n'est pas une charge)."],
        ['k1', "Dépenses totales", "La somme des dépenses de la période et leur courbe mensuelle, avec les comparaisons au mois précédent (M-1) et au même mois de l'an passé (N-1)."],
        ['k2', "Nombre de biens", "Le nombre de biens concernés par au moins une dépense."],
        ['k3', "Moyenne par période", "La dépense moyenne d'un mois sur la période."],
        ['k4', "Poste principal", "La catégorie de dépense la plus lourde et sa part dans le total des dépenses."],
        ['budget', "Réel contre budget", "Les dépenses réelles depuis janvier face au budget, l'écart, le détail par bien et les dépassements les plus importants."],
        ['chart', "Évolution mensuelle", "Les dépenses de chaque mois face au budget. Les pics correspondent aux charges ponctuelles, comme la taxe foncière en octobre."],
        ['ops', "Opérations dépenses", "Toutes les lignes de dépenses, triables par date, bien, catégorie, libellé ou montant."],
        ['detail', "Détail par bien", "Les dépenses de chaque bien et leur part du total."],
        ['repart', "Répartition par catégorie", "Le poids de chaque catégorie : intérêts, ménage, énergie, taxe foncière…"],
        ['drivers', "Drivers dépenses : P1 contre P2", "Compare les derniers mois aux mois précédents de même durée et montre quelles catégories expliquent la hausse ou la baisse des dépenses."],
      ] },
      { name: 'Synthèse · Trésorerie', scr: 'treso', steps: [
        [null, "La trésorerie", "Tout ce qui entre et sort réellement du compte, capital d'emprunt compris."],
        ['k1', "Total entrées", "Toutes les entrées d'argent de la période."],
        ['k2', "Total sorties", "Toutes les sorties, y compris le capital d'emprunt remboursé."],
        ['k3', "Solde net", "Entrées moins sorties : l'argent réellement dégagé sur la période."],
        ['k4', "Nombre d'opérations", "Le nombre de lignes bancaires sur la période."],
        ['budget', "Réel contre budget", "Le solde de trésorerie réel depuis janvier face au budget, avec l'écart et le détail par bien."],
        ['chart', "Solde mensuel", "Le solde de chaque mois. La zone rouge signale un mois où les sorties ont dépassé les entrées, ici octobre, le mois de la taxe foncière."],
        ['ops', "Opérations", "Toutes les lignes, entrées et sorties, triables par colonne."],
        ['detail', "Détail par bien", "Entrées, sorties et solde de chaque bien."],
        ['repart', "Répartition des entrées", "La part de chaque catégorie dans les entrées d'argent."],
        ['drivers', "Drivers trésorerie : P1 contre P2", "Ce qui explique l'évolution du solde entre les derniers mois et les mois précédents."],
      ] },
      { name: 'Résultat', scr: 'resultat', steps: [
        [null, "Le résultat", "Le compte de résultat sous forme de soldes intermédiaires de gestion (SIG), comme le présente un expert-comptable."],
        ['sig', "Réel contre budget", "Produits, charges d'exploitation, excédent brut d'exploitation (EBE), résultat financier, exceptionnel, impôt et résultat net, depuis janvier, comparés au budget. Les amortissements, non budgétés, sont exclus de ce tableau."],
        ['detail', "Le détail par rubrique", "Les produits (revenus courte et longue durée), les charges d'exploitation regroupées par nature (prestations externes, énergie, impôts et taxes, amortissements…) et les charges financières. Un clic sur une ligne ▸ affiche les postes qui la composent."],
        ['cascade', "La cascade des soldes", "Produits moins charges d'exploitation = EBE. Moins les dotations aux amortissements = résultat d'exploitation. Plus ou moins le résultat financier et exceptionnel = résultat courant avant impôt (RCAI). Moins l'impôt = résultat net."],
      ] },
      { name: 'KPIs · Courte durée', scr: 'kpis', steps: [
        [null, "Les KPIs de courte durée", "Les indicateurs de la location saisonnière : occupation, prix, rentabilité."],
        ['occ', "Taux d'occupation et point mort", "Nuits louées divisées par nuits disponibles (jours de la période × biens actifs). Le point mort est l'occupation minimale pour couvrir les charges fixes : au-dessus, l'activité gagne de l'argent."],
        ['nights', "Nuits louées et point mort", "Les mêmes informations en nombre de nuits : nuits louées sur nuits disponibles, et nombre de nuits nécessaires pour couvrir les charges fixes."],
        ['stay', "Durée moyenne de séjour", "Le nombre de nuits divisé par le nombre de séjours, toutes plateformes et locations directes confondues."],
        ['revpar', "Revenu par nuit disponible", "Le chiffre d'affaires de courte durée divisé par les nuits disponibles : ce que rapporte chaque nuit ouverte à la location, qu'elle soit louée ou non."],
        ['obj', "Objectifs de courte durée", "Si le budget fixe des objectifs : nuits, occupation, prix moyen et chiffre d'affaires d'hébergement réels comparés aux objectifs, bien par bien, avec l'écart."],
        ['paliers', "Compte de résultat en paliers", "Chiffre d'affaires, moins charges variables = marge sur coûts variables (MSCV). Moins charges fixes, dotations aux amortissements comprises = résultat net."],
        ['cats', "Détail par catégorie", "Chaque catégorie de revenus et de charges, en euros et ramenée à une nuit louée (colonne /nuit)."],
        ['fixed', "Charges fixes : tendance et prévision", "L'évolution mensuelle des charges fixes, sa tendance (pointillés) et une projection sur les 10 prochains mois avec sa fourchette."],
        ['var', "Charges variables : tendance et prévision", "La même analyse pour les charges qui varient avec l'activité : ménage, consommables, énergie."],
      ] },
      { name: 'KPIs · Longue durée', scr: 'lld', steps: [
        [null, "Les KPIs de longue durée", "Les indicateurs des biens loués à l'année."],
        ['k1', "Loyers encaissés", "La somme des loyers reçus sur la période et leur évolution."],
        ['k2', "Charges", "Les charges des biens loués à l'année, hors capital d'emprunt remboursé."],
        ['k3', "Cash-flow après crédit", "Loyers moins charges moins capital remboursé : ce qu'il reste une fois le crédit payé, hors apports en compte courant."],
        ['k4', "Mois loués", "La part des mois où un loyer a été encaissé. Un mois sans loyer révèle une vacance ou un impayé."],
        ['k5', "Couverture du crédit", "Loyers divisés par les échéances (capital, intérêts et assurance). Au-dessus de 1, les loyers paient le crédit."],
        ['k6', "Taux de charges", "Charges divisées par loyers encaissés : la part du loyer absorbée par les charges."],
        ['budget', "Réel contre budget", "Loyers, charges, capital et cash-flow de chaque bien depuis janvier, comparés au budget."],
        ['chart', "Loyers, charges et cash-flow par mois", "Chaque mois : loyers, charges et cash-flow. Une barre négative signale un mois déficitaire, par exemple celui de la taxe foncière."],
        ['repart', "Répartition des charges", "Le poids de chaque charge : intérêts, taxe foncière, assurance…"],
        ['heat', "Cash-flow par bien et par mois", "Une case par bien et par mois : verte si le mois est positif, rouge s'il est négatif, avec le total à droite."],
        ['rent', "Rentabilité par bien", "Dernier loyer, mois loués, loyers, charges, crédit, cash-flow, taux de charges et couverture du crédit de chaque bien."],
      ] },
      { name: 'Plateformes', scr: 'plat', steps: [
        [null, "Les plateformes", "D'où viennent vos revenus : Airbnb, Booking, location directe et longue durée."],
        ['k1', "Revenus encaissés", "Le total encaissé sur la période, tous canaux confondus."],
        ['k2', "Dépendance aux plateformes", "La part d'Airbnb et Booking dans la courte durée. Plus elle est élevée, plus vous dépendez de leurs règles et de leurs commissions."],
        ['k3', "Commissions payées", "Le total des commissions et frais prélevés par les plateformes, et leur part du montant brut des réservations."],
        ['k4', "Revenu net par nuit", "Le montant net encaissé divisé par les nuits vendues en courte durée."],
        ['budget', "Revenus par canal : réel contre budget", "Le réel de chaque canal depuis janvier, face au budget, avec l'écart et le pourcentage réalisé."],
        ['bars', "Revenus par canal et par mois", "Chaque barre empile les revenus d'un mois par canal : la saisonnalité et le poids de chaque plateforme apparaissent d'un coup d'œil."],
        ['repart', "Répartition des revenus", "La part de chaque canal dans le total."],
        ['fair', "Fiche Airbnb", "Revenus et part du total, séjours, nuits, durée moyenne, revenu net par nuit, commission, et répartition par bien."],
        ['fbook', "Fiche Booking", "Les mêmes indicateurs pour Booking."],
        ['fdir', "Fiche Location directe", "Les séjours réservés en direct, sans commission. Les nuits viennent de la liste des locations directes (Outils › LCD)."],
        ['flld', "Fiche Longue durée", "Biens loués, loyer moyen par mois et nombre de mois encaissés."],
        ['table', "Revenus par bien et par canal", "Pour chaque bien, ce que rapporte chaque canal, le total et la part des plateformes."],
      ] },
      { name: 'Budget', scr: 'budget', steps: [
        [null, "L'analyse du budget", "Le réel des mois importés comparé au budget de référence de l'année."],
        ['filters', "Année, version, société, bien", "Choisissez l'année, la version de budget, et filtrez par société ou par bien. « Modifier le budget » ouvre l'écran de saisie."],
        ['kpis', "Les quatre indicateurs", "Chiffre d'affaires, charges, résultat avant amortissements et cash-flow net : réel à date, budget à date, écart, et atterrissage estimé de fin d'année face au budget annuel."],
        ['months', "Mois par mois", "Le réel (barres pleines) et le budget (barres grises) de chaque mois. Les boutons changent l'indicateur affiché : chiffre d'affaires, charges, résultat ou cash-flow."],
        ['landing', "Atterrissage de fin d'année", "Pour chaque ligne : budget annuel, réel à date, budget à date, écart, budget des mois restants, atterrissage (réel à date + budget restant) et écart avec le budget annuel."],
        ['gaps', "Détail des écarts", "Par catégorie ou par bien : réel, budget, écart en euros et en %, budget annuel, atterrissage et part du budget déjà consommée."],
        ['obj', "Objectifs de courte durée", "Nuits, occupation, prix moyen et chiffre d'affaires d'hébergement réels face aux objectifs, depuis janvier."],
      ] },
    ],
  },

  marketplace: {
    label: 'Marketplace', color: '#ffb400', open: () => showMarketplace(),
    pages: [
      { name: 'Annonces', scr: 'mktgrid', steps: [
        [null, "Les annonces", "Tous les biens étudiés comme opportunités d'investissement."],
        ['card', "Une annonce", "Type de bien, ville, surface et nombre de pièces, prix, et la note sur 10 calculée par ARTEMIS. Un clic ouvre la fiche complète."],
        ['note', "La note", "La note d'opportunité sur 10 : en vert à partir de 7, en orange entre 4,5 et 7, en rouge en dessous."],
        ['add', "Déposer une annonce", "Ouvre le formulaire pour ajouter un nouveau bien à étudier."],
      ] },
      { name: 'Déposer une annonce', scr: 'mktform', steps: [
        [null, "Le formulaire", "Toutes les informations du bien. Les champs s'adaptent au type choisi."],
        ['type', "Type et DPE", "Le type (appartement, maison, location courte durée, parking, immeuble) adapte les champs et le questionnaire. Le DPE compte pour 8 % de la note."],
        ['addr', "Adresse", "Proposée pendant la frappe, à partir de la base nationale des adresses. Elle place le bien sur la carte et sert à chercher les ventes comparables du secteur (données publiques DVF)."],
        ['price', "Prix, surface, pièces et loyer", "Le loyer mensuel estimé sert à calculer le rendement brut (loyer × 12 ÷ prix), qui compte pour 20 % de la note."],
        ['desc', "Description, photos et contact", "Une description libre, jusqu'à 4 photos et les coordonnées du vendeur ou de l'agence."],
        ['report', "Rapport financier", "Si le bien est déjà suivi dans ARTEMIS, cochez la case et choisissez-le : le dossier PDF inclura ses revenus, charges et résultat réels."],
      ] },
      { name: 'Le score', scr: 'mktform', steps: [
        ['baro', "Baromètre d'opportunité", "Des questions adaptées au type de bien : prix face au marché, état et travaux, environnement, emplacement, transports… Chaque question a un poids, indiqué sous son titre."],
        ['all', "Toutes les questions", "Une réponse par question. La réponse choisie est entourée ; chaque réponse vaut un nombre de points sur 10."],
        ['score', "Score estimé", "La note sur 10 : moyenne pondérée du rendement brut (20 %), du DPE (8 %) et des réponses au questionnaire (72 %). Elle se met à jour à chaque réponse."],
      ] },
      { name: 'Fiche du bien', scr: 'mktdet', steps: [
        [null, "La fiche du bien", "Tout ce qu'il faut pour décider, sur une seule page."],
        ['map', "Carte", "L'emplacement exact en vue satellite ; le bouton en haut à droite bascule sur un plan."],
        ['title', "Titre et note", "Le type, la ville, l'adresse et la note d'opportunité sur 10."],
        ['specs', "Prix, surface, DPE et description", "Les caractéristiques principales du bien."],
        ['market', "Marché du secteur", "Le prix moyen au m² des ventes du secteur sur deux ans (données publiques DVF) et le nombre de ventes prises en compte."],
        ['pdf', "Dossier PDF", "Télécharge un dossier complet du bien, prêt à partager avec une banque ou des associés."],
        ['detail', "Détail du score", "Chaque critère, la réponse retenue, son poids et sa note sur 10."],
        ['analysis', "Analyse Artemis", "Un résumé rédigé : verdict selon la note, niveau du rendement, écart au prix du marché, point fort et point de vigilance."],
      ] },
    ],
  },

  simulateur: {
    label: 'Simulateur', color: '#34d399', open: () => showSimulateur(),
    pages: [
      { name: 'Le projet', scr: 'simform', steps: [
        [null, "La saisie du projet", "Tout ce qui décrit l'investissement. Les calculs reprennent les formules du classeur Excel du simulateur."],
        ['acq', "Coût d'acquisition", "Prix du bien, frais d'agence, frais de notaire (en % du prix, montant affiché dessous), frais de dossier, de courtier, caution ou hypothèque, travaux, mobilier et frais de création de société."],
        ['preview', "Aperçu du projet", "Calculé en direct : coût total, part apport / emprunt, loyers annuels, mensualité, respect de la règle bancaire des 70 % et régime fiscal au meilleur cash-flow."],
        ['fin', "Financement et apport", "Type d'emprunt (classique, différé partiel ou total, in fine), durée, taux, taux d'assurance emprunteur et apport personnel."],
        ['prod', "Produits mensuels", "Loyer hors charges et charges récupérables, en location meublée et en location nue : les deux sont simulées. « Location en société » précise le mode de location retenu pour les régimes en société."],
        ['chg', "Charges annuelles", "Charges locatives, assurances, taxe foncière, entretien, gestion locative (en % des loyers, montant affiché dessous), frais de mise en location, CFE, et frais de gestion par an en nom propre et en société (banque, comptabilité, centre de gestion agréé)."],
        ['foyer', "Foyer fiscal", "Revenus imposables du foyer, situation et nombre d'enfants (qui donnent le nombre de parts), et imposition des dividendes : flat tax ou barème progressif."],
        ['resale', "Revente du bien", "Durée de détention (de 1 à 25 ans, ou pas de revente) et valeur du bien à la revente."],
        ['opts', "Options et réglages", "Nombre de lots, vacance locative, meublé de tourisme, taux d'actualisation utilisé pour la VAN et le TRI, règle de financement bancaire, autre bien déjà en meublé, TVA de la société et amortissement des frais d'acquisition."],
        ['amort', "Amortissement", "En LMNP, en LMP et en société à l'IS, le prix est réparti en composants (gros œuvre, toiture, agencements, électricité, étanchéité), chacun amorti sur sa durée. Le terrain n'est jamais amorti. Durées des travaux, du mobilier et des frais de constitution en dessous."],
        ['actions', "Enregistrer et calculer", "« Enregistrer cette simulation » la garde dans « Mes simulations ». « Calculer » lance la comparaison des régimes."],
      ] },
      { name: 'Synthèse des régimes', scr: 'simres', steps: [
        [null, "La synthèse", "Le résultat de la simulation sur la durée de détention, revente comprise."],
        ['best', "Le meilleur régime", "Le régime au meilleur cash-flow cumulé parmi ceux qui sont possibles, avec son cash-flow, sa VAN, son TRI et son délai de récupération de l'apport (DRCI). « Voir le détail » l'ouvre."],
        ['regimes', "Les 7 régimes comparés", "Cash-flow cumulé, impôt sur les revenus, impôt sur la plus-value, rendement net-net, VAN, TRI, DRCI et règle des 70 %. En vert, la meilleure valeur ; un régime impossible est signalé et classé en dernier. Les en-têtes trient le tableau, une ligne ouvre son détail."],
        ['charts', "Les quatre graphiques", "Cash-flow cumulé, impôts (revenus et plus-value), VAN et TRI de chaque régime, côte à côte. Le meilleur régime est en vert, les régimes impossibles sont grisés."],
      ] },
      { name: 'Lecture des résultats', scr: 'simres', steps: [
        ['origin', "D'où vient le résultat", "Le régime analysé se choisit en haut à droite. Le décompte va des loyers encaissés au cash-flow cumulé (charges, capital, impôts, revente), puis retire l'apport pour donner le gain net."],
        ['cvt', "Cash-flow, VAN, TRI et fiscalité", "La différence entre gain sans et avec le temps (VAN), le rendement annuel équivalent (TRI) et le délai de récupération. À droite, la fiscalité du régime : ce qui est déductible, amortissable, et le total d'impôts."],
        ['attn', "Points d'attention", "Effort d'épargne mensuel, règle bancaire des 70 %, régime impossible ou absence de revente : ce qu'il faut surveiller."],
        ['diag', "Diagnostic", "Ce qui absorbe les loyers de la première année (capital, charges, impôt) et ce qu'il reste par mois."],
        ['levers', "Leviers d'amélioration", "Chaque piste (loyer, prix, taux, durée, gestion…) est recalculée avec le classeur : effet sur le cash-flow mensuel de la première année, sur le cash-flow cumulé et sur la VAN, du plus efficace au moins efficace."],
        ['concl', "La conclusion", "Le levier le plus efficace et la VAN obtenue, et les leviers qui améliorent la trésorerie mais coûtent au total."],
      ] },
      { name: 'Détail d\'un régime', scr: 'simdet', steps: [
        [null, "Le détail d'un régime", "Tout le calcul d'un régime, année par année."],
        ['keys', "Chiffres clés", "Cash-flow cumulé, impôt sur les revenus et sur la plus-value, rendement net-net, VAN, TRI, délai de récupération et règle des 70 %."],
        ['cf', "Cash-flow des années d'exploitation", "Le cash-flow de chaque année (barres) et le cumul (courbe). L'année de revente est résumée dessous pour ne pas écraser l'échelle."],
        ['table', "Résultat et cash-flow", "Le tableau du classeur : produits, charges, résultat imposable, puis du résultat au cash-flow (loyers encaissés, charges payées, capital remboursé, impôt, revente). « Afficher le détail » déplie toutes les lignes."],
        ['tax', "Impôt", "Le calcul de l'impôt de chaque année selon le régime."],
        ['loan', "Tableau d'emprunt", "Mensualité, capital remboursé, intérêts, assurance et capital restant dû, année par année, et le coût total du crédit."],
      ] },
    ],
  },

  budget: {
    label: 'Budget', color: '#4f9eff', open: () => showBudget('home'),
    pages: [
      { name: 'Créer un budget', scr: 'budnew', steps: [
        ['modal', "Nouveau budget", "Un budget est une version pour une année civile. On peut en avoir plusieurs par année ; l'une sert de référence pour les comparaisons."],
        ['yearname', "Année et nom", "L'année concernée et un nom de version, par exemple « Budget initial » ou « Révision de juin »."],
        ['fromreal', "À partir du réel", "Reprend le réel d'une année importée, catégorie par catégorie et mois par mois, avec un ajustement en % sur les produits et sur les charges."],
        ['other', "Copie ou budget vide", "Ou bien copie une version existante, ou part de zéro."],
      ] },
      { name: 'Montants par bien', scr: 'budedit', steps: [
        [null, "La saisie du budget", "Le budget se règle bien par bien et catégorie par catégorie."],
        ['version', "Version et actions", "La version affichée, son badge « comparé au réel », et les actions : nouveau, dupliquer, renommer, repartir du réel, supprimer. « Réel de référence » choisit l'année qui sert de point de comparaison."],
        ['tabs', "Les trois onglets", "Montants par bien, objectifs de courte durée et vue d'ensemble."],
        ['list', "Cash-flow budgété par bien", "La liste des biens, regroupés par SCI, avec leur cash-flow budgété. Un clic ouvre le tableau du bien."],
        ['table', "Le tableau du bien", "Une ligne par catégorie : réel de l'année de référence, évolution en %, montant de chaque mois et total de l'année. Les montants se saisissent dans leur sens naturel (une charge en positif). Un total annuel saisi est réparti sur les mois."],
      ] },
      { name: 'Objectifs courte durée', scr: 'budlcd', steps: [
        ['intro', "Les objectifs", "Pour chaque logement en courte durée, des objectifs de nuits louées et de prix moyen par nuit, comparés ensuite aux KPIs du dashboard."],
        ['lodging', "Un logement", "Nuits et prix par mois, à côté du réel de l'année de référence. ARTEMIS en déduit le taux d'occupation et le chiffre d'affaires d'hébergement visés, et les compare au chiffre d'affaires budgété dans « Montants »."],
      ] },
      { name: 'Vue d\'ensemble', scr: 'budov', steps: [
        ['totals', "Les totaux de l'année", "Produits, charges, résultat avant amortissements et cash-flow net budgétés, et leur évolution par rapport au réel de référence."],
        ['perbien', "Par bien", "Produits, charges d'exploitation et financières, résultat, hors résultat (capital, travaux) et cash-flow de chaque bien, avec l'évolution."],
        ['months', "Mois par mois", "Les mêmes totaux répartis sur les douze mois de l'année."],
      ] },
    ],
  },
};

// ───────── Icônes
const GD_ICON = {
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="M7 4v16l13-8z"/>',
};
const gdSvg = (n, s) => `<svg width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GD_ICON[n]}</svg>`;
const _gdStep = st => ({ id: st[0], t: st[1], p: st[2], ...(st[3] || {}) });
const _gdDur = s => Math.min(16, Math.max(5, 2.6 + (s.t.length + s.p.length) / 17)) * 1000;   // temps de lecture
const GS_W = 1100;   // largeur des écrans redessinés (23-guide-screens.js)

let _gd = { key: null, page: 0, step: 0, playing: true, timer: null, panTimer: null, t0: 0, left: 0, lastFocus: null, x0: null };

function openGuide(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const g = GUIDES[key]; if (!g) return;
  _gd = { key, page: -1, step: 0, playing: true, timer: null, panTimer: null, t0: 0, left: 0, lastFocus: document.activeElement, x0: null };
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
        <span class="gd-count" id="gd-page"></span>
        <button class="gd-close" type="button" onclick="closeGuide()" aria-label="Fermer le guide">${gdSvg('x', 18)}</button>
      </div>
      <div class="gd-body">
        <div class="gd-stage" id="gd-stage" aria-hidden="true">
          <div class="gd-tilt" id="gd-tilt"><div class="gd-cam" id="gd-cam"><div class="gs" id="gs-root"></div><div class="gd-spot" id="gd-spot"></div></div>
            <div class="gd-sheen" id="gd-sheen"></div></div>
        </div>
        <div class="gd-bars" id="gd-bars"></div>
        <div class="gd-cap" id="gd-cap" aria-live="polite"></div>
      </div>
      <div class="gd-foot">
        <div class="gd-ctrl">
          <button class="gd-btn gd-ghost" type="button" id="gd-prev" onclick="guideMove(-1)" aria-label="Étape précédente">${gdSvg('chevron-left', 16)}<span>Précédent</span></button>
          <button class="gd-btn gd-ghost gd-round" type="button" id="gd-play" onclick="guideToggle()"></button>
          <button class="gd-btn gd-next" type="button" id="gd-next" onclick="guideMove(1)"></button>
        </div>
        <div class="gd-dots" role="tablist" aria-label="Écrans du guide">
          ${g.pages.map((pg, i) => `<button type="button" role="tab" class="gd-dot" onclick="guideGo(${i}, 0)" aria-label="${escHtml(pg.name)}" title="${escHtml(pg.name)}"></button>`).join('')}
        </div>
      </div>
    </div>`;
  const st = ov.querySelector('#gd-stage');
  st.addEventListener('touchstart', e => { _gd.x0 = e.touches[0].clientX; }, { passive: true });
  st.addEventListener('touchend', e => {
    if (_gd.x0 == null) return;
    const dx = e.changedTouches[0].clientX - _gd.x0; _gd.x0 = null;
    if (Math.abs(dx) > 50) guideMove(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', _guideKeys);
  window.addEventListener('resize', _guideResize);
  document.documentElement.classList.add('gd-lock');
  ov.classList.add('open');
  guideGo(0, 0);
  requestAnimationFrame(() => { const n = document.getElementById('gd-next'); if (n) n.focus(); });
}

function guideGo(p, s) {
  const g = GUIDES[_gd.key]; if (!g) return;
  p = Math.max(0, Math.min(g.pages.length - 1, p));
  const pg = g.pages[p];
  s = Math.max(0, Math.min(pg.steps.length - 1, s));
  const newPage = p !== _gd.page;
  _gd.page = p; _gd.step = s;
  const seq = _gd.seq = (_gd.seq || 0) + 1;
  clearTimeout(_gd.timer); clearTimeout(_gd.panTimer);
  const step = _gdStep(pg.steps[s]);

  // Barres de progression des étapes de l'écran
  const bars = document.getElementById('gd-bars');
  if (newPage) bars.innerHTML = pg.steps.map((_, k) => `<button type="button" class="gd-bar" onclick="guideGo(${p}, ${k})" aria-label="Étape ${k + 1}"><i></i></button>`).join('');
  [...bars.children].forEach((b, k) => { const i = b.firstChild; i.style.transition = 'none'; i.style.width = k < s ? '100%' : '0%'; });

  // Texte
  const cap = document.getElementById('gd-cap');
  cap.classList.remove('in'); void cap.offsetWidth;
  cap.innerHTML = `<div class="gd-step">Étape ${s + 1} sur ${pg.steps.length}</div><h3>${escHtml(step.t)}</h3><p>${escHtml(step.p)}</p>`;
  cap.classList.add('in');
  document.getElementById('gd-page').textContent = `${pg.name} · ${p + 1} / ${g.pages.length}`;
  document.querySelectorAll('.gd-dot').forEach((d, k) => { d.classList.toggle('on', k === p); d.setAttribute('aria-selected', k === p); });
  const first = p === 0 && s === 0, last = p === g.pages.length - 1 && s === pg.steps.length - 1;
  document.getElementById('gd-prev').disabled = first;
  document.getElementById('gd-next').innerHTML = last ? `<span>Ouvrir ${escHtml(g.label)}</span>${gdSvg('arrow-right', 16)}` : `<span>Suivant</span>${gdSvg('chevron-right', 16)}`;
  _guidePlayBtn();

  // Écran redessiné : construit à l'arrivée sur la page
  const root = document.getElementById('gs-root');
  if (newPage) {
    root.innerHTML = (typeof GS_SCREENS !== 'undefined' && GS_SCREENS[pg.scr]) ? GS_SCREENS[pg.scr]() : '';
    root.className = 'gs';
    root.style.setProperty('--ac', g.color);
    _guideEnter();
  }
  // États de l'écran (ex. fichiers chargés) : cumul des étapes déjà passées
  const states = new Set(); pg.steps.slice(0, s + 1).forEach(x => { const o = _gdStep(x); if (o.st) states.add(o.st); });
  [...root.classList].filter(c => c.startsWith('st-')).forEach(c => { if (!states.has(c.slice(3))) root.classList.remove(c); });
  root.querySelectorAll('.gd-on').forEach(e => e.classList.remove('gd-on'));
  const el = step.id ? root.querySelector(`[data-gd="${step.id}"]`) : null;
  if (el) el.classList.add('gd-on');

  _guideCamera(step, newPage);
  if (newPage) _gsEnter(root, el, seq);
  else if (el) _gsReplay(el, .7, seq);
  else _gsEnter(root, null, seq, true);
  states.forEach(st => { if (!root.classList.contains('st-' + st)) { (el || root).style.setProperty('--b', '.9s'); root.classList.add('st-' + st); } });
  _guideTimer(step);
}

// Position d'un élément dans l'écran (pixels de l'écran, indépendants du zoom)
function _gsRect(el, root) {
  let x = 0, y = 0, e = el;
  while (e && e !== root) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
  return [x, y, x + el.offsetWidth, y + el.offsetHeight];
}

// Animations : chaque élément rejoue les siennes (tracé, barres, lignes, chiffres)
function _gsRestart(scope) {
  if (!scope.getAnimations) return;
  scope.getAnimations({ subtree: true }).forEach(a => { if (a.animationName === 'gsCard') return; try { a.cancel(); a.play(); } catch (e) { /* animation déjà retirée */ } });
}
function _gsCount(n, delay, seq) {
  const v = +n.dataset.v, d = +n.dataset.d, sg = n.dataset.s === '1', u = n.dataset.u;
  const fmt = x => (sg && x > 0 ? '+' : '') + gsF(x, d) + u, dur = 1100;
  const fin = () => { n.textContent = fmt(v); };
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return fin();
  const t0 = performance.now() + delay * 1000;
  n.textContent = fmt(0);
  const tick = () => {
    if (seq !== _gd.seq) return fin();
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / dur));
    n.textContent = k >= 1 ? fmt(v) : fmt(v * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(fin, delay * 1000 + dur + 150);          // valeur finale garantie
}
function _gsEnter(root, focus, seq, noCards) {
  const comps = [...root.querySelectorAll('.gs-c')];
  comps.forEach((c, k) => c.style.setProperty('--b', (.35 + Math.min(k, 16) * .06).toFixed(2) + 's'));
  if (focus) focus.style.setProperty('--b', '1.05s');
  if (!noCards) {
    root.classList.add('enter');
    setTimeout(() => { if (_gd.seq >= seq) root.classList.remove('enter'); }, 2600);
  }
  _gsRestart(root);
  root.querySelectorAll('.gs-n').forEach(n => { const c = n.closest('.gs-c'); _gsCount(n, c ? parseFloat(c.style.getPropertyValue('--b')) || .4 : .4, seq); });
}
function _gsReplay(el, delay, seq) {
  el.style.setProperty('--b', delay + 's');
  el.querySelectorAll('.gs-c').forEach(c => c.style.setProperty('--b', delay + 's'));
  _gsRestart(el);
  el.querySelectorAll('.gs-n').forEach(n => _gsCount(n, delay, seq));
}

// Cadrage : l'élément est centré et entier (marge comprise) ; s'il est trop haut, la caméra le parcourt de haut en bas
function _guideCamera(step, instant) {
  const stage = document.getElementById('gd-stage'), cam = document.getElementById('gd-cam'), spot = document.getElementById('gd-spot'), root = document.getElementById('gs-root');
  if (!stage || !root) return;
  const SW = stage.clientWidth, SH = stage.clientHeight, H = root.offsetHeight;
  const el = step.id ? root.querySelector(`[data-gd="${step.id}"]`) : null;
  const ease = 'transform 1.15s cubic-bezier(.65,0,.35,1)';
  cam.style.transition = instant ? 'none' : ease;
  clearTimeout(_gd.panTimer);
  let s, tx, ty, ty2 = null;
  if (!el) {
    s = SW / GS_W; tx = 0;
    if (H * s <= SH) ty = (SH - H * s) / 2; else { ty = 0; ty2 = SH - H * s; }
    spot.classList.remove('on');
  } else {
    const [x1, y1, x2, y2] = _gsRect(el, root), pad = 22, w = x2 - x1, h = y2 - y1;
    const maxS = Math.min(1.7, SW / 560);                 // jamais trop zoomé : on garde du contexte
    const sw = Math.min(SW / (w + 2 * pad), maxS), sh = SH / (h + 2 * pad);
    const readable = .78 * SW / 1000;                      // en dessous, le texte devient trop petit
    if (sh >= Math.min(sw, readable) * .93) { s = Math.min(sw, sh); ty = SH / 2 - (y1 + h / 2) * s; }      // tient en entier
    else { s = Math.min(sw, Math.max(readable, sh)); ty = -(y1 - pad) * s; ty2 = SH - (y2 + pad) * s; }   // grand bloc : parcours vertical
    tx = SW / 2 - (x1 + w / 2) * s;
    spot.style.setProperty('--s', s);
    Object.assign(spot.style, { left: (x1 - 6) + 'px', top: (y1 - 6) + 'px', width: (w + 12) + 'px', height: (h + 12) + 'px' });
    spot.classList.add('on');
  }
  cam.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  if (instant) { void cam.offsetWidth; cam.style.transition = ease; }
  _gd.view = { s, tx, ty, SW, SH };
  if (ty2 != null && ty2 < ty) {
    const dur = _gdDur(step) - 2600;
    _gd.panTimer = setTimeout(() => { cam.style.transition = `transform ${Math.max(2, dur / 1000)}s cubic-bezier(.45,0,.55,1)`; cam.style.transform = `translate(${tx}px, ${ty2}px) scale(${s})`; }, 1300);
  }
}

// Entrée d'un nouvel écran : bascule 3D et reflet
function _guideEnter() {
  const t = document.getElementById('gd-tilt'), sh = document.getElementById('gd-sheen');
  if (!t) return;
  t.classList.remove('enter'); sh.classList.remove('run'); void t.offsetWidth;
  t.classList.add('enter'); sh.classList.add('run');
}

function _guideTimer(step) {
  clearTimeout(_gd.timer);
  const d = _gdDur(step), bar = document.querySelectorAll('#gd-bars .gd-bar i')[_gd.step];
  _gd.left = d; _gd.t0 = performance.now();
  if (!_gd.playing) return;
  if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = `width ${d}ms linear`; bar.style.width = '100%'; }
  _gd.timer = setTimeout(() => guideMove(1, true), d);
}

function guideMove(dir, auto) {
  const g = GUIDES[_gd.key]; if (!g) return;
  let p = _gd.page, s = _gd.step + dir;
  if (s >= g.pages[p].steps.length) {
    if (p === g.pages.length - 1) { if (auto) { _gd.playing = false; _guidePlayBtn(); return; } const open = g.open; closeGuide(true); open(); return; }
    p++; s = 0;
  } else if (s < 0) { if (p === 0) return; p--; s = g.pages[p].steps.length - 1; }
  guideGo(p, s);
}

function guideToggle() {
  _gd.playing = !_gd.playing;
  const bar = document.querySelectorAll('#gd-bars .gd-bar i')[_gd.step];
  const g = GUIDES[_gd.key], step = _gdStep(g.pages[_gd.page].steps[_gd.step]);
  if (!_gd.playing) {
    clearTimeout(_gd.timer);
    _gd.left = Math.max(0, _gd.left - (performance.now() - _gd.t0));
    if (bar) { const w = getComputedStyle(bar).width; bar.style.transition = 'none'; bar.style.width = w; }
  } else {
    const d = _gdDur(step), left = _gd.left || d;
    _gd.t0 = performance.now(); _gd.left = left;
    if (bar) { void bar.offsetWidth; bar.style.transition = `width ${left}ms linear`; bar.style.width = '100%'; }
    _gd.timer = setTimeout(() => guideMove(1, true), left);
  }
  _guidePlayBtn();
}
function _guidePlayBtn() {
  const b = document.getElementById('gd-play'); if (!b) return;
  b.innerHTML = gdSvg(_gd.playing ? 'pause' : 'play', 16);
  b.setAttribute('aria-label', _gd.playing ? 'Mettre en pause' : 'Lecture');
}

function _guideResize() {
  const g = GUIDES[_gd.key]; if (!g || _gd.page < 0) return;
  _guideCamera(_gdStep(g.pages[_gd.page].steps[_gd.step]), true);
}

function closeGuide(skipFocus) {
  clearTimeout(_gd.timer); clearTimeout(_gd.panTimer);
  const ov = document.getElementById('gd-overlay');
  if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
  document.removeEventListener('keydown', _guideKeys);
  window.removeEventListener('resize', _guideResize);
  document.documentElement.classList.remove('gd-lock');
  if (!skipFocus && _gd.lastFocus && _gd.lastFocus.focus) _gd.lastFocus.focus();
  _gd.key = null;
}

function _guideKeys(e) {
  if (!_gd.key) return;
  if (e.key === 'Escape') { e.preventDefault(); closeGuide(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); guideMove(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); guideMove(-1); }
  else if (e.key === ' ' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); guideToggle(); }
  else if (e.key === 'Tab') {   // garder le focus dans la fenêtre
    const f = [...document.querySelectorAll('#gd-overlay button:not([disabled])')];
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
