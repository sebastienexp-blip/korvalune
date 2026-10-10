// V10.29 — Classement des spires : meilleur niveau atteint par personnage (Ascension) et meilleur Zénith (niveau puis temps).
let cache = { t: 0, v: null };
export function riftBoard(accounts, now = Date.now()) {
  if (cache.v && now - cache.t < 20000) return cache.v;
  const rows = [];
  for (const acc of Object.values(accounts || {})) {
    for (const c of (acc && Array.isArray(acc.chars) ? acc.chars : [])) {
      const r = c && c.rift; if (!r) continue;
      const asc = Math.max(0, Math.floor(r.bestAscent) || 0), zl = Math.max(0, Math.floor(r.bestZenith && r.bestZenith.level) || 0);
      if (!asc && !zl) continue;
      rows.push({ name: String(c.name || 'Aventurier').slice(0, 24), cls: String(c.classId || '').slice(0, 12), lvl: Math.floor(c.level) || 1, asc, zl, zt: Math.floor(r.bestZenith && r.bestZenith.time) || 0 });
    }
  }
  const pick = (f, cmp) => rows.filter(f).sort(cmp).slice(0, 50);
  cache = { t: now, v: {
    asc: pick((r) => r.asc > 0, (a, b) => b.asc - a.asc || b.lvl - a.lvl),
    zen: pick((r) => r.zl > 0, (a, b) => b.zl - a.zl || a.zt - b.zt)
  } };
  return cache.v;
}
