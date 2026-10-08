import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Bibliothèque de modèles 3D (GLB) optionnels — V3.
//
// Dépose des fichiers .glb dans  public/models/  : le jeu les découvre tout seul
// (voir vite.config.js → /models/index.json) et s'en sert à la place des modèles
// procéduraux, avec squelette + animations (repos, marche, course, attaque,
// coup reçu, mort…). Si un rôle n'a pas de modèle correspondant, ou si quoi que ce
// soit échoue, le jeu garde le modèle procédural : rien ne peut casser.
//
// Association rôle → modèle :
//   1. public/models/mapping.json (optionnel) : { "player:mage": "Mage.glb", "species:wolf": "Wolf.glb" }
//   2. mots-clés dans le nom du fichier (knight, mage, rogue, skeleton, wolf, orc…)
//   3. pour les humanoïdes sans correspondance : un personnage de la bibliothèque
//
// Les fichiers d'animations seuls (sans maillage) sont acceptés : leurs clips sont
// partagés avec tous les personnages dont les os portent les mêmes noms.

const ROLE_KEYWORDS = {
  'player:warrior': ['warrior', 'knight', 'barbarian', 'paladin', 'soldier'],
  'player:paladin': ['paladin', 'knight', 'cleric', 'warrior', 'soldier'],
  'player:mage': ['mage', 'wizard', 'sorcer', 'witch', 'cleric'],
  'player:archer': ['ranger', 'archer', 'hunter', 'elf', 'rogue'],
  'player:assassin': ['rogue', 'assassin', 'thief', 'ninja', 'ranger'],
  npc: ['villager', 'peasant', 'merchant', 'civilian', 'farmer', 'cleric', 'knight'],
  'species:bandit': ['bandit', 'rogue', 'barbarian', 'goblin', 'orc', 'skeleton_minion', 'skeleton'],
  'species:elite': ['skeleton_warrior', 'warrior', 'knight', 'orc', 'barbarian', 'skeleton'],
  'species:brute': ['ogre', 'orc', 'golem', 'troll', 'brute', 'barbarian'],
  'species:goblin': ['goblin', 'imp', 'minion'],
  'species:wolf': ['wolf', 'dog', 'fox', 'hound'],
  'species:boar': ['boar', 'pig', 'bull', 'deer', 'hog'],
  'species:bear': ['bear', 'gorilla', 'ape'],
  boss: ['boss', 'dragon', 'golem', 'troll', 'ogre', 'demon', 'bear', 'minotaur']
};

// Clips : le premier motif qui correspond gagne
const CLIP_PATTERNS = {
  idle: [/^idle$/i, /idle/i, /stand/i, /breath/i],
  walk: [/^walk$/i, /walk/i, /jog/i],
  run: [/^run$/i, /run/i, /sprint/i, /gallop/i],
  jump: [/jump/i, /leap/i],
  hit: [/hit_?[ab]?$/i, /hitrec/i, /hurt/i, /react/i, /damage/i, /flinch/i, /get.?hit/i],
  death: [/death/i, /die/i, /dead/i, /defeat/i],
  interact: [/interact/i, /cheer/i, /wave/i, /pickup/i, /use/i, /spawn/i, /talk/i],
  attack: [/1h.*(slice|chop|stab|attack)/i, /melee/i, /attack/i, /slash/i, /swing/i, /punch/i, /bite/i, /claw/i, /stab/i, /sword/i],
  attack2: [/2h|heavy|spin|combo|horizontal|big/i, /attack.?2|attack_b|slash_?2/i, /kick/i],
  cast: [/cast/i, /spell/i, /magic/i],
  shoot: [/bow|shoot|ranged|aim/i]
};

const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export const ModelLibrary = {
  characters: [], // { file, key, scene, clips }
  clips: new Map(), // nom minuscule → clip (toutes sources)
  mapping: {},
  ready: false,
  count: 0,
  _promise: null,

  init(timeoutMs = 25000) {
    if (!this._promise) this._promise = this._load(timeoutMs).catch((e) => { console.warn('[V3] modèles GLB indisponibles', e); });
    return this._promise;
  },

  async _load(timeoutMs) {
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    let index;
    try {
      const r = await fetch(`${base}models/index.json`, { cache: 'no-store' });
      if (!r.ok) return;
      index = await r.json();
    } catch (e) { return; }
    this.mapping = index.mapping || {};
    const files = (index.files || []).filter((f) => /\.(glb|gltf)$/i.test(f));
    if (!files.length) return;
    const loader = new GLTFLoader();
    const started = performance.now();
    let i = 0;
    const worker = async () => {
      while (i < files.length && performance.now() - started < timeoutMs) {
        const file = files[i++];
        try {
          const gltf = await loader.loadAsync(`${base}models/${encodeURIComponent(file)}`);
          this._register(file, gltf);
        } catch (e) { console.warn('[V3] GLB ignoré :', file, e); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    this.ready = this.characters.length > 0;
    this.count = this.characters.length;
    console.info(`[V3] ${this.characters.length} modèle(s), ${this.clips.size} animation(s) chargés`);
  },

  _register(file, gltf) {
    let hasMesh = false;
    gltf.scene.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) hasMesh = true; });
    for (const c of gltf.animations || []) {
      const k = c.name.toLowerCase();
      if (!this.clips.has(k)) this.clips.set(k, c);
    }
    if (hasMesh) this.characters.push({ file, key: file.toLowerCase().replace(/\.(glb|gltf)$/i, ''), scene: gltf.scene, clips: gltf.animations || [] });
  },

  // Cherche l'entrée correspondant à un rôle ; renvoie null → modèle procédural
  find(role, species, kind) {
    if (!this.ready) return null;
    const byFile = (name) => this.characters.find((c) => c.file.toLowerCase() === String(name).toLowerCase());
    for (const k of [role, species && `species:${species}`]) {
      if (k && this.mapping[k]) { const e = byFile(this.mapping[k]); if (e) return e; }
    }
    const keyOf = (r) => ROLE_KEYWORDS[r] || ROLE_KEYWORDS[String(r).split(':')[0]];
    const lists = [keyOf(role), species && ROLE_KEYWORDS[`species:${species}`]].filter(Boolean);
    for (const kws of lists) {
      for (const kw of kws) {
        const matches = this.characters.filter((c) => c.key.includes(kw));
        if (matches.length) return matches[hashStr(role || '') % matches.length];
      }
    }
    if (kind === 'humanoid' && /^(player|npc)/.test(role || '')) {
      const pool = this.characters.filter((c) => !/wolf|boar|bear|dog|fox|spider|bat|rat|slime|dragon/.test(c.key));
      if (pool.length) return pool[hashStr(role) % pool.length];
    }
    return null;
  },

  findClip(entry, state, role = '') {
    const classId = (role.split(':')[1] || '');
    let lists = CLIP_PATTERNS[state] || [];
    if (state === 'attack' || state === 'attack2') {
      const pref = classId === 'mage' ? CLIP_PATTERNS.cast : classId === 'archer' ? CLIP_PATTERNS.shoot : null;
      if (pref) lists = [...pref, ...lists];
    }
    const own = entry.clips || [];
    for (const re of lists) {
      let c = own.find((x) => re.test(x.name));
      if (c) return c;
      for (const [k, v] of this.clips) if (re.test(k)) return v;
    }
    return null;
  }
};

const box = new THREE.Box3(), size = new THREE.Vector3();

// Construit un rig compatible avec l'interface des rigs procéduraux.
export function tryCreateGlbRig(kind, opts = {}) {
  const role = opts.role || '';
  const entry = ModelLibrary.find(role, opts.species, kind);
  if (!entry) return null;
  const inst = SkeletonUtils.clone(entry.scene);
  const root = new THREE.Group();
  root.add(inst);

  // normalisation de la taille et pose au sol
  box.makeEmpty().setFromObject(inst);
  box.getSize(size);
  const target = kind === 'humanoid' ? 1.8 : 1.0;
  const refH = kind === 'humanoid' ? size.y : Math.max(size.y, size.z * 0.6);
  const k = refH > 1e-3 ? target / refH : 1;
  inst.scale.multiplyScalar(k);
  inst.position.y = -box.min.y * k;
  root.scale.setScalar(opts.scale || 1);

  const tint = opts.tint != null ? new THREE.Color(opts.tint) : null;
  const mats = [];
  inst.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    o.castShadow = true;
    o.frustumCulled = false;
    if (o.geometry) o.geometry.userData.shared = true;
    const cloneMat = (m) => {
      const c = m.clone();
      if (tint) c.color?.lerp(tint, 0.3);
      mats.push(c);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(cloneMat) : cloneMat(o.material);
  });

  const stub = () => ({ visible: false });
  const head = new THREE.Object3D();
  root.add(head);
  const mixer = new THREE.AnimationMixer(inst);
  const rig = {
    root, body: root, hips: stub(), torso: stub(), head,
    mats, matRefs: { weapons: {} },
    equipVisuals: { weapons: {}, shield: stub(), helm: stub(), shoulders: [stub(), stub()], chest: stub(), cape: stub() },
    phase: 0, k: 0, t: 0, hurtT: 0, crouchK: 0,
    glb: { entry, mixer, role, actions: {}, state: null, action: null, prevHurt: 0, prevActionT: 0, flash: 0 }
  };
  return rig;
}

const ONE_SHOT = new Set(['attack', 'attack2', 'interact', 'death', 'hit', 'jump']);
const FALLBACK = { attack2: ['attack'], attack: ['cast', 'shoot', 'attack2'], interact: ['idle'], jump: ['run'], hit: [], death: [], walk: ['run', 'idle'], run: ['walk', 'idle'] };
const easeOut = (t) => 1 - (1 - t) * (1 - t);

function getAction(g, state) {
  if (g.actions[state] !== undefined) return g.actions[state];
  let clip = ModelLibrary.findClip(g.entry, state, g.role);
  if (!clip) for (const f of FALLBACK[state] || []) { clip = ModelLibrary.findClip(g.entry, f, g.role); if (clip) break; }
  const act = clip ? g.mixer.clipAction(clip) : null;
  g.actions[state] = act;
  return act;
}

function play(g, state, { dur = 0, fade = 0.15, scale = 1 } = {}) {
  const act = getAction(g, state);
  if (!act) return null;
  const prev = g.action;
  const once = ONE_SHOT.has(state);
  act.reset();
  act.enabled = true;
  act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  act.clampWhenFinished = once;
  const clipDur = act.getClip().duration || 1;
  act.timeScale = once && dur > 0 ? Math.min(3, clipDur / dur) : scale;
  act.play();
  if (prev && prev !== act) prev.crossFadeTo(act, fade, false);
  else act.fadeIn(fade);
  g.action = act;
  g.state = state;
  return act;
}

// s = état d'animation identique à celui des rigs procéduraux
export function animateGlbRig(rig, s, dt, kind = 'humanoid') {
  const g = rig.glb;
  rig.t += dt;
  rig.hurtT = Math.max(0, rig.hurtT - dt * 3.5);
  const dead = !!s.dead;
  const acting = !dead && (s.action === 'attack' || s.action === 'attack2' || s.action === 'interact');
  const speed = s.speed || 0;
  const loco = speed > 4.6 ? 'run' : speed > 0.35 ? 'walk' : 'idle';
  let want;
  if (dead) want = 'death';
  else if (acting) want = s.action;
  else if (kind === 'humanoid' && s.grounded === false && getAction(g, 'jump')) want = 'jump';
  else want = loco;

  const aT = s.actionT ?? 0;
  const restart = acting && want === g.state && aT < g.prevActionT - 0.02;
  g.prevActionT = aT;

  // réaction au coup reçu (si la bibliothèque a un clip adapté)
  const gotHit = rig.hurtT > 0.95 && g.prevHurt <= 0.95;
  g.prevHurt = rig.hurtT;
  if (gotHit && !dead && !acting && getAction(g, 'hit')) {
    play(g, 'hit', { dur: 0.35, fade: 0.05 });
    g.hitUntil = rig.t + 0.4;
  }

  if (rig.t < (g.hitUntil || 0) && !dead && !acting) {
    // laisse jouer la réaction
  } else if (want !== g.state || restart) {
    if (want === 'death') {
      if (!play(g, 'death', { fade: 0.1 })) g.noDeathClip = true;
    } else if (acting) {
      play(g, want, { dur: s.actionDur > 0 ? s.actionDur : 0, fade: 0.08 });
    } else if (!play(g, want, { fade: 0.2 })) {
      g.state = want;
    }
  }
  // cadence de marche/course proportionnelle à la vitesse
  if (g.action && !ONE_SHOT.has(g.state)) {
    g.action.timeScale = g.state === 'run' ? Math.min(1.6, Math.max(0.8, speed / 6.5)) : g.state === 'walk' ? Math.min(1.5, Math.max(0.7, speed / 3.2)) : 1;
  }

  // repli : pas de clip de mort → on couche le modèle comme le rig procédural
  if (dead && (g.noDeathClip || !g.action)) {
    const p = Math.min(1, (kind === 'humanoid' ? s.actionT / 0.7 : s.deadT / 0.5) || 0);
    if (kind === 'humanoid') rig.root.rotation.x = -Math.PI / 2 * easeOut(p);
    else rig.root.rotation.z = (Math.PI / 2) * p;
  } else {
    rig.root.rotation.x = 0;
    if (kind !== 'humanoid') rig.root.rotation.z = 0;
  }

  g.mixer.update(dt);

  // flash rouge de dégâts
  const f = Math.round(rig.hurtT * 10) / 10;
  if (f !== g.flash) {
    g.flash = f;
    for (const m of rig.mats) if (m.emissive) m.emissive.setRGB(f * 0.9, 0, 0);
  }
}
