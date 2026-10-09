import { rollLootItem, generateItem, rollItemLevel } from './ItemGenerator.js';
import { getDifficulty } from '../data/difficulty.js';
import { rollRarityTier } from '../data/rarities.js';

// Tirage de loot. Les ennemis normaux et les boss passent tous les deux par
// le générateur procédural à 25 raretés (ItemGenerator.js) — seule la
// "décalage" (tierShift) vers les hautes raretés change, ce qui donne aux
// boss une bien meilleure chance d'objets rares sans dupliquer la logique.
// Entièrement réajustable : ce sont les seuls nombres à changer ici.
const ENEMY_ITEM_CHANCE = 0.3;
const BOSS_TIER_SHIFT = 8;       // boss normal : décale la courbe de ~8 paliers
const MAJOR_BOSS_TIER_SHIFT = 14; // boss majeur : encore plus généreux
const GOBLIN_TIER_SHIFT = 12;     // lutin trésor : rare à attraper, donc très généreux
const CONSUMABLE_CHANCE = 0.35;
const CONSUMABLES = ['potion_heal_small', 'potion_mana'];

export const LootSystem = {
  // Butin d'un ennemi normal : potion probable + chance d'objet généré
  // proche de son niveau réel (pas celui, générique, de son espèce).
  rollForEnemy(enemy) {
    const drops = [];
    const D = getDifficulty();
    if (Math.random() < Math.min(0.8, CONSUMABLE_CHANCE * (1 + (D.drop - 1) * 0.4))) drops.push({ defId: CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)], qty: 1 });
    // chance d'objet × difficulté ; au-delà de 100 %, objets supplémentaires (ex. 126 % = 1 objet + 26 % d'un second)
    const ch = (enemy.def.itemDropChance ?? ENEMY_ITEM_CHANCE) * D.drop;
    const n = Math.floor(ch) + (Math.random() < ch - Math.floor(ch) ? 1 : 0);
    for (let i = 0; i < n; i++) drops.push({ gen: rollLootItem({ sourceLevel: enemy.level || 1, tierShift: 0 }) });
    return drops;
  },

  // Butin d'un boss "normal" (ex: chef bandit du donjon) : objet généré garanti,
  // avec une courbe de rareté bien plus généreuse.
  rollForBoss(level = 10) {
    return [{ gen: rollLootItem({ sourceLevel: level, tierShift: BOSS_TIER_SHIFT, levelSpread: [2, 8] }) }];
  },

  // Butin d'un boss majeur (ex: Le Gardien des Ruines) : un objet garanti
  // avec un décalage de rareté encore plus fort, plus une chance spécifique,
  // non négligeable, de toucher directement Mythique / Absolu.
  rollForMajorBoss(level = 14) {
    const drops = [{ gen: rollLootItem({ sourceLevel: level, tierShift: MAJOR_BOSS_TIER_SHIFT, levelSpread: [4, 12] }) }];
    if (Math.random() < 0.03) {
      drops.push({ gen: generateItem({ category: Math.random() < 0.5 ? 'weapon' : 'armor', itemLevel: rollItemLevel(level + 8), rarityTier: rollRarityTier({ minTier: 19, maxTier: 25 }) }) });
    }
    return drops;
  },

  // Butin d'un coffre de donjon : un ou deux objets généralement solides.
  rollForChest(level = 20) {
    const drops = [{ gen: rollLootItem({ sourceLevel: level, tierShift: 3, levelSpread: [0, 5] }) }];
    if (Math.random() < 0.5) drops.push({ defId: 'potion_heal_big', qty: 2 });
    return drops;
  },

  // Butin du lutin trésor : toute la raison d'être de cet ennemi est son
  // taux de drop démesuré — plusieurs objets garantis, avec une courbe de
  // rareté nettement plus généreuse qu'un boss normal.
  rollForTreasureGoblin(level = 10) {
    const count = 3 + Math.floor(Math.random() * 3); // 3 à 5 objets
    const drops = [];
    for (let i = 0; i < count; i++) {
      drops.push({ gen: rollLootItem({ sourceLevel: level, tierShift: GOBLIN_TIER_SHIFT, levelSpread: [0, 6] }) });
    }
    return drops;
  }
};
