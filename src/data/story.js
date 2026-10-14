// V10.46 — Mode histoire : prologue « L'Éveil ».
// Tout le texte, les répliques et les cinématiques vivent ici (aucune logique) : on peut corriger un mot sans toucher au code.
// Chaque réplique a un identifiant stable (`id`) : c'est aussi le nom du fichier de voix (public/voices/<id>.mp3).
// Si le fichier n'existe pas encore, le jeu lit la réplique avec la voix du navigateur, puis, à défaut, affiche le texte seul.
import { computeEnemyStats } from './enemyScaling.js';

const reward = (level, k) => { const b = computeEnemyStats(level, 'bandit'); return { xp: Math.round(b.xp * k * 6), coins: Math.round(b.coins[1] * k * 4) }; };

// Voix de repli (navigateur) et nom d'affichage de chaque personnage.
// `voice` = la voix ElevenLabs prévue (pour préparer les fichiers) ; pitch/rate = réglage de la voix du navigateur.
export const SPEAKERS = {
  nessa: { name: 'Conteuse Nessa', voice: 'Atma', pitch: 1.05, rate: 0.95 },
  veilleur: { name: 'Le Veilleur de pierre', voice: 'Eric', pitch: 0.55, rate: 0.82 },
  halvar: { name: 'Garde Halvar', voice: 'Paul K', pitch: 0.8, rate: 0.98 },
  rhoda: { name: 'Capitaine Rhoda', voice: 'Romain / femme ferme', pitch: 1.0, rate: 1.05 },
  vaelis: { name: 'Mystique Vaelis', voice: 'Douce', pitch: 1.15, rate: 0.9 },
  ysmer: { name: 'Gardien des portails Ysmer', voice: 'Thomas', pitch: 0.9, rate: 1.0 }
};

// ---------------------------------------------------------------- Répliques (id → texte)
const L = (id, who, t) => ({ id, who, t });

export const STORY_LINES = {
  // Cinématique 1 — L'Éveil du Veilleur
  c1: [
    L('pro_c1_01', 'nessa', 'On raconte qu’une pierre dormait au cœur de Korvalune, depuis avant les premiers rois.'),
    L('pro_c1_02', 'nessa', 'Personne ne l’avait jamais vue bouger. Personne, jusqu’à ce soir.'),
    L('pro_c1_03', 'veilleur', 'Qui… a touché… l’Éclat ?'),
    L('pro_c1_04', 'veilleur', 'Le ciel saigne encore. Je le sens. Approche, porteur. Le temps nous est compté.'),
    L('pro_c1_05', 'nessa', 'C’est ainsi qu’un voyageur sans nom devint le dernier espoir du monde. Sur le moment, il avait surtout faim.')
  ],
  // Cinématique 3 — la première spire
  c3: [
    L('a1_c3_01', 'veilleur', 'Là. Je la reconnais. La première des cinq spires.'),
    L('a1_c3_02', 'veilleur', 'Chacune garde un éclat du Cœur. Prends celui-ci, porteur : il te donnera plus qu’il ne te coûtera.'),
    L('a1_c3_03', 'nessa', 'Il ne le savait pas encore, mais la forêt venait de le remarquer.')
  ],
  // Cinématique 4 — fin de l'acte I
  c4: [
    L('a1_c4_01', 'nessa', 'Premier éclat, premier gardien tombé. Le monde commença à retenir son souffle.'),
    L('a1_c4_02', 'nessa', 'Mais d’autres spires s’allumaient déjà.')
  ],
  // Cinématique 2 — fin du prologue
  c2: [
    L('pro_c2_01', 'nessa', 'Ainsi s’achève le premier chapitre.'),
    L('pro_c2_02', 'nessa', 'Le suivant sera moins ensoleillé.')
  ]
};

// ---------------------------------------------------------------- Dialogues de quête (par quête et par étape)
export const STORY_TALKS = {
  story_p1: {
    talk: [
      L('pro_vaelis_01', 'vaelis', 'Ah, te voilà. Le Monolithe a frémi toute la nuit, et je n’ai pas fermé l’œil. Aucune tisane ne tient face à une pierre qui s’éveille.'),
      L('pro_vaelis_02', 'vaelis', 'Regarde ta main. Cette lueur n’est pas un reflet : c’est un éclat du Cœur d’Éther. Il t’a choisi.'),
      L('pro_vaelis_03', 'vaelis', 'Va voir la capitaine Rhoda. Si les failles s’ouvrent, c’est elle qui tiendra la ville. Dis-lui ce que tu portes.')
    ]
  },
  story_p2: {
    rhoda_a: [
      L('pro_rhoda_01', 'rhoda', 'Alors c’est toi, le porteur dont parle Vaelis. Je ne crois que ce que je vois, et je vois quelqu’un qui n’a même pas de casque.'),
      L('pro_rhoda_02', 'rhoda', 'Des bandits profitent du désordre pour piller les caravanes. Chasses-en cinq, et prouve-moi que ton éclat sert à autre chose qu’à briller.')
    ],
    rhoda_b: [
      L('pro_rhoda_03', 'rhoda', 'Cinq de moins. Tu tiens mieux ton épée que ta langue, et c’est un compliment.'),
      L('pro_rhoda_04', 'rhoda', 'Va trouver Halvar, à la porte sud. Il a des choses à te dire sur le Veilleur, et sur la forêt qui s’étend au-delà.')
    ]
  },
  story_a1_1: {
    ysmer: [
      L('a1_ysmer_01', 'ysmer', 'Ah, un porteur d’éclat ! Je garde les portails, mais cette nuit ils bourdonnent tout seuls. Même les clés sont nerveuses.'),
      L('a1_ysmer_02', 'ysmer', 'La Forêt des Ombres s’étend au-delà de la ville. Les arbres y murmurent, et ce n’est pas pour dire bonjour.'),
      L('a1_ysmer_03', 'ysmer', 'Une spire ancienne se dresse tout au fond. Si elle s’est éveillée, il faut la voir de tes yeux. Méfie-toi des ours : ils sont de mauvaise humeur.')
    ]
  },
  story_a1_2: {
    vaelis: [
      L('a1_vaelis_01', 'vaelis', 'Une spire ! Et cet éclat dans ta main s’est mis à chanter. Je n’ai rien entendu de pareil depuis ma formation.'),
      L('a1_vaelis_02', 'vaelis', 'Chaque spire garde un morceau du Cœur d’Éther, et des gardiens que l’ombre a retournés. Pour avancer, il faudra en vaincre un.'),
      L('a1_vaelis_03', 'vaelis', 'Cherche un Gardien corrompu, dans les failles. Et emporte des potions. Beaucoup de potions.')
    ]
  },
  story_a1_3: {
    rhoda: [
      L('a1_rhoda_01', 'rhoda', 'Un Gardien corrompu, abattu par un seul voyageur. Mes soldats voudront une démonstration. Je leur dirai que j’étais là.'),
      L('a1_rhoda_02', 'rhoda', 'Plus sérieusement : tu as rouvert une porte que personne n’osait toucher. Repose-toi. La suite sera moins aimable.')
    ]
  },
  story_p3: {
    halvar: [
      L('pro_halvar_01', 'halvar', 'Ah, le porteur ! Rhoda m’a prévenu. Tu as l’air plus solide qu’hier.'),
      L('pro_halvar_02', 'halvar', 'Ma grand-mère disait toujours : la pierre s’éveillera quand le ciel se fendra. Je croyais à une histoire pour endormir les enfants.'),
      L('pro_halvar_03', 'halvar', 'Les Ombres gagnent la grande forêt. Va. Et reviens entier : j’ai déjà assez de papiers à remplir.')
    ]
  }
};

// ---------------------------------------------------------------- Quêtes du mode histoire
// `cine: 'c1'` sur l'étape d'événement : la cinématique se joue quand le joueur s'approche du lieu indiqué.
export const STORY_QUESTS = [
  { id: 'story_p1', name: 'Prologue : L’Éveil', level: 1, story: true, next: 'story_p2',
    steps: [
      { id: 'cine', text: 'Toucher la pierre d’éclat : le Monolithe des Métamorphoses, sur sa place ({k:interact} à côté de lui)', type: 'event', target: 'cine_c1' },
      { id: 'talk', text: 'Parler à la Mystique Vaelis, à l’ouest de la ville', type: 'talk', target: 'mystic' }
    ],
    reward: reward(2, 0.5) },
  { id: 'story_p2', name: 'Prologue : Un éclat dans la main', level: 2, story: true, next: 'story_p3',
    steps: [
      { id: 'rhoda_a', text: 'Parler à la Capitaine Rhoda', type: 'talk', target: 'captain' },
      { id: 'kill', text: 'Tuer 5 bandits', type: 'kill', target: 'bandit', need: 5 },
      { id: 'rhoda_b', text: 'Retourner voir la Capitaine Rhoda', type: 'talk', target: 'captain' }
    ],
    reward: reward(6, 0.8) },
  { id: 'story_p3', name: 'Prologue : Ce que disent les anciens', level: 3, story: true, next: 'story_a1_1',
    steps: [
      { id: 'halvar', text: 'Parler au garde Halvar, à la porte sud', type: 'talk', target: 'guard' },
      { id: 'end', text: 'Le prologue est terminé', type: 'auto' }
    ],
    reward: reward(8, 1) }
];

const ev = (id, text, target) => ({ id, text, type: 'event', target });
STORY_QUESTS.push(
  { id: 'story_a1_1', name: 'Acte I : Les Ombres', level: 10, story: true, next: 'story_a1_2',
    steps: [
      { id: 'ysmer', text: 'Parler au Gardien des portails Ysmer', type: 'talk', target: 'portalkeeper' },
      ev('forest', 'Se rendre dans la Forêt des Ombres', 'region_forest'),
      { id: 'kill', text: 'Tuer 6 ours des forêts', type: 'kill', target: 'bear', need: 6 }
    ],
    reward: reward(12, 1) },
  { id: 'story_a1_2', name: 'Acte I : La première spire', level: 14, story: true, next: 'story_a1_3',
    steps: [
      ev('spire', 'Trouver la spire dans la Forêt des Ombres (elle brille de violet)', 'spire_1'),
      { id: 'vaelis', text: 'Raconter ta découverte à la Mystique Vaelis', type: 'talk', target: 'mystic' }
    ],
    reward: reward(16, 1.2) },
  { id: 'story_a1_3', name: 'Acte I : Le Gardien corrompu', level: 22, story: true,
    steps: [
      { id: 'kill', text: 'Vaincre un Gardien corrompu (il rôde dans les failles)', type: 'kill', target: 'warden_corrupted', need: 1 },
      { id: 'rhoda', text: 'Retourner voir la Capitaine Rhoda', type: 'talk', target: 'captain' },
      { id: 'end', text: 'L’acte I est terminé', type: 'auto' }
    ],
    reward: reward(26, 1.6) }
);

export const STORY_FIRST = 'story_p1';
export const STORY_START_AFTER = 'tuto_1'; // V10.49 : l'histoire démarre dès la première initiation terminée (avant : fin de « Le commencement »)

// Cinématique 1 : caméra autour du Monolithe (coordonnées relatives à sa position)
// Chaque plan : durée minimale `dur`, position/regard de départ et d'arrivée, et les répliques dites pendant le plan.
export const CINEMATICS = {
  c3: {
    title: 'La première spire', at: 'spire',
    shots: [
      { dur: 6, from: { p: [22, 20, 24], l: [0, 9, 0] }, to: { p: [12, 12, 14], l: [0, 12, 0] }, say: [0], fx: 'dusk' },
      { dur: 7, from: { p: [-7, 5, 9], l: [0, 13, 0] }, to: { p: [-4, 8, 6], l: [0, 15, 0] }, say: [1], fx: 'pulse' },
      { dur: 5, from: { p: [-26, 30, 34], l: [0, 6, 0] }, to: { p: [-36, 38, 50], l: [0, 8, 0] }, say: [2], fx: 'glow' }
    ]
  },
  c4: {
    title: 'Acte I', card: ['ACTE I TERMINÉ', 'Acte II : Les Archives, à suivre…'],
    shots: [
      { dur: 6, from: { p: [28, 22, 34], l: [0, 6, 0] }, to: { p: [38, 32, 52], l: [0, 10, 0] }, say: [0, 1], fx: 'dusk' }
    ]
  },
  c1: {
    title: 'L’Éveil',
    shots: [
      { dur: 7, from: { p: [26, 16, 30], l: [0, 4, 0] }, to: { p: [16, 11, 20], l: [0, 5, 0] }, say: [0, 1], fx: 'dusk' },
      { dur: 5, from: { p: [9, 3, 11], l: [0, 6, 0] }, to: { p: [6, 4, 8], l: [0, 7, 0] }, say: [2], fx: 'pulse' },
      { dur: 7, from: { p: [-8, 6, 8], l: [0, 5, 0] }, to: { p: [-3, 9, 14], l: [0, 6, 0] }, say: [3], fx: 'glow' },
      { dur: 6, from: { p: [-12, 22, 24], l: [0, 3, 0] }, to: { p: [-22, 30, 40], l: [0, 6, 0] }, say: [4], fx: 'glow' }
    ]
  },
  c2: {
    title: 'Fin du prologue',
    card: ['PROLOGUE TERMINÉ', 'Acte I : Les Ombres, à suivre…'],
    shots: [
      { dur: 6, from: { p: [30, 26, 36], l: [0, 6, 0] }, to: { p: [40, 36, 56], l: [0, 10, 0] }, say: [0, 1], fx: 'dusk' }
    ]
  }
};
