// V10.59 — boost mondial lancé par le créateur (XP / butin), reçu du serveur ; expire tout seul.
const WB = { xp: 1, drop: 1, until: 0, label: '' };
export const setWorldBoost = (m) => { WB.xp = Math.min(3, Math.max(1, +m?.xp || 1)); WB.drop = Math.min(3, Math.max(1, +m?.drop || 1)); WB.until = m?.left != null ? Date.now() + Math.max(0, +m.left) : (+m?.until || 0); WB.label = String(m?.label || ''); };
// V10.70 — bonus personnel (ticket / code) : se cumule avec le boost mondial en prenant le meilleur multiplicateur.
const PB = { xp: 1, drop: 1, until: 0, label: '' };
export const setPersonalBoost = (m) => { PB.xp = Math.min(3, Math.max(1, +m?.xp || 1)); PB.drop = Math.min(3, Math.max(1, +m?.drop || 1)); PB.until = m?.left != null ? Date.now() + Math.max(0, +m.left) : (+m?.until || 0); PB.label = String(m?.label || 'Ticket'); };
const live = (b) => Date.now() < b.until;
export const wbXp = () => Math.max(live(WB) ? WB.xp : 1, live(PB) ? PB.xp : 1);
export const wbDrop = () => Math.max(live(WB) ? WB.drop : 1, live(PB) ? PB.drop : 1);
export const wbInfo = () => {
  const w = live(WB), p = live(PB);
  if (!w && !p) return null;
  if (w && !p) return { ...WB };
  if (p && !w) return { ...PB };
  return { xp: Math.max(WB.xp, PB.xp), drop: Math.max(WB.drop, PB.drop), until: Math.max(WB.until, PB.until), label: `${WB.label} + ${PB.label}` };
};
