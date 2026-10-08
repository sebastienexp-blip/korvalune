import { computeEnemyStats } from './enemyScaling.js';

function reward(level, mult = 1) {
  const base = computeEnemyStats(level, 'bandit');
  return { xp: Math.round(base.xp * 6 * mult), coins: Math.round(base.coins[1] * 4 * mult) };
}

// 8 quêtes principales réparties sur 4 PNJ (Hugo, Sébastien, Morgane,
// Laurine) qui jalonnent la progression à travers les 5 mondes. Chaque
// chaîne est déclarée dans npcs.json (questChain) ; les dialogues
// offer_<id> / progress_<id> y sont aussi.
export const MAIN_QUESTS = [
  { id: 'hugo_1', name: 'Les premiers pas', level: 1,
    steps: [{ id: 'k', text: 'Tuer 4 loups', type: 'kill', target: 'wolf', need: 4 }, { id: 't', text: 'Retourner voir Hugo', type: 'talk', target: 'hugo' }],
    reward: reward(3, 0.6) },
  { id: 'hugo_2', name: "Un peu d'entraînement", level: 6,
    steps: [{ id: 'k', text: 'Tuer 6 bandits', type: 'kill', target: 'bandit', need: 6 }, { id: 't', text: 'Retourner voir Hugo', type: 'talk', target: 'hugo' }],
    reward: reward(10, 0.8) },
  { id: 'sebastien_1', name: 'Éclaireur en terres hostiles', level: 22,
    steps: [{ id: 'k', text: 'Tuer 6 loups corrompus', type: 'kill', target: 'wolf_corrupted', need: 6 }, { id: 't', text: 'Retourner voir Sébastien', type: 'talk', target: 'sebastien' }],
    reward: reward(30, 1) },
  { id: 'sebastien_2', name: 'La menace corrompue', level: 35,
    steps: [{ id: 'k', text: 'Vaincre un Gardien corrompu', type: 'kill', target: 'warden_corrupted', need: 1 }, { id: 't', text: 'Retourner voir Sébastien', type: 'talk', target: 'sebastien' }],
    reward: reward(45, 1.3) },
  { id: 'morgane_1', name: "Échos d'un monde oublié", level: 60,
    steps: [{ id: 'k', text: 'Tuer 6 loups célestes', type: 'kill', target: 'wolf_celestial', need: 6 }, { id: 't', text: 'Retourner voir Morgane', type: 'talk', target: 'morgane' }],
    reward: reward(70, 1.4) },
  { id: 'morgane_2', name: 'Le Gardien céleste', level: 85,
    steps: [{ id: 'k', text: 'Vaincre un Gardien céleste', type: 'kill', target: 'warden_celestial', need: 1 }, { id: 't', text: 'Retourner voir Morgane', type: 'talk', target: 'morgane' }],
    reward: reward(95, 1.6) },
  { id: 'laurine_1', name: 'La dernière campagne', level: 145,
    steps: [{ id: 'k', text: 'Tuer 8 traqueurs primordiaux', type: 'kill', target: 'stalker_primordial', need: 8 }, { id: 't', text: 'Retourner voir Laurine', type: 'talk', target: 'laurine' }],
    reward: reward(160, 1.8) },
  { id: 'laurine_2', name: 'Le Souverain du Néant', level: 190,
    steps: [{ id: 'k', text: 'Vaincre le Souverain du Néant', type: 'killBoss', target: 'sovereign_void', need: 1 }, { id: 't', text: 'Retourner voir Laurine', type: 'talk', target: 'laurine' }],
    reward: reward(195, 2.5) }
];
