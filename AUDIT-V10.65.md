# Audit V10.65 (14 octobre 2026)

**Vérifié** : variables non définies et imports cassés (analyse TypeScript de tout le code : aucun), cohérence des données (97 monstres, 184 objets, 29 PNJ, quêtes principales / secondaires / tutoriel : aucun lien cassé), fichiers audio (919, tous référencés), tests serveur (anti-triche, dons, récupération de compte, administration, annonces), démarrage du jeu complet dans un navigateur de test (0 erreur), boost d'XP, invasions, annonces.

**Corrigé** : boutique des Lunes vide (variable manquante, V10.60) ; annonces invisibles à l'écran (transition CSS bloquée) ; invasion sans effet pour un joueur en ville ; jetons de session valides après changement de mot de passe ; serveur sans filet de sécurité (erreur isolée = arrêt pour tous) ; comptes non enregistrés lors d'un redémarrage ; fichier des comptes deux fois plus gros que nécessaire ; 45 Mo de modèles de test inutiles dans la version en ligne ; compteur d'annonce erroné.

**À surveiller** : le fichier des comptes est réécrit en entier à chaque sauvegarde (correct jusqu'à quelques centaines de joueurs actifs, puis il faudra une vraie base de données) ; le programme d'installation Windows n'a jamais été essayé sur un vrai PC ; les boosts / invasions ne concernent que les joueurs ayant la dernière version.
