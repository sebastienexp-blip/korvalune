import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';
import { regionAt } from './Continent.js';
import { makeLabel } from '../ui/Label.js';

// V7.0 — Points d'intérêt du continent : repères visibles de loin, un ou deux par région,
// avec une zone aplanie autour pour que les bâtiments tiennent bien sur le relief.
export const POI_DEFS = [
  // Prairies (1-12)
  { id: 'windmill', name: 'Moulin de Brisevent', kind: 'windmill', at: [-75, -100], flat: 9 },
  { id: 'menhirs', name: 'Menhirs des Anciens', kind: 'menhirs', at: [-60, 110], flat: 12 },
  { id: 'farm', name: 'Ferme abandonnée', kind: 'farm', at: [135, -40], flat: 12 },
  { id: 'camp1', name: 'Campement des éclaireurs', kind: 'camp', at: [60, -95], flat: 8 },
  // Forêt des Ombres (10-24)
  { id: 'oldtree', name: 'Chêne des Ombres', kind: 'oldtree', at: [-215, 110], flat: 9 },
  { id: 'camp', name: 'Campement des chasseurs', kind: 'camp', at: [-160, -35], flat: 8 },
  { id: 'mossaltar', name: 'Autel moussu', kind: 'altar', at: [-262, 8], flat: 7 },
  { id: 'druids', name: 'Cercle des Druides', kind: 'menhirs', at: [-235, -75], flat: 12 },
  // Montagnes de Fer (15-32)
  { id: 'watch', name: 'Tour de guet du col', kind: 'watchtower', at: [12, 172], flat: 7 },
  { id: 'fortress', name: 'Forteresse naine en ruine', kind: 'fortress', at: [78, 240], flat: 17 },
  { id: 'stele', name: 'Stèle du Col', kind: 'altar', at: [30, 205], flat: 7 },
  // Désert d'Ambre (28-50)
  { id: 'caravan', name: 'Caravansérail abandonné', kind: 'camp', at: [205, 28], flat: 9 },
  { id: 'sandtemple', name: 'Temple ensablé', kind: 'temple', at: [272, 98], flat: 14 },
  { id: 'amber', name: "Obélisque d'Ambre", kind: 'obelisk', at: [300, 28], flat: 8 },
  { id: 'oasis', name: 'Oasis perdue', kind: 'fountain', at: [235, 125], flat: 10 },
  // Marais de Brume (40-65)
  { id: 'willow', name: 'Saule des Noyés', kind: 'oldtree', at: [-185, 240], flat: 9 },
  { id: 'witch', name: 'Autel de la Sorcière', kind: 'altar', at: [-130, 292], flat: 7 },
  { id: 'drowned', name: 'Phare englouti', kind: 'watchtower', at: [-235, 200], flat: 7 },
  { id: 'hamlet', name: 'Hameau englouti', kind: 'farm', at: [-115, 195], flat: 12 },
  // Toundra de Givre (55-80)
  { id: 'ice', name: 'Monolithe de glace', kind: 'monolith', at: [-15, -305], flat: 10 },
  { id: 'bastion', name: 'Bastion gelé', kind: 'fortress', at: [50, -345], flat: 17 },
  { id: 'trappers', name: 'Camp des trappeurs', kind: 'camp', at: [-75, -250], flat: 8 },
  { id: 'frostring', name: 'Cercle de givre', kind: 'menhirs', at: [40, -255], flat: 12 },
  // Terres Corrompues (75-105)
  { id: 'obelisk', name: 'Obélisque corrompu', kind: 'obelisk', at: [292, -250], flat: 8 },
  { id: 'cursed', name: 'Cercle maudit', kind: 'menhirs', at: [245, -190], flat: 12 },
  { id: 'bloodaltar', name: 'Autel de sang', kind: 'altar', at: [315, -200], flat: 7 },
  // Royaume Céleste (100-130)
  { id: 'gate', name: 'Arche dorée', kind: 'arch', at: [60, 335], flat: 9 },
  { id: 'fountain', name: "Fontaine d'astres", kind: 'fountain', at: [75, 378], flat: 10 },
  { id: 'temple', name: 'Temple en ruine', kind: 'temple', at: [25, 372], flat: 14 },
  // Abysses Oubliées (125-160)
  { id: 'burnt', name: 'Tour calcinée', kind: 'watchtower', at: [-340, -150], flat: 7, burnt: true },
  { id: 'maw', name: 'Gueule de lave', kind: 'maw', at: [-372, -215], flat: 12 },
  // Néant Primordial (150-200)
  { id: 'monolith', name: 'Monolithe du Néant', kind: 'monolith', at: [318, 268], flat: 10 },
  { id: 'ring', name: 'Anneau brisé', kind: 'ring', at: [275, 215], flat: 12 }
];

// Choisit pour chaque POI l'emplacement final (terre ferme, pente douce) AVANT la construction du terrain.
export function planLandmarks(world) {
  const wl = world.waterLevel;
  const out = [];
  for (const d of POI_DEFS) {
    let best = null, bestScore = Infinity;
    for (let r = 0; r <= 40 && !best; r += 4) {
      for (let k = 0; k < (r === 0 ? 1 : 12); k++) {
        const a = (k / 12) * 6.2832 + r;
        const x = d.at[0] + Math.cos(a) * r, z = d.at[1] + Math.sin(a) * r;
        const h = world._land0(x, z);
        if (h < wl + 1.2) continue;
        { let wet = false; for (let q = 0; q < 8 && !wet; q++) { const aa = q * Math.PI / 4; if (world._heightExact(x + Math.cos(aa) * d.flat, z + Math.sin(aa) * d.flat) < wl + 1.1) wet = true; } if (wet) continue; } // jamais les pieds dans l'eau
        let slope = 0;
        for (const [dx, dz] of [[d.flat, 0], [-d.flat, 0], [0, d.flat], [0, -d.flat]]) slope = Math.max(slope, Math.abs(world._land0(x + dx, z + dz) - h));
        if (Math.abs(world.riverX(z) - x) < 18 && Math.hypot(x, z) < 190) continue;
        const score = slope + r * 0.05;
        if (score < bestScore) { bestScore = score; best = { x, z, h }; }
      }
    }
    if (!best) best = { x: d.at[0], z: d.at[1], h: Math.max(wl + 1.5, world._land0(d.at[0], d.at[1])) };
    out.push({ ...d, x: best.x, z: best.z, h: best.h });
  }
  return out;
}

export function buildLandmarks(world) {
  const root = new THREE.Group();
  world.group.add(root);
  const rnd = mulberry32(777);
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, flatShading: true, ...extra });
  const stone = mat(0x77746c), dark = mat(0x4a4843), moss = mat(0x56624a), marble = mat(0xeee6d2, { roughness: 0.55 }), gold = mat(0xd9b24a, { metalness: 0.5, roughness: 0.4 });
  const obsidian = mat(0x1c1618, { emissive: 0x3a0e06, emissiveIntensity: 0.6 });
  const wood = mat(0x5a3d26), roof = mat(0x7a4a32), cloth = mat(0x8a4a3a);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const anim = [];

  for (const p of world.pois) {
    const g = new THREE.Group();
    // V9.2 : la structure repose sur le point le plus BAS de son emprise (rien ne flotte ; le côté haut s'enfonce un peu dans le sol)
    let y = world.heightAt(p.x, p.z);
    { const rr = Math.min(p.flat || 8, 12) * 0.8; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; y = Math.min(y, world.heightAt(p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr)); } }
    g.position.set(p.x, y, p.z);
    root.add(g);
    const add = (geo, m, x, yy, z, ry = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, yy, z); o.rotation.y = ry; o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const col = (x, z, r) => world.addCircle(p.x + x, p.z + z, r);
    const box = (x, z, hw, hd, h) => world.addBox(p.x + x, p.z + z, hw, hd, y - 1, y + h);
    const cyl = (r0, r1, h, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg);
    const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    switch (p.kind) {
      case 'windmill': {
        add(cyl(2.4, 3.2, 8, 8), stone, 0, 4, 0); add(new THREE.ConeGeometry(3.4, 3, 8), roof, 0, 9.4, 0);
        const hub = new THREE.Group(); hub.position.set(0, 8, 3.2); g.add(hub);
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(bx(0.5, 7, 0.15), wood); b.position.y = 0; const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; b.position.y = 3.6; arm.add(b); hub.add(arm); }
        anim.push((t) => { hub.rotation.z = t * 0.4; });
        col(0, 0, 3.4); break;
      }
      case 'menhirs': {
        const n = 9;
        for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832, r = 7, h = 3 + rnd() * 3; add(bx(1.3, h, 0.9), stone, Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r, -a + rnd() * 0.3); col(Math.cos(a) * r, Math.sin(a) * r, 0.9); }
        add(cyl(1.6, 1.9, 0.7, 7), dark, 0, 0.3, 0); break;
      }
      case 'farm': {
        for (const [x, z, w, d] of [[-5, -4, 8, 0.8], [-5, 4, 8, 0.8], [-9, 0, 0.8, 8]]) { const h = 1.8 + rnd() * 2.2; add(bx(w, h, d), mat(0x8a7a62), x, h / 2, z); box(x, z, w / 2, d / 2, h); }
        add(new THREE.ConeGeometry(4.6, 2.2, 4), roof, 4, 4.5, 0, Math.PI / 4); add(bx(5, 3.4, 5), mat(0x7a6a54), 4, 1.7, 0); box(4, 0, 2.5, 2.5, 4); break;
      }
      case 'oldtree': {
        add(cyl(1.8, 2.8, 12, 8), wood, 0, 6, 0); col(0, 0, 3);
        for (const [x, yy, z, s] of [[0, 14, 0, 7.5], [4, 12, 2, 5], [-4, 12.5, -2, 5.5], [1, 17, -2, 4.5]]) add(new THREE.IcosahedronGeometry(s, 1), mat(0x2e4a2a), x, yy, z);
        break;
      }
      case 'camp': {
        for (let i = 0; i < 3; i++) { const a = i * 2.1; add(new THREE.ConeGeometry(2, 2.8, 4), cloth, Math.cos(a) * 5, 1.4, Math.sin(a) * 5, a); col(Math.cos(a) * 5, Math.sin(a) * 5, 1.6); }
        add(cyl(0.9, 1, 0.3, 8), dark, 0, 0.15, 0); const fl = add(new THREE.ConeGeometry(0.5, 1.2, 6), glow(0xff7a2a), 0, 0.9, 0);
        anim.push((t) => { fl.scale.set(1, 0.85 + Math.sin(t * 9) * 0.2, 1); });
        break;
      }
      case 'altar': {
        const m = p.id === 'bloodaltar' ? mat(0x4a1c20) : moss;
        add(bx(4, 1.1, 2.2), m, 0, 0.55, 0); add(bx(3.4, 0.4, 1.8), dark, 0, 1.3, 0); box(0, 0, 2, 1.1, 1.6);
        for (const sx of [-1, 1]) add(bx(0.5, 3.2, 0.5), m, sx * 2.6, 1.6, 0);
        if (p.id === 'bloodaltar') add(new THREE.OctahedronGeometry(0.5), glow(0xff3a3a), 0, 2, 0);
        break;
      }
      case 'fortress': {
        const R = 13;
        for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.2832; if (Math.cos(a) > 0.85) continue; const h = 3 + rnd() * 3.5; add(bx(5.6, h, 1.4), mat(0x6a6860), Math.cos(a) * R, h / 2, Math.sin(a) * R, -a + Math.PI / 2); box(Math.cos(a) * R, Math.sin(a) * R, 2.8, 2.8, h); }
        for (const a of [0.8, 2.4, 3.9, 5.5]) { const x = Math.cos(a) * R, z = Math.sin(a) * R; add(cyl(2, 2.4, 8, 8), stone, x, 4, z); col(x, z, 2.5); }
        add(bx(5, 4, 5), dark, 0, 2, 0); box(0, 0, 2.5, 2.5, 4); break;
      }
      case 'watchtower': {
        add(cyl(2, 2.6, 9, 7), p.burnt ? mat(0x2a2220) : stone, 0, 4.5, 0); col(0, 0, 2.8);
        if (!p.burnt) add(new THREE.ConeGeometry(3, 2.4, 7), roof, 0, 10.2, 0);
        else { const fl = add(new THREE.ConeGeometry(1, 2.2, 6), glow(0xff5a1a), 0, 10, 0); anim.push((t) => { fl.scale.set(1, 0.8 + Math.sin(t * 8) * 0.25, 1); }); }
        break;
      }
      case 'obelisk': {
        const o = add(new THREE.OctahedronGeometry(1, 0), mat(0x6a2fb0, { emissive: 0x7a35d0, emissiveIntensity: 0.9 }), 0, 7, 0, 0, 1.5, 7, 1.5); col(0, 0, 1.6);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; add(new THREE.OctahedronGeometry(1, 0), mat(0x7d3fc0, { emissive: 0x6a2bb0, emissiveIntensity: 0.8 }), Math.cos(a) * 3.5, 1.5, Math.sin(a) * 3.5, 0, 0.6, 2 + rnd() * 1.5, 0.6); }
        anim.push((t) => { o.rotation.y = t * 0.5; }); break;
      }
      case 'arch': {
        for (const sx of [-1, 1]) { add(cyl(0.9, 1.1, 8, 8), marble, sx * 5, 4, 0); col(sx * 5, 0, 1.1); }
        add(new THREE.TorusGeometry(5, 0.7, 8, 20, Math.PI), gold, 0, 8, 0); break;
      }
      case 'fountain': {
        add(cyl(4.5, 5, 0.9, 14), marble, 0, 0.45, 0); add(cyl(3.8, 3.8, 0.4, 14), mat(0x6fb6e0, { emissive: 0x2a6a9a, emissiveIntensity: 0.6 }), 0, 0.85, 0); add(cyl(0.6, 0.9, 3, 8), marble, 0, 1.9, 0);
        const orb = add(new THREE.IcosahedronGeometry(0.8, 1), glow(0xfff0b0), 0, 4, 0); anim.push((t) => { orb.position.y = 4 + Math.sin(t * 1.6) * 0.3; orb.rotation.y = t; }); col(0, 0, 5); break;
      }
      case 'temple': {
        add(bx(14, 0.8, 11), marble, 0, 0.4, 0);
        for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) { if (rnd() < 0.2) continue; const h = rnd() < 0.3 ? 2.5 : 6.5; add(cyl(0.6, 0.7, h, 8), marble, -5.5 + i * 2.2, 0.8 + h / 2, sz * 4.4); col(-5.5 + i * 2.2, sz * 4.4, 0.8); }
        add(bx(6, 0.5, 3), gold, 0, 1.0, -2); break;
      }
      case 'maw': {
        add(new THREE.CircleGeometry(5, 18).rotateX(-Math.PI / 2), glow(0xff4a14), 0, 0.12, 0);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832, h = 3 + rnd() * 5; add(new THREE.ConeGeometry(0.9, h, 5), obsidian, Math.cos(a) * 6.4, h / 2, Math.sin(a) * 6.4, 0); col(Math.cos(a) * 6.4, Math.sin(a) * 6.4, 0.8); }
        break;
      }
      case 'monolith': {
        const m = add(bx(3.2, 18, 1.6), mat(0x1d1a22, { emissive: 0x3a1a08, emissiveIntensity: 0.6 }), 0, 9, 0, 0.3); box(0, 0, 2, 1.4, 18);
        const rune = add(bx(0.5, 6, 0.1), glow(0xff8a3a), 0, 10, 0.85, 0.3); anim.push((t) => { rune.material.color.setHSL(0.07, 1, 0.45 + Math.sin(t * 2) * 0.1); }); void m; break;
      }
      case 'ring': {
        for (let i = 0; i < 14; i++) { if (i % 5 === 4) continue; const a = (i / 14) * 6.2832, h = 3 + rnd() * 4; add(bx(2.2, h, 1.2), mat(0x2b2530), Math.cos(a) * 9, h / 2, Math.sin(a) * 9, -a, 1, 1, 1); col(Math.cos(a) * 9, Math.sin(a) * 9, 1.2); }
        add(new THREE.RingGeometry(3, 8, 24).rotateX(-Math.PI / 2), glow(0x7a3a10), 0, 0.1, 0); break;
      }
      default: break;
    }
    // faisceau discret au-dessus du repère pour le repérer de loin
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 22, 6, 1, true).translate(0, 11, 0), new THREE.MeshBasicMaterial({ color: p.color || 0xcfe8ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    if (p.kind === 'fortress' || p.kind === 'temple' || p.kind === 'obelisk' || p.kind === 'monolith' || p.kind === 'maw' || p.kind === 'fountain') g.add(beam);
  }
  try { buildBorderGates(world, root, mat); } catch (e) { console.warn('[V8] portiques de frontière indisponibles', e); }
  return { group: root, update(t) { for (const f of anim) f(t); }, dispose() { world.group.remove(root); } };
}


// V8.0 — Portiques de frontière : là où une route franchit la limite d'une région, une grande arche de pierre annonce
// le nom de la nouvelle région et sa tranche de niveaux (bannière à la couleur de la région).
function buildBorderGates(world, root, mat) {
  const stone = mat(0x6d6a63), dark = mat(0x4b4944);
  const placed = [];
  for (const poly of world._roadPolys || []) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      const ra = regionAt(a[0], a[1]);
      if (regionAt(b[0], b[1]) === ra) continue;
      let lo = 0, hi = 1;
      for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (regionAt(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m) === ra) lo = m; else hi = m; }
      const x = a[0] + (b[0] - a[0]) * hi, z = a[1] + (b[1] - a[1]) * hi;
      if (Math.hypot(x, z) < 70 || placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < 60)) continue;
      placed.push([x, z]);
      const rb = regionAt(b[0], b[1]);
      const phi = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const g = new THREE.Group();
      g.position.set(x, world.heightAt(x, z), z);
      g.rotation.y = phi;
      const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
      for (const sx of [-5.6, 5.6]) {
        add(new THREE.BoxGeometry(1.8, 8, 1.8), stone, sx, 4, 0);
        add(new THREE.BoxGeometry(2.4, 0.8, 2.4), dark, sx, 0.4, 0);
        add(new THREE.BoxGeometry(2.4, 0.7, 2.4), dark, sx, 8.2, 0);
        world.addCircle(x + Math.cos(phi) * sx, z - Math.sin(phi) * sx, 1.1);
      }
      add(new THREE.BoxGeometry(13.4, 1.3, 1.9), stone, 0, 8.4, 0);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.6), new THREE.MeshStandardMaterial({ color: new THREE.Color(rb.color), roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(rb.color), emissiveIntensity: 0.18 }));
      cloth.position.set(0, 6.5, 0.05); g.add(cloth);
      try {
        const lb = makeLabel(`${rb.name} — niv. ${rb.levels[0]}-${rb.levels[1]}`, { color: rb.color, size: 40, width: 768, height: 96, scale: 7.5 });
        lb.position.set(0, 10.6, 0); g.add(lb);
      } catch (e) { /* étiquette facultative */ }
      root.add(g);
    }
  }
}
