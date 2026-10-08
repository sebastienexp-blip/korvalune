import * as THREE from 'three';
import { clamp, lerp } from '../core/math.js';
import { glowTexture, safeTexture } from '../visual/Textures.js';
import { updateWeaponAura } from '../visual/WeaponAura.js';
import { createHumanoidLegacy } from './HumanoidLegacy.js';
import { createBow } from './Bow.js';
import { createStaff } from './Staff.js';
import { tryCreateGlbRig, animateGlbRig } from '../visual/ModelLibrary.js';

let _glowTex;
const glowTex = () => (_glowTex === undefined ? (_glowTex = safeTexture(glowTexture, 64)) : _glowTex);

// Personnage humanoïde procédural. Regarde vers +Z. Le rig retourné expose
// des pivots nommés : remplaçable plus tard par un GLB en gardant animateHumanoid().
//
// Équipement visible : toutes les pièces possibles (armes, bouclier, casque,
// épaulières, plastron, cape) sont créées d'emblée mais certaines peuvent être
// cachées (.visible=false) — voir equipVisible pour l'état initial, et
// Player.refreshGearVisuals() pour la mise à jour dynamique selon l'équipement
// réellement porté. Les PNJ/ennemis n'appellent jamais refreshGearVisuals : ils
// gardent l'apparence par défaut (equipVisible, true sauf indication contraire).
export function createHumanoid(opts = {}) {
  if (opts.role) {
    try { const glb = tryCreateGlbRig('humanoid', opts); if (glb) return glb; } catch (e) { console.warn('[V3] modèle GLB ignoré (humanoïde)', e); }
  }
  try { return createHumanoidV25(opts); } catch (e) {
    console.warn('[V2.5] modèle humanoïde classique utilisé', e);
    return createHumanoidLegacy(opts);
  }
}

function createHumanoidV25(opts = {}) {
  const o = {
    skin: 0xd9a98b, hair: 0x3b2a20, cloth: 0x2f4a7a, armor: 0x9aa3ad, leather: 0x5a3a22, cape: 0x7a1f2b,
    shield: true, weaponVisual: 'sword', equipVisible: true, scale: 1, ...opts
  };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
  const skin = mat(o.skin, { roughness: 0.7 }), hair = mat(o.hair, { roughness: 0.78 });
  { const ht = hairTexture(o.hair); if (ht) { hair.map = ht; hair.color.set(0xffffff); } }
  const cloth = mat(o.cloth), leather = mat(o.leather, { roughness: 0.9 });
  const steel = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const chestMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const helmMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const shoulderMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const capeMat = mat(o.cape, { side: THREE.DoubleSide });
  const dark = mat(0x15110e);
  const eyeWhite = mat(0xf2f2ee, { roughness: 0.4 });
  const trimMat = mat(0xc9a74a, { roughness: 0.35, metalness: 0.7 });
  const buckleMat = mat(0xcfb25a, { roughness: 0.3, metalness: 0.8 });
  const clothDark = mat(new THREE.Color(o.cloth).multiplyScalar(0.7).getHex(), { side: THREE.DoubleSide });
  const swordBladeMat = mat(0xd7dde3, { roughness: 0.2, metalness: 0.95 });
  const daggerBladeMat = mat(0xd7dde3, { roughness: 0.2, metalness: 0.95 });
  const staffWoodMat = mat(0x5a3a22, { roughness: 0.85 });
  const bowWoodMat = mat(0x5a3a22, { roughness: 0.85 });
  const staffGemMat = mat(0x6ab0ff, { emissive: 0x3a7fd9, emissiveIntensity: 0.8, roughness: 0.3 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (geo, m, parent, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  const ell = (geo, m, parent, x, y, z, sx, sy, sz) => { const me = add(geo, m, parent, x, y, z); me.scale.set(sx, sy, sz); return me; };
  ell(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 12), cloth, hips, 0, 0, 0, 1.15, 1, 0.72);
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);
  ell(new THREE.CylinderGeometry(0.235, 0.19, 0.52, 14), cloth, torso, 0, 0.4, 0, 1.12, 1, 0.68);
  const chestPlate = ell(new THREE.CylinderGeometry(0.25, 0.2, 0.34, 14), chestMat, torso, 0, 0.5, 0, 1.12, 1, 0.78);
  // bordure et nervure du plastron (enfants : suivent la visibilité du plastron)
  const plateTrim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.016, 5, 16), trimMat);
  plateTrim.rotation.x = Math.PI / 2; plateTrim.position.y = -0.17; plateTrim.scale.set(1.12, 0.78, 1);
  chestPlate.add(plateTrim);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.02), trimMat);
  ridge.position.set(0, 0, 0.2); chestPlate.add(ridge);
  // ceinture + boucle + bourse
  ell(new THREE.CylinderGeometry(0.205, 0.205, 0.075, 14), leather, torso, 0, 0.14, 0, 1.15, 1, 0.74);
  add(new THREE.BoxGeometry(0.075, 0.075, 0.03), buckleMat, torso, 0, 0.14, 0.2);
  add(new THREE.BoxGeometry(0.1, 0.12, 0.07), leather, torso, 0.22, 0.08, 0.1);
  // pans de tissu avant/arrière (tabard)
  const tabF = add(new THREE.BoxGeometry(0.2, 0.34, 0.015), clothDark, hips, 0, -0.2, 0.17);
  const tabB = add(new THREE.BoxGeometry(0.24, 0.34, 0.015), clothDark, hips, 0, -0.2, -0.17);
  tabF.rotation.x = -0.06; tabB.rotation.x = 0.06;
  add(new THREE.CylinderGeometry(0.052, 0.062, 0.12, 10), skin, torso, 0, 0.7, 0);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 14), clothDark); // col du vêtement
  collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.665, 0); collar.scale.set(1, 1.05, 0.8); collar.castShadow = true; torso.add(collar);
  for (const sx of [-1, 1]) { // bretelles de cuir croisées sur la poitrine + rivets
    const strap = add(new THREE.BoxGeometry(0.035, 0.34, 0.012), leather, torso, sx * 0.09, 0.47, 0.158);
    strap.rotation.z = sx * -0.28;
    add(new THREE.SphereGeometry(0.012, 5, 4), buckleMat, torso, sx * 0.075, 0.55, 0.166);
  }
  add(new THREE.BoxGeometry(0.06, 0.05, 0.02), leather, torso, 0, 0.5, 0.168); // anneau central

  const head = new THREE.Group();
  head.position.set(0, 0.86, 0);
  torso.add(head);
  const skull = add(new THREE.SphereGeometry(0.14, 22, 16), skin, head);
  skull.scale.set(0.96, 1.06, 1);
  buildFace(head, { skin, hair, o });
  const hairMesh = add(new THREE.SphereGeometry(0.152, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.31), hair, head, 0, 0.012, -0.012); // calotte : laisse le front dégagé
  // chevelure : arrière + frange + mèches + queue (enfants de hairMesh)
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, Math.PI - 0.55, Math.PI + 1.1, Math.PI * 0.27, Math.PI * 0.5), hair); // nuque et côtés uniquement
  hairBack.position.set(0, -0.0, -0.03); hairBack.castShadow = true; hairMesh.add(hairBack);
  // frange balayée vers un côté, mèches de longueurs variées, avec une raie
  const LOCKS = [[-3, 0.05, 0.5], [-2, 0.065, 0.42], [-1, 0.07, 0.3], [0, 0.075, 0.12], [1, 0.07, -0.05], [2, 0.058, -0.2], [3, 0.045, -0.35]];
  for (const [i, len, sweep] of LOCKS) {
    const x = i * 0.03, z = Math.sqrt(Math.max(0.0005, 0.152 * 0.152 - 0.087 * 0.087 - x * x)) - 0.004;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.019, len, 5), hair);
    f.position.set(x + sweep * 0.012, 0.087 - len / 2 + 0.01, z);
    f.rotation.set(Math.PI - 0.3, 0, sweep * 0.9 + Math.PI * 0 + (i * 0.04)); f.castShadow = true; hairMesh.add(f);
  }
  // volume du dessus (mèches ramenées vers l'arrière)
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), hair);
  crown.scale.set(1.28, 0.62, 1.35); crown.position.set(0, 0.105, -0.02); crown.castShadow = true; hairMesh.add(crown);
  const quiff = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.09, 3, 8), hair);
  quiff.position.set(0.012, 0.125, 0.065); quiff.rotation.set(-1.0, 0, 0.22); quiff.castShadow = true; hairMesh.add(quiff);
  for (const sx of [-1, 1]) { // mèches latérales devant les oreilles
    const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.09, 3, 6), hair);
    side.position.set(sx * 0.122, 0.01, 0.06); side.rotation.z = sx * 0.12; side.castShadow = true; hairMesh.add(side);
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.06, 3, 6), hair);
    sb.position.set(sx * 0.13, -0.02, -0.03); sb.castShadow = true; hairMesh.add(sb);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.13, 3, 6), hair);
  tail.position.set(0, -0.13, -0.17); tail.rotation.x = 0.35; tail.castShadow = true; hairMesh.add(tail);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 4, 8), trimMat);
  tie.position.set(0, -0.075, -0.155); tie.rotation.x = 0.35 + Math.PI / 2; hairMesh.add(tie);

  // Casque (emplacement "tête") : recouvre les cheveux quand équipé.
  const helm = new THREE.Group();
  head.add(helm);
  add(new THREE.SphereGeometry(0.158, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), helmMat, helm, 0, 0.015, -0.01);
  add(new THREE.BoxGeometry(0.19, 0.05, 0.04), helmMat, helm, 0, 0.04, 0.125);
  add(new THREE.BoxGeometry(0.025, 0.1, 0.04), helmMat, helm, 0, -0.02, 0.15); // protège-nez
  add(new THREE.BoxGeometry(0.02, 0.1, 0.3), trimMat, helm, 0, 0.16, 0); // crête
  add(new THREE.TorusGeometry(0.157, 0.012, 5, 18), trimMat, helm, 0, -0.01, 0).rotation.x = Math.PI / 2;

  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.33, 0.62, 0);
    torso.add(pivot);
    add(new THREE.CapsuleGeometry(0.06, 0.2, 5, 10), cloth, pivot, 0, -0.14, 0); // bras
    add(new THREE.SphereGeometry(0.11, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.6), steel, pivot, 0, 0.02, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    pivot.add(elbow);
    add(new THREE.SphereGeometry(0.056, 8, 6), cloth, elbow, 0, 0, 0);
    add(new THREE.CapsuleGeometry(0.052, 0.2, 5, 10), cloth, elbow, 0, -0.14, 0); // avant-bras
    add(new THREE.CylinderGeometry(0.066, 0.056, 0.2, 10), steel, elbow, 0, -0.15, 0); // brassard
    add(new THREE.TorusGeometry(0.062, 0.01, 4, 10), trimMat, elbow, 0, -0.06, 0).rotation.x = Math.PI / 2;
    const hand = new THREE.Group();
    hand.position.y = -0.3;
    elbow.add(hand);
    add(new THREE.SphereGeometry(0.06, 10, 8), leather, hand); // gant
    add(new THREE.BoxGeometry(0.1, 0.03, 0.034), trimMat, hand, 0, 0.0, 0.0).scale.set(0.8, 0.5, 1.7); // dos du gant
    add(new THREE.CapsuleGeometry(0.014, 0.03, 2, 5), leather, hand, 0, -0.05, 0.035).rotation.x = -0.4; // pouce
    add(new THREE.CylinderGeometry(0.066, 0.06, 0.05, 8), leather, hand, 0, 0.06, 0);
    return { pivot, elbow, hand };
  };
  const armR = makeArm(-1); // main droite du personnage (regarde vers +Z)
  const armL = makeArm(1);

  // Épaulières (emplacement "épaules")
  const makeShoulder = (arm, side) => {
    const pad = add(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), shoulderMat, arm.pivot, 0, 0.1, 0);
    pad.scale.set(1.2, 0.85, 1.2);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 12), trimMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = -0.02; rim.scale.set(1, 1, 1);
    pad.add(rim);
    return pad;
  };
  const shoulderR = makeShoulder(armR, -1);
  const shoulderL = makeShoulder(armL, 1);

  // --- Armes principales (main droite) : une seule visible à la fois ---
  const weapons = {};
  const swordGrp = new THREE.Group();
  swordGrp.rotation.x = Math.PI / 2;
  armR.hand.add(swordGrp);
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), leather, swordGrp, 0, 0, 0);
  add(new THREE.SphereGeometry(0.035, 8, 8), steel, swordGrp, 0, -0.12, 0);
  add(new THREE.BoxGeometry(0.3, 0.04, 0.06), steel, swordGrp, 0, 0.12, 0);
  add(new THREE.BoxGeometry(0.06, 0.8, 0.016), swordBladeMat, swordGrp, 0, 0.55, 0);
  const tip = add(new THREE.ConeGeometry(0.0425, 0.18, 4), swordBladeMat, swordGrp, 0, 1.04, 0);
  tip.scale.set(1, 1, 0.28); tip.rotation.y = Math.PI / 4;
  add(new THREE.BoxGeometry(0.014, 0.7, 0.02), mat(0x9ea6ae, { roughness: 0.3, metalness: 0.9 }), swordGrp, 0, 0.52, 0); // gouttière
  add(new THREE.SphereGeometry(0.024, 6, 6), trimMat, swordGrp, 0.15, 0.12, 0);
  add(new THREE.SphereGeometry(0.024, 6, 6), trimMat, swordGrp, -0.15, 0.12, 0);
  const tipSword = new THREE.Object3D(); tipSword.position.set(0, 1.1, 0); swordGrp.add(tipSword);
  weapons.sword = swordGrp;

  const daggerGrp = new THREE.Group();
  daggerGrp.rotation.x = Math.PI / 2;
  armR.hand.add(daggerGrp);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8), leather, daggerGrp, 0, 0, 0);
  add(new THREE.BoxGeometry(0.16, 0.03, 0.045), steel, daggerGrp, 0, 0.08, 0);
  add(new THREE.BoxGeometry(0.04, 0.42, 0.012), daggerBladeMat, daggerGrp, 0, 0.3, 0);
  const tipDagger = new THREE.Object3D(); tipDagger.position.set(0, 0.5, 0); daggerGrp.add(tipDagger);
  weapons.dagger = daggerGrp;

  // Bâton (V3.3) : modèle détaillé (voir Staff.js) tenu dans la main droite ; ancien modèle si échec.
  let staffRig = null, staffGrp = null, tipStaff = null, halo = null;
  const gt = glowTex();
  try {
    staffRig = createStaff({ wood: staffWoodMat, gem: staffGemMat, trim: trimMat, leather, steel, glow: gt, parent: armR.hand });
    staffGrp = staffRig.group; tipStaff = staffRig.tip; halo = staffRig.halo;
    staffGrp.rotation.x = 0.12;
  } catch (e) {
    console.warn('[V3.3] bâton classique utilisé', e);
    if (staffGrp && staffGrp.parent) staffGrp.parent.remove(staffGrp);
    staffRig = null;
    staffGrp = new THREE.Group();
    staffGrp.rotation.x = Math.PI / 2;
    armR.hand.add(staffGrp);
    add(new THREE.CylinderGeometry(0.028, 0.034, 1.3, 8), staffWoodMat, staffGrp, 0, 0.55, 0);
    const gem = add(new THREE.OctahedronGeometry(0.09, 1), staffGemMat, staffGrp, 0, 1.2, 0);
    halo = null;
    if (gt) {
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0x6ab0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      halo.scale.setScalar(0.85);
      gem.add(halo);
    }
    tipStaff = new THREE.Object3D(); tipStaff.position.set(0, 1.25, 0); staffGrp.add(tipStaff);
  }
  weapons.staff = staffGrp;

  // Arc (V3.2) : tenu par la main GAUCHE (bras d'arc), la main droite tend la corde.
  // En cas d'échec de construction : ancien arc simple dans la main droite.
  let bowRig = null, bowGrp = null, tipBow = null;
  try {
    bowRig = createBow({ wood: bowWoodMat, trim: trimMat, leather, steel, parent: armL.hand });
    bowGrp = bowRig.group;
    bowGrp.rotation.x = 0.12;
    tipBow = new THREE.Object3D(); tipBow.position.set(0, 0.5, 0); bowGrp.add(tipBow);
  } catch (e) {
    console.warn('[V3.2] arc classique utilisé', e);
    bowRig = null;
    bowGrp = new THREE.Group();
    armR.hand.add(bowGrp);
    bowGrp.rotation.z = Math.PI / 2;
    add(new THREE.TorusGeometry(0.42, 0.018, 6, 12, Math.PI * 1.15), bowWoodMat, bowGrp, 0, 0, 0);
    const string = add(new THREE.CylinderGeometry(0.004, 0.004, 0.78, 4), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 }), bowGrp, 0.08, 0, 0);
    string.rotation.z = Math.PI / 2;
    tipBow = new THREE.Object3D(); tipBow.position.set(0, 0.4, 0); bowGrp.add(tipBow);
  }
  weapons.bow = bowGrp;

  for (const w of Object.values(weapons)) w.visible = false;
  const weaponVisual = weapons[o.weaponVisual] ? o.weaponVisual : (o.equipVisible ? 'sword' : null);
  if (weaponVisual && weapons[weaponVisual]) weapons[weaponVisual].visible = o.equipVisible;

  // --- Bouclier (main gauche) ---
  const shieldMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const shieldGrp = new THREE.Group();
  armL.hand.add(shieldGrp);
  const sh = add(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 18), shieldMat, shieldGrp, 0.1, 0, 0);
  sh.rotation.z = Math.PI / 2;
  const bossGem = add(new THREE.SphereGeometry(0.07, 10, 8), leather, shieldGrp, 0.14, 0, 0);
  bossGem.scale.set(0.5, 1, 1);
  shieldGrp.visible = !!(o.equipVisible && o.shield);

  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, -0.02, 0);
    hips.add(pivot);
    add(new THREE.CapsuleGeometry(0.08, 0.3, 5, 10), cloth, pivot, 0, -0.22, 0); // cuisse
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    pivot.add(knee);
    add(new THREE.SphereGeometry(0.07, 8, 6), cloth, knee, 0, 0, 0);
    add(new THREE.CapsuleGeometry(0.068, 0.3, 5, 10), cloth, knee, 0, -0.22, 0); // mollet
    const guard = add(new THREE.SphereGeometry(0.078, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), steel, knee, 0, 0, 0.04);
    guard.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.09, 0.075, 0.3, 10), leather, knee, 0, -0.32, 0); // botte
    add(new THREE.CylinderGeometry(0.098, 0.095, 0.05, 10), leather, knee, 0, -0.18, 0); // revers
    add(new THREE.BoxGeometry(0.15, 0.1, 0.32), leather, knee, 0, -0.46, 0.05);
    add(new THREE.SphereGeometry(0.075, 8, 6), leather, knee, 0, -0.45, 0.2).scale.set(1, 0.6, 1);
    return { pivot, knee };
  };
  const legRr = makeLeg(-1), legLr = makeLeg(1);
  const legR = legRr.pivot, legL = legLr.pivot;

  const cape = new THREE.Group();
  cape.position.set(0, 0.68, -0.17);
  torso.add(cape);
  add(new THREE.PlaneGeometry(0.5, 0.46), capeMat, cape, 0, -0.23, 0);
  const capeLow = new THREE.Group();
  capeLow.position.y = -0.46;
  cape.add(capeLow);
  add(new THREE.PlaneGeometry(0.58, 0.46), capeMat, capeLow, 0, -0.23, 0);
  add(new THREE.BoxGeometry(0.52, 0.04, 0.05), trimMat, cape, 0, -0.01, 0.01); // attache

  chestPlate.visible = o.equipVisible;
  cape.visible = o.equipVisible;
  helm.visible = false; // casque : jamais visible par défaut (contrairement au plastron hérité), seulement si équipé explicitement
  shoulderR.visible = shoulderL.visible = o.equipVisible;

  const weaponMats = { sword: swordBladeMat, dagger: daggerBladeMat, staff: staffGemMat, bow: bowWoodMat };
  const matRefs = { chest: chestMat, cloth, cape: capeMat, shield: shieldMat, helm: helmMat, shoulders: shoulderMat, weapons: weaponMats };
  const seenBase = new Set();
  const captureBase = (m) => { if (m && !seenBase.has(m)) { m.userData.__base = m.color.getHex(); seenBase.add(m); } };
  for (const v of Object.values(matRefs)) {
    if (v && v.isMaterial) captureBase(v);
    else if (v && typeof v === 'object') for (const m of Object.values(v)) captureBase(m);
  }

  const equipVisuals = { weapons, shield: shieldGrp, helm, shoulders: [shoulderR, shoulderL], chest: chestPlate, cape };
  root.scale.setScalar(o.scale);

  return {
    root, body, hips, torso, head, armR: armR.pivot, armL: armL.pivot, legR, legL, cape, capeLow, halo,
    handR: armR.hand, handL: armL.hand, bowRig, staffRig,
    elbowR: armR.elbow, elbowL: armL.elbow, kneeR: legRr.knee, kneeL: legLr.knee, hairTail: tail,
    tips: { sword: tipSword, dagger: tipDagger, staff: tipStaff, bow: tipBow }, landT: 0, prevYaw: 0, prevGrounded: true, bank: 0, weaponKind: 'sword',
    mats: [skin, cloth, steel], matRefs, equipVisuals,
    phase: 0, k: 0, t: 0, hurtT: 0, crouchK: 0
  };
}

// V8.3 — visage détaillé : pommettes, orbites, yeux (sclère, iris coloré, pupille, reflet), paupières, cils,
// sourcils, nez (arête, bout, narines), bouche (lèvres, commissures), menton, mâchoire, joues, oreilles.
// Géométries partagées entre tous les humanoïdes (PNJ, ennemis, joueur) pour rester léger.
// Texture de cheveux : mèches fines (stries verticales sur les UV de la sphère) + reflets, mise en cache par couleur.
const _hairTex = new Map();
function hairTexture(hex) {
  if (_hairTex.has(hex)) return _hairTex.get(hex);
  let tex = null;
  try {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      const base = new THREE.Color(hex);
      const css = (k) => '#' + base.clone().multiplyScalar(k).getHexString();
      const hi = (k) => '#' + base.clone().lerp(new THREE.Color(0xfff2d8), k).getHexString();
      g.fillStyle = css(1); g.fillRect(0, 0, 128, 64);
      let seed = (hex >>> 0) % 9973 + 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 110; i++) { // mèches
        const x = rnd() * 128, w = 0.8 + rnd() * 2.4, k = rnd();
        g.fillStyle = k < 0.55 ? css(0.62 + rnd() * 0.25) : hi(0.08 + rnd() * 0.15);
        g.globalAlpha = 0.35 + rnd() * 0.5; g.fillRect(x, 0, w, 64);
      }
      g.globalAlpha = 1;
      const grd = g.createLinearGradient(0, 0, 0, 64); // plus sombre vers les pointes
      grd.addColorStop(0, 'rgba(255,240,215,0.10)'); grd.addColorStop(0.55, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.32)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 64);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
    }
  } catch (e) { tex = null; }
  _hairTex.set(hex, tex);
  return tex;
}

let _FG = null;
function faceGeos() {
  if (_FG) return _FG;
  const S = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
  return (_FG = {
    ball: S(0.0255, 12, 9), iris: S(0.0155, 10, 8), pupil: S(0.0075, 8, 6), glint: S(0.0042, 5, 4), lid: new THREE.SphereGeometry(0.0285, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.46),
    socket: S(0.034, 10, 8), lash: new THREE.TorusGeometry(0.029, 0.0036, 4, 10, Math.PI * 0.85), brow: new THREE.CapsuleGeometry(0.0055, 0.036, 3, 6),
    noseRidge: new THREE.CapsuleGeometry(0.0085, 0.036, 3, 6), brow2: new THREE.CapsuleGeometry(0.0045, 0.026, 3, 6), lashFlick: new THREE.ConeGeometry(0.0022, 0.012, 4), cupid: S(0.0058, 6, 5), smile: new THREE.TorusGeometry(0.12, 0.0026, 4, 18, 0.5), tip: S(0.017, 10, 8), nostril: S(0.011, 6, 5), nostrilHole: S(0.0055, 5, 4),
    lipU: new THREE.CapsuleGeometry(0.0065, 0.046, 3, 8), lipL: new THREE.CapsuleGeometry(0.0075, 0.038, 3, 8), mouthLine: new THREE.CapsuleGeometry(0.0028, 0.062, 2, 5), corner: S(0.006, 5, 4),
    chin: S(0.036, 10, 8), jaw: S(0.07, 12, 9), cheekbone: S(0.03, 8, 6), blush: new THREE.CircleGeometry(0.027, 12), ear: S(0.031, 8, 6), earIn: S(0.017, 6, 5), lobe: S(0.011, 5, 4), philtrum: new THREE.CapsuleGeometry(0.0032, 0.014, 2, 4)
  });
}

function buildFace(head, { skin, hair, o }) {
  const g = faceGeos();
  const skinC = new THREE.Color(o.skin);
  const skinDeep = new THREE.MeshStandardMaterial({ color: skinC.clone().multiplyScalar(0.8), roughness: 0.8 });
  const lipMat = new THREE.MeshStandardMaterial({ color: skinC.clone().lerp(new THREE.Color(0xb04a52), 0.55), roughness: 0.35 });
  const lipDark = new THREE.MeshStandardMaterial({ color: skinC.clone().lerp(new THREE.Color(0x7a2f36), 0.65), roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.25 });
  const eyeC = new THREE.Color(o.eye ?? 0x3f78b0);
  const irisMat = new THREE.MeshStandardMaterial({ color: eyeC, roughness: 0.3, emissive: eyeC, emissiveIntensity: 0.14 });
  const irisRing = new THREE.MeshStandardMaterial({ color: eyeC.clone().multiplyScalar(0.38), roughness: 0.4 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x07070a });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.8 });
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xe0786e, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
  const m = (geo, mt, x, y, z, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); me.scale.set(sx, sy, sz); head.add(me); return me; };

  // volumes : mâchoire, menton, pommettes, front
  m(g.jaw, skin, 0, -0.07, 0.015, 0.98, 0.78, 0.98);
  m(g.chin, skin, 0, -0.118, 0.07, 1.1, 0.78, 0.95);
  m(g.chin, skin, 0, 0.075, 0.095, 1.5, 0.5, 0.55); // arcade du front
  for (const sx of [-1, 1]) m(g.cheekbone, skin, sx * 0.075, -0.03, 0.09, 0.7, 0.6, 0.55);

  for (const sx of [-1, 1]) {
    const ex = sx * 0.047, ey = 0.025;
    m(g.socket, skinDeep, ex, ey + 0.002, 0.108, 1.1, 0.8, 0.5); // orbite (légère ombre)
    m(g.ball, white, ex, ey, 0.119, 1, 0.84, 0.7); // globe oculaire
    m(g.iris, irisRing, ex, ey - 0.001, 0.134, 1.12, 1.12, 0.5); // anneau sombre de l'iris
    m(g.iris, irisMat, ex, ey - 0.001, 0.1362, 0.88, 0.88, 0.5);
    m(g.pupil, pupilMat, ex, ey - 0.001, 0.1425, 1, 1, 0.4);
    m(g.glint, glintMat, ex - sx * 0.006, ey + 0.0065, 0.1448, 1, 1, 0.6);
    m(g.glint, glintMat, ex + sx * 0.006, ey - 0.005, 0.1448, 0.5, 0.5, 0.5);
    const lid = m(g.lid, skin, ex, ey + 0.002, 0.1195, 1.04, 0.95, 0.74); lid.rotation.x = Math.PI * 0.07; // paupière supérieure
    const lash = m(g.lash, lashMat, ex, ey + 0.0015, 0.1415, 1, 0.8, 0.6); lash.rotation.z = Math.PI * 0.075; // cils supérieurs
    const flick = m(g.lashFlick, lashMat, ex + sx * 0.0275, ey + 0.004, 0.139); flick.rotation.z = -sx * 1.25; // petit cil au coin externe
    const lowerLid = m(g.lash, skinDeep, ex, ey - 0.001, 0.1385, 0.9, 0.55, 0.5); lowerLid.rotation.z = Math.PI * 1.08; // paupière inférieure
    // sourcil arqué en deux segments (fin vers l'extérieur)
    const b1 = m(g.brow, hair, ex - sx * 0.011, 0.067, 0.127, 1, 1, 0.8); b1.rotation.z = Math.PI / 2 + sx * 0.05; b1.rotation.y = sx * -0.25;
    const b2 = m(g.brow2, hair, ex + sx * 0.019, 0.0715, 0.1235, 1, 1, 0.8); b2.rotation.z = Math.PI / 2 + sx * 0.4; b2.rotation.y = sx * -0.45;
    m(g.blush, blushMat, sx * 0.082, -0.04, 0.1).rotation.y = sx * 0.9;
    // oreilles
    const ear = m(g.ear, skin, sx * 0.138, -0.003, 0.0, 0.42, 1, 0.78); ear.rotation.z = sx * -0.12;
    m(g.earIn, skinDeep, sx * 0.145, -0.003, 0.004, 0.25, 0.8, 0.5);
    m(g.lobe, skin, sx * 0.138, -0.036, 0.0, 0.7, 1, 0.8);
    // narines et ailes du nez
    m(g.nostril, skin, sx * 0.0165, -0.039, 0.147, 1.05, 0.8, 0.85);
    m(g.nostrilHole, pupilMat, sx * 0.0115, -0.0465, 0.1525, 1, 0.6, 0.6);
    // commissures (légèrement relevées) et fossettes
    m(g.corner, lipDark, sx * 0.031, -0.0815, 0.1335);
  }
  // nez : arête (de la racine au bout), bout, ombre sous le nez
  const br = m(g.noseRidge, skin, 0, -0.01, 0.1405, 0.9, 1, 0.8); br.rotation.x = 0.32;
  m(g.tip, skin, 0, -0.034, 0.1495, 0.95, 0.85, 0.95);
  m(g.nostrilHole, skinDeep, 0, -0.049, 0.1455, 2.4, 0.5, 0.7); // ombre sous le nez
  m(g.philtrum, skinDeep, 0, -0.0615, 0.1455, 0.7, 0.6, 0.6);
  // bouche : arc de Cupidon, lèvre supérieure, lèvre inférieure pleine, sourire léger
  const up = m(g.lipU, lipMat, 0, -0.0755, 0.1395, 1, 1, 0.7); up.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) m(g.cupid, lipMat, sx * 0.008, -0.0715, 0.1405, 1, 0.8, 0.7);
  const lo = m(g.lipL, lipMat, 0, -0.0885, 0.1385, 1, 1, 0.8); lo.rotation.z = Math.PI / 2;
  const smile = m(g.smile, lipDark, 0, -0.0825 + 0.12, 0.1425, 1, 1, 0.5); smile.rotation.z = -Math.PI / 2 - 0.25;
  m(g.glint, glintMat, 0.004, -0.0905, 0.1445, 1.1, 0.4, 0.4).material = new THREE.MeshBasicMaterial({ color: 0xffd8d0, transparent: true, opacity: 0.55 }); // brillance des lèvres
  return head;
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);

// s = { speed, grounded, action, actionT, actionDur, dead, crouch }
// Animation procédurale à articulations (épaule, coude, hanche, genou) : cycle de course
// avec pliage des genoux et des coudes, attaques propres à chaque arme, réaction aux coups,
// écrasement à l'atterrissage, inclinaison dans les virages, mort en deux temps.
const wrapAngle = (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export function animateHumanoid(rig, s, dt) {
  if (rig.glb) return animateGlbRig(rig, s, dt, 'humanoid');
  rig.t += dt;
  rig.hurtT = Math.max(0, rig.hurtT - dt * 3.5);
  const P = rig.pose || (rig.pose = {});
  if (rig.bank === undefined) rig.bank = 0;
  const acting = !s.dead && (s.action === 'attack' || s.action === 'attack2' || s.action === 'interact');
  const rate = s.dead ? 30 : acting ? 28 : 16;
  const sm = (k, v, r = rate) => { const c = P[k] === undefined ? v : P[k]; const n = c + (v - c) * Math.min(1, dt * r); P[k] = n; return n; };

  // arme tenue
  let wk = 'sword';
  const wv = rig.equipVisuals && rig.equipVisuals.weapons;
  if (wv) for (const key in wv) if (wv[key].visible) { wk = key; break; }
  rig.weaponKind = wk;
  if (rig.weaponAura) updateWeaponAura(rig.weaponAura, dt);

  const k = clamp(s.speed / 7.4, 0, 1.15);
  rig.k += (k - rig.k) * Math.min(1, dt * 10);
  const kk = Math.min(1, rig.k * 1.4);
  rig.phase += dt * (4 + s.speed * 1.15);
  const ph = rig.phase;
  const w = Math.sin(ph);
  const amp = Math.min(rig.k * 1.6, 1) * 0.95;
  const idle = 1 - Math.min(rig.k * 4, 1);
  const breathe = Math.sin(rig.t * 2) * 0.012 * idle;

  // atterrissage
  if (!rig.prevGrounded && s.grounded && !s.dead) rig.landT = 1;
  rig.prevGrounded = s.grounded !== false;
  rig.landT = Math.max(0, (rig.landT || 0) - dt * 4.5);

  // virage : inclinaison du corps
  const yaw = rig.root.rotation.y;
  const yawRate = dt > 0 ? wrapAngle(yaw - (rig.prevYaw ?? yaw)) / dt : 0;
  rig.prevYaw = yaw;
  rig.bank += (clamp(-yawRate * 0.035 * rig.k, -0.22, 0.22) - rig.bank) * Math.min(1, dt * 6);

  // --- pose de base (course / marche / repos) ---
  let lR = w * amp, lL = -w * amp;
  let kR = (0.1 + Math.max(0, -Math.cos(ph)) * 0.95 * kk) , kL = (0.1 + Math.max(0, Math.cos(ph)) * 0.95 * kk);
  let aR = -w * amp * 0.8, aL = w * amp * 0.8 - 0.1;
  let eR = -(0.2 + 0.85 * kk) + Math.sin(ph) * 0.25 * kk, eL = -(0.2 + 0.85 * kk) - Math.sin(ph) * 0.25 * kk;
  let zR = -0.06 - 0.04 * kk, zL = 0.06 + 0.04 * kk;
  let twist = Math.sin(ph) * 0.16 * rig.k, lean = 0, hipZ = 0, hipDrop = 0, headX = 0, headY = 0, sway = 0;
  let yR = 0, yL = 0, headTurn = 0.6, bowS = null, staffPhi = 0.15, staffCharge = 0;

  // repos : transfert de poids, respiration, regard
  aR += Math.sin(rig.t * 1.7) * 0.04 * idle; aL += Math.sin(rig.t * 1.7 + 1.2) * 0.04 * idle;
  eR -= (Math.sin(rig.t * 1.7) * 0.05) * idle; eL -= (Math.sin(rig.t * 1.7 + 1) * 0.05) * idle;
  sway = Math.sin(rig.t * 0.9) * 0.015 * idle;
  headY = Math.sin(rig.t * 0.6) * 0.06 * idle;
  lean += (rig.k > 0.6 ? 0.1 : 0) + rig.k * 0.05;

  rig.crouchK += ((s.crouch ? 1 : 0) - rig.crouchK) * Math.min(1, dt * 12);
  rig.body.scale.y = 1 - 0.2 * rig.crouchK;
  hipDrop += Math.abs(Math.cos(ph)) * -0.045 * rig.k; // rebond de course (le bassin monte quand un pied pousse)
  hipDrop += 0.1 * rig.landT; kR += 0.6 * rig.landT; kL += 0.6 * rig.landT; lean += 0.15 * rig.landT;

  if (s.grounded === false && !s.dead) {
    lR = -0.65; lL = 0.25; kR = 0.5; kL = 1.0; aR = -1.1; aL = -1.0; eR = -0.5; eL = -0.5; zR = -0.35; zL = 0.35; twist = 0;
  }

  let fall = 0;
  if (s.dead) {
    // 1) les genoux lâchent, 2) la chute
    const dp = clamp(s.actionT / 0.85, 0, 1);
    const buckle = easeOut(clamp(dp / 0.4, 0, 1));
    fall = easeOut(clamp((dp - 0.3) / 0.7, 0, 1));
    kR = kL = 1.1 * buckle; lR = -0.5 * buckle; lL = -0.25 * buckle;
    hipDrop = 0.3 * buckle; lean = 0.35 * buckle - 0.2 * fall; headX = 0.4 * buckle;
    aR = 0.25; aL = 0.4; eR = -0.3; eL = -0.2; zR = -0.35; zL = 0.35; twist = 0.3 * buckle;
    rig.root.rotation.x = -Math.PI / 2 * fall;
    rig.body.position.y = 0.12 * fall;
    rig.body.rotation.x = 0; rig.body.position.z = 0;
  } else {
    rig.root.rotation.x = 0;
    rig.body.position.y = 0;
    rig.body.rotation.x = 0; rig.body.position.z = 0;
    const p = s.actionDur > 0 ? clamp(s.actionT / s.actionDur, 0, 1) : 0;
    if (s.action === 'roll') {
      // V4.0 : roulade avant — le corps fait un tour complet, replié en boule, autour de son centre
      const th = easeOut(p) * Math.PI * 2, c = 0.85;
      rig.body.rotation.x = th;
      rig.body.position.y = c * (1 - Math.cos(th)) - 0.25 * Math.sin(p * Math.PI);
      rig.body.position.z = -c * Math.sin(th);
      kR = kL = 1.5; lR = lL = -1.2; hipDrop = 0.2; aR = aL = -0.9; eR = eL = -1.6; zR = -0.1; zL = 0.1; headX = 0.5; twist = 0; lean = 0.2;
    } else if (s.action === 'attack' || s.action === 'attack2') {
      const big = s.action === 'attack2';
      const pw = big ? 0.4 : 0.3;
      const wind = p < pw ? easeOut(p / pw) : 1;
      const q = p < pw ? 0 : easeOut((p - pw) / (1 - pw));
      const rec = p > 0.78 ? (p - 0.78) / 0.22 : 0; // retour en garde
      const f = 1 - rec * 0.6;
      rig.attackPhase = { p, q, wind };
      if (wk === 'staff') {
        // incantation : le bâton se lève vers la cible (angle φ depuis la verticale, compensé plus bas),
        // la main libre guide l'énergie ; le cristal se charge jusqu'au lâcher (p = 0,35).
        staffCharge = p < 0.35 ? wind : Math.max(0, 1 - (p - 0.35) * 5);
        if (!big) {
          aR = lerp(-0.3, -1.2, wind) + q * 0.15; eR = lerp(-0.4, -0.55, wind) + q * 0.3;
          aL = lerp(aL, -1.5, wind) + q * 0.12; eL = lerp(-0.4, -0.2, wind); zL = lerp(zL, 0.32, wind);
          lean = lerp(0, -0.08, wind) + q * 0.14; headX = -0.06 * wind; twist = lerp(0, 0.3, wind) - q * 0.12; hipDrop = -0.02 * wind;
          lR = 0.2; lL = -0.2; kR = 0.2; kL = 0.3;
          staffPhi = lerp(0.15, 1.15, wind) + q * 0.18;
        } else {
          aR = lerp(-0.3, -3.0, wind) + q * 1.2; aL = lerp(aL, -3.0, wind) + q * 1.2; eR = lerp(-0.4, -0.25, wind); eL = eR;
          hipDrop = -0.09 * wind + q * 0.2; lean = lerp(0, -0.25, wind) + q * 0.65; headX = -0.25 * wind + q * 0.45; zR = -0.25 * wind - 0.06; zL = 0.25 * wind + 0.06;
          lR = 0.1; lL = 0.1; kR = 0.25 + q * 0.5; kL = kR;
          staffPhi = lerp(0.15, 0, wind) + q * 1.25;
        }
      } else if (wk === 'bow' && rig.bowRig) {
        // Archer à droite : bras gauche tendu tient l'arc, main droite tend la corde jusqu'à la joue.
        // Poses des bras calculées par cinématique inverse (clés K0 = début de tension, K1 = pleine tension).
        const rd = easeOut(clamp(p / 0.14, 0, 1));
        const rel = p >= 0.35 ? clamp((p - 0.35) / 0.14, 0, 1) : 0;
        const dd = p < 0.35 ? easeOut(clamp((p - 0.04) / 0.26, 0, 1)) : 0;
        const tk = p < 0.35 ? dd : 1.22 - 0.4 * rel;
        const rr = rd * (1 - rec);
        aR = lerp(aR, lerp(0.802, 0.773, tk), rr); yR = lerp(0, lerp(0.157, 1.159, tk), rr);
        zR = lerp(zR, lerp(1.645, 1.5, tk), rr); eR = lerp(eR, lerp(-0.052, -1.528, tk), rr);
        aL = lerp(aL, -1.447, rr); yL = 0.025 * rr; zL = lerp(zL, 1.165, rr); eL = lerp(eL, -0.372, rr);
        if (dd > 0.9 && p < 0.35) { aL += Math.sin(rig.t * 31) * 0.004; eR += Math.sin(rig.t * 27) * 0.01; }
        if (p >= 0.35) aL -= 0.07 * (1 - rel) * rr; // léger recul du bras d'arc au lâcher
        twist = -1.15 * rr; headTurn = 0.95 * rr + 0.6 * (1 - rr);
        lean = -0.03 * rr; headX = -0.05 * rr; hipDrop = 0.06 * rr;
        lR = 0.3 * rr; lL = -0.35 * rr; kR = 0.2 + 0.2 * rr; kL = 0.3 * rr + 0.1; hipZ = -0.02 * rr;
        bowS = { rd: rr, d: dd, p, arrow: p < 0.35 && rd > 0.4 };
      } else if (wk === 'bow') {
        twist = lerp(0, -0.85, wind) * f;
        aR = lerp(-0.3, -1.5, wind); eR = lerp(-0.4, -0.08, wind);
        aL = lerp(-0.2, -1.45, wind) + q * 0.5; eL = lerp(-0.4, big ? -1.9 : -1.6, wind) + q * 1.3;
        lean = lerp(0, big ? -0.2 : -0.08, wind) + q * 0.1; headX = -0.05; hipDrop = 0.05 * wind;
        lR = 0.35 * wind; lL = -0.4 * wind; kR = 0.2 + 0.2 * wind; kL = 0.3; hipZ = -0.04 * q;
      } else if (wk === 'dagger' && !big) {
        const pp = (p * 2) % 1, th = Math.sin(Math.min(1, pp * 1.2) * Math.PI);
        aR = lerp(-0.9, -1.55, th); eR = lerp(-1.5, -0.12, th); aL = 0.4 - th * 0.6; eL = -0.9;
        twist = (p < 0.5 ? -0.3 : 0.3) * th; hipZ = 0.18 * th; hipDrop = 0.1; lean = 0.12 + 0.18 * th;
        lR = -0.45 * th; lL = 0.5; kR = 0.5; kL = 0.7;
      } else if (!big) {
        // coup d'épée / poing : armement, frappe diagonale, retour
        aR = lerp(-0.4, -2.55, wind) + q * 2.35; eR = lerp(-0.5, -1.35, wind) + q * 1.2;
        aL = lerp(aL, -0.4, wind) + q * 1.0; eL = -0.6;
        twist = lerp(0, 0.6, wind) - q * 1.3; lean = lerp(0, -0.12, wind) + q * 0.38; headX = -0.06 * wind;
        hipDrop = 0.07 * wind - q * 0.03; hipZ = 0.26 * Math.sin(q * Math.PI * 0.85);
        lR = lerp(0.1, 0.55, wind) - q * 1.1; lL = lerp(-0.1, -0.4, wind) + q * 0.9; kR = 0.3 + 0.2 * wind; kL = 0.45 - q * 0.3;
      } else {
        // frappe lourde / tourbillon : arme au-dessus de la tête puis impact
        aR = lerp(-0.4, -3.05, wind) + q * 3.3; aL = lerp(aL, -2.7, wind) + q * 2.9; eR = lerp(-0.5, -0.7, wind) + q * 0.4; eL = eR;
        lean = lerp(0, -0.38, wind) + q * 0.95; twist = lerp(0, 0.25, wind) - q * 0.4; headX = -0.15 * wind + q * 0.3;
        hipDrop = -0.05 * wind + q * 0.24; hipZ = 0.34 * Math.sin(q * Math.PI * 0.85);
        lR = lerp(0.1, 0.3, wind) - q * 1.0; lL = lerp(-0.1, -0.2, wind) + q * 0.9; kR = 0.2 + q * 0.4; kL = 0.3 + q * 0.5; zR = -0.1; zL = 0.1;
      }
      if (rec > 0) { hipZ *= 1 - rec; }
    } else if (s.action === 'interact') {
      const open = easeOut(clamp(p / 0.35, 0, 1)) * (1 - clamp((p - 0.8) / 0.2, 0, 1));
      aR = lerp(aR, -0.5, open); aL = lerp(aL, -0.5, open); zR = -0.06 - 1.25 * open; zL = 0.06 + 1.25 * open;
      eR = lerp(eR, -0.35, open) + Math.sin(rig.t * 14) * 0.05; eL = lerp(eL, -0.35, open) - Math.sin(rig.t * 14) * 0.05;
      headX = -0.28 * open; hipDrop = -0.05 * open; lean = -0.1 * open; lR = lL = 0.05; kR = kL = 0.1;
    } else {
      rig.attackPhase = null;
    }
    const h = rig.hurtT;
    lean -= 0.5 * h; headX += 0.35 * h; aR -= 0.5 * h; aL += 0.5 * h; kR += 0.25 * h; kL += 0.25 * h; hipDrop += 0.05 * h;
  }

  const ft = (v, name, r) => sm(name, v, r);
  const hd = ft(hipDrop, 'hd');
  rig.hips.position.y = 0.95 - hd;
  rig.hips.position.z = ft(hipZ, 'hz');
  rig.hips.position.x = sway;
  rig.legR.rotation.x = ft(lR, 'lR'); rig.legL.rotation.x = ft(lL, 'lL');
  if (rig.kneeR) { rig.kneeR.rotation.x = ft(kR, 'kR'); rig.kneeL.rotation.x = ft(kL, 'kL'); }
  if (rig.kneeR && !s.dead && s.grounded !== false) {
    // contact au sol : le bassin s'ajuste pour que le pied le plus bas touche toujours le sol
    const ext = (th, kn) => 0.44 * Math.cos(th) + 0.46 * Math.cos(th + kn);
    const need = Math.max(ext(rig.legR.rotation.x, rig.kneeR.rotation.x), ext(rig.legL.rotation.x, rig.kneeL.rotation.x)) + 0.05;
    rig.hips.position.y = Math.max(0.5, need - 0.5 * Math.max(0, hd) + Math.max(0, -hd));
  }
  rig.armR.rotation.x = ft(aR, 'aR'); rig.armL.rotation.x = ft(aL, 'aL');
  if (rig.elbowR) { rig.elbowR.rotation.x = ft(eR, 'eR'); rig.elbowL.rotation.x = ft(eL, 'eL'); }
  rig.armR.rotation.z = ft(zR, 'zR'); rig.armL.rotation.z = ft(zL, 'zL');
  rig.armR.rotation.y = ft(yR, 'yR'); rig.armL.rotation.y = ft(yL, 'yL');
  if (rig.staffRig && wk === 'staff') {
    // le bâton garde l'orientation voulue (φ) quelle que soit la pose du bras (compense épaule + coude)
    const tot = rig.armR.rotation.x + (rig.elbowR ? rig.elbowR.rotation.x : 0);
    rig.staffRig.group.rotation.x = ft(staffPhi, 'sPhi', 22) - tot;
    rig.staffRig.update(rig.t, ft(staffCharge, 'sCh', 16));
  }
  rig.torso.position.y = 0.05 + breathe;
  const tw = ft(twist, 'tw');
  rig.torso.rotation.y = tw;
  rig.torso.rotation.x = ft(lean, 'ln');
  rig.body.rotation.z = s.dead ? 0 : rig.bank;
  rig.head.rotation.y = -tw * ft(headTurn, 'hT', 12) + headY;
  rig.head.rotation.x = ft(headX, 'hx') - rig.torso.rotation.x * 0.5;
  // cape (2 segments, retard) et queue de cheval
  const capeBase = 0.12 + rig.k * 0.5 + Math.sin(rig.t * 3) * 0.03 + (acting ? 0.3 : 0);
  rig.cape.rotation.x = capeBase;
  if (rig.capeLow) {
    rig.capeLow.rotation.x = capeBase * 0.55 + Math.sin(rig.t * 4.5 + ph * 0.5) * (0.05 + rig.k * 0.12);
    rig.capeLow.rotation.z = Math.sin(rig.t * 2.3) * 0.04;
  }
  if (rig.hairTail) {
    rig.hairTail.rotation.x = 0.35 + rig.k * 0.55 + Math.sin(rig.t * 5 + ph) * 0.07 * (0.3 + rig.k);
    rig.hairTail.rotation.z = Math.sin(rig.t * 3) * 0.08 + tw * 0.3;
  }
  if (rig.halo) rig.halo.material.opacity = 0.65 + Math.sin(rig.t * 3) * 0.25 + (rig.attackPhase ? 0.3 : 0);
  if (rig.bowRig) { try { updateBowRig(rig, wk, bowS, dt); } catch (e) { rig.bowRig = null; console.warn('[V3.2] arc animé désactivé', e); } }
}

const _bv = { a: new THREE.Vector3(), up: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qi: new THREE.Quaternion(), qr: new THREE.Quaternion(), e: new THREE.Euler(0.12, 0, 0) };
const sstep01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Oriente l'arc de la main gauche vers la main droite, tend la corde, fléchit les branches, gère flèche et vibration.
function updateBowRig(rig, wk, bowS, dt) {
  const bow = rig.bowRig;
  const ev = rig.equipVisuals;
  // l'arc se tient à deux mains : le bouclier est masqué pendant qu'un arc est porté
  if (ev && ev.shield) {
    if (wk === 'bow' && ev.shield.visible) { ev.shield.visible = false; rig._shieldHid = true; }
    else if (wk !== 'bow' && rig._shieldHid) { ev.shield.visible = true; rig._shieldHid = false; }
  }
  if (wk !== 'bow' || !bow.group.visible) { rig._bowAim = 0; return; }
  const P = rig.pose;
  const aimT = bowS ? bowS.rd : 0;
  const aim = rig._bowAim = (rig._bowAim || 0) + (aimT - (rig._bowAim || 0)) * Math.min(1, dt * 30);
  // lâcher : détecter le passage p<0.35 → p≥0.35
  const pNow = bowS ? bowS.p : -1;
  if (rig._bowPrevP !== undefined && rig._bowPrevP >= 0 && rig._bowPrevP < 0.35 && pNow >= 0.35) rig._bowVib = 1;
  rig._bowPrevP = pNow;
  rig._bowVib = (rig._bowVib || 0) * Math.exp(-dt * 13);
  const dS = P.bowD = (P.bowD || 0) + (((bowS && bowS.d) || 0) - (P.bowD || 0)) * Math.min(1, dt * (bowS && bowS.p >= 0.35 ? 45 : 22));

  let nockZ = -0.12, flex = 0;
  const vib = rig._bowVib > 0.02 ? Math.sin(rig.t * 95) * 0.024 * rig._bowVib : 0;
  if (aim > 0.02) {
    rig.root.updateMatrixWorld(true);
    const hl = rig.handL, hr = rig.handR;
    _bv.a.setFromMatrixPosition(hr.matrixWorld);
    hl.worldToLocal(_bv.a); // position de la main droite dans le repère de la main gauche
    const S = _bv.a.length() || 0.6;
    _bv.z.copy(_bv.a).multiplyScalar(-1 / S); // direction de tir (de la main droite vers la gauche)
    hl.getWorldQuaternion(_bv.qi).invert();
    _bv.up.set(0, 1, 0).applyQuaternion(_bv.qi);
    _bv.y.copy(_bv.up).addScaledVector(_bv.z, -_bv.up.dot(_bv.z));
    if (_bv.y.lengthSq() < 1e-4) _bv.y.set(0, 0, 1);
    _bv.y.normalize();
    _bv.x.crossVectors(_bv.y, _bv.z);
    _bv.m.makeBasis(_bv.x, _bv.y, _bv.z);
    _bv.qa.setFromRotationMatrix(_bv.m);
    _bv.qr.setFromEuler(_bv.e);
    bow.group.quaternion.copy(_bv.qr).slerp(_bv.qa, aim);
    const g = sstep01(0, 0.3, dS);
    nockZ = -0.12 + (-clamp(S * 0.97, 0.14, 0.95) + 0.12) * g * aim;
    flex = clamp((-nockZ - 0.12) / 0.7, 0, 1);
  } else {
    bow.group.rotation.set(0.12 + Math.sin(rig.t * 1.7) * 0.02, 0, 0);
  }
  bow.update(flex, nockZ, vib, !!(bowS && bowS.arrow));
}

