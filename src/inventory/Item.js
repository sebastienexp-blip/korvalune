import itemDefs from '../data/items.json';
import { getRarity } from '../data/rarities.js';
import { fixLegacyAffix } from '../data/affixPool.js';
import { SET_RARITY, SETS } from '../data/sets.js';

export const ITEMS = Object.fromEntries(itemDefs.map((d) => [d.id, d]));

// Historique (6 paliers) — conservé pour compatibilité ; voir data/rarities.js
// pour le nouveau système complet à 25 niveaux utilisé par le loot généré.
// RARITY ici reste utilisable (les objets statiques d'items.json gardent
// leurs clés telles quelles), mais pointe maintenant vers les couleurs/noms
// du système à 25 niveaux pour un affichage cohérent partout.
export const RARITY = new Proxy({}, {
  get(_, key) { const r = getRarity(key); return r ? { label: r.name, color: r.color, tier: r.tier } : undefined; }
});

export const RARITY_ORDER = ['commun', 'peu_commun', 'rare', 'epique', 'legendaire', 'mythique'];

export function getItem(id) { return ITEMS[id]; }

// Vue normalisée d'un objet, qu'il soit statique (items.json, via defId) ou
// généré procéduralement (voir ItemGenerator.js, stocké en entier dans la
// case via `gen`). Tout le code d'affichage (inventaire, fiche détaillée,
// équipement...) doit passer par ici plutôt que relire `slot.defId` à la main.
export function resolveItem(slot) {
  if (!slot) return null;
  if (slot.gen) {
    const g = slot.gen;
    const rarity = g.setId ? SET_RARITY : getRarity(g.rarityTier);
    if (g.affixes) for (const a of g.affixes) fixLegacyAffix(a, g.itemLevel, rarity);
    return {
      setId: g.setId || null, setDef: g.setId ? SETS[g.setId] : null,
      key: g.uid, name: g.name, icon: g.icon, type: g.type, slot: g.slot, visual: g.visual,
      rarity: rarity.id, rarityInfo: rarity, itemLevel: Math.min(200, g.itemLevel), levelReq: Math.min(200, g.levelReq),
      stats: g.stats || {}, affixes: g.affixes || [], effects: g.effects || [],
      value: g.value, desc: g.desc, stackable: false, isGenerated: true, gen: g
    };
  }
  const def = ITEMS[slot.defId];
  if (!def) return null;
  const rarity = getRarity(def.rarity);
  return {
    key: def.id, name: def.name, icon: def.icon, type: def.type, slot: def.slot, visual: def.visual || null,
    rarity: rarity.id, rarityInfo: rarity, itemLevel: null, levelReq: def.levelReq || 1,
    stats: def.stats || {}, affixes: [], effects: [],
    value: def.value, desc: def.desc, stackable: !!def.stackable, maxStack: def.maxStack, isGenerated: false, defId: def.id
  };
}

// Pool d'objets équipables par rareté (hors consommables/matériaux), pour le tirage de loot.
export const EQUIP_POOL = RARITY_ORDER.reduce((acc, r) => {
  acc[r] = itemDefs.filter((d) => d.rarity === r && (d.type === 'weapon' || d.type === 'armor') && d.id !== 'guardian_core');
  return acc;
}, {});

let uid = 1;
export function nextInstanceId() { return 'it' + uid++; }
