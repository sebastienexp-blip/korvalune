// V9.4 — Aura d'arme selon la rareté : manchon lumineux additif le long de l'arme + étincelles qui tournent / montent.
// Aucune lumière dynamique (pas de PointLight) : uniquement des matériaux additifs, très léger pour le mobile.
import * as THREE from 'three';
import { glowTexture, safeTexture } from './Textures.js';

let _glow;
const glowTex = () => (_glow === undefined ? (_glow = safeTexture(glowTexture, 64)) : _glow);

// [centre, longueur] de l'arme selon son type (axe Y local du groupe d'arme)
const DIMS = { sword: [0.62, 1.0], dagger: [0.3, 0.46], staff: [0.62, 1.35], bow: [0, 1.0] };

// Un style par classe de rareté (commun : aucune aura)
const STYLES = {
  magique: { color: 0x3db2ff, glow: 0.22, sparks: 6, size: 0.11, rad: 0.15, rise: 0.25, spin: 1.2, pulse: 1.6 },
  rare: { color: 0xffd21f, glow: 0.32, sparks: 10, size: 0.085, rad: 0.18, rise: 0.4, spin: 1.6, pulse: 2.2 },
  legendaire: { color: 0xe3b27a, glow: 0.42, sparks: 15, size: 0.1, rad: 0.21, rise: 0.65, spin: 1.0, pulse: 2.6, embers: true },
  mythique: { color: 0xc23bff, glow: 0.55, sparks: 20, size: 0.07, rad: 0.25, rise: 0.5, spin: 3.0, pulse: 3.4 },
  absolu: { color: 0xffffff, glow: 0.7, sparks: 26, size: 0.125, rad: 0.3, rise: 0.7, spin: 3.6, pulse: 4.2, prism: true }
};

function disposeAura(a) {
  if (!a) return;
  if (a.group.parent) a.group.parent.remove(a.group);
  a.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}

// Pose (ou retire) l'aura sur l'arme tenue. rarityId : 'commun' | 'magique' | 'rare' | 'legendaire' | 'mythique' | 'absolu'
export function setWeaponAura(rig, rarityId, visualType) {
  const wv = rig && rig.equipVisuals && rig.equipVisuals.weapons;
  const st = STYLES[rarityId];
  const parent = wv && visualType && wv[visualType];
  if (rig.weaponAura && rig.weaponAura.key === rarityId + '|' + visualType) return; // déjà en place
  disposeAura(rig.weaponAura); rig.weaponAura = null;
  if (!st || !parent) return;
  const [cy, len] = DIMS[visualType] || DIMS.sword;
  const group = new THREE.Group();
  group.position.y = cy;
  const col = new THREE.Color(st.color);
  const mk = (r0, r1, op) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  const sleeve = mk(st.rad * 0.55, st.rad * 0.75, st.glow); group.add(sleeve);
  const outer = mk(st.rad * 1.0, st.rad * 1.35, st.glow * 0.4); group.add(outer);
  let halo = null;
  const gt = glowTex();
  if (gt) {
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: col.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, opacity: Math.min(1, st.glow + 0.15) }));
    halo.scale.setScalar(len * (visualType === 'staff' || visualType === 'sword' ? 1.15 : 1.5));
    group.add(halo);
  }
  const n = st.sparks, pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) seed.push({ a: Math.random() * 6.283, h: Math.random(), s: 0.7 + Math.random() * 0.6 });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: col.clone(), size: st.size, map: gt || null, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, sizeAttenuation: true }));
  pts.frustumCulled = false; group.add(pts);
  parent.add(group);
  rig.weaponAura = { key: rarityId + '|' + visualType, group, sleeve, outer, halo, pts, pos, seed, st, len, t: Math.random() * 10, col };
}

export function updateWeaponAura(a, dt) {
  if (!a || !a.group.parent || !a.group.parent.visible) return;
  const { st, len, pos, seed } = a;
  a.t += dt;
  const t = a.t, pulse = 0.78 + 0.22 * Math.sin(t * st.pulse);
  if (st.prism) a.col.setHSL((t * 0.35) % 1, 0.95, 0.62); else if (st.embers) a.col.setHex(st.color).offsetHSL(0, 0, 0.04 * Math.sin(t * 5));
  a.sleeve.material.color.copy(a.col); a.outer.material.color.copy(a.col); a.pts.material.color.copy(a.col); if (a.halo) a.halo.material.color.copy(a.col);
  a.sleeve.material.opacity = st.glow * pulse;
  a.outer.material.opacity = st.glow * 0.4 * (1.15 - pulse * 0.5);
  if (a.halo) a.halo.material.opacity = Math.min(1, (st.glow + 0.15) * (0.7 + 0.3 * pulse));
  for (let i = 0; i < seed.length; i++) {
    const sd = seed[i];
    sd.h += dt * st.rise * sd.s; if (sd.h > 1) { sd.h -= 1; sd.a = Math.random() * 6.283; }
    sd.a += dt * st.spin * sd.s;
    const r = st.rad * (st.embers ? 0.8 + 0.5 * sd.h : 1.1 + 0.3 * Math.sin(sd.h * 6.283));
    pos[i * 3] = Math.cos(sd.a) * r; pos[i * 3 + 1] = (sd.h - 0.5) * len * 1.15; pos[i * 3 + 2] = Math.sin(sd.a) * r;
  }
  a.pts.geometry.attributes.position.needsUpdate = true;
}
