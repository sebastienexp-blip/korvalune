import { activeSetBonuses } from '../data/sets.js';
import { getItem, resolveItem, nextInstanceId } from './Item.js';

export const SLOTS = ['head', 'shoulders', 'chest', 'gloves', 'legs', 'boots', 'cape', 'mainhand', 'offhand', 'ring', 'necklace'];
export const SLOT_LABELS = {
  head: 'Tête', shoulders: 'Épaules', chest: 'Torse', gloves: 'Gants', legs: 'Jambes', boots: 'Bottes',
  cape: 'Cape', mainhand: 'Arme principale', offhand: 'Arme secondaire', ring: 'Anneau', necklace: 'Collier'
};

const BONUS_KEYS = [
  'atk', 'def', 'hp', 'mana', 'crit', 'str', 'agi', 'int', 'vit', 'spi', 'luck',
  'atkSpeedPct', 'critDmgPct', 'fireResPct', 'iceResPct', 'lightningResPct', 'dmgReductionPct', 'hpRegen', 'manaRegen',
  'moveSpeedPct', 'xpPct', 'goldPct', 'staRegenPct'
];

// Emplacements d'équipement du joueur. Calcule le bonus total de stats
// (Player.setEquipBonus) et la liste des effets spéciaux actifs
// (Player.setEquipEffects) à partir de tout ce qui est équipé — que ce
// soit un objet statique (items.json) ou généré procéduralement.
export class Equipment {
  constructor(bus, player, saved) {
    this.bus = bus; this.player = player;
    this.slots = Object.fromEntries(SLOTS.map((s) => [s, null]));
    if (saved) for (const s of SLOTS) if (saved[s]) this.slots[s] = saved[s];
    this.apply();
  }

  // Équipe l'objet situé à `index` dans l'inventaire ; l'objet précédemment
  // équipé (s'il y en a un) retourne dans l'inventaire au même emplacement.
  equipFromInventory(inventory, index) {
    const stackSlot = inventory.slots[index];
    if (!stackSlot) return false;
    const view = resolveItem(stackSlot);
    if (!view || (view.type !== 'weapon' && view.type !== 'armor')) return false;
    if (view.levelReq && this.player.level < view.levelReq) {
      this.bus.emit('notify', { text: `Niveau insuffisant (Niveau ${view.levelReq} requis)`, kind: 'warn' });
      return false;
    }
    const prev = this.slots[view.slot];
    this.slots[view.slot] = stackSlot.gen ? { gen: stackSlot.gen } : { defId: stackSlot.defId };
    inventory.slots[index] = prev ? { instanceId: stackSlot.instanceId, ...(prev.gen ? { gen: prev.gen } : { defId: prev.defId }), qty: 1 } : null;
    inventory.bus.emit('inventoryChanged');
    this.apply();
    this.bus.emit('notify', { text: `${view.name} équipé`, kind: 'info' });
    return true;
  }

  unequip(slotName, inventory) {
    const item = this.slots[slotName];
    if (!item) return;
    const idx = inventory.firstEmpty();
    if (idx === -1) { this.bus.emit('notify', { text: 'Inventaire plein !', kind: 'warn' }); return; }
    inventory.placeAt(idx, { instanceId: nextInstanceId(), ...(item.gen ? { gen: item.gen } : { defId: item.defId }), qty: 1 });
    this.slots[slotName] = null;
    this.apply();
  }

  // Résout l'objet équipé dans un emplacement (vue normalisée, voir Item.js).
  resolvedAt(slotName) { return resolveItem(this.slots[slotName]); }

  apply() {
    const bonus = Object.fromEntries(BONUS_KEYS.map((k) => [k, 0]));
    const effects = [];
    for (const s of SLOTS) {
      const item = this.slots[s];
      if (!item) continue;
      const view = resolveItem(item);
      if (!view) continue;
      for (const [k, v] of Object.entries(view.stats || {})) if (k in bonus) bonus[k] += v;
      for (const aff of view.affixes || []) if (aff.key in bonus) bonus[aff.key] += aff.value;
      for (const eff of view.effects || []) effects.push({ ...eff, sourceSlot: s });
    }
    const sb = activeSetBonuses(this.slots);
    for (const b of sb.bonus) for (const [k, v] of Object.entries(b)) if (k in bonus) bonus[k] += v;
    for (const e of sb.effects) effects.push(e);
    this.player.setEquipBonus(bonus);
    this.player.setEquipEffects(effects);
    this.bus.emit('equipmentChanged');
  }

  serialize() {
    const out = {};
    for (const s of SLOTS) out[s] = this.slots[s] || null;
    return out;
  }
}
