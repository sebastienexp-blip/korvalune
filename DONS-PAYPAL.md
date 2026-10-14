# Dons PayPal (V10.55)

**Principe** : le jeu n'a aucun accès à PayPal. Il affiche le lien de réception du créateur (par défaut le QR « Recevoir des paiements »
configuré dans `server/donations.js`, surchargeable par la variable `PAYPAL_DONATE_URL`). Le donateur donne sur PayPal, puis déclare son
don dans la Boutique des Lunes ; le créateur vérifie la réception sur PayPal et valide dans le jeu : les Lunes de remerciement sont créditées.

**Barème** (`src/data/donations.js`) : 100 Lunes par euro, +20 % dès 5 € (600), +50 % dès 10 € (1 500), +60 % dès 25 € (4 000) (de 1 € à 200 €).
Les Lunes n'ont aucun effet en combat (apparence et confort seulement).

## Mise en route (une seule fois)
Dans Render → Environment, ajouter `OWNER_ACCOUNTS` = le nom de votre compte de jeu (plusieurs : séparés par des virgules), puis redéployer.
Connecté avec ce compte, la Boutique des Lunes affiche en plus « Dons à valider » : montant déclaré (modifiable si le montant reçu diffère),
boutons **Valider** (crédite) et **Refuser**. Une demande ne peut être traitée qu'une fois.

## Sécurité
- Seul un compte listé dans `OWNER_ACCOUNTS` peut valider (vérifié par le serveur, pas par le jeu).
- Un joueur ne peut avoir que 3 demandes en attente ; montants de 1 à 200 € ; les Lunes sont calculées par le serveur.
- Aucune donnée bancaire dans le jeu. Seules les adresses https paypal.com / paypal.me sont acceptées pour le lien.
