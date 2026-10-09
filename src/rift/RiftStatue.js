import * as THREE from 'three';
import { glowTexture, ringTexture, runeTexture, stoneTexture, safeTexture } from '../visual/Textures.js';
import { buildPortal } from '../world/Portals.js';
import { makeLabel } from '../ui/Label.js';

// Statue de la Spire, sur la place de Korvalune (ouest, près de l'entrée sud) :
// un Veilleur de pierre qui tend un orbe d'éther. Quand une spire est ouverte, un portail
// apparaît à côté et l'orbe s'embrase.
export const STATUE_POS = [-10, 24.5];
export const STATUE_PORTAL_POS = [-10, 31.7];

export function buildRiftStatue(world) {
  const g = new THREE.Group();
  const [sx, sz] = STATUE_POS;
  const sy = world.heightAt(sx, sz);
  g.position.set(sx, sy, sz);
  world.group.add(g);

  const stoneTex = safeTexture(stoneTexture);
  const stone = new THREE.MeshStandardMaterial({ color: 0xa8a49a, map: stoneTex || null, roughness: 0.92, flatShading: !stoneTex });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6b675f, roughness: 0.95, flatShading: true });
  const aether = new THREE.MeshBasicMaterial({ color: 0x5ee6d0, fog: false });
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // socle à trois degrés
  add(new THREE.CylinderGeometry(3.0, 3.3, 0.35, 16), stone, 0, 0.175, 0);
  add(new THREE.CylinderGeometry(2.3, 2.6, 0.35, 16), stone, 0, 0.525, 0);
  add(new THREE.CylinderGeometry(1.5, 1.75, 0.9, 12), dark, 0, 1.15, 0);
  // runes gravées autour du socle
  const ringTex = safeTexture(ringTexture), runeTex = safeTexture(runeTexture);
  let ring = null, rune = null;
  if (ringTex) { ring = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: ringTex, color: 0x5ee6d0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring); }
  if (runeTex) { rune = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: runeTex, color: 0x5ee6d0, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.06; g.add(rune); }

  // silhouette du Veilleur : jambes, torse, épaulières, cape, tête casquée, bras levés
  const py = 1.6;
  add(new THREE.CylinderGeometry(0.34, 0.4, 1.5, 8), stone, -0.3, py + 0.75, 0);
  add(new THREE.CylinderGeometry(0.34, 0.4, 1.5, 8), stone, 0.3, py + 0.75, 0.05);
  add(new THREE.CylinderGeometry(0.62, 0.52, 1.5, 10), stone, 0, py + 2.2, 0);
  add(new THREE.BoxGeometry(1.5, 0.28, 0.7), dark, 0, py + 1.5, 0);          // ceinture
  for (const s of [-1, 1]) {
    const sh = add(new THREE.SphereGeometry(0.46, 10, 8), dark, s * 0.82, py + 2.85, 0);
    sh.scale.set(1, 0.7, 1);
    // bras levés vers l'orbe
    const arm = add(new THREE.CylinderGeometry(0.17, 0.2, 1.5, 7), stone, s * 0.95, py + 3.5, 0.18);
    arm.rotation.z = -s * 0.35; arm.rotation.x = -0.25;
  }
  const cape = add(new THREE.BoxGeometry(1.3, 2.3, 0.14), dark, 0, py + 1.85, -0.48);
  cape.rotation.x = 0.12;
  add(new THREE.SphereGeometry(0.4, 10, 8), stone, 0, py + 3.2, 0);            // tête
  const helm = add(new THREE.ConeGeometry(0.34, 0.7, 8), dark, 0, py + 3.65, 0); helm.rotation.y = 0.4;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.05, 0.05), aether, s * 0.14, py + 3.25, 0.37);   // yeux d'éther

  // orbe d'éther flottant + halo
  const orbY = py + 5.1;
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), aether);
  orb.position.set(0, orbY, 0.3);
  g.add(orb);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  core.position.copy(orb.position); g.add(core);
  const glowTex = safeTexture(glowTexture, 64);
  let halo = null;
  if (glowTex) {
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5ee6d0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.setScalar(4.2); halo.position.copy(orb.position); g.add(halo);
  }
  try {
    const lb = makeLabel('Statue de la Spire', { color: '#5ee6d0', size: 40, width: 640, height: 96, scale: 4.2 });
    lb.position.set(0, py + 7.2, 0); g.add(lb);
  } catch (e) { /* étiquette ignorée */ }

  world.addCircle(sx, sz, 3.0);

  // portail de la spire (fermé tant qu'aucune spire n'est ouverte) — sans PointLight pour ne pas recompiler les shaders
  const portal = buildPortal(world, STATUE_PORTAL_POS, '#5ee6d0', 'Spire', { noLight: true });
  portal.open = false;
  portal.fx.forEach((o) => { o.visible = false; });
  let portalLabel = null;
  try {
    portalLabel = makeLabel('Spire ouverte', { color: '#5ee6d0', size: 38, width: 640, height: 96, scale: 4 });
    portalLabel.position.set(0, 5.1, 0.2);
    portalLabel.visible = false;
    portal.group.add(portalLabel);
  } catch (e) { /* ignoré */ }

  const statue = {
    group: g, portal, pos: new THREE.Vector3(sx, sy, sz), glow: 0, targetGlow: 0, t: 0,
    setPortalOpen(open, text) {
      portal.open = open; portal.fx.forEach((o) => { o.visible = open; }); statue.targetGlow = open ? 1 : 0;
      if (portalLabel) portalLabel.visible = open;
      if (open && text) {
        if (portalLabel) { portal.group.remove(portalLabel); portalLabel.material?.map?.dispose?.(); portalLabel.material?.dispose?.(); }
        try { portalLabel = makeLabel(text, { color: '#5ee6d0', size: 36, width: 768, height: 96, scale: 4.4 }); portalLabel.position.set(0, 5.1, 0.2); portal.group.add(portalLabel); } catch (e) { portalLabel = null; }
      }
    },
    update(dt) {
      statue.t += dt;
      statue.glow += (statue.targetGlow - statue.glow) * Math.min(1, dt * 3);
      const bob = Math.sin(statue.t * 1.6) * 0.12;
      orb.position.y = orbY + bob; core.position.y = orbY + bob;
      orb.rotation.y += dt * (0.6 + statue.glow * 2.2); orb.rotation.x += dt * 0.3;
      core.rotation.y -= dt * 1.4;
      const s = 0.9 + statue.glow * 0.5 + Math.sin(statue.t * 3) * 0.05;
      orb.scale.setScalar(s);
      if (halo) { halo.position.y = orbY + bob; halo.material.opacity = 0.35 + statue.glow * 0.5 + Math.sin(statue.t * 3) * 0.06; halo.scale.setScalar(3.6 + statue.glow * 2.4); }
      if (ring) ring.rotation.z += dt * 0.12;
      if (rune) { rune.rotation.z -= dt * 0.2; rune.material.opacity = 0.35 + statue.glow * 0.45; }
    }
  };
  return statue;
}
