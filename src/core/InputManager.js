import { normalizeKeys, ACTIONS } from './Keybinds.js';

// Entrées clavier/souris/tactile unifiées. Un seul point de vérité pour tout le jeu.
// V4.2 : touches reconfigurables (setKeys), réglages souris/tactile (opts), actions « virtuelles » (boutons tactiles).
export class InputManager {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.mouse = { dx: 0, dy: 0, down: false, right: false, middle: false, wheel: 0 };
    this.opts = { lookSens: 1, invertY: false, invertWheel: false, zoomSpeed: 1, rotateBtn: 'right', touchLook: 1, pinch: 1, vibrate: true, deadzone: 0.08 };
    this.virtual = new Set(); // actions maintenues par des boutons tactiles (sprint, accroupi…)
    this.keyCodes = {}; this.codeAction = {};
    this.listening = false;   // vrai pendant qu'une touche est en cours de réassignation (menu Paramètres)
    this.setKeys(normalizeKeys(null));
    this.touch = { move: { x: 0, y: 0, active: false }, look: { dx: 0, dy: 0, active: false }, pinch: 0 };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.pointerLock = false; // activé seulement avec la caméra libre (la vue aérienne garde le curseur)
    this.actions = new Set(); // actions ponctuelles consommées ce frame (jump, attack tap...)
    this._bind();
  }

  // keys = { actionId: [code1, code2] }
  setKeys(keys) {
    this.keyCodes = keys; this.codeAction = {};
    for (const a of ACTIONS) for (const c of keys[a.id] || []) if (c) this.codeAction[c] = a.id;
  }
  actionOf(code) { return this.codeAction[code] || null; }
  // l'action est-elle maintenue (clavier ou bouton tactile) ?
  down(action) {
    if (this.virtual.has(action)) return true;
    const cs = this.keyCodes[action];
    return !!cs && ((!!cs[0] && this.keys.has(cs[0])) || (!!cs[1] && this.keys.has(cs[1])));
  }
  buzz(ms = 12) { if (this.opts.vibrate && this.isTouch) try { navigator.vibrate?.(ms); } catch (e) { /* ignoré */ } }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || this.listening) return;
      this.keys.add(e.code);
      const act = this.codeAction[e.code];
      if (act === 'zoomIn') this.mouse.wheel -= 160;
      if (act === 'zoomOut') this.mouse.wheel += 160;
      if (act && (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = this.mouse.right = this.mouse.middle = false; });

    this.dom.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.mouse.right = true; if (e.button === 1) { this.mouse.middle = true; e.preventDefault(); } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; if (e.button === 1) this.mouse.middle = false; });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    this.dom.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.dom || (this.opts.rotateBtn === 'middle' ? this.mouse.middle : this.mouse.right)) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    this.dom.addEventListener('click', () => { if (!this.isTouch && this.pointerLock) this.dom.requestPointerLock?.(); });
    this.dom.addEventListener('wheel', (e) => { this.mouse.wheel += e.deltaY * this.opts.zoomSpeed * (this.opts.invertWheel ? -1 : 1); e.preventDefault(); }, { passive: false });

    // Le canvas ne gère plus que le regard (caméra) au tactile : le joystick
    // de déplacement est un widget séparé (voir TouchControls.js) qui pilote
    // directement this.touch.move via setMoveTouch() ci-dessous — les deux
    // zones ne se recouvrent jamais puisque ce sont des éléments DOM distincts.
    this._touchLookId = null; this._touches = new Map(); this._pinchD = 0;
    this.dom.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.dom.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.dom.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    this.dom.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  }

  _onTouchStart(e) {
    for (const t of e.changedTouches) {
      this._touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (this._touchLookId === null) {
        this._touchLookId = t.identifier;
        this.touch.look = { x: t.clientX, y: t.clientY, active: true, dx: 0, dy: 0 };
      }
    }
    if (this._touches.size >= 2) { this._pinchD = this._pinchDist(); this.touch.look.dx = this.touch.look.dy = 0; }
    if (e.cancelable) e.preventDefault();
  }
  _pinchDist() {
    const [a, b] = [...this._touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  _onTouchMove(e) {
    for (const t of e.changedTouches) {
      const tr = this._touches.get(t.identifier);
      if (tr) { tr.x = t.clientX; tr.y = t.clientY; }
      if (t.identifier === this._touchLookId) {
        const l = this.touch.look;
        if (this._touches.size < 2) { l.dx += t.clientX - l.x; l.dy += t.clientY - l.y; }
        l.x = t.clientX; l.y = t.clientY;
      }
    }
    // pincement à deux doigts : zoom / dézoom de la caméra
    if (this._touches.size >= 2) {
      const d = this._pinchDist();
      if (this._pinchD > 0) this.mouse.wheel -= (d - this._pinchD) * 4.5 * this.opts.pinch;
      this._pinchD = d;
    }
    if (e.cancelable) e.preventDefault();
  }
  _onTouchEnd(e) {
    for (const t of e.changedTouches) {
      this._touches.delete(t.identifier);
      if (t.identifier === this._touchLookId) {
        this._touchLookId = null; this.touch.look.active = false;
        // un doigt restant reprend le regard
        const rest = this._touches.entries().next().value;
        if (rest) { this._touchLookId = rest[0]; this.touch.look = { x: rest[1].x, y: rest[1].y, active: true, dx: 0, dy: 0 }; }
      }
    }
    this._pinchD = 0;
  }

  // Appelé par TouchControls (joystick de déplacement) : pilote directement
  // l'état de mouvement tactile, séparément du regard géré ci-dessus.
  setMoveTouch(active, x, y, ox, oy) {
    if (active) this.touch.move = { x, y, ox: ox ?? this.touch.move.ox ?? x, oy: oy ?? this.touch.move.oy ?? y, active: true };
    else this.touch.move.active = false;
  }

  // Vecteur de déplacement normalisé [-1..1] à partir du clavier OU du joystick tactile
  moveVector() {
    let x = 0, y = 0;
    if (this.down('right')) x += 1;
    if (this.down('left')) x -= 1;
    if (this.down('forward')) y += 1;
    if (this.down('back')) y -= 1;
    if (this.touch.move.active) {
      const dx = this.touch.move.x - this.touch.move.ox, dy = this.touch.move.y - this.touch.move.oy;
      let r = Math.min(1, Math.hypot(dx, dy) / (45 * (this.opts.joyScale || 1)));
      r = r < this.opts.deadzone ? 0 : (r - this.opts.deadzone) / (1 - this.opts.deadzone);
      const a = Math.atan2(dy, dx);
      x = -Math.cos(a) * r; y = -Math.sin(a) * r;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  lookDelta() {
    let dx = this.mouse.dx, dy = this.mouse.dy;
    dx *= this.opts.lookSens; dy *= this.opts.lookSens;
    if (this.touch.look.active || this.touch.look.dx || this.touch.look.dy) { dx += this.touch.look.dx * 1.6 * this.opts.touchLook; dy += this.touch.look.dy * 1.6 * this.opts.touchLook; }
    if (this.opts.invertY) dy = -dy;
    this.mouse.dx = 0; this.mouse.dy = 0;
    this.touch.look.dx = 0; this.touch.look.dy = 0;
    return { dx, dy };
  }

  consumeWheel() { const w = this.mouse.wheel; this.mouse.wheel = 0; return w; }
  action(name) { if (this.actions.has(name)) { this.actions.delete(name); return true; } return false; }
  trigger(name) { this.actions.add(name); }
  held(code) { return this.keys.has(code); }
}
