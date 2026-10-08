import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { clamp, damp } from '../core/math.js';

// Deux modes de caméra :
//  - 'iso' (défaut) : caméra FIXE classique (V6.1) : angle et inclinaison verrouillés, aucune rotation ;
//    seul le zoom (molette / pincement) reste possible, dans une plage resserrée. Le décor qui gêne devient translucide.
//  - 'free' : l'ancienne caméra orbitale troisième personne (verrouillable derrière le joueur).
export const CAMERA_MODES = {
  iso: { aerial: true, fov: 40, pitch: 0.95, pitchMin: 0.95, pitchMax: 0.95, dist: 17, min: 11, max: 27, yaw: Math.PI + Math.PI / 4, pivotY: 1.0 },
  free: { fov: CONFIG.camera.fov, pitch: 0.38, pitchMin: -0.05, pitchMax: 1.25, dist: CONFIG.camera.start, min: CONFIG.camera.min, max: CONFIG.camera.max, yaw: Math.PI, pivotY: 1.5 },
  // V8.3 — caméras supplémentaires
  close: { fov: 62, pitch: 0.2, pitchMin: -0.1, pitchMax: 0.9, dist: 4.2, min: 2.2, max: 8, yaw: Math.PI, pivotY: 1.65 }, // par-dessus l'épaule
  high: { aerial: true, fov: 38, pitch: 1.12, pitchMin: 1.12, pitchMax: 1.12, dist: 30, min: 18, max: 52, yaw: Math.PI + Math.PI / 4, pivotY: 1.0 }, // vue tactique haute
  top: { aerial: true, fov: 40, pitch: 1.38, pitchMin: 1.38, pitchMax: 1.38, dist: 24, min: 12, max: 48, yaw: Math.PI, pivotY: 1.0 } // vue de dessus
};
export const CAMERA_LABELS = [
  ['iso', 'Aérienne fixe (par défaut)'],
  ['free', 'Libre (3ᵉ personne)'],
  ['close', 'Épaule (3ᵉ personne rapprochée)'],
  ['high', 'Tactique (aérienne haute, grand champ)'],
  ['top', 'Vue de dessus (presque verticale)']
];

// écart angulaire le plus court (a → b), pour ne jamais faire un tour complet de caméra
const angleDiff = (a, b) => ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export class CameraRig {
  constructor(camera, world, mode = 'iso') {
    this.camera = camera;
    this.world = world;
    this.locked = true;
    this.rotate = null; // null = auto (selon la caméra) · true = rotation activée · false = rotation désactivée
    this.follow = true; // (caméra libre verrouillée) suit le joueur seulement quand il avance
    this.pivot = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this.setMode(mode);
  }

  get fov() { return this.cfg.fov; }
  get isIso() { return !!this.cfg.aerial; } // caméras aériennes (pas de pointer lock)
  get rotatable() { return this.rotate == null ? !this.cfg.aerial : !!this.rotate; }

  setMode(mode) {
    this.mode = CAMERA_MODES[mode] ? mode : 'iso';
    this.cfg = CAMERA_MODES[this.mode];
    this.yaw = this.cfg.yaw;
    this.pitch = this.cfg.pitch;
    this.dist = this.wantDist = this.cfg.dist;
    this._snap = true;
  }

  // Remet l'angle et le zoom par défaut (bouton 🔒 en mode aérien).
  recenter() {
    this.yaw = this.cfg.yaw; this.pitch = this.cfg.pitch; this.wantDist = this.cfg.dist;
  }

  update(target, dt, look, wheel, playerYaw) {
    const c = this.cfg;
    const rot = this.rotatable;
    if (!this.isIso && rot && this.locked && this.follow) this.yaw += angleDiff(this.yaw, playerYaw) * (1 - Math.exp(-10 * dt));
    if (rot) {
      this.yaw -= look.dx * 0.0032;
      this.pitch = clamp(this.pitch - look.dy * 0.0026, c.pitchMin, c.pitchMax); // (inclinaison fixe sur les vues aériennes)
    } else {
      if (this.isIso) this.yaw = c.yaw; // rotation désactivée : l'angle reste figé (aérienne : angle d'origine)
      this.pitch = clamp(this.pitch, c.pitchMin, c.pitchMax);
      if (this.isIso) this.pitch = c.pitch;
    }
    if (wheel) {
      this.wantDist = this.isIso
        ? clamp(this.wantDist * Math.exp(wheel * 0.0011), c.min, c.max)
        : clamp(this.wantDist + wheel * 0.0016, c.min, c.max);
    }
    this.dist = damp(this.dist, this.wantDist, 10, dt);

    this.pivot.copy(target); this.pivot.y += c.pivotY;
    const cy = Math.cos(this.pitch), sy = Math.sin(this.pitch);
    // direction pivot → caméra : derrière le joueur (selon le lacet) et AU-DESSUS (tangage > 0)
    this._dir.set(-Math.sin(this.yaw) * cy, sy, -Math.cos(this.yaw) * cy);

    // anti-clip : on raccourcit la distance si la ligne de visée passe sous le terrain
    let dist = this.dist;
    const N = 8;
    for (let i = 1; i <= N; i++) {
      const d = dist * (i / N);
      const x = this.pivot.x + this._dir.x * d, z = this.pivot.z + this._dir.z * d;
      const ry = this.pivot.y + this._dir.y * d;
      if (ry < this.world.heightAt(x, z) + 0.4) { dist = Math.max(1.6, dist * ((i - 1) / N)); break; }
    }
    this._pos.copy(this.pivot).addScaledVector(this._dir, dist);
    const gy = this.world.heightAt(this._pos.x, this._pos.z) + 0.4;
    if (this._pos.y < gy) this._pos.y = gy;
    if (this._snap) { this.camera.position.copy(this._pos); this._snap = false; }
    else this.camera.position.lerp(this._pos, dt > 0 ? Math.min(1, dt * 22) : 1);
    this.camera.lookAt(this.pivot);
  }
}
