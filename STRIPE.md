# Activer les paiements (Stripe) — guide pas à pas

Tout est **déjà codé et désactivé**. Les achats de Lunes par carte n'apparaissent dans le jeu que lorsque les 3 variables
ci-dessous sont définies sur le serveur. Sans elles, le jeu fonctionne exactement comme avant (boutique 100 % Lunes gagnées).

> ⚠️ Ceci n'est pas un avis juridique ou fiscal. Avant d'encaisser le moindre euro : statut d'entrepreneur, CGV/confidentialité
> relues (modèles dans `public/legal/`, champs jaunes `[À COMPLÉTER]`), et conseil d'un expert-comptable.

## 0. Prérequis (hors technique)
1. **Statut** : en France, micro-entreprise (guichet unique de l'INPI/URSSAF) ou autre structure. Notez votre SIRET.
2. **Compléter** `public/legal/cgv.html`, `confidentialite.html`, `mentions.html` (tous les champs jaunes), faire relire.
3. **Décider des prix** : les 4 packs de `server/payments.js` (`PACKS`) sont des **exemples** (1,99 / 3,99 / 7,99 / 17,99 €).
4. **Marque** : recherche d'antériorité « Korvalune » (INPI, EUIPO/TMview), puis dépôt si vous êtes satisfait.

## 1. Compte Stripe (mode TEST d'abord)
1. Créez un compte sur https://dashboard.stripe.com (laissez le **mode test** activé : interrupteur « Test mode »).
2. *Developers → API keys* : copiez la **clé secrète de test** (`sk_test_…`).
3. *Developers → Webhooks → Add endpoint* :
   - URL : `https://VOTRE-ADRESSE/api/stripe-webhook` (votre adresse Render)
   - Événements : `checkout.session.completed` **et** `checkout.session.async_payment_succeeded`
   - Après création, copiez le **Signing secret** (`whsec_…`).

## 2. Variables d'environnement sur Render
Service → *Environment* → ajoutez :

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (puis `sk_live_…` au passage en production) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `PUBLIC_URL` | l'adresse publique du jeu, sans `/` final (ex. `https://legends-of-aetheria-mxaq.onrender.com`) |

Enregistrez : Render redéploie. Dans la boutique 🌙 du jeu, une section **« Acheter des Lunes »** apparaît avec la mention « Mode test ».

## 3. Tester
Achetez un pack avec la carte de test `4242 4242 4242 4242` (date future, CVC quelconque). Vous revenez sur le jeu, et les Lunes
sont créditées en quelques secondes (par le webhook, jamais par le navigateur). Vérifiez aussi dans les logs Render la ligne
`paiement crédité : …`. Cartes de test d'échec : https://docs.stripe.com/testing

## 4. Passer en production
1. Terminez l'activation du compte Stripe (identité, IBAN) — Stripe vous guide.
2. Basculez le dashboard en **mode live**, recréez le webhook (mêmes événements) et récupérez `sk_live_…` + le nouveau `whsec_…`.
3. Remplacez les 2 variables sur Render. Faites un achat réel d'un petit montant avec votre propre carte pour valider.
4. Activez les reçus e-mail (*Settings → Emails*) et, si nécessaire, **Stripe Tax** (TVA).

## Comment c'est protégé
- La carte n'est jamais saisie dans le jeu : redirection vers la page de paiement hébergée par Stripe.
- Le crédit des Lunes ne se fait **que** par le webhook signé (HMAC-SHA256, tolérance anti-rejeu 5 min).
- Le serveur revérifie pack, devise (EUR) et montant exact avant de créditer ; chaque session n'est créditée **qu'une fois** (idempotent).
- Consentement exprès + renoncement au droit de rétractation (case à cocher obligatoire, horodatée dans les métadonnées Stripe).
- Limite de 8 créations de paiement / 10 min / IP.
- Journal des achats par compte dans `data/accounts.json` (`shop.paid`).

## Limites connues (à traiter plus tard)
- **Remboursements / litiges** : pas gérés automatiquement (les Lunes déjà dépensées ne sont pas retirées). Gérez-les à la main dans Stripe.
- Aucun outil d'administration (consulter/corriger un compte) : à faire dans `data/accounts.json` en dernier recours.
- Stockage des comptes dans un fichier JSON : suffisant pour démarrer, à remplacer par une vraie base de données avant une grosse affluence.
- Non testé avec un vrai compte Stripe (testé avec un faux serveur Stripe local et des événements signés simulés).
