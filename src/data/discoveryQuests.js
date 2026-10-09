// V10.18 — Quêtes de découverte : elles présentent le contenu récent (services de la ville, garde-robe, montures, difficulté, Halloween).
// Étapes `event` : validées par les évènements du jeu (Game._tut). Elles démarrent d'elles-mêmes (voir Game._startDiscoveryQuests).
import { computeEnemyStats } from './enemyScaling.js';

const ev = (id, text, target, extra = {}) => ({ id, text, type: 'event', target, ...extra });
const reward = (level, k) => { const b = computeEnemyStats(level, 'bandit'); return { xp: Math.round(b.xp * k * 5), coins: Math.round(b.coins[1] * k * 4) }; };

export const DISCOVERY_QUESTS = [
  { id: 'decouv_ville', name: 'Les services de Korvalune', level: 1, discovery: true, startLevel: 1,
    steps: [
      ev('barber', 'Rendez visite au barbier (près de la statue) pour changer d’apparence', 'barber'),
      ev('stable', 'Passez voir le maître d’écurie pour découvrir les montures', 'stable'),
      ev('lune', 'Ouvrez la boutique des Lunes (menu pause ou bouton 🌙)', 'lune'),
      ev('daily', 'Récupérez votre récompense quotidienne de Lunes', 'lunedaily')
    ],
    reward: reward(3, 0.8) },
  { id: 'decouv_monture', name: 'En selle !', level: 5, discovery: true, startLevel: 5,
    steps: [
      ev('buy', 'Achetez votre première monture à l’écurie (cheval brun : 400 pièces, niveau 5)', 'mountbuy'),
      ev('ride', 'Montez en selle (bouton 🐎)', 'mount'),
      ev('swim', 'Traversez un plan d’eau à cheval : les chevaux nagent !', 'swim')
    ],
    reward: reward(8, 1) },
  { id: 'decouv_garderobe', name: 'Du style, enfin !', level: 10, discovery: true, startLevel: 10,
    steps: [
      ev('cos', 'Ouvrez l’inventaire et équipez un cosmétique dans la garde-robe', 'cosmetic'),
      ev('pet', 'Équipez un compagnon (le lapin de lune est offert au niveau 10)', 'pet'),
      ev('skin', 'Équipez un skin (boutique des Lunes ou récompenses de niveau)', 'skin')
    ],
    reward: reward(12, 1) },
  { id: 'decouv_difficulte', name: 'Plus dur, plus riche', level: 10, discovery: true, startLevel: 10,
    steps: [
      ev('diff', 'En ville, menu pause → ⚔️ Difficulté : choisissez « Difficile »', 'difficulty'),
      ev('hard', 'Vainquez 20 monstres en difficulté Difficile ou plus', 'diffkill', { need: 20 })
    ],
    reward: reward(15, 1.2) },
  { id: 'decouv_halloween', name: 'La nuit des citrouilles', level: 1, discovery: true, startLevel: 1, eventOnly: 'halloween',
    steps: [
      ev('jack', 'Parlez à Jack Tête-de-Citrouille, près du puits', 'halloween'),
      ev('candy', 'Ramassez 6 bonbons cachés dans la ville', 'candy', { need: 6 }),
      ev('kill', 'Vainquez 10 monstres d’Halloween (hors de la ville, la nuit !)', 'hwkill', { need: 10 }),
      ev('buy', 'Achetez un objet dans la boutique de Jack', 'hwbuy')
    ],
    reward: reward(10, 1.2) }
];
