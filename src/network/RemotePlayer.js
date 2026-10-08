import * as THREE from 'three';
import { createHumanoid, animateHumanoid } from '../entities/HumanoidModel.js';
import { makeLabel } from '../ui/Label.js';
import { CLASSES } from '../combat/Classes.js';
import { damp, lerpAngle } from '../core/math.js';
import { applyCosmetics, disposeCosmetics } from '../visual/Cosmetics.js';
import { CATALOG_BY_ID } from '../data/shopCatalog.js';

// Représentation visuelle d'un autre joueur connecté. La position réelle
// n'est mise à jour que ~9 fois/seconde par le serveur ; on lisse ("interpole")
// vers la dernière position connue pour un mouvement fluide entre deux paquets.
export class RemotePlayer {
  constructor(scene, info) {
    this.id = info.id;
    this.name = info.name;
    this.level = info.level;
    this.classId = info.classId;
    const cls = CLASSES[info.classId] || CLASSES.warrior;
    this.rig = createHumanoid({ cloth: cls.color, armor: cls.armor, shield: cls.shield, hair: 0x2c1f16, role: 'player:' + (info.classId || 'warrior') });
    this.pos = new THREE.Vector3(...info.pos);
    this.targetPos = this.pos.clone();
    this.yaw = info.yaw || 0;
    this.targetYaw = this.yaw;
    this.speed = 0;
    this.inst = info.inst | 0;
    this.anim = info.anim || 'idle';
    this.hp = info.hp; this.maxHp = info.maxHp;
    this._actionT = 0;
    this.rig.root.position.copy(this.pos);
    scene.add(this.rig.root);
    this.label = makeLabel(`${info.name}  ·  Nv.${info.level}`, { color: '#bfe6ff', size: 38 });
    this.label.position.y = 2.05;
    this.rig.root.add(this.label);
    this.setCos(info.cos);
  }

  // V10.1 : cosmétiques équipés (ids du catalogue, fournis par le serveur) : cercle, traînée, ailes, titre
  setCos(cos) {
    this.cos = cos && typeof cos === 'object' ? cos : {};
    try { applyCosmetics(this.rig, this.cos); } catch { /* ignoré */ }
    const tf = this.cos.title && CATALOG_BY_ID[this.cos.title]?.fx;
    if (this._titleKey === (tf ? this.cos.title : '')) return;
    this._titleKey = tf ? this.cos.title : '';
    if (this.titleLabel) { this.rig.root.remove(this.titleLabel); this.titleLabel.material.map?.dispose(); this.titleLabel.material.dispose(); this.titleLabel = null; }
    if (tf) {
      this.titleLabel = makeLabel(`« ${tf.text} »`, { color: tf.color, size: 32, scale: 2.2 });
      this.titleLabel.position.y = 2.38;
      this.rig.root.add(this.titleLabel);
    }
  }

  applyState(info) {
    this.targetPos.set(info.pos[0], info.pos[1], info.pos[2]);
    this.targetYaw = info.yaw;
    if (info.anim !== this.anim) this._actionT = 0;
    this.anim = info.anim;
    if (info.inst != null) this.inst = info.inst | 0;
    if (Number.isFinite(info.hp)) this.hp = info.hp;
    if (Number.isFinite(info.maxHp)) this.maxHp = info.maxHp;
    if (Number.isFinite(info.level) && info.level !== this.level) {
      this.level = info.level;
      this.label.material.map.dispose();
      const fresh = makeLabel(`${this.name}  ·  Nv.${this.level}`, { color: '#bfe6ff', size: 38 });
      this.label.material.map = fresh.material.map;
    }
  }

  update(dt, camQuat) {
    const dist = this.pos.distanceTo(this.targetPos);
    this.speed = Math.min(7.4, dist / Math.max(dt, 0.001));
    this.pos.x = damp(this.pos.x, this.targetPos.x, 12, dt);
    this.pos.y = damp(this.pos.y, this.targetPos.y, 12, dt);
    this.pos.z = damp(this.pos.z, this.targetPos.z, 12, dt);
    this.yaw = lerpAngle(this.yaw, this.targetYaw, Math.min(1, dt * 12));
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    const isAction = this.anim && this.anim !== 'idle' && this.anim !== 'walk' && this.anim !== 'run';
    if (isAction) this._actionT += dt; else this._actionT = 0;
    animateHumanoid(this.rig, {
      speed: this.speed, grounded: true,
      action: isAction ? this.anim : null, actionT: this._actionT, actionDur: 0.5,
      dead: this.anim === 'dead', crouch: false
    }, dt);
    if (camQuat) { this.label.quaternion.copy(camQuat); if (this.titleLabel) this.titleLabel.quaternion.copy(camQuat); }
  }

  dispose(scene) {
    disposeCosmetics(this.rig);
    scene.remove(this.rig.root);
    this.rig.root.traverse((o) => {
      if (o.isMesh) { if (!o.geometry.userData?.shared) o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
    });
  }
}
