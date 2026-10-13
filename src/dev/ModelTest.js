// Zone de test des modèles GLB (prototype Lot 1) : un héros modulaire (corps + 6 pièces d'armure + épée), un loup hostile,
// une petite arène avec collisions. Utilise le code d'animation du jeu (ModelLibrary.tryCreateGlbRig / animateGlbRig).
// Commandes : ZQSD/WASD/flèches = marcher, Maj = courir, Espace = attaque, E = attaque 2, H = coup reçu, X = mort, R = relever,
// 1-6 = retirer/remettre casque, épaules, torse, bras, jambes, cape ; 7 = épée ; L = faire réapparaître le loup ; souris = caméra.
// Mobile : joystick à gauche, boutons à droite.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelLibrary, tryCreateGlbRig, animateGlbRig } from '../visual/ModelLibrary.js';
import { createMount, updateMount, disposeMount } from '../visual/MountModel.js';
import { MOUNTS } from '../data/mounts.js';
import { refreshGlbGear } from '../visual/GlbEquipment.js';

THREE.Cache.enabled = true;   // les textures partagées entre pièces ne sont téléchargées qu'une fois
const q = new URLSearchParams(location.search);
const hud = document.getElementById('hud');
const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
const MP = base + 'models_proto/';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1a28); scene.fog = new THREE.FogExp2(0x1b1a28, 0.03);
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);

const pm = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0x30304a);
const m1 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xcfd8ff })); m1.position.set(-4, 5, 4); m1.scale.setScalar(2); envScene.add(m1);
const m2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff9a60 })); m2.position.set(5, 1, -4); m2.scale.setScalar(1.5); envScene.add(m2);
scene.environment = pm.fromScene(envScene, 0.04).texture;
const moon = new THREE.DirectionalLight(0xbfc9ff, 2.8); moon.position.set(-6, 9, 5); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 32 }); scene.add(moon);
const warm = new THREE.DirectionalLight(0xff9a60, 1.5); warm.position.set(6, 3, -5); scene.add(warm);
scene.add(new THREE.HemisphereLight(0x8a8ab8, 0x3a3028, 0.8));

const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x262431, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(28, 28, 0x403a5a, 0x2e2a42); grid.position.y = 0.01; scene.add(grid);
const obstacles = [];
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3b3948, roughness: 0.9, flatShading: true });
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2 + 0.3, r = 8.5, rad = 0.9 + (i % 3) * 0.25;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), stoneMat);
  rock.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r); rock.rotation.set(i, i * 2, 0); rock.castShadow = rock.receiveShadow = true; scene.add(rock);
  obstacles.push({ x: rock.position.x, z: rock.position.z, r: rad });
}
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3, 12), stoneMat); pillar.position.set(-3, 1.5, -4); pillar.castShadow = true; scene.add(pillar);
obstacles.push({ x: -3, z: -4, r: 0.6 });

// ---------------------------------------------------------------- chargement
const loader = new GLTFLoader();
const load = (f) => loader.loadAsync(MP + f);
const SLOTS = { 1: 'casque', 2: 'epaules', 3: 'torse', 4: 'bras', 5: 'jambes', 6: 'cape' };
const GAME_SLOT = { 1: 'head', 2: 'shoulders', 3: 'chest', 4: 'gloves', 5: 'legs', 6: 'cape', 7: 'mainhand', 8: 'offhand' };
const MAIN = ['sword', 'dagger', 'staff', 'bow']; const OFF = ['shield', 'orb', 'quiver', 'offdagger']; let mainIdx = 0, offIdx = 0;
// faux équipement : même forme que Equipment.slots ; resolveItem simulé (le vrai vient du jeu)
const fakeSlots = {};
const fakeResolve = (it) => it && (it.visual ? { visual: it.visual, tint: it.tint } : { tint: it.tint });
const TINTS = [null, '#c9a227', '#7a1f2b', '#3f7f9a'];
let sword = null;
let rig = null, wolf = null;

(async () => {
  try {
    const WEAPONS = ['dague_du_veilleur', 'dague_gauche', 'baton_de_la_veille', 'arc_de_la_veille', 'ecu_de_la_veille', 'orbe_de_la_veille', 'carquois'];
    const FOES = ['bandit', 'elite', 'zealot', 'mage', 'archer', 'brute', 'troll', 'goblin'];
    const foeGltfs = await Promise.all(FOES.map((f) => load(`ennemis/ennemi_${f}.glb`)));
    const BEASTS = ['boar', 'bear', 'skitter', 'alpha'];
    const beastGltfs = await Promise.all(BEASTS.map((b) => load(`creatures/bete_${b}.glb`)));
    const horseG = await load('montures/monture_cheval.glb'); ModelLibrary._register('monture_cheval.glb', horseG);
    const gryG = await load('montures/monture_griffon.glb'); ModelLibrary._register('monture_griffon.glb', gryG);
    const weaponGltfs = await Promise.all(WEAPONS.map((w) => load(`armes/${w}.glb`)));
    const [body, lodG, lod2G, wolfG, swordG, ...pcs] = await Promise.all([
      load('veilleur/veilleur_corps.glb'), load('veilleur/veilleur_lod1.glb'), load('veilleur/veilleur_lod2.glb'), load('creatures/loup_des_cendres.glb'), load('armes/lame_de_la_veille.glb'),
      ...Object.values(SLOTS).map((s) => load(`veilleur/veilleur_${s}.glb`))]);
    ModelLibrary._register('veilleur_corps.glb', body);
    ModelLibrary._register('veilleur_lod1.glb', lodG); ModelLibrary._register('veilleur_lod2.glb', lod2G);
    ModelLibrary._register('loup_des_cendres.glb', wolfG);
    ModelLibrary.mapping = { 'player:warrior': 'veilleur_corps.glb', 'player:warrior@lod1': 'veilleur_lod1.glb', 'player:warrior@lod2': 'veilleur_lod2.glb', 'species:wolf': 'loup_des_cendres.glb' };
    ModelLibrary.ready = true;
    rig = tryCreateGlbRig('humanoid', { role: 'player:warrior' });
    if (!rig) throw new Error('tryCreateGlbRig(humanoïde) a renvoyé null');
    scene.add(rig.root);
    Object.values(SLOTS).forEach((s, i) => ModelLibrary._register(`veilleur_${s}.glb`, pcs[i]));
    ModelLibrary._register('lame_de_la_veille.glb', swordG);
    for (const g of weaponGltfs) ModelLibrary._register('arme.glb', g);
    for (const n of [1, 2, 3, 4, 5, 6]) fakeSlots[GAME_SLOT[n]] = { id: 'armor' };
    fakeSlots.mainhand = { visual: 'sword' };
    refreshGlbGear(rig, fakeSlots, fakeResolve);
    spawnWolf();
    spawnCrowd(12);
    spawnFoes(foeGltfs);
    spawnBeasts(beastGltfs);
    window.__rig = rig; window.__ready = true;
    hud.innerHTML = `<b>Veilleur de Corvalune</b> (corps animé + 6 pièces d'armure + épée) contre un <b>Loup des Cendres</b>.<br>` +
      `ZQSD : marcher · Maj : courir · Espace : attaque · E : attaque 2 · H : coup reçu · X : mort · R : relever<br>` +
      `1-6 : armure · 7 : arme (épée, dague, bâton, arc) · 8 : objet secondaire (bouclier, orbe, carquois, dague) — équipement via le vrai branchement du jeu (appui : teinte suivante, puis retrait) — casque, épaules, torse, gants, jambes, cape, épée · L : nouveau loup<br>M : monture suivante (3 chevaux, 2 griffons) · F : voler (griffon) <span id="st"></span>`;
  } catch (e) { hud.textContent = 'Erreur de chargement : ' + (e && e.message); console.error(e); }
})();

function toggleSlot(n) {
  if (!rig) return;
  const g = GAME_SLOT[n]; if (!g) return;
  if (n >= 7) {                       // armes : chaque appui passe au type suivant, puis retrait
    const list = n === 7 ? MAIN : OFF, cur = fakeSlots[g] && fakeSlots[g].visual;
    const i = cur ? list.indexOf(cur) + 1 : 0;
    fakeSlots[g] = i >= list.length ? null : { visual: list[i] };
  } else {
    const cur = fakeSlots[g];
    if (!cur) fakeSlots[g] = { id: 'armor' };
    else { const i = TINTS.indexOf(cur.tint || null); if (i === TINTS.length - 1) fakeSlots[g] = null; else cur.tint = TINTS[i + 1]; }
  }
  refreshGlbGear(rig, fakeSlots, fakeResolve);
}
window.__equip = (slot, visual) => { fakeSlots[slot] = visual ? { visual } : null; refreshGlbGear(rig, fakeSlots, fakeResolve); };

// ennemis humanoïdes : un de chaque espèce, créés par le même chemin que le jeu (rôle « enemy:… », espèce, échelle du monstre)
const foes = [];
const FOE_SCALE = { brute: 1.3, troll: 1.5, goblin: 0.72 };
function spawnFoes(gltfs) {
  const names = ['bandit', 'elite', 'zealot', 'mage', 'archer', 'brute', 'troll', 'goblin'];
  gltfs.forEach((g, i) => ModelLibrary._register(`ennemi_${names[i]}.glb`, g));
  names.forEach((sp, i) => {
    const r = tryCreateGlbRig('humanoid', { role: 'enemy:' + sp, species: sp, scale: FOE_SCALE[sp] || 1 });
    if (!r) { console.warn('pas de modèle pour', sp); return; }
    r.root.position.set(-7 + i * 2, 0, -9); scene.add(r.root); foes.push(r);
  });
  const guard = tryCreateGlbRig('humanoid', { role: 'enemy:shield_guard', species: 'guard' });
  if (guard) { guard.root.position.set(9, 0, -9); scene.add(guard.root); foes.push(guard); }
}
// bêtes : mêmes appels que Enemy.js (rôle « enemy:… », espèce, échelle du monstre), animées comme des créatures
const beasts = [];
function spawnBeasts(gltfs) {
  const names = ['boar', 'bear', 'skitter', 'alpha'], scale = { boar: 1.1, bear: 1.3, skitter: 0.55, alpha: 1.35 };
  gltfs.forEach((g, i) => ModelLibrary._register(`bete_${names[i]}.glb`, g));
  names.forEach((sp, i) => {
    const r = tryCreateGlbRig('creature', { role: 'enemy:' + sp, species: sp, scale: scale[sp] });
    if (!r) { console.warn('pas de modèle pour', sp); return; }
    r.root.position.set(-6 + i * 3, 0, 10); scene.add(r.root); beasts.push(r);
  });
}
// monture : mêmes appels que Player.js (createMount / updateMount, cavalier assis à mount.seat)
let mountRig = null, mountIdx = -1, flying = false, lift = 0;
function toggleMount(idx) {
  if (mountRig) { disposeMount(mountRig); mountRig = null; }
  flying = false; lift = 0;
  mountIdx = idx != null ? idx : (mountIdx + 1) % (MOUNTS.length + 1);
  if (mountIdx >= MOUNTS.length) { mountIdx = -1; return; }
  mountRig = createMount(MOUNTS[mountIdx]); scene.add(mountRig.group);
}
window.__mount = toggleMount;
// foule de figurants en versions allégées (LOD 1 et 2), pour mesurer le coût d'une foule de joueurs distants
const crowd = [];
function spawnCrowd(n) {
  for (let i = 0; i < n; i++) {
    const r = tryCreateGlbRig('humanoid', { role: 'player:warrior', lod: i % 2 ? 2 : 1 });
    const a = (i / n) * Math.PI * 2, d = 8;
    r.root.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); r.root.rotation.y = -a - Math.PI / 2;
    r.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    scene.add(r.root); crowd.push({ rig: r, v: i % 3 === 0 ? 0 : i % 3 === 1 ? 2 : 5 });
  }
}
// ---------------------------------------------------------------- le héros
const st = { x: 0, z: 2, yaw: Math.PI, speed: 0, dead: false, action: null, actionT: 0, actionDur: 0, grounded: true, vy: 0, y: 0, hp: 100 };
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); trigger('attack'); }
  if (e.code === 'KeyE') trigger('attack2'); if (e.code === 'KeyH') trigger('hit'); if (e.code === 'KeyX') trigger('death'); if (e.code === 'KeyR') trigger('revive');
  if (e.code === 'KeyL') spawnWolf();
  if (e.code === 'KeyM') toggleMount();
  if (e.code === 'KeyF' && mountRig && mountRig.def.fly) flying = !flying;
  const d = /^Digit([1-8])$/.exec(e.code); if (d) toggleSlot(+d[1]);
});
addEventListener('keyup', (e) => keys.delete(e.code));
let forceRun = false;
function trigger(a) {
  if (!rig) return;
  if (a === 'revive') { st.dead = false; st.action = null; st.hp = 100; return; }
  if (a === 'death') { st.dead = true; st.action = null; st.actionT = 0; return; }
  if (st.dead) return;
  if (a === 'hit') { rig.hurtT = 1; return; }
  if (a === 'jump') { if (st.grounded) { st.vy = 5.5; st.grounded = false; } return; }
  if (a === 'run') { forceRun = !forceRun; return; }
  if (a === 'attack' || a === 'attack2') { st.action = a; st.actionT = 0; st.actionDur = a === 'attack' ? 0.8 : 0.93; st.hitDone = false; }
}
for (const b of document.querySelectorAll('#btns button')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); trigger(b.dataset.a); });
const pad = document.getElementById('pad'), stick = document.getElementById('stick'); const joy = { x: 0, y: 0, id: null };
const moveStick = (e) => { const r = pad.getBoundingClientRect(); let dx = (e.clientX - (r.left + 65)) / 55, dy = (e.clientY - (r.top + 65)) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = dy; stick.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; };
pad.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); moveStick(e); });
pad.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveStick(e); });
const endStick = () => { joy.id = null; joy.x = joy.y = 0; stick.style.transform = ''; };
pad.addEventListener('pointerup', endStick); pad.addEventListener('pointercancel', endStick);

let camYaw = Number(q.get('cy')) || Math.PI, camPitch = 0.38, camDist = Number(q.get('cd')) || 5.6;
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (!drag) return; camYaw -= (e.clientX - drag.x) * 0.006; camPitch = Math.min(1.2, Math.max(0.05, camPitch + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('wheel', (e) => { camDist = Math.min(12, Math.max(2.2, camDist + e.deltaY * 0.004)); });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

// ---------------------------------------------------------------- le loup (IA minimale : chasse, mord, meurt, réapparaît)
function spawnWolf() {
  if (!ModelLibrary.ready) return;
  if (wolf) { scene.remove(wolf.rig.root); }
  const r = tryCreateGlbRig('creature', { species: 'wolf', role: 'species:wolf' });
  if (!r) return;
  const a = Math.random() * Math.PI * 2;
  wolf = { rig: r, x: st.x + Math.cos(a) * 9, z: st.z + Math.sin(a) * 9, yaw: 0, speed: 0, hp: 3, dead: false, deadT: 0, action: null, actionT: 0, cd: 0, hit: false, respawn: 0 };
  clampArena(wolf, 0.5);
  scene.add(r.root);
  window.__wolf = wolf;
}
function clampArena(o, rad) {
  for (const ob of obstacles) { const dx = o.x - ob.x, dz = o.z - ob.z, d = Math.hypot(dx, dz), min = ob.r + rad; if (d < min && d > 1e-4) { o.x = ob.x + dx / d * min; o.z = ob.z + dz / d * min; } }
  const R = Math.hypot(o.x, o.z); if (R > 13) { o.x *= 13 / R; o.z *= 13 / R; }
}
function stepWolf(dt) {
  const w = wolf; if (!w) return;
  if (w.dead) { w.deadT += dt; w.respawn -= dt; if (w.respawn <= 0) spawnWolf(); }
  else {
    const dx = st.x - w.x, dz = st.z - w.z, d = Math.hypot(dx, dz);
    w.cd -= dt;
    if (w.action) {
      w.actionT += dt;
      if (!w.hit && w.actionT > 0.42) { w.hit = true; if (d < 2.0 && !st.dead) { rig.hurtT = 1; st.hp -= 12; if (st.hp <= 0) { st.dead = true; st.actionT = 0; st.action = null; } } }
      if (w.actionT >= 0.9) { w.action = null; w.actionT = 0; w.cd = 1.4; }
      w.speed *= 0.9;
    } else if (d < 14 && !st.dead) {
      const want = d > 1.5 ? (d < 8 ? 5.2 : 3.2) : 0;
      w.speed += (want - w.speed) * Math.min(1, dt * 8);
      let ty = Math.atan2(dx, dz), dy = ty - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * Math.min(1, dt * 9);
      if (d <= 1.9 && w.cd <= 0) { w.action = 'attack'; w.actionT = 0; w.hit = false; }
    } else w.speed *= 0.9;
    w.x += Math.sin(w.yaw) * w.speed * dt; w.z += Math.cos(w.yaw) * w.speed * dt;
    // le loup et le héros ne se traversent pas
    const sx = w.x - st.x, sz = w.z - st.z, sd = Math.hypot(sx, sz); if (sd < 0.95 && sd > 1e-4) { w.x = st.x + sx / sd * 0.95; w.z = st.z + sz / sd * 0.95; }
    clampArena(w, 0.5);
  }
  w.rig.root.position.set(w.x, 0, w.z); w.rig.root.rotation.y = w.yaw;
  animateGlbRig(w.rig, { speed: w.speed, dead: w.dead, action: w.action, actionT: w.actionT, actionDur: 0.9, deadT: w.deadT, grounded: true }, dt, 'creature');
}
function heroStrike() {
  const w = wolf; if (!w || w.dead) return;
  const dx = w.x - st.x, dz = w.z - st.z, d = Math.hypot(dx, dz);
  const fwd = Math.sin(st.yaw) * dx + Math.cos(st.yaw) * dz;
  if (d < 2.6 && fwd > 0) {
    w.rig.hurtT = 1; w.hp -= 1; w.x += dx / d * 0.4; w.z += dz / d * 0.4;
    if (w.hp <= 0) { w.dead = true; w.deadT = 0; w.respawn = 5; w.action = null; }
  }
}

// ---------------------------------------------------------------- boucle
const demo = q.get('demo');
const clock = new THREE.Clock();
function frame() { step(Math.min(clock.getDelta(), 0.05), true); requestAnimationFrame(frame); }
function step(dt, draw) {
  if (rig) {
    let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
    let iz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp') ? 1 : 0) + joy.y;
    if (demo === 'walk' || demo === 'run') { ix = 0; iz = -1; }
    const mag = Math.min(1, Math.hypot(ix, iz));
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || forceRun || demo === 'run' || (joy.id != null && mag > 0.85);
    const target = mag > 0.05 && !st.dead && !st.action ? (running ? 6.5 : 3.2) * mag : 0;
    st.speed += (target - st.speed) * Math.min(1, dt * 10);
    if (mag > 0.05 && !st.dead && !st.action) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = -fz, rz = fx;
      const dx = fx * -iz + rx * ix, dz = fz * -iz + rz * ix;
      let d = Math.atan2(dx, dz) - st.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      st.yaw += d * Math.min(1, dt * 12);
      st.x += Math.sin(st.yaw) * st.speed * dt; st.z += Math.cos(st.yaw) * st.speed * dt;
    }
    clampArena(st, 0.4);
    if (!st.grounded) { st.vy -= 14 * dt; st.y += st.vy * dt; if (st.y <= 0) { st.y = 0; st.vy = 0; st.grounded = true; } }
    if (st.action) { st.actionT += dt; if (!st.hitDone && st.actionT > st.actionDur * 0.5) { st.hitDone = true; heroStrike(); } if (st.actionT >= st.actionDur) { st.action = null; st.actionT = 0; } }
    if (st.dead) st.actionT += dt;
    rig.root.position.set(st.x, st.y, st.z); rig.root.rotation.y = st.yaw;
    if (mountRig) { lift += ((flying ? 3.0 : 0) - lift) * Math.min(1, dt * 2); mountRig.group.position.set(st.x, st.y + lift, st.z); mountRig.group.rotation.y = st.yaw; updateMount(mountRig, dt, st.speed + (flying ? 3 : 0), flying); rig.root.position.y += mountRig.seat + lift; }
    for (const b of beasts) animateGlbRig(b, { speed: 0, grounded: true }, dt, 'creature');
    for (const f of foes) animateGlbRig(f, { speed: 0, grounded: true }, dt, 'humanoid');
    for (const c of crowd) animateGlbRig(c.rig, { speed: c.v, grounded: true }, dt, 'humanoid');
    animateGlbRig(rig, { riding: !!mountRig, speed: mountRig ? 0 : st.speed, dead: st.dead, action: st.action, actionT: st.actionT, actionDur: st.actionDur, grounded: st.grounded, deadT: st.actionT }, dt, 'humanoid');
    stepWolf(dt);
    if (demo === 'attack' && !st.action && !st.dead) trigger('attack');
    const el = document.getElementById('st');
    if (el) el.textContent = `héros : ${st.dead ? 'mort' : st.action || (st.speed > 4.6 ? 'course' : st.speed > 0.35 ? 'marche' : 'repos')} · vie ${Math.max(0, st.hp)} · loup : ${!wolf ? '–' : wolf.dead ? 'mort' : wolf.action || (wolf.speed > 4 ? 'course' : wolf.speed > 0.35 ? 'marche' : 'repos')} · vie ${wolf ? Math.max(0, wolf.hp) : 0}`;
  }
  const tx = st.x, tz = st.z, ty = 1.1;
  cam.position.set(tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, ty + Math.sin(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
  cam.lookAt(tx, ty, tz);
  if (draw) renderer.render(scene, cam);
}
// pas de simulation déterministe pour les tests automatiques (aucune dépendance à la cadence d'affichage)
window.__step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt, i === n - 1); };
window.__info = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
window.__state = () => ({ hero: st, wolf: wolf && { x: wolf.x, z: wolf.z, hp: wolf.hp, dead: wolf.dead, action: wolf.action } });
frame();
