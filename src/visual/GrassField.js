import * as THREE from 'three';
import { grassTuftGeometry, flowerGeometry } from './Foliage.js';
import { addSway } from './Safe.js';
import { fbm } from '../world/noise.js';
import { CONFIG } from '../core/config.js';

// Champ d'herbe "glissant" : un anneau fixe d'instances qui suit le joueur.
// Les positions sont déterministes (hash de la cellule du monde) et la grille
// est toroïdale : quand le joueur avance, seules les cellules du bord sont
// réécrites (coût quasi nul). Un fondu par distance dans le vertex shader
// masque l'apparition/disparition.

const hash = (x, z, s = 0) => {
  const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

export class GrassField {
  constructor(scene, world, { density = 3, cells = 30, cell = 1.7 } = {}) {
    this.world = world;
    this.N = cells;
    this.cell = cell;
    this.per = density;
    this.R = (cells * cell) / 2;
    const total = cells * cells * density;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    addSway(mat, { amp: 0.14, height: 0.6, fadeR: this.R - 1, speed: 1.9 });
    this.grass = new THREE.InstancedMesh(grassTuftGeometry(), mat, total);
    this.grass.frustumCulled = false;
    this.grass.receiveShadow = false;
    this.grass.castShadow = false;

    // fleurs : 1 par cellule maximum, en prairies (bruit basse fréquence)
    const fmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    addSway(fmat, { amp: 0.07, height: 0.35, fadeR: this.R - 1, speed: 2.2 });
    this.flowers = new THREE.InstancedMesh(flowerGeometry(), fmat, cells * cells);
    this.flowers.frustumCulled = false;
    const col = new THREE.Color();
    this._flowerPalette = [0xffffff, 0xffd83a, 0xff6a8a, 0x9a7aff, 0xff9a3a, 0x6ab8ff].map((c) => col.set(c).clone());

    scene.add(this.grass, this.flowers);
    this.cx = new Int32Array(cells * cells).fill(2147483647);
    this.cz = new Int32Array(cells * cells).fill(2147483647);
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.visible = true;
    this.lastCx = null; this.lastCz = null;
  }

  setVisible(v) { this.visible = v; this.grass.visible = v; this.flowers.visible = v; }

  _writeCell(ix, iz, slot) {
    const w = this.world, d = this._d, cell = this.cell, per = this.per;
    const x0 = ix * cell, z0 = iz * cell;
    const wl = w.waterLevel;
    const baseIdx = slot * per;
    let anyFlower = false;
    for (let k = 0; k < per; k++) {
      const x = x0 + hash(ix, iz, k * 3 + 1) * cell, z = z0 + hash(ix, iz, k * 3 + 2) * cell;
      const idx = baseIdx + k;
      const dist = Math.hypot(x, z);
      let ok = dist > CONFIG.world.townRadius - 2 && dist < CONFIG.world.bound - 6;
      let y = 0;
      if (ok) {
        y = w.heightAt(x, z);
        if (y < wl + 0.55 || y > 17) ok = false;
        else if (w.roadDist(x, z) < 2.4) ok = false; // chemin
        else { const bm = w.biomeAt(x, z); if (bm === 'abyss' || bm === 'void' || bm === 'corrupt' || bm === 'desert' || bm === 'tundra' || bm === 'swamp') ok = false; } // pas d'herbe en terres stériles
      }
      if (!ok) { this.grass.setMatrixAt(idx, this._zero); continue; }
      // densité plus faible en lisière de forêt / rochers (bruit)
      const dens = fbm(x * 0.03 + 90, z * 0.03 + 90, 2);
      if (hash(ix, iz, k + 11) > 0.35 + dens * 1.1) { this.grass.setMatrixAt(idx, this._zero); continue; }
      const s = 0.7 + hash(ix, iz, k + 21) * 0.9;
      d.position.set(x, y - 0.02, z);
      d.rotation.set(0, hash(ix, iz, k + 31) * 6.28, 0);
      d.scale.set(s, s * (0.8 + hash(ix, iz, k + 41) * 0.7), s);
      d.updateMatrix();
      this.grass.setMatrixAt(idx, d.matrix);
      // couleur : herbe sèche ↔ verte, + zones sombres sous les arbres
      const dry = fbm(x * 0.012 + 400, z * 0.012 + 400, 2);
      this._c.setRGB(0.75 + dry * 0.55, 0.85 + (1 - dry) * 0.25, 0.62 + hash(ix, iz, k) * 0.2);
      this.grass.setColorAt(idx, this._c);
      // fleur ?
      if (!anyFlower && k === 0) {
        const meadow = fbm(x * 0.045 + 700, z * 0.045 + 700, 2);
        if (meadow > 0.56 && hash(ix, iz, 77) > 0.35) {
          anyFlower = true;
          d.position.set(x + 0.2, y - 0.02, z + 0.1);
          d.scale.setScalar(0.9 + hash(ix, iz, 5) * 0.8);
          d.updateMatrix();
          this.flowers.setMatrixAt(slot, d.matrix);
          this.flowers.setColorAt(slot, this._flowerPalette[Math.floor(hash(ix, iz, 9) * this._flowerPalette.length)]);
        }
      }
    }
    if (!anyFlower) this.flowers.setMatrixAt(slot, this._zero);
  }

  // À appeler chaque frame avec la position du joueur
  update(px, pz) {
    if (!this.visible) return;
    const N = this.N, cell = this.cell;
    const cx = Math.floor(px / cell), cz = Math.floor(pz / cell);
    if (cx === this.lastCx && cz === this.lastCz) return;
    this.lastCx = cx; this.lastCz = cz;
    const half = N >> 1;
    let changed = 0;
    for (let ix = cx - half; ix < cx - half + N; ix++) {
      for (let iz = cz - half; iz < cz - half + N; iz++) {
        const sx = ((ix % N) + N) % N, sz = ((iz % N) + N) % N;
        const slot = sx * N + sz;
        if (this.cx[slot] === ix && this.cz[slot] === iz) continue;
        this.cx[slot] = ix; this.cz[slot] = iz;
        this._writeCell(ix, iz, slot);
        changed++;
      }
    }
    if (changed) {
      this.grass.instanceMatrix.needsUpdate = true;
      if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
      this.flowers.instanceMatrix.needsUpdate = true;
      if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true;
    }
  }

  // Remplissage initial (peut être étalé : renvoie le nombre de cellules traitées)
  forceRefresh(px, pz) { this.lastCx = null; this.update(px, pz); }
}
