import * as THREE from 'three';

// Copie de la version V2 (modèle simple) : utilisée uniquement en secours si le modèle V2.5 échoue.
export function createHumanoidLegacy(opts = {}) {
  const o = {
    skin: 0xd9a98b, hair: 0x3b2a20, cloth: 0x2f4a7a, armor: 0x9aa3ad, leather: 0x5a3a22, cape: 0x7a1f2b,
    shield: true, weaponVisual: 'sword', equipVisible: true, scale: 1, ...opts
  };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
  const skin = mat(o.skin, { roughness: 0.7 }), hair = mat(o.hair, { roughness: 0.9 });
  const cloth = mat(o.cloth), leather = mat(o.leather, { roughness: 0.9 });
  const steel = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const chestMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const helmMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const shoulderMat = mat(o.armor, { roughness: 0.35, metalness: 0.85 });
  const capeMat = mat(o.cape, { side: THREE.DoubleSide });
  const dark = mat(0x15110e);
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
  add(new THREE.BoxGeometry(0.46, 0.28, 0.26), cloth, hips);
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);
  add(new THREE.BoxGeometry(0.5, 0.5, 0.28), cloth, torso, 0, 0.4, 0);
  const chestPlate = add(new THREE.BoxGeometry(0.54, 0.32, 0.32), chestMat, torso, 0, 0.5, 0);
  add(new THREE.BoxGeometry(0.5, 0.07, 0.3), leather, torso, 0, 0.14, 0);
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skin, torso, 0, 0.7, 0);

  const head = new THREE.Group();
  head.position.set(0, 0.86, 0);
  torso.add(head);
  add(new THREE.SphereGeometry(0.14, 16, 12), skin, head);
  const hairMesh = add(new THREE.SphereGeometry(0.152, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, head, 0, 0.01, -0.012);
  add(new THREE.SphereGeometry(0.02, 8, 6), dark, head, 0.05, 0.02, 0.128);
  add(new THREE.SphereGeometry(0.02, 8, 6), dark, head, -0.05, 0.02, 0.128);

  // Casque (emplacement "tête") : recouvre les cheveux quand équipé.
  const helm = new THREE.Group();
  head.add(helm);
  add(new THREE.SphereGeometry(0.158, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), helmMat, helm, 0, 0.015, -0.01);
  add(new THREE.BoxGeometry(0.19, 0.05, 0.04), helmMat, helm, 0, 0.04, 0.125);

  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.33, 0.62, 0);
    torso.add(pivot);
    add(new THREE.CapsuleGeometry(0.055, 0.4, 4, 8), cloth, pivot, 0, -0.26, 0);
    add(new THREE.CylinderGeometry(0.062, 0.058, 0.18, 8), steel, pivot, 0, -0.38, 0);
    add(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), steel, pivot, 0, 0.02, 0);
    const hand = new THREE.Group();
    hand.position.y = -0.52;
    pivot.add(hand);
    add(new THREE.SphereGeometry(0.058, 8, 8), skin, hand);
    return { pivot, hand };
  };
  const armR = makeArm(-1); // main droite du personnage (regarde vers +Z)
  const armL = makeArm(1);

  // Épaulières (emplacement "épaules")
  const makeShoulder = (arm, side) => {
    const pad = add(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), shoulderMat, arm.pivot, 0, 0.1, 0);
    pad.scale.set(1.15, 0.8, 1.15);
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
  add(new THREE.BoxGeometry(0.06, 0.95, 0.016), swordBladeMat, swordGrp, 0, 0.62, 0);
  weapons.sword = swordGrp;

  const daggerGrp = new THREE.Group();
  daggerGrp.rotation.x = Math.PI / 2;
  armR.hand.add(daggerGrp);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8), leather, daggerGrp, 0, 0, 0);
  add(new THREE.BoxGeometry(0.16, 0.03, 0.045), steel, daggerGrp, 0, 0.08, 0);
  add(new THREE.BoxGeometry(0.04, 0.42, 0.012), daggerBladeMat, daggerGrp, 0, 0.3, 0);
  weapons.dagger = daggerGrp;

  const staffGrp = new THREE.Group();
  staffGrp.rotation.x = Math.PI / 2;
  armR.hand.add(staffGrp);
  add(new THREE.CylinderGeometry(0.028, 0.034, 1.3, 8), staffWoodMat, staffGrp, 0, 0.55, 0);
  add(new THREE.OctahedronGeometry(0.09, 0), staffGemMat, staffGrp, 0, 1.2, 0);
  weapons.staff = staffGrp;

  const bowGrp = new THREE.Group();
  armR.hand.add(bowGrp);
  bowGrp.rotation.z = Math.PI / 2;
  add(new THREE.TorusGeometry(0.42, 0.018, 6, 12, Math.PI * 1.15), bowWoodMat, bowGrp, 0, 0, 0);
  const string = add(new THREE.CylinderGeometry(0.004, 0.004, 0.78, 4), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 }), bowGrp, 0.08, 0, 0);
  string.rotation.z = Math.PI / 2;
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
    add(new THREE.CapsuleGeometry(0.075, 0.62, 4, 8), cloth, pivot, 0, -0.42, 0);
    add(new THREE.BoxGeometry(0.15, 0.15, 0.3), leather, pivot, 0, -0.875, 0.05);
    return pivot;
  };
  const legR = makeLeg(-1);
  const legL = makeLeg(1);

  const cape = new THREE.Group();
  cape.position.set(0, 0.68, -0.17);
  torso.add(cape);
  add(new THREE.PlaneGeometry(0.5, 0.9), capeMat, cape, 0, -0.45, 0);

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
    root, body, hips, torso, head, armR: armR.pivot, armL: armL.pivot, legR, legL, cape,
    mats: [skin, cloth, steel], matRefs, equipVisuals,
    phase: 0, k: 0, t: 0, hurtT: 0, crouchK: 0
  };
}

