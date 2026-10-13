// V10.44 — Tête du personnage joueur en modèles 3D (.glb) : visage (12 têtes homme/femme × 6 formes), yeux (5), nez (5), lèvres, sourcils,
// oreilles par race, 22 coiffures et 5 barbes — tout est de la géométrie modélisée (tools/models/head_geo.py, hair_geo.py), teintée par
// rôle de sommet : peau (0.8), cheveux (0.6), iris (0.4). Rien n'est généré par code ici : on assemble des modules.
import * as THREE from 'three';
import { ModelLibrary } from './ModelLibrary.js';
import { FACE_SHAPES, byId, normalizeLook } from '../data/looks.js';
import { RACES } from '../combat/Classes.js';

const EAR = { human: 'humaine', dwarf: 'humaine', elf: 'elfe', sylvan: 'elfe', orc: 'orque' };
export const raceOfSkin = (skin) => (Object.values(RACES).find((r) => r.skin === skin) || RACES.human).id;

export function modeledHeadAvailable() {
  return ModelLibrary.hasTown(['tete_homme_ovale', 'tete_femme_ovale', 'oeil_homme_normaux', 'nez_homme_droit', 'levres_homme', 'sourcil_homme', 'oreille_humaine', 'coiffure_classique']);
}

// échelle de la tête modélisée dans le repère « tête » du jeu (repère historique : la tête procédurale mesurait ~0.8 de ce repère)
export const HEAD_FACE_SCALE = 1.5;

/** Assemble la tête. Renvoie { group, hair, beard, look, skinMats } ou null si les modèles ne sont pas chargés. */
export function buildModeledHead({ skin = 0xd9a98b, hair = 0x2c1f16, eye = 0x3f78b0, look, race } = {}) {
  if (!modeledHeadAvailable()) return null;
  const lk = normalizeLook(look), fem = lk.sex === 'femme', sx = fem ? 'femme' : 'homme';
  const fs = byId(FACE_SHAPES, lk.face), rc = race || raceOfSkin(skin);
  const tint = { wall: skin, roof: hair, trim: eye };
  const skinMats = [];
  const inst = (kind, shadow = false) => {
    if (!ModelLibrary.hasTown([kind])) return null;
    const g = ModelLibrary.townInstance(kind, { tint, shadow });
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      o.material = o.material.clone();                 // matériaux propres au personnage (fantôme, teinte de peau des cosmétiques)
      if (o.material.name === 'peau') skinMats.push(o.material);
    });
    return g;
  };
  const g = new THREE.Group(); g.name = 'head_modeled';
  const put = (o, fn) => { if (o) { fn && fn(o); g.add(o); } return o; };
  put(inst(`tete_${sx}_${lk.face}`, true));
  const eyeKind = `oeil_${sx}_${lk.eyes}`;
  put(inst(eyeKind)); put(inst(eyeKind), (o) => { o.scale.x = -1; });
  put(inst(`nez_${sx}_${lk.nose}`));
  const jw = fs.jaw[0] * (fem ? 0.94 : 1);
  put(inst(`levres_${sx}`), (o) => { o.scale.x = Math.min(1.1, 0.6 + 0.4 * jw); });
  put(inst(`sourcil_${sx}`)); put(inst(`sourcil_${sx}`), (o) => { o.scale.x = -1; });
  const earKind = `oreille_${EAR[rc] || 'humaine'}`, ex = 0.0715 * fs.skull[0] * (fem ? 0.955 : 1);
  for (const sg of [1, -1]) put(inst(earKind, true), (o) => { o.position.set(sg * ex, -0.004, -0.012); o.scale.x = sg; });
  if (rc === 'orc') put(inst('crocs_orque'));
  // coiffure (suit l'ampleur du crâne) et barbe (suit la mâchoire)
  let hairG = null, beardG = null;
  if (lk.hair !== 'chauve') {
    hairG = inst(`coiffure_${lk.hair}`, true);
    if (hairG) { hairG.scale.set(fs.skull[0] * (fem ? 0.955 : 1), fs.skull[1] * (fem ? 0.97 : 1), fem ? 0.955 : 1); g.add(hairG); }
  }
  if (lk.beard !== 'aucune') {
    beardG = inst(`barbe_${lk.beard}`, true);
    if (beardG) { beardG.scale.set(jw, fs.jaw[1] * (fem ? 0.97 : 1), fem ? 0.955 : 1); g.add(beardG); }
  }
  return { group: g, hair: hairG, beard: beardG, look: lk, skinMats };
}

/** Teinte de peau d'un cosmétique (peau de zombie, de spectre…) : multiplie la couleur des matériaux de la tête pour atteindre `hex`. */
export function tintHeadSkin(rig, hex, base) {
  if (!rig.headSkinMats) return;
  const b = new THREE.Color(base ?? rig.headSkinBase ?? 0xd9a98b), t = new THREE.Color(hex);
  for (const m of rig.headSkinMats) m.color.setRGB(t.r / Math.max(b.r, 0.02), t.g / Math.max(b.g, 0.02), t.b / Math.max(b.b, 0.02));
}
