// V10.26 — Besace des matériaux : tous les ingrédients (matériaux d'artisanat) et les runes ramassés vont dans une
// réserve à part, sans limite de quantité, qui ne prend aucune place dans l'inventaire.
import { MATS, RUNES } from './crafting.js';

// (pas d'import JSON ici : le serveur Node charge ce module tel quel)
export const SATCHEL_IDS = [...MATS.map((m) => m.id), ...RUNES.map((r) => r.id), 'mat_wood', 'mat_ore', 'mat_herb'];
const SET = new Set(SATCHEL_IDS);
export const SATCHEL_MAX = 999999999;
export const isSatchelId = (id) => SET.has(id);

/** Nettoie une réserve {id: quantité} (client et serveur) : identifiants connus, entiers positifs bornés. */
export function cleanSatchel(raw, fallback) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : (fallback && typeof fallback === 'object' ? fallback : {});
  const out = {};
  for (const id of SATCHEL_IDS) {
    const n = Math.floor(Number(src[id]));
    if (Number.isFinite(n) && n > 0) out[id] = Math.min(SATCHEL_MAX, n);
  }
  return out;
}
