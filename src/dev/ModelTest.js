// Zone de test des modèles GLB : un personnage, son animation et son déplacement dans une petite arène.
// Utilise exactement le code d'animation du jeu (ModelLibrary.tryCreateGlbRig / animateGlbRig).
// Commandes : ZQSD / WASD / flèches = marcher, Maj = courir, Espace = attaque, E = attaque 2, H = coup reçu, X = mort, R = relever,
// souris/doigt = tourner la caméra, molette = zoom ; sur mobile : joystick à gauche, boutons à droite.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelLibrary, tryCreateGlbRig, animateGlbRig } from '../visual/ModelLibrary.js';

const q = new URLSearchParams(location.search);
const FILE = q.get('f') || 'models_proto/corvalune_veilleur.glb';
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1a28); scene.fog = new THREE.FogExp2(0x1b1a28, 0.035);
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);

// lumière : clair de lune + reflet chaud + environnement doux
const pm = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0x30304a);
const m1 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xcfd8ff })); m1.position.set(-4, 5, 4); m1.scale.setScalar(2); envScene.add(m1);
const m2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff9a60 })); m2.position.set(5, 1, -4); m2.scale.setScalar(1.5); envScene.add(m2);
scene.environment = pm.fromScene(envScene, 0.04).texture;
const moon = new THREE.DirectionalLight(0xbfc9ff, 2.6); moon.position.set(-6, 9, 5); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); scene.add(moon);
const warm = new THREE.DirectionalLight(0xff9a60, 1.5); warm.position.set(6, 3, -5); scene.add(warm);
scene.add(new THREE.HemisphereLight(0x8a8ab8, 0x3a3028, 0.8));

// petite arène : sol, anneau de pierres (obstacles à collision), repères
const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x262431, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(28, 28, 0x403a5a, 0x2e2a42); grid.position.y = 0.01; scene.add(grid);
const obstacles = [];
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3b3948, roughness: 0.9, flatShading: true });
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2 + 0.3, r = 7.5;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.25, 0), stoneMat);
  rock.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r); rock.rotation.set(i, i * 2, 0); rock.castShadow = rock.receiveShadow = true; scene.add(rock);
  obstacles.push({ x: rock.position.x, z: rock.position.z, r: 0.9 + (i % 3) * 0.25 });
}
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3, 12), stoneMat); pillar.position.set(-3, 1.5, -3); pillar.castShadow = true; scene.add(pillar);
obstacles.push({ x: -3, z: -3, r: 0.6 });

// ---- chargement du GLB et branchement sur ModelLibrary (même chemin que dans le jeu) ----
const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
let rig = null;
const loader = new GLTFLoader();
loader.load(base + FILE, (gltf) => {
  const name = FILE.split('/').pop();
  ModelLibrary._register(name, gltf);
  ModelLibrary.mapping = { 'player:warrior': name };
  ModelLibrary.ready = true;
  rig = tryCreateGlbRig('humanoid', { role: 'player:warrior' });
  if (!rig) { hud.textContent = 'Échec : tryCreateGlbRig a renvoyé null'; return; }
  scene.add(rig.root);
  const names = (gltf.animations || []).map((a) => a.name).join(', ');
  hud.innerHTML = `<b>Veilleur de Corvalune</b> — animations lues dans le fichier : ${names || 'aucune'}<br>` +
    `ZQSD/flèches : marcher · Maj : courir · Espace : attaque · E : attaque 2 · H : coup reçu · X : mort · R : relever<br><span id="st"></span>`;
  window.__rig = rig; window.__ready = true;
}, undefined, (e) => { hud.textContent = 'Erreur de chargement : ' + (e && e.message); console.error(e); });

// ---- état du personnage ----
const st = { x: 0, z: 0, yaw: 0, speed: 0, dead: false, action: null, actionT: 0, actionDur: 0, grounded: true, vy: 0, y: 0, hurt: 0 };
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'Space') { e.preventDefault(); trigger('attack'); } if (e.code === 'KeyE') trigger('attack2'); if (e.code === 'KeyH') trigger('hit'); if (e.code === 'KeyX') trigger('death'); if (e.code === 'KeyR') trigger('revive'); });
addEventListener('keyup', (e) => keys.delete(e.code));
let forceRun = false;
function trigger(a) {
  if (!rig) return;
  if (a === 'revive') { st.dead = false; st.action = null; return; }
  if (a === 'death') { st.dead = true; st.action = null; st.actionT = 0; return; }
  if (st.dead) return;
  if (a === 'hit') { rig.hurtT = 1; return; }
  if (a === 'jump') { if (st.grounded) { st.vy = 5.5; st.grounded = false; } return; }
  if (a === 'run') { forceRun = !forceRun; return; }
  if (a === 'attack' || a === 'attack2') { st.action = a; st.actionT = 0; st.actionDur = a === 'attack' ? 0.8 : 0.93; }
}
for (const b of document.querySelectorAll('#btns button')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); trigger(b.dataset.a); });
// joystick virtuel
const pad = document.getElementById('pad'), stick = document.getElementById('stick'); const joy = { x: 0, y: 0, id: null };
const moveStick = (e) => { const r = pad.getBoundingClientRect(); let dx = (e.clientX - (r.left + 65)) / 55, dy = (e.clientY - (r.top + 65)) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = dy; stick.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; };
pad.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); moveStick(e); });
pad.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveStick(e); });
const endStick = () => { joy.id = null; joy.x = joy.y = 0; stick.style.transform = ''; };
pad.addEventListener('pointerup', endStick); pad.addEventListener('pointercancel', endStick);

// caméra orbitale
let camYaw = Number(q.get('cy')) || Math.PI, camPitch = 0.38, camDist = Number(q.get('cd')) || 5.2;
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (!drag) return; camYaw -= (e.clientX - drag.x) * 0.006; camPitch = Math.min(1.2, Math.max(0.05, camPitch + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('wheel', (e) => { camDist = Math.min(12, Math.max(2.2, camDist + e.deltaY * 0.004)); });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

// scénario automatique pour les captures : ?demo=walk|run|attack|death
const demo = q.get('demo');
if (demo) { window.__demo = demo; }

const clock = new THREE.Clock();
let acc = 0;
function frame() {
  step(Math.min(clock.getDelta(), 0.05), true);
  requestAnimationFrame(frame);
}
function step(dt, draw) {
  if (rig) {
    // direction souhaitée, relative à la caméra
    let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
    let iz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp') ? 1 : 0) + joy.y;
    if (demo === 'walk' || demo === 'run') { ix = 0; iz = -1; }
    const mag = Math.min(1, Math.hypot(ix, iz));
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || forceRun || demo === 'run' || (joy.id != null && mag > 0.85);
    const target = mag > 0.05 && !st.dead && !(st.action) ? (running ? 6.5 : 3.2) * mag : 0;
    st.speed += (target - st.speed) * Math.min(1, dt * 10);
    if (mag > 0.05 && !st.dead && !st.action) {
      const cx = Math.sin(camYaw), cz = Math.cos(camYaw);            // avant de la caméra → vers -cam
      const fx = -cx, fz = -cz, rx = -fz, rz = fx;
      const dx = fx * -iz + rx * ix, dz = fz * -iz + rz * ix;
      const ty = Math.atan2(dx, dz);
      let d = ty - st.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      st.yaw += d * Math.min(1, dt * 12);
      st.x += Math.sin(st.yaw) * st.speed * dt; st.z += Math.cos(st.yaw) * st.speed * dt;
    }
    // collisions : cercle contre obstacles + limite de l'arène
    for (const o of obstacles) { const dx = st.x - o.x, dz = st.z - o.z, d = Math.hypot(dx, dz), min = o.r + 0.4; if (d < min && d > 1e-4) { st.x = o.x + dx / d * min; st.z = o.z + dz / d * min; } }
    const R = Math.hypot(st.x, st.z); if (R > 13) { st.x *= 13 / R; st.z *= 13 / R; }
    // saut simple
    if (!st.grounded) { st.vy -= 14 * dt; st.y += st.vy * dt; if (st.y <= 0) { st.y = 0; st.vy = 0; st.grounded = true; } }
    if (st.action) { st.actionT += dt; if (st.actionT >= st.actionDur) { st.action = null; st.actionT = 0; } }
    if (st.dead) st.actionT += dt;
    rig.root.position.set(st.x, st.y, st.z); rig.root.rotation.y = st.yaw;
    animateGlbRig(rig, { speed: st.speed, dead: st.dead, action: st.action, actionT: st.actionT, actionDur: st.actionDur, grounded: st.grounded, deadT: st.actionT }, dt, 'humanoid');
    if (demo === 'attack' && !st.action && !st.dead) trigger('attack');
    const el = document.getElementById('st');
    if (el) el.textContent = `état : ${st.dead ? 'mort' : st.action || (st.speed > 4.6 ? 'course' : st.speed > 0.35 ? 'marche' : 'repos')} · vitesse ${st.speed.toFixed(1)} m/s`;
  }
  // caméra
  const tx = st.x, tz = st.z, ty = 1.1;
  cam.position.set(tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, ty + Math.sin(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
  cam.lookAt(tx, ty, tz);
  if (draw) renderer.render(scene, cam);
}
// pas de simulation déterministe (utilisé par les tests automatiques : pas de dépendance à la cadence d'affichage)
window.__step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt, i === n - 1); };
frame();
