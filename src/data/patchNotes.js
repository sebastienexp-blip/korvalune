// V10.3 — Notes de mise à jour affichées aux joueurs (menu principal et page de connexion).
// Pour publier une nouveauté : ajouter une entrée EN HAUT de la liste (la première est la plus récente) et mettre à jour
// la version dans package.json et dans le libellé de src/ui/HUD.js (#build-version). Écrire pour les joueurs : court, concret.
export const PATCH_NOTES = [
  {
    version: '10.18', title: 'Difficulté, équilibrage et traversée des eaux',
    items: [
      '⚔️ Difficulté façon Diablo : Normal, Difficile, Expert, Maître et 4 niveaux de Tourment. Plus c’est dur, plus les monstres sont solides, mais plus l’or, l’expérience et les objets rares abondent. Se règle en ville (menu pause) et se sauvegarde avec le personnage.',
      '🐴 Chevaux et 🦅 griffons traversent l’eau : les chevaux nagent (un peu plus lentement), les griffons la survolent sans être ramenés sur la berge.',
      '🧱 Plus de tirs ni de coups à travers les murs : les cibles derrière un bâtiment ne peuvent plus être touchées, ni toucher.',
      '🛡️ Les monstres de haut niveau sont plus coriaces et la défense devient un pourcentage de réduction qui plafonne, pour que le défi suive ta progression.',
      '🎁 Butin : les objets trouvés ont toujours un niveau de 0 à 5 au-dessus du tien, quel que soit le niveau du monstre tué.',
      '📜 Quêtes de découverte pour tout le nouveau contenu (boutique, compagnons, skins, Halloween, montures, nage, difficulté). La liste des quêtes à gauche de l’écran peut maintenant défiler.',
      '🚀 Caméra libre et caméra proche nettement plus fluides : brouillard plus court et masquage des décors et personnages lointains.'
    ]
  },
  {
    version: '10.17', title: 'Compagnons, skins et grande boutique',
    items: [
      '🐾 Compagnons : 19 petits animaux et créatures te suivent partout (chaton, renardeau, loup, hibou, dragonneau, phénix, licorne, fée, golem… et pour Halloween chauve-souris, fantôme, citrouillon, chat squelette, araignée). Les autres joueurs les voient.',
      '🧥 Skins : 21 tenues qui changent les couleurs de ton personnage, certaines avec couronne, auréole, cornes, chapeau de sorcière ou tête de citrouille.',
      'La boutique des Lunes passe de 25 à 90 objets (auras, cercles, traînées, ailes, titres, compagnons, skins). Celle de Jack gagne une trentaine d’objets, dont des compagnons et des skins d’Halloween.',
      'À débloquer gratuitement : des récompenses de niveau (10, 15, 20, 25, 30, 40, 50, 60, 70, 100) et, en vainquant le Roi Citrouille, le Mini Roi Citrouille, le titre Terreur de la nuit et la tenue du Roi (3 victoires).',
      'Garde-robe (inventaire) rangée par catégorie : toucher un objet l’équipe à la place de l’ancien. Correction : des changements rapides d’équipement pouvaient être ignorés.'
    ]
  },
  {
    version: '10.16', title: 'Musiques d’Halloween et affiche de l’événement',
    items: [
      'Pendant l’événement, 6 ambiances musicales d’Halloween se succèdent au hasard : cloches lugubres, boîte à musique, graves profonds et vent qui gémit. Le combat garde sa musique.',
      'L’écran de démarrage affiche une affiche d’Halloween avec les dates : du 9 octobre au 1er novembre inclus (boutique de Jack ouverte jusqu’au 4 novembre).'
    ]
  },
  {
    version: '10.15', title: 'Garde-robe : cosmétiques liés au compte',
    items: [
      'Tous les cosmétiques (boutique des Lunes et Halloween) sont désormais des objets liés à ton compte : impossibles à vendre, à échanger ou à mettre en banque.',
      'Nouvelle section « Cosmétiques » dans l’inventaire : touche un objet pour l’équiper, touche-le encore pour le retirer. Un seul par emplacement (aura, cercle, traînée, ailes, titre).'
    ]
  },
  {
    version: '10.14', title: 'Ville sûre et mini-carte illustrée',
    items: [
      'La ville est un lieu sûr : les monstres d’Halloween n’y apparaissent plus et disparaissent si tu rentres en ville. Ils rôdent à l’extérieur.',
      'La boutique de Jack défile maintenant jusqu’en bas (cosmétiques et classement).',
      'La mini-carte affiche de petites images : ⚔️ armes, 🛡️ armures, 🧪 potions, 🐎 écurie, ✂️ barbier, 🏦 banque, 🗿 statue des spires, 🎃 Jack, 📦 coffres, 💀 boss, 👺 gobelin trésor, 👑 Roi Citrouille. Les bonbons sont de petits points orange.',
      'La carte du monde montre coffres, boss, gobelin et événement, avec une légende sous la carte.'
    ]
  },
  {
    version: '10.13', title: 'Événement Halloween 🎃',
    items: [
      'Korvalune passe en mode Halloween : ciel violet et orangé, lune géante, citrouilles lumineuses, fantômes flottants et chauves-souris. Jusqu’au 1er novembre.',
      'Jack Tête-de-Citrouille t’attend à côté du puits. Il échange des 🍬 bonbons contre des cosmétiques d’Halloween : auras, cercles, traînées, ailes de chauve-souris et du spectre, titres. Tout ce que tu achètes reste à toi pour toujours.',
      'Gagne des bonbons : 14 bonbons cachés dans la ville (ils reviennent chaque jour), le sac quotidien de Jack, les monstres de saison et deux défis du jour. Le Roi Citrouille en laisse 30.',
      'Des squelettes, citrouilles rampantes, spectres, loups-garous et sorcières rôdent autour de toi, avec une horde surprise toutes les 6 minutes. Il faut être connecté à ton compte.',
      'Un classement des bonbons est visible chez Jack.',
      'Le puits de la place a enfin de l’eau !'
    ]
  },
  {
    version: '10.12', title: 'Apparence et barbier',
    items: [
      'Nouveau à la création : choisis le sexe, la taille, la corpulence et la musculature de ton héros, la forme du visage, des yeux et du nez, la barbe, et une coupe parmi 23 (hommes, femmes et mixtes).',
      'Nouveau : la barbière Odile t’attend devant la maison à l’enseigne ✂ Barbier, rue sud-ouest. Elle change ton apparence contre des pièces d’or : seules les catégories modifiées sont payées.',
      'Les autres joueurs voient ta nouvelle apparence. Les personnages existants gardent exactement leur look d’origine tant qu’ils ne passent pas chez le barbier.',
      'Correction : le barbier n’est plus collé à la statue de la Spire, qui a été légèrement déplacée vers le sud-est de la place.'
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
