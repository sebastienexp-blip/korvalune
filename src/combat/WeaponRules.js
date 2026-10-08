// Armes attitrées : chaque classe ne peut utiliser ses compétences personnelles
// qu'avec une arme de sa famille (pas de flèches avec une baguette !).
import { resolveItem } from '../inventory/Item.js';

export const CLASS_WEAPONS = {
  warrior: ['sword', 'axe', 'mace', 'spear', 'halberd', 'scimitar', 'warhammer'],
  paladin: ['sword', 'mace', 'warhammer', 'spear', 'halberd'],
  mage: ['staff', 'wand', 'tome'],
  archer: ['bow', 'crossbow'],
  assassin: ['dagger', 'scimitar']
};
export const FAMILY_NAMES = {
  sword: 'épée', axe: 'hache', mace: 'masse', spear: 'lance', halberd: 'hallebarde', scimitar: 'cimeterre',
  warhammer: 'marteau de guerre', dagger: 'dague', bow: 'arc', crossbow: 'arbalète', staff: 'bâton', wand: 'baguette', tome: 'grimoire'
};
const RANGED = new Set(['bow', 'crossbow']);
const MAGIC = new Set(['staff', 'wand', 'tome']);

// famille de l'arme tenue en main principale ('' si aucune)
export function weaponFamily(equipment) {
  const slot = equipment?.slots?.mainhand;
  if (!slot) return '';
  if (slot.gen?.baseKey) return slot.gen.baseKey;
  const id = slot.defId || '';
  const pre = id.split('_')[0];
  if (FAMILY_NAMES[pre]) return pre;
  const v = resolveItem(slot)?.visual;
  return v || '';
}
export function canUseClassSkills(classId, family) {
  const ok = CLASS_WEAPONS[classId];
  return !ok || ok.includes(family);
}
export function weaponHint(classId) {
  return (CLASS_WEAPONS[classId] || []).map((f) => FAMILY_NAMES[f]).slice(0, 3).join(' / ');
}
// type de projectile d'une attaque : selon l'arme réellement tenue
export function projectileKind(family) { return RANGED.has(family) ? 'arrow' : MAGIC.has(family) ? 'bolt' : null; }
