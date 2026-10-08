import { getItem, nextInstanceId } from './Item.js';

const ROWS = 5, COLS = 6;

// Grille d'inventaire 6x5. Chaque case contient soit null, soit
// { instanceId, defId, qty } pour un objet statique (items.json), soit
// { instanceId, gen: {...objet généré}, qty:1 } pour un objet généré
// procéduralement (voir ItemGenerator.js) — toujours non empilable.
export class Inventory {
  constructor(bus, size = ROWS * COLS, saved) {
    this.bus = bus;
    this.size = size;
    this.slots = new Array(size).fill(null);
    if (saved) this._restore(saved);
  }

  _restore(saved) {
    for (let i = 0; i < this.size && i < saved.length; i++) {
      const s = saved[i];
      if (!s) continue;
      if (s.gen) this.slots[i] = { instanceId: nextInstanceId(), gen: s.gen, qty: 1 };
      else this.slots[i] = { instanceId: nextInstanceId(), defId: s.defId, qty: s.qty };
    }
  }

  // Ajoute un objet généré procéduralement (toujours unique, non empilable).
  addGenerated(genItem) {
    const idx = this.firstEmpty();
    if (idx === -1) { this.bus.emit('notify', { text: 'Inventaire plein !', kind: 'warn' }); return false; }
    this.slots[idx] = { instanceId: nextInstanceId(), gen: genItem, qty: 1 };
    this.bus.emit('inventoryChanged');
    return true;
  }

  findStackable(defId) {
    const def = getItem(defId);
    if (!def?.stackable) return -1;
    return this.slots.findIndex((s) => s && s.defId === defId && s.qty < (def.maxStack || 99));
  }

  firstEmpty() { return this.slots.findIndex((s) => !s); }

  add(defId, qty = 1) {
    const def = getItem(defId);
    if (!def) return false;
    let remaining = qty;
    if (def.stackable) {
      let idx;
      while (remaining > 0 && (idx = this.findStackable(defId)) !== -1) {
        const slot = this.slots[idx];
        const room = (def.maxStack || 99) - slot.qty;
        const take = Math.min(room, remaining);
        slot.qty += take;
        remaining -= take;
      }
    }
    while (remaining > 0) {
      const idx = this.firstEmpty();
      if (idx === -1) { this.bus.emit('notify', { text: 'Inventaire plein !', kind: 'warn' }); break; }
      const take = def.stackable ? Math.min(def.maxStack || 99, remaining) : 1;
      this.slots[idx] = { instanceId: nextInstanceId(), defId, qty: take };
      remaining -= take;
    }
    this.bus.emit('inventoryChanged');
    return remaining; // 0 = tout a été placé ; sinon, quantité restée sans place
  }

  removeAt(index, qty = 1) {
    const slot = this.slots[index];
    if (!slot) return null;
    const def = slot.gen || getItem(slot.defId);
    if (!slot.gen && slot.qty > qty) { slot.qty -= qty; this.bus.emit('inventoryChanged'); return def; }
    this.slots[index] = null;
    this.bus.emit('inventoryChanged');
    return def;
  }

  takeWhole(index) {
    const slot = this.slots[index];
    if (!slot) return null;
    this.slots[index] = null;
    this.bus.emit('inventoryChanged');
    return slot;
  }

  placeAt(index, slotData) {
    this.slots[index] = slotData;
    this.bus.emit('inventoryChanged');
  }

  serialize() { return this.slots.map((s) => (s ? (s.gen ? { gen: s.gen } : { defId: s.defId, qty: s.qty }) : null)); }
}
