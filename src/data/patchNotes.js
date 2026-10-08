// V10.3 — Notes de mise à jour affichées aux joueurs (menu principal et page de connexion).
// Pour publier une nouveauté : ajouter une entrée EN HAUT de la liste (la première est la plus récente) et mettre à jour
// la version dans package.json et dans le libellé de src/ui/HUD.js (#build-version). Écrire pour les joueurs : court, concret.
export const PATCH_NOTES = [
  {
    version: '10.12', title: 'Apparence et barbier',
    items: [
      'Nouveau à la création : choisis le sexe, la taille, la corpulence et la musculature de ton héros, la forme du visage, des yeux et du nez, la barbe, et une coupe parmi 23 (hommes, femmes et mixtes).',
      'Nouveau : la barbière Odile t’attend devant la maison à l’enseigne ✂ Barbier, rue sud-ouest. Elle change ton apparence contre des pièces d’or : seules les catégories modifiées sont payées.',
      'Les autres joueurs voient ta nouvelle apparence. Les personnages existants gardent exactement leur look d’origine tant qu’ils ne passent pas chez le barbier.'
    ]
  },
  {
    version: '10.11', title: 'Korvalune sur Android (APK)',
    items: [
      'Nouveau : une application Android (.apk) ouvre Korvalune en plein écran, sans barre d’adresse.',
      'Elle utilise le jeu en ligne : les mises à jour du jeu arrivent toutes seules, sans réinstaller l’application.',
      'Une connexion internet est nécessaire. Le bouton retour du téléphone ouvre le menu pause au lieu de quitter le jeu.'
    ]
  },
  {
    version: '10.10', title: 'L’écurie de Korvalune',
    items: [
      'Nouveau : le Maître d’écurie Bram t’attend à l’est de la porte sud. Il vend 3 chevaux et 2 griffons, payables en pièces d’or du jeu.',
      'Monte et descends avec le bouton 🐎 (ou la touche H) : les chevaux vont bien plus vite que la marche.',
      'Les griffons volent au-dessus de l’eau, des falaises et des obstacles. On ne combat pas en vol : pose-toi d’abord, sur un terrain dégagé.',
      'Les autres joueurs voient ta monture. Les montures sont interdites dans les spires. Le niveau requis est indiqué pour chaque monture.'
    ]
  },
  {
    version: '10.9', title: 'Échanges entre joueurs',
    items: [
      'Nouveau bouton « 🔁 Échanger » dans le menu 👥 (amis en ligne et joueurs proches) : propose un échange d’objets à un autre joueur connecté à son compte.',
      'Chacun choisit jusqu’à 6 objets ; l’échange n’a lieu que si les deux joueurs confirment, et il est annulé dès que l’offre change.',
      'Seuls les objets de l’inventaire s’échangent : ni pièces, ni Lunes, ni cosmétiques de la boutique.'
    ]
  },
  {
    version: '10.8', title: 'Messages entre amis',
    items: [
      'Nouveau bouton « ✉️ Message » sur chaque ami (menu 👥) : tu peux lui écrire même s’il est hors ligne.',
      'Il retrouve tes messages à sa prochaine connexion. Une pastille rouge sur 👥 signale les messages non lus.',
      'Les 40 derniers messages de chaque conversation sont conservés. Seuls tes amis peuvent t’écrire.'
    ]
  },
  {
    version: '10.7', title: 'Affichage, son et réglages',
    items: [
      'Menu principal et écran de jeu réorganisés pour les téléphones en paysage : plus de boutons qui se chevauchent ni de menu coupé.',
      'Le bruit ambiant (vent, oiseaux, grillons) est beaucoup plus discret, et ton réglage « Ambiance » est enfin appliqué dès le lancement.',
      'Tes réglages sont maintenant enregistrés sur ton compte : tu les retrouves à chaque connexion, même avec un autre lien ou un autre appareil.'
    ]
  },
  {
    version: '10.6', title: 'Mises à jour automatiques',
    items: [
      'Quand une nouvelle version du jeu est publiée, un bandeau « Mettre à jour » apparaît tout seul : plus besoin de penser à actualiser la page.',
      'Ta partie est sauvegardée avant le rechargement. Rien n’est jamais rechargé de force en plein combat.'
    ]
  },
  {
    version: '10.5', title: 'La boutique a enfin son menu',
    items: [
      'Nouveau bouton « 🌙 Boutique des Lunes » dans le menu principal et dans le menu pause.',
      'Depuis le menu principal, tu peux voir ton solde, récupérer la récompense du jour et acheter (l’aperçu « Essayer » reste réservé au jeu).',
      'En jeu, le bouton 🌙 devient une pastille violette avec « Boutique » écrit dessous, plus facile à repérer.'
    ]
  },
  {
    version: '10.4', title: 'Les Lunes deviennent rares',
    items: [
      'Équilibrage de la monnaie de la boutique : 15 Lunes offertes, 3 par jour, et 2 Lunes tous les 5 niveaux.',
      'Les objets déjà achetés et vos Lunes actuelles sont conservés.'
    ]
  },
  {
    version: '10.3', title: 'Notes de mise à jour & pages légales',
    items: [
      'Nouveau : cette page « Nouveautés », accessible depuis le menu principal et la page de connexion.',
      'Conditions de vente, politique de confidentialité et mentions légales disponibles depuis la boutique.'
    ]
  },
  {
    version: '10.2', title: 'Préparation des paiements',
    items: [
      'La boutique des Lunes pourra bientôt proposer l’achat de Lunes par carte bancaire, sur la page sécurisée de notre prestataire de paiement. Rien n’est encore ouvert.',
      'Les Lunes restent toujours gagnables en jouant : récompense du jour et montée de niveau.'
    ]
  },
  {
    version: '10.1', title: 'La boutique des Lunes',
    items: [
      'Nouveau bouton 🌙 en jeu : la boutique des Lunes (monnaie du jeu). 50 Lunes offertes, +20 par jour, +3 par niveau gagné.',
      '22 objets : auras d’arme, cercles au sol, traînées, ailes, titres affichés au-dessus de votre nom, et 4 onglets de coffre supplémentaires.',
      'Aucun objet de la boutique ne donne de puissance au combat : apparence et confort uniquement.',
      'Bouton « Essayer » pour voir un objet sur votre personnage avant de l’acheter. Les autres joueurs voient vos cosmétiques.'
    ]
  },
  {
    version: '10.0', title: 'Le jeu devient Korvalune',
    items: [
      'Nouveau nom, nouveau logo : bienvenue dans Korvalune !',
      'Vos comptes, personnages et sauvegardes sont conservés.'
    ]
  },
  {
    version: '9.5', title: 'Jeu en ligne permanent',
    items: ['Le jeu est maintenant hébergé sur Internet : créez un compte et jouez depuis n’importe quel appareil, sans rien installer.']
  },
  {
    version: '9.4', title: 'Auras d’armes',
    items: ['Votre arme s’entoure d’une aura selon sa rareté : bleue (magique), jaune (rare), ambrée (légendaire), violette (mythique) et prismatique (absolu).']
  },
  {
    version: '9.3', title: 'Rendu plus réaliste',
    items: [
      'Soleil plus bas et plus doré, ombres plus marquées, couleurs plus riches, petits détails au sol (cailloux, brindilles, ossements).',
      'Option « Rendu réaliste » dans les Options pour l’activer ou la couper selon la fluidité de votre appareil.'
    ]
  },
  {
    version: '9.2', title: 'Structures posées au sol',
    items: ['Les bâtiments, repères et portails ne flottent plus : tout repose sur le sol, y compris le toit de la ferme et les obélisques.']
  },
  {
    version: '9.1', title: 'Terrain plat',
    items: ['Le relief est aplati : fini les blocages de collision contre les falaises et les marches. Océans, lacs et rivières sont conservés.']
  },
  {
    version: '9.0', title: 'Ramassage automatique',
    items: ['Nouvelle option (Options → Ramassage automatique du butin) : ramasser seulement les consommables, ou tout le butin proche. Désactivée par défaut.']
  },
  {
    version: '8.9', title: 'Audit complet',
    items: [
      'Correctif en ligne : les pièces de set conservent maintenant leur bonus après sauvegarde.',
      'Correctif en ligne : les bonus en pourcentage des objets de haut niveau ne sont plus affaiblis.'
    ]
  }
];
export const LATEST_VERSION = PATCH_NOTES[0].version;
