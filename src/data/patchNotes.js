// V10.3 — Notes de mise à jour affichées aux joueurs (menu principal et page de connexion).
// Pour publier une nouveauté : ajouter une entrée EN HAUT de la liste (la première est la plus récente) et mettre à jour
// la version dans package.json et dans le libellé de src/ui/HUD.js (#build-version). Écrire pour les joueurs : court, concret.
export const PATCH_NOTES = [
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
