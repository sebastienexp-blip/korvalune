import * as THREE from 'three';
import { resolveItem } from '../inventory/Item.js';
import { makeLabel } from '../ui/Label.js';
import { ringTexture, safeTexture } from '../visual/Textures.js';

// Faisceau de lumière (V3.2) : colonne verticale additive au-dessus du butin rare, comme dans
// les ARPG — on repère le loot de loin. Géométrie/texture partagées entre tous les objets.
let _beamGeo = null, _beamTex, _ringTex;
const beamGeo = () => { if (!_beamGeo) { _beamGeo = new THREE.CylinderGeometry(0.1, 0.26, 1, 8, 1, true).translate(0, 0.5, 0); _beamGeo.userData.shared = true; } return _beamGeo; };
const beamTex = () => {
  if (_beamTex !== undefined) return _beamTex;
  _beamTex = safeTexture(() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  return _beamTex;
};
const groundRing = () => (_ringTex === undefined ? (_ringTex = safeTexture(ringTexture)) : _ringTex);

// Pré-chauffage : compile les shaders et envoie les textures au GPU une fois pour toutes (au chargement),
// pour qu'aucune compilation n'ait lieu pendant le jeu quand un objet apparaît.
export function warmupLoot(renderer, scene, camera, quality) {
  const made = [];
  try {
    for (const tier of [1, 4, 8, 13, 19, 25]) {
      const d = new LootDrop(scene, new THREE.Vector3(0, -500, 0), { gen: { uid: 'w' + tier, name: 'Warmup', icon: '•', type: 'armor', slot: 'chest', rarityTier: tier, itemLevel: 1, levelReq: 1, stats: {}, affixes: [], effects: [], value: 1, desc: '' } }, quality);
      made.push(d);
    }
    for (const t of [beamTex(), groundRing()]) if (t && renderer.initTexture) renderer.initTexture(t);
    for (const d of made) d.root.traverse((o) => { o.frustumCulled = false; if (o.material?.map && renderer.initTexture) renderer.initTexture(o.material.map); });
    if (renderer.compile) renderer.compile(scene, camera);
    renderer.render(scene, camera); // un rendu réel : envoie aussi géométries et textures
  } catch (e) { /* le pré-chauffage est facultatif */ }
  for (const d of made) { try { d.dispose(scene); } catch (e) { /* ignoré */ } }
}

// Objet physiquement posé au sol après la mort d'un ennemi ou l'ouverture d'un
// coffre : flotte légèrement, tourne doucement, teinté selon sa rareté (sur
// 25 paliers). Les objets de haute rareté gagnent progressivement une aura,
// des particules et une lumière plus marquées — réduites automatiquement
// selon la qualité graphique pour rester fluide sur mobile (voir `quality`).
// `item` = { defId, qty } (objet statique) ou { gen: {...} } (objet généré).
export class LootDrop {
  constructor(scene, pos, item, quality = 'high') {
    this.item = item;
    this.pos = pos.clone();
    this.t = Math.random() * 10;
    this.quality = quality;

    const view = resolveItem(item);
    const tier = view.rarityInfo.tier;
    const color = view.rarityInfo.color;
    const threeColor = new THREE.Color(color);
    const group = new THREE.Group();
    group.position.copy(this.pos);

    const lowFx = quality === 'verylow' || quality === 'low';
    const scale = 0.85 + Math.min(tier, 25) / 25 * 0.55;

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22 * scale, tier >= 13 ? 1 : 0),
      new THREE.MeshStandardMaterial({ color: threeColor, emissive: threeColor, emissiveIntensity: 0.55 + Math.min(tier, 20) * 0.03, roughness: 0.3, metalness: 0.3 })
    );
    core.position.y = 0.35;
    core.castShadow = true;
    group.add(core);
    this.core = core;

    // Aura : à partir des raretés moyennes (8+), un halo visible ; encore plus
    // marqué à partir de 16, désactivé en qualité réduite pour la performance.
    this.aura = null;
    if (tier >= 13 && !lowFx) {
      const auraGeo = new THREE.SphereGeometry(0.32 * scale, 10, 8);
      const auraMat = new THREE.MeshBasicMaterial({ color: threeColor, transparent: true, opacity: 0.16, depthWrite: false });
      this.aura = new THREE.Mesh(auraGeo, auraMat);
      this.aura.position.y = 0.35;
      group.add(this.aura);
    }

    // V7.4 : plus de PointLight par objet — ajouter/retirer une lumière dynamique force three.js à recompiler
    // les shaders de toute la scène (gros à-coup à chaque drop et à chaque ramassage). Le faisceau et l'aura suffisent.
    this.glow = null;

    // Particules ambiantes pour les raretés élevées (20+), optimisées mobile :
    // un seul petit système de points par objet, désactivé en qualité réduite.
    this.sparkles = null;
    if (tier >= 19 && !lowFx) {
      const n = quality === 'ultra' ? 14 : 8;
      const pos2 = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = 0.3 * scale;
        pos2[i * 3] = Math.cos(a) * r; pos2[i * 3 + 1] = 0.2 + Math.sin(a * 3) * 0.1; pos2[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
      this.sparkles = new THREE.Points(geo, new THREE.PointsMaterial({ color: threeColor, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false }));
      this.sparkles.position.y = 0.35;
      group.add(this.sparkles);
    }

    // faisceau + cercle au sol (raretés 6+, pas en qualité réduite)
    this.beam = null; this.ring = null; this.beam2 = null; this.rainbow = tier >= 25;
    if (tier >= 8 && (!lowFx || tier >= 13)) { // V8.0 : pas de faisceau sous Rare
      try {
        const bt = beamTex();
        if (bt) {
          // V8.5 : trois looks bien distincts (le blending additif saturait tout en blanc)
          //  Légendaire : fine colonne marron clair, opaque · Mythique : large colonne violette + cœur lumineux · Absolu : arc-en-ciel épais
          const h = tier >= 25 ? 22 : tier >= 19 ? 15 : tier >= 13 ? 8.5 : 2.6;
          this.beamH = h;
          this.beamW = tier >= 25 ? 2.2 : tier >= 19 ? 1.5 : tier >= 13 ? 0.8 : 0.9;
          this.beam2W = tier >= 25 ? 0.8 : 0.45;
          this.beamOp = tier >= 25 ? 0.62 : tier >= 19 ? 0.55 : tier >= 13 ? 0.62 : 0.3;
          this.beam = new THREE.Mesh(beamGeo(), new THREE.MeshBasicMaterial({ map: bt, color: threeColor, transparent: true, opacity: this.beamOp, depthWrite: false, blending: tier >= 13 ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
          this.beam.scale.set(this.beamW, h, this.beamW);
          this.beam.renderOrder = 2;
          group.add(this.beam);
          const rt = groundRing();
          if (rt) {
            this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: rt, color: threeColor, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
            this.ring.position.y = 0.06;
            group.add(this.ring);
          }
          // faisceau intérieur d'une 2e couleur (13+) : jumelage de teintes ; l'Absolu (25) passe par toutes les couleurs
          if (tier >= 19) {
            const c2 = new THREE.Color(color); const hsl = {}; c2.getHSL(hsl);
            c2.setHSL((hsl.h + 0.08) % 1, 1, 0.72);
            this.beam2 = new THREE.Mesh(beamGeo(), new THREE.MeshBasicMaterial({ map: bt, color: c2, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
            this.beam2.renderOrder = 3;
            group.add(this.beam2);
            this.rainbow = tier >= 25;
          }
        }
      } catch (e) { this.beam = null; this.ring = null; }
    }

    const qtyTxt = item.qty > 1 ? ' x' + item.qty : '';
    const label = makeLabel(`${view.icon} ${view.name}${qtyTxt}`, { color, size: 34, scale: 1.8, cache: true });
    label.position.y = 0.85;
    group.add(label);

    this.label = label;
    this.root = group;
    this.tier = tier;
    scene.add(group);
  }

  update(dt, camQuat) {
    this.t += dt;
    this.core.position.y = 0.35 + Math.sin(this.t * 2.2) * 0.08;
    this.core.rotation.y += dt * 1.4;
    if (this.aura) { this.aura.rotation.y -= dt * 0.6; this.aura.position.y = this.core.position.y; }
    if (this.sparkles) { this.sparkles.rotation.y += dt * 0.9; this.sparkles.position.y = this.core.position.y; }
    if (this.beam) {
      const pulse = 0.8 + Math.sin(this.t * 2.4) * 0.2;
      this.beam.material.opacity = this.beamOp * pulse;
      this.beam.rotation.y += dt * 0.5;
      { const w = this.beamW * (0.92 + Math.sin(this.t * 3.1) * 0.08); this.beam.scale.set(w, this.beamH * (0.95 + Math.sin(this.t * 1.7) * 0.05), w); }
      if (this.ring) { this.ring.material.opacity = (this.beamOp < 0.5 ? 0.2 : 0.35) + pulse * (this.beamOp < 0.5 ? 0.15 : 0.35); this.ring.rotation.y += dt * 0.4; }
      if (this.beam2) {
        const k = this.beam2W;
        this.beam2.rotation.y -= dt * 0.8;
        { const w2 = k * (0.9 + Math.sin(this.t * 4.1) * 0.1); this.beam2.scale.set(w2, this.beamH * (1.02 + Math.sin(this.t * 2.3) * 0.06), w2); }
      }
    }
    if (this.rainbow) { // Absolu : arc-en-ciel animé (faisceaux, anneau, noyau, aura, lumière, étincelles)
      const h = (this.t * 0.22) % 1;
      const set = (m, off, l = 0.58) => { if (m && m.material && m.material.color) m.material.color.setHSL((h + off) % 1, 1, l); };
      set(this.beam, 0); set(this.beam2, 0.33, 0.7); set(this.ring, 0.15); set(this.aura, 0.5); set(this.sparkles, 0.66);
      if (this.core.material.emissive) { this.core.material.color.setHSL(h, 1, 0.6); this.core.material.emissive.setHSL(h, 1, 0.5); }
      if (this.glow) this.glow.color.setHSL((h + 0.25) % 1, 1, 0.6);
    }
    if (camQuat) this.label.quaternion.copy(camQuat);
  }

  dispose(scene) {
    scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh || o.isPoints) { if (!o.geometry.userData?.shared) o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      if (o.isSprite) { if (!o.material.map?.userData?.shared) o.material.map?.dispose(); o.material.dispose(); }
    });
  }
}
