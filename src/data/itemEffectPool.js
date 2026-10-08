// Effets spéciaux (sorts automatiques) pouvant apparaître sur les objets de
// haute rareté. `minTier` = plus petite rareté (1-25) pouvant tirer cet
// effet — c'est ce qui implémente la progression demandée (petits effets
// dès le tier 8, sorts puissants à partir du tier 16, effets uniques
// réservés aux tiers 23-25...). `triggerOn` : 'hit' se déclenche quand le
// joueur inflige des dégâts, 'hurt' quand il en subit. Résolu réellement en
// combat par CombatSystem/Player — voir applyItemEffect().
export const ITEM_EFFECTS = [
  { id: 'spark_shock', name: 'Étincelle', triggerOn: 'hit', dmgType: 'lightning', power: 0.6, aoe: false, range: 4, cooldown: 4, minTier: 8, chance: [0.04, 0.07] },
  { id: 'frost_bite', name: 'Morsure de givre', triggerOn: 'hit', dmgType: 'ice', power: 0.6, aoe: false, range: 4, cooldown: 4, minTier: 8, chance: [0.04, 0.07] },
  { id: 'ember_touch', name: 'Touche ardente', triggerOn: 'hit', dmgType: 'fire', power: 0.6, aoe: false, range: 4, cooldown: 4, minTier: 8, chance: [0.04, 0.07] },

  { id: 'fireball_proc', name: 'Boule de feu', triggerOn: 'hit', dmgType: 'fire', power: 1.1, aoe: false, range: 6, cooldown: 6, minTier: 11, chance: [0.05, 0.08] },
  { id: 'ice_nova_proc', name: 'Nova de glace', triggerOn: 'hurt', dmgType: 'ice', power: 0.9, aoe: true, range: 4, cooldown: 7, minTier: 11, chance: [0.04, 0.07] },
  { id: 'lightning_chain', name: 'Éclair en chaîne', triggerOn: 'hit', dmgType: 'lightning', power: 1.0, aoe: true, range: 5, cooldown: 7, minTier: 13, chance: [0.04, 0.06] },
  { id: 'heal_burst', name: 'Vague de soin', triggerOn: 'hurt', healPct: 0.08, cooldown: 10, minTier: 13, chance: [0.04, 0.06] },

  { id: 'flame_burst', name: 'Explosion de flammes', triggerOn: 'hit', dmgType: 'fire', power: 1.6, aoe: true, range: 5, cooldown: 8, minTier: 16, chance: [0.05, 0.08] },
  { id: 'blizzard_proc', name: 'Tourmente glaciale', triggerOn: 'hit', dmgType: 'ice', power: 1.5, aoe: true, range: 5.5, cooldown: 8, minTier: 16, chance: [0.04, 0.07] },
  { id: 'vampiric_touch', name: 'Toucher vampirique', triggerOn: 'hit', healPct: 0.1, cooldown: 9, minTier: 16, chance: [0.04, 0.07] },

  { id: 'meteor_proc', name: 'Chute d’astre', triggerOn: 'hit', dmgType: 'fire', power: 2.4, aoe: true, range: 6, cooldown: 10, minTier: 19, chance: [0.03, 0.06] },
  { id: 'thunderstorm', name: 'Tempête de foudre', triggerOn: 'hit', dmgType: 'lightning', power: 2.2, aoe: true, range: 6.5, cooldown: 10, minTier: 20, chance: [0.03, 0.05] },
  { id: 'void_rift', name: 'Déchirure du néant', triggerOn: 'hit', dmgType: 'physical', power: 3.2, aoe: false, range: 7, cooldown: 9, minTier: 22, chance: [0.03, 0.05] },

  { id: 'absolute_judgment', name: 'Jugement absolu', triggerOn: 'hit', dmgType: 'fire', power: 3.6, aoe: true, range: 7, cooldown: 11, minTier: 23, chance: [0.03, 0.05] },
  // V4.4 : effets de contrôle, de ressource et de poison
  { id: 'second_wind', name: 'Second souffle', triggerOn: 'hurt', staminaPct: 0.5, cooldown: 12, minTier: 9, chance: [0.05, 0.08] },
  { id: 'frost_shackle', name: 'Entraves de givre', triggerOn: 'hit', dmgType: 'ice', power: 0.5, aoe: false, range: 5, slowSec: 2.5, slowF: 0.45, cooldown: 6, minTier: 12, chance: [0.05, 0.08] },
  { id: 'mana_siphon', name: 'Siphon de mana', triggerOn: 'hit', manaPct: 0.12, cooldown: 8, minTier: 12, chance: [0.05, 0.08] },
  { id: 'venom_cloud', name: 'Nuée venimeuse', triggerOn: 'hit', dmgType: 'physical', power: 0.35, aoe: true, range: 4.5, dotSec: 4, dotPower: 0.5, cooldown: 9, minTier: 14, chance: [0.04, 0.07] },
  { id: 'thunder_clap', name: 'Coup de tonnerre', triggerOn: 'hit', dmgType: 'lightning', power: 0.8, aoe: true, range: 4, stunSec: 1.2, cooldown: 11, minTier: 15, chance: [0.04, 0.06] },
  { id: 'warding_light', name: 'Lumière protectrice', triggerOn: 'hurt', wardSec: 1.2, healPct: 0.05, cooldown: 16, minTier: 18, chance: [0.04, 0.06] },
  { id: 'genesis_blessing', name: 'Bénédiction de la Genèse', triggerOn: 'hurt', healPct: 0.22, cooldown: 14, minTier: 24, chance: [0.03, 0.05] },
  { id: 'infinity_cataclysm', name: 'Cataclysme infini', triggerOn: 'hit', dmgType: 'lightning', power: 4.5, aoe: true, range: 7.5, cooldown: 12, minTier: 25, chance: [0.03, 0.05] }
];

export function effectsAvailableForTier(tier) {
  return ITEM_EFFECTS.filter((e) => e.minTier <= tier);
}

export function rollEffectChance(def) {
  const [lo, hi] = def.chance;
  return Math.round((lo + Math.random() * (hi - lo)) * 1000) / 1000;
}
