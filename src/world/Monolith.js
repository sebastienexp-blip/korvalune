import * as THREE from 'three';
import { glowTexture, safeTexture } from '../visual/Textures.js';

// V10.19 — Le Monolithe des Métamorphoses (statue interactive) et le décor de la forge. Léger : quelques maillages, aucune lumière dynamique.

/** Statue : socle de pierre, stèle sombre gravée de runes lumineuses, cristal flottant. Retourne un « rig » compatible NPC. */
export function buildMonolith() {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5d6b, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23242f, roughness: 0.6, metalness: 0.25 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.9 });
  const add = (geo, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(new THREE.CylinderGeometry(1.5, 1.8, 0.35, 8), stone, 0, 0.17, 0);
  add(new THREE.CylinderGeometry(1.1, 1.3, 0.3, 8), stone, 0, 0.5, 0);
  const stele = add(new THREE.BoxGeometry(0.9, 2.5, 0.55), dark, 0, 1.9, 0);
  stele.geometry.translate(0, 0, 0);
  const runes = [];
  for (let i = 0; i < 6; i++) { // runes lumineuses gravées sur la stèle (face avant)
    const r = add(new THREE.BoxGeometry(i % 2 ? 0.32 : 0.2, 0.06, 0.02), glowMat.clone(), (i % 2 ? 0.0 : -0.12), 1.15 + i * 0.36, 0.285);
    runes.push(r);
  }
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x7fd8ff, emissive: 0x2a9fe0, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 });
  const crystal = add(new THREE.OctahedronGeometry(0.42, 0), crystalMat, 0, 3.55, 0);
  crystal.scale.set(0.8, 1.3, 0.8);
  const ring = add(new THREE.TorusGeometry(0.65, 0.025, 6, 24), glowMat.clone(), 0, 3.55, 0);
  ring.rotation.x = Math.PI / 2.4;
  const ring2 = add(new THREE.TorusGeometry(0.85, 0.02, 6, 24), glowMat.clone(), 0, 3.55, 0);
  ring2.rotation.x = -Math.PI / 2.8;
  let halo = null;
  try {
    const tex = safeTexture(glowTexture, 64);
    if (tex) { halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x6fd0ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(3.2, 3.2, 1); halo.position.set(0, 3.55, 0); root.add(halo); }
  } catch { /* halo facultatif */ }
  const head = new THREE.Object3D(); root.add(head);
  let t = Math.random() * 10;
  return {
    root, head, lookScale: 1.55, isProp: true,
    update(dt) {
      t += dt;
      crystal.rotation.y += dt * 0.9;
      crystal.position.y = 3.55 + Math.sin(t * 1.4) * 0.12;
      ring.rotation.z += dt * 0.7; ring2.rotation.z -= dt * 0.5;
      ring.position.y = ring2.position.y = crystal.position.y;
      if (halo) { halo.position.y = crystal.position.y; halo.material.opacity = 0.45 + 0.2 * Math.sin(t * 2.2); }
      runes.forEach((r, i) => { r.material.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.9)); });
    }
  };
}

/** Décor de forge : enclume, brasier incandescent, râtelier d'outils. Posé à côté de la forgeronne. */
export function buildForgeDecor(scene, world, x, z, rotY = 0) {
  const g = new THREE.Group();
  const y = world.heightAt(x, z);
  g.position.set(x, y, z); g.rotation.y = rotY;
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2e36, roughness: 0.5, metalness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.95 });
  const add = (geo, mat, px, py, pz, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); parent.add(m); return m; };
  // enclume sur un billot
  add(new THREE.CylinderGeometry(0.34, 0.4, 0.7, 10), wood, 1.5, 0.35, 0.2);
  add(new THREE.BoxGeometry(0.9, 0.22, 0.38), iron, 1.5, 0.82, 0.2);
  add(new THREE.BoxGeometry(0.5, 0.2, 0.3), iron, 1.5, 0.64, 0.2).scale.set(1, 0.6, 1);
  add(new THREE.ConeGeometry(0.16, 0.4, 8), iron, 2.1, 0.86, 0.2).rotation.z = -Math.PI / 2;
  // forge : coffre de pierre avec braises
  add(new THREE.BoxGeometry(1.4, 0.85, 1.0), stone, -0.9, 0.42, 0);
  const coal = add(new THREE.BoxGeometry(1.1, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0xff6a1a }), -0.9, 0.88, 0);
  add(new THREE.BoxGeometry(0.5, 1.7, 0.5), stone, -1.25, 1.55, -0.25); // conduit
  // outils appuyés
  for (let i = 0; i < 3; i++) { const h = add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), wood, -0.1 + i * 0.12, 0.55, -0.55); h.rotation.z = 0.15 - i * 0.12; add(new THREE.BoxGeometry(0.2, 0.12, 0.08), iron, -0.1 + i * 0.12 + (0.15 - i * 0.12) * -0.55, 1.08, -0.55); }
  let glow = null;
  try {
    const tex = safeTexture(glowTexture, 64);
    if (tex) { glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff7a2a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(2.2, 2.2, 1); glow.position.set(-0.9, 1.1, 0); g.add(glow); }
  } catch { /* facultatif */ }
  scene.add(g);
  let t = 0;
  return { group: g, update(dt) { t += dt; const k = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 3.1); coal.material.color.setRGB(1, 0.36 * k, 0.08); if (glow) glow.material.opacity = 0.45 + 0.3 * k; } };
}
