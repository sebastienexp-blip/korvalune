import { rollLootItem, generateItem, rollItemLevel } from './ItemGenerator.js';
import { getDifficulty } from '../data/difficulty.js';
import { rollRarityTier, RARITIES, classForTier } from '../data/rarities.js';
import { POTION_IDS } from '../data/potions.js';
import { RUNES } from '../data/crafting.js';

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

// V10.21 — potions dans les 6 raretés. Famille : soin 45 %, mana 35 %, renouveau 20 %.
// La rareté suit la même courbe que les objets (décalée pour boss/coffres) ; le niveau de la source
// plafonne la rareté pour qu'un monstre de bas niveau ne lâche pas un nectar absolu.
function rollPotion(level = 1, shift = 0) {
  const r = Math.random();
  const fam = r < 0.45 ? 'heal' : r < 0.8 ? 'mana' : 'rejuv';
  const cap = level < 8 ? 1 : level < 20 ? 8 : level < 40 ? 13 : level < 70 ? 19 : 25;
  const tier = rollRarityTier({ shift, maxTier: cap });
  const idx = RARITIES.indexOf(classForTier(tier));
  return { defId: POTION_IDS[Math.max(0, idx)][fam], qty: 1 };
}

// V10.19 — runes (rang selon le niveau) et matériaux d'artisanat
function runeFor(level) {
  const t = Math.max(1, Math.min(RUNES.length, 1 + Math.floor((level || 1) / 15) + (Math.random() < 0.35 ? 1 : 0) - (Math.random() < 0.3 ? 1 : 0)));
  return { defId: RUNES[t - 1].id, qty: 1 };
}
function matsFor(level, rich = 0) {
  const out = [];
  const r = Math.random(), k = 1 + rich;
  if (r < 0.7) out.push({ defId: 'mat_ferraille', qty: Math.round((1 + Math.random() * 3) * k) });
  if (Math.random() < 0.35 + 0.1 * rich) out.push({ defId: 'mat_poussiere', qty: Math.round((1 + Math.random() * 2) * k) });
  if (level >= 15 && Math.random() < 0.12 * k) out.push({ defId: 'mat_essence', qty: Math.round(1 + Math.random() * k) });
  if (level >= 40 && Math.random() < 0.05 * k) out.push({ defId: 'mat_cristal', qty: 1 });
  return out;
}

export const LootSystem = {
  // V10.19 : accès direct (coffres du monde…)
  rune: runeFor,
  potion: rollPotion,
  mats: matsFor,

  // Butin d'un ennemi normal : potion probable + chance d'objet généré
  // proche de son niveau réel (pas celui, générique, de son espèce).
  rollForEnemy(enemy) {
    const drops = [];
    const D = getDifficulty();
    if (Math.random() < Math.min(0.8, CONSUMABLE_CHANCE * (1 + (D.drop - 1) * 0.4))) drops.push(rollPotion(enemy.level || 1, 0));
    // chance d'objet × difficulté ; au-delà de 100 %, objets supplémentaires (ex. 126 % = 1 objet + 26 % d'un second)
    const ch = (enemy.def.itemDropChance ?? ENEMY_ITEM_CHANCE) * D.drop;
    const n = Math.floor(ch) + (Math.random() < ch - Math.floor(ch) ? 1 : 0);
    for (let i = 0; i < n; i++) drops.push({ gen: rollLootItem({ sourceLevel: enemy.level || 1, tierShift: 0 }) });
    if (Math.random() < 0.06 * D.drop) drops.push(runeFor(enemy.level)); // 6 % par monstre, partout dans le monde // V10.19
    if (Math.random() < 0.22 * Math.min(2, D.drop)) drops.push(...matsFor(enemy.level).slice(0, 2));
    return drops;
  },

  // Butin d'un boss "normal" (ex: chef bandit du donjon) : objet généré garanti,
  // avec une courbe de rareté bien plus généreuse.
  rollForBoss(level = 10) {
    return [{ gen: rollLootItem({ sourceLevel: level, tierShift: BOSS_TIER_SHIFT, levelSpread: [2, 8] }) }, runeFor(level), rollPotion(level + 10, BOSS_TIER_SHIFT), ...matsFor(level, 2)];
  },

  // Butin d'un boss majeur (ex: Le Gardien des Ruines) : un objet garanti
  // avec un décalage de rareté encore plus fort, plus une chance spécifique,
  // non négligeable, de toucher directement Mythique / Absolu.
  rollForMajorBoss(level = 14) {
    const drops = [{ gen: rollLootItem({ sourceLevel: level, tierShift: MAJOR_BOSS_TIER_SHIFT, levelSpread: [4, 12] }) }];
    drops.push(runeFor(level + 10), runeFor(level), rollPotion(level + 20, MAJOR_BOSS_TIER_SHIFT), rollPotion(level + 20, MAJOR_BOSS_TIER_SHIFT), ...matsFor(level, 3));
    if (Math.random() < 0.3) drops.push({ defId: 'mat_ame', qty: 1 });
    if (Math.random() < 0.03) {
      drops.push({ gen: generateItem({ category: Math.random() < 0.5 ? 'weapon' : 'armor', itemLevel: rollItemLevel(level + 8), rarityTier: rollRarityTier({ minTier: 19, maxTier: 25 }) }) });
    }
    return drops;
  },

  // Butin d'un coffre de donjon : un ou deux objets généralement solides.
  rollForChest(level = 20) {
    const drops = [{ gen: rollLootItem({ sourceLevel: level, tierShift: 3, levelSpread: [0, 5] }) }];
    if (Math.random() < 0.6) drops.push(rollPotion(level, 3), rollPotion(level, 3));
    if (Math.random() < 0.4) drops.push(runeFor(level));
    drops.push(...matsFor(level, 1));
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
    drops.push(runeFor(level + 5), runeFor(level), rollPotion(level + 20, GOBLIN_TIER_SHIFT), rollPotion(level + 20, GOBLIN_TIER_SHIFT), ...matsFor(level, 3));
    return drops;
  }
};
