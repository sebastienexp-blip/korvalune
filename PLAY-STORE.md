# Publier Korvalune sur Google Play

L'application Android est une coquille autour du jeu en ligne (`android-app/`) : toute mise à jour du jeu arrive sans republier sur le Play Store. Il ne faut republier que si on change l'application elle-même.

## Ce qui est déjà prêt dans le dépôt
- Projet Android à jour : API 36 (exigée par Google), numéro de version 1065 / 10.65.0.
- Dons PayPal **masqués dans l'application** (Google interdit de récompenser un paiement externe par de la monnaie virtuelle). Ils restent sur le site et pour le créateur.
- Construction automatique du paquet signé `.aab` sur GitHub (workflow « Construire l'APK Android »).
- Visuels : `docs/play/icon-512.png`, `docs/play/feature-graphic-1024x500.png`, `docs/play/screenshots/`.
- Textes de la fiche : `docs/play/FICHE-STORE.md`.
- Pages : confidentialité `/legal/confidentialite.html`, suppression de compte `/legal/suppression-compte.html`.

## Étapes pour toi

### 1. Compte développeur Google Play (25 $, une seule fois)
https://play.google.com/console/signup — compte **personnel**, vérification d'identité (pièce d'identité + téléphone). Compter quelques jours.

### 2. Règle des testeurs (comptes personnels créés après nov. 2023)
Avant la production : un **test fermé avec au moins 12 testeurs, pendant 14 jours consécutifs**. Ils doivent accepter l'invitation (ils fournissent leur adresse Gmail) et garder l'appli installée. Recrute-les dès maintenant (amis, famille, joueurs du jeu).

### 3. Clé de signature (à faire une fois, sur ton PC, ne jamais la partager)
Avec Java installé :
```
keytool -genkeypair -v -keystore korvalune.jks -alias korvalune -keyalg RSA -keysize 2048 -validity 10000
```
Choisis tes mots de passe toi-même et **garde le fichier .jks et les mots de passe en lieu sûr** (sauvegarde hors ordinateur). Puis encode le fichier :
- Linux/Mac : `base64 -w0 korvalune.jks`
- Windows (PowerShell) : `[Convert]::ToBase64String([IO.File]::ReadAllBytes("korvalune.jks"))`

Sur GitHub → dépôt → Settings → Secrets and variables → Actions → New repository secret, crée **ces 4 secrets** (jamais dans le chat) :
`KORVALUNE_KEYSTORE_B64` (le texte base64), `KORVALUNE_STORE_PASSWORD`, `KORVALUNE_KEY_ALIAS` (korvalune), `KORVALUNE_KEY_PASSWORD`.

### 4. Construire le paquet
GitHub → Actions → « Construire l'APK Android » → Run workflow. À la fin, télécharge l'artefact **Korvalune-playstore-aab** (fichier `app-release.aab`).

### 5. Créer l'application dans la Play Console
Créer l'application → nom « Korvalune », français, jeu, gratuit. Puis remplir (réponses prêtes dans `docs/play/FICHE-STORE.md`) :
- Fiche (textes, icône, bannière, captures d'écran)
- Politique de confidentialité : `https://legends-of-aetheria-mxaq.onrender.com/legal/confidentialite.html`
- Sécurité des données, classification du contenu, public cible, application sans publicité, suppression de compte
- Test fermé → Créer une version → importer le `.aab` → ajouter la liste des testeurs → envoyer en examen
- Cocher « Play App Signing » (recommandé) quand Google le propose.

### 6. Après 14 jours
Console → « Demander l'accès à la production » → répondre au questionnaire → publication.

## Points à connaître
- **Suppression de compte** : Google exige que l'on puisse demander la suppression d'un compte créé dans l'appli. Pour respecter ta consigne (aucun bouton de suppression), la page `/legal/suppression-compte.html` explique la demande via « Contacter l'administrateur ». Google peut demander un moyen accessible sans connexion : si besoin, on ajoutera une adresse e-mail de contact (à toi de la choisir).
- **Disponibilité du site** : l'appli charge le jeu en ligne. Si l'hébergement Render gratuit est endormi, le premier chargement est lent ; un hébergement payant améliore l'avis des testeurs.
- Pour changer le nom de domaine du jeu : modifier `GAME_URL` et `GAME_HOST` dans `MainActivity.java`, puis republier.
- À chaque republication sur Play : augmenter `versionCode` dans `android-app/app/build.gradle`.
