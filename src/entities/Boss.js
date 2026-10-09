import * as THREE from 'three';
import { createCreature, animateCreature } from './CreatureModel.js';
import { scaledEnemyStats } from '../data/difficulty.js';
import { tickStatus, vulnMult } from '../combat/Status.js';
import { share } from '../network/NetShare.js';

// Boss à phases multiples. Les statistiques (PV/dégâts/défense/XP/or) sont
// calculées à partir du niveau via computeEnemyStats (espèce "boss" : très
// résistant et puissant par rapport à un ennemi normal du même niveau) —
// le même moteur que les ennemis normaux, ce qui permet de réutiliser cette
// classe pour n'importe quel boss majeur à n'importe quel niveau (le
// Gardien des Ruines en est un, mais aussi le boss final du Néant Primordial).
export class Boss {
  constructor(scene, world, bus, pos, opts = {}) {
    this.scene = scene; this.world = world; this.bus = bus;
    this.pos = pos.clone();
    this.home = pos.clone();
    this.id = opts.id || 'boss';
    this.level = Math.max(1, Math.round(opts.level || 14));
    const stats = scaledEnemyStats(this.level, 'boss');
    this.maxHp = stats.hp; this.hp = stats.hp;
    this.damage = stats.damage; this.defense = stats.defense;
    this.xp = stats.xp; this.coins = stats.coins;
    this.phase = 0;
    this.state = 'dormant';
    this.stateT = 0;
    this.attackCd = 0;
    this.name = opts.name || 'Le Gardien des Ruines';
    this.speed = 0;
    this.yaw = 0;
    this.alive = true;
    const scale = opts.scale || 2.6;
    this.rig = createCreature({ fur: opts.fur ?? 0x3a3f46, belly: opts.belly ?? 0x8f97a3, eye: opts.eye ?? 0xff3a3a, scale, bodyLen: 1.3, snout: 0.45, tusks: true, role: 'boss:' + (opts.id || 'boss'), species: 'bear', tint: opts.fur ?? null });
    this.rig.root.position.copy(this.pos);
    scene.add(this.rig.root);
    this.rig.root.visible = false;
    this.summons = [];
  }

  activate() {
    if (this.state !== 'dormant') return;
    this.state = 'phase1';
    this.stateT = 0;
    this.rig.root.visible = true;
    this.bus.emit('bossStart', this);
  }

  takeDamage(dmg, crit, player, dot = false) {
    if (!this.alive || this.state === 'dormant') return 0;
    const final = Math.max(1, Math.round(dmg * vulnMult(this) - this.defense * 0.5));
    if (this.netProxy) { // copie d'un boss simulé par l'hôte : on lui envoie les dégâts
      if (dot) return 0;
      if (share.sendDmg) share.sendDmg(this.netKey, dmg, crit);
      this.rig.hurtT = 1; this.hp = Math.max(1, this.hp - final);
      this.bus.emit('bossHp', this);
      this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.6, z: 0 }), text: crit ? `CRIT ${final}` : `${final}`, color: crit ? '#ffd23f' : '#ffffff', big: true });
      return final;
    }
    this.hp = Math.max(0, this.hp - final);
    if (!dot) this.rig.hurtT = 1;
    this.bus.emit('bossHp', this);
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.6, z: 0 }), text: crit ? `CRIT ${final}` : `${final}`, color: crit ? '#ffd23f' : '#ffffff', big: true });
    const ratio = this.hp / this.maxHp;
    if (ratio <= 0 && this.alive) this.die();
    else if (ratio < 0.66 && this.phase === 0) this._enterPhase(1);
    else if (ratio < 0.33 && this.phase === 1) this._enterPhase(2);
    return final;
  }

  _enterPhase(p) {
    this.phase = p;
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 3.4, z: 0 }), text: p === 1 ? 'INVOCATION !' : 'FUREUR !', color: '#ff8a3a', big: true });
    this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 1, z: 0 }), color: 0xff5a2a, count: 70, speed: 6, life: 1 });
    if (p === 1) this.bus.emit('bossSummon', this);
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    if (share.role === 'host' && this.netKey && share.onKill) share.onKill(this);
    const lp = share.localPlayer;
    const near = share.role === 'solo' || !this.netKey || this.id === 'spire_warden' || !lp?.pos || lp.pos.distanceTo(this.pos) < share.range;
    this.bus.emit('bossDefeated', this);
    if (near) {
      this.bus.emit('bossKilled', this.id);
      this.bus.emit('loot', this);
    }
    this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 1.2, z: 0 }), color: 0xffe28a, count: 120, speed: 8, life: 1.4, up: 3 });
  }

  // ---------- Monde de groupe (V6.0) ----------
  netSnap() {
    const r = (v, n) => Math.round(v * n) / n;
    return [this.netKey, r(this.pos.x, 100), r(this.pos.z, 100), r(this.yaw, 100), Math.round(this.hp), this.phase, this.state === 'dormant' ? 0 : this.state === 'dead' ? 2 : 1, this.action === 'attack' && this.actionT < 0.25 ? 1 : 0];
  }

  netApply(a) {
    this._nx = a[1]; this._nz = a[2]; this._nyaw = a[3];
    if (a[6] === 1 && this.state === 'dormant') { this.activate(); this.activated = true; }
    if (a[6] === 2 && this.alive) { this.hp = 0; this.die(); return; }
    if (a[6] === 0) return;
    if (this.alive) {
      if (Math.abs(this.hp - a[4]) > 0.5) { this.hp = a[4]; this.bus.emit('bossHp', this); }
      if (a[5] !== this.phase) {
        this.phase = a[5];
        this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 3.4, z: 0 }), text: this.phase === 1 ? 'INVOCATION !' : 'FUREUR !', color: '#ff8a3a', big: true });
        this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 1, z: 0 }), color: 0xff5a2a, count: 70, speed: 6, life: 1 });
      }
      if (a[7] && !this.action) { this.action = 'attack'; this.actionT = 0; this.actionDur = 0.6; }
    }
  }

  _proxyUpdate(dt) {
    if (this.state === 'dormant' || this.state === 'dead') return;
    if (this._nx !== undefined) {
      const k = 1 - Math.exp(-12 * dt), ox = this.pos.x, oz = this.pos.z;
      this.pos.x += (this._nx - ox) * k; this.pos.z += (this._nz - oz) * k;
      this.speed = Math.min(6, Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 0.001));
      if (this.speed < 0.2) this.speed = 0;
      let dy = this._nyaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 10);
    }
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    if (this.action === 'attack') { this.actionT += dt; if (this.actionT >= this.actionDur) this.action = null; }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    animateCreature(this.rig, { speed: this.speed, action: this.action, actionT: this.actionT, actionDur: this.actionDur, dead: false }, dt);
  }

  update(dt, player) {
    if (this.netProxy) { this._proxyUpdate(dt); return; }
    if (this.state === 'dormant' || this.state === 'dead') return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    const S = tickStatus(this, dt, player);
    if (!this.alive) return;
    if (S.stun) { // étourdi (brièvement : les boss résistent)
      this.speed = 0; this._pendingHit = false; this.action = null;
      animateCreature(this.rig, { speed: 0, action: null, actionT: 0, actionDur: this.actionDur, dead: false }, dt);
      return;
    }
    const toP = player.pos.clone().sub(this.pos); toP.y = 0;
    const dist = toP.length();
    // V4.6 : attaques au sol télégraphiées (à esquiver) — plus nombreuses à chaque phase
    if (dist < 45) {
      this._hazT = (this._hazT ?? 3) - dt;
      if (this._hazT <= 0) {
        this._hazT = [7, 5.5, 4.2][this.phase] || 4.2;
        const dmg = Math.max(1, Math.round(this.damage * 0.6));
        const n = [1, 3, 5][this.phase] || 5;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 2 + Math.random() * 5;
          this.bus.emit('hazard', { x: player.pos.x + Math.cos(a) * r, z: player.pos.z + Math.sin(a) * r, radius: 3.2, delay: 1.5 - this.phase * 0.12, damage: dmg, color: 0xff5a2a, fromBoss: true });
        }
        if (this.phase >= 2) this.bus.emit('hazard', { x: this.pos.x, z: this.pos.z, radius: 6.5, delay: 1.7, damage: Math.round(dmg * 1.2), color: 0xff2a2a, fromBoss: true });
        this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 3.6, z: 0 }), text: '⚠ Écartez-vous !', color: '#ffb04a' });
      }
    }
    const spd = (3.2 + this.phase * 0.8) * S.slow;
    if (dist > 3.4) {
      const dir = toP.normalize();
      this.pos.x += dir.x * spd * dt; this.pos.z += dir.z * spd * dt;
      this.yaw = Math.atan2(dir.x, dir.z);
      this.speed = spd;
    } else {
      this.speed = 0;
      if (this.attackCd <= 0) {
        this.attackCd = this.phase >= 2 ? 1.6 : 2.4;
        this.action = 'attack'; this.actionT = 0; this.actionDur = 0.6;
        this._pendingHit = true;
        if (this.phase >= 2 && Math.random() < 0.5) {
          this.bus.emit('particles', { pos: this.pos.clone(), color: 0xff3a3a, count: 40, speed: 5, life: 0.7 });
          if (dist < 6) player.takeDamage(Math.round(this.damage * 0.7));
        }
      }
    }
    this.world.pushOut(this.pos, 1.6);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    if (this.action === 'attack') {
      this.actionT += dt;
      if (this._pendingHit && this.actionT > this.actionDur * 0.4) {
        this._pendingHit = false;
        if (this.pos.distanceTo(player.pos) < 4) player.takeDamage(Math.round(this.damage * (0.75 + this.phase * 0.18)));
      }
      if (this.actionT >= this.actionDur) this.action = null;
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    animateCreature(this.rig, { speed: this.speed, action: this.action, actionT: this.actionT, actionDur: this.actionDur, dead: false }, dt);
  }
}
