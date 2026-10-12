// V10.33 — GPS au sol : une piste de chevrons lumineux guide le joueur vers l'objectif de quête le plus proche.
import * as THREE from 'three';

const MAX = 28;        // nombre de chevrons
const STEP = 2.2;      // écart entre chevrons (m)
const REACH = MAX * STEP;

export class GroundGPS {
  constructor(scene, world) {
    this.world = world;
    const geo = new THREE.ConeGeometry(0.42, 1.0, 3);
    geo.rotateX(Math.PI / 2); // pointe vers +Z
    geo.scale(1, 0.25, 1);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.85, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this._t = 0;
  }

  // spots : [{x,z}] ; renvoie la distance à la cible (ou null)
  update(dt, player, spots, enabled) {
    if (!enabled || !spots || !spots.length || !player || player.dead) { this.mesh.visible = false; return null; }
    const px = player.pos.x, pz = player.pos.z;
    let best = null, bd = Infinity;
    for (const s of spots) { const d = Math.hypot(s.x - px, s.z - pz); if (d < bd) { bd = d; best = s; } }
    if (!best || bd < 4) { this.mesh.visible = false; return bd; }
    this._t += dt;
    const dx = (best.x - px) / bd, dz = (best.z - pz) / bd;
    this._q.setFromAxisAngle(this._up, Math.atan2(dx, dz));
    const n = Math.min(MAX, Math.floor(Math.min(bd - 2, REACH) / STEP));
    const flow = (this._t * 2.4) % STEP; // les chevrons avancent vers la cible
    for (let i = 0; i < MAX; i++) {
      if (i >= n) { this._m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this._m); continue; }
      const d = 2.5 + i * STEP + flow;
      const x = px + dx * d, z = pz + dz * d;
      this._p.set(x, this.world.heightAt(x, z) + 0.12, z);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.count = MAX;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mat.opacity = 0.6 + 0.25 * Math.sin(this._t * 4);
    this.mesh.visible = true;
    return bd;
  }

  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
