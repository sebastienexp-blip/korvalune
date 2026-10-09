import * as THREE from 'three';
import { clamp, mulberry32 } from '../core/math.js';
import { createCreature, animateCreature } from './CreatureModel.js';
import { createHumanoid, animateHumanoid } from './HumanoidModel.js';
import { makeLabel } from '../ui/Label.js';
import { scaledEnemyStats } from '../data/difficulty.js';
import { tickStatus, vulnMult } from '../combat/Status.js';
import { share } from '../network/NetShare.js';

const STATE = { PATROL: 0, CHASE: 1, ATTACK: 2, FLEE: 3, RETURN: 4, DEAD: 5 };

// Les statistiques de combat (PV, dégâts, défense, XP, or) ne viennent plus
// de nombres fixes dans enemies.json : elles sont calculées à partir du
// niveau de CETTE instance via computeEnemyStats (src/data/enemyScaling.js).
// `def` ne décrit plus que le comportement/l'apparence de l'espèce — le
// même "loup" peut ainsi exister à n'importe quel niveau, de 1 à 200.
export class Enemy {
  constructor(scene, world, def, level, pos, bus, id) {
    this.scene = scene; this.world = world; this.def = def; this.bus = bus; this.id = id;
    this.level = Math.max(1, Math.round(level));
    const stats = scaledEnemyStats(this.level, def.species);
    this.maxHp = stats.hp; this.hp = stats.hp;
    this.damage = stats.damage; this.defense = stats.defense;
    this.xp = stats.xp; this.coins = stats.coins;

    this.home = pos.clone();
    this.pos = pos.clone();
    this.state = STATE.PATROL;
    this.stateT = 0;
    this.attackCd = 0;
    this.deadT = 0;
    this.respawnT = 0;
    this.speed = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.wanderTarget = this.home.clone();
    this.rand = mulberry32((id * 9781 + this.level * 131 + 17) >>> 0);
    this.action = null; this.actionT = 0; this.actionDur = 0.5;
    this.hitCooldownForPlayer = 0;

    this.rigType = def.rigType || 'creature';
    const glbOpts = { ...def.model, role: 'enemy:' + def.id, species: def.species, tint: def.model.fur ?? def.model.cloth ?? null };
    this.rig = this.rigType === 'humanoid' ? createHumanoid(glbOpts) : createCreature(glbOpts);
    this.rig.root.position.copy(this.pos);
    scene.add(this.rig.root);
    this.hpBar = this._makeHpBar();
    this.rig.root.add(this.hpBar.group);
    this.label = makeLabel(`${def.name} · Nv.${this.level}`, { color: '#ffd9d9', size: 40 });
    this.label.position.y = 1.85;
    this.rig.root.add(this.label);
    this.setBarVisible(false);
  }

  _makeHpBar() {
    const group = new THREE.Group();
    group.position.y = 1.55;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ color: 0x1a0f0f, depthTest: false, fog: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), new THREE.MeshBasicMaterial({ color: 0xd23f3f, depthTest: false, fog: false }));
    fg.position.z = 0.001;
    bg.renderOrder = fg.renderOrder = 19;
    group.add(bg, fg);
    return { group, fg };
  }

  // V3.7 (spires) : remplace l'étiquette au-dessus de la tête (champions, élites…)
  setTitle(text, color = '#ffd9d9') {
    if (this.label) { this.rig.root.remove(this.label); this.label.material?.map?.dispose?.(); this.label.material?.dispose?.(); }
    this.label = makeLabel(text, { color, size: 38, width: 640, height: 96, scale: 3.4 });
    this.label.position.y = 1.85 * (this.rig.root.scale.y || 1);
    this.rig.root.add(this.label);
    this.label.visible = this.hpBar.group.visible;
  }

  setBarVisible(v) { this.hpBar.group.visible = v; this.label.visible = v; }

  _animate(state, dt) {
    if (this.rigType === 'humanoid') {
      animateHumanoid(this.rig, { speed: state.speed, grounded: true, action: state.action, actionT: state.dead ? this.deadT : state.actionT, actionDur: state.actionDur || 0.7, dead: state.dead, crouch: false }, dt);
    } else {
      animateCreature(this.rig, state, dt);
    }
  }

  get alive() { return this.state !== STATE.DEAD; }

  takeDamage(dmg, crit, player, dot = false) {
    if (!this.alive) return 0;
    if (this.netProxy) return this._proxyHit(dmg, crit, dot);
    let final = Math.max(1, Math.round(dmg * vulnMult(this) - this.defense * 0.5));
    if (this.def.trait === 'armored' && !dot) { final = Math.max(1, Math.round(final * 0.7)); }
    if (!dot) this._hurtAgo = 0;
    this.hp = Math.max(0, this.hp - final);
    if (!dot) this.rig.hurtT = 1;
    if (player && player.pos && !dot) {
      const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1, f = crit ? 6 : 3.5;
      this._kb = { x: (dx / d) * f, z: (dz / d) * f };
    }
    if (this.thorns && player && player.takeDamage) player.takeDamage(Math.max(1, Math.round(final * this.thorns)), { guaranteed: true });
    this.setBarVisible(true);
    this.hpBar.fg.scale.x = Math.max(0.001, this.hp / this.maxHp);
    this.hpBar.fg.position.x = -(1 - this.hpBar.fg.scale.x) / 2;
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 1.6, z: 0 }), text: crit ? `CRIT ${final}` : `${final}`, color: crit ? '#ffd23f' : dot ? '#9be86a' : '#ffffff', big: crit });
    if (this.hp <= 0) this.kill(player);
    else {
      if (!dot) this.bus.emit('enemyHurt', this);
      if (this.state !== STATE.ATTACK) { this.state = STATE.CHASE; this.stateT = 0; }
    }
    return final;
  }

  kill(player) {
    const lp = share.localPlayer || player; // les récompenses vont toujours au joueur de CET appareil
    this.state = STATE.DEAD;
    this.deadT = 0;
    this.setBarVisible(false);
    if (share.role === 'host' && this.netKey && share.onKill) share.onKill(this);
    // En groupe : seuls les joueurs proches du monstre sont récompensés (XP, or, butin, quêtes)
    const near = share.role === 'solo' || !this.netKey || !!this.rift || !lp?.pos || lp.pos.distanceTo(this.pos) < share.range; // en spire : butin et progression partagés pour tout le groupe
    if (near) {
      this.bus.emit('enemyKilled', this);
      if (this.xp > 0) lp.gainXp(this.xp);
      const coins = Math.round(this.coins[0] + this.rand() * (this.coins[1] - this.coins[0]));
      lp.addCoins(Math.round(coins * (1 + (lp.goldBonus || 0))));
      this.bus.emit('loot', this);
    }
    this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 0.6, z: 0 }), color: 0x8a1f1f, count: 26, speed: 3.2, life: 0.6 });
    if (this.def.trait === 'volatile') { // V4.4 : explose à la mort
      this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 0.8, z: 0 }), color: 0xff7a2a, count: 46, speed: 6, life: 0.7 });
      this.bus.emit('shake', 0.3);
      this.bus.emit('enemyExplode', this);
      if (lp && lp.pos && !lp.dead && this.pos.distanceTo(lp.pos) < 3.4) {
        const dealt = lp.takeDamage(Math.max(1, Math.round(this.damage * 0.8)));
        if (dealt) this.bus.emit('floatText', { pos: lp.pos.clone().add({ x: 0, y: 2.6, z: 0 }), text: 'EXPLOSION', color: '#ff8a3a', big: true });
      }
    }
  }

  // ---------- Monde de groupe (V6.0) ----------
  // Copie d'un monstre simulé par l'hôte : pas d'IA, on suit les instantanés reçus.
  _proxyHit(dmg, crit, dot) {
    if (dot) return 0; // les poisons/brûlures sont gérés par l'hôte
    const final = Math.max(1, Math.round(dmg * vulnMult(this) - this.defense * 0.5));
    if (share.sendDmg) share.sendDmg(this.netKey, dmg, crit);
    this.rig.hurtT = 1;
    this.hp = Math.max(1, this.hp - final); // l'hôte tranche : jamais de mort « prédite »
    this._setHpBar();
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 1.6, z: 0 }), text: crit ? `CRIT ${final}` : `${final}`, color: crit ? '#ffd23f' : '#ffffff', big: crit });
    this.bus.emit('enemyHurt', this);
    return final;
  }

  _setHpBar() {
    this.setBarVisible(this.hp < this.maxHp);
    this.hpBar.fg.scale.x = Math.max(0.001, this.hp / this.maxHp);
    this.hpBar.fg.position.x = -(1 - this.hpBar.fg.scale.x) / 2;
  }

  netSnap() {
    const r = (v, n) => Math.round(v * n) / n;
    return [this.netKey, r(this.pos.x, 100), r(this.pos.z, 100), r(this.yaw, 100), Math.round(this.hp), this.state, this.action === 'attack' && this.actionT < 0.25 ? 1 : 0];
  }

  netApply(a) {
    this._nx = a[1]; this._nz = a[2]; this._nyaw = a[3];
    const st = a[5];
    if (st === STATE.DEAD) { if (this.state !== STATE.DEAD) this._netDieSilent(); return; }
    if (this.state === STATE.DEAD) { this.respawn(); this.pos.x = a[1]; this.pos.z = a[2]; }
    this.state = st;
    if (Math.abs(this.hp - a[4]) > 0.5) { this.hp = a[4]; this._setHpBar(); }
    if (a[6] && !this.action) this._netAct = true;
  }

  _netDieSilent() {
    this.state = STATE.DEAD; this.deadT = 999;
    this.setBarVisible(false);
    this.rig.root.visible = false;
  }

  _proxyUpdate(dt, player) {
    if (this.state === STATE.DEAD) { this.deadT += dt; return; }
    if (this._nx !== undefined) {
      const k = 1 - Math.exp(-14 * dt), ox = this.pos.x, oz = this.pos.z;
      this.pos.x += (this._nx - ox) * k; this.pos.z += (this._nz - oz) * k;
      this.speed = Math.min(this.def.speed * 1.5, Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 0.001));
      if (this.speed < 0.2) this.speed = 0;
      let dy = this._nyaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 12);
    }
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    if (this._netAct && !this.action) { this._netAct = false; this.action = 'attack'; this.actionT = 0; this.actionDur = 0.5; this.bus.emit('enemyAttack', this); }
    if (this.action === 'attack') { this.actionT += dt; if (this.actionT >= this.actionDur) { this.action = null; this.actionT = 0; } }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.label.quaternion.copy(player._camQuat || this.label.quaternion);
    this._animate({ speed: this.speed, action: this.action, actionT: this.actionT, actionDur: this.actionDur, dead: false }, dt);
  }

  update(dt, player) {
    if (this.netProxy) { this._proxyUpdate(dt, player); return; }
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hitCooldownForPlayer = Math.max(0, this.hitCooldownForPlayer - dt);
    if (this.state === STATE.DEAD) {
      this.deadT += dt;
      if (this.deadT > this.def.respawn && !this.noRespawn) this.respawn();
      this._animate({ speed: 0, dead: true, deadT: this.deadT }, dt);
      return;
    }
    const S = tickStatus(this, dt, player);
    if (this.state === STATE.DEAD) return; // mort par poison/brûlure
    // V4.4 : comportements propres à certains monstres
    const trait = this.def.trait;
    if (trait === 'frenzy' && !this._frenzy && this.hp / this.maxHp < 0.35) {
      this._frenzy = true;
      this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.2, z: 0 }), text: 'FUREUR !', color: '#ff5a3a', big: true });
      this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 1, z: 0 }), color: 0xff3a2a, count: 24, speed: 3, life: 0.6 });
      this.bus.emit('enemyEnrage', this);
    }
    if (trait === 'regen') {
      this._hurtAgo = (this._hurtAgo ?? 99) + dt;
      if (this._hurtAgo > 3 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
        this.hpBar.fg.scale.x = Math.max(0.001, this.hp / this.maxHp);
        this.hpBar.fg.position.x = -(1 - this.hpBar.fg.scale.x) / 2;
      }
    }
    if (S.stun) { // étourdi : ni déplacement ni attaque
      this.speed = 0; this._pendingHit = false; this._pendingShot = false; this.action = null;
      this.world.pushOut(this.pos, 0.5);
      this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
      if (this._kb) {
        this.pos.x += this._kb.x * dt; this.pos.z += this._kb.z * dt;
        const dec = Math.pow(0.001, dt); this._kb.x *= dec; this._kb.z *= dec;
        if (Math.abs(this._kb.x) + Math.abs(this._kb.z) < 0.15) this._kb = null;
      }
      this.rig.root.position.copy(this.pos);
      this.label.quaternion.copy(player._camQuat || this.label.quaternion);
      this._animate({ speed: 0, action: null, actionT: 0, actionDur: this.actionDur, dead: false }, dt);
      return;
    }
    const toPlayer = player.pos.clone().sub(this.pos); toPlayer.y = 0;
    const distP = toPlayer.length();
    const distHome = this.pos.distanceTo(this.home);
    let targetVel = new THREE.Vector3();

    if (this.state === STATE.PATROL) {
      this.stateT += dt;
      if (!player.dead && distP < this.def.aggro) { this.state = STATE.CHASE; this.stateT = 0; }
      else {
        if (this.stateT > 3 || this.pos.distanceTo(this.wanderTarget) < 0.6) {
          this.stateT = 0;
          const a = this.rand() * Math.PI * 2, r = this.rand() * 6;
          this.wanderTarget.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
        }
        const d = this.wanderTarget.clone().sub(this.pos); d.y = 0;
        if (d.length() > 0.3) { targetVel = d.normalize().multiplyScalar(this.def.speed * 0.35); }
      }
    } else if (this.state === STATE.CHASE) {
      if (player.dead || distHome > this.def.leash) { this.state = STATE.RETURN; }
      else if (this.def.alwaysFlee) { this.state = STATE.FLEE; this.stateT = 0; }
      else if (distP < this._reach() && !this.world.losBlocked(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) { this.state = STATE.ATTACK; this.stateT = 0; }
      else if (this.def.flees && this.hp / this.maxHp < 0.22 && this.rand() < 0.01) { this.state = STATE.FLEE; this.stateT = 0; }
      else targetVel = toPlayer.clone().normalize().multiplyScalar(this.def.speed);
    } else if (this.state === STATE.ATTACK) {
      this.stateT += dt;
      if (distP > this._reach() * 1.15 || this.world.losBlocked(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) { this.state = STATE.CHASE; }
      else {
        const R = this.def.ranged;
        if (R && distP < R.min) targetVel = this.pos.clone().sub(player.pos).setY(0).normalize().multiplyScalar(this.def.speed * 0.8); // recule pour garder la distance
        this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
        if (this.attackCd <= 0) {
          this.attackCd = this.def.attackCd * (this._frenzy ? 0.7 : 1);
          this.action = 'attack'; this.actionT = 0; this.actionDur = 0.5;
          this.bus.emit('enemyAttack', this);
          if (R) this._pendingShot = true; else this._pendingHit = true;
        }
      }
    } else if (this.state === STATE.FLEE) {
      this.stateT += dt;
      targetVel = this.pos.clone().sub(player.pos).setY(0).normalize().multiplyScalar(this.def.speed * 1.1);
      if (this.stateT > 2.2) this.state = STATE.CHASE;
    } else if (this.state === STATE.RETURN) {
      const d = this.home.clone().sub(this.pos); d.y = 0;
      if (d.length() < 1) { this.state = STATE.PATROL; this.stateT = 0; }
      else targetVel = d.normalize().multiplyScalar(this.def.speed * 0.6);
    }

    if (this._frenzy) targetVel.multiplyScalar(1.3);
    if (S.slow < 1) targetVel.multiplyScalar(S.slow);
    if (targetVel.lengthSq() > 0) {
      if (!(this.state === STATE.ATTACK && this.def.ranged)) this.yaw = Math.atan2(targetVel.x, targetVel.z);
      const nx = this.pos.x + targetVel.x * dt, nz = this.pos.z + targetVel.z * dt;
      // terrain seulement (eau, falaises) : les obstacles sont contournés par pushOut, l'ennemi glisse au lieu de rester coincé
      if (this.world.canStep(this.pos.x, this.pos.z, nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
      else if (this.world.canStep(this.pos.x, this.pos.z, nx, this.pos.z)) this.pos.x = nx;
      else if (this.world.canStep(this.pos.x, this.pos.z, this.pos.x, nz)) this.pos.z = nz;
      this.speed = targetVel.length();
    } else this.speed = 0;

    this.world.pushOut(this.pos, 0.5);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);

    if (this.action === 'attack') {
      this.actionT += dt;
      if (this._pendingShot && this.actionT > this.actionDur * 0.45) {
        this._pendingShot = false;
        const R = this.def.ranged;
        const from = this.pos.clone(); from.y += 1.3;
        const to = player.pos.clone(); to.y += 1.1;
        const dir = to.sub(from).normalize();
        this.bus.emit('enemyShoot', { from, dir, speed: R.speed, damage: this.damage, color: R.color, range: R.range, enemy: this });
      }
      if (this._pendingHit && this.actionT > this.actionDur * 0.45) {
        this._pendingHit = false;
        if (this.pos.distanceTo(player.pos) < this.def.attackRange * 1.2 && !this.world.losBlocked(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) {
          const dealt = player.takeDamage(this.damage);
          if (this.onPlayerHit) this.onPlayerHit(dealt);
        }
      }
      if (this.actionT >= this.actionDur) { this.action = null; this.actionT = 0; }
    }

    if (this._kb) {
      this.pos.x += this._kb.x * dt; this.pos.z += this._kb.z * dt;
      const dec = Math.pow(0.001, dt);
      this._kb.x *= dec; this._kb.z *= dec;
      if (Math.abs(this._kb.x) + Math.abs(this._kb.z) < 0.15) this._kb = null;
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.label.quaternion.copy(player._camQuat || this.label.quaternion);
    this._animate({ speed: this.speed, action: this.action, actionT: this.actionT, actionDur: this.actionDur, dead: false }, dt);
  }

  _reach() { return this.def.ranged ? this.def.ranged.range : this.def.attackRange; }

  respawn() {
    this.hp = this.maxHp; this._frenzy = false;
    this.state = STATE.PATROL;
    this.pos.copy(this.home);
    this.rig.root.visible = true;
    this.hpBar.fg.scale.x = 1;
  }

  // Retire complètement l'ennemi de la scène (libère géométries/matériaux) —
  // utilisé quand le joueur s'éloigne trop d'un point de spawn (voir
  // Game._updateEnemyStreaming). L'ennemi réapparaîtra, frais, si le joueur
  // revient dans la zone.
  dispose(scene) {
    scene.remove(this.rig.root);
    this.rig.root.traverse((o) => {
      if (o.isMesh) { if (!o.geometry.userData?.shared) o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
    });
  }
}
