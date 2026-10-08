import { WORLD_TIERS } from '../world/WorldTiers.js';
import { computeEnemyStats } from './enemyScaling.js';

// Génère 30 quêtes secondaires par monde (contrats de chasse) à partir de
// modèles combinés aux espèces réelles de chaque monde : chaque quête est un
// vrai objectif de combat suivi par QuestManager, avec une récompense
// calculée sur le niveau réel des ennemis du monde. Modifier TEMPLATES
// ajuste les 150 quêtes d'un coup.
const TEMPLATES = [
  { need: 5, namePattern: (l) => `Nettoyage : ${l}` },
  { need: 8, namePattern: (l) => `Chasse aux ${l}` },
  { need: 10, namePattern: (l) => `Contrat : éliminer les ${l}` },
  { need: 12, namePattern: (l) => `Purge des ${l}` },
  { need: 15, namePattern: (l) => `Extermination : ${l}` },
  { need: 20, namePattern: (l) => `Grand nettoyage — ${l}` }
];

const SPECIES_LABEL = {
  wolf_sand: 'loups des sables', boar_sand: 'sangliers des dunes', bear_sand: 'ours des sables', marauder_sand: 'maraudeurs des dunes', brute_sand: 'brutes des sables', rat_sand: 'rats des sables', zealot_sand: 'fanatiques du désert', troll_sand: 'trolls des sables', archer_sand: 'archers nomades', mage_sand: 'mages des mirages',
  wolf_swamp: 'loups des marais', boar_swamp: 'sangliers des marais', bear_swamp: 'ours des marais', marauder_swamp: 'maraudeurs des marais', brute_swamp: 'brutes des marais', rat_swamp: 'rats des marais', zealot_swamp: 'fanatiques des marais', troll_swamp: 'trolls des marais', archer_swamp: 'archers des roseaux', mage_swamp: 'mages de la brume',
  wolf_frost: 'loups des neiges', boar_frost: 'sangliers des glaces', bear_frost: 'ours polaires', marauder_frost: 'maraudeurs du givre', brute_frost: 'brutes des glaces', rat_frost: 'rats des neiges', zealot_frost: 'fanatiques du givre', troll_frost: 'trolls des glaces', archer_frost: 'archers du givre', mage_frost: 'mages de givre',
  bandit_archer: 'archers des routes', cultist_mage: 'mages renégats',
  archer_corrupted: 'archers corrompus', mage_corrupted: 'mages corrompus',
  archer_celestial: 'archers célestes', mage_celestial: 'mages célestes',
  archer_abyssal: 'archers abyssaux', mage_abyssal: 'mages abyssaux',
  archer_primordial: 'archers primordiaux', mage_primordial: 'mages primordiaux',
  rat_giant: 'rats géants', zealot: 'fanatiques incendiaires', shield_guard: 'gardes-routes blindés', troll: 'trolls des collines', wolf_alpha: 'loups alpha',
  rat_corrupted: 'rats corrompus', zealot_corrupted: 'fanatiques corrompus', troll_corrupted: 'trolls corrompus',
  rat_celestial: 'rats célestes', zealot_celestial: 'fanatiques célestes', troll_celestial: 'trolls célestes',
  rat_abyssal: 'rats abyssaux', zealot_abyssal: 'fanatiques abyssaux', troll_abyssal: 'trolls abyssaux',
  rat_primordial: 'rats primordiaux', zealot_primordial: 'fanatiques primordiaux', troll_primordial: 'trolls primordiaux',
  wolf: 'loups', wolf_corrupted: 'loups corrompus', wolf_celestial: 'loups célestes', wraith_abyssal: 'spectres abyssaux', stalker_primordial: 'traqueurs primordiaux',
  boar: 'sangliers', boar_corrupted: 'sangliers corrompus', boar_celestial: 'sangliers célestes', behemoth_abyssal: 'béhémoths abyssaux', colossus_primordial: 'colosses primordiaux',
  bear: 'ours des forêts', bear_corrupted: 'ours corrompus', bear_celestial: 'ours célestes', bear_abyssal: 'ours abyssaux', bear_primordial: 'ours primordiaux',
  bandit: 'bandits', marauder_corrupted: 'maraudeurs corrompus', sentinel_celestial: 'sentinelles célestes', marauder_abyssal: 'maraudeurs abyssaux', herald_primordial: 'hérauts primordiaux',
  brute: 'brutes des routes', brute_corrupted: 'brutes corrompues', brute_celestial: 'gardes colossaux', brute_abyssal: 'brutes abyssales', brute_primordial: 'titans primordiaux'
};

const TIER1_SPECIES = ['wolf', 'boar', 'bear', 'bandit', 'brute', 'rat_giant', 'zealot', 'shield_guard', 'troll', 'wolf_alpha', 'bandit_archer', 'cultist_mage'];

function rewardFor(level, need) {
  const base = computeEnemyStats(level, 'bandit');
  return { xp: Math.round(base.xp * (1.8 + need * 0.32)), coins: Math.round(base.coins[1] * (1.3 + need * 0.22)) };
}

// V4.4 : défis polyvalents (esquive, potions, butin, équipement, élites). Ils
// utilisent les événements du jeu ('tut') plutôt que des cibles de combat.
const CHALLENGES = [
  { key: 'roll', need: 15, name: 'Danse des lames', text: (n) => `Faire ${n} roulades`, event: 'roll' },
  { key: 'use', need: 6, name: 'Soif de survie', text: (n) => `Utiliser ${n} consommables (potions…)`, event: 'use' },
  { key: 'loot', need: 12, name: 'Pilleur de dépouilles', text: (n) => `Ramasser ${n} objets`, event: 'loot' },
  { key: 'equip', need: 4, name: 'Garde-robe de combat', text: (n) => `Équiper ${n} objets`, event: 'equip' },
  { key: 'meteor', need: 1, name: "Chasseur d'étoiles", text: (n) => `Survivre à ${n} pluie${n > 1 ? 's' : ''} d'astres (sans être touché)`, event: 'meteor' },
  { key: 'champion', need: 3, name: 'Briseur de champions', text: (n) => `Vaincre ${n} champions ★ (monstres à titre doré)`, event: 'champion' },
  { key: 'chest', need: 2, name: 'Chasseur de trésors', text: (n) => `Ouvrir ${n} coffres cachés dans le monde (étincelles dorées)`, event: 'chest' },
  { key: 'caravan', need: 1, name: 'Escorte marchande', text: (n) => `Mener ${n} caravane${n > 1 ? 's' : ''} à bon port (événement aléatoire en terrain découvert)`, event: 'caravan' },
  { key: 'elite', need: 3, name: "Chasseur d'élites", text: (n, t) => `Vaincre ${n} élites : ${t.eliteLabel}`, kill: true }
];
const ELITE_LABEL = { 6: 'gardiens d\'ambre', 7: 'gardiens de la brume', 8: 'gardiens de givre', 1: 'loups alpha', 2: 'gardiens corrompus', 3: 'gardiens célestes', 4: 'hérauts des abysses', 5: 'souverains primordiaux' };

export function generateSecondaryQuests() {
  const quests = [];
  for (const tier of WORLD_TIERS) {
    const [lo, hi] = tier.levelRange;
    const level = Math.round((lo + hi) / 2);
    CHALLENGES.forEach((c) => {
      const need = c.need + (tier.id - 1) * (c.key === 'meteor' || c.key === 'caravan' ? Math.floor((tier.id - 1) / 2) : c.key === 'equip' || c.key === 'elite' ? 1 : 3);
      const step = c.kill
        ? { id: 'k', text: c.text(need, { eliteLabel: ELITE_LABEL[tier.id] }), type: 'kill', target: tier.id === 1 ? 'wolf_alpha' : tier.elite, need }
        : { id: 'k', text: c.text(need), type: 'event', target: c.event, need };
      quests.push({
        id: `sq_t${tier.id}_challenge_${c.key}`,
        name: `Défi : ${c.name}`, level, tierId: tier.id, secondary: true, steps: [step],
        reward: rewardFor(level, need * 1.2)
      });
    });
  }
  for (const tier of WORLD_TIERS) {
    const species = tier.id === 1 ? TIER1_SPECIES : tier.species;
    const [lo, hi] = tier.levelRange;
    species.forEach((speciesKey, si) => {
      // Le niveau recommandé augmente d'une espèce à l'autre dans la tranche du monde.
      const level = Math.round(lo + ((si + 0.5) / species.length) * (hi - lo));
      const label = SPECIES_LABEL[speciesKey] || speciesKey;
      TEMPLATES.forEach((tpl, ti) => {
        quests.push({
          id: `sq_t${tier.id}_${speciesKey}_${ti}`,
          name: tpl.namePattern(label), level, tierId: tier.id, secondary: true,
          steps: [{ id: 'k', text: `Tuer ${tpl.need} ${label}`, type: 'kill', target: speciesKey, need: tpl.need }],
          reward: rewardFor(level, tpl.need)
        });
      });
    });
  }
  return quests;
}
