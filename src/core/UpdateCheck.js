// V10.6 — Détection d'une nouvelle version pendant que la page reste ouverte.
// Le jeu compilé a des fichiers au nom unique (assets/index-XXXX.js) : si index.html en ligne pointe vers un autre fichier
// que celui chargé, c'est qu'une mise à jour a été publiée. On propose alors de recharger (jamais de rechargement forcé en pleine partie).
const RE = /\/assets\/index-[\w-]+\.js/;

export function startUpdateCheck(onFound, intervalMs = 3 * 60 * 1000) {
  const mine = [...document.scripts].map((s) => (s.src || '').match(RE)?.[0]).find(Boolean);
  if (!mine) return () => {}; // mode développement : rien à surveiller
  let done = false, busy = false;
  const check = async () => {
    if (done || busy || document.hidden) return;
    busy = true;
    try {
      const r = await fetch('/index.html?_=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const theirs = (await r.text()).match(RE)?.[0];
      if (theirs && theirs !== mine) { done = true; onFound(); }
    } catch { /* hors ligne : on réessaiera */ } finally { busy = false; }
  };
  const t = setInterval(check, intervalMs);
  const vis = () => { if (!document.hidden) check(); };
  document.addEventListener('visibilitychange', vis);
  setTimeout(check, 20000);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
}
