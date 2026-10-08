import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { mulberry32 } from '../core/math.js';
import { WORLD_TIERS } from './WorldTiers.js';
import { regionAt, isLand } from './Continent.js';

// V4.7 : coffres au trésor cachés dans le monde (positions fixes, générées
// de façon déterministe). Ouverts une fois pour toutes (sauvegardés).
const BODY = new THREE.BoxGeometry(0.95, 0.5, 0.6);
const LID = new THREE.BoxGeometry(0.97, 0.22, 0.62);
const BAND = new THREE.BoxGeometry(0.1, 0.74, 0.66);
const MAT_WOOD = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });
const MAT_GOLD = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.35, metalness: 0.7, emissive: 0x3a2a05 });

export class WorldChests {
  constructor(scene, world, openedIds) {
    this.scene = scene; this.world = world; this.opened = openedIds instanceof Set ? openedIds : new Set(openedIds || []);
    this.list = []; this._sparkT = 0;
    const rand = mulberry32(777);
    const wl = CONFIG.world.waterLevel, B = CONFIG.world.bound - 40;
    const add = (id, x, z, level, tier) => {
      const c = { id, x, z, level, tier, group: this._mesh(x, z), lidT: this.opened.has(id) ? 1 : 0, open: this.opened.has(id) };
      c.group.userData.lid.rotation.x = -1.25 * c.lidT;
      this.list.push(c);
    };
    // Monde 1 : réparti sur la carte, niveau selon l'éloignement de la ville
    const [lo, hi] = WORLD_TIERS[0].levelRange;
    for (let n = 0, tries = 0; n < 22 && tries < 2000; tries++) {
      const x = (rand() * 2 - 1) * B, z = (rand() * 2 - 1) * B, d = Math.hypot(x, z);
      if (d < 85 || d > B || !isLand(x, z) || !['prairie', 'forest', 'mount'].includes(regionAt(x, z).id) || this._bad(x, z, wl)) continue;
      const level = Math.max(lo, Math.min(hi, Math.round(lo + ((d - 85) / (300 - 85)) * (hi - lo))));
      add('w1_' + n, x, z, level, 1); n++;
    }
    // V8.0 : quelques coffres dans chaque région lointaine
    for (const t of WORLD_TIERS) {
      if (!t.center) continue;
      for (let n = 0, tries = 0; n < 5 && tries < 900; tries++) {
        const a = rand() * Math.PI * 2, r = (0.1 + rand() * 0.9) * t.radius;
        const x = t.center[0] + Math.cos(a) * r, z = t.center[1] + Math.sin(a) * r;
        if (!isLand(x, z) || regionAt(x, z).id !== t.regionId || this._bad(x, z, wl)) continue;
        add(`w${t.id}_${n}`, x, z, Math.round(t.levelRange[0] + rand() * (t.levelRange[1] - t.levelRange[0])), t.id); n++;
      }
    }
  }

  _bad(x, z, wl) {
    if (this.world.heightAt(x, z) < wl + 0.8) return true;
    return !this.world.isWalkable(x, z, 1.2);
  }

  _mesh(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(BODY, MAT_WOOD); body.position.y = 0.25;
    const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3);
    const lidMesh = new THREE.Mesh(LID, MAT_WOOD); lidMesh.position.set(0, 0.11, 0.3);
    lid.add(lidMesh);
    const b1 = new THREE.Mesh(BAND, MAT_GOLD); b1.position.set(-0.3, 0.37, 0); const b2 = b1.clone(); b2.position.x = 0.3;
    g.add(body, lid, b1, b2);
    g.userData.lid = lid;
    g.position.set(x, this.world.heightAt(x, z), z);
    g.rotation.y = (x * 7.13 + z * 3.7) % (Math.PI * 2);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  nearest(pos, r = 3) {
    let best = null, bd = r;
    for (const c of this.list) {
      if (c.open) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  markOpen(c) { c.open = true; this.opened.add(c.id); }
  serialize() { return [...this.opened]; }

  update(dt, ppos, bus) {
    this._sparkT -= dt;
    const spark = this._sparkT <= 0; if (spark) this._sparkT = 1.1;
    for (const c of this.list) {
      const d = Math.hypot(c.x - ppos.x, c.z - ppos.z);
      c.group.visible = d < 120;
      if (c.open && c.lidT < 1) { c.lidT = Math.min(1, c.lidT + dt * 2.5); c.group.userData.lid.rotation.x = -1.25 * c.lidT; }
      if (spark && !c.open && d < 30) bus.emit('particles', { pos: new THREE.Vector3(c.x, c.group.position.y + 0.9, c.z), color: 0xffd23f, count: 3, speed: 0.8, life: 0.9, up: 1.2 });
    }
  }
}
