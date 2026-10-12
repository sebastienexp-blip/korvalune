// V10.35 — Commandes à la souris (caméra aérienne, PC) :
//  • clic gauche (maintenu) : se déplacer vers le curseur ; sur un monstre : le poursuivre et l'attaquer ;
//    sur un PNJ / butin / portail / coffre : y aller et interagir. Maj + clic gauche : attaquer sur place.
//  • clic droit (maintenu) : lance la compétence liée au clic droit vers le curseur ; sur un PNJ/objet : y aller et interagir.
//  • le clavier (ZQSD, 1-0, E…) reste utilisable à tout moment ; bouger au clavier annule le déplacement à la souris.
import * as THREE from 'three';
import { SKILLS } from '../combat/Classes.js';
import { weaponFamily } from '../combat/WeaponRules.js';

const ARRIVE = 0.7;
const PICK_ENEMY = 1.25;
const PICK_OBJ = 2.0;

export class ClickControl {
  constructor(game) {
    this.g = game;
    this.dest = null;        // {x,z}
    this.engage = null;      // monstre ciblé
    this.obj = null;         // {x,z} d'un objet avec lequel interagir
    this.holdL = false; this.holdR = false;
    this.lock = false;       // clic gauche posé sur un monstre : on garde l'attaque tant que le bouton est tenu
    this._ray = new THREE.Raycaster(); this._v = new THREE.Vector2(); this._p = new THREE.Vector3();
    this._stuckT = 0; this._lastX = 0; this._lastZ = 0;
    this._ringT = 0;
    const inp = game.input;
    inp.onMouse = (btn, down, e) => this._onMouse(btn, down, e);
  }

  get enabled() {
    const g = this.g;
    return g.settings.pcMouse !== false && !g.input.isTouch && !!g.cameraRig?.isIso && !!g.player && !g.player.dead;
  }

  _onMouse(btn, down, e) {
    if (btn !== 0 && btn !== 2) return;
    if (btn === 0) this.holdL = down; else this.holdR = down;
    if (!down) { if (btn === 0) this.lock = false; return; }
    if (!this.enabled || this.g.dialogueOpen || this.g.modalOpen || this.g.paused) return;
    if (btn === 0) this._press(false); else this._press(true);
  }

  _cursor() { const m = this.g.input.mouse; return { x: m.x ?? innerWidth / 2, y: m.y ?? innerHeight / 2 }; }

  _ground() {
    const g = this.g, c = this._cursor();
    this._v.set((c.x / innerWidth) * 2 - 1, -(c.y / innerHeight) * 2 + 1);
    this._ray.setFromCamera(this._v, g.camera);
    const o = this._ray.ray.origin, d = this._ray.ray.direction;
    if (d.y > -0.05) return null;
    let y = g.player.pos.y;
    for (let i = 0; i < 3; i++) {
      const t = (y - o.y) / d.y;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      y = g.world.heightAt(x, z);
      if (i === 2) return { x, z, y };
    }
    return null;
  }

  _enemyAtCursor() {
    const g = this.g;
    this._ray.ray; const c = this._cursor();
    this._v.set((c.x / innerWidth) * 2 - 1, -(c.y / innerHeight) * 2 + 1);
    this._ray.setFromCamera(this._v, g.camera);
    let best = null, bd = Infinity;
    const list = [...g.enemies.filter((e) => e.alive), ...g.bosses.filter((b) => b.alive && b.state !== 'dormant')];
    for (const e of list) {
      this._p.set(e.pos.x, e.pos.y + 1, e.pos.z);
      const d = this._ray.ray.distanceToPoint(this._p);
      if (d < PICK_ENEMY && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  _remoteAtCursor() {
    const g = this.g;
    for (const rp of g.remotePlayers.values()) {
      this._p.set(rp.pos.x, rp.pos.y + 1, rp.pos.z);
      if (this._ray.ray.distanceToPoint(this._p) < 1.1) return rp;
    }
    return null;
  }

  // objet interactif proche d'un point du sol
  _objectNear(P) {
    const g = this.g, near = (pos, r = PICK_OBJ) => pos && Math.hypot(pos.x - P.x, pos.z - P.z) < r;
    for (const ld of g.lootDrops) if (near(ld.pos, 1.6)) return ld.pos;
    for (const n of g.npcs) if (near(n.pos, 2.2)) return n.pos;
    for (const p of g.portals || []) if (near(p.pos, 2.6)) return p.pos;
    if (g.tp) { for (const f of g.tp.fields) if (near({ x: f.x, z: f.z }, 2.6)) return { x: f.x, z: f.z }; if (g.tp.town && near(g.tp.town.pos, 2.6)) return g.tp.town.pos; }
    const bp = g.world.town?.bankPos; if (near(bp, 2.4)) return bp;
    const wc = g.worldChests?.nearest(new THREE.Vector3(P.x, 0, P.z), 2.2); if (wc) return { x: wc.x, z: wc.z };
    if (!g.rift?.active && g.riftStatue && near(g.riftStatue.pos, 3.2)) return g.riftStatue.pos;
    return null;
  }

  _press(right) {
    const g = this.g;
    const e = this._enemyAtCursor();
    if (this._remoteAtCursor() && !right) return; // le clic gauche sur un joueur ouvre son menu (Game)
    const P = this._ground();
    if (right) {
      const o = P && !e ? this._objectNear(P) : null;
      if (o) { this._goInteract(o); return; }
      if (e) { g.player.target = e; g._manualTargetT = performance.now(); }
      return; // le lancer se fait dans update() (répété tant que le bouton est maintenu)
    }
    const stand = g.input.keys.has('ShiftLeft') || g.input.keys.has('ShiftRight');
    if (e) { this.engage = e; this.dest = null; this.obj = null; this.lock = true; g.player.target = e; g._manualTargetT = performance.now(); return; }
    if (!P) return;
    const o = this._objectNear(P);
    if (o) { this._goInteract(o); return; }
    if (stand) return;
    this._setDest(P);
  }

  _goInteract(pos) { this.obj = { x: pos.x, z: pos.z }; this.dest = null; this.engage = null; }

  _setDest(P) {
    this.dest = { x: P.x, z: P.z }; this.engage = null; this.obj = null;
    const g = this.g;
    if (g.fx?.enabled && performance.now() - this._ringT > 140) { this._ringT = performance.now(); try { g.fx.ring(P.x, P.y + 0.05, P.z, 0xffe9a0, 0.9, 0.35); } catch { /* décor facultatif */ } }
  }

  clear() { this.dest = null; this.engage = null; this.obj = null; this.g.input.clickMv = null; }

  _kbMove() {
    const i = this.g.input;
    return i.down('forward') || i.down('back') || i.down('left') || i.down('right') || i.touch.move.active;
  }

  // appelé chaque image avant player.update()
  update(dt, blocked) {
    const g = this.g, inp = g.input, p = g.player;
    inp.opts.diablo = this.enabled;
    inp.clickMv = null;
    if (!this.enabled || blocked || g.paused) { if (blocked) this.clear(); return; }
    if (this._kbMove()) { this.dest = null; this.engage = null; this.obj = null; }
    const stand = inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight');
    const cur = this._ground();

    // bouton gauche maintenu : suit le curseur (sauf si on a verrouillé un monstre)
    if (this.holdL && !this._kbMove()) {
      if (!this.lock) {
        const e = this._enemyAtCursor();
        if (e) { this.engage = e; this.dest = null; this.obj = null; this.lock = true; p.target = e; g._manualTargetT = performance.now(); }
        else if (cur && !stand && !this.obj) this._setDest(cur);
      }
      if (stand && cur) { // attaque sur place vers le curseur
        const e = this.lock ? this.engage : null;
        const ang = e ? Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z) : Math.atan2(cur.x - p.pos.x, cur.z - p.pos.z);
        p.yaw = ang; this._basic(e);
      }
    }
    if (this.engage && (!this.engage.alive || this.engage.state === 'dormant')) this.engage = null;

    // bouton droit maintenu : compétence de l'emplacement « clic droit »
    if (this.holdR && cur && !this.obj) {
      const id = p.mouseSlots?.r;
      if (!id) {
        if (performance.now() - (this._hintT || 0) > 4000) { this._hintT = performance.now(); g.hud.notify('Aucune compétence sur le clic droit : ouvre l’écran Compétences (K) et touche « D » sur une compétence.', 'info'); }
      } else {
        const e = this._enemyAtCursor();
        if (e) { p.target = e; g._manualTargetT = performance.now(); }
        if (!p.busyUntil || p.busyUntil <= performance.now() / 1000) p.yaw = Math.atan2((e ? e.pos.x : cur.x) - p.pos.x, (e ? e.pos.z : cur.z) - p.pos.z);
        g._useSkill(id);
      }
    }

    // poursuite d'un monstre
    if (this.engage) {
      const e = this.engage, dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, dist = Math.hypot(dx, dz);
      const range = this._basicRange();
      if (dist > range * 0.8) this._steer(e.pos.x, e.pos.z, dt);
      else { p.yaw = Math.atan2(dx, dz); p.target = e; this._basic(e); if (!this.holdL) { /* un clic : on enchaîne les coups jusqu'à la mort */ } }
      return;
    }
    // aller vers un objet puis interagir
    if (this.obj) {
      const d = Math.hypot(this.obj.x - p.pos.x, this.obj.z - p.pos.z);
      if (d > 2.1) this._steer(this.obj.x, this.obj.z, dt);
      else { const o = this.obj; this.obj = null; g._tryInteract(); void o; }
      return;
    }
    if (this.dest) this._steer(this.dest.x, this.dest.z, dt, true);
  }

  // compétence du clic gauche (par défaut la frappe de base)
  _leftId() { return this.g.player.mouseSlots?.l || 'strike'; }

  _basicRange() {
    const p = this.g.player, id = this._leftId(), fam = weaponFamily(p._equipRef);
    if (id === 'strike') return fam === 'bow' || fam === 'crossbow' ? 16 : (SKILLS.strike?.range || 3.4);
    return Math.max(2.5, SKILLS[id]?.range || 3.4);
  }

  _basic() {
    const p = this.g.player, id = this._leftId();
    // compétence en recharge : on retombe sur la frappe de base pour ne jamais rester inactif
    if (id !== 'strike' && (p.cooldowns[id] || 0) > 0) { p.tryUseSkill('strike'); return; }
    p.tryUseSkill(id);
  }

  _steer(x, z, dt, isDest = false) {
    const g = this.g, p = g.player, inp = g.input;
    const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < ARRIVE) { if (isDest) this.dest = null; return; }
    // blocage : aucune progression pendant 0,6 s → on abandonne
    this._stuckT += dt;
    if (this._stuckT > 0.6) {
      if (Math.hypot(p.pos.x - this._lastX, p.pos.z - this._lastZ) < 0.25) { this.dest = null; this.obj = null; if (!this.holdL) this.engage = null; this._stuckT = 0; return; }
      this._lastX = p.pos.x; this._lastZ = p.pos.z; this._stuckT = 0;
    }
    const a = Math.atan2(dx, dz) - g.cameraRig.yaw;
    inp.clickMv = { x: Math.sin(a), y: Math.cos(a) };
  }
}
