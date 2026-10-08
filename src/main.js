import { Game } from './core/Game.js';
import './style.css';

let errorShown = false;
function showFatalError(err) {
  if (errorShown) return; // évite un déluge d'alertes si l'erreur se répète en boucle
  errorShown = true;
  console.error('Erreur Legends of Aetheria :', err);
  alert('Une erreur a arrêté le jeu :\n' + (err?.message || err) + '\n\nMerci de signaler ce message exact.');
}
window.addEventListener('error', (e) => showFatalError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showFatalError(e.reason));

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  window.__game = new Game(root);
});
