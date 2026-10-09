// Traduit les gestes tactiles en actions comprises par InputManager, et affiche
// le joystick virtuel. V4.2 : taille / opacité / main gauche réglables et disposition personnalisable
// (mode « modifier la disposition » : on fait glisser chaque bouton où l'on veut).
const ELS = {
  joy: '#touch-joystick', run: '#t-run', roll: '#t-jump', crouch: '#t-crouch', interact: '#t-interact',
  attack: '#t-attack', lock: '#t-lock', heal: '#pq-heal', mana: '#pq-mana'
};
export const TOUCH_LABELS = { joy: 'Joystick', run: 'Sprint', roll: 'Roulade', crouch: 'Accroupi', interact: 'Interagir', attack: 'Attaque', lock: 'Caméra', heal: 'Potion de vie', mana: 'Potion de mana' };

export class TouchControls {
  constructor(root, input, bus) {
    this.root = root; this.input = input; this.bus = bus;
    this.wrap = root.querySelector('#touch-controls');
    this.float = root.querySelector('#float-layer');
    this.joyBase = root.querySelector('#touch-joystick');
    this.stick = root.querySelector('#touch-stick');
    this.el = {}; this.home = {};
    for (const [id, sel] of Object.entries(ELS)) {
      const e = root.querySelector(sel);
      if (!e) continue;
      this.el[id] = e; this.home[id] = { parent: e.parentElement, next: e.nextSibling };
      if (id !== 'joy') e.dataset.tid = id;
    }
    this.joyScale = 1; this.editing = false; this.layoutL = {}; this.layoutP = {}; this.portrait = innerHeight > innerWidth * 1.02;
    this.mode = 'auto';
    this._bindStick();
    this._bindButtons(root);
    this._bindEdit();
    window.addEventListener('resize', () => this.refreshEnabled());
  }

  // --- affichage ---
  get enabled() { return this._on; }
  refreshEnabled() {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const on = this.mode === 'on' || this.editing || (this.mode === 'auto' && this.input.isTouch && (coarse || innerWidth < 900));
    this._on = on;
    this.root.classList.toggle('touch-on', on);
  }

  // t = settings.touch
  apply(t) {
    this.mode = t.mode || 'auto';
    this.joyScale = t.joySize || 1;
    const o = this.input.opts;
    o.touchLook = t.look ?? 1; o.pinch = t.pinch ?? 1; o.vibrate = t.vibrate !== false; o.deadzone = t.deadzone ?? 0.08; o.joyScale = this.joyScale;
    const st = this.root.style;
    st.setProperty('--tb', String(t.btnSize || 1));
    st.setProperty('--joy', String(this.joyScale));
    st.setProperty('--tbo', String(t.opacity ?? 1));
    this.root.classList.toggle('lefthand', !!t.leftHand);
    this.layoutL = t.layout || {}; this.layoutP = t.layoutP || {};
    this.applyLayout();
    this.refreshEnabled();
  }

  // V10.22 : une disposition personnalisée par orientation (vertical / horizontal)
  get layout() { return this.portrait ? this.layoutP : this.layoutL; }
  set layout(v) { if (this.portrait) this.layoutP = v; else this.layoutL = v; }
  orientationChanged(portrait) { if (portrait === this.portrait) return; this.portrait = portrait; this.applyLayout(); }

  applyLayout() {
    for (const id of Object.keys(this.el)) {
      const e = this.el[id], pos = this.layout[id];
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        if (e.parentElement !== this.float) this.float.appendChild(e);
        e.classList.add('floating');
        if (id !== 'heal' && id !== 'mana') e.classList.add('touch-only');
        e.style.left = (pos.x * 100) + '%'; e.style.top = (pos.y * 100) + '%';
      } else {
        e.classList.remove('floating'); e.style.left = e.style.top = '';
        if (e.parentElement === this.float) {
          const h = this.home[id];
          if (h.next && h.next.parentElement === h.parent) h.parent.insertBefore(e, h.next); else h.parent.appendChild(e);
        }
      }
    }
  }

  // --- joystick ---
  _bindStick() {
    const base = this.joyBase;
    let id = null, cx = 0, cy = 0;
    const rect = () => base.getBoundingClientRect();
    base.addEventListener('touchstart', (e) => {
      if (this.editing) return;
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = rect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.input.setMoveTouch(true, t.clientX, t.clientY, cx, cy);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        const dx = t.clientX - cx, dy = t.clientY - cy, max = 42 * this.joyScale, d = Math.min(max, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        this.stick.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
        this.input.setMoveTouch(true, t.clientX, t.clientY, cx, cy);
      }
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) { id = null; this.stick.style.transform = 'translate(0,0)'; this.input.setMoveTouch(false); }
    });
    window.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) { id = null; this.stick.style.transform = 'translate(0,0)'; this.input.setMoveTouch(false); }
    });
  }

  _bindButtons(root) {
    const tap = (sel, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); if (this.editing) return; this.input.buzz(); fn(); }, { passive: false });
    };
    const toggle = (btnId, action) => {
      let on = false;
      tap(btnId, () => { on = !on; this.input.virtual[on ? 'add' : 'delete'](action); root.querySelector(btnId).classList.toggle('held', on); });
    };
    tap('#t-jump', () => this.input.trigger('roll'));
    // V10.24 : attaque de base maintenue = répétée (le délai de recharge règle le rythme) ; marche et sprint n'interrompent rien
    {
      const el = root.querySelector('#t-attack'); let rep = null, tid = null;
      const stop = () => { clearInterval(rep); rep = null; tid = null; el.classList.remove('held'); };
      if (el) {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); if (this.editing) return; this.input.buzz(); this.bus.emit('skillPressed', 'strike'); tid = e.changedTouches[0].identifier; el.classList.add('held'); clearInterval(rep); rep = setInterval(() => this.bus.emit('skillPressed', 'strike'), 110); }, { passive: false });
        const end = (e) => { for (const t of e.changedTouches) if (t.identifier === tid) stop(); };
        window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
      }
    }
    tap('#t-interact', () => this.bus.emit('interact'));
    toggle('#t-run', 'run');
    toggle('#t-crouch', 'crouch');
    tap('#t-lock', () => this.bus.emit('toggleCameraLock'));
  }

  // --- mode « modifier la disposition » ---
  startEdit() { this.editing = true; this.root.classList.add('touch-edit'); this.refreshEnabled(); }
  stopEdit() { this.editing = false; this.root.classList.remove('touch-edit'); this.refreshEnabled(); }
  resetLayout() { this.layout = {}; this.applyLayout(); this.onLayout && this.onLayout(this.layout, this.portrait); }

  _bindEdit() {
    for (const [id, e] of Object.entries(this.el)) {
      let drag = null;
      e.addEventListener('pointerdown', (ev) => {
        if (!this.editing) return;
        ev.preventDefault(); ev.stopPropagation();
        const r = e.getBoundingClientRect();
        // le 1ᵉʳ déplacement fait passer l'élément dans la couche flottante, à sa position actuelle
        if (!this.layout[id]) { this.layout[id] = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; this.applyLayout(); }
        drag = { dx: ev.clientX - (this.layout[id].x * innerWidth), dy: ev.clientY - (this.layout[id].y * innerHeight) };
        try { e.setPointerCapture(ev.pointerId); } catch (err) { /* ignoré */ }
        e.classList.add('dragging');
      });
      e.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        const x = Math.min(0.97, Math.max(0.03, (ev.clientX - drag.dx) / innerWidth));
        const y = Math.min(0.97, Math.max(0.05, (ev.clientY - drag.dy) / innerHeight));
        this.layout[id] = { x: +x.toFixed(4), y: +y.toFixed(4) };
        e.style.left = (x * 100) + '%'; e.style.top = (y * 100) + '%';
      });
      const end = () => { if (!drag) return; drag = null; e.classList.remove('dragging'); this.onLayout && this.onLayout(this.layout, this.portrait); };
      e.addEventListener('pointerup', end); e.addEventListener('pointercancel', end);
    }
  }
}
