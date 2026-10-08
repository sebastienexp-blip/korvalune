import * as THREE from 'three';

// Bâton de mage (V3.2/V3.3). Repère local : Y = axe du bâton, la main tient à l'origine
// (pied du bâton à y = -0.55, cristal à y ≈ 1.26).
//  - fût effilé et noueux, poignée en cuir, bagues dorées, embout d'acier ;
//  - collier doré + 4 griffes courbes qui enserrent un cristal allongé ;
//  - 3 petites orbes en orbite et 2 anneaux d'énergie ; halo additif ;
//  - update(t, charge) : le cristal pulse, les orbes accélèrent et le halo grossit pendant l'incantation.
export function createStaff({ wood, gem, trim, leather, steel, glow, parent }) {
  const group = new THREE.Group();
  if (parent) parent.add(group);
  const mk = (geo, m, x = 0, y = 0, z = 0, p = group) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; p.add(me); return me; };

  // fût + nœuds
  mk(new THREE.CylinderGeometry(0.026, 0.034, 1.62, 8), wood, 0, 0.26, 0);
  for (const [y, s] of [[-0.25, 1], [0.48, 0.9], [0.8, 1.1]]) mk(new THREE.SphereGeometry(0.042 * s, 7, 5), wood, 0, y, 0).scale.set(1, 0.6, 1);
  // poignée en cuir + bagues
  mk(new THREE.CylinderGeometry(0.041, 0.041, 0.17, 8), leather, 0, 0, 0);
  for (const sy of [-1, 1]) mk(new THREE.TorusGeometry(0.041, 0.008, 4, 10).rotateX(Math.PI / 2), trim, 0, sy * 0.1, 0).castShadow = false;
  // embout
  mk(new THREE.ConeGeometry(0.036, 0.12, 6).rotateX(Math.PI), steel || trim, 0, -0.6, 0);
  // collier
  mk(new THREE.CylinderGeometry(0.052, 0.04, 0.07, 8), trim, 0, 1.06, 0);
  mk(new THREE.TorusGeometry(0.048, 0.01, 4, 10).rotateX(Math.PI / 2), trim, 0, 1.1, 0).castShadow = false;

  // griffes (4 tubes courbes autour du cristal)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.035, 1.08, 0), new THREE.Vector3(0.125, 1.2, 0), new THREE.Vector3(0.125, 1.36, 0), new THREE.Vector3(0.05, 1.47, 0)
  ]);
  const clawGeo = new THREE.TubeGeometry(curve, 8, 0.012, 5, false);
  for (let i = 0; i < 4; i++) { const c = mk(clawGeo, wood); c.rotation.y = (i / 4) * Math.PI * 2 + Math.PI / 4; c.castShadow = false; }

  // cristal
  const crystal = mk(new THREE.OctahedronGeometry(0.075, 0), gem, 0, 1.27, 0);
  crystal.scale.set(1, 1.7, 1);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  inner.scale.set(1, 1.7, 1); crystal.add(inner);

  // orbes + anneaux d'énergie
  const addMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const orbMat = addMat(0xbfe0ff, 0.95);
  const orbs = [];
  for (let i = 0; i < 3; i++) { const o = mk(new THREE.SphereGeometry(0.017, 6, 5), orbMat, 0, 1.27, 0); o.castShadow = false; orbs.push(o); }
  const ringGeo = new THREE.TorusGeometry(0.19, 0.005, 4, 24);
  const rings = [];
  for (let i = 0; i < 2; i++) { const r = mk(ringGeo, addMat(0x9fd0ff, 0.45), 0, 1.27, 0); r.castShadow = false; r.rotation.x = i ? 1.2 : 0.35; r.rotation.z = i ? 0.5 : 0; rings.push(r); }

  let halo = null;
  if (glow) {
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x6ab0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.setScalar(0.85);
    halo.position.set(0, 1.27, 0);
    group.add(halo);
  }
  const tip = new THREE.Object3D(); tip.position.set(0, 1.3, 0); group.add(tip);

  const staff = {
    group, tip, halo, crystal,
    // charge 0..1 : intensité de l'incantation
    update(t, charge = 0) {
      crystal.rotation.y = t * (0.9 + charge * 3);
      crystal.position.y = 1.27 + Math.sin(t * 2.2) * 0.012;
      const sp = 1.4 + charge * 5.5, rad = 0.2 - 0.05 * charge;
      for (let i = 0; i < 3; i++) {
        const a = t * sp + i * 2.094, tilt = 0.5 + i * 0.5;
        orbs[i].position.set(Math.cos(a) * rad, crystal.position.y + Math.sin(a) * rad * Math.sin(tilt), Math.sin(a) * rad * Math.cos(tilt));
      }
      rings[0].rotation.y = t * 0.8; rings[1].rotation.y = -t * 1.1;
      const rs = 1 - charge * 0.25;
      rings[0].scale.setScalar(rs); rings[1].scale.setScalar(rs);
      rings[0].material.opacity = 0.35 + charge * 0.4; rings[1].material.opacity = 0.3 + charge * 0.4;
      if (gem.emissiveIntensity !== undefined) gem.emissiveIntensity = 0.8 + charge * 1.8 + Math.sin(t * 3) * 0.1;
      if (halo) { halo.scale.setScalar(0.85 + charge * 1.2); halo.position.y = crystal.position.y; }
    }
  };
  staff.update(0, 0);
  return staff;
}
