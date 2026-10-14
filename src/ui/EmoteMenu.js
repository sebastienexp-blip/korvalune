import { EMOTES } from '../visual/ExtraClips.js';

// V10.48 — Menu des émotes : une grille de boutons (touche G, bouton 🙂 de la barre latérale, ou /danse, /salut… dans le chat).
// L'émote est jouée par le personnage ; les autres joueurs la voient (l'animation est relayée par le réseau).
export class EmoteMenu {
  constructor(game) {
    this.game = game;
    const el = this.el = document.createElement('div');
    el.id = 'emote-panel'; el.className = 'panel hidden';
    el.innerHTML = `<div class="em-title">Émotes</div><div class="em-grid">${EMOTES.map((e) => `<button class="em-btn" data-em="${e.id}" title="${e.name}"><span>${e.icon}</span><small>${e.name}</small></button>`).join('')}</div><div class="em-hint">Bouge pour arrêter · chat : /danse, /salut…</div>`;
    (game.root.querySelector('#game-ui') || game.root).appendChild(el);
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('.em-btn'); if (!b) return;
      this.play(b.dataset.em); this.close();
    });
    document.addEventListener('pointerdown', (ev) => { if (!el.classList.contains('hidden') && !ev.target.closest('#emote-panel') && !ev.target.closest('#btn-emote')) this.close(); });
  }
  play(id) {
    const p = this.game.player;
    if (!p || !p.startEmote(id)) this.game.hud?.notify?.('Impossible de faire une émote maintenant (combat, monture ou en l’air).', 'info');
  }
  toggle() { this.el.classList.toggle('hidden'); }
  close() { this.el.classList.add('hidden'); }
}
