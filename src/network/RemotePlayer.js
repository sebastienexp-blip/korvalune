import { createMount, updateMount, disposeMount } from '../visual/MountModel.js';
import { MOUNT_BY_ID } from '../data/mounts.js';
import * as THREE from 'three';
import { createHumanoid, animateHumanoid } from '../entities/HumanoidModel.js';
import { makeLabel } from '../ui/Label.js';
import { CLASSES } from '../combat/Classes.js';
import { damp, lerpAngle } from '../core/math.js';
import { applyCosmetics, disposeCosmetics } from '../visual/Cosmetics.js';
import { CATALOG_BY_ID } from '../data/shopCatalog.js';
import { sanitizeAppearance } from '../data/looks.js';

// Représentation visuelle d'un autre joueur connecté. La position réelle
// n'est mise à jour que ~9 fois/seconde par le serveur ; on lisse ("interpole")
// vers la dernière position connue pour un mouvement fluide entre deux paquets.
export class RemotePlayer {
  constructor(scene, info) {
    this.id = info.id;
    this.name = info.name;
    this.level = info.level;
    this.classId = info.classId;
    this.app = info.app ? sanitizeAppearance(info.app) : null; // V10.12 : apparence choisie (création / barbier)
    this.rig = this._makeRig();
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
    this.label.position.y = 2.05 * (this.rig.lookScale || 1);
    this.rig.root.add(this.label);
    this.scene = scene;
    this.setCos(info.cos);
    this.setMount(info.mnt);
  }

  _makeRig() {
    const cls = CLASSES[this.classId] || CLASSES.warrior, a = this.app;
    return createHumanoid({
      cloth: cls.color, armor: cls.armor, shield: cls.shield, role: 'player:' + (this.classId || 'warrior'),
      hair: a ? a.hairCol : 0x2c1f16, ...(a ? { eye: a.eyeCol, look: a } : {}), ...(a && a.skin != null ? { skin: a.skin } : {})
    });
  }

  // V10.12 : un autre joueur est passé chez le barbier → on reconstruit son modèle
  setLook(app) {
    this.app = sanitizeAppearance(app);
    const old = this.rig;
    disposeCosmetics(old);
    for (const l of [this.label, this.titleLabel]) if (l) old.root.remove(l);
    this.rig = this._makeRig();
    this.rig.root.position.copy(old.root.position);
    this.rig.root.rotation.y = old.root.rotation.y;
    this.scene.add(this.rig.root);
    this.scene.remove(old.root);
    old.root.traverse((o) => { if (o.isMesh) { if (!o.geometry.userData?.shared) o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); } });
    const h = this.rig.lookScale || 1;
    this.label.position.y = 2.05 * h; this.rig.root.add(this.label);
    if (this.titleLabel) { this.titleLabel.position.y = 2.38 * h; this.rig.root.add(this.titleLabel); }
    const cos = this.cos; this.cos = null; this.setCos(cos);
  }

  // V10.10 : monture visible des autres joueurs (identifiant validé par le serveur)
  setMount(id) {
    const def = id ? MOUNT_BY_ID[id] : null;
    if ((def ? def.id : '') === (this._mountId || '')) return;
    this._mountId = def ? def.id : '';
    if (this._mount) { disposeMount(this._mount); this._mount = null; }
    if (def) { this._mount = createMount(def); this.scene.add(this._mount.group); }
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
      this.titleLabel.position.y = 2.38 * (this.rig.lookScale || 1);
      this.rig.root.add(this.titleLabel);
    }
  }

  applyState(info) {
    this.targetPos.set(info.pos[0], info.pos[1], info.pos[2]);
    this.targetYaw = info.yaw;
    if (info.mnt !== undefined) this.setMount(info.mnt);
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
    if (this._mount) { this._mount.group.position.copy(this.pos); this._mount.group.rotation.y = this.yaw; updateMount(this._mount, dt, this.speed, !!this._mount.def.fly); this.rig.root.position.y += this._mount.seat; }
    const isAction = this.anim && this.anim !== 'idle' && this.anim !== 'walk' && this.anim !== 'run';
    if (isAction) this._actionT += dt; else this._actionT = 0;
    animateHumanoid(this.rig, {
      speed: this._mount ? 0 : this.speed, grounded: true,
      action: isAction ? this.anim : null, actionT: this._actionT, actionDur: 0.5,
      dead: this.anim === 'dead', crouch: !!this._mount
    }, dt);
    if (camQuat) { this.label.quaternion.copy(camQuat); if (this.titleLabel) this.titleLabel.quaternion.copy(camQuat); }
  }

  dispose(scene) {
    disposeCosmetics(this.rig);
    if (this._mount) { disposeMount(this._mount); this._mount = null; }
    scene.remove(this.rig.root);
    this.rig.root.traverse((o) => {
      if (o.isMesh) { if (!o.geometry.userData?.shared) o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
    });
  }
}
