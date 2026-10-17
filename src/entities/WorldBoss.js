import * as THREE from 'three';
import { Boss } from './Boss.js';
import { animateCreature } from './CreatureModel.js';
import { tickStatus } from '../combat/Status.js';
import { share } from '../network/NetShare.js';

// V10.92 — BOSS MONDIAL : colosse de région. Visible et immobile tant que personne ne l'approche, il se réveille quand un joueur
// s'avance à moins de AGGRO m (ou le frappe de loin), puis enchaîne des attaques au sol télégraphiées propres à sa région.
// Aucune invocation : tout passe par les zones de danger (réseau de groupe sûr : l'hôte simule, les invités les voient).
const AGGRO = 70, LEASH = 150;
const HP_MULT = 2.5;

export class WorldBoss extends Boss {
  constructor(scene, world, bus, pos, def, slot) {
    super(scene, world, bus, pos, { id: def.id, level: def.level, name: def.name, scale: def.height, species: def.species });
    this.def = def; this.slot = slot; this.isBoss = true; this.isWorldBoss = true;
    this.maxHp = Math.round(this.maxHp * HP_MULT); this.hp = this.maxHp;
    this.xp = Math.round(this.xp * 3); this.coins = Array.isArray(this.coins) ? this.coins.map((c) => Math.round(c * 3)) : [0, 0];
    this.bodyR = Math.min(6, def.height * 0.28);
    this.deathHideMs = 4500;
    this.state = 'phase1'; this.engaged = false; this.activated = true;
    this.rig.root.visible = true;
    this._cd = def.moves.map((m, i) => m.cd * (0.5 + 0.12 * i));
    this._cast = null; this._deadT = 0; this._leash = 0;
    this.speedBase = def.speed;
    this._dash = null;
  }

  activate() { this._engage(); }

  _engage() {
    if (this.engaged || !this.alive) return;
    this.engaged = true;
    this.bus.emit('bossStart', this);
    this.bus.emit('bossHp', this);
    this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 1, z: 0 }), color: this.def.color, count: 90, speed: 7, life: 1.2, up: 2 });
  }

  takeDamage(dmg, crit, player, dot = false) {
    if (!this.alive) return 0;
    if (!this.engaged && !this.netProxy) this._engage();
    return super.takeDamage(dmg, crit, player, dot);
  }

  _enterPhase(p) {
    this.phase = p;
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: this.def.height * 0.9, z: 0 }), text: p === 1 ? 'IL S’ENRAGE !' : 'FUREUR !', color: '#ff8a3a', big: true });
    this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: this.def.height * 0.4, z: 0 }), color: this.def.color, count: 110, speed: 9, life: 1.2 });
    this.bus.emit('bossEnrage', this);
    this._cd = this._cd.map((c) => Math.min(c, 2));
  }

  netSnap() { const a = super.netSnap(); if (this.alive) a[6] = this.engaged ? 1 : 0; return a; }

  netApply(a) {
    super.netApply(a);
    if (a[6] === 1 && !this.engaged) { this.engaged = true; this.bus.emit('bossStart', this); }
  }

  die() {
    if (!this.alive) return;
    super.die();   // butin n°1 + événements
    const lp = share.localPlayer || null;
    const near = share.role === 'solo' || !this.netKey || !lp?.pos || lp.pos.distanceTo(this.pos) < share.range;
    if (near) {
      this.bus.emit('loot', this);   // butin n°2 : récompense doublée
      if (lp && lp.gainXp) {
        if (this.xp > 0) lp.gainXp(Math.round(this.xp * (share.role !== 'solo' && this.netKey && share.xpMult ? share.xpMult() : 1)));
        const c = Math.round(this.coins[0] + Math.random() * (this.coins[1] - this.coins[0]));
        lp.addCoins(Math.round(c * (1 + (lp.goldBonus || 0))));
      }
    }
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: this.def.height * 0.8, z: 0 }), text: '☠ ' + this.name, color: '#ffe28a', big: true });
  }

  // ---------- attaques ----------
  _haz(x, z, r, delay, mul = 1, color = this.def.color) {
    const dmg = Math.max(1, Math.round(this.damage * 0.55 * mul * (1 + this.phase * 0.12)));
    this.bus.emit('hazard', { x, z, radius: r, delay, damage: dmg, color, fromBoss: true });
  }

  _doMove(m, player) {
    const px = player.pos.x, pz = player.pos.z, bx = this.pos.x, bz = this.pos.z;
    const dx = px - bx, dz = pz - bz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const r = m.r || 3.2;
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: this.def.height * 1.05, z: 0 }), text: '⚠ ' + (m.text || 'Écartez-vous !'), color: '#ffb04a', big: true });
    switch (m.t) {
      case 'slam': { const f = Math.min(d, this.def.reach); this._haz(bx + ux * f * 0.9, bz + uz * f * 0.9, m.r || 8, 1.25, 1.25); this._castAnim(1.4); break; }
      case 'sweep': {
        const n = 7;
        for (let i = 0; i < n; i++) { const a = Math.atan2(ux, uz) + (i - (n - 1) / 2) * 0.34; const rr = m.r || 10; this._haz(bx + Math.sin(a) * rr, bz + Math.cos(a) * rr, 3.6, 1.1 + Math.abs(i - 3) * 0.06); }
        this._castAnim(1.4); break;
      }
      case 'rain': { const n = m.n || 6; this._haz(px, pz, r, 1.3); for (let i = 1; i < n; i++) { const a = Math.random() * 6.283, rr = 3 + Math.random() * 9; this._haz(px + Math.cos(a) * rr, pz + Math.sin(a) * rr, r, 1.2 + i * 0.1); } this._castAnim(1.2); break; }
      case 'line': { const n = m.n || 8; for (let i = 1; i <= n; i++) this._haz(bx + ux * i * r * 1.6, bz + uz * i * r * 1.6, r, 0.9 + i * 0.1); this._castAnim(1.4); break; }
      case 'ring': { const n = m.n || 10, rr = m.d || 12; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; this._haz(bx + Math.cos(a) * rr, bz + Math.sin(a) * rr, r, 1.3); } this._haz(bx, bz, 5.5, 1.5, 1.1); this._castAnim(1.4); break; }
      case 'spiral': { const n = m.n || 14; for (let i = 0; i < n; i++) { const a = i * 0.7, rr = 5 + i * 1.6; this._haz(bx + Math.cos(a) * rr, bz + Math.sin(a) * rr, r, 0.9 + i * 0.1); } this._castAnim(1.4); break; }
      case 'nova': { for (let w = 0; w < 3; w++) { const rr = 7 + w * 7, n = 8 + w * 4; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + w * 0.3; this._haz(bx + Math.cos(a) * rr, bz + Math.sin(a) * rr, r, 1.2 + w * 0.55); } } this._castAnim(1.6); break; }
      case 'charge': {
        const len = m.len || 22;
        for (let i = 1; i <= len / (r * 1.5); i++) this._haz(bx + ux * i * r * 1.5, bz + uz * i * r * 1.5, r, 1.1 + i * 0.07);
        this._dash = { t: -1.1, ux, uz, left: len, speed: len / 0.9 };
        this._castAnim(1.1); break;
      }
    }
  }

  _castAnim(dur) { this.bus.emit('bossCast', this); this.action = 'attack'; this.actionT = 0; this.actionDur = dur; this._castT = dur; this._pendingHit = false; }

  update(dt, player) {
    if (this.netProxy) { this._proxyUpdate(dt); return; }
    if (this.state === 'dead') {
      this._deadT += dt;
      if (this._deadT < 6) animateCreature(this.rig, { speed: 0, action: null, actionT: 0, actionDur: 1, dead: true }, dt);
      return;
    }
    const S = tickStatus(this, dt, player);
    if (!this.alive) return;
    const toP = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toP.length();
    const dHome = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    let speed = 0;
    const eff = Math.max(0, dist - this.bodyR);

    if (!this.engaged) {
      if (dist < AGGRO && !player.dead) this._engage();
    } else {
      // abandon : trop loin du point d'origine ou joueur parti → il rentre et se soigne
      if (dHome > LEASH || (dist > 200 && !this._leashing)) { this._leashing = true; }
      if (this._leashing) {
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, hd = Math.hypot(hx, hz);
        if (hd < 3) { this._leashing = false; this.engaged = false; this.hp = this.maxHp; this.phase = 0; this.bus.emit('bossHp', this); this.bus.emit('bossAbandon', this); }
        else { const sp = this.speedBase * 1.8; this.pos.x += hx / hd * sp * dt; this.pos.z += hz / hd * sp * dt; this.yaw = Math.atan2(hx, hz); speed = sp; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.05 * dt); }
      } else if (!S.stun) {
        // ruée en cours
        if (this._dash) {
          const D = this._dash; D.t += dt;
          if (D.t > 0 && D.left > 0) { const st = Math.min(D.left, D.speed * dt); this.pos.x += D.ux * st; this.pos.z += D.uz * st; D.left -= st; this.yaw = Math.atan2(D.ux, D.uz); speed = D.speed; }
          if (D.left <= 0) this._dash = null;
        } else if (this._castT > 0) {
          this._castT -= dt;
          this.yaw = Math.atan2(toP.x, toP.z);
        } else {
          // poursuite
          const reach = this.def.reach;
          if (eff > reach * 0.75) { const sp = this.speedBase * (1 + this.phase * 0.12) * S.slow; toP.normalize(); this.pos.x += toP.x * sp * dt; this.pos.z += toP.z * sp * dt; speed = sp; }
          if (dist > 0.1) { const ty = Math.atan2(toP.x, toP.z); let dy = ty - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 5); }
          // coup au corps à corps
          this.attackCd = Math.max(0, this.attackCd - dt);
          if (eff <= reach && this.attackCd <= 0 && !this.action) {
            this.attackCd = 3.2 - this.phase * 0.5;
            this.action = 'attack'; this.actionT = 0; this.actionDur = 1.4; this._pendingHit = true; this.bus.emit('enemyAttack', this);
          }
          // attaques spéciales
          for (let i = 0; i < this._cd.length; i++) {
            this._cd[i] -= dt;
            const m = this.def.moves[i];
            if (this._cd[i] <= 0 && (m.from || 0) <= this.phase && dist < 70 && !this.action) {
              this._cd[i] = m.cd * (1 - 0.14 * this.phase) * (0.85 + Math.random() * 0.3);
              this._doMove(m, player);
              break;
            }
          }
        }
      }
    }

    this.speed = speed;
    this.world.pushOut(this.pos, this.bodyR * 0.55);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    if (this.action === 'attack') {
      this.actionT += dt;
      if (this._pendingHit && this.actionT > this.actionDur * 0.38) {
        this._pendingHit = false;
        if (Math.max(0, this.pos.distanceTo(player.pos) - this.bodyR) <= this.def.reach + 1.5) {
          player.takeDamage(Math.round(this.damage * (0.8 + this.phase * 0.15)));
          this.bus.emit('particles', { pos: player.pos.clone(), color: this.def.color, count: 30, speed: 6, life: 0.6 });
        }
      }
      if (this.actionT >= this.actionDur) this.action = null;
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    animateCreature(this.rig, { speed: this.speed, action: this.action, actionT: this.actionT, actionDur: this.actionDur, dead: false }, dt);
  }
}
