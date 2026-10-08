import * as THREE from 'three';
import { plasterTexture, roofTexture, stoneTexture, glowTexture, barkTexture, safeTexture } from '../visual/Textures.js';

const HOUSES = [
  { x: -15, z: -9, w: 7, d: 6, h: 4.2, wall: 0xc8b596, roof: 0x7a2e2a },
  { x: 15, z: -9, w: 7, d: 6, h: 4.6, wall: 0xb9a58a, roof: 0x3f5b72 },
  { x: -17, z: 5, w: 6, d: 7, h: 4, wall: 0xd0c2a2, roof: 0x8a4a2a },
  { x: 17, z: 5, w: 6, d: 7, h: 4.4, wall: 0xc2b090, roof: 0x6a2f2f },
  { x: 0, z: -17, w: 11, d: 7, h: 5.8, wall: 0xb8a382, roof: 0x5a2a26 }, // auberge
  { x: -11, z: 15, w: 5.5, d: 5, h: 3.8, wall: 0xcbbb9b, roof: 0x4a5f3a },
  { x: 11, z: 15, w: 5.5, d: 5, h: 3.8, wall: 0xc6b594, roof: 0x7a4a2a },
  // V3.3 : quartiers ouest/est, rue du sud et bâtiments de guilde (la ville est plus grande)
  { x: -30, z: -10, w: 7, d: 6, h: 4.4, wall: 0xc9b898, roof: 0x6a3a2a },
  { x: 30, z: -10, w: 7, d: 6, h: 4.2, wall: 0xbfae90, roof: 0x3f5b72 },
  { x: -31, z: 6, w: 6, d: 7, h: 4, wall: 0xd0c2a2, roof: 0x4a5f3a },
  { x: 31, z: 6, w: 6, d: 7, h: 4.6, wall: 0xc2b090, roof: 0x7a2e2a },
  { x: -29, z: 21, w: 6, d: 6, h: 3.8, wall: 0xcbbb9b, roof: 0x8a4a2a },
  { x: 29, z: 21, w: 6, d: 6, h: 3.8, wall: 0xc6b594, roof: 0x5a2a26 },
  { x: -19, z: 27, w: 6, d: 5.5, h: 3.8, wall: 0xc8b596, roof: 0x4a5f3a },
  { x: 19, z: 27, w: 6, d: 5.5, h: 3.8, wall: 0xb9a58a, roof: 0x7a4a2a },
  { x: -29, z: -22, w: 10, d: 7, h: 6.2, wall: 0xb8a382, roof: 0x3a4a6a },
  { x: 29, z: -22, w: 10, d: 7, h: 5.8, wall: 0xc0ad8c, roof: 0x6a2f2f }
];

// Construit Korvalune : maisons, puits, étals, torches, portail.
export function buildTown(world) {
  const g = new THREE.Group();
  world.group.add(g);
  const V = !!world.v25;
  const T = V ? {
    plaster: safeTexture(plasterTexture, true), roof: safeTexture(roofTexture), stone: safeTexture(stoneTexture), bark: safeTexture(barkTexture), glow: safeTexture(glowTexture, 64)
  } : {};
  if (T.plaster) T.plaster.repeat.set(2, 1.4);
  if (T.roof) T.roof.repeat.set(0.45, 0.45);
  if (T.stone) T.stone.repeat.set(1.6, 1.2);
  if (T.bark) T.bark.repeat.set(1, 2);
  const stone = new THREE.MeshStandardMaterial({ color: T.stone ? 0xb0aca0 : 0x8a8578, map: T.stone || null, roughness: 0.95, flatShading: !T.stone });
  const wood = new THREE.MeshStandardMaterial({ color: T.bark ? 0x8a6a48 : 0x5a3d24, map: T.bark || null, roughness: 0.9 });
  world.chimneys = world.chimneys || [];
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  for (const H of HOUSES) {
    if (V && T.plaster && T.roof) {
      try { houseV25(world, g, H, T, stone, wood, add); continue; } catch (e) { console.warn('[V2.5] maison classique utilisée', e); }
    }
    const y = world.heightAt(H.x, H.z);
    const wall = new THREE.MeshStandardMaterial({ color: H.wall, roughness: 0.9 });
    const roof = new THREE.MeshStandardMaterial({ color: H.roof, roughness: 0.85, flatShading: true });
    add(new THREE.BoxGeometry(H.w + 0.4, 0.7, H.d + 0.4), stone, H.x, y + 0.35, H.z);
    add(new THREE.BoxGeometry(H.w, H.h, H.d), wall, H.x, y + H.h / 2 + 0.3, H.z);
    const roofGeo = new THREE.ConeGeometry(1, H.h * 0.6, 4);
    roofGeo.rotateY(Math.PI / 4);
    const r = add(roofGeo, roof, H.x, y + H.h + 0.3 + H.h * 0.3, H.z);
    r.scale.set((H.w / 2 + 0.6) * Math.SQRT2, 1, (H.d / 2 + 0.6) * Math.SQRT2);
    add(new THREE.BoxGeometry(1.2, 2.1, 0.2), wood, H.x, y + 1.35, H.z + H.d / 2 + 0.05);
    for (const sx of [-1, 1]) {
      const win = add(new THREE.BoxGeometry(0.9, 0.9, 0.12), world.windowMat, H.x + sx * H.w * 0.3, y + H.h * 0.6, H.z + H.d / 2 + 0.02);
      win.castShadow = false;
    }
    add(new THREE.BoxGeometry(0.7, 1.6, 0.7), stone, H.x + H.w * 0.28, y + H.h + 0.9, H.z - H.d * 0.2);
    world.addBox(H.x, H.z, H.w / 2 + 0.2, H.d / 2 + 0.2, y - 1, y + H.h + 1);
  }

  // Puits central
  const wy = world.heightAt(0, 0);
  add(new THREE.CylinderGeometry(1.5, 1.7, 1, 16), stone, 0, wy + 0.5, 0);
  add(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x2f6f96, roughness: 0.1, metalness: 0.2 }), 0, wy + 0.95, 0);
  for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), wood, sx * 1.3, wy + 2.1, 0);
  const wroof = add(new THREE.ConeGeometry(1.9, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x6a2f2f, flatShading: true }), 0, wy + 3.6, 0);
  wroof.rotation.y = Math.PI / 4;
  world.addCircle(0, 0, 1.9);

  // Étals de marché
  for (const [sx, sz, c] of [[-7.5, -4, 0xb03030], [7.5, -5, 0x2f5f9a], [-6, 5, 0xc09030]]) {
    const y = world.heightAt(sx, sz);
    add(new THREE.BoxGeometry(2.6, 0.9, 1.2), wood, sx, y + 0.45, sz);
    const canopy = add(new THREE.BoxGeometry(3.0, 0.1, 1.8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }), sx, y + 2.2, sz);
    canopy.rotation.x = 0.15;
    for (const px of [-1.3, 1.3]) add(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), wood, sx + px, y + 1.1, sz - 0.6);
    world.addBox(sx, sz, 1.4, 0.7, y - 1, y + 2.5);
  }

  // Portail sud + torches
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa83a, fog: false });
  const torchSpots = [[-4.2, 36], [4.2, 36], [-4, -3.2], [4, 3.2], [-21, -27], [21, -27], [-24, 0], [24, 0]];
  for (const [tx, tz] of torchSpots) {
    const y = world.heightAt(tx, tz);
    if (tz > 30) {
      add(new THREE.BoxGeometry(1.3, 5, 1.3), stone, tx, y + 2.5, tz);
      world.addBox(tx, tz, 0.65, 0.65, y - 1, y + 5);
    }
    // V6.1 : torches supprimées (ni flamme, ni lumière, ni fumée) ; seuls les piliers du portail restent
  }
  add(new THREE.BoxGeometry(9.5, 1.2, 1.3), stone, 0, world.heightAt(0, 36) + 5.2, 36).castShadow = true;

  world.spots.spawn = new THREE.Vector3(0, 0, 12);
  world.spots.guard = new THREE.Vector3(6, 0, 33);

  // Coffre de banque (stockage partagé, pages multiples) près du puits.
  const bx = 2.5, bz = -2.5, by = world.heightAt(bx, bz);
  const bankGroup = new THREE.Group();
  bankGroup.position.set(bx, by + 0.42, bz);
  g.add(bankGroup);
  const bankWood = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.85 });
  const bankTrim = new THREE.MeshStandardMaterial({ color: 0x8a6a30, roughness: 0.4, metalness: 0.5 });
  const bBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.72), bankWood);
  bBase.position.y = 0.3;
  bBase.castShadow = true;
  bankGroup.add(bBase);
  const bLid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.42, 0.76), bankWood);
  bLid.position.set(0, 0.62, -0.32);
  bLid.rotation.x = -0.05;
  bLid.castShadow = true;
  bankGroup.add(bLid);
  const bTrim = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.07, 0.78), bankTrim);
  bTrim.position.y = 0.62;
  bankGroup.add(bTrim);
  const bGlow = new THREE.PointLight(0x6ab0ff, 1.1, 5, 2);
  bGlow.position.y = 0.9;
  bankGroup.add(bGlow);
  add(new THREE.CylinderGeometry(1.5, 1.7, 0.1, 16), stone, bx, by + 0.05, bz);
  world.addBox(bx, bz, 0.9, 0.7, by - 1, by + 1.3);

  try { buildCityLayout(world, g, T, stone, wood, add); } catch (e) { console.warn('[V3.3] remparts ignorés', e); }
  if (V) { try { decorateTown(world, g, T, stone, wood, add); } catch (e) { console.warn('[V2.5] décor du village ignoré', e); } }

  world.spots.bank = new THREE.Vector3(bx, by, bz + 1.6);
  return { bankPos: new THREE.Vector3(bx, by, bz), bankChest: { group: bankGroup, lid: bLid } };
}


// ---------------------------------------------------------------------------
// V2.5 : maison à colombages, toit à pignons texturé, cheminée, volets, jardinières
function houseV25(world, g, H, T, stone, wood, add) {
  const y = world.heightAt(H.x, H.z);
  const wallMat = new THREE.MeshStandardMaterial({ color: H.wall, map: T.plaster, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: H.roof, map: T.roof, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x4d3523, roughness: 0.9 });
  const mk = (geo, mat, x, yy, z, parent = g) => add(geo, mat, x, yy, z, parent);

  mk(new THREE.BoxGeometry(H.w + 0.5, 0.8, H.d + 0.5), stone, H.x, y + 0.4, H.z);
  mk(new THREE.BoxGeometry(H.w, H.h, H.d), wallMat, H.x, y + H.h / 2 + 0.3, H.z);
  // coins en bois
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mk(new THREE.BoxGeometry(0.28, H.h + 0.1, 0.28), trim, H.x + sx * H.w / 2, y + H.h / 2 + 0.3, H.z + sz * H.d / 2);
  }
  // toit à pignons
  const alongX = H.w >= H.d;
  const span = alongX ? H.d : H.w, len = alongX ? H.w : H.d;
  const o = 0.5, rh = span * 0.62;
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2 - o, 0); shape.lineTo(span / 2 + o, 0); shape.lineTo(0, rh); shape.closePath();
  const rg = new THREE.ExtrudeGeometry(shape, { depth: len + o * 2, bevelEnabled: false });
  rg.translate(0, 0, -(len + o * 2) / 2);
  const roof = new THREE.Mesh(rg, [wallMat, roofMat]);
  roof.position.set(H.x, y + H.h + 0.3, H.z);
  if (alongX) roof.rotation.y = Math.PI / 2;
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);
  // faîtage
  const ridge = mk(new THREE.BoxGeometry(alongX ? len + o * 2 + 0.2 : 0.22, 0.16, alongX ? 0.22 : len + o * 2 + 0.2), trim, H.x, y + H.h + 0.3 + rh, H.z);
  ridge.castShadow = false;

  // cheminée
  const cx = H.x + H.w * 0.28, cz = H.z - H.d * 0.2, cy = y + H.h + rh * 0.55;
  mk(new THREE.BoxGeometry(0.85, 2.0, 0.85), stone, cx, cy, cz);
  mk(new THREE.BoxGeometry(1.05, 0.18, 1.05), stone, cx, cy + 1.05, cz);
  world.chimneys.push({ x: cx, y: cy + 1.25, z: cz });

  // porte voûtée
  const fz = H.z + H.d / 2;
  mk(new THREE.BoxGeometry(1.25, 1.75, 0.2), wood, H.x, y + 0.3 + 0.875, fz + 0.04);
  const arch = new THREE.CylinderGeometry(0.625, 0.625, 0.2, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  mk(arch, wood, H.x, y + 0.3 + 1.75, fz + 0.04);
  mk(new THREE.BoxGeometry(1.7, 0.18, 0.16), stone, H.x, y + 0.34, fz + 0.12); // seuil
  mk(new THREE.BoxGeometry(1.9, 0.18, 0.5), stone, H.x, y + 0.2, fz + 0.4); // marche
  // poignée
  mk(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshStandardMaterial({ color: 0xc9a74a, metalness: 0.8, roughness: 0.3 }), H.x + 0.4, y + 1.2, fz + 0.17);

  // fenêtres (faces avant et côtés) avec cadres, volets, jardinières
  const flowerCols = [0xff6a8a, 0xffd83a, 0xffffff, 0xb07aff];
  const winAt = (px, pz, ry, withBox) => {
    const grp = new THREE.Group();
    grp.position.set(px, y + H.h * 0.62, pz);
    grp.rotation.y = ry;
    g.add(grp);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.12), trim); frame.castShadow = true; grp.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.14), world.windowMat); grp.add(glass);
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.16), trim), bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.16), trim);
    grp.add(bar1, bar2);
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.05), new THREE.MeshStandardMaterial({ color: H.roof, roughness: 0.8 }));
      sh.position.set(sx * 0.82, 0, 0.04); sh.castShadow = true; grp.add(sh);
    }
    if (withBox) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.28), wood);
      box.position.set(0, -0.68, 0.16); box.castShadow = true; grp.add(box);
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshStandardMaterial({ color: flowerCols[(i + Math.floor(H.x)) & 3 ], roughness: 0.8 }));
        f.position.set(-0.5 + i * 0.2, -0.52 + (i % 2) * 0.05, 0.18); grp.add(f);
      }
    }
  };
  for (const sx of [-1, 1]) winAt(H.x + sx * H.w * 0.3, fz + 0.06, 0, true);
  winAt(H.x + H.w / 2 + 0.06, H.z, Math.PI / 2, false);
  winAt(H.x - H.w / 2 - 0.06, H.z, -Math.PI / 2, false);

  // lanterne de porche
  const lant = mk(new THREE.SphereGeometry(0.13, 8, 6), world.windowMat, H.x + 1.0, y + 2.4, fz + 0.28);
  lant.castShadow = false;
  mk(new THREE.BoxGeometry(0.05, 0.4, 0.05), trim, H.x + 1.0, y + 2.65, fz + 0.2).castShadow = false;

  world.addBox(H.x, H.z, H.w / 2 + 0.25, H.d / 2 + 0.25, y - 1, y + H.h + rh + 1);
  if (H.d === 7 && H.w === 11) {
    // auberge : enseigne suspendue
    const sign = mk(new THREE.BoxGeometry(1.5, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 }), H.x + 3.2, y + 3.1, fz + 0.5);
    mk(new THREE.BoxGeometry(0.1, 0.1, 0.8), trim, H.x + 3.2, y + 3.7, fz + 0.2);
    sign.rotation.z = 0.04;
  }
}

// Décor : tonneaux, caisses, bottes de foin, lampadaires, bannières, puits détaillé
function decorateTown(world, g, T, stone, wood, add) {
  const band = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.5 });
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.9, 12);
  const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const hayGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.8, 10).rotateZ(Math.PI / 2);
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 1 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a40, map: T.bark || null, roughness: 0.9 });
  const barrels = [[-9.3, -4.2], [-9.9, -3.2], [9.2, -5.9], [-13.6, -4.9], [19.5, 0], [-8.4, 5.8], [4.2, -11.4], [-5.4, 13.3], [14.8, 11.6]];
  barrels.forEach(([x, z], i) => {
    const y = world.heightAt(x, z);
    if (Math.hypot(x, z) < 3) return;
    const b = add(barrelGeo, wood, x, y + 0.45, z);
    b.rotation.y = i;
    add(new THREE.TorusGeometry(0.41, 0.03, 4, 14).rotateX(Math.PI / 2), band, x, y + 0.25, z).castShadow = false;
    add(new THREE.TorusGeometry(0.41, 0.03, 4, 14).rotateX(Math.PI / 2), band, x, y + 0.68, z).castShadow = false;
    world.addCircle(x, z, 0.42);
  });
  const crates = [[-8.4, -3.2, 0], [-8.6, -2.3, 0.6], [8.9, -3.9, 0.3], [-11.5, 8.2, 0.9], [12.4, 9.2, 0.2], [-1.6, -11.6, 0.5]];
  crates.forEach(([x, z, r]) => {
    const y = world.heightAt(x, z);
    const c = add(crateGeo, crateMat, x, y + 0.4, z);
    c.rotation.y = r;
    world.addBox(x, z, 0.42, 0.42, y - 1, y + 1);
  });
  for (const [x, z, r] of [[13.2, -3.1, 0.4], [-14.5, -13.2, 1.6], [6.9, 8.1, 0]]) {
    const y = world.heightAt(x, z);
    const h = add(hayGeo, hayMat, x, y + 0.55, z); h.rotation.y = r;
    world.addCircle(x, z, 0.65);
  }

  // lampadaires le long de la place (lumière chaude sans PointLight : halo additif)
  const lampSpots = [[-10, 0], [10, 1], [0, 9], [-3, -9], [5, 16], [-5, 22], [5, 28], [-5, 33], [-19, -26], [19, -26], [-9, -26], [9, -26], [-24, 12], [24, 12], [-24, -12], [24, -12]];
  lampSpots.forEach(([x, z]) => {
    const y = world.heightAt(x, z);
    add(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.5 }), x, y + 1.6, z);
    const lamp = add(new THREE.SphereGeometry(0.2, 8, 6), world.windowMat, x, y + 3.3, z);
    lamp.castShadow = false;
    if (T.glow) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffb860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.scale.setScalar(3);
      sp.position.y = 0;
      lamp.add(sp);
    }
    world.addCircle(x, z, 0.2);
  });

  // tonneaux/caisses devant les nouvelles maisons
  for (const [x, z] of [[-30, -6.2], [30, -6.2], [-31, 10], [31, 10], [-29, 24.5], [29, 24.5], [-19, 30.5], [19, 30.5]]) {
    const y = world.heightAt(x, z);
    add(barrelGeo, wood, x, y + 0.45, z);
    add(crateGeo, crateMat, x + 0.9, y + 0.4, z + 0.2).rotation.y = 0.4;
    world.addCircle(x, z, 0.45); world.addBox(x + 0.9, z + 0.2, 0.42, 0.42, y - 1, y + 1);
  }

  // bannières sur le portail
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0x8a1f2a, roughness: 0.9, side: THREE.DoubleSide });
  for (const sx of [-4.2, 4.2]) {
    const y = world.heightAt(sx, 36);
    const b = add(new THREE.PlaneGeometry(0.9, 2.6), bannerMat, sx * 0.98, y + 3.4, 36.75);
    b.castShadow = false;
    add(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5).rotateZ(Math.PI / 2), wood, sx * 0.98, y + 4.75, 36.75).castShadow = false;
  }

  // détails du puits : seau, corde, margelle
  const wy = world.heightAt(0, 0);
  add(new THREE.CylinderGeometry(0.2, 0.16, 0.26, 8), wood, 0.5, wy + 1.35, 0.1).castShadow = false;
  add(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 4), wood, 0.5, wy + 2.0, 0.1).castShadow = false;
  add(new THREE.TorusGeometry(1.6, 0.14, 6, 18).rotateX(Math.PI / 2), stone, 0, wy + 1.0, 0);
}


// ---------------------------------------------------------------------------
// V3.3 : enceinte (remparts, tours, porte sud), place pavée, quartier des portails au nord
const HALF = 36; // demi-côté de l'enceinte
function buildCityLayout(world, g, T, stone, wood, add) {
  const y0 = world.heightAt(0, 0);
  const wallMat = new THREE.MeshStandardMaterial({ color: T.stone ? 0xb4b0a4 : 0x8a8578, map: T.stone || null, roughness: 0.95, flatShading: !T.stone });
  const TH = 1.8, WH = 5.2, GATE = 4.85;
  const merlons = [];
  const run = (x0, z0, x1, z1) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const body = add(new THREE.BoxGeometry(alongX ? len : TH, WH, alongX ? TH : len), wallMat, cx, y0 + WH / 2, cz);
    body.receiveShadow = true;
    const n = Math.max(1, Math.round(len / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      world.addBox(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, alongX ? len / n / 2 + 0.1 : TH / 2, alongX ? TH / 2 : len / n / 2 + 0.1, y0 - 1, y0 + WH + 1);
    }
    const m = Math.max(1, Math.floor(len / 2.2));
    for (let i = 0; i < m; i++) { const t = (i + 0.5) / m; merlons.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, alongX]); }
  };
  run(-HALF, -HALF, HALF, -HALF);         // nord
  run(-HALF, HALF, -GATE, HALF);          // sud (porte au milieu)
  run(GATE, HALF, HALF, HALF);
  run(-HALF, -HALF, -HALF, HALF);         // ouest
  run(HALF, -HALF, HALF, HALF);           // est
  // créneaux : un seul draw call
  const mg = new THREE.BoxGeometry(1, 0.9, 1);
  const inst = new THREE.InstancedMesh(mg, wallMat, merlons.length);
  const d = new THREE.Object3D();
  merlons.forEach(([x, z, alongX], i) => {
    d.position.set(x, y0 + WH + 0.45, z);
    d.scale.set(alongX ? 1.1 : TH + 0.15, 1, alongX ? TH + 0.15 : 1.1);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  g.add(inst);

  // tours d'angle
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a2a26, map: T.roof || null, roughness: 0.85 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * HALF, z = sz * HALF;
    add(new THREE.CylinderGeometry(2.9, 3.2, 9, 12), wallMat, x, y0 + 4.5, z);
    add(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 12), stone, x, y0 + 9.2, z);
    add(new THREE.ConeGeometry(3.6, 3.4, 12), roofMat, x, y0 + 11.2, z);
    world.addCircle(x, z, 3);
  }

  // place centrale pavée + cercle de pierre autour du puits
  const plaza = add(new THREE.CylinderGeometry(10, 10, 0.1, 40), stone, 0, y0 + 0.05, 0);
  plaza.castShadow = false;
  add(new THREE.CylinderGeometry(5.5, 5.5, 0.14, 32), new THREE.MeshStandardMaterial({ color: 0xc2b9a4, map: T.stone || null, roughness: 0.9 }), 0, y0 + 0.07, 0).castShadow = false;

  // route pavée du portail sud jusqu'à la place
  const road = add(new THREE.BoxGeometry(5, 0.08, HALF - 8), new THREE.MeshStandardMaterial({ color: 0x8d8372, map: T.stone || null, roughness: 0.95 }), 0, y0 + 0.04, (HALF + 9) / 2);
  road.castShadow = false;

  // quartier des portails : grande plateforme + marches, face à la place
  const plat = add(new THREE.BoxGeometry(46, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x8a8a92, map: T.stone || null, roughness: 0.85 }), 0, y0 + 0.05, -29.5);
  plat.castShadow = false;
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(46 - i * 2, 0.07, 0.6), stone, 0, y0 + 0.04, -23.2 + i * 0.5).castShadow = false;
  // allée centrale pavée entre l'auberge et la plateforme (contourne le bâtiment)
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(4, 0.08, 14), stone, sx * 9, y0 + 0.04, -17).castShadow = false;
}
