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
  ysmer: { name: 'Gardien des portails Ysmer', voice: 'Thomas', pitch: 0.9, rate: 1.0 },
  maren: { name: 'Sergent Maren', voice: 'Paul K', pitch: 0.85, rate: 1.0 },
  orlan: { name: 'Maître Orlan', voice: 'Eric', pitch: 0.7, rate: 0.88 },
  disciple: { name: 'Un disciple', voice: 'Thomas', pitch: 0.75, rate: 0.9 }
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
  // Cinématique 5 — ce que sait la pierre
  c5: [
    L('a1_c5_01', 'veilleur', 'Porteur. Tu as droit à la vérité, et je te la dois depuis le premier soir.'),
    L('a1_c5_02', 'veilleur', 'Tu n’es pas le premier à avoir touché l’Éclat. Il y a eu un homme avant toi : Orlan, archiviste du royaume.'),
    L('a1_c5_03', 'veilleur', 'Il m’a veillé trente ans. Puis il a entendu le Cœur… et le Cœur lui a répondu. Les spires sont ses plaies. Je les garde, mais je n’ai plus de mains.'),
    L('a1_c5_04', 'nessa', 'La pierre se tut. Pour la première fois, le voyageur comprit que la menace avait un visage, et un nom.')
  ],
  // Cinématique 4 — fin de l'acte I
  c4: [
    L('a1_c4_01', 'nessa', 'Premier éclat, premier gardien tombé. Le monde commença à retenir son souffle.'),
    L('a1_c4_02', 'orlan', 'Tu as brisé l’un de mes gardiens. C’est bien. Il en reste quatre, et des Archives entières à parcourir pour me trouver.'),
    L('a1_c4_03', 'nessa', 'Mais d’autres spires s’allumaient déjà.')
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
  story_a1_1b: {
    halvar: [
      L('a1b_halvar_01', 'halvar', 'Porteur, une minute. Pas pour plaisanter, cette fois.'),
      L('a1b_halvar_02', 'halvar', 'Il y a trois jours, une patrouille de quatre soldats est entrée dans la Forêt des Ombres. Ils étaient menés par le sergent Maren. C’est elle qui m’a appris à tenir une lance.'),
      L('a1_halvar_03', 'halvar', 'Aucun signal, aucun retour. Maren ne rate jamais un rapport. Trouve leur camp, trouve ce qui leur est arrivé. Et si tu peux, ramène-moi au moins une bonne nouvelle.')
    ],
    halvar2: [
      L('a1b_halvar_04', 'halvar', 'Elle écrit qu’elle entend un chant sous les racines ? Maren n’a jamais eu d’imagination. Si elle l’a écrit, c’est vrai.'),
      L('a1b_halvar_05', 'halvar', 'Va voir la Mystique. Ces chants-là, c’est son affaire, pas celle d’une lance. Et… merci d’avoir lu jusqu’au bout.')
    ]
  },
  story_a1_1c: {
    vaelis: [
      L('a1c_vaelis_01', 'vaelis', 'Montre-moi ce carnet. Hum. Un chant sous les racines, des cristaux noirs, des hommes en robe grise qui s’agenouillent sans un mot.'),
      L('a1c_vaelis_02', 'vaelis', 'Ces cristaux sont des éclats d’ombre. Chacun chante, et chaque chant affaiblit la forêt un peu plus. Il y en a trois autour du camp de la patrouille.'),
      L('a1c_vaelis_03', 'vaelis', 'Brise-les. Approche-toi, laisse l’éclat que tu portes répondre : il suffit qu’il les touche. Mais attention aux disciples qui les veillent.')
    ],
    vaelis2: [
      L('a1c_vaelis_04', 'vaelis', 'Tu as réussi. J’ai entendu les cristaux mourir d’ici : un son aigu, comme un cri d’enfant.'),
      L('a1c_vaelis_05', 'vaelis', 'Avant de se briser, le dernier a dit quelque chose. Une voix d’homme, très calme. Il a dit : « Il a enfin un porteur. »'),
      L('a1c_vaelis_06', 'vaelis', 'Quelqu’un sait pour toi, porteur. Quelqu’un attendait. Va jusqu’à la spire : tout vient de là.')
    ]
  },
  story_a1_2: {
    vaelis: [
      L('a1_vaelis_01', 'vaelis', 'Une spire ! Et cet éclat dans ta main s’est mis à chanter. Je n’ai rien entendu de pareil depuis ma formation.'),
      L('a1_vaelis_02', 'vaelis', 'Chaque spire garde un morceau du Cœur d’Éther, et des gardiens que l’ombre a retournés. Pour avancer, il faudra en vaincre un.'),
      L('a1_vaelis_03', 'vaelis', 'Cherche un Gardien corrompu, dans les failles. Et emporte des potions. Beaucoup de potions.')
    ]
  },
  story_a1_2b: {
    rhoda: [
      L('a2b_rhoda_01', 'rhoda', 'Tu reviens de la spire avec un éclat qui brille et des yeux qui ont vu quelque chose. Parle. Pas d’enjolivures.'),
      L('a2b_rhoda_02', 'rhoda', 'Des hommes en robe grise. Un chant. Des cristaux. Et un nom que tu n’as pas encore trouvé… Je sais où chercher. Mes soldats ont saisi ce matin un coffre aux armes d’un camp de fanatiques.'),
      L('a2b_rhoda_03', 'rhoda', 'Ils transportaient des lettres. Rapporte-m’en trois, prises sur les fanatiques et les mages renégats qui rôdent dans la forêt. Je veux savoir qui les paie.')
    ],
    rhoda2: [
      L('a2b_rhoda_04', 'rhoda', 'Trois lettres, trois écritures différentes, une seule signature : « O. ». Le même sceau sur chaque cachet.'),
      L('a2b_rhoda_05', 'rhoda', 'Ysmer connaît tous les sceaux du royaume, jusqu’aux plus vieux. Porte-lui ça. Et dis-lui que je ne plaisante pas.')
    ]
  },
  story_a1_2c: {
    ysmer: [
      L('a2c_ysmer_01', 'ysmer', 'Ce sceau… Je l’ai déjà vu. Une tour, un livre ouvert, et une plume qui perce le livre. C’est celui de l’archiviste royal.'),
      L('a2c_ysmer_02', 'ysmer', 'Orlan Vexe. Il avait accès à toutes les chroniques du royaume. On l’a chassé de Korvalune il y a vingt ans, quand il a voulu ouvrir une salle que personne ne devait ouvrir.'),
      L('a2c_ysmer_03', 'ysmer', 'Il aurait dû mourir en exil. Son ancien cabinet d’étude existe encore, au fond de la Forêt des Ombres, dans une ruine que les racines ont avalée. Va voir ce qu’il y a laissé.')
    ],
    ysmer2: [
      L('a2c_ysmer_04', 'ysmer', 'Cinq spires dessinées sur un mur, et une seule barrée de rouge ? Alors il a déjà commencé. Les portails se mettent à saigner de la même couleur.'),
      L('a2c_ysmer_05', 'ysmer', 'Je ne peux plus garder les portails seul. Tiens la ville : les disciples vont attaquer, j’en mets ma clé au feu. Halvar t’attend à la porte sud.')
    ]
  },
  story_a1_2d: {
    halvar: [
      L('a2d_halvar_01', 'halvar', 'Les disciples de la robe grise viennent d’attaquer la porte sud ! Ils veulent la place et le Monolithe.'),
      L('a2d_halvar_02', 'halvar', 'Mes hommes tiennent la porte, mais il en arrive d’autres. Repousse-les. Je ne te promets pas de pouvoir te couvrir longtemps.')
    ],
    halvar2: [
      L('a2d_halvar_03', 'halvar', 'La porte tient. Pas un de mes hommes de moins. Va voir la pierre, porteur : les disciples n’en avaient qu’après elle.')
    ]
  },
  story_a1_3: {
    vaelis: [
      L('a3_vaelis_01', 'vaelis', 'Orlan a divisé le Cœur en cinq éclats, et il garde chacun d’eux par un gardien retourné. La spire de la forêt a le sien.'),
      L('a3_vaelis_02', 'vaelis', 'Dans les failles, on les appelle les Spires corrompues. Un gardien y mène une meute d’élite. Il est plus fort que tout ce que tu as affronté. Prépare-toi.'),
      L('a3_vaelis_03', 'vaelis', 'Emporte beaucoup de potions, et ne te bats pas seul si tu peux l’éviter. Le Veilleur a dit que tu reviendrais. Je le crois.')
    ],
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
  { id: 'story_a1_1', name: 'Acte I : Les Ombres', level: 10, story: true, next: 'story_a1_1b',
    steps: [
      { id: 'ysmer', text: 'Parler au Gardien des portails Ysmer', type: 'talk', target: 'portalkeeper' },
      ev('forest', 'Se rendre dans la Forêt des Ombres', 'region_forest'),
      { id: 'kill', text: 'Tuer 6 ours des forêts', type: 'kill', target: 'bear', need: 6 }
    ],
    reward: reward(12, 1) },
  { id: 'story_a1_1b', name: 'Acte I : La patrouille disparue', level: 12, story: true, next: 'story_a1_1c',
    steps: [
      { id: 'halvar', text: 'Parler au garde Halvar, à la porte sud', type: 'talk', target: 'guard' },
      ev('camp', 'Trouver le camp de la patrouille dans la Forêt des Ombres (lueur ambrée)', 'poi_camp'),
      { id: 'kill', text: 'Chasser 6 loups qui rôdent autour du camp', type: 'kill', target: 'wolf', need: 6 },
      ev('carnet', 'Retrouver le carnet du sergent Maren (lueur ambrée)', 'poi_carnet'),
      { id: 'halvar2', text: 'Rapporter le carnet à Halvar', type: 'talk', target: 'guard' }
    ],
    reward: reward(14, 1.2) },
  { id: 'story_a1_1c', name: 'Acte I : Le chant sous les racines', level: 13, story: true, next: 'story_a1_2',
    steps: [
      { id: 'vaelis', text: 'Montrer le carnet à la Mystique Vaelis', type: 'talk', target: 'mystic' },
      ev('cristal_1', 'Briser le premier cristal noir, près du camp (lueur violette)', 'poi_cristal_1'),
      { id: 'kill', text: 'Tuer 4 fanatiques incendiaires, les disciples qui veillent les cristaux', type: 'kill', target: 'zealot', need: 4 },
      ev('cristal_2', 'Briser le deuxième cristal noir (lueur violette)', 'poi_cristal_2'),
      ev('cristal_3', 'Briser le troisième cristal noir (lueur violette)', 'poi_cristal_3'),
      { id: 'vaelis2', text: 'Retourner voir la Mystique Vaelis', type: 'talk', target: 'mystic' }
    ],
    reward: reward(15, 1.3) },
  { id: 'story_a1_2', name: 'Acte I : La première spire', level: 14, story: true, next: 'story_a1_2b',
    steps: [
      ev('spire', 'Trouver la spire dans la Forêt des Ombres (elle brille de violet)', 'spire_1'),
      { id: 'vaelis', text: 'Raconter ta découverte à la Mystique Vaelis', type: 'talk', target: 'mystic' }
    ],
    reward: reward(16, 1.2) },
  { id: 'story_a1_2b', name: 'Acte I : Les lettres signées « O. »', level: 16, story: true, next: 'story_a1_2c',
    steps: [
      { id: 'rhoda', text: 'Parler à la Capitaine Rhoda', type: 'talk', target: 'captain' },
      { id: 'kill', text: 'Prendre 3 lettres aux mages renégats de la Forêt des Ombres', type: 'kill', target: 'cultist_mage', need: 3 },
      { id: 'rhoda2', text: 'Remettre les lettres à la Capitaine Rhoda', type: 'talk', target: 'captain' }
    ],
    reward: reward(18, 1.3) },
  { id: 'story_a1_2c', name: 'Acte I : Le cabinet d’Orlan', level: 18, story: true, next: 'story_a1_2d',
    steps: [
      { id: 'ysmer', text: 'Montrer le sceau à Ysmer, gardien des portails', type: 'talk', target: 'portalkeeper' },
      ev('etude', 'Explorer l’ancien cabinet d’Orlan, ruine au fond de la Forêt des Ombres (lueur ambrée)', 'poi_etude'),
      { id: 'kill', text: 'Venir à bout de 6 bandits des routes qui pillent la ruine', type: 'kill', target: 'bandit', need: 6 },
      { id: 'ysmer2', text: 'Raconter à Ysmer ce que tu as vu', type: 'talk', target: 'portalkeeper' }
    ],
    reward: reward(20, 1.4) },
  { id: 'story_a1_2d', name: 'Acte I : La nuit de la porte sud', level: 20, story: true, next: 'story_a1_3',
    steps: [
      { id: 'halvar', text: 'Rejoindre Halvar à la porte sud', type: 'talk', target: 'guard' },
      { id: 'kill', text: 'Repousser 8 fanatiques incendiaires', type: 'kill', target: 'zealot', need: 8 },
      { id: 'halvar2', text: 'Retourner voir Halvar', type: 'talk', target: 'guard' },
      ev('cine', 'Interroger le Veilleur : toucher le Monolithe des Métamorphoses ({k:interact} à côté de lui)', 'cine_c5')
    ],
    reward: reward(22, 1.5) },
  { id: 'story_a1_3', name: 'Acte I : Le Gardien corrompu', level: 22, story: true,
    steps: [
      { id: 'vaelis', text: 'Recevoir les conseils de la Mystique Vaelis', type: 'talk', target: 'mystic' },
      { id: 'kill', text: 'Vaincre un Gardien corrompu (chef d’une meute d’élite dans les failles « Spires corrompues », niveau 22 et plus)', type: 'kill', target: 'warden_corrupted', need: 1 },
      { id: 'rhoda', text: 'Retourner voir la Capitaine Rhoda', type: 'talk', target: 'captain' },
      { id: 'end', text: 'L’acte I est terminé', type: 'auto' }
    ],
    reward: reward(26, 1.6) }
);

// Lieux à découvrir (histoire) : posés dans la région indiquée, à `r` mètres du site de la région sous l'angle `a`.
// Tant que l'étape correspondante est en cours, une lueur signale le lieu ; s'en approcher lit le texte et valide l'étape.
export const STORY_POIS = {
  camp: { region: 'forest', r: 70, a: 0.9, color: 0xffb347, title: 'Camp de la patrouille',
    lines: [
      '(Le camp est vide. Les tentes sont lacérées de l’intérieur, le feu éteint depuis des jours.)',
      '(Quatre paires de bottes sont alignées au centre, parfaitement droites, comme si leurs propriétaires s’étaient évaporés sur place. Des empreintes de pas partent en cercle, toutes vers le même arbre.)'
    ] },
  carnet: { region: 'forest', r: 100, a: 1.9, color: 0xffb347, title: 'Carnet du sergent Maren',
    lines: [
      L('poi_carnet_1', 'maren', '« Jour 2. Un chant sous les racines. Les hommes disent qu’ils ne l’entendent pas. Moi, si. Il connaît nos noms. »'),
      L('poi_carnet_2', 'maren', '« Jour 3. Des hommes en robe grise veillent des cristaux noirs. Ils ne nous ont pas attaqués : ils nous ont souri. »'),
      L('poi_carnet_3', 'maren', '« Si quelqu’un lit ceci : n’écoutez pas le chant. Dites à Halvar que j’ai encore perdu mon pari. » (La page s’arrête là.)')
    ] },
  cristal_1: { region: 'forest', r: 60, a: 2.6, color: 0x7a2cff, title: 'Cristal noir',
    lines: ['(Le cristal chante. Quand ton éclat le touche, la note se brise net, et le sol tremble.)'] },
  cristal_2: { region: 'forest', r: 90, a: 3.5, color: 0x7a2cff, title: 'Cristal noir',
    lines: ['(Le deuxième cristal saigne une fumée sombre. Il murmure ton nom avant de s’éteindre.)'] },
  cristal_3: { region: 'forest', r: 120, a: 4.4, color: 0x7a2cff, title: 'Cristal noir',
    lines: ['(Le dernier cristal est plus grand que les autres. Quand il éclate, un souffle chaud traverse la forêt, et les oiseaux se taisent.)'] },
  etude: { region: 'forest', r: 150, a: 5.5, color: 0xffb347, title: 'Le cabinet d’Orlan',
    lines: [
      '(Une table renversée, des centaines de feuillets que l’humidité a collés ensemble. Sur le mur du fond, cinq spires dessinées au charbon, reliées par un trait.)',
      '(Une seule est barrée de rouge. Dessous, d’une écriture soignée : « Quand le Cœur sera entier, plus personne ne mourra. »)',
      '(Un dernier feuillet, signé « O. » : « Le Veilleur ne m’a pas cru. Il aurait dû. »)'
    ] }
};

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
  c5: {
    title: 'Ce que sait la pierre',
    shots: [
      { dur: 6, from: { p: [14, 8, 18], l: [0, 6, 0] }, to: { p: [8, 6, 11], l: [0, 7, 0] }, say: [0, 1], fx: 'pulse' },
      { dur: 7, from: { p: [-9, 5, 9], l: [0, 6, 0] }, to: { p: [-5, 8, 6], l: [0, 8, 0] }, say: [2], fx: 'glow' },
      { dur: 5, from: { p: [-20, 24, 30], l: [0, 4, 0] }, to: { p: [-30, 34, 46], l: [0, 6, 0] }, say: [3], fx: 'dusk' }
    ]
  },
  c4: {
    title: 'Acte I', card: ['ACTE I TERMINÉ', 'Acte II : Les Archives, à suivre…'],
    shots: [
      { dur: 6, from: { p: [28, 22, 34], l: [0, 6, 0] }, to: { p: [38, 32, 52], l: [0, 10, 0] }, say: [0, 1, 2], fx: 'dusk' }
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
