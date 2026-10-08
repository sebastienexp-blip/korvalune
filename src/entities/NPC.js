import * as THREE from 'three';
import { createHumanoid, animateHumanoid } from './HumanoidModel.js';
import { makeLabel } from '../ui/Label.js';

export class NPC {
  constructor(scene, def, pos, yaw = 0) {
    this.def = def;
    this.pos = pos.clone();
    this.rig = createHumanoid({ cloth: def.look.cloth, armor: def.look.armor, cape: def.look.cape, hair: def.look.hair, shield: true, role: 'npc:' + (def.id || def.name) });
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = yaw;
    scene.add(this.rig.root);
    this.label = makeLabel(def.name, { color: '#ffe9a8' });
    this.label.position.y = 2.05;
    this.rig.root.add(this.label);
    this.t = Math.random() * 10;
    this.baseYaw = yaw;
  }

  update(dt, camQuat) {
    this.t += dt;
    animateHumanoid(this.rig, { speed: 0, grounded: true, action: null }, dt);
    this.rig.head.rotation.y = Math.sin(this.t * 0.6) * 0.25;
    if (camQuat) this.label.quaternion.copy(camQuat);
  }
}
