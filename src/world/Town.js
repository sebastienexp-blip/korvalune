import * as THREE from 'three';
import { plasterTexture, roofTexture, stoneTexture, glowTexture, barkTexture, safeTexture } from '../visual/Textures.js';
import { mulberry32 } from '../core/math.js';
import { ModelLibrary } from '../visual/ModelLibrary.js';
import { HALF, GATE_HW, GATES, CASTLE, POS, KEEP_CLEAR, HOUSE_BLOCKS } from './TownMap.js';

// V10.39 — Korvalune agrandie : enceinte de 124 m, château au centre, quatre portes, quartiers par catégorie
// (marchand à l'est, artisans à l'ouest, personnalisation au sud-ouest, écurie et auberge au sud-est, portails au nord).
// Les positions viennent de TownMap.js. Les maisons « secondaires » sont allégées (peu de maillages) pour rester fluides sur mobile.

const WALL_COLS = [0xc8b596, 0xb9a58a, 0xd0c2a2, 0xc2b090, 0xcbbb9b, 0xc6b594, 0xb8a382, 0xc0ad8c];
const ROOF_COLS = [0x7a2e2a, 0x3f5b72, 0x8a4a2a, 0x6a2f2f, 0x4a5f3a, 0x7a4a2a, 0x5a2a26, 0x3a4a6a];

export function planHouses() {
  const rnd = mulberry32(5150);
  const out = [];
  // bâtiments « héros » (détaillés) : auberge et maison du barbier
  out.push({ ...POS.inn, h: 5.8, wall: 0xb8a382, roof: 0x5a2a26, hero: true });
  out.push({ ...POS.barberHouse, h: 3.8, wall: 0xcbbb9b, roof: 0x4a5f3a, hero: true });
  const clear = (x, z, w, d) => KEEP_CLEAR.some(([cx, cz, r]) => {
    const dx = Math.max(Math.abs(x - cx) - w / 2, 0), dz = Math.max(Math.abs(z - cz) - d / 2, 0);
    return dx * dx + dz * dz < r * r;
  });
  const overlap = (x, z, w, d) => out.some((h) => Math.abs(h.x - x) < (h.w + w) / 2 + 3 && Math.abs(h.z - z) < (h.d + d) / 2 + 4.5);
  let n = 0;
  for (const [x0, x1, z0, z1] of HOUSE_BLOCKS) {
    let k = 0;
    for (let t = 0; t < 90 && k < 9; t++) {
      const w = 5.5 + rnd() * 3, d = 5 + rnd() * 2.6;
      const x = x0 + w / 2 + rnd() * (x1 - x0 - w), z = z0 + d / 2 + rnd() * (z1 - z0 - d);
      if (clear(x, z, w, d) || overlap(x, z, w, d)) continue;
      out.push({ x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, w, d, h: 3.8 + rnd() * 1.8, wall: WALL_COLS[n % 8], roof: ROOF_COLS[(n * 3 + 1) % 8], hero: false });
      k++; n++;
    }
  }
  return out;
}

// Construit Korvalune : château, remparts, quartiers, portails.
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

  const houses = planHouses();
  const glbHouses = ModelLibrary.hasTown(HOUSE_KINDS);
  for (const H of houses) {
    if (glbHouses) { try { houseGlb(world, g, H); continue; } catch (e) { console.warn('[V10.41] maison GLB ignorée', e); } }
    if (V && T.plaster && T.roof && H.hero) {
      try { houseV25(world, g, H, T, stone, wood, add); continue; } catch (e) { console.warn('[V2.5] maison classique utilisée', e); }
    }
    houseLite(world, g, H, T, stone, wood, add);
  }

  world.spots.spawn = new THREE.Vector3(POS.spawn[0], 0, POS.spawn[1]);
  world.spots.guard = new THREE.Vector3(POS.guard[0], 0, POS.guard[1]);

  // Coffre de banque (stockage partagé, pages multiples) près du puits.
  const [bx, bz] = POS.bank, by = world.heightAt(bx, bz);
  const bankGroup = new THREE.Group();
  const BANK_S = 2.5;   // V10.53 : le coffre de Korvalune est 2,5 fois plus grand
  bankGroup.position.set(bx, by + 0.42 * BANK_S, bz);
  bankGroup.scale.setScalar(BANK_S);
  g.add(bankGroup);
  let bLid;
  if (ModelLibrary.hasTown(['coffre_base', 'coffre_couvercle'])) {
    const cb = ModelLibrary.townInstance('coffre_base'); cb.scale.set(1.158, 1.2, 1.2); bankGroup.add(cb);
    bLid = ModelLibrary.townInstance('coffre_couvercle'); bLid.scale.set(1.158, 1.2, 1.2); bLid.position.set(0, 0.6, -0.36); bankGroup.add(bLid);
  } else {
    const bankWood = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.85 });
    const bankTrim = new THREE.MeshStandardMaterial({ color: 0x8a6a30, roughness: 0.4, metalness: 0.5 });
    const bBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.72), bankWood);
    bBase.position.y = 0.3; bBase.castShadow = true; bankGroup.add(bBase);
    bLid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.42, 0.76), bankWood);
    bLid.position.set(0, 0.62, -0.32); bLid.rotation.x = -0.05; bLid.castShadow = true; bankGroup.add(bLid);
    const bTrim = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.07, 0.78), bankTrim);
    bTrim.position.y = 0.62; bankGroup.add(bTrim);
  }
  const bGlow = new THREE.PointLight(0x6ab0ff, 1.1, 5 * BANK_S, 2);
  bGlow.position.y = 0.9; bankGroup.add(bGlow);
  // socle : posé bien au-dessus du sol de la place (0,16 m) pour éviter le scintillement de surfaces superposées (z-fighting)
  add(new THREE.CylinderGeometry(1.5 * BANK_S, 1.7 * BANK_S, 0.3, 24), stone, bx, by + 0.08, bz);
  world.addBox(bx, bz, 0.9 * BANK_S, 0.7 * BANK_S, by - 1, by + 1.3 * BANK_S);

  try { buildCityLayout(world, g, T, stone, wood, add); } catch (e) { console.warn('[V10.39] ville : mise en page ignorée', e); }
  try { buildDistricts(world, g, T, stone, wood, add); } catch (e) { console.warn('[V10.39] ville : quartiers ignorés', e); }
  if (V) { try { decorateTown(world, g, T, stone, wood, add); } catch (e) { console.warn('[V2.5] décor du village ignoré', e); } }

  world.spots.bank = new THREE.Vector3(bx, by, bz + 1.6 * BANK_S);
  return { bankPos: new THREE.Vector3(bx, by, bz), bankChest: { group: bankGroup, lid: bLid } };
}

// V10.41 : maisons du kit GLB (6 variantes : 2 orientations de faîtage × 3 hauteurs), teintes de murs/toit par sommets
const DIST_KINDS = ['etal_armes', 'etal_armures', 'etal_potions', 'etal_fruits', 'etal_tissus', 'etal_curios', 'fontaine', 'etabli_forge', 'etabli_alchimie', 'etabli_enchant', 'etabli_armurier', 'cercle_monolithe', 'ecurie_abri', 'barriere', 'auge', 'portail_regions', 'torchere'];
const CITY_KINDS = ['mur', 'tour_coin', 'tour_porte', 'tour_chateau_coin', 'tour_chateau_porte', 'tour_carree', 'linteau_ville', 'linteau_chateau', 'banniere_porte', 'donjon'];
const HOUSE_KINDS = ['long', 'pignon'].flatMap((o) => ['a', 'b', 'c'].map((h) => `maison_${o}_${h}`));
function houseGlb(world, g, H) {
  const y = world.heightAt(H.x, H.z);
  const hk = H.h < 4.25 ? 'a' : H.h < 5.15 ? 'b' : 'c';
  const kind = `maison_${H.w >= H.d ? 'long' : 'pignon'}_${hk}`;
  const meta = ModelLibrary.townMeta(kind), [w0, h0, d0] = meta.dims;
  const grp = ModelLibrary.townInstance(kind, { tint: { wall: H.wall, roof: H.roof, trim: H.roof }, windowMat: world.windowMat });
  grp.position.set(H.x, y, H.z);
  grp.scale.set(H.w / w0, H.h / h0, H.d / d0);
  g.add(grp);
  const span = Math.min(H.w, H.d), rh = span * 0.62;
  const [cx, cy, cz] = meta.chimney;
  world.chimneys.push({ x: H.x + cx * (H.w / w0), y: y + cy * (H.h / h0), z: H.z + cz * (H.d / d0) });
  world.addBox(H.x, H.z, H.w / 2 + 0.25, H.d / 2 + 0.25, y - 1, y + H.h + rh + 1);
  if (H.hero && H.w >= 11 && ModelLibrary.town.enseigne_auberge) {   // auberge : enseigne suspendue
    const sg = ModelLibrary.townInstance('enseigne_auberge', { windowMat: world.windowMat });
    sg.position.set(H.x + 3.2, y + 3.1, H.z + H.d / 2); g.add(sg);
  }
}

// maison allégée : socle, murs, toit à pignons (extrusion), porte, deux fenêtres, cheminée
const _roofCache = new Map();
function houseLite(world, g, H, T, stone, wood, add) {
  const y = world.heightAt(H.x, H.z);
  const wallMat = new THREE.MeshStandardMaterial({ color: H.wall, map: T.plaster || null, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: H.roof, map: T.roof || null, roughness: 0.85 });
  add(new THREE.BoxGeometry(H.w + 0.5, 0.7, H.d + 0.5), stone, H.x, y + 0.35, H.z);
  add(new THREE.BoxGeometry(H.w, H.h, H.d), wallMat, H.x, y + H.h / 2 + 0.3, H.z);
  const alongX = H.w >= H.d, span = alongX ? H.d : H.w, len = alongX ? H.w : H.d, o = 0.5, rh = span * 0.62;
  const key = `${span.toFixed(1)}|${len.toFixed(1)}`;
  let rg = _roofCache.get(key);
  if (!rg) {
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2 - o, 0); shape.lineTo(span / 2 + o, 0); shape.lineTo(0, rh); shape.closePath();
    rg = new THREE.ExtrudeGeometry(shape, { depth: len + o * 2, bevelEnabled: false });
    rg.translate(0, 0, -(len + o * 2) / 2);
    _roofCache.set(key, rg);
  }
  const roof = new THREE.Mesh(rg, [wallMat, roofMat]);
  roof.position.set(H.x, y + H.h + 0.3, H.z);
  if (alongX) roof.rotation.y = Math.PI / 2;
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);
  const fz = H.z + H.d / 2;
  add(new THREE.BoxGeometry(1.2, 1.9, 0.2), wood, H.x, y + 0.3 + 0.95, fz + 0.05).castShadow = false;
  add(new THREE.BoxGeometry(1.6, 0.16, 0.5), stone, H.x, y + 0.22, fz + 0.4).castShadow = false;
  for (const sx of [-1, 1]) {
    const w = add(new THREE.BoxGeometry(0.85, 0.85, 0.12), world.windowMat, H.x + sx * H.w * 0.3, y + H.h * 0.62, fz + 0.04);
    w.castShadow = false;
  }
  const cx = H.x + H.w * 0.28, cz = H.z - H.d * 0.2, cy = y + H.h + rh * 0.55;
  add(new THREE.BoxGeometry(0.8, 1.9, 0.8), stone, cx, cy, cz);
  world.chimneys.push({ x: cx, y: cy + 1.1, z: cz });
  world.addBox(H.x, H.z, H.w / 2 + 0.25, H.d / 2 + 0.25, y - 1, y + H.h + rh + 1);
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

// Décor : puits, lampadaires, tonneaux, caisses, foin
function decorateTown(world, g, T, stone, wood, add) {
  const y0 = world.heightAt(0, 0);
  const glbProps = ModelLibrary.hasTown(['puits', 'tonneau', 'caisse', 'foin', 'lampadaire']);
  // puits (place du Voyageur)
  const [wx, wz] = POS.well, wy = world.heightAt(wx, wz);
  if (glbProps) {
    const wg = ModelLibrary.townInstance('puits', { windowMat: world.windowMat });
    wg.position.set(wx, wy, wz); g.add(wg);
    world.addCircle(wx, wz, 1.9);
  } else {
    const [wx, wz] = POS.well, wy = world.heightAt(wx, wz);
    add(new THREE.CylinderGeometry(1.5, 1.7, 1, 16), stone, wx, wy + 0.5, wz);
    add(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x2f6f96, roughness: 0.1, metalness: 0.2 }), wx, wy + 1.04, wz);
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), wood, wx + sx * 1.3, wy + 2.1, wz);
    const wroof = add(new THREE.ConeGeometry(1.9, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x6a2f2f, flatShading: true }), wx, wy + 3.6, wz);
    wroof.rotation.y = Math.PI / 4;
    add(new THREE.TorusGeometry(1.6, 0.14, 6, 18).rotateX(Math.PI / 2), stone, wx, wy + 1.0, wz);
    add(new THREE.CylinderGeometry(0.2, 0.16, 0.26, 8), wood, wx + 0.5, wy + 1.35, wz + 0.1).castShadow = false;
    world.addCircle(wx, wz, 1.9);
  }

  const band = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.5 });
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.9, 12);
  const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const hayGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.8, 10).rotateZ(Math.PI / 2);
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 1 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a40, map: T.bark || null, roughness: 0.9 });
  const dummy = new THREE.Object3D();
  const inst = (geo, mat, list, lift) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, r], i) => { dummy.position.set(x, world.heightAt(x, z) + lift, z); dummy.rotation.set(0, r || 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; g.add(m);
  };
  const barrels = [[30, -12.5], [31.2, -12.8], [54, -12.6], [55, -13.5], [-8.4, 52], [9, 31], [24, 33], [-26, 40], [-38, -17], [-41, -5], [-52, -19], [33, 8], [53, 8.4], [-22, 18], [20, -30], [-20, -30], [58, 36], [36, 56], [46, 58]];
  const crates = [[30.2, -13.4, 0.3], [53.2, -12.2, 0.7], [33.4, 9, 0], [54.4, 9.2, 0.5], [-39.5, -18.6, 0.2], [-52.6, -20.4, 0.9], [-22.6, 19.2, 0.4], [26.4, 33.4, 0.1], [-8.6, 53.2, 0.6], [37, 55.4, 0.3]];
  const hays = [[40, 58.4, 0.4], [44.4, 58.2, 1.6], [50.4, 52, 0], [-36, 47, 0.8], [56.4, 38, 0.2]];
  if (glbProps) {
    const instGlb = (kind, list) => {
      if (!list.length) return;
      const ims = ModelLibrary.townInstanced(kind, list.length, { windowMat: world.windowMat });
      list.forEach(([x, z, r], i) => { dummy.position.set(x, world.heightAt(x, z), z); dummy.rotation.set(0, r || 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); for (const im of ims) im.setMatrixAt(i, dummy.matrix); });
      for (const im of ims) g.add(im);
    };
    instGlb('tonneau', barrels); instGlb('caisse', crates); instGlb('foin', hays);
  } else {
    inst(barrelGeo, wood, barrels, 0.45);
    inst(crateGeo, crateMat, crates, 0.4);
    inst(hayGeo, hayMat, hays, 0.55);
  }
  barrels.forEach(([x, z]) => world.addCircle(x, z, 0.45));
  crates.forEach(([x, z]) => world.addBox(x, z, 0.42, 0.42, -1, 2));
  hays.forEach(([x, z]) => world.addCircle(x, z, 0.65));

  // lampadaires : poteaux et lanternes instanciés, halos en un seul Points (aucune lumière dynamique)
  const L = [];
  for (let z = 22; z <= 58; z += 9) { L.push([-7.2, z], [7.2, z]); }
  for (let z = -40; z >= -60; z += -10) L.push([-7.2, z], [7.2, z]);
  for (let x = 30; x <= 58; x += 9) { L.push([x, -3.5], [x, -16.5]); }
  for (let x = -30; x >= -58; x -= 9) { L.push([x, -3.5], [x, -16.5]); }
  for (const a of [0, 1, 2, 3, 4, 5]) L.push([POS.well[0] + Math.cos(a * 1.047) * 13, POS.well[1] + Math.sin(a * 1.047) * 13]);
  for (const [x, z] of [[-30, -36], [30, -36], [-30, 18], [30, 18], [-15, -39], [15, -39], [-24, 0], [24, 0]]) L.push([x, z]);
  const lamps = L.filter(([x, z]) => !KEEP_CLEAR.some(([cx, cz, r]) => r < 6 && Math.hypot(x - cx, z - cz) < r));
  const hp = new Float32Array(lamps.length * 3);
  if (glbProps) {
    const ims = ModelLibrary.townInstanced('lampadaire', lamps.length, { windowMat: world.windowMat });
    lamps.forEach(([x, z], i) => {
      const y = world.heightAt(x, z);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(x, y, z); dummy.updateMatrix();
      for (const im of ims) im.setMatrixAt(i, dummy.matrix);
      hp.set([x, y + 3.3, z], i * 3);
      world.addCircle(x, z, 0.2);
    });
    for (const im of ims) g.add(im);
  } else {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.5 });
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6), poleMat, lamps.length);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), world.windowMat, lamps.length);
      lamps.forEach(([x, z], i) => {
      const y = world.heightAt(x, z);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(x, y + 1.6, z); dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + 3.3, z); dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix);
      hp.set([x, y + 3.3, z], i * 3);
      world.addCircle(x, z, 0.2);
    });
    poles.frustumCulled = bulbs.frustumCulled = false; poles.castShadow = true;
    g.add(poles, bulbs);
  }
  if (T.glow) {
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: T.glow, color: 0xffb860, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false; g.add(pts);
  }
}

// ---------------------------------------------------------------------------
// Enceinte à quatre portes, château central, rues et places pavées
function buildCityLayout(world, g, T, stone, wood, add) {
  const y0 = world.heightAt(0, 0);
  const wallMat = new THREE.MeshStandardMaterial({ color: T.stone ? 0xb4b0a4 : 0x8a8578, map: T.stone || null, roughness: 0.95, flatShading: !T.stone });
  const roofBlue = new THREE.MeshStandardMaterial({ color: 0x4c5aa8, map: T.roof || null, roughness: 0.8 });
  const roofRed = new THREE.MeshStandardMaterial({ color: 0x5a2a26, map: T.roof || null, roughness: 0.85 });
  const TH = 2.0, WH = 6.4;
  const merlons = [];
  const glbCity = ModelLibrary.hasTown(CITY_KINDS);
  const wallSegs = [];
  const placeGlb = (kind, x, y, z, ry = 0, opts = {}) => {
    const o = ModelLibrary.townInstance(kind, { windowMat: world.windowMat, ...opts });
    o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o;
  };
  const run = (x0, z0, x1, z1, wh = WH, th = TH) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (len < 0.5) return;
    if (glbCity) {
      const ns = Math.max(1, Math.round(len / 6));
      for (let i = 0; i < ns; i++) { const t = (i + 0.5) / ns; wallSegs.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, ry: alongX ? 0 : Math.PI / 2, sx: len / ns / 6, sy: wh / 6.4, sz: th / 2 }); }
    } else add(new THREE.BoxGeometry(alongX ? len : th, wh, alongX ? th : len), wallMat, cx, y0 + wh / 2, cz).receiveShadow = true;
    const n = Math.max(1, Math.round(len / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      world.addBox(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, alongX ? len / n / 2 + 0.1 : th / 2, alongX ? th / 2 : len / n / 2 + 0.1, y0 - 1, y0 + wh + 1);
    }
    if (glbCity) return;
    const m = Math.max(1, Math.floor(len / 2.4));
    for (let i = 0; i < m; i++) { const t = (i + 0.5) / m; merlons.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, alongX, wh, th]); }
  };
  const TOWER_KIND = { '3.6|12': 'tour_coin', '2.5|10': 'tour_porte', '3.8|16': 'tour_chateau_coin', '2.6|12.5': 'tour_chateau_porte' };
  const tower = (x, z, r, h, roofMat, rr = r + 0.5) => {
    if (glbCity && TOWER_KIND[`${r}|${h}`]) { placeGlb(TOWER_KIND[`${r}|${h}`], x, y0, z, (x * 7.3 + z * 3.1) % 6.28); world.addCircle(x, z, r + 0.2); return; }
    add(new THREE.CylinderGeometry(r, r * 1.1, h, 14), wallMat, x, y0 + h / 2, z);
    add(new THREE.CylinderGeometry(r + 0.45, r + 0.45, 0.5, 14), stone, x, y0 + h + 0.2, z);
    add(new THREE.ConeGeometry(rr, h * 0.38, 14), roofMat, x, y0 + h + 0.45 + h * 0.19, z);
    world.addCircle(x, z, r + 0.2);
  };

  // --- enceinte : quatre côtés, chacun percé d'une porte
  const H = HALF, GW = GATE_HW;
  run(-H, -H, -GW, -H); run(GW, -H, H, -H);                          // nord
  run(-H, H, -GW, H); run(GW, H, H, H);                              // sud
  const ez = GATES.E.z;
  run(H, -H, H, ez - GW); run(H, ez + GW, H, H);                     // est
  run(-H, -H, -H, ez - GW); run(-H, ez + GW, -H, H);                 // ouest
  // tours d'angle et tours de porte
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * H, sz * H, 3.6, 12, roofRed);
  for (const k of ['N', 'S', 'E', 'W']) {
    const gt = GATES[k], alongX = k === 'N' || k === 'S';
    for (const s of [-1, 1]) {
      const tx = alongX ? gt.x + s * (GW + 2.3) : gt.x, tz = alongX ? gt.z : gt.z + s * (GW + 2.3);
      tower(tx, tz, 2.5, 10, roofBlue);
    }
    // linteau + arche au-dessus de la porte, bannière violette
    const lw = GW * 2 + 0.4;
    if (glbCity) {
      placeGlb('linteau_ville', gt.x, y0 + 6.5, gt.z, alongX ? 0 : Math.PI / 2);
      placeGlb('banniere_porte', gt.x + (alongX ? 0 : (k === 'E' ? -1.2 : 1.2)), y0 + 2.3, gt.z + (alongX ? (k === 'N' ? 1.2 : -1.2) : 0), alongX ? 0 : Math.PI / 2);
      continue;
    }
    add(new THREE.BoxGeometry(alongX ? lw : TH + 0.6, 2.2, alongX ? TH + 0.6 : lw), wallMat, gt.x, y0 + 7.6, gt.z);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.2), new THREE.MeshStandardMaterial({ color: 0x5a2a9a, roughness: 0.9, side: THREE.DoubleSide }));
    ban.position.set(gt.x + (alongX ? 0 : (k === 'E' ? -1.2 : 1.2)), y0 + 4.4, gt.z + (alongX ? (k === 'N' ? 1.2 : -1.2) : 0));
    if (!alongX) ban.rotation.y = Math.PI / 2;
    g.add(ban);
  }
  // tours intermédiaires carrées
  for (const [x, z] of [[-31, -H], [31, -H], [-31, H], [31, H], [H, -36], [H, 24], [-H, -36], [-H, 24]]) {
    if (glbCity) placeGlb('tour_carree', x, y0, z, 0);
    else {
      add(new THREE.BoxGeometry(4.6, 9, 4.6), wallMat, x, y0 + 4.5, z);
      add(new THREE.BoxGeometry(5.2, 0.5, 5.2), stone, x, y0 + 9.2, z);
    }
    world.addBox(x, z, 2.4, 2.4, y0 - 1, y0 + 10);
  }
  // le château : donjon central (V10.45 : sans enceinte intérieure)
  const C = CASTLE, cy0 = y0;
  const CW = 8.6, CTH = 2.4;
  // V10.45 : l'enceinte intérieure du château (murs, tours, porte) est supprimée — seul le donjon reste au centre de la ville
  // donjon : grand corps central à étages, tourelles, toit en flèche
  const kx = C.x, kz = C.keepZ, kw = 18, kd = 12, kh = 21;
  const keepMat = new THREE.MeshStandardMaterial({ color: 0xc4c0b4, map: T.stone || null, roughness: 0.92 });
  world.addBox(kx, kz, kw / 2 + 0.3, kd / 2 + 0.3, cy0 - 1, cy0 + kh + 2);
  if (glbCity) placeGlb('donjon', kx, cy0, kz, 0);
  else {
    add(new THREE.BoxGeometry(kw, kh, kd), keepMat, kx, cy0 + kh / 2, kz);
    add(new THREE.BoxGeometry(kw + 1.2, 0.8, kd + 1.2), stone, kx, cy0 + kh + 0.4, kz);
    add(new THREE.BoxGeometry(kw + 1.2, 0.6, kd + 1.2), stone, kx, cy0 + 9.5, kz);
    const spire = add(new THREE.ConeGeometry(7.2, 11, 4), roofBlue, kx, cy0 + kh + 0.8 + 5.5, kz); spire.rotation.y = Math.PI / 4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tx = kx + sx * (kw / 2 - 0.6), tz = kz + sz * (kd / 2 - 0.4);
      add(new THREE.CylinderGeometry(1.7, 1.9, kh + 5, 10), keepMat, tx, cy0 + (kh + 5) / 2, tz);
      add(new THREE.ConeGeometry(2.3, 4.6, 10), roofBlue, tx, cy0 + kh + 5 + 2.3, tz);
    }
    // portail et fenêtres éclairées du donjon (face sud)
    add(new THREE.BoxGeometry(3.4, 5, 0.4), wood, kx, cy0 + 2.5, kz + kd / 2 + 0.1);
    add(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), wood, kx, cy0 + 5, kz + kd / 2 + 0.1);
    for (const row of [0, 1, 2]) for (let i = -3; i <= 3; i++) {
      if (row === 0 && Math.abs(i) < 1) continue;
      add(new THREE.BoxGeometry(0.9, 1.6, 0.15), world.windowMat, kx + i * 2.3, cy0 + 4.2 + row * 5.2, kz + kd / 2 + 0.06).castShadow = false;
    }
    // grandes bannières du donjon
    const kban = new THREE.MeshStandardMaterial({ color: 0x5a2a9a, roughness: 0.9, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8), kban); b.position.set(kx + sx * 6.4, cy0 + 13, kz + kd / 2 + 0.2); g.add(b); }
  }

  // remparts GLB : un InstancedMesh par matériau pour tous les tronçons
  if (glbCity && wallSegs.length) {
    const ims = ModelLibrary.townInstanced('mur', wallSegs.length, { windowMat: world.windowMat, tint: { wall: 0xb4b0a4, roof: 0xffffff, trim: 0xffffff } });
    const dm = new THREE.Object3D();
    wallSegs.forEach((w, i) => { dm.position.set(w.x, y0, w.z); dm.rotation.set(0, w.ry, 0); dm.scale.set(w.sx, w.sy, w.sz); dm.updateMatrix(); for (const im of ims) im.setMatrixAt(i, dm.matrix); });
    for (const im of ims) g.add(im);
  }
  // créneaux : un seul draw call
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.9, 1), wallMat, merlons.length);
  const d = new THREE.Object3D();
  merlons.forEach(([x, z, alongX, wh, th], i) => {
    d.position.set(x, y0 + wh + 0.45, z);
    d.scale.set(alongX ? 1.1 : th + 0.15, 1, alongX ? th + 0.15 : 1.1);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  g.add(inst);

  // --- sols : parvis du château, avenues, places
  // V10.69 : toutes les dalles affleurent à la même hauteur (+1 cm) ; l'ordre de pose est départagé par polygonOffset.
  // Avant, chaque dalle avait sa propre hauteur (jusqu'à +9 cm) : scintillement aux recouvrements et pieds sous la pierre.
  let slabLayer = 0;
  const slabMat = (color) => {
    const m = new THREE.MeshStandardMaterial({ color, map: T.stone || null, roughness: 0.95 });
    slabLayer++;
    m.polygonOffset = true; m.polygonOffsetFactor = -slabLayer; m.polygonOffsetUnits = -slabLayer;
    return m;
  };
  // V10.84 : les dalles épousent le relief (maillage 1 m dont chaque sommet suit heightAt). Avant, une boîte plate à hauteur
  // du centre : sur une pente l'herbe perçait la dalle ou la dalle flottait, d'où des aplats aux bords en escalier.
  const conform = (geo, x, z, color) => {
    geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position, U = geo.attributes.uv;
    const lift = 0.012 + slabLayer * 0.0004;
    for (let i = 0; i < P.count; i++) {
      const lx = P.getX(i), lz = P.getZ(i);
      P.setY(i, world.heightAt(x + lx, z + lz) + lift);
      U.setXY(i, lx / 8, lz / 8);
    }
    geo.computeVertexNormals();
    const m = add(geo, slabMat(color), x, 0, z);
    m.castShadow = false; m.receiveShadow = true; return m;
  };
  const pave = (w, dd, x, z, y, color = 0x8d8372) =>
    conform(new THREE.PlaneGeometry(w, dd, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(dd))), x, z, color);
  const disc = (r, x, z, y, color) =>
    conform(new THREE.RingGeometry(0.001, r, 48, Math.max(2, Math.ceil(r))), x, z, color);
  pave(C.hw * 2 + 20, C.hd * 2 + 20, C.x, C.z, 0.03, 0xa49c8c);                     // parvis
  pave(C.hw * 2 - 4, C.hd * 2 - 4, C.x, C.z, 0.06, 0xbdb4a0);                       // cour intérieure
  pave(11, HALF - (C.z + C.hd) - 8, 0, (HALF + C.z + C.hd + 8) / 2, 0.05);           // avenue sud
  pave(11, HALF + C.z - C.hd - 10, 0, (-HALF + C.z - C.hd - 10) / 2, 0.05);          // avenue nord
  pave(HALF - C.hw - 10, 10, (HALF + C.hw + 10) / 2, ez, 0.05);                      // avenue est
  pave(HALF - C.hw - 10, 10, -(HALF + C.hw + 10) / 2, ez, 0.05);                     // avenue ouest
  disc(15, POS.well[0], POS.well[1], 0.07, 0x9a9282);                                // place du Voyageur
  disc(7, POS.well[0], POS.well[1], 0.09, 0xc2b9a4);
  disc(9.5, POS.monolith[0], POS.monolith[1], 0.07, 0x9a9282);                       // place des Métamorphoses
  pave(30, 30, POS.market.x, POS.market.z + 2, 0.06, 0x9c927f);                      // marché
  pave(32, 32, -42, -10, 0.06, 0x8f8776);                                            // cour des artisans
  pave(66, 28, 0, -48, 0.06, 0x8a8a92);                                              // quartier des portails
  for (let i = 0; i < 3; i++) pave(66 - i * 2, 0.7, 0, -34.2 + i * 0.6, 0.04, 0x9c9ca4);
  // écurie : sol de terre battue
  pave(24, 16, POS.stable[0] + 2, POS.stable[1] + 1, 0.04, 0x7a6a4c);
}

// ---------------------------------------------------------------------------
// Quartiers : marché (est), artisans (ouest), personnalisation (sud-ouest), écurie (sud-est), portails (nord)
function buildDistricts(world, g, T, stone, wood, add) {
  const y0 = world.heightAt(0, 0);
  const glowTex = T.glow || safeTexture(glowTexture, 64);
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2e36, roughness: 0.5, metalness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a74a, roughness: 0.35, metalness: 0.8 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.85 });
  const glbDist = ModelLibrary.hasTown(DIST_KINDS);
  const placeGlb = (kind, x, y, z, ry = 0) => { const o = ModelLibrary.townInstance(kind, { windowMat: world.windowMat }); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  const halo = (x, y, z, color, size = 3, parent = g) => {
    if (!glowTex) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.setScalar(size); sp.position.set(x, y, z); parent.add(sp);
  };

  // ---- étals du marché : comptoir, auvent rayé, marchandises
  const stall = (x, z, facing, ca, cb, goods) => {
    if (glbDist && STALL_BY.has(goods)) {
      const y = world.heightAt(x, z);
      placeGlb(STALL_BY.get(goods), x, y, z, facing === 'n' ? Math.PI : 0);
      world.addBox(x, z, 1.9, 0.6, y - 1, y + 3);
      return;
    }
    const y = world.heightAt(x, z), grp = new THREE.Group();
    grp.position.set(x, y, z); grp.rotation.y = facing === 'n' ? Math.PI : 0; g.add(grp);
    const a = (geo, mat, px, py, pz) => add(geo, mat, px, py, pz, grp);
    a(new THREE.BoxGeometry(3.6, 1.0, 1.3), wood, 0, 0.5, 0);
    a(new THREE.BoxGeometry(3.8, 0.12, 1.5), darkWood, 0, 1.04, 0);
    for (const px of [-1.7, 1.7]) { a(new THREE.CylinderGeometry(0.07, 0.07, 3.0, 6), wood, px, 1.5, -0.7); a(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6), wood, px, 1.15, 0.7); }
    for (let i = 0; i < 6; i++) { // auvent à bandes
      const m = new THREE.MeshStandardMaterial({ color: i % 2 ? cb : ca, roughness: 0.9, side: THREE.DoubleSide });
      const b = a(new THREE.BoxGeometry(0.64, 0.08, 2.2), m, -1.6 + i * 0.64, 2.75, 0);
      b.rotation.x = 0.2; b.castShadow = true;
    }
    a(new THREE.BoxGeometry(3.6, 1.7, 0.1), darkWood, 0, 1.9, -0.72);
    goods(a);
    world.addBox(x, z, 1.9, 0.6, y - 1, y + 3);
  };
  const crate = (a, px, pz, col = 0x8a6a40) => a(new THREE.BoxGeometry(0.6, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }), px, 1.3, pz);
  const fruit = (a, cols) => { for (let i = 0; i < 10; i++) a(new THREE.SphereGeometry(0.13, 7, 6), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7 }), -1.4 + (i % 5) * 0.7, 1.22 + Math.floor(i / 5) * 0.02, -0.25 + (i >> 2) * 0.28).castShadow = false; };
  const weapons = (a) => { for (let i = 0; i < 4; i++) { const s = a(new THREE.BoxGeometry(0.1, 1.3, 0.04), new THREE.MeshStandardMaterial({ color: 0xb9c0cc, metalness: 0.8, roughness: 0.3 }), -1.2 + i * 0.7, 2.0, -0.62); s.rotation.z = (i - 1.5) * 0.12; } };
  const armors = (a) => { for (let i = 0; i < 3; i++) a(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x8a93a3, metalness: 0.7, roughness: 0.4 }), -1.0 + i * 1.0, 1.35, 0.05); a(new THREE.CircleGeometry(0.5, 14), new THREE.MeshStandardMaterial({ color: 0x3f5b72, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide }), 1.2, 2.0, -0.62); };
  const potions = (a) => { const cs = [0xe04a4a, 0x4a8ae0, 0x6ae04a, 0xb04ae0]; for (let i = 0; i < 8; i++) { const f = a(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 7), new THREE.MeshStandardMaterial({ color: cs[i % 4], emissive: cs[i % 4], emissiveIntensity: 0.25, roughness: 0.3 }), -1.4 + i * 0.4, 1.25, -0.2 + (i % 2) * 0.3); f.castShadow = false; } };
  const cloth = (a) => { const cs = [0xc04a6a, 0x4a6ac0, 0xd0a030, 0x4aa070]; for (let i = 0; i < 4; i++) a(new THREE.BoxGeometry(0.75, 0.22, 0.55), new THREE.MeshStandardMaterial({ color: cs[i], roughness: 0.95 }), -1.2 + i * 0.8, 1.2, 0).castShadow = false; };
  const curios = (a) => { a(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshStandardMaterial({ color: 0x8fd0ff, emissive: 0x3a7aaa, emissiveIntensity: 0.5, roughness: 0.2 }), -0.9, 1.45, 0); a(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0xc9a0ff, emissive: 0x6a3aaa, emissiveIntensity: 0.5 }), 0, 1.45, 0); a(new THREE.TorusGeometry(0.2, 0.05, 6, 12), brass, 0.9, 1.35, 0); };
  const MX = POS.market.x;
  const fruitGoods = (a) => fruit(a, [0xd03a2a, 0xe0a020, 0x6aa030]);
  const STALL_BY = new Map([[weapons, 'etal_armes'], [armors, 'etal_armures'], [potions, 'etal_potions'], [fruitGoods, 'etal_fruits'], [cloth, 'etal_tissus'], [curios, 'etal_curios']]);
  // V10.74 : les marchands se tiennent DANS leur étal (derrière le comptoir) : l'étal est décalé de 0,5 m vers la clientèle au lieu de 1,1 m (le PNJ était derrière le panneau du fond)
  stall(POS.weaponsmith[0], POS.weaponsmith[1] + 0.5, 's', 0xb03030, 0xe8dcc0, weapons);
  stall(POS.armorsmith[0], POS.armorsmith[1] + 0.5, 's', 0x2f5f9a, 0xe8dcc0, armors);
  stall(POS.apothecary[0], POS.apothecary[1] + 0.5, 's', 0x3a8a4a, 0xe8dcc0, potions);
  stall(POS.tilda[0] - 10, POS.tilda[1] - 0.5, 'n', 0xc09030, 0xe8dcc0, fruitGoods);
  stall(POS.tilda[0], POS.tilda[1] - 0.5, 'n', 0xa04a8a, 0xe8dcc0, cloth);
  stall(POS.orsin[0], POS.orsin[1] - 0.5, 'n', 0x4a3a8a, 0xd0b060, curios);
  // fontaine du marché
  const fy = world.heightAt(MX, POS.market.z);
  if (glbDist) placeGlb('fontaine', MX, fy, POS.market.z);
  else {
  add(new THREE.CylinderGeometry(3.2, 3.5, 0.7, 20), stone, MX, fy + 0.35, POS.market.z);
  add(new THREE.CylinderGeometry(2.7, 2.7, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x2f7fb6, roughness: 0.1, metalness: 0.2 }), MX, fy + 0.68, POS.market.z);
  add(new THREE.CylinderGeometry(0.45, 0.6, 2.2, 10), stone, MX, fy + 1.4, POS.market.z);
  add(new THREE.CylinderGeometry(1.2, 0.5, 0.4, 14), stone, MX, fy + 2.5, POS.market.z);
  add(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8fd8ff, emissive: 0x3a8ab0, emissiveIntensity: 0.6 }), MX, fy + 3.0, POS.market.z);
  }
  world.addCircle(MX, POS.market.z, 3.6);

  // ---- établis (artisans) : table, outils, accessoires selon le métier
  const BENCH_KIND = { armor: 'etabli_armurier', alchemy: 'etabli_alchimie', enchant: 'etabli_enchant', forge: 'etabli_forge' };
  const bench = (x, z, rot, kind) => {
    if (glbDist) {
      const y = world.heightAt(x, z);
      placeGlb(BENCH_KIND[kind], x, y, z, rot);
      if (kind === 'enchant') halo(x, y + 1.9, z, 0x9a7aff, 3.2);
      world.addBox(x, z, Math.abs(Math.cos(rot)) * 1.5 + Math.abs(Math.sin(rot)) * 0.7, Math.abs(Math.cos(rot)) * 0.7 + Math.abs(Math.sin(rot)) * 1.5, y - 1, y + 2.5);
      return;
    }
    const y = world.heightAt(x, z), grp = new THREE.Group();
    grp.position.set(x, y, z); grp.rotation.y = rot; g.add(grp);
    const a = (geo, mat, px, py, pz) => add(geo, mat, px, py, pz, grp);
    a(new THREE.BoxGeometry(3, 0.16, 1.3), darkWood, 0, 1.0, 0);
    for (const sx of [-1.3, 1.3]) for (const sz of [-0.5, 0.5]) a(new THREE.BoxGeometry(0.16, 1.0, 0.16), wood, sx, 0.5, sz);
    a(new THREE.BoxGeometry(2.8, 0.1, 1.0), wood, 0, 0.35, 0);
    if (kind === 'forge') {
      a(new THREE.BoxGeometry(0.9, 0.22, 0.4), iron, -0.7, 1.2, 0); a(new THREE.BoxGeometry(0.5, 0.2, 0.3), iron, -0.7, 1.05, 0);
      a(new THREE.BoxGeometry(0.9, 0.08, 0.14), iron, 0.6, 1.14, 0.1).rotation.y = 0.5;
      for (let i = 0; i < 3; i++) a(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), wood, 0.9 + i * 0.12, 1.5, -0.55).rotation.z = 0.2;
    } else if (kind === 'alchemy') {
      const cs = [0xe04a4a, 0x4a8ae0, 0x6ae04a];
      cs.forEach((c, i) => { const f = a(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.25 }), -0.9 + i * 0.7, 1.28, 0.05); f.castShadow = false; a(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xcfe0e8, roughness: 0.2 }), -0.9 + i * 0.7, 1.55, 0.05); });
      a(new THREE.CylinderGeometry(0.3, 0.38, 0.35, 10), iron, 1.0, 1.25, 0.1);
    } else if (kind === 'enchant') {
      const disc = a(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 20), new THREE.MeshBasicMaterial({ color: 0x8a6aff }), 0, 1.1, 0); disc.castShadow = false;
      const cr = a(new THREE.OctahedronGeometry(0.34), new THREE.MeshBasicMaterial({ color: 0xd8c8ff }), 0, 1.9, 0); cr.castShadow = false;
      halo(x, y + 1.9, z, 0x9a7aff, 3.2);
    } else { // armurier
      a(new THREE.CylinderGeometry(0.28, 0.34, 1.0, 8), wood, -0.9, 1.6, -0.1);
      a(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a93a3, metalness: 0.7, roughness: 0.4 }), -0.9, 2.3, -0.1);
      a(new THREE.BoxGeometry(0.8, 0.2, 0.4), iron, 0.7, 1.2, 0);
    }
    world.addBox(x, z, Math.abs(Math.cos(rot)) * 1.5 + Math.abs(Math.sin(rot)) * 0.7, Math.abs(Math.cos(rot)) * 0.7 + Math.abs(Math.sin(rot)) * 1.5, y - 1, y + 2.5);
  };
  // V10.74 : un seul établi décoratif (enchantement) ; la forge a déjà son enclume et son foyer (décor de forge) et les autres métiers ont leur étal au marché
  bench(POS.enchantBench[0], POS.enchantBench[1], Math.PI / 2, 'enchant');

  // ---- V10.69 : vrais stands d'artisans autour des établis (toit, murs, étagères, enseigne, lanternes, tonneaux)
  // Repère local du stand : le comptoir est à l'origine, l'ouverture (le client) est du côté +z, le fond à z = -1.5.
  const craftStand = (x, z, yaw, kind, o = {}) => {
    const COL = { forge: [0x7a2e2a, 0xff9a40, 'Forge'], armor: [0x3f5b72, 0xbfd0e8, 'Armurier'], alchemy: [0x3f6a3a, 0x7affb0, 'Alchimie'], enchant: [0x5a3a8a, 0xb89aff, 'Enchantement'] }[kind];
    const y = world.heightAt(x, z), grp = new THREE.Group();
    grp.position.set(x, y, z); grp.rotation.y = yaw; g.add(grp);
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, ...o });
    const mPost = mat(0x5a3d24), mPlank = mat(0x7a5733), mDark = mat(0x3d2916), mRoof = mat(COL[0], { side: THREE.DoubleSide }), mCloth = mat(COL[0], { side: THREE.DoubleSide });
    const a = (geo, m, px, py, pz, rx = 0, ry = 0, rz = 0) => { const o = add(geo, m, px, py, pz, grp); o.rotation.set(rx, ry, rz); return o; };
    const W = o.w || 5.6, zb = -(o.back ?? 1.5), zf = o.front ?? 2.4, D = zf - zb, H = 3.3, withBench = o.bench !== false;
    // dalle de pavage sous le stand (affleurante)
    const floor = a(new THREE.BoxGeometry(W + 0.6, 0.06, D + 0.6), (() => { const m = mat(0x6b5a44); m.polygonOffset = true; m.polygonOffsetFactor = -20; m.polygonOffsetUnits = -20; return m; })(), 0, -0.02, (zb + zf) / 2); floor.castShadow = false;
    // poteaux
    for (const px of [-W / 2, W / 2]) for (const pz of [zb, zf]) a(new THREE.BoxGeometry(0.2, H, 0.2), mPost, px, H / 2, pz);
    // fond planches + étagères, côtés pleins à hauteur de ceinture puis ajourés
    a(new THREE.BoxGeometry(W, 2.7, 0.14), mPlank, 0, 1.35, zb);
    for (let i = 0; i < 7; i++) a(new THREE.BoxGeometry(0.03, 2.7, 0.16), mDark, -W / 2 + 0.4 + i * (W - 0.8) / 6, 1.35, zb + 0.01);
    for (const sx of [-1, 1]) {
      a(new THREE.BoxGeometry(0.12, 1.15, D), mPlank, sx * W / 2, 0.58, (zb + zf) / 2);
      a(new THREE.BoxGeometry(0.16, 0.1, D), mDark, sx * W / 2, 1.18, (zb + zf) / 2);
    }
    for (const sy of [1.25, 1.95]) a(new THREE.BoxGeometry(W - 0.8, 0.09, 0.45), mDark, 0, sy, zb + 0.3);
    // toit à deux pans, bord frontal en tissu festonné
    const slope = 0.42, rl = Math.hypot(D / 2 + 0.7, 0.85);
    for (const sgn of [-1, 1]) {
      const r = a(new THREE.BoxGeometry(W + 0.9, 0.12, rl), mRoof, 0, H + 0.45, (zb + zf) / 2 + sgn * (D / 4 + 0.15), sgn * slope * 0.9, 0, 0);
      r.rotation.x = -sgn * Math.atan2(0.85, D / 2 + 0.7); r.castShadow = true;
    }
    a(new THREE.BoxGeometry(W + 1.0, 0.14, 0.2), mDark, 0, H + 0.95, (zb + zf) / 2);
    const nF = 8;
    for (let i = 0; i < nF; i++) {
      const f = a(new THREE.BoxGeometry((W + 0.9) / nF - 0.06, 0.42, 0.05), i % 2 ? mCloth : mat(0xe8dcc0, { side: THREE.DoubleSide }), -W / 2 - 0.45 + ((W + 0.9) / nF) * (i + 0.5), H - 0.08, zf + 0.62);
      f.castShadow = false;
    }
    // enseigne suspendue (nom du métier)
    try {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const c2 = cv.getContext('2d');
      c2.fillStyle = '#3d2916'; c2.fillRect(0, 0, 256, 64); c2.strokeStyle = '#c9a74a'; c2.lineWidth = 4; c2.strokeRect(3, 3, 250, 58);
      c2.fillStyle = '#f2e2b0'; c2.font = 'bold 34px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(COL[2], 128, 34);
      const tex = new THREE.CanvasTexture(cv);
      const sign = a(new THREE.BoxGeometry(2.2, 0.55, 0.08), [mDark, mDark, mDark, mDark, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })], 0, H - 0.75, zf + 0.7);
      sign.castShadow = false;
      for (const sx of [-0.9, 0.9]) a(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), iron, sx, H - 0.35, zf + 0.7);
    } catch (e) { /* enseigne facultative */ }
    // lanternes aux deux coins avant
    for (const sx of [-1, 1]) {
      a(new THREE.BoxGeometry(0.05, 0.35, 0.05), iron, sx * (W / 2 - 0.1), H - 0.3, zf + 0.15);
      const lamp = a(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: COL[1] }), sx * (W / 2 - 0.1), H - 0.62, zf + 0.15); lamp.castShadow = false;
      halo(x + Math.cos(yaw) * sx * (W / 2 - 0.1) + Math.sin(yaw) * (zf + 0.15), y + H - 0.62, z - Math.sin(yaw) * sx * (W / 2 - 0.1) + Math.cos(yaw) * (zf + 0.15), COL[1], 2.4);
    }
    // marchandises et accessoires sur les étagères, selon le métier
    const bit = (geo, c, px, py, pz, extra = {}) => a(geo, mat(c, extra), px, py, pz);
    for (let i = 0; i < 6; i++) {
      const px = -2.0 + i * 0.8;
      if (kind === 'forge') { bit(new THREE.BoxGeometry(0.5, 0.2, 0.28), 0x4a4e58, px, 1.4, zb + 0.3, { metalness: 0.7, roughness: 0.4 }); bit(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), 0x6b4a2b, px, 2.45, zb + 0.12).rotation.z = 0.2; }
      else if (kind === 'armor') { bit(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 8), 0x8a93a3, px, 1.45, zb + 0.3, { metalness: 0.7, roughness: 0.4 }); bit(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 10), 0x9a2a2a, px, 2.4, zb + 0.1).rotation.x = Math.PI / 2; }
      else if (kind === 'alchemy') { const c = [0xe04a4a, 0x4a8ae0, 0x6ae04a, 0xb04ae0][i % 4]; bit(new THREE.SphereGeometry(0.15, 8, 6), c, px, 1.4, zb + 0.3, { emissive: c, emissiveIntensity: 0.35, roughness: 0.25 }); bit(new THREE.CylinderGeometry(0.08, 0.11, 0.26, 7), c, px + 0.3, 2.08, zb + 0.3, { emissive: c, emissiveIntensity: 0.3 }); }
      else { bit(new THREE.BoxGeometry(0.34, 0.07, 0.26), 0x6a2a8a, px, 1.3, zb + 0.3); bit(new THREE.OctahedronGeometry(0.13), 0xb89aff, px, 2.15, zb + 0.3, { emissive: 0x7a5aff, emissiveIntensity: 0.7 }); }
    }
    // tonneaux, caisses, sacs, râtelier : à l'arrière-côté et le long des parois, hors de l'ouverture
    const barrel = (px, pz) => { a(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 10), mat(0x7a5530), px, 0.4, pz); a(new THREE.TorusGeometry(0.33, 0.025, 4, 12), iron, px, 0.55, pz, Math.PI / 2); };
    barrel(-W / 2 + 0.5, zb + 0.55); barrel(-W / 2 + 0.55, zb + 1.3);
    const crate = (px, pz, s = 0.55) => a(new THREE.BoxGeometry(s, s, s), mat(0x8a6a40), px, s / 2, pz, 0, px * 3, 0);
    crate(W / 2 - 0.5, zb + 0.55); crate(W / 2 - 0.5, zb + 1.2, 0.45); crate(W / 2 - 0.55, zb + 0.55, 0.38).position.y = 0.55 + 0.19;
    a(new THREE.SphereGeometry(0.3, 8, 6), mat(0xb6a47a), W / 2 - 0.6, 0.2, zb + 1.9).scale.set(1, 0.7, 0.9);
    // tapis devant le comptoir
    const rug = withBench && a(new THREE.BoxGeometry(3.2, 0.02, 1.0), (() => { const m = mat(COL[0]); m.polygonOffset = true; m.polygonOffsetFactor = -30; m.polygonOffsetUnits = -30; return m; })(), 0, 0.0, 1.35); if (rug) rug.castShadow = false;
    // collisions (alignées sur les axes : les stands sont tournés par quarts de tour)
    const quarter = Math.abs(Math.sin(yaw)) > 0.5;
    const wp = (lx, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz];
    const [bx2, bz2] = wp(0, zb);
    world.addBox(bx2, bz2, quarter ? 0.3 : W / 2, quarter ? W / 2 : 0.3, y - 1, y + 3);               // fond
    for (const sx of [-1, 1]) { const [sx2, sz2] = wp(sx * W / 2, (zb + zf) / 2); world.addBox(sx2, sz2, quarter ? D / 2 : 0.25, quarter ? 0.25 : D / 2, y - 1, y + 3); } // parois
    for (const sx of [-1, 1]) { const [px2, pz2] = wp(sx * W / 2, zf); world.addCircle(px2, pz2, 0.3); }
  };
  { // l'ouverture de chaque stand suit l'orientation de l'établi (vers le centre de la ville) ; le PNJ du métier se tient À L'INTÉRIEUR, derrière le comptoir
    const Q = Math.PI / 2;
    craftStand(-42.6, -12, Q, 'forge', { w: 6.6, back: 4.4, front: 5.2, bench: false });                       // Helga (-40,5 ; -12) entre l'enclume/foyer et l'entrée
    craftStand(POS.enchantBench[0], POS.enchantBench[1], Q, 'enchant', { w: 5.6, back: 2.0, front: 3.4 });     // Vaelis derrière l'établi
  }

  // ---- place des Métamorphoses : cercle de pierre autour du monolithe, quatre torchères runiques
  const [mx, mz] = POS.monolith, my = world.heightAt(mx, mz);
  if (glbDist) {
    const ring = placeGlb('cercle_monolithe', mx, my, mz);
    ring.userData.noAutoCollide = true;   // V10.48 : le cercle est un anneau au sol — son volume englobant (13,5 m) bouchait toute la place et interdisait l'accès au Monolithe
  }
  else add(new THREE.TorusGeometry(6.5, 0.28, 6, 36).rotateX(Math.PI / 2), stone, mx, my + 0.14, mz).castShadow = false;
  for (let i = 0; i < 4; i++) {
    const a2 = i * Math.PI / 2 + Math.PI / 4, px = mx + Math.cos(a2) * 6.5, pz = mz + Math.sin(a2) * 6.5;
    if (!glbDist) {
      add(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 8), stone, px, my + 1.2, pz);
      const f = add(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0x8fe3ff }), px, my + 3.0, pz); f.castShadow = false;
    }
    halo(px, my + 3.0, pz, 0x8fe3ff, 3);
    world.addCircle(px, pz, 0.5);
  }
  world.addCircle(mx, mz, 1.5);   // V10.48 : socle de la statue seul (on ne traverse plus la pierre, mais on peut s'en approcher)

  // ---- écurie : abri ouvert, enclos, auge, foin
  const [sx0, sz0] = POS.stable, sy = world.heightAt(sx0, sz0);
  const shedX = sx0 + 12, shedZ = sz0 - 2;
  if (glbDist) placeGlb('ecurie_abri', shedX, sy, shedZ);
  if (!glbDist) for (const px of [-5, 5]) for (const pz of [-3.5, 3.5]) add(new THREE.CylinderGeometry(0.22, 0.26, 4.2, 7), wood, shedX + px, sy + 2.1, shedZ + pz);
  if (!glbDist) { const sroof = add(new THREE.BoxGeometry(12, 0.3, 9), new THREE.MeshStandardMaterial({ color: 0x6a3a2a, map: T.roof || null, roughness: 0.85 }), shedX, sy + 4.5, shedZ); sroof.rotation.x = 0.12; }
  if (!glbDist) add(new THREE.BoxGeometry(11, 0.4, 0.6), darkWood, shedX, sy + 0.5, shedZ - 3.4);
  world.addBox(shedX, shedZ - 3.4, 5.6, 0.4, sy - 1, sy + 1.2);
  const fence = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 2.5));
    if (glbDist) {
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i < n; i++) { const o = placeGlb('barriere', x1 + (x2 - x1) * i / n, sy, z1 + (z2 - z1) * i / n, -ang); o.scale.x = (len / n) / 2.5; }
    } else for (let i = 0; i <= n; i++) add(new THREE.BoxGeometry(0.18, 1.3, 0.18), wood, x1 + (x2 - x1) * i / n, sy + 0.65, z1 + (z2 - z1) * i / n).castShadow = false;
    if (!glbDist) for (const hy of [0.5, 1.05]) { const r = add(new THREE.BoxGeometry(Math.abs(x2 - x1) > Math.abs(z2 - z1) ? len : 0.1, 0.1, Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 0.1 : len), wood, (x1 + x2) / 2, sy + hy, (z1 + z2) / 2); r.castShadow = false; }
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    world.addBox((x1 + x2) / 2, (z1 + z2) / 2, alongX ? len / 2 : 0.2, alongX ? 0.2 : len / 2, sy - 1, sy + 1.5);
  };
  const fx0 = sx0 - 8, fx1 = sx0 + 16, fz0 = sz0 - 7, fz1 = sz0 + 8;
  fence(fx0, fz0, fx1, fz0); fence(fx0, fz0, fx0, fz0 + 4); fence(fx1, fz0, fx1, fz1); fence(fx0, fz1, fx1, fz1); // ouverture au nord-ouest côté entrée
  if (glbDist) placeGlb('auge', sx0 - 4, sy, sz0 - 5.5); else add(new THREE.BoxGeometry(2.4, 0.5, 0.6), darkWood, sx0 - 4, sy + 0.4, sz0 - 5.5);
  world.addBox(sx0 - 4, sz0 - 5.5, 1.2, 0.3, sy - 1, sy + 1);

  // ---- quartier des portails : piliers monumentaux, braseros violets, cristaux
  const [rx, rz] = POS.regionsPortal, ry = world.heightAt(rx, rz);
  const purple = new THREE.MeshBasicMaterial({ color: 0xa24dff });
  if (glbDist) placeGlb('portail_regions', rx, ry, rz - 1);
  for (const s of [-1, 1]) {
    world.addCircle(rx + s * 8, rz - 1, 1.3);
    if (!glbDist) {
      add(new THREE.CylinderGeometry(1.0, 1.25, 11, 10), stone, rx + s * 8, ry + 5.5, rz - 1);
      add(new THREE.CylinderGeometry(1.4, 1.4, 0.6, 10), stone, rx + s * 8, ry + 11.2, rz - 1);
      const o = add(new THREE.OctahedronGeometry(0.8), purple, rx + s * 8, ry + 12.6, rz - 1); o.castShadow = false;
    }
    halo(rx + s * 8, ry + 12.6, rz - 1, 0xa24dff, 6);
  }
  if (!glbDist) add(new THREE.BoxGeometry(18, 1.4, 2.2), stone, rx, ry + 11.6, rz - 1);
  for (const [px, pz] of [[-12, -42], [12, -42], [-22, -55], [22, -55], [-8, -57], [8, -57]]) {
    if (glbDist) placeGlb('torchere', px, y0, pz, (px * 3.1) % 6.28);
    else {
      add(new THREE.CylinderGeometry(0.5, 0.65, 1.6, 8), stone, px, y0 + 0.8, pz);
      const f = add(new THREE.OctahedronGeometry(0.45), purple, px, y0 + 2.1, pz); f.castShadow = false;
    }
    halo(px, y0 + 2.1, pz, 0xa24dff, 3.2);
    world.addCircle(px, pz, 0.7);
  }

  // ---- arbres d'agrément (un seul draw call par partie) + parterres
  const rnd = mulberry32(7001);
  const spots = [];
  const okSpot = (x, z) => !KEEP_CLEAR.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 1.5)
    && !(Math.abs(x) < 8) && Math.abs(Math.abs(x) - HALF) > 4 && Math.abs(Math.abs(z) - HALF) > 4 && Math.abs(z + 10) > 7
    && Math.hypot(x, z + 10) > 36 && !spots.some((q) => Math.hypot(q.x - x, q.z - z) < 7);
  for (let t = 0; t < 900 && spots.length < 46; t++) {
    const x = (rnd() * 2 - 1) * (HALF - 5), z = (rnd() * 2 - 1) * (HALF - 5);
    if (okSpot(x, z) && !houseNear(x, z)) spots.push({ x, z, s: 0.8 + rnd() * 0.6 });
  }
  const oakG = ModelLibrary.nature && ModelLibrary.nature.oak_green ? ModelLibrary.natureGeometry('oak_green', 'lo') : null;
  if (oakG) {
    const om = new THREE.InstancedMesh(oakG, ModelLibrary.natureMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), spots.length);
    const d2 = new THREE.Object3D();
    spots.forEach((sp, i) => { d2.position.set(sp.x, world.heightAt(sp.x, sp.z) - 0.05, sp.z); d2.rotation.set(0, i * 2.4, 0); d2.scale.setScalar(sp.s * 0.85); d2.updateMatrix(); om.setMatrixAt(i, d2.matrix); world.addCircle(sp.x, sp.z, 0.5); });
    om.castShadow = true; om.frustumCulled = false; g.add(om);
    return;
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3, 6), crownGeo = new THREE.IcosahedronGeometry(1.7, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, wood, spots.length), crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x4a7a34, roughness: 0.9, flatShading: true }), spots.length);
  const dd = new THREE.Object3D();
  spots.forEach((s, i) => {
    const yy = world.heightAt(s.x, s.z);
    dd.position.set(s.x, yy + 1.5 * s.s, s.z); dd.scale.setScalar(s.s); dd.rotation.set(0, 0, 0); dd.updateMatrix(); trunks.setMatrixAt(i, dd.matrix);
    dd.position.set(s.x, yy + 4.2 * s.s, s.z); dd.rotation.y = i; dd.updateMatrix(); crowns.setMatrixAt(i, dd.matrix);
    world.addCircle(s.x, s.z, 0.5);
  });
  trunks.castShadow = crowns.castShadow = true; trunks.frustumCulled = crowns.frustumCulled = false;
  g.add(trunks, crowns);
}
const _houses = () => planHouses();
let _hcache = null;
function houseNear(x, z) {
  _hcache = _hcache || _houses();
  return _hcache.some((h) => Math.abs(h.x - x) < h.w / 2 + 3 && Math.abs(h.z - z) < h.d / 2 + 3);
}

