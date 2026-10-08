import * as THREE from 'three';

// Copie de la version V2 (modèle simple) : utilisée uniquement en secours si le modèle V2.5 échoue.
export function createCreatureLegacy(opts = {}) {
  const o = { fur: 0x6b6b72, belly: 0x9a9aa2, eye: 0xffc040, scale: 1, bodyLen: 1, snout: 0.3, tusks: false, ...opts };
  const fur = new THREE.MeshStandardMaterial({ color: o.fur, roughness: 1, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: o.belly, roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141112, roughness: 0.6 });
  const eye = new THREE.MeshStandardMaterial({ color: o.eye, emissive: o.eye, emissiveIntensity: 1.2 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.6 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(o.scale);
  root.add(body);
  const L = o.bodyLen;
  const add = (geo, m, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const sph = new THREE.SphereGeometry(1, 10, 8);

  add(sph, fur, body, 0, 0.72, 0, 0.3, 0.32, 0.62 * L);
  add(sph, fur, body, 0, 0.78, 0.36 * L, 0.33, 0.37, 0.34);
  add(sph, belly, body, 0, 0.6, 0.05, 0.22, 0.2, 0.5 * L);

  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.82 * L);
  body.add(head);
  add(sph, fur, head, 0, 0, 0, 0.2, 0.19, 0.24);
  add(sph, fur, head, 0, -0.03, 0.2, 0.11, 0.1, o.snout);
  add(sph, dark, head, 0, -0.01, 0.2 + o.snout, 0.04, 0.035, 0.04);
  const earGeo = new THREE.ConeGeometry(0.06, 0.18, 4);
  add(earGeo, fur, head, 0.11, 0.2, -0.03);
  add(earGeo, fur, head, -0.11, 0.2, -0.03);
  add(sph, eye, head, 0.09, 0.05, 0.15, 0.03, 0.03, 0.03);
  add(sph, eye, head, -0.09, 0.05, 0.15, 0.03, 0.03, 0.03);
  if (o.tusks) {
    const tusk = new THREE.ConeGeometry(0.03, 0.2, 6);
    const a = add(tusk, bone, head, 0.09, -0.06, 0.24); a.rotation.x = -0.6;
    const b = add(tusk, bone, head, -0.09, -0.06, 0.24); b.rotation.x = -0.6;
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.8, -0.6 * L);
  body.add(tail);
  const t = add(new THREE.ConeGeometry(0.07, 0.55, 6), fur, tail, 0, -0.1, -0.2);
  t.rotation.x = -2.2;

  const legs = [];
  for (const [sx, sz] of [[1, 0.36], [-1, 0.36], [1, -0.36], [-1, -0.36]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.19, 0.6, sz * L);
    body.add(pivot);
    add(new THREE.CapsuleGeometry(0.055, 0.42, 4, 6), fur, pivot, 0, -0.3, 0);
    add(sph, dark, pivot, 0, -0.58, 0.03, 0.07, 0.04, 0.09);
    legs.push(pivot);
  }
  return { root, body, head, tail, legs, fur, phase: 0, k: 0, t: 0, hurtT: 0 };
}

