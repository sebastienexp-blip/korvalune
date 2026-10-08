import { Game } from './core/Game.js';
import './style.css';
import { startUpdateCheck } from './core/UpdateCheck.js';

let errorShown = false;
function showFatalError(err) {
  if (errorShown) return; // évite un déluge d'alertes si l'erreur se répète en boucle
  errorShown = true;
  console.error('Erreur Korvalune :', err);
  alert('Une erreur a arrêté le jeu :\n' + (err?.message || err) + '\n\nMerci de signaler ce message exact.');
}
window.addEventListener('error', (e) => showFatalError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showFatalError(e.reason));

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  window.__game = new Game(root);
  // V10.6 — nouvelle version publiée pendant que la page est ouverte : bandeau « Recharger » (la partie est sauvegardée avant)
  startUpdateCheck(() => {
    const bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Une nouvelle version de Korvalune est disponible.</span><button type="button">Mettre à jour</button>';
    bar.querySelector('button').addEventListener('click', () => {
      try { window.__game?.player && window.__game._doSave?.(); } catch { /* ignoré */ }
      setTimeout(() => location.reload(), 300);
    });
    document.body.appendChild(bar);
  });
});
