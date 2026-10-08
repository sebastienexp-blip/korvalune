import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';
import { stoneTexture, glowTexture, ringTexture, runeTexture, safeTexture } from '../visual/Textures.js';

// Génération procédurale d'une spire : une grille 5×5 de salles de 32 m reliées par des portes.
// Chaque spire a sa propre graine → agencement différent à chaque ouverture.
// L'arène est loin à l'est de la carte (x ≈ 2000) ; World.heightAt() y renvoie un sol plat (y = 0).

export const ARENA = { x: 2000, z: 0, cell: 32, n: 6 };
const WALL_H = 7, WALL_T = 1.6, DOOR_W = 10;

export function cellCenter(gx, gz) {
  const h = (ARENA.n - 1) / 2;
  return { x: ARENA.x + (gx - h) * ARENA.cell, z: ARENA.z + (gz - h) * ARENA.cell };
}
export function cellAt(x, z) {
  const h = (ARENA.n - 1) / 2;
  const gx = Math.round((x - ARENA.x) / ARENA.cell + h), gz = Math.round((z - ARENA.z) / ARENA.cell + h);
  if (gx < 0 || gz < 0 || gx >= ARENA.n || gz >= ARENA.n) return null;
  return { gx, gz };
}
export const cellKey = (gx, gz) => gz * ARENA.n + gx;

// links : bitmask N(−z)=1 E(+x)=2 S(+z)=4 W(−x)=8
const DIRS = [{ b: 1, dx: 0, dz: -1, o: 4 }, { b: 2, dx: 1, dz: 0, o: 8 }, { b: 4, dx: 0, dz: 1, o: 1 }, { b: 8, dx: -1, dz: 0, o: 2 }];

// Environnements (façon « tilesets » des failles de Diablo 3). Le choix dépend de la graine ET du monde du thème,
// donc identique pour tous les joueurs d'un même groupe.
export const RIFT_STYLES = {
  crypt: { label: 'Crypte', wall: 0x6a6f78, floor: 0x4a4f58, fog: null },
  ruins: { label: 'Ruines à ciel ouvert', wall: 0x9a9582, floor: 0x74905a, fog: 0x1f2c1c },
  cave: { label: 'Caverne', wall: 0x4f4a45, floor: 0x3b342d, fog: 0x0f0c0a },
  graveyard: { label: 'Cimetière hanté', wall: 0x6d7474, floor: 0x50665a, fog: 0x14221f },
  lava: { label: 'Fournaise', wall: 0x2e2224, floor: 0x241a1c, fog: 0x1c0a06 }
};
const STYLE_BY_WORLD = [['ruins', 'cave', 'crypt', 'graveyard'], ['graveyard', 'crypt', 'cave', 'ruins'], ['ruins', 'crypt', 'graveyard', 'cave'], ['lava', 'cave', 'graveyard', 'crypt'], ['lava', 'crypt', 'cave', 'graveyard']];
export function pickStyle(seed, worldIdx = 0) {
  const list = STYLE_BY_WORLD[Math.max(0, Math.min(STYLE_BY_WORLD.length - 1, worldIdx))];
  return list[(Math.imul(seed >>> 0, 2654435761) >>> 8) % list.length];
}

export function generateLayout(seed, wanted = 14, worldIdx = 0) {
  const rnd = mulberry32(seed >>> 0);
  const style = pickStyle(seed, worldIdx);
  const N = ARENA.n;
  const cells = new Map();
  const add = (gx, gz) => { const c = { gx, gz, links: 0, kind: 'room', dist: 0 }; cells.set(cellKey(gx, gz), c); return c; };
  // départ : une case de bordure
  const side = Math.floor(rnd() * 4);
  const t = Math.floor(rnd() * N);
  const start = side === 0 ? add(t, 0) : side === 1 ? add(N - 1, t) : side === 2 ? add(t, N - 1) : add(0, t);
  start.kind = 'start';
  const frontier = [start];
  while (cells.size < wanted) {
    // 65 % du temps on prolonge la dernière salle (couloirs sinueux), sinon on ramifie (culs-de-sac, embranchements)
    const from = rnd() < 0.65 ? frontier[frontier.length - 1] : frontier[Math.floor(rnd() * frontier.length)];
    const opts = DIRS.filter((d) => {
      const nx = from.gx + d.dx, nz = from.gz + d.dz;
      return nx >= 0 && nz >= 0 && nx < N && nz < N && !cells.has(cellKey(nx, nz));
    });
    if (!opts.length) { frontier.splice(frontier.indexOf(from), 1); if (!frontier.length) break; continue; }
    const d = opts[Math.floor(rnd() * opts.length)];
    const c = add(from.gx + d.dx, from.gz + d.dz);
    from.links |= d.b; c.links |= d.o;
    frontier.push(c);
  }
  // boucles supplémentaires
  for (const c of cells.values()) {
    for (const d of DIRS) {
      if (c.links & d.b) continue;
      const n = cells.get(cellKey(c.gx + d.dx, c.gz + d.dz));
      if (n && rnd() < 0.22) { c.links |= d.b; n.links |= d.o; }
    }
  }
  // distances depuis le départ (BFS) → salle du gardien = la plus éloignée
  const q = [start]; start.dist = 0; const seen = new Set([cellKey(start.gx, start.gz)]);
  while (q.length) {
    const c = q.shift();
    for (const d of DIRS) {
      if (!(c.links & d.b)) continue;
      const n = cells.get(cellKey(c.gx + d.dx, c.gz + d.dz));
      if (!n || seen.has(cellKey(n.gx, n.gz))) continue;
      n.dist = c.dist + 1; seen.add(cellKey(n.gx, n.gz)); q.push(n);
    }
  }
  let boss = start;
  for (const c of cells.values()) if (c.dist > boss.dist || (c.dist === boss.dist && rnd() < 0.5 && c !== start)) boss = c;
  boss.kind = 'boss';
  // forme des salles : donne de la variété à l'intérieur (anneau de colonnes, gravats, salle ouverte…)
  for (const c of cells.values()) c.shape = c.kind === 'room' ? ['open', 'ring', 'scatter', 'rows'][Math.floor(rnd() * 4)] : 'open';
  return { seed, cells, list: [...cells.values()], start, boss, rnd, style };
}

export function inLayout(layout, x, z) {
  const c = cellAt(x, z);
  return !!c && layout.cells.has(cellKey(c.gx, c.gz));
}

// ---------------------------------------------------------------- construction 3D
export function buildRiftWorld(world, layout, theme) {
  const group = new THREE.Group();
  world.group.add(group);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const rnd = mulberry32((layout.seed ^ 0x9e3779b9) >>> 0);
  const style = layout.style || 'crypt';
  const pal = RIFT_STYLES[style];
  const blend = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
  if (style !== 'crypt') theme = { ...theme, wall: blend(theme.wall, pal.wall, 0.6), floor: blend(theme.floor, pal.floor, 0.65) };
  const fogColor = pal.fog ? blend(theme.fog, pal.fog, 0.5) : theme.fog;
  const stoneTex = safeTexture(stoneTexture);
  if (stoneTex) { stoneTex.repeat.set(2, 2); }
  const mk = (color, extra = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...extra }));
  const floorMat = mk(theme.floor, { map: stoneTex || null, flatShading: false });
  const wallMat = mk(theme.wall, { map: stoneTex || null, flatShading: !stoneTex });
  const _seeLater = [wallMat];
  const trimMat = mk(new THREE.Color(theme.wall).multiplyScalar(0.7).getHex());
  // V3.8 (caméra aérienne) : les murs/piliers s'effacent (tramage) autour de la ligne de vue caméra → joueur
  const see = { uPlayer: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() }, uSeeOn: { value: 0 } };
  const makeSeeThrough = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPlayer = see.uPlayer; sh.uniforms.uCam = see.uCam; sh.uniforms.uSeeOn = see.uSeeOn;
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpv = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpv = instanceMatrix * wpv;
        #endif
        vWPos = (modelMatrix * wpv).xyz;`);
      sh.fragmentShader = 'varying vec3 vWPos;\nuniform vec3 uPlayer;\nuniform vec3 uCam;\nuniform float uSeeOn;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uSeeOn > 0.5) {
          vec3 ab = uPlayer + vec3(0.0, 1.0, 0.0) - uCam;
          float tt = clamp(dot(vWPos - uCam, ab) / dot(ab, ab), 0.0, 1.0);
          float dd = length(vWPos - (uCam + ab * tt));
          float rr = 2.7;
          if (tt < 0.985 && dd < rr) {
            float kk = smoothstep(rr, rr * 0.5, dd);
            float hh = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            if (hh < kk) discard;
          }
        }`);
    };
    mat.customProgramCacheKey = () => 'riftsee';
  };
  makeSeeThrough(trimMat); for (const m of _seeLater) makeSeeThrough(m);
  const crystalMat = track(new THREE.MeshBasicMaterial({ color: theme.color, fog: true }));
  const flameMat = track(new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false }));
  const dummy = new THREE.Object3D();
  const C = ARENA.cell;
  const colliders = [];
  const box = (x, z, hw, hd, y0, y1) => { world.addBox(x, z, hw, hd, y0, y1); colliders.push([x, z]); };

  // sols
  const floorGeo = track(new THREE.BoxGeometry(C - 0.05, 0.6, C - 0.05));
  const floors = new THREE.InstancedMesh(floorGeo, floorMat, layout.list.length);
  floors.receiveShadow = true;
  const col = new THREE.Color();
  layout.list.forEach((c, i) => {
    const p = cellCenter(c.gx, c.gz);
    dummy.position.set(p.x, -0.3, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    floors.setMatrixAt(i, dummy.matrix);
    col.setScalar(0.82 + rnd() * 0.3);
    floors.setColorAt(i, col);
  });
  floors.instanceMatrix.needsUpdate = true;
  if (floors.instanceColor) floors.instanceColor.needsUpdate = true;
  group.add(floors);

  // ------------------------------------------------------------ environnements alternatifs (ruines, caverne, cimetière, fournaise)
  let walls = null, pillars = null;
  const half = C / 2;
  const lavaPools = [];
  const buildStyled = () => {
    const half = C / 2, rr = (a, b) => a + rnd() * (b - a);
    const rockGeo = track(new THREE.IcosahedronGeometry(1, 0));
    const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
    const cylGeo = track(new THREE.CylinderGeometry(0.7, 1, 1, 7));
    const coneGeo = track(new THREE.ConeGeometry(1, 1, 6));
    const sphGeo = track(new THREE.IcosahedronGeometry(1, 1));
    const treeMat = mk(style === 'graveyard' ? 0x2a2622 : 0x3d4a2a);
    const barkMat = mk(0x3a2a1e);
    makeSeeThrough(treeMat); makeSeeThrough(barkMat);
    const items = { rock: [], box: [], cyl: [], cone: [], canopy: [], bark: [], stele: [] };
    const addRock = (x, z, sx, sy, sz, ry) => items.rock.push({ x, y: sy * 0.35, z, sx, sy, sz, ry });
    const addBox = (x, z, w, h, d, coll = true) => { items.box.push({ x, y: h / 2, z, sx: w, sy: h, sz: d, ry: 0 }); if (coll) box(x, z, w / 2, d / 2, -1, h + 2); };
    const addCyl = (x, z, r, h) => { items.cyl.push({ x, y: h / 2, z, sx: r, sy: h, sz: r, ry: 0 }); world.addCircle(x, z, r + 0.1); colliders.push([x, z]); };
    const avoidCenter = (c, x, z, R) => { const p = cellCenter(c.gx, c.gz); return Math.hypot(x - p.x, z - p.z) < R; };
    const nearAxis = (c, x, z, w) => { const p = cellCenter(c.gx, c.gz); return Math.abs(x - p.x) < w || Math.abs(z - p.z) < w; };

    for (const c of layout.list) {
      const p = cellCenter(c.gx, c.gz);
      const edges = [
        { b: 1, nx: 0, nz: -1, cx: p.x, cz: p.z - half, alongX: true },
        { b: 8, nx: -1, nz: 0, cx: p.x - half, cz: p.z, alongX: false },
        { b: 4, nx: 0, nz: 1, cx: p.x, cz: p.z + half, alongX: true, onlyIfNoNeighbour: true },
        { b: 2, nx: 1, nz: 0, cx: p.x + half, cz: p.z, alongX: false, onlyIfNoNeighbour: true }
      ];
      for (const e of edges) {
        const neighbour = layout.cells.has(cellKey(c.gx + e.nx, c.gz + e.nz));
        if (e.onlyIfNoNeighbour && neighbour) continue;
        const open = (c.links & e.b) !== 0;
        const step = style === 'cave' ? 2.6 : style === 'lava' ? 3 : 4;
        for (let t = -half + step / 2; t < half; t += step) {
          if (open && Math.abs(t) < DOOR_W / 2 + (style === 'cave' ? 0.6 : 0.2)) continue;
          const x = e.alongX ? e.cx + t : e.cx, z = e.alongX ? e.cz : e.cz + t;
          if (style === 'ruins') {
            if (neighbour && !open && Math.abs(t) > 4 && rnd() < 0.3) continue; // brèche dans la ruine (passage supplémentaire)
            const h = rnd() < 0.2 ? rr(4.6, 6.2) : rr(1.1, 3.6);
            addBox(x, z, e.alongX ? step + 0.05 : 1.5, h, e.alongX ? 1.5 : step + 0.05);
          } else if (style === 'graveyard') {
            if (neighbour && !open && Math.abs(t) > 4 && rnd() < 0.22) continue;
            addBox(x, z, e.alongX ? step + 0.05 : 0.9, rr(1.5, 2.3), e.alongX ? 0.9 : step + 0.05);
          } else if (style === 'cave') {
            const jx = e.alongX ? 0 : rr(-0.5, 0.5), jz = e.alongX ? rr(-0.5, 0.5) : 0;
            const sx = rr(1.7, 2.8), sy = rr(3, 6.8), sz = rr(1.7, 2.8);
            addRock(x + jx, z + jz, sx, sy, sz, rnd() * 3);
            world.addCircle(x + jx, z + jz, Math.max(sx, sz) * 0.95); colliders.push([x, z]);
          } else { // lava : crocs d'obsidienne
            const h = rr(3, 9);
            addBox(x, z, e.alongX ? step + 0.05 : rr(1.4, 2.4), h, e.alongX ? rr(1.4, 2.4) : step + 0.05);
          }
        }
        if (open) { // montants de porte
          for (const sgn of [-1, 1]) {
            const x = e.alongX ? e.cx + sgn * (DOOR_W / 2 + 0.4) : e.cx, z = e.alongX ? e.cz : e.cz + sgn * (DOOR_W / 2 + 0.4);
            if (style === 'cave') { addRock(x, z, 1.6, 4.5, 1.6, rnd() * 3); world.addCircle(x, z, 1.5); colliders.push([x, z]); }
            else addCyl(x, z, 0.8, style === 'graveyard' ? 3 : style === 'lava' ? 6 : rr(3.5, 6));
          }
        }
      }
      // ---- contenu intérieur de la salle (jamais dans l'axe des portes ni au centre)
      if (c.kind === 'start') continue;
      const boss = c.kind === 'boss';
      if (boss) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; addCyl(p.x + Math.cos(a) * 10, p.z + Math.sin(a) * 10, 0.9, style === 'cave' ? 5 : 6); } }
      const place = (n, R0, R1, fn) => { for (let k = 0, t = 0; k < n && t < n * 6; t++) { const a = rnd() * 6.2832, r = rr(R0, R1), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (Math.abs(x - p.x) > half - 2.5 || Math.abs(z - p.z) > half - 2.5) continue; if (nearAxis(c, x, z, 4.6) && r < 13) continue; fn(x, z); k++; } };
      if (!boss) {
        if (c.shape === 'ring') for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; addCyl(p.x + Math.cos(a) * 8.5, p.z + Math.sin(a) * 8.5, 0.8, rr(2.5, 5)); }
        else if (c.shape === 'rows') for (const sz of [-1, 1]) for (let i = -1; i <= 1; i += 2) addCyl(p.x + i * 8, p.z + sz * 8, 0.8, rr(3, 5));
      }
      if (style === 'ruins') {
        place(boss ? 0 : 3, 6, 13, (x, z) => { const h = rr(5, 8), s = rr(1.2, 1.7); items.bark.push({ x, y: h * 0.25, z, sx: 0.35, sy: h * 0.5, sz: 0.35, ry: 0 }); items.canopy.push({ x, y: h * 0.62, z, sx: s * 1.7, sy: s * 1.3, sz: s * 1.7, ry: rnd() * 3 }); world.addCircle(x, z, 0.5); colliders.push([x, z]); });
        place(boss ? 0 : 3, 6, 13, (x, z) => addRock(x, z, rr(0.8, 1.6), rr(0.7, 1.4), rr(0.8, 1.6), rnd() * 3));
      } else if (style === 'graveyard') {
        place(boss ? 4 : 10, 6, 13, (x, z) => { const h = rr(0.9, 1.5); items.stele.push({ x, y: h / 2, z, sx: 0.7, sy: h, sz: 0.25, ry: rr(-0.5, 0.5) }); world.addCircle(x, z, 0.4); colliders.push([x, z]); });
        place(boss ? 0 : 2, 6, 13, (x, z) => { const h = rr(3.5, 5.5); items.bark.push({ x, y: h / 2, z, sx: 0.3, sy: h, sz: 0.3, ry: 0 }); items.bark.push({ x: x + 0.5, y: h * 0.8, z, sx: 0.12, sy: 1.6, sz: 0.12, ry: 0, rz: 0.9 }); world.addCircle(x, z, 0.4); colliders.push([x, z]); });
      } else if (style === 'cave') {
        place(boss ? 3 : 7, 6, 13, (x, z) => { const h = rr(1.4, 3.4); items.cone.push({ x, y: h / 2, z, sx: rr(0.5, 0.9), sy: h, sz: rr(0.5, 0.9), ry: rnd() * 3 }); world.addCircle(x, z, 0.5); colliders.push([x, z]); });
      } else if (style === 'lava') {
        if (!boss) for (let k = 0; k < (rnd() < 0.7 ? 2 : 1); k++) {
          const a = Math.PI / 4 + Math.floor(rnd() * 4) * Math.PI / 2 + rr(-0.15, 0.15), r = rr(9, 11), R = rr(1.8, 2.7);
          const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
          if (lavaPools.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + R + 1)) continue;
          lavaPools.push({ x, z, r: R }); world.addCircle(x, z, R + 0.35); colliders.push([x, z]);
        }
        place(boss ? 0 : 4, 6, 13, (x, z) => { const h = rr(1.2, 3); items.cone.push({ x, y: h / 2, z, sx: rr(0.5, 0.9), sy: h, sz: rr(0.5, 0.9), ry: rnd() * 3 }); world.addCircle(x, z, 0.5); colliders.push([x, z]); });
      } else if (!boss) { // crypte : colonnes éparses déjà gérées par shape ; ajoute quelques gravats
        place(3, 6, 13, (x, z) => addRock(x, z, rr(0.7, 1.3), rr(0.6, 1.1), rr(0.7, 1.3), rnd() * 3));
      }
      void avoidCenter;
    }
    // instanciation
    const build = (arr, geo, mat, shadow = true) => {
      if (!arr.length) return null;
      const m = new THREE.InstancedMesh(geo, mat, arr.length);
      m.castShadow = shadow; m.receiveShadow = true;
      arr.forEach((o, i) => { dummy.position.set(o.x, o.y, o.z); dummy.scale.set(o.sx, o.sy, o.sz); dummy.rotation.set(0, o.ry || 0, o.rz || 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
      m.instanceMatrix.needsUpdate = true; group.add(m); styled.push(m); return m;
    };
    build(items.rock, rockGeo, wallMat); build(items.box, boxGeo, wallMat); build(items.cyl, cylGeo, trimMat);
    build(items.cone, coneGeo, trimMat); build(items.bark, cylGeo, barkMat); build(items.canopy, sphGeo, treeMat); build(items.stele, boxGeo, trimMat);
    // flaques de lave : disques lumineux
    if (lavaPools.length) {
      const lavaMat = track(new THREE.MeshBasicMaterial({ color: 0xff5a1a, fog: true }));
      const lg = track(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2));
      const lm = new THREE.InstancedMesh(lg, lavaMat, lavaPools.length);
      lavaPools.forEach((q, i) => { dummy.position.set(q.x, 0.04, q.z); dummy.scale.set(q.r, 1, q.r); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); lm.setMatrixAt(i, dummy.matrix); });
      lm.instanceMatrix.needsUpdate = true; group.add(lm); styled.push(lm); lavaMesh = lavaMat;
    }
  };
  const styled = []; let lavaMesh = null;
  if (style === 'crypt') {
  // murs : on collecte les segments (x, z, longueur, orientation)
  const segs = [];     // { x, z, w, d }  (largeur en x, profondeur en z)
  const posts = [];    // piliers de porte
  const half = C / 2;
  const stub = (C - DOOR_W) / 2;
  for (const c of layout.list) {
    const p = cellCenter(c.gx, c.gz);
    // on ne traite que N et W de chaque case + S/E si pas de voisin (évite les doublons)
    const edges = [
      { b: 1, nx: 0, nz: -1, cx: p.x, cz: p.z - half, alongX: true },
      { b: 8, nx: -1, nz: 0, cx: p.x - half, cz: p.z, alongX: false },
      { b: 4, nx: 0, nz: 1, cx: p.x, cz: p.z + half, alongX: true, onlyIfNoNeighbour: true },
      { b: 2, nx: 1, nz: 0, cx: p.x + half, cz: p.z, alongX: false, onlyIfNoNeighbour: true }
    ];
    for (const e of edges) {
      const hasNeighbour = layout.cells.has(cellKey(c.gx + e.nx, c.gz + e.nz));
      if (e.onlyIfNoNeighbour && hasNeighbour) continue;
      const open = (c.links & e.b) !== 0;
      if (!open) {
        segs.push(e.alongX ? { x: e.cx, z: e.cz, w: C + WALL_T, d: WALL_T } : { x: e.cx, z: e.cz, w: WALL_T, d: C + WALL_T });
      } else {
        const off = DOOR_W / 2 + stub / 2;
        for (const s of [-1, 1]) {
          segs.push(e.alongX ? { x: e.cx + s * off, z: e.cz, w: stub + WALL_T * 0.5, d: WALL_T } : { x: e.cx, z: e.cz + s * off, w: WALL_T, d: stub + WALL_T * 0.5 });
          posts.push(e.alongX ? { x: e.cx + s * (DOOR_W / 2), z: e.cz } : { x: e.cx, z: e.cz + s * (DOOR_W / 2) });
        }
        // linteau décoratif au-dessus de la porte
        segs.push({ x: e.cx, z: e.cz, w: e.alongX ? DOOR_W : WALL_T, d: e.alongX ? WALL_T : DOOR_W, lintel: true });
      }
    }
  }
  const wallGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const wallCount = segs.length;
  walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
  walls.castShadow = walls.receiveShadow = true;
  segs.forEach((s, i) => {
    if (s.lintel) {
      dummy.position.set(s.x, WALL_H - 0.9, s.z); dummy.scale.set(s.w, 1.8, s.d);
    } else {
      dummy.position.set(s.x, WALL_H / 2, s.z); dummy.scale.set(s.w, WALL_H, s.d);
      box(s.x, s.z, s.w / 2, s.d / 2, -1, WALL_H + 2);
    }
    dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix);
  });
  walls.instanceMatrix.needsUpdate = true;
  group.add(walls);

  // piliers (portes + décors) : cylindres
  const pillarSpots = posts.map((p) => ({ ...p, r: 0.95, h: WALL_H + 0.8 }));
  const decoPillars = [];
  for (const c of layout.list) {
    const p = cellCenter(c.gx, c.gz);
    if (c.kind === 'start') continue;
    const n = c.kind === 'boss' ? 4 : (rnd() < 0.55 ? 2 + Math.floor(rnd() * 3) : 0);
    for (let i = 0; i < n; i++) {
      const a = c.kind === 'boss' ? i * Math.PI / 2 + Math.PI / 4 : rnd() * Math.PI * 2;
      const r = c.kind === 'boss' ? 10 : 6 + rnd() * 6;
      const sp = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, r: 0.85, h: 4 + rnd() * 2.5 };
      decoPillars.push(sp);
      pillarSpots.push(sp);
    }
  }
  const pillarGeo = track(new THREE.CylinderGeometry(0.8, 1, 1, 8));
  pillars = new THREE.InstancedMesh(pillarGeo, trimMat, Math.max(1, pillarSpots.length));
  pillars.castShadow = pillars.receiveShadow = true;
  pillarSpots.forEach((s, i) => {
    dummy.position.set(s.x, s.h / 2, s.z); dummy.scale.set(s.r, s.h, s.r); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
    world.addCircle(s.x, s.z, s.r + 0.1); colliders.push([s.x, s.z]);
  });
  pillars.count = pillarSpots.length;
  pillars.instanceMatrix.needsUpdate = true;
  group.add(pillars);

  } else buildStyled();

  // cristaux d'éther (décor, sans collision)
  const crystalSpots = [];
  for (const c of layout.list) {
    const p = cellCenter(c.gx, c.gz);
    const n = (style === 'cave' ? 4 : style === 'lava' ? 3 : 2) + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const side = Math.floor(rnd() * 4), t = (rnd() - 0.5) * (C - 8);
      const off = half - 2.2;
      const x = p.x + (side === 0 ? t : side === 1 ? off : side === 2 ? t : -off);
      const z = p.z + (side === 0 ? -off : side === 1 ? t : side === 2 ? off : t);
      crystalSpots.push({ x, z, s: 0.6 + rnd() * 1.1, r: rnd() * 6 });
    }
  }
  const crystalGeo = track(new THREE.OctahedronGeometry(1, 0));
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalSpots.length);
  crystalSpots.forEach((s, i) => {
    dummy.position.set(s.x, s.s * 1.1, s.z); dummy.scale.set(s.s * 0.55, s.s * 1.5, s.s * 0.55); dummy.rotation.set(0.15, s.r, 0.1); dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);
  });
  crystals.instanceMatrix.needsUpdate = true;
  group.add(crystals);

  // torches : flammes instanciées + halos en un seul Points
  const torchSpots = [];
  for (const c of layout.list) {
    const p = cellCenter(c.gx, c.gz);
    // V6.1 : torches supprimées (aucun point ajouté)
    void p;
  }
  const stickGeo = track(new THREE.CylinderGeometry(0.07, 0.1, 2.0, 5));
  const sticks = new THREE.InstancedMesh(stickGeo, trimMat, torchSpots.length);
  const flameGeo = track(new THREE.SphereGeometry(0.22, 7, 5));
  const flames = new THREE.InstancedMesh(flameGeo, flameMat, torchSpots.length);
  const haloPos = new Float32Array(torchSpots.length * 3);
  torchSpots.forEach((s, i) => {
    dummy.position.set(s.x, 1, s.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); sticks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(s.x, 2.15, s.z); dummy.updateMatrix(); flames.setMatrixAt(i, dummy.matrix);
    haloPos[i * 3] = s.x; haloPos[i * 3 + 1] = 2.15; haloPos[i * 3 + 2] = s.z;
    world.addCircle(s.x, s.z, 0.25); colliders.push([s.x, s.z]);
  });
  group.add(sticks, flames);
  const glowTex = safeTexture(glowTexture, 64);
  let halos = null;
  if (glowTex) {
    const hg = track(new THREE.BufferGeometry());
    hg.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    halos = new THREE.Points(hg, track(new THREE.PointsMaterial({ map: glowTex, color: 0xff9a4a, size: 6, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    halos.frustumCulled = false;
    group.add(halos);
  }

  // runes au sol : départ (éther) et salle du gardien (couleur du thème)
  const ringTex = safeTexture(ringTexture), runeTex = safeTexture(runeTexture);
  const decals = [];
  const decal = (x, z, size, tex, color, opacity = 0.85) => {
    if (!tex) return null;
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(size, size)), track(new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); group.add(m); decals.push(m); return m;
  };
  const sp = cellCenter(layout.start.gx, layout.start.gz), bp = cellCenter(layout.boss.gx, layout.boss.gz);
  decal(sp.x, sp.z, 14, ringTex, 0x5ee6d0);
  decal(sp.x, sp.z, 9, runeTex, 0x5ee6d0, 0.6);
  decal(bp.x, bp.z, 24, ringTex, theme.color);
  decal(bp.x, bp.z, 16, runeTex, theme.color, 0.7);
  // estrade du gardien
  const dais = new THREE.Mesh(track(new THREE.CylinderGeometry(5.5, 6.2, 0.5, 14)), trimMat);
  dais.position.set(bp.x, 0.25, bp.z); dais.receiveShadow = true; group.add(dais);

  group.traverse((o) => { if (o.isInstancedMesh) o.frustumCulled = false; });

  let t = 0;
  return {
    group, start: sp, boss: bp, style, styleLabel: pal.label, fog: fogColor, floor: theme.floor, wall: theme.wall,
    // joueur / caméra : active la transparence des murs en vue aérienne
    seeThrough(playerPos, camPos, on) {
      see.uPlayer.value.copy(playerPos); see.uCam.value.copy(camPos); see.uSeeOn.value = on ? 1 : 0;
    },
    update(dt) {
      t += dt;
      if (decals[2]) decals[2].rotation.z += dt * 0.15;
      if (decals[3]) decals[3].rotation.z -= dt * 0.25;
      if (halos) halos.material.opacity = 0.7 + Math.sin(t * 7) * 0.1;
      if (lavaMesh) lavaMesh.color.setHSL(0.045 + Math.sin(t * 1.7) * 0.012, 1, 0.5 + Math.sin(t * 2.6) * 0.06);
    },
    dispose() {
      world.group.remove(group);
      // retire les colliders de la zone (grille spatiale du monde)
      world.clearColliders?.(ARENA.x - 140, ARENA.z - 140, ARENA.x + 140, ARENA.z + 140);
      for (const d of disposables) d.dispose?.();
      for (const m of styled) m.dispose?.(); floors.dispose(); walls?.dispose(); pillars?.dispose(); crystals.dispose(); sticks.dispose(); flames.dispose();
      stoneTex?.dispose?.();
    }
  };
}
