import * as THREE from 'three';
import { createHumanoid, animateHumanoid } from './HumanoidModel.js';
import { makeLabel } from '../ui/Label.js';
import { buildMonolith } from '../world/Monolith.js';
import { npcAppearance, isGuardNpc } from '../data/npcLooks.js';
import { refreshGlbGear } from '../visual/GlbEquipment.js';

// V10.75 : les PNJ utilisent le corps et la tête modélisés du personnage joueur (visage, coiffure, teint, couleurs propres à chacun).
// Repli : ancien modèle de villageois si le corps du joueur n'est pas chargé.
function makeNpcRig(def) {
  const L = def.look || {};
  try {
    const a = npcAppearance(def);
    const opts = { skin: a.skin, cloth: a.cloth, armor: L.armor, cape: L.cape, hair: a.hair, eye: a.eye, look: a.look, equipVisible: false, shield: false, role: 'player:npc' };
    for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
    const rig = createHumanoid(opts);
    if (rig && rig.glb && rig.glbSkeleton) {
      if (isGuardNpc(def)) {    // gardes : armure de plates (sans casque : on voit leur visage) teintée à leur couleur, épée au côté
        const tint = L.armor != null ? L.armor : null;
        const piece = tint != null ? { tint } : {};
        const slots = { shoulders: piece, chest: piece, legs: piece, gloves: piece, mainhand: { visual: 'sword' } };
        if (L.cape) slots.cape = { tint: L.cape };
        refreshGlbGear(rig, slots, (it) => it);
      }
      return rig;
    }
  } catch (e) { console.warn('[V10.75] PNJ au modèle du joueur ignoré', e); }
  return createHumanoid({ cloth: L.cloth, armor: L.armor, cape: L.cape, hair: L.hair, shield: true, role: 'npc:' + (def.id || def.name), ...(L.skin != null ? { skin: L.skin } : {}), ...(L.shape ? { look: L.shape, shield: false } : {}) });
}

export class NPC {
  constructor(scene, def, pos, yaw = 0) {
    this.def = def;
    this.pos = pos.clone();
    this.rig = def.model === 'monolith' ? buildMonolith() : makeNpcRig(def);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = yaw;
    scene.add(this.rig.root);
    this.label = makeLabel(def.name, { color: '#ffe9a8' });
    this.label.position.y = 2.05 * (this.rig.lookScale || 1);
    this.rig.root.add(this.label);
    this.t = Math.random() * 10;
    this.baseYaw = yaw;
    this.walk = def.walk || null; this.wi = this.walk ? 1 : 0; this.moving = false;
  }

  update(dt, camQuat, playerPos) {
    this.t += dt;
    if (this.rig.isProp) this.rig.update(dt);
    else {
      if (playerPos) { const d2 = (playerPos.x - this.pos.x) ** 2 + (playerPos.z - this.pos.z) ** 2; const vis = d2 < 85 * 85; this.rig.root.visible = vis; if (!vis) return; }   // modèles très détaillés : invisibles au loin
      let sp = 0;
      if (this.walk) { // V10.39 : promeneurs — ils s'arrêtent et se tournent vers le joueur quand il est proche
        const near = playerPos && Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z) < 4.2;
        if (near) {
          const ty = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
          let dy = ty - this.rig.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          this.rig.root.rotation.y += dy * Math.min(1, dt * 4);
        } else {
          const w = this.walk[this.wi], dx = w[0] - this.pos.x, dz = w[1] - this.pos.z, dist = Math.hypot(dx, dz);
          if (dist < 0.4) this.wi = (this.wi + 1) % this.walk.length;
          else {
            const st = Math.min(dist, 1.35 * dt);
            this.pos.x += dx / dist * st; this.pos.z += dz / dist * st;
            this.rig.root.position.x = this.pos.x; this.rig.root.position.z = this.pos.z;
            let dy = Math.atan2(dx, dz) - this.rig.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            this.rig.root.rotation.y += dy * Math.min(1, dt * 5);
            sp = 1.35;
          }
        }
      }
      animateHumanoid(this.rig, { speed: sp, grounded: true, action: null }, dt);
      this.rig.head.rotation.y = sp ? 0 : Math.sin(this.t * 0.6) * 0.25;
    }
    if (camQuat) this.label.quaternion.copy(camQuat);
  }
}
