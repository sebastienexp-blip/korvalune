// V10.19 — Potions : trois familles (soin, mana, renouveau) dans les 6 raretés du jeu.
export const POTION_IDS = [{"heal":"potion_heal_small","mana":"potion_mana","rejuv":"potion_rejuv_commun"},{"heal":"potion_heal_big","mana":"potion_mana_magique","rejuv":"potion_rejuv_magique"},{"heal":"potion_heal_rare","mana":"potion_mana_rare","rejuv":"potion_rejuv_rare"},{"heal":"potion_heal_legendaire","mana":"potion_mana_legendaire","rejuv":"potion_rejuv_legendaire"},{"heal":"potion_heal_mythique","mana":"potion_mana_mythique","rejuv":"potion_rejuv_mythique"},{"heal":"potion_heal_absolu","mana":"potion_mana_absolu","rejuv":"potion_rejuv_absolu"}];

// V10.22 — potions permanentes : une fois trouvée, une potion est à toi pour toujours (usage illimité) mais a un temps de recharge.
export const POTION_INFO = {};
POTION_IDS.forEach((o, idx) => { for (const fam of ['heal', 'mana', 'rejuv']) POTION_INFO[o[fam]] = { fam, idx }; });
export const POTION_CD = [30, 26, 22, 18, 14, 10]; // secondes, selon la rareté (Commun → Absolu)
export const REJUV_CD_MULT = 1.3;
export const DEFAULT_POTIONS = { heal: 'potion_heal_small', mana: 'potion_mana' };
export function potionCooldown(id) { const i = POTION_INFO[id]; return i ? Math.round(POTION_CD[i.idx] * (i.fam === 'rejuv' ? REJUV_CD_MULT : 1)) : 30; }
// une potion de soin sert au bouton « vie », une de mana au bouton « mana », le renouveau aux deux
export function potionServes(id, kind) { const i = POTION_INFO[id]; return !!i && (i.fam === kind || i.fam === 'rejuv'); }
// nettoie un état de potions (client et serveur) : liste d'identifiants valides + sélections cohérentes
export function cleanPotions(raw, fallback) {
  const src = raw && typeof raw === 'object' ? raw : (fallback && typeof fallback === 'object' ? fallback : {});
  const owned = [...new Set((Array.isArray(src.owned) ? src.owned : []).filter((id) => typeof id === 'string' && POTION_INFO[id]))];
  for (const id of Object.values(DEFAULT_POTIONS)) if (!owned.includes(id)) owned.push(id);
  const sel = (kind) => (potionServes(src[kind], kind) && owned.includes(src[kind]) ? src[kind] : DEFAULT_POTIONS[kind]);
  return { owned, heal: sel('heal'), mana: sel('mana') };
}
