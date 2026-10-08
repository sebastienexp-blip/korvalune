import * as THREE from 'three';

// Arc réaliste (V3.2). Repère local de l'arc : Y = axe des branches (haut),
// Z = direction de tir (vers la cible), la corde est du côté -Z (vers l'archer).
//  - branches à profil effilé + poignée épaisse (riser), recourbées vers l'archer
//    avec pointes qui repartent vers l'avant (recurve) ;
//  - la géométrie des branches est recalculée quand l'arc se bande (flexion) ;
//  - corde en deux segments qui se rejoignent au point d'encoche (suit la main) ;
//  - flèche encochée complète (fût, pointe acier, plumes, encoche).
const SEG = 30;        // segments le long de l'arc
const RAD = 8;         // sections radiales
const HL = 0.5;        // demi-longueur de l'arc
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function centerline(t, flex) {
  const u = Math.abs(t);
  const y = t * HL;
  const z = -(0.2 + 0.13 * flex) * u * u + 0.085 * Math.pow(sstep(0.68, 1, u), 2);
  const x = -0.026 * (1 - sstep(0.14, 0.85, u)); // fenêtre : l'arc est légèrement décalé du plan de la corde
  return [x, y, z];
}
const radX = (u) => 0.0265 + (0.0105 - 0.0265) * sstep(0.06, 0.4, u) - 0.003 * sstep(0.4, 1, u);
const radZ = (u) => 0.026 + (0.0095 - 0.026) * sstep(0.05, 0.42, u) - 0.0025 * sstep(0.42, 1, u);

function buildLimbGeometry() {
  const geo = new THREE.BufferGeometry();
  const rows = SEG + 1, cols = RAD + 1;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
  const idx = [];
  for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
    const a = i * cols + j, b = (i + 1) * cols + j, c = (i + 1) * cols + j + 1, d = i * cols + j + 1;
    idx.push(a, b, d, b, c, d);
  }
  geo.setIndex(idx);
  return geo;
}

function fillLimb(geo, flex) {
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
  const cols = RAD + 1;
  const e = 0.004;
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * 2 - 1;
    const c = centerline(t, flex);
    const c2 = centerline(Math.min(1, t + e), flex), c1 = centerline(Math.max(-1, t - e), flex);
    let ty = c2[1] - c1[1], tz = c2[2] - c1[2];
    const tl = Math.hypot(ty, tz) || 1; ty /= tl; tz /= tl;
    const ny = -tz, nz = ty; // normale dans le plan YZ
    const u = Math.abs(t);
    const rx = radX(u), rz = radZ(u);
    for (let j = 0; j <= RAD; j++) {
      const th = (j / RAD) * Math.PI * 2;
      const cs = Math.cos(th), sn = Math.sin(th);
      const k = (i * cols + j) * 3;
      pos[k] = c[0] + cs * rx;
      pos[k + 1] = c[1] + ny * sn * rz;
      pos[k + 2] = c[2] + nz * sn * rz;
      let nx = cs / rx, nyy = (sn / rz) * ny, nzz = (sn / rz) * nz;
      const nl = Math.hypot(nx, nyy, nzz) || 1;
      nor[k] = nx / nl; nor[k + 1] = nyy / nl; nor[k + 2] = nzz / nl;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.normal.needsUpdate = true;
  geo.computeBoundingSphere();
}

export function createBow({ wood, trim, leather, steel, parent }) {
  const group = new THREE.Group();
  if (parent) parent.add(group);
  const mk = (geo, m, p = group) => { const me = new THREE.Mesh(geo, m); me.castShadow = true; p.add(me); return me; };

  // branches
  const limbGeo = buildLimbGeometry();
  fillLimb(limbGeo, 0);
  const limbs = mk(limbGeo, wood);
  limbs.frustumCulled = false;

  // poignée en cuir + bagues dorées + repose-flèche
  const grip = mk(new THREE.CylinderGeometry(0.031, 0.031, 0.14, 10), leather);
  grip.position.set(-0.026, 0, 0.004);
  for (const sy of [-1, 1]) {
    const ring = mk(new THREE.TorusGeometry(0.031, 0.006, 4, 10), trim);
    ring.rotation.x = Math.PI / 2; ring.position.set(-0.026, sy * 0.082, 0.004);
  }
  const rest = mk(new THREE.BoxGeometry(0.018, 0.03, 0.03), trim);
  rest.position.set(-0.004, 0.065, 0.02);
  // pointes (encoches en os) + petits ornements
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.6 });
  const tipTop = mk(new THREE.SphereGeometry(0.0125, 6, 5), boneMat);
  const tipBot = mk(new THREE.SphereGeometry(0.0125, 6, 5), boneMat);

  // corde : deux segments (haut/bas) reliés au point d'encoche
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.6 });
  const segGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4);
  const sUp = mk(segGeo, stringMat), sDn = mk(segGeo, stringMat);
  sUp.castShadow = sDn.castShadow = false;
  // pontage de la corde (enroulement au centre)
  const serving = mk(new THREE.CylinderGeometry(0.0065, 0.0065, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.8 }));
  serving.castShadow = false;

  // flèche encochée
  const arrow = new THREE.Group();
  group.add(arrow);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd8b078, roughness: 0.65 });
  const shaft = mk(new THREE.CylinderGeometry(0.0072, 0.0072, 0.86, 6), shaftMat, arrow);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.43; shaft.castShadow = false;
  const head = mk(new THREE.ConeGeometry(0.019, 0.07, 4), steel || shaftMat, arrow);
  head.rotation.x = Math.PI / 2; head.position.z = 0.895; head.scale.set(1, 1, 0.45); head.castShadow = false;
  const featherMat = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8, side: THREE.DoubleSide });
  const cockMat = new THREE.MeshStandardMaterial({ color: 0xb02a2a, roughness: 0.8, side: THREE.DoubleSide });
  const vaneGeo = new THREE.BoxGeometry(0.003, 0.028, 0.11);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const v = mk(vaneGeo, i === 0 ? cockMat : featherMat, arrow);
    v.position.set(Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0.085);
    v.rotation.z = a - Math.PI / 2; v.castShadow = false;
  }
  const nock = mk(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 }), arrow);
  nock.rotation.x = Math.PI / 2; nock.position.z = 0.005; nock.castShadow = false;
  arrow.visible = false;

  const Y = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpD = new THREE.Vector3(), nockP = new THREE.Vector3();
  const seg = (mesh, a, b) => {
    tmpD.subVectors(b, a);
    const len = tmpD.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(tmpD, 0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(Y, tmpD.multiplyScalar(1 / len));
  };

  const st = { flex: -1, nz: 1, vx: 99 };
  const bow = {
    group, arrow, limbs, tips: { top: tipTop, bot: tipBot },
    // flex 0..1 (arc bandé), nockZ (≤ 0, position de l'encoche sur l'axe de tir), vib (décalage latéral de la corde)
    update(flex, nockZ, vib = 0, arrowOn = false) {
      if (Math.abs(flex - st.flex) > 0.003) { st.flex = flex; fillLimb(limbGeo, flex); }
      const top = centerline(1, flex), bot = centerline(-1, flex);
      tipTop.position.set(0, top[1] + 0.004, top[2]); tipBot.position.set(0, bot[1] - 0.004, bot[2]);
      tmpA.set(0, top[1], top[2]);
      tmpB.set(0, bot[1], bot[2]);
      nockP.set(vib, 0, nockZ);
      seg(sUp, tmpA, nockP); seg(sDn, tmpB, nockP);
      serving.position.set(vib, 0, nockZ); serving.rotation.set(0, 0, 0);
      arrow.visible = arrowOn;
      if (arrowOn) arrow.position.set(vib, 0, nockZ);
    }
  };
  bow.update(0, -0.12, 0, false);
  return bow;
}
