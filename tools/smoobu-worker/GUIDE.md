# Brancher Smoobu sur ARTEMIS

ARTEMIS affiche les réservations Smoobu en temps réel dans le **Calendrier**
(vue Mois et Planning) et dans l'agenda de l'**Accueil**.

Smoobu interdit d'appeler son API directement depuis un site web, et la clé
doit rester secrète. On passe donc par un petit **relais Cloudflare** gratuit
(sans carte bancaire) qui garde la clé, vérifie que la personne est connectée
à ARTEMIS, puis interroge Smoobu.

Compter environ 15 minutes.

---

## 1. Créer la clé API dans Smoobu

1. Smoobu › **Paramètres › Avancé › Clés API**.
2. **Créer une clé API**, nom : `ARTEMIS`.
3. Cocher l'option **Données invités** si elle est proposée (sinon les noms
   des voyageurs arrivent vides).
4. **Générer le secret**.
5. Noter la **clé** et le **secret** quelque part de sûr, le temps de l'étape 3.
   Le secret ne s'affiche qu'une seule fois.

> Ne jamais coller la clé ni le secret dans ARTEMIS, dans un e-mail ou un message :
> ils ne doivent exister que dans Cloudflare.

## 2. Créer le relais dans Cloudflare

1. Créer un compte gratuit sur <https://dash.cloudflare.com/sign-up>
   (aucune carte bancaire n'est demandée pour l'offre gratuite).
2. Dans le menu de gauche : **Compute (Workers) › Workers & Pages**,
   puis **Create › Create Worker** (modèle « Hello World »).
3. Nom du Worker : `artemis-smoobu`, puis **Deploy**.
4. Cliquer sur **Edit code**, tout effacer, puis coller le contenu de
   [`worker.js`](https://raw.githubusercontent.com/Medenzo1/artemis/main/tools/smoobu-worker/worker.js).
5. **Deploy**.

## 3. Ajouter les réglages du relais

Dans le Worker : **Settings › Variables and Secrets › Add**.

| Nom | Type | Valeur |
|---|---|---|
| `SMOOBU_API_KEY` | **Secret** | la clé Smoobu |
| `SMOOBU_API_SECRET` | **Secret** | le secret Smoobu |
| `FIREBASE_PROJECT_ID` | Text | `artemis-sci` |
| `ALLOWED_ORIGINS` | Text | `https://medenzo1.github.io,http://localhost:8765` |
| `ALLOWED_EMAILS` | Text | les e-mails des comptes ARTEMIS autorisés, séparés par des virgules |

Enregistrer (**Deploy** si Cloudflare le demande).

## 4. Vérifier que le relais répond

Ouvrir dans le navigateur l'adresse du Worker suivie de `/health`, par exemple
`https://artemis-smoobu.votre-nom.workers.dev/health`. On doit voir :

```
{"ok":true,"configured":true}
```

`"configured":false` : une des variables de l'étape 3 manque.

## 5. Brancher ARTEMIS

1. ARTEMIS › cliquer sur son **profil** (en bas de la barre latérale) › **Paramètres**.
2. Carte **Smoobu** : coller l'adresse du Worker (sans `/health`).
3. **Tester et enregistrer**.
4. Vérifier la correspondance **logement Smoobu → bien ARTEMIS**
   (proposée automatiquement d'après les noms). Un logement peut aussi être
   affiché sous son nom Smoobu, ou masqué.

Le réglage est partagé : les autres comptes autorisés n'ont rien à refaire.

---

## En cas de problème

La pastille **Smoobu** en haut du Calendrier devient rouge en cas d'erreur ;
le détail s'affiche au survol.

| Message | Que faire |
|---|---|
| Relais injoignable | Vérifier l'adresse collée dans ARTEMIS. |
| Session invalide ou expirée | Se déconnecter puis se reconnecter à ARTEMIS. |
| Compte non autorisé pour Smoobu | Ajouter l'e-mail du compte dans `ALLOWED_EMAILS`. |
| Smoobu a répondu 401 | Clé ou secret incorrect (ou secret régénéré) : refaire l'étape 1 et mettre à jour les deux secrets. |
| Clé Smoobu non configurée | Ajouter `SMOOBU_API_KEY` et `SMOOBU_API_SECRET`. |

## Sécurité

- La clé et le secret restent chiffrés dans Cloudflare ; le site ne les voit jamais.
- Le relais refuse toute demande sans connexion ARTEMIS valide, ou venant d'un
  e-mail absent de `ALLOWED_EMAILS`.
- En cas de doute, régénérer le secret dans Smoobu puis le remplacer dans Cloudflare.
- Coût : offre gratuite Cloudflare (100 000 requêtes par jour) ; ARTEMIS garde
  les réservations 5 minutes en mémoire et le relais 2 minutes, ce qui limite
  fortement les appels.
