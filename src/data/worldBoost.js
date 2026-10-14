// V10.59 — boost mondial lancé par le créateur (XP / butin), reçu du serveur ; expire tout seul.
const WB = { xp: 1, drop: 1, until: 0, label: '' };
export const setWorldBoost = (m) => { WB.xp = Math.min(3, Math.max(1, +m?.xp || 1)); WB.drop = Math.min(3, Math.max(1, +m?.drop || 1)); WB.until = m?.left != null ? Date.now() + Math.max(0, +m.left) : (+m?.until || 0); WB.label = String(m?.label || ''); };
export const wbXp = () => (Date.now() < WB.until ? WB.xp : 1);
export const wbDrop = () => (Date.now() < WB.until ? WB.drop : 1);
export const wbInfo = () => (Date.now() < WB.until ? { ...WB } : null);
