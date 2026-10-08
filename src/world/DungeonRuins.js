import * as THREE from 'three';

// Construit "Les Cryptes oubliées" : une ruine à ciel ouvert (murs brisés en
// arc de cercle, une entrée, un piédestal central avec un coffre). Pas
// d'instanciation séparée façon "donjon fermé" pour ce prototype — la zone
// est simplement un point d'intérêt dense en ennemis au sein du monde ouvert.
export function buildDungeon(world, center = [-112, 42]) {
  const g = new THREE.Group();
  world.group.add(g);
  const [cx, cz] = center;
  const cy = world.heightAt(cx, cz);
  const stone = new THREE.MeshStandardMaterial({ color: 0x4d4d47, roughness: 1, flatShading: true });
  const mossy = new THREE.MeshStandardMaterial({ color: 0x3d4a38, roughness: 1, flatShading: true });
  const add = (geo, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };

  const R = 15, GAP = 0.6; // rayon de l'enceinte, ouverture pour l'entrée (sud)
  const segments = 20;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    // Laisse une ouverture orientée vers Aetheria (le donjon est à l'ouest de la ville)
    if (Math.cos(mid) > 0.3) continue;
    const broken = Math.random() < 0.3;
    const h = broken ? 1.2 + Math.random() * 1.2 : 3.2 + Math.random() * 1.4;
    const x = cx + Math.cos(mid) * R, z = cz + Math.sin(mid) * R;
    const y = world.heightAt(x, z);
    add(new THREE.BoxGeometry(3.4, h, 1.3), Math.random() < 0.4 ? mossy : stone, x, y + h / 2, z, mid + Math.PI / 2);
    world.addBox(x, z, 1.9, 0.9, y - 1, y + h);
    if (!broken && Math.random() < 0.5) {
      add(new THREE.DodecahedronGeometry(0.9, 0), stone, x + (Math.random() - 0.5), y + h + 0.5, z + (Math.random() - 0.5));
    }
  }

  // Deux piliers encadrant l'entrée (côté ville, vers +x)
  for (const side of [-1, 1]) {
    const a = side * 0.42;
    const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
    const y = world.heightAt(x, z);
    add(new THREE.CylinderGeometry(0.7, 0.9, 4.6, 8), stone, x, y + 2.3, z);
    world.addBox(x, z, 0.9, 0.9, y - 1, y + 4.6);
  }

  // Piédestal central + coffre
  const py = world.heightAt(cx, cz);
  add(new THREE.CylinderGeometry(2.2, 2.6, 1, 10), stone, cx, py + 0.5, cz);
  world.addCircle(cx, cz, 2.6);
  const chestGroup = new THREE.Group();
  chestGroup.position.set(cx, py + 1.05, cz);
  g.add(chestGroup);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.85 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.85), woodMat);
  base.position.y = 0.35;
  base.castShadow = true;
  chestGroup.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.5, 0.9), woodMat);
  lid.position.set(0, 0.72, -0.38);
  lid.rotation.x = -0.05;
  lid.castShadow = true;
  chestGroup.add(lid);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.08, 0.92), goldMat);
  trim.position.y = 0.72;
  chestGroup.add(trim);
  const glow = new THREE.PointLight(0xffcf6a, 1.4, 6, 2);
  glow.position.y = 1;
  chestGroup.add(glow);

  world.spots.dungeon = new THREE.Vector3(cx + R + 4, py, cz);
  return { pos: new THREE.Vector3(cx, py, cz), chest: { group: chestGroup, lid, glow, opened: false } };
}
