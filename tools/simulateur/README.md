# Simulateur — calculs identiques au classeur Excel

Le simulateur du site n'a pas ses propres règles de calcul : il exécute les formules du
classeur « Simulateur de Rentabilité » (V4), extraites dans `js/17-simulateur-modele.js`.

| Fichier | Rôle |
|---|---|
| `js/17-simulateur-modele.js` | **Généré.** Les 26 325 formules (→ 1 113 modèles relatifs) et les valeurs fixes du classeur. |
| `js/16-simulateur-moteur.js` | Moteur qui exécute ces formules avec la sémantique d'Excel (SI, SIERREUR, RECHERCHEH/V, INDEX/EQUIV, SOMME.SI.ENS, SOMMEPROD, VAN, TRI, ARRONDI, formules matricielles, erreurs). |
| `js/15-simulateur.js` | Formulaire = onglet « ✏️ A COMPLÉTER » (`SIM_CELLS` : champ → cellule). |
| `js/18-simulateur-resultats.js` | Synthèse = onglet « 💰 SYNTHÈSE » ; détail d'un régime = son onglet. |
| `tools/simulateur/xl_oracle.py` | Moteur de référence en Python (même algorithme), vérifié sur les valeurs enregistrées par Excel. |
| `tools/simulateur/build_model.py` | Régénère `js/17-simulateur-modele.js` depuis le classeur. |
| `tools/simulateur/check_model.py` | Compare le moteur du site au moteur de référence sur des centaines de simulations aléatoires. |

## Nouvelle version du classeur

```
python3 tools/simulateur/build_model.py "~/Desktop/Simulateur de Rentabilité_V5.xlsm"
python3 tools/simulateur/check_model.py "~/Desktop/Simulateur de Rentabilité_V5.xlsm" 200
```

Si des cellules de saisie changent de place, mettre à jour `SIM_CELLS` (js/15) ; si les onglets
de régime ou la synthèse changent de structure, `SIM_REGIMES` / `SIM_COLS` (js/18).

## Limite connue : le TRI

L'algorithme du TRI d'Excel n'est pas public. Celui du moteur a été reconstitué en comparant
plus de 28 000 TRI calculés par Excel : Newton sur 1/(1+taux) depuis le taux d'actualisation,
puis, en cas d'échec, Newton sur le taux depuis −10 %. Résultat identique dans 99,5 % des cas
réalistes ; les écarts restants concernent des projets en perte (TRI très négatif, Excel
affichant parfois « Pas de TRI » là où le site donne un taux, ou l'inverse).
