import * as THREE from 'three';
import { spiralTexture, glowTexture, ringTexture, safeTexture } from '../visual/Textures.js';

// Construit un portail (arche de pierre + voile lumineux tournant) à une
// position donnée. Purement visuel + une zone de collision légère pour le
// repère — la téléportation elle-même est gérée par Game.js (vérifie le
// niveau requis, affiche un message si verrouillé).
export function buildPortal(world, pos, color, label, opts = {}) {
  const g = new THREE.Group();
  const [px, pz] = pos;
  const py = world.heightAt(px, pz);
  g.position.set(px, py, pz);
  world.group.add(g);

  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.95, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.4, 10), stone);
  base.position.y = 0.2;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.4, 8), stone);
    pillar.position.set(side * 1.1, 1.9, 0);
    pillar.castShadow = true;
    g.add(pillar);
  }
  const top = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.26, 8, 16, Math.PI), stone);
  top.position.y = 3.5;
  top.rotation.z = Math.PI;
  g.add(top);

  const veilMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const veil = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), veilMat);
  veil.position.set(0, 2.05, 0);
  g.add(veil);

  const fx = [veil];
  const glow = opts.noLight ? null : new THREE.PointLight(new THREE.Color(color), 1.4, 7, 2);
  if (glow) { glow.position.y = 2.05; g.add(glow); fx.push(glow); }

  world.addBox(px, pz, 1.9, 0.6, py - 1, py + 4);

  // V2.5 : vortex tournant, anneaux d'énergie, halo et étincelles en orbite
  let swirl = null, rings = [], orbs = [];
  try {
    if (world.v25) {
      const col = new THREE.Color(color);
      const sp = safeTexture(spiralTexture), gl = safeTexture(glowTexture, 64), rg = safeTexture(ringTexture);
      if (sp) {
        swirl = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ map: sp, color: col, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
        swirl.position.set(0, 2.05, 0.02);
        g.add(swirl); fx.push(swirl);
        veil.material.opacity = 0.3;
      }
      if (rg) for (let i = 0; i < 2; i++) {
        const r = new THREE.Mesh(new THREE.PlaneGeometry(2.9 + i * 0.5, 2.9 + i * 0.5), new THREE.MeshBasicMaterial({ map: rg, color: col, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
        r.position.set(0, 2.05, 0.05 + i * 0.03);
        g.add(r); rings.push(r); fx.push(r);
      }
      if (gl) {
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gl, color: col, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        halo.scale.setScalar(6.5); halo.position.set(0, 2.05, 0.2);
        g.add(halo); fx.push(halo);
        for (let i = 0; i < 14; i++) {
          const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: gl, color: col, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
          o.scale.setScalar(0.22 + Math.random() * 0.18);
          o.userData = { a: Math.random() * 6.28, r: 1.1 + Math.random() * 0.5, sp: 0.5 + Math.random() * 1.2 };
          g.add(o); orbs.push(o); fx.push(o);
        }
      }
    }
  } catch (e) { console.warn('[V2.5] portail classique', e); }

  return { group: g, veil, glow, swirl, rings, orbs, fx, pos: new THREE.Vector3(px, py, pz), label };
}

export function updatePortal(portal, dt) {
  if (portal.swirl) portal.swirl.rotation.z -= dt * 1.2;
  portal.rings?.forEach((r, i) => { r.rotation.z += dt * (i ? -0.8 : 0.6); r.scale.setScalar(1 + Math.sin(performance.now() * 0.002 + i) * 0.04); });
  portal.orbs?.forEach((o) => {
    const d = o.userData; d.a += dt * d.sp;
    o.position.set(Math.cos(d.a) * d.r, 2.05 + Math.sin(d.a) * d.r, 0.1);
    o.material.opacity = 0.6 + Math.sin(d.a * 3) * 0.35;
  });
  portal.veil.rotation.z += dt * 0.4;
  portal.veil.material.opacity = 0.45 + Math.sin(performance.now() * 0.002) * 0.1;
}
