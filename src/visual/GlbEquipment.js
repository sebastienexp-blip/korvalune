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
