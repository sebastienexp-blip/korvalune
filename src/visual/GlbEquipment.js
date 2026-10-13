// Équipement en pièces GLB séparées — V10.41 (prototype).
//  - Arme : un GLB statique, posé sur un os « Socket_* » du personnage (position/rotation lues dans les métadonnées du fichier).
//  - Armure : un GLB par emplacement (casque, torse, jambes…) qui partage le squelette du corps ; chaque pièce est liée
//    aux os du corps déjà animé, donc elle suit toutes les animations sans coût supplémentaire.
// Un rig sans GLB (modèle procédural) ignore simplement ces appels.
import * as THREE from 'three';

function findBody(root) {
  let body = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !body) body = o; });
  return body;
}

// Pose une arme sur un os d'attache. Renvoie l'objet posé (pour le retirer avec detach()).
export function attachWeapon(rig, gltf, { socket } = {}) {
  const meta = (gltf.asset && gltf.asset.extras && gltf.asset.extras.korvalune) || {};
  const att = meta.attach || {};
  const bone = rig.root.getObjectByName(socket || att.socket || 'Socket_Weapon_R');
  if (!bone) return null;
  const obj = gltf.scene.clone(true);
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  if (att.quat) obj.quaternion.fromArray(att.quat);
  if (att.offset) obj.position.fromArray(att.offset);
  bone.add(obj);
  obj.userData.equipSlot = 'weapon';
  return obj;
}

// Lie une pièce d'armure au squelette du corps. Les os doivent avoir les mêmes noms et le même ordre que dans le fichier de la pièce.
export function equipPiece(rig, gltf, { tint } = {}) {
  const body = findBody(rig.root);
  if (!body) return [];
  const added = [];
  gltf.scene.traverse((src) => {
    if (!src.isSkinnedMesh) return;
    const mats = (Array.isArray(src.material) ? src.material : [src.material]).map((m) => {
      const c = m.clone();
      if (tint && c.color) c.color.lerp(new THREE.Color(tint), 0.35);
      return c;
    });
    const sk = new THREE.Skeleton(body.skeleton.bones, src.skeleton.boneInverses);
    const mesh = new THREE.SkinnedMesh(src.geometry, mats.length === 1 ? mats[0] : mats);
    mesh.name = src.name; mesh.castShadow = true; mesh.frustumCulled = false;
    body.parent.add(mesh);
    mesh.bind(sk, body.bindMatrix);
    mesh.userData.equipSlot = gltf.asset?.extras?.korvalune?.slot || 'piece';
    for (const m of mats) rig.mats.push(m);          // pour le flash de dégâts
    added.push(mesh);
  });
  return added;
}

// Retire une pièce (ou une arme) précédemment posée.
export function detach(objs) {
  for (const o of [].concat(objs || [])) {
    o.parent && o.parent.remove(o);
    if (o.isSkinnedMesh) { o.skeleton.dispose?.(); }
  }
}

// ---- Branchement sur le système d'équipement du jeu (Player.refreshGearVisuals) ----
import { ModelLibrary } from './ModelLibrary.js';

// emplacement du jeu → pièces GLB à afficher
const SLOT_TO_PIECES = { head: ['casque'], shoulders: ['epaules'], chest: ['torse'], gloves: ['bras'], legs: ['jambes'], boots: ['jambes'], cape: ['cape'] };

export function refreshGlbGear(rig, slots, resolveItem) {
  const lib = ModelLibrary.gear;
  const armor = lib.armor[rig.glbSkeleton] || {};
  const st = rig.glbGear || (rig.glbGear = { pieces: {}, weapon: null, weaponKey: null });
  const want = {};                                    // pièce → objet équipé qui la demande
  for (const [slot, pcs] of Object.entries(SLOT_TO_PIECES)) {
    if (!slots[slot]) continue;
    for (const p of pcs) if (!want[p]) want[p] = slots[slot];
  }
  for (const [p, cur] of Object.entries(st.pieces)) {          // retire ce qui n'est plus porté
    if (!want[p]) { detach(cur.meshes); delete st.pieces[p]; }
  }
  for (const [p, item] of Object.entries(want)) {
    const view = resolveItem(item);
    const tint = (view && (view.tint || view.rarityInfo?.color)) || null;
    const cur = st.pieces[p];
    if (cur && cur.tint === tint) continue;
    if (cur) detach(cur.meshes);
    if (!armor[p]) { delete st.pieces[p]; continue; }
    st.pieces[p] = { tint, meshes: equipPiece(rig, armor[p], { tint }) };
  }
  // armes : un GLB par type visuel (« sword », « bow »…). Un type sans modèle → rien (l'arme procédurale n'existe pas sur un corps GLB)
  const setHeld = (field, key) => {
    if (key === st[field + 'Key']) return;
    if (st[field]) detach(st[field]);
    st[field] = key ? attachWeapon(rig, lib.weapons[key]) : null;
    st[field + 'Key'] = key;
  };
  const mv = slots.mainhand && resolveItem(slots.mainhand);
  setHeld('weapon', mv && mv.visual && lib.weapons[mv.visual] ? mv.visual : null);
  const ov = slots.offhand && resolveItem(slots.offhand);          // objet secondaire : bouclier par défaut, ou orbe / carquois / dague
  const ok = ov ? (ov.visual || 'shield') : null;
  setHeld('off', ok && lib.weapons[ok] ? ok : null);
}

// Autres joueurs : leur équipement n'est pas synchronisé par le réseau → arme (et objet secondaire) par défaut de leur classe, pour ne pas les montrer les mains vides.
const CLASS_GEAR = { warrior: ['sword', 'shield'], paladin: ['sword', 'shield'], mage: ['staff', 'orb'], archer: ['bow', 'quiver'], assassin: ['dagger', 'offdagger'] };
export function giveClassGear(rig, classId) {
  if (!rig.glbSkeleton) return;
  const lib = ModelLibrary.gear, [main, off] = CLASS_GEAR[classId] || CLASS_GEAR.warrior;
  const st = rig.glbGear || (rig.glbGear = { pieces: {}, weapon: null, weaponKey: null });
  if (st.weapon || st.off) return;
  if (lib.weapons[main]) { st.weapon = attachWeapon(rig, lib.weapons[main]); st.weaponKey = main; }
  if (lib.weapons[off]) { st.off = attachWeapon(rig, lib.weapons[off]); st.offKey = off; }
}
