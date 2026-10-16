// V10.3 — Notes de mise à jour affichées aux joueurs (menu principal et page de connexion).
// Pour publier une nouveauté : ajouter une entrée EN HAUT de la liste (la première est la plus récente) et mettre à jour
// la version dans package.json et dans le libellé de src/ui/HUD.js (#build-version). Écrire pour les joueurs : court, concret.
export const PATCH_NOTES = [
  {
    version: '10.83', title: 'Stands, licorne et coffres',
    items: [
      '🧑‍🌾 Les marchands (forgeron, armurier, apothicaire, mystique, fruitier…) se tiennent maintenant devant leur stand : plus facile de cliquer dessus.',
      '🦄 La licorne de la boutique à lunes a un vrai corps de poney, une crinière et une corne, au lieu de ressembler à un chat.',
      '📦 Coffres refaits : couvercle bombé, bandes de fer, rivets et serrure, avec un bois bien texturé.'
    ]
  },
  {
    version: '10.82', title: 'Commandes souris partout',
    items: [
      '🖱️ Les commandes à la souris marchent maintenant aussi en caméra 3ᵉ personne : clic gauche pour se déplacer, attaquer ou interagir, clic droit pour la compétence, bouton du milieu (maintenu) pour tourner la caméra.',
      '👆 Le clic gauche interagit directement sur le personnage, le coffre, le portail, le butin ou la sortie visés : plus besoin de la touche E.',
      '🌀 Dans une faille, un clic gauche sur le portail « Sortie » (ou sur un obélisque, un totem, un coffre) fonctionne.',
      '⚔️ Chaque faille contient toujours au moins une meute d’élite : le Gardien corrompu de l’acte I est désormais garanti dans les « Spires corrompues » (niveau 22+).',
      '🔇 Plus aucun cri de revenant ou de spectre à la mort des monstres.'
    ]
  },
  {
    version: '10.81', title: 'Mort des humanoïdes',
    items: [
      '🔊 Plus de cri étrange à la mort des bandits, brutes, zélotes, mages, archers et gardes (toutes régions, y compris les brutes abyssales) : place au bruit d’un corps qui tombe, d’une armure ou d’un tissu, et d’une arme qui rebondit au sol.'
    ]
  },
  {
    version: '10.80', title: 'Écran noir après cinématique',
    items: [
      '🛠️ Si le téléphone coupe l’affichage du jeu (mémoire graphique saturée), le jeu le rétablit tout seul au lieu de rester sur un écran noir ; sinon un bouton « Recharger l’affichage » apparaît.',
      '🎬 La cinématique de lancement ne force plus la fermeture de son rendu, ce qui pouvait faire perdre aussi celui du jeu sur certains téléphones.'
    ]
  },
  {
    version: '10.79', title: 'Ambiance lumineuse',
    items: [
      '✨ Nouveau halo lumineux : néons, cristaux, sorts et runes rayonnent doucement. Actif en qualité Élevé ou Ultra (réglable : Réglages › Graphismes › Halo lumineux).',
      '🏚️ Les ruines (murs, piliers, piédestaux) ont des veines de runes bleu-cyan lumineuses incrustées dans la pierre.'
    ]
  },
  {
    version: '10.78', title: 'Sols et colonnes refaits',
    items: [
      '🏛️ Les colonnes de marbre du Royaume Céleste sont redessinées (socle, fût cannelé, chapiteau) et leur texture n’est plus étirée. Même correction pour les piliers de basalte, l’obsidienne, la glace, les cactus, les souches et les roseaux.',
      '🌱 Les sols ont un grain bien plus riche, net de près comme de loin, avec un vrai relief (cailloux, terre, brindilles).'
    ]
  },
  {
    version: '10.77', title: 'Villages plus fluides',
    items: [
      '👥 Les PNJ gardent leur modèle fin quand tu es à moins de 16 m, et passent à une version légère plus loin : même allure, bien moins de calculs.',
      '🏘️ En ville, le nombre de triangles à l’écran est presque divisé par deux : le jeu est plus fluide.'
    ]
  },
  {
    version: '10.76', title: 'Textures Ultra HD',
    items: [
      '🖼️ Nouveau réglage « Textures Ultra HD » (Réglages › Graphismes) : sol, murs, toits, bois, nature, armures, cuir, tissu, poils et os en 2 048 à 4 096 px, avec bien plus de détail fin (grain de la pierre, fibres du bois, tissage, rayures du métal…).',
      '💻 Activé automatiquement sur PC puissant ; désactivé sur téléphone. Compte ~40 Mo de plus à télécharger et ~1 Go de mémoire vidéo. Prend effet au prochain lancement.',
      '📱 Sans ce réglage, le jeu garde les textures actuelles : rien ne change pour les appareils modestes.'
    ]
  },
  {
    version: '10.75', title: 'Personnages bien plus détaillés',
    items: [
      '🧍 Le personnage (corps, armures, visage, coiffures, barbes) est modélisé avec 5 fois plus de triangles : formes plus lisses et plus fines.',
      '👥 Les villageois et tous les PNJ utilisent désormais le même modèle que ton personnage, avec chacun son visage, sa coiffure, ses couleurs et sa silhouette.',
      '🛡️ Les gardes portent l’armure et l’épée.',
      '📦 Le premier chargement est plus lourd (modèles plus fins), les suivants restent rapides.'
    ]
  },
  {
    version: '10.74', title: 'Check-up des stands',
    items: [
      '🔨 Un seul stand Forge, avec Helga à l’intérieur (enclume et foyer sous le toit) ; Vaelis se tient derrière son établi d’enchantement.',
      '🛒 Les marchands du marché sont dans leur étal, derrière le comptoir.',
      '🍎 Nouveau : Marchand Pomel tient l’étal de fruits, qui était vide.',
      '🧹 Retrait des établis sans personne (armurier, alchimie, forge en double).'
    ]
  },
  {
    version: '10.73', title: 'Textures cohérentes',
    items: [
      '🎨 Sols fidèles à leur région : cendre sombre dans les Abysses, sable dans le désert, sol doré au Royaume Céleste (plus de reflets verts venus de la texture de base).',
      '🌾 L’herbe prend la teinte de sa région (dorée au Royaume Céleste, plus sombre en forêt).',
      '🪨 Rochers et débris assombris et teintés selon la région (braise, violet, basalte, givre…).'
    ]
  },
  {
    version: '10.72', title: 'Ambiance des régions',
    items: [
      '🌫️ Chaque région a sa propre atmosphère : brume et lumière teintées (sable chaud du désert, marais verdâtre, braises des Abysses, voile violet des Terres Corrompues…), avec des transitions en douceur.',
      '✨ Particules d’ambiance : poussière de sable, spores, flocons de givre, étincelles, lucioles. Elles suivent tes réglages de particules.'
    ]
  },
  {
    version: '10.71', title: 'Rochers et connexion',
    items: [
      '🪨 Nouveaux rochers et débris : formes naturelles, teintes adaptées à chaque région (sable, givre, basalte…), sans taches de mousse ni facettes.',
      '🔐 Corrigé : après une coupure de connexion, le compte est de nouveau reconnu automatiquement (plus de « connecte-toi » alors que tu l’es, notamment pour les codes).'
    ]
  },
  {
    version: '10.70', title: 'Codes et tickets',
    items: [
      '🎟️ Nouveau : « Entrer un code » dans le menu Pause et dans Compte.',
      '⚡ Tickets de bonus : double XP et/ou butin ×2 pendant 30 min ou 1 h, à ton compte uniquement.',
      '💬 Des codes à usage unique sont publiés sur le Discord (salon #codes-cadeaux).'
    ]
  },
  {
    version: '10.69', title: 'Stands et ville',
    items: [
      '🔨 Les artisans ont de vrais stands : toit, murs, étagères, enseigne, lanternes, tonneaux et caisses autour de la forge, de l’armurier, de l’alchimie et de l’enchantement.',
      '🧱 Dalles de la ville remises à plat : plus de pierres superposées qui scintillent, ni de pieds dans le sol.',
      '🏦 Le coffre de banque est déplacé devant le château, hors de la place du puits.'
    ]
  },
  {
    version: '10.68', title: 'Tout au sol',
    items: [
      '🪨 Plus aucune pierre en l’air : rochers, débris du Néant, arbres et buissons sont posés au sol, même sur les pentes.',
      '🏆 La barre de boss disparaît dès que le boss est vaincu, ou quand tu meurs face à lui.',
      '💀 Les boss disparaissent après leur défaite.'
    ]
  },
  {
    version: '10.67', title: 'Corrections du terrain',
    items: [
      '🚪 Les arches entre les zones se traversent enfin.',
      '🪨 Les rochers sont posés au sol (plus de pierres en l’air sur les pentes), avec de nouvelles textures de roche et d’écorce.',
      '🔊 Le son baisse pendant les cinématiques ; la scène de fin du prologue se referme toujours (plus d’écran noir).',
      '🗿 Un clic sur la statue de la spire (ou son portail) l’active, comme la touche E.',
      '🏆 La barre de boss disparaît quand le boss est vaincu ; nouvelle icône de monture.'
    ]
  },
  {
    version: '10.66', title: 'Site officiel',
    items: [
      '🌐 Un site de présentation est en ligne : /bienvenue/ (présentation, téléchargements, nouveautés, création de compte).',
      '🔗 Pratique pour inviter tes amis : tu peux partager le lien en un clic.'
    ]
  },
  {
    version: '10.65', title: 'Audit et fiabilité',
    items: [
      '📢 Correction : les annonces du créateur s’affichent bien à l’écran.',
      '⚔️ Les invasions attendent que tu sortes de la ville avant d’apparaître.',
      '🔐 Après un changement de mot de passe, les anciens appareils sont déconnectés.',
      '🛡️ Le serveur est plus robuste : une erreur isolée ne le coupe plus, et tes données sont enregistrées avant chaque mise à jour.'
    ]
  },
  {
    version: '10.64', title: 'Annonces en jeu',
    items: [
      '📢 Les annonces et pastilles d’événements s’affichent uniquement en jeu, en haut au milieu de l’écran. Une annonce reçue pendant que tu es dans un menu s’affiche dès que tu reprends la partie.'
    ]
  },
  {
    version: '10.63', title: 'Annonces à l’écran',
    items: [
      '📢 Les annonces, messages et événements du créateur s’affichent en grand, en blanc, au milieu de l’écran.',
      '⏱️ Une pastille avec une icône et un compte à rebours indique les événements en cours (boost d’XP / de butin, invasions).'
    ]
  },
  {
    version: '10.62', title: 'Boutique simplifiée',
    items: [
      '🛍️ Boutique des Lunes : le bouton « Essayer » est retiré. On achète, puis on équipe.'
    ]
  },
  {
    version: '10.61', title: 'Dons plus généreux',
    items: [
      '💛 Plus on donne, plus le bonus de Lunes grandit : 1 € = 100, 10 € = 1 500, 50 € = 8 500 Lunes.',
      '★ Le pass premium (500 Lunes) a un bouton doré bien visible.'
    ]
  },
  {
    version: '10.60', title: 'Boutique réparée et nouveaux tarifs',
    items: [
      '🛠️ Correction : la Boutique des Lunes affiche de nouveau tous ses objets et le bloc de dons.',
      '💛 Dons : 1 € = 100 Lunes, 10 € = 1 500 Lunes. Le pass premium coûte désormais 500 Lunes.'
    ]
  },
  {
    version: '10.59', title: 'Événements & codes cadeaux',
    items: [
      '🎁 Nouveau : entre un code cadeau dans Compte → Code cadeau pour gagner des Lunes.',
      '✨ Des événements du créateur peuvent maintenant apparaître : boosts d’XP et de butin, invasions de monstres, cadeaux.'
    ]
  },
  {
    version: '10.58', title: 'Contacter l’administrateur',
    items: [
      '✉️ Nouveau : écris à l’administrateur depuis Compte → Contacter l’administrateur. Sa réponse apparaît au même endroit.'
    ]
  },
  {
    version: '10.57', title: 'Comptes protégés',
    items: [
      '🔐 Nouveau : « Sécurité du compte » (menu Compte) — choisis une question secrète et génère un code de secours.',
      '🔑 Mot de passe oublié ? Sur l’écran de connexion, récupère ton compte avec ta réponse secrète ou ton code de secours.'
    ]
  },
  {
    version: '10.56', title: 'Coulisses',
    items: [
      '🛠️ Petites améliorations en coulisses pour le suivi des dons.'
    ]
  },
  {
    version: '10.55', title: 'Dons PayPal',
    items: [
      '💛 Tu peux soutenir Korvalune par un don PayPal (dès 1 €) : une fois ton don signalé en jeu et validé, tu reçois des Lunes de remerciement (100 par euro, avec un bonus dès 5 €).'
    ]
  },
  {
    version: '10.54', title: 'Soutenir le jeu',
    items: [
      '💛 La Boutique des Lunes propose désormais un don libre par PayPal pour soutenir Korvalune (sans contrepartie en jeu). Les Lunes ne s’achètent plus.'
    ]
  },
  {
    version: '10.53', title: 'Un grand coffre',
    items: [
      '📦 Le coffre de Korvalune est 2,5 fois plus grand, sur un socle de pierre plus large.',
      '✨ Correction de la texture qui tremblait sous le coffre.'
    ]
  },
  {
    version: '10.52', title: 'Cinématiques : son et stabilité',
    items: [
      '🎬 Pendant une cinématique, la musique et les ambiances baissent nettement pour qu’on entende bien la voix.',
      '🔧 Correction d’une erreur audio qui pouvait arrêter le jeu pendant la cinématique de l’acte I.'
    ]
  },
  {
    version: '10.51', title: 'Sécurité renforcée',
    items: [
      '🛡️ Le serveur vérifie davantage les sauvegardes : progression (niveaux, or, ventes), caractéristiques et statistiques des objets. Les valeurs impossibles sont ramenées à la normale.',
      '🔁 Les échanges sont protégés contre la duplication d’objets : un objet n’appartient qu’à un seul compte à la fois.'
    ]
  },
  {
    version: '10.50', title: 'Télécharger Korvalune',
    items: [
      '📲 L’écran d’accueil propose deux liens propres : « Android — Télécharger l’application (APK) » et « Windows — Télécharger l’installation ». Un lien reste grisé (« Bientôt disponible ») tant que son fichier n’est pas publié.'
    ]
  },
  {
    version: '10.49', title: 'Icônes d’équipement et départ de l’histoire',
    items: [
      '🛡️ Icônes d’équipement refaites : chaque emplacement (casque, épaulières, plastron, gants, jambières, bottes, cape, bague, collier, arme, objet secondaire) a maintenant une icône dessinée qui correspond à la pièce. Les emplacements vides montrent la silhouette de ce qu’ils attendent.',
      '✨ Mode histoire plus rapide : l’histoire démarre dès la première initiation terminée. Premier objectif : toucher la pierre d’éclat (le Monolithe des Métamorphoses) pour lancer la première cinématique.',
      '🧭 Quêtes vérifiées une par une : textes mis à jour (boutons, lieux de Vaelis, du Monolithe et de la Statue de la Spire).'
    ]
  },
  {
    version: '10.48', title: 'Animations, émotes et corrections',
    items: [
      '🤸 Roulade : le personnage fait enfin une vraie roulade avant, en boule.',
      '🏹 L’archer tire vraiment à l’arc : arc tenu à la main gauche, corde tendue jusqu’à la joue, flèche lâchée au bon moment (tir normal et tir puissant).',
      '🔮 Le mage lance ses sorts (sort simple et grand sort à deux bras), et toutes les classes ont une pose d’invocation pour leurs bonus, soins et cris.',
      '🙂 11 émotes : saluer, victoire, applaudir, révérence, danser, pointer, rire, s’asseoir, salut militaire, muscles, haussement d’épaules. Touche G, bouton 🙂, ou /danse, /salut… dans le chat. Les autres joueurs les voient.',
      '🗿 Le Monolithe des Métamorphoses est de nouveau accessible : un obstacle invisible bouchait toute la place.',
      '🐎 La caravane marchande est tirée par un cheval, qui marche quand elle avance.',
      '🎯 L’objet secondaire de l’archer a maintenant une vraie icône de carquois (au lieu d’un arc).'
    ]
  },
  {
    version: '10.47', title: 'Mode histoire : Acte I, Les Ombres',
    items: [
      '🌲 Acte I : après le prologue, Ysmer t’envoie dans la Forêt des Ombres. Trois quêtes jusqu’au premier Gardien corrompu.',
      '🗼 Une spire violette se dresse dans la forêt : approche-toi pour déclencher une nouvelle cinématique.',
      '🗣️ Nouveaux dialogues avec Ysmer, Vaelis et Rhoda. Vaelis te parle d’abord de l’histoire avant de proposer ses services.',
      '🎬 Le bouton « Passer » des cinématiques passe en haut à droite pour ne plus gêner les sous-titres.'
    ]
  },
  {
    version: '10.46', title: 'Mode histoire : le prologue',
    items: [
      '📖 Nouveau : le mode histoire commence ! Après ta première chasse aux loups, le Monolithe s’éveille. Prologue en trois quêtes avec la Mystique Vaelis, la Capitaine Rhoda et le garde Halvar.',
      '🎬 Première cinématique dans le jeu : caméra dirigée, sous-titres et voix off. Tu peux la passer à tout moment.',
      '🗣️ Voix off : les dialogues de l’histoire sont lus à voix haute (voix du navigateur pour l’instant, voix de comédiens à venir). Volume et activation dans Options > Son.'
    ]
  },
  {
    version: '10.45', title: 'Plus de nuit, carte personnalisable, points plus rapides',
    items: [
      '☀️ La nuit est supprimée : le jeu reste de jour, de l’aube dorée à la fin d’après-midi. Les failles sont aussi bien plus lumineuses.',
      '✨ Distribution des points : boutons +1, +5 et Max sur chaque attribut.',
      '📍 Carte du monde : touchez la carte pour poser ou retirer un marqueur personnel.',
      '🏰 Les remparts intérieurs autour du château ont disparu, seul le donjon reste.',
      '🔊 Plus de fanfare au passage de niveau ; nouveaux sons pour le butin et le ramassage.',
      '⌨️ PC : la barre de compétences affiche les vraies illustrations (acier, flammes, glace…), des cases plus grandes, les touches en keycaps et les cases clic gauche / clic droit conservées. Les boutons du menu passent aux icônes vectorielles modernes.',
      '🎃 Quêtes de Jack : parler à Jack valide enfin l’étape, même hors connexion.'
    ]
  },
  {
    version: '10.44', title: 'Personnages et équipement entièrement modélisés',
    items: [
      '🧍 Un vrai corps humain en 3D pour toutes les classes et toutes les races, avec couleur de peau, yeux et cheveux au choix.',
      '🙂 Visages, nez, yeux, lèvres, oreilles (humaines, elfes, orques), 22 coiffures et 5 barbes : tout est modélisé.',
      '⚔️ Neuf nouvelles armes en 3D : hache, masse, marteau de guerre, lance, hallebarde, cimeterre, arbalète, grimoire et baguette.',
      '🛡️ Armures en cuir pour l’archer et l’assassin, robe de tissu à capuche pour le mage ; le guerrier et le paladin gardent les plates.'
    ]
  },
  {
    version: '10.43', title: 'Un monde en 3D et une nouvelle bande-son',
    items: [
      '🏰 Le monde passe en modèles 3D : ville, décors, habitants, ennemis, boss, montures et arbres ont un nouveau look plus sombre et réaliste.',
      '👑 Tout ce qui est cosmétique est en 3D : ailes (ange, démon, cristal), couronnes, cornes, oreilles, chapeau de sorcière et 13 familiers animés.',
      '🎵 Nouvelle bande-son : cinq morceaux originaux pour le menu, l’exploration, les combats et les boss.',
      '📱 Au premier lancement, une barre de progression s’affiche pendant le chargement des modèles.'
    ]
  },
  {
    version: '10.40', title: 'Une vraie bande-son',
    items: [
      '🎵 Fini la musique synthétisée : le jeu joue maintenant de vraies musiques (59 morceaux) — villes et villages, exploration de jour et de nuit, combats, boss, failles et donjons sombres, Halloween, chaque région du continent. Plusieurs morceaux par ambiance, enchaînés en fondu, sans coupure.',
      '⚔️ Plus de 900 vrais bruitages : épées, haches, impacts et coups critiques, flèches, sorts de feu, d’eau, de foudre, de terre et de soin, voix des monstres par espèce (grognements, attaques, morts), pas selon le terrain, coffres, butin, équipement, interface, montures.',
      '🌧️ Ambiances enregistrées : vent (plaine, forêt, montagne), pluie, orage, nuit, ville animée, fontaine, marais, grottes et failles. Oiseaux le jour, hibou et loups la nuit, cloches de la ville.',
      '🔊 Dans les options > Son : volumes séparés pour la musique, les effets, l’ambiance et l’interface, bouton « Couper tout le son » et nouvelle case « Bruits de pas ».',
      '📱 Pensé pour le mobile : les musiques sont lues en flux (une seule en mémoire), les bruitages se chargent à la demande, et le son démarre après ton premier toucher.'
    ]
  },
  {
    version: '10.39', title: 'Korvalune, la grande cité',
    items: [
      '🏰 La ville est beaucoup plus grande (enceinte de 124 m) et organisée en quartiers : un grand château au centre avec sa cour, et quatre portes (nord, est, sud, ouest) reliées par de larges avenues.',
      '🛍️ Quartier marchand à l’est : six étals avec auvents rayés, fontaine, forgeron, armurière, herboriste, drapière et colporteur. Quartier des artisans à l’ouest : forge, établis d’armurier, d’alchimie et d’enchantement.',
      '✨ Personnalisation au sud-ouest (Monolithe des Métamorphoses et barbière), écurie et auberge au sud-est, puits et place du Voyageur à l’entrée.',
      '🌀 Quartier des portails au nord : le grand Portail des régions est violet, avec le portail du retour et la statue de la Spire.',
      '🗣️ Une quinzaine de nouveaux habitants (capitaine, archiviste, conteuse, gardes de porte, marchands, gamin des rues…) avec leurs propres discours qui varient à chaque conversation. Certains se promènent dans les rues : approche-toi, ils s’arrêtent. Écoute bien : ils parlent déjà des lunes, du Cœur d’Éther et de ce qui se prépare.',
      '🌊 La rivière contourne maintenant la ville par l’est. Si ton personnage se trouvait dans la vieille ville, il reprend sur la place du Voyageur.'
    ]
  },
  {
    version: '10.38', title: 'Nouvelles images de compétences (mobile)',
    items: [
      '🎨 Chaque compétence a maintenant sa propre illustration réaliste (acier, or, flammes, glace, foudre, ombre…), posée dans le cadre d’origine : forme, ornements et couleur inchangés. Deux compétences n’ont jamais la même image.',
      '🖥️ Sur PC, les icônes restent celles d’avant.',
      '🧹 Le bouton et la touche « s’accroupir » sont supprimés.'
    ]
  },
  {
    version: '10.37', title: 'Failles en cartes extérieures',
    items: [
      '🗺️ Les failles ne sont plus des donjons : chaque faille est une carte extérieure générée au hasard, d’un seul tenant, sans portes ni couloirs. Forêt, ruines, caverne, cimetière ou fournaise, avec une lisière naturelle (arbres, rochers) qui borde la zone.',
      '👹 Le Gardien surgit toujours à une dizaine de mètres de toi (jamais collé), dès que la jauge est pleine.',
      '🧭 La mini-carte dessine la zone explorée sans murs intérieurs.'
    ]
  },
  {
    version: '10.36', title: 'Nouvelle interface mobile',
    items: [
      '📱 Toute l’interface en jeu est refaite sur mobile : verre dépoli, barres fines, pastilles compactes et vrais pictogrammes à la place des emojis (le PC garde son interface).',
      '🎯 Compétences en boutons ronds à droite, autour du bouton d’attaque, avec recharge chiffrée. Choisis combien (2 à 7) dans Options > Tactile, et déplace chaque bouton où tu veux (« Modifier la disposition »).',
      '🧭 Mini-carte plus petite, quête affichée sur une seule ligne (touche-la pour tout voir), potions sous le bouton d’attaque, joystick et sprint à gauche.',
      '☰ Un seul bouton Menu ouvre la grille : Inventaire, Personnage, Compétences, Quêtes, Succès, Social, Portail, Pass, Boutique, Discussion.',
      '🖼️ Chaque compétence a un pictogramme vectoriel à son image (flamme, éclair, bouclier, flèches, dague…).'
    ]
  },
  {
    version: '10.35', title: 'Commandes à la souris (PC)',
    items: [
      '🖱️ Clic gauche : se déplacer (maintiens pour suivre le curseur). Sur un monstre : tu le poursuis et tu lances la compétence du clic gauche (la frappe de base par défaut). Sur un PNJ, du butin, un portail ou un coffre : tu y vas et tu interagis. Maj + clic gauche : attaquer sur place.',
      '🖱️ Clic droit (maintenu) : lance la compétence du clic droit vers le curseur. Sur un PNJ ou un objet : y aller et interagir.',
      '🎯 Deux nouveaux emplacements sur la barre de compétences (PC) : un pour le clic gauche, un pour le clic droit, avec leur icône de souris. Assigne-les dans l’écran Compétences (K) avec les boutons « G » et « D » de chaque compétence.',
      '⌨️ Les raccourcis clavier 1–0 restent actifs ; bouger au clavier annule le déplacement à la souris. Pour pivoter la caméra : clic molette + glisser. Désactivable dans Options > Commandes.'
    ]
  },
  {
    version: '10.34', title: 'Multijoueur : portail de ville, menu des joueurs, XP de groupe',
    items: [
      '🌀 Portail de ville (touche T ou bouton 🌀) : ouvre un portail violet sur le terrain (10 min). Il mène à Korvalune ; le portail violet de la ville te ramène exactement là où tu étais (touche E). Ton groupe peut l’utiliser aussi.',
      '👆 Touche l’avatar d’un joueur dans le jeu (ou son nom dans la liste Amis / Groupe) : inviter, ajouter en ami, message privé, échanger, et pour un membre du groupe : se téléporter à côté de lui (ou rejoindre sa faille).',
      '⭐ XP de groupe : chaque coéquipier à moins de 100 m te rapporte +10 % d’XP sur les monstres du groupe (jusqu’à +40 %). Trop loin = pas de bonus ni de récompense.',
      '🌀 Quand un membre entre dans une faille, tout le groupe reçoit l’invitation pour la rejoindre (et le bouton « Rejoindre » reste dans l’écran Social).'
    ]
  },
  {
    version: '10.33', title: 'Difficulté libre, carte zoomable, GPS de quête',
    items: [
      '🔓 La difficulté n’est plus verrouillée : tu choisis le niveau quand tu veux (le niveau conseillé reste indiqué). 10 nouveaux paliers : Calamité I–V et Apocalypse I–V.',
      '🏹 Carquois, orbes et dagues secondaires en vente chez l’armurière et dans le butin : chaque classe a maintenant sa main secondaire.',
      '🦅 Le griffon passe par-dessus la muraille de la ville.',
      '💰 « Tout vendre » : vend tout l’inventaire d’un coup, avec confirmation.',
      '🗺️ Carte du monde : zoom + / −, molette, pincement, déplacement au doigt, bouton « me centrer ». Les objectifs de quête y sont marqués ❗.',
      '🧭 GPS au sol : des chevrons dorés guident vers l’objectif de quête le plus proche (désactivable dans Options).'
    ]
  },
  {
    version: '10.32', title: 'Cinématique d’introduction',
    items: [
      '🎬 Une cinématique de 54 secondes se lance avant l’écran principal : deux lunes, aurores, citadelle flottante, Cœur d’Éther qui se fracture et failles qui s’ouvrent sur le ciel.',
      '🔊 Musique et sons créés dans le jeu, narration sous-titrée. Touche l’écran pour la lancer (le son démarre à ce moment).',
      '⏭️ Bouton « Passer » à tout moment (ou Échap / Entrée). Tu peux la désactiver dans Options > Interface : « Cinématique d’introduction au lancement du jeu ».'
    ]
  },
  {
    version: '10.31', title: 'Toutes les classes au mana, attaques à distance et de zone',
    items: [
      '🔷 Toutes les classes lancent leurs compétences avec du mana. L’endurance ne sert plus qu’à la roulade et à la course. Ton mana grandit avec ton niveau et ton attribut principal.',
      '🏹 L’archer a beaucoup moins de tirs sur une seule cible : flèches empoisonnées, enflammées, glaciales, entravantes, marques et tir rapide frappent maintenant une zone. Nouveaux : Flèche à fragmentation, Brasier de flèches, Orage de flèches.',
      '⚔️ Le guerrier gagne des attaques à distance et de groupe : hache lancée qui traverse la ligne, Pluie de javelots, Faille tectonique, Marteau tonnerre, Barrage de rochers. Furie, Brise-armure et Bourreau frappent plusieurs ennemis.',
      '🗡️ L’assassin : dague lancée qui traverse, Éventail de lames, Pluie d’ombres, Tempête de dagues. Le paladin : Onde radieuse, Grêle sacrée, Chute du soleil ; Marteau béni, Châtiment, Jugement et Rayon de soleil touchent plusieurs ennemis.',
      '⚖️ Les bonus de dégâts de classe sont ajustés en conséquence (guerrier +20 %, paladin +40 %, assassin +5 %, archer inchangé).'
    ]
  },
  {
    version: '10.30', title: 'Classes rééquilibrées et compétences plus spectaculaires',
    items: [
      '⚖️ Le mage dominait : le guerrier, le paladin, l’archer et l’assassin infligent maintenant nettement plus de dégâts pour rattraper son niveau (valeurs ajustées dans la V10.31).',
      '🔋 Ta ressource grandit avec ton niveau et ton attribut principal : plus d’endurance pour le guerrier et l’assassin, plus de mana pour le paladin et l’archer, avec une meilleure récupération.',
      '💥 Chaque classe a sa propre mise en scène, de plus en plus ample avec le niveau de la compétence : fissures, débris et arcs géants pour le guerrier ; colonnes et rayons de lumière pour le paladin ; volée de flèches tombant du ciel pour l’archer ; rafale de lames d’ombre pour l’assassin.'
    ]
  },
  {
    version: '10.29', title: 'Failles jusqu’au niveau 999, classement et butin réglable',
    items: [
      '🌀 Les Spires d’Éther montent jusqu’au niveau 999. Plus le niveau est haut, plus les objets rares, légendaires, mythiques et absolus sont fréquents.',
      '🏅 Nouvel onglet « Classement » dans les failles : les niveaux les plus hauts atteints par les joueurs, en Ascension et en Zénith.',
      '🗺️ Recréer un personnage remet bien ses quêtes à zéro. Un ancien journal ne se mélange plus au nouveau.',
      '🔔 Notifications de ramassage : choisis la rareté minimale affichée, ou masque celles des matériaux, runes et consommables (Options ou Inventaire).',
      '🔕 Options > Interface : retire toutes les notifications, l’annonce de niveau et de Zénith, les « +XP » flottants, ou les noms de runes et matériaux affichés sur le butin au sol.',
      '↺ Tu peux réinitialiser tes attributs (Personnage > bouton sous les attributs) : tous les points dépensés te sont rendus contre des pièces. L’arbre des Constellations se réinitialise déjà depuis son écran.',
      '🐾 Compagnon : rareté minimale et maximale de l’équipement, types (armes, armures, bijoux) et rareté minimale des consommables. Par exemple, rien en dessous de Rare.'
    ]
  },
  {
    version: '10.28', title: 'Zénith : progresser sans limite après le niveau 200',
    items: [
      '✨ Une fois niveau 200, ton expérience fait monter des niveaux de Zénith, sans limite. Chaque niveau te donne 1 point à investir.',
      '🌌 L’arbre des Constellations (Personnage > Constellations) : Fureur, Rempart, Savoir et Fortune, chacune avec une racine, trois branches et une clé de voûte puissante au bout. Une branche s’ouvre dans l’ordre.',
      '♾️ Au centre, le Rayonnement n’a pas de rang maximal : +0,5 % de PV, d’attaque et de défense par point. Il garde chaque point utile, même quand tout le reste est pris.',
      '↺ Tu peux réinitialiser l’arbre contre des pièces d’or et refaire ton choix. Ton niveau de Zénith s’affiche sur ton badge de niveau (Z12…).'
    ]
  },
  {
    version: '10.27', title: 'Empreintes de compétence sur les objets',
    items: [
      '✦ Les objets Légendaires modifient 1 compétence de ta classe, les Mythiques 2 et les Absolus 3. Chaque empreinte change la compétence : plus de dégâts, plus de portée, recharge réduite, coût réduit. Les empreintes Puissance, Portée, Célérité et Économie existent dès le Légendaire ; Cataclysme (dégâts + portée + recharge) arrive avec le Mythique.',
      '🧩 Les objets de build (Mythiques) portent aussi 2 empreintes : choisis ta voie, puis les compétences que tu veux pousser.',
      '📖 La fiche d’un objet détaille chaque empreinte ; le menu Compétences marque d’un ✦ celles qui sont modifiées par ton équipement.',
      '🔨 Refondre un objet retire ses empreintes au sort ; élever sa rareté en ajoute. Les objets de build ne peuvent pas être élevés.'
    ]
  },
  {
    version: '10.26', title: 'Builds, objet secondaire, compétences améliorables',
    items: [
      '🧩 150 objets de build : 6 voies par classe (explosif, rempart, sangsue, érudit, vélocité, chasseur de titans) × 5 pièces. Réunis 2, 4 ou 5 pièces d’une même voie pour des bonus de lignée. Ils tombent sur les monstres à partir de la rareté « Rare ».',
      '🛡️ Objet secondaire pour toutes les classes : bouclier (guerrier, paladin), orbe arcanique (mage), carquois (archer), dague de parade (assassin) — visibles sur le personnage.',
      '⬆️ Améliore tes compétences (menu Compétences) : 10 rangs, +10 % de dégâts par rang, recharge et coût réduits, zones plus larges. Une compétence de haut niveau frappe aussi beaucoup plus fort.',
      '✨ Les compétences deviennent de plus en plus spectaculaires avec leur niveau et leur rang : anneaux, runes, colonnes de lumière, secousses.',
      '🎒 Nouveau : la Besace des matériaux. Ingrédients et runes s’y rangent seuls, en quantité illimitée, sans prendre de place dans l’inventaire. L’atelier s’y sert directement.'
    ]
  },
  {
    version: '10.25', title: 'Inventaire : appui long, glisser-déposer, compagnon',
    items: [
      '👆 Appuie longuement sur un objet : la sélection multiple s’active avec cet objet déjà coché (inventaire et coffre).',
      '✋ Appuie longuement puis glisse un objet vers une autre case pour le déplacer ou l’échanger ; les piles identiques fusionnent. Glisse-le sur une pièce d’équipement pour l’équiper, ou de l’inventaire vers le coffre (et inversement) pour le transférer. À la souris, un simple glisser suffit.',
      '🐾 Le compagnon se règle maintenant directement dans l’inventaire : interrupteur, consommables, matériaux, runes et rareté maximale des armes et armures.'
    ]
  },
  {
    version: '10.24', title: 'Compagnons qui ramassent le butin, combat en mouvement',
    items: [
      '🐾 Ton compagnon équipé va maintenant chercher le butin tout seul et le met dans ton sac : consommables par défaut. Dans Options > Interface & jeu, tu choisis exactement ce qu’il ramasse (consommables, matériaux, runes, armes et armures jusqu’à une rareté) ou tu le désactives.',
      '⚔️ L’attaque de base et toutes les compétences se lancent en marchant comme en sprintant. Les jambes continuent de courir pendant le coup (plus de glissade).',
      '📱 Sur tactile, les boutons de compétence réagissent même quand l’autre pouce tient le joystick. Maintenir le bouton d’attaque répète la frappe.',
      '⏱️ Une compétence pressée juste avant la fin de l’animation en cours part automatiquement dès que possible.'
    ]
  },
  {
    version: '10.23', title: 'Pass de combat : gratuit et premium',
    items: [
      '🏅 Nouveau pass de combat (bouton 🏅 en jeu) : 50 paliers par saison, une voie gratuite et une voie premium. Tu gagnes de l’XP de pass en jouant : monstres, champions, boss, coffres, quêtes, atelier et spires.',
      '🎁 Voie gratuite : des Lunes à chaque palier et 4 cosmétiques exclusifs. Voie premium (400 Lunes, rétroactive) : plus de Lunes, 9 cosmétiques exclusifs (auras, ailes, compagnons, tenue, titres) et 2 onglets de coffre.',
      '📅 Missions du jour (3) et de la semaine (3) pour monter plus vite. Un palier peut aussi s’acheter en Lunes (40). Le pass ne donne jamais de puissance de combat.',
      '🔄 Une saison dure 8 semaines. À la fin, la progression repart de zéro, mais tous les cosmétiques gagnés restent à toi pour toujours.'
    ]
  },
  {
    version: '10.22', title: 'Potions permanentes, jeu à la verticale et compétences spectaculaires',
    items: [
      '🧪 Les potions sont désormais permanentes : une fois trouvée ou achetée, une potion est à toi pour toujours et s’utilise à l’infini. En contrepartie, chaque potion a un temps de recharge (30 s pour une Commune, jusqu’à 10 s pour une Absolue). Les boutons et les touches V / B utilisent la potion que tu as choisie dans l’inventaire. Tes anciennes potions en sac sont converties automatiquement.',
      '📱 Le jeu se joue maintenant aussi à la verticale : tourne ton téléphone ou ta tablette quand tu veux, l’écran, les commandes et la vue s’adaptent tout seuls. Chaque orientation garde sa propre disposition de boutons.',
      '✨ 30 nouvelles compétences (6 par classe, du niveau 45 au niveau 175) : pluies de météores, ondes de choc successives, puits de gravité, cages d’orage, ailes de l’archange, éclipse… et une vingtaine de compétences existantes de haut niveau deviennent des attaques de zone.',
      '🖼️ Chaque compétence a maintenant sa propre icône, unique, avec un cadre qui s’enrichit avec le niveau.',
      '⚔️ Les niveaux de difficulté changent de noms : Voyageur, Aguerri, Vétéran, Champion et Fléau I à IV.'
    ]
  },
  {
    version: '10.21', title: 'Potions de toutes raretés et vente groupée',
    items: [
      '🧪 Trois familles de potions : soin, mana et renouveau (vie + mana), chacune en 6 raretés — Commun, Magique, Rare, Légendaire, Mythique et Absolu. Plus la rareté est haute, plus la potion rend de vie ou de mana.',
      '🎁 Les monstres, boss, coffres et lutins trésors lâchent des potions de rareté variable (les sources puissantes en donnent de meilleures). La marchande Wren vend maintenant les potions jusqu’au rang Rare.',
      '☑️ Vente groupée : dans l’inventaire, dans le coffre et chez la marchande, touche « Sélection multiple » puis choisis plusieurs objets (ou « Équipement : Commun / ≤ Magique / ≤ Rare »). Le total s’affiche, puis « Vendre la sélection » demande une confirmation.',
      '💰 Correctif : une pile d’objets (ex. 5 potions) est maintenant payée à sa vraie valeur, et les ventes d’objets très chers ne sont plus rabotées par la sauvegarde du serveur.'
    ]
  },
  {
    version: '10.20', title: 'Combat plus fluide et monstres adoucis',
    items: [
      '🏃 Tu peux maintenant te déplacer (marche ou course) pendant que tu lances une compétence : tu gardes ta visée et tu avances en même temps. Seule la roulade t’immobilise.',
      '🧪 Les potions de vie et de mana s’enchaînent sans temps d’attente (tu peux aussi laisser la touche appuyée).',
      '⚖️ Équilibrage : les monstres de haut niveau ont beaucoup moins de points de vie et font moins de dégâts, et la défense réduit davantage les coups. Dis-nous si c’est mieux !',
      '🔶 Les runes se trouvent partout dans le monde : sur tous les monstres (6 % de chance) et dans les coffres cachés, pas seulement dans les donjons.',
      '🔧 Rappel : un équipement brisé n’est jamais détruit, tu peux toujours le réparer chez la forgeronne Helga.'
    ]
  },
  {
    version: '10.19', title: 'Forge, Monolithe et mystique',
    items: [
      '🔨 Forgeronne Helga (à l’ouest de la ville) : répare ton équipement, creuse des emplacements, sertit des runes et démantèle les objets en matériaux.',
      '🔧 Usure : l’équipement s’use quand tu es touché ou que tu combats, et perd 10 % de durabilité à chaque mort. À 0, il est brisé et ne donne plus rien.',
      '🔶 14 runes (rang 1 à 14) à sertir : le bonus change selon la pièce (arme, armure, bijou). Dans le bon ordre, elles réveillent une litanie : 10 assemblages à découvrir. Les runes tombent sur les monstres et dans les coffres.',
      '🗿 Monolithe des Métamorphoses (place des Métamorphoses, au sud-ouest) : refonte (retire au sort toutes les propriétés), élévation de rareté, transformation de pièce de panoplie, suppression du niveau requis, pouvoirs liés (garde l’effet d’un objet légendaire), fusion de runes, gravure de runes et distillation de matériaux.',
      '🔮 Mystique Vaelis (à l’ouest de la ville) : remplace une propriété d’un objet par une autre (tu vois le résultat avant de choisir) et change la couleur de ton équipement, ainsi que la forme des armes de mêlée.',
      '🎃 Halloween : les monstres de l’événement apparaissent maintenant partout sur la carte (hors ville), en plus grand nombre.',
      '📜 Deux nouvelles quêtes de découverte : « Un métal qui chante » (niveau 8) et « Le cristal qui répond » (niveau 20).'
    ]
  },
  {
    version: '10.18', title: 'Difficulté, équilibrage et traversée des eaux',
    items: [
      '⚔️ Difficulté à paliers : Voyageur, Aguerri, Vétéran, Champion et 4 niveaux de Fléau. Plus c’est dur, plus les monstres sont solides, mais plus l’or, l’expérience et les objets rares abondent. Se règle en ville (menu pause) et se sauvegarde avec le personnage.',
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
