import { ACTIONS, GROUPS, RESERVED, ACTION_BY_ID, defaultKeys, keyLabel } from '../core/Keybinds.js';

// V4.2 : menu Options complet (onglets Graphismes / Son / Clavier & souris / Tactile / Interface / Jeu).
// Les réglages vivent dans game.settings (sauvegardés en local) ; chaque changement appelle game.applySettings().
export const DEFAULTS = {
  // graphismes
  quality: null, renderScale: 100, fpsCap: 0, viewDist: 100, grass: true, particleScale: 100, exposure: 100, fovAdj: 0,
  shake: 100, floatText: true, showFps: false, vignette: true, shadows: true, visualV25: true, realLook: true, adaptive: true,
  // son
  volume: 60, musicVol: 70, sfxVol: 100, ambVol: 60, uiVol: 100, mute: false,
  // souris / clavier
  lookSens: 100, invertY: false, invertWheel: false, zoomSpeed: 100, rotateBtn: 'right', cameraMode: 'iso', camRotate: 'auto', autoLoot: 'off', cameraLock: true,
  // interface / jeu
  showQuests: true, showMinimap: true, showHints: true, notifInfo: true, autoTarget: true, autosave: 60, autoFullscreen: false,
  uiScale: 100
};
export const TOUCH_DEFAULTS = { mode: 'auto', joySize: 1, btnSize: 1, opacity: 1, look: 1, pinch: 1, deadzone: 0.08, vibrate: true, leftHand: false, layout: {}, layoutP: {} };

const pct = (v) => `${v} %`;
const TABS = [
  { id: 'gfx', label: '🎨 Graphismes', items: [
    { t: 'select', k: 'quality', label: 'Préréglage de qualité', opts: [['verylow', 'Très faible'], ['low', 'Faible'], ['medium', 'Moyenne'], ['high', 'Élevée'], ['ultra', 'Ultra']], hint: 'Règle résolution, ombres, arbres, particules… Les réglages ci-dessous affinent le préréglage.' },
    { t: 'range', k: 'renderScale', label: 'Résolution de rendu', min: 40, max: 100, step: 5, fmt: pct },
    { t: 'select', k: 'fpsCap', label: 'Limiteur d’images/seconde', opts: [[0, 'Illimité'], [60, '60'], [45, '45'], [30, '30 (économie de batterie)']] },
    { t: 'range', k: 'viewDist', label: 'Distance de vue', min: 50, max: 150, step: 10, fmt: pct },
    { t: 'check', k: 'shadows', label: 'Ombres' },
    { t: 'check', k: 'realLook', label: 'Rendu réaliste (soleil bas, lumière dorée, ombres longues, détails au sol)' },
    { t: 'check', k: 'visualV25', label: 'Effets visuels (reflets, tonemapping, lueurs)' },
    { t: 'check', k: 'grass', label: 'Herbe animée' },
    { t: 'range', k: 'particleScale', label: 'Densité des particules', min: 0, max: 150, step: 10, fmt: pct },
    { t: 'range', k: 'exposure', label: 'Luminosité', min: 60, max: 140, step: 5, fmt: pct },
    { t: 'range', k: 'fovAdj', label: 'Champ de vision (écart)', min: -10, max: 20, step: 1, fmt: (v) => (v > 0 ? '+' : '') + v + '°' },
    { t: 'range', k: 'shake', label: 'Secousses d’écran', min: 0, max: 100, step: 10, fmt: pct },
    { t: 'check', k: 'vignette', label: 'Vignettage (bords assombris)' },
    { t: 'check', k: 'floatText', label: 'Nombres de dégâts flottants' },
    { t: 'check', k: 'adaptive', label: 'Résolution adaptative (anti-ralentissements)' },
    { t: 'check', k: 'showFps', label: 'Afficher les images/seconde' },
    { t: 'check', k: 'autoFullscreen', label: 'Plein écran au lancement' },
    { t: 'custom', id: 'debug' }
  ] },
  { id: 'snd', label: '🔊 Son', items: [
    { t: 'check', k: 'mute', label: 'Couper tout le son' },
    { t: 'range', k: 'volume', label: 'Volume général', min: 0, max: 100, step: 1, fmt: pct },
    { t: 'range', k: 'musicVol', label: 'Musique', min: 0, max: 100, step: 1, fmt: pct },
    { t: 'range', k: 'sfxVol', label: 'Effets (combat, pas, butin)', min: 0, max: 100, step: 1, fmt: pct, test: 'hit' },
    { t: 'range', k: 'ambVol', label: 'Ambiance (vent, pluie, nature)', min: 0, max: 100, step: 1, fmt: pct },
    { t: 'range', k: 'uiVol', label: 'Interface (clics, quêtes)', min: 0, max: 100, step: 1, fmt: pct, test: 'click' },
    { t: 'note', text: 'Le son se coupe automatiquement quand l’onglet passe en arrière-plan.' }
  ] },
  { id: 'keys', label: '⌨️ Clavier & souris', items: [
    { t: 'custom', id: 'keys' },
    { t: 'section', label: 'Souris et caméra' },
    { t: 'select', k: 'cameraMode', label: 'Caméra', opts: [['iso', 'Aérienne fixe (par défaut)'], ['free', 'Libre (3ᵉ personne)'], ['close', 'Épaule (3ᵉ personne rapprochée)'], ['high', 'Tactique (aérienne haute, grand champ)'], ['top', 'Vue de dessus (presque verticale)']] },
    { t: 'select', k: 'camRotate', label: 'Rotation de la caméra', opts: [['auto', 'Auto (selon la caméra)'], ['on', 'Activée (clic droit / glisser pour tourner)'], ['off', 'Désactivée (caméra figée)']] },
    { t: 'select', k: 'autoLoot', label: 'Ramassage automatique du butin', opts: [['off', 'Désactivé (touche d\'interaction)'], ['basic', 'Potions, parchemins et consommables'], ['all', 'Tout le butin proche']] },
    { t: 'check', k: 'cameraLock', label: 'Caméra verrouillée (mode libre)' },
    { t: 'select', k: 'rotateBtn', label: 'Pivoter la caméra avec', opts: [['right', 'Clic droit + glisser'], ['middle', 'Clic molette + glisser']] },
    { t: 'range', k: 'lookSens', label: 'Sensibilité de la souris', min: 20, max: 250, step: 10, fmt: pct },
    { t: 'check', k: 'invertY', label: 'Inverser l’axe vertical' },
    { t: 'range', k: 'zoomSpeed', label: 'Vitesse du zoom (molette)', min: 30, max: 250, step: 10, fmt: pct },
    { t: 'check', k: 'invertWheel', label: 'Inverser le sens de la molette' }
  ] },
  { id: 'touch', label: '👆 Tactile', items: [
    { t: 'select', p: 'touch', k: 'mode', label: 'Contrôles tactiles', opts: [['auto', 'Automatique (selon l’appareil)'], ['on', 'Toujours affichés'], ['off', 'Masqués']] },
    { t: 'range', p: 'touch', k: 'joySize', label: 'Taille du joystick', min: 0.6, max: 1.8, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
    { t: 'range', p: 'touch', k: 'btnSize', label: 'Taille des boutons', min: 0.6, max: 1.8, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
    { t: 'range', p: 'touch', k: 'opacity', label: 'Opacité des boutons', min: 0.25, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
    { t: 'range', p: 'touch', k: 'deadzone', label: 'Zone morte du joystick', min: 0, max: 0.4, step: 0.02, fmt: (v) => Math.round(v * 100) + ' %' },
    { t: 'range', p: 'touch', k: 'look', label: 'Sensibilité de la caméra (glisser)', min: 0.3, max: 2.5, step: 0.1, fmt: (v) => Math.round(v * 100) + ' %' },
    { t: 'range', p: 'touch', k: 'pinch', label: 'Sensibilité du zoom (pincement)', min: 0.3, max: 2.5, step: 0.1, fmt: (v) => Math.round(v * 100) + ' %' },
    { t: 'check', p: 'touch', k: 'leftHand', label: 'Mode gaucher (joystick à droite, boutons à gauche)' },
    { t: 'check', p: 'touch', k: 'vibrate', label: 'Vibration au toucher' },
    { t: 'custom', id: 'touchlayout' }
  ] },
  { id: 'ui', label: '🧭 Interface & jeu', items: [
    { t: 'check', k: 'showQuests', label: 'Afficher le journal de quêtes' },
    { t: 'check', k: 'showMinimap', label: 'Afficher la mini-carte' },
    { t: 'check', k: 'showHints', label: 'Afficher les indications « E — … »' },
    { t: 'check', k: 'notifInfo', label: 'Notifications d’information (butin, équipement…)' },
    { t: 'check', k: 'autoTarget', label: 'Ciblage automatique des ennemis' },
    { t: 'select', k: 'autosave', label: 'Sauvegarde automatique', opts: [[30, 'Toutes les 30 s'], [60, 'Toutes les minutes'], [180, 'Toutes les 3 minutes'], [0, 'Désactivée (manuelle)']] },
    { t: 'custom', id: 'tutorial' },
    { t: 'custom', id: 'resetall' }
  ] }
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class SettingsUI {
  constructor(hud, game) {
    this.hud = hud; this.game = game;
    this.root = hud.q('#settings-menu');
    this.tab = 'gfx';
    this._listen = null;
    this._onKey = (e) => this._captureKey(e);
  }

  get s() { return this.game.settings; }
  get(item) { return item.p ? this.s[item.p][item.k] : this.s[item.k]; }
  set(item, v) {
    if (item.p) this.s[item.p][item.k] = v; else this.s[item.k] = v;
    this.game.applySettings(item.k, item.p);
  }

  open(tab) {
    if (tab) this.tab = tab;
    this.render();
  }

  render() {
    const g = this.game;
    this.root.innerHTML = `
      <h2>Options</h2>
      <div class="st-tabs">${TABS.map((t) => `<button class="st-tab${t.id === this.tab ? ' on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <div class="st-body" id="st-body"></div>
      <button data-act="settings-back">Retour</button>`;
    this.root.querySelectorAll('.st-tab').forEach((b) => { b.onclick = () => { this._stopListen(); this.tab = b.dataset.tab; this.render(); }; });
    const body = this.root.querySelector('#st-body');
    const tab = TABS.find((t) => t.id === this.tab);
    for (const it of tab.items) body.appendChild(this._row(it));
    void g;
    if (this.tab === 'gfx') this.game._renderDebugStats && this.game._renderDebugStats();
  }

  _row(it) {
    const row = document.createElement('div');
    row.className = 'st-row';
    if (it.t === 'section') { row.className = 'st-section'; row.textContent = it.label; return row; }
    if (it.t === 'note') { row.className = 'st-note'; row.textContent = it.text; return row; }
    if (it.t === 'custom') return this['_c_' + it.id]();
    const val = this.get(it);
    const lab = document.createElement('label'); lab.textContent = it.label; row.appendChild(lab);
    if (it.t === 'check') {
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!val;
      c.onchange = () => this.set(it, c.checked);
      row.appendChild(c);
    } else if (it.t === 'select') {
      const sel = document.createElement('select');
      for (const [v, l] of it.opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); }
      sel.value = String(val);
      sel.onchange = () => { const raw = sel.value; const num = Number(raw); this.set(it, Number.isFinite(num) && raw.trim() !== '' && it.opts.some(([v]) => typeof v === 'number') ? num : raw); };
      row.appendChild(sel);
    } else if (it.t === 'range') {
      const wrap = document.createElement('div'); wrap.className = 'st-range';
      const r = document.createElement('input'); r.type = 'range'; r.min = it.min; r.max = it.max; r.step = it.step; r.value = val;
      const out = document.createElement('span'); out.textContent = it.fmt(+val);
      r.oninput = () => { const v = +r.value; out.textContent = it.fmt(v); this.set(it, v); };
      if (it.test) r.onchange = () => this.game.audio.play(it.test);
      wrap.appendChild(r); wrap.appendChild(out); row.appendChild(wrap);
    }
    if (it.hint) { const h = document.createElement('small'); h.className = 'st-hint'; h.textContent = it.hint; row.appendChild(h); }
    return row;
  }

  // ---- diagnostic ----
  _c_debug() {
    const d = document.createElement('div'); d.id = 'debug-stats'; d.className = 'cc-row mono';
    return d;
  }

  // ---- touches ----
  _c_keys() {
    const box = document.createElement('div'); box.className = 'st-keys';
    const keys = this.s.keys;
    for (const group of GROUPS) {
      const h = document.createElement('div'); h.className = 'st-section'; h.textContent = group; box.appendChild(h);
      for (const a of ACTIONS.filter((x) => x.group === group)) {
        const row = document.createElement('div'); row.className = 'st-keyrow';
        const l = document.createElement('span'); l.textContent = a.label; row.appendChild(l);
        for (const slot of [0, 1]) {
          const b = document.createElement('button'); b.className = 'st-keybtn'; b.dataset.a = a.id; b.dataset.s = slot;
          b.textContent = keyLabel(keys[a.id][slot]);
          b.onclick = () => this._startListen(a.id, slot, b);
          row.appendChild(b);
        }
        box.appendChild(row);
      }
    }
    const foot = document.createElement('div'); foot.className = 'st-foot';
    foot.innerHTML = '<small>Touchez une case puis appuyez sur la touche voulue. Échap annule, Retour arrière efface. Une touche déjà utilisée est reprise à l’autre action.</small>';
    const reset = document.createElement('button'); reset.className = 'st-btn'; reset.textContent = 'Rétablir les touches par défaut';
    reset.onclick = () => { this._stopListen(); this.s.keys = defaultKeys(); this.game.applySettings('keys'); this.render(); };
    foot.appendChild(reset);
    box.appendChild(foot);
    return box;
  }

  _startListen(actionId, slot, btn) {
    this._stopListen();
    this._listen = { actionId, slot, btn };
    this.game.input.listening = true;
    btn.classList.add('listening'); btn.textContent = 'Appuyez…';
    window.addEventListener('keydown', this._onKey, true);
  }
  _stopListen() {
    if (!this._listen) return;
    window.removeEventListener('keydown', this._onKey, true);
    this.game.input.listening = false;
    this._listen = null;
  }
  _captureKey(e) {
    if (!this._listen) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const { actionId, slot } = this._listen;
    const keys = this.s.keys;
    if (e.code === 'Escape') { this._stopListen(); this._refreshKeys(); return; }
    if (e.code === 'Backspace' || e.code === 'Delete') keys[actionId][slot] = null;
    else if (RESERVED.has(e.code)) { this.hud.notify(`${keyLabel(e.code)} est réservée au jeu.`, 'boss'); return; }
    else {
      for (const a of ACTIONS) for (const i of [0, 1]) {
        if (keys[a.id][i] === e.code && !(a.id === actionId && i === slot)) {
          keys[a.id][i] = null;
          if (a.id !== actionId) this.hud.notify(`${keyLabel(e.code)} était utilisée pour « ${a.label} » : réaffectée.`, 'info');
        }
      }
      keys[actionId][slot] = e.code;
    }
    this._stopListen();
    this.game.applySettings('keys');
    this._refreshKeys();
  }
  _refreshKeys() {
    this.root.querySelectorAll('.st-keybtn').forEach((b) => { b.classList.remove('listening'); b.textContent = keyLabel(this.s.keys[b.dataset.a][+b.dataset.s]); });
  }

  // ---- disposition tactile ----
  _c_touchlayout() {
    const box = document.createElement('div'); box.className = 'st-foot';
    const inGame = !!this.game.player;
    const edit = document.createElement('button'); edit.className = 'st-btn'; edit.textContent = '✋ Modifier la disposition des boutons';
    edit.disabled = !inGame;
    edit.onclick = () => this.game.startTouchEdit();
    const reset = document.createElement('button'); reset.className = 'st-btn'; reset.textContent = 'Rétablir la disposition';
    reset.onclick = () => { this.s.touch.layout = {}; this.s.touch.layoutP = {}; this.game.applySettings('layout', 'touch'); this.hud.notify('Disposition rétablie.', 'info'); };
    box.append(edit, reset);
    const n = document.createElement('small');
    n.textContent = inGame ? 'Fait glisser chaque bouton (joystick, attaque, roulade, potions…) à l’endroit voulu.' : 'La modification de la disposition est disponible en jeu (menu pause → Paramètres).';
    box.appendChild(n);
    return box;
  }

  _c_tutorial() {
    const box = document.createElement('div'); box.className = 'st-foot';
    const b = document.createElement('button'); b.className = 'st-btn'; b.textContent = '🎓 Revoir le tutoriel';
    b.disabled = !this.game.player;
    b.onclick = () => this.game.restartTutorial();
    box.appendChild(b);
    if (!this.game.player) { const n = document.createElement('small'); n.textContent = 'Disponible en jeu.'; box.appendChild(n); }
    return box;
  }

  _c_resetall() {
    const box = document.createElement('div'); box.className = 'st-foot';
    const b = document.createElement('button'); b.className = 'st-btn danger'; b.textContent = 'Tout réinitialiser (graphismes, son, commandes)';
    b.onclick = () => { if (typeof confirm !== 'function' || confirm('Rétablir tous les réglages par défaut ?')) { this.game.resetSettings(); this.render(); } };
    box.appendChild(b);
    return box;
  }
}
void ACTION_BY_ID; void esc;
