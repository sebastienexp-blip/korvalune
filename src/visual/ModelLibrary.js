import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildExtraClips } from './ExtraClips.js';

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
  npc: ['villageois', 'villager', 'peasant', 'merchant', 'civilian', 'farmer', 'cleric', 'knight'],
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
  ride: [/^ride$/i, /^sit$/i, /mount/i, /saddle/i],
  hit: [/hit_?[ab]?$/i, /hitrec/i, /hurt/i, /react/i, /damage/i, /flinch/i, /get.?hit/i],
  death: [/death/i, /die/i, /dead/i, /defeat/i],
  interact: [/interact/i, /cheer/i, /wave/i, /pickup/i, /use/i, /spawn/i, /talk/i],
  attack: [/1h.*(slice|chop|stab|attack)/i, /melee/i, /attack/i, /slash/i, /swing/i, /punch/i, /bite/i, /claw/i, /stab/i, /sword/i],
  attack2: [/2h|heavy|spin|combo|horizontal|big/i, /attack.?2|attack_b|slash_?2/i, /kick/i],
  cast: [/cast/i, /spell/i, /magic/i],
  shoot: [/bow|shoot|ranged|aim/i],
  roll: [/^roll$/i, /roll|dodge|tumble/i]
};

const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

// V10.76 — Textures Ultra HD (tex_hd/*.webp, 4096 / 2560 / 2048 px) : même noms que tex/, remplacées à la volée par le chargeur.
// Activées par le réglage « Textures Ultra HD » (auto : PC puissant — pas de tactile, ≥ 8 Go, ≥ 6 cœurs, texture max ≥ 8192 px).
function wantHd() {
  let st = {};
  try { st = JSON.parse(localStorage.getItem('aetheria.settings.v1')) || {}; } catch { st = {}; }
  const v = st.hdTex || 'auto';
  if (v === 'off') return false;
  let maxTex = 0;
  try { const gl = document.createElement('canvas').getContext('webgl2'); maxTex = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0; } catch { maxTex = 0; }
  if (maxTex < 4096) return false;
  if (v === 'on') return true;
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 1;
  return !touch && (navigator.deviceMemory || 8) >= 8 && (navigator.hardwareConcurrency || 4) >= 6 && maxTex >= 8192;
}

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

  /** Textures de sol (détail + normales) livrées dans models/tex ; absentes → le monde garde sa texture dessinée par code. */
  _loadTerrain(base, t) {
    this.terrainTex = null;
    if (!t || !t.detail) return;
    const L = new THREE.TextureLoader();
    const hd = this._hd;
    const get = (u) => new Promise((res) => { const name = u.replace(/^tex\//, ''); const h = hd && hd.index[name]; L.load(`${base}models/${h ? 'tex_hd/' + h.f : u}`, res, undefined, () => (h ? L.load(`${base}models/${u}`, res, undefined, () => res(null)) : res(null))); });
    this._terrainP = Promise.all([get(t.detail), t.normal ? get(t.normal) : null]).then(([detail, normal]) => {
      if (!detail) return;
      detail.colorSpace = THREE.SRGBColorSpace;
      for (const x of [detail, normal]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = hd ? 8 : 4; }
      this.terrainTex = { detail, normal };
    }).catch(() => {});
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
    this._hd = null;
    if (wantHd()) {
      try {
        const r = await fetch(`${base}models/tex_hd/index.json`);
        if (r.ok) { const ix = await r.json(); if (ix && Object.keys(ix).length) this._hd = { index: ix }; }
      } catch { this._hd = null; }
    }
    this.hdTextures = !!this._hd;
    this._loadTerrain(base, index.terrain);
    const files = (index.files || []).filter((f) => /\.(glb|gltf)$/i.test(f));
    if (!files.length) return;
    const manager = new THREE.LoadingManager();
    if (this._hd) {   // textures « tex/<nom> » → « tex_hd/<nom HD> » (si une version HD existe)
      const ix = this._hd.index;
      manager.setURLModifier((url) => {
        const m = /\/tex\/([^/?#]+)$/.exec(url);
        const h = m && ix[decodeURIComponent(m[1])];
        return h ? url.replace(/\/tex\/[^/?#]+$/, '/tex_hd/' + h.f) : url;
      });
    }
    const loader = new GLTFLoader(manager);
    if (this._hd) {   // HD : UNE seule copie en mémoire de chaque texture (sinon chaque .glb décode sa propre image 4096² → des Go)
      const shared = new Map();
      loader.register((parser) => ({
        name: 'KV_shared_textures',
        loadTexture(index) {
          const def = parser.json.textures && parser.json.textures[index];
          const img = def && parser.json.images && parser.json.images[def.source];
          if (!img || !img.uri) return null;
          const url = THREE.LoaderUtils.resolveURL(img.uri, parser.options.path);
          let p = shared.get(url);
          if (!p) {
            p = parser.loadTextureImage(index, def.source, parser.textureLoader);
            shared.set(url, p);
          }
          return p;
        }
      }));
    }
    // V10.42 — ordre de priorité (le décor et le héros d'abord, montures/boss en dernier) ; la coupure ne se déclenche que si plus
    // aucun fichier n'aboutit pendant `stallMs` (réseau lent ≠ réseau bloqué), avec un plafond global `hardMs`.
    const prio = (f) => /^(ville_|nature_)/.test(f) ? 0 : /veilleur|armure|casque|epaul|plastron|jambi|botte|gant/i.test(f) ? 1 : /^(ennemi_|bete_|loup)/.test(f) ? 2 : /^(boss_|monture_)/.test(f) ? 4 : 3;
    files.sort((a, b) => prio(a) - prio(b) || a.localeCompare(b));
    const stallMs = Math.max(timeoutMs * 0.6, 12000), hardMs = Math.max(timeoutMs * 4, 90000);
    const started = performance.now(); let last = started, done = 0, i = 0;
    const alive = () => { const n = performance.now(); return n - last < stallMs && n - started < hardMs; };
    const worker = async () => {
      while (i < files.length && alive()) {
        const file = files[i++];
        try {
          const gltf = await loader.loadAsync(`${base}models/${encodeURIComponent(file)}`);
          if (this._hd) gltf.scene.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap']) if (m[k]) m[k].anisotropy = 8; });
          this._register(file, gltf);
        } catch (e) { console.warn('[V3] GLB ignoré :', file, e); }
        last = performance.now(); done++;
        if (this.onProgress) try { this.onProgress(done, files.length); } catch { /* affichage facultatif */ }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), this._terrainP]);
    if (done < files.length) console.warn(`[V3] chargement interrompu : ${done}/${files.length} modèles`);
    try { for (const c of buildExtraClips()) if (!this.clips.has(c.name)) this.clips.set(c.name, c); } catch (e) { console.warn('[V10.48] mouvements supplémentaires ignorés', e); }   // roulade, tir à l'arc, incantation, émotes
    this.ready = this.characters.length > 0;
    this.count = this.characters.length;
    console.info(`[V3] ${this.characters.length} modèle(s), ${this.clips.size} animation(s) chargés`);
  },

  nature: {},
  town: {},            // kit « ville » GLB (V10.41 Lot 6) : kind → gltf          // décor statique GLB (V10.41 Lot 5) : kind[_lo] → gltf
  gear: { armor: {}, weapons: {}, mounts: {} },   // mounts[kind] : montures GLB (cheval, griffon)   // pièces d'équipement GLB (V10.41) : armor[skeleton][slot], weapons[visual]

  /** Géométrie fusionnée (un seul maillage, attributs position/normal/uv/color) d'un décor GLB, ou null si absent. */
  natureGeometry(kind, lod = 'hi') {
    const key = lod === 'lo' && this.nature[kind + '_lo'] ? kind + '_lo' : kind;
    const g = this.nature[key];
    if (!g) return null;
    this._natGeo ||= {};
    if (this._natGeo[key]) return this._natGeo[key];
    let mesh = null;
    g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return null;
    const geo = mesh.geometry.clone();
    const c = geo.getAttribute('color');
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3).fill(1);
    if (c) for (let i = 0; i < n; i++) { col[i * 3] = c.getX(i); col[i * 3 + 1] = c.getY(i); col[i * 3 + 2] = c.getZ(i); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._natMap ||= mesh.material && mesh.material.map;
    return (this._natGeo[key] = geo);
  },

  /** Prépare un matériau (vertexColors, éventuellement balancement) pour l'atlas de nature : texture, découpe des feuilles, normales de feuillage non retournées. */
  natureMaterial(mat) {
    if (!this._natMap) return mat;
    mat.map = this._natMap; mat.alphaTest = 0.5; mat.side = THREE.DoubleSide; mat.vertexColors = true;
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal *= faceDirection;');
    };
    mat.customProgramCacheKey = () => key + '_nat';
    mat.needsUpdate = true;
    return mat;
  },

  hasTown(kinds) { return kinds.every((k) => this.town[k]); },
  townMeta(kind) { const g = this.town[kind]; return (g && g.asset && g.asset.extras && g.asset.extras.korvalune) || {}; },

  _townPart(kind) {
    this._townParts ||= {};
    if (this._townParts[kind]) return this._townParts[kind];
    const g = this.town[kind]; const parts = [];
    if (g) g.scene.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, src: o.material, name: o.material.name }); });
    return (this._townParts[kind] = parts);
  },

  /** Matériau partagé du kit (une seule copie des textures pour tous les fichiers) ; `window` = matériau de fenêtre du monde (nuit). */
  townMaterial(name, src, windowMat) {
    if (name === 'window' && windowMat) return windowMat;
    if (name === 'glow') { this._townMats ||= {}; return (this._townMats.glow ||= new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7) })); }
    this._townMats ||= {};
    if (!this._townMats[name]) { const m = src.clone(); m.vertexColors = true; this._townMats[name] = m; }
    return this._townMats[name];
  },

  _townGeo(kind, i, tint) {
    const part = this._townPart(kind)[i];
    if (!part.roles) {   // rôles de sommets réellement utilisés : la clé du cache ne dépend que des teintes qui comptent (évite de cloner la géométrie à chaque changement de couleur)
      const ca = part.geo.getAttribute('color'); const r = { wall: false, roof: false, trim: false };
      if (ca && ca.itemSize === 4) for (let k = 0; k < ca.count; k++) { const a = ca.getW(k); if (Math.abs(a - 0.8) < 0.05) r.wall = true; else if (Math.abs(a - 0.6) < 0.05) r.roof = true; else if (Math.abs(a - 0.4) < 0.05) r.trim = true; }
      part.roles = r;
    }
    const R = part.roles;
    const key = `${kind}|${i}|${tint ? [R.wall ? tint.wall : '', R.roof ? tint.roof : '', R.trim ? (tint.trim ?? tint.roof) : ''].join(',') : ''}`;
    this._townGeos ||= {};
    if (this._townGeos[key]) return this._townGeos[key];
    const geo = part.geo.clone();
    const c = part.geo.getAttribute('color'), n = geo.getAttribute('position').count;
    const out = new Float32Array(n * 3).fill(1);
    const T = tint ? { wall: new THREE.Color(tint.wall), roof: new THREE.Color(tint.roof), trim: new THREE.Color(tint.trim ?? tint.roof) } : null;
    if (c) {
      for (let k = 0; k < n; k++) {
        let r = c.getX(k), gg = c.getY(k), b = c.getZ(k);
        if (T && c.itemSize === 4) {
          const a = c.getW(k), t = Math.abs(a - 0.8) < 0.05 ? T.wall : Math.abs(a - 0.6) < 0.05 ? T.roof : Math.abs(a - 0.4) < 0.05 ? T.trim : null;
          if (t) { r *= t.r; gg *= t.g; b *= t.b; }
        }
        out[k * 3] = r; out[k * 3 + 1] = gg; out[k * 3 + 2] = b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
    geo.userData.shared = true;   // jamais libérée par les cosmétiques / décors qui la partagent
    return (this._townGeos[key] = geo);
  },

  /** Forme seule d'un module (toutes ses parties fusionnées, sans couleurs de sommets) : pour les décors dont la teinte/matériau vient du code (donjons à thème). null si absent. */
  townMergedGeometry(kind) {
    if (!this.town[kind]) return null;
    this._mergedGeo ||= {};
    if (this._mergedGeo[kind]) return this._mergedGeo[kind];
    const gs = this._townPart(kind).map((p) => { const g = p.geo.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); return g.index ? g.toNonIndexed() : g; });
    const m = gs.length ? mergeGeometries(gs, false) : null;
    return (this._mergedGeo[kind] = m);
  },

  /** Instance d'un module de la ville (Group) ; tint = { wall, roof, trim } (couleurs hex) pour les rôles de sommets. */
  townInstance(kind, { tint = null, windowMat = null, shadow = true, ownGlow = false, matOverride = null } = {}) {
    const grp = new THREE.Group();
    this._townPart(kind).forEach((p, i) => {
      let mat = this.townMaterial(p.name, p.src, windowMat);
      if (ownGlow && p.name === 'glow') mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true });          // matériau propre : couleur/opacité animables
      else if (matOverride && matOverride[p.name]) { mat = mat.clone(); const o = matOverride[p.name]; if (o.color !== undefined) mat.color.set(o.color); if (o.emissive !== undefined && mat.emissive) { mat.emissive.set(o.emissive); mat.emissiveIntensity = o.emissiveIntensity ?? 0.5; } }
      const m = new THREE.Mesh(this._townGeo(kind, i, tint), mat);
      m.castShadow = shadow && p.name !== 'window'; m.receiveShadow = true;
      grp.add(m);
    });
    return grp;
  },

  /** Un InstancedMesh par matériau du module ; le même tableau de matrices s'applique à tous. */
  townInstanced(kind, count, { windowMat = null, shadow = true, tint = null } = {}) {
    return this._townPart(kind).map((p, i) => {
      const im = new THREE.InstancedMesh(this._townGeo(kind, i, tint), this.townMaterial(p.name, p.src, windowMat), count);
      im.castShadow = shadow && p.name !== 'window'; im.receiveShadow = true; im.frustumCulled = false;
      return im;
    });
  },

  _register(file, gltf) {
    const gm = (gltf.asset && gltf.asset.extras && gltf.asset.extras.korvalune) || {};
    if (gm.type === 'armor' && gm.slot) { ((this.gear.armor[gm.skeleton || 'default']) ||= {})[gm.slot + (gm.style ? '@' + gm.style : '')] = gltf; return; }
    if (gm.type === 'mount' && gm.kind) { this.gear.mounts[gm.kind] = { gltf, meta: gm }; return; }
    if (gm.type === 'nature' && gm.kind) { this.nature[gm.kind + (gm.lod === 'lo' ? '_lo' : '')] = gltf; return; }
    if (gm.type === 'town' && gm.kind) { this.town[gm.kind] = gltf; return; }
    if (gm.type === 'weapon' && gm.visual) { this.gear.weapons[gm.visual] = gltf; return; }
    let hasMesh = false;
    gltf.scene.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) hasMesh = true; });
    for (const c of gltf.animations || []) {
      const k = c.name.toLowerCase();
      if (!this.clips.has(k)) this.clips.set(k, c);
    }
    if (hasMesh) this.characters.push({ file, key: file.toLowerCase().replace(/\.(glb|gltf)$/i, ''), scene: gltf.scene, clips: gltf.animations || [], meta: (gltf.asset && gltf.asset.extras && gltf.asset.extras.korvalune) || {} });
  },

  // Cherche l'entrée correspondant à un rôle ; renvoie null → modèle procédural
  find(role, species, kind, lod = 0) {
    if (!this.ready) return null;
    const byFile = (name) => this.characters.find((c) => c.file.toLowerCase() === String(name).toLowerCase());
    if (lod) {   // version allégée : mapping « rôle@lod1 » ; sinon on retombe sur le modèle complet
      const f = this.mapping[`${role}@lod${lod}`]; const e = f && byFile(f); if (e) return e;
    }
    const all = this.characters;
    this.characters = all.filter((c) => !(c.meta && c.meta.lod));   // les LOD ne sont jamais choisis par mots-clés
    try { return this._find(role, species, kind, byFile); } finally { this.characters = all; }
  },

  _find(role, species, kind, byFile) {
    if (/^player/.test(role || '')) {   // V10.43 : joueurs = corps humain nu (la tête et l'équipement s'ajoutent par-dessus)
      const body = (/^player:lo/.test(role) && byFile('veilleur_corps_lo.glb')) || byFile('veilleur_corps.glb');   // V10.77 : « player:lo… » = maillage léger (PNJ éloignés)
      if (body && body.meta && body.meta.humanHead) return body;
    }
    for (const k of [role, species && `species:${species}`]) {
      if (k && this.mapping[k]) { const e = byFile(this.mapping[k]); if (e) return e; }
    }
    { // ennemis humanoïdes livrés avec leur espèce dans les métadonnées du fichier (extras.korvalune.species)
      const sp = species && (SPECIES_ALIAS[species] || species);
      const e = sp && this.characters.find((c) => c.meta && c.meta.species === sp && (c.meta.type === 'creature') === (kind === 'creature'));
      if (e) return e;
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
      const pool = this.characters.filter((c) => !(c.meta && (c.meta.species || c.meta.humanHead || c.meta.slot)) && !/wolf|boar|bear|dog|fox|spider|bat|rat|slime|dragon/.test(c.key));
      if (pool.length) return pool[hashStr(role) % pool.length];
    }
    return null;
  },

  findClip(entry, state, role = '') {
    const classId = (role.split(':')[1] || '');
    let lists = CLIP_PATTERNS[state] || (state.startsWith('emote_') ? [new RegExp('^' + state + '$', 'i')] : []);
    if (state === 'attack' || state === 'attack2') {
      const big = state === 'attack2';   // V10.48 : sort simple / grand sort, tir normal / puissant
      const pref = classId === 'mage' ? [big ? /^cast2$/i : /^cast$/i, ...CLIP_PATTERNS.cast] : classId === 'archer' ? [big ? /^shoot2$/i : /^shoot$/i, ...CLIP_PATTERNS.shoot] : null;
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

// espèces sans modèle propre : utilisent celui d'une espèce proche
const SPECIES_ALIAS = { guard: 'elite', golem_colossus: 'golem' };

const box = new THREE.Box3(), size = new THREE.Vector3();

// Construit un rig compatible avec l'interface des rigs procéduraux.
export function tryCreateGlbRig(kind, opts = {}) {
  const role = opts.role || '';
  const entry = ModelLibrary.find(role, opts.species, kind, opts.lod || 0);
  if (!entry) return null;
  const inst = SkeletonUtils.clone(entry.scene);
  const root = new THREE.Group();
  root.add(inst);

  // normalisation de la taille et pose au sol
  box.makeEmpty().setFromObject(inst);
  box.getSize(size);
  const target = kind === 'humanoid' ? 1.8 : 1.0;
  // un corps livré sans son équipement (pièces séparées) indique la hauteur de référence de l'ensemble complet
  const refH = (entry.meta && entry.meta.refHeight) || (kind === 'humanoid' ? size.y : Math.max(size.y, size.z * 0.6));
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
  // points d'ancrage réels (cosmétiques : ailes dans le dos, couvre-chefs sur la tête), à la hauteur d'un humanoïde de 1,8 m
  const head = new THREE.Object3D(); head.position.y = kind === 'humanoid' ? 1.7 : 0;
  root.add(head);
  const torso = new THREE.Object3D(); torso.position.y = kind === 'humanoid' ? 1.0 : 0;
  root.add(torso);
  const mixer = new THREE.AnimationMixer(inst);
  const rig = {
    root, body: root, hips: stub(), torso, head,
    mats, matRefs: { weapons: {} },
    equipVisuals: { weapons: {}, shield: stub(), helm: stub(), shoulders: [stub(), stub()], chest: stub(), cape: stub() },
    glbInst: inst, glbK: k,
    glbSkeleton: (entry.meta && entry.meta.skeleton) || null,   // non nul → le corps accepte des pièces d'équipement GLB
    phase: 0, k: 0, t: 0, hurtT: 0, crouchK: 0,
    glb: { entry, mixer, role, actions: {}, state: null, action: null, prevHurt: 0, prevActionT: 0, flash: 0 }
  };
  return rig;
}

const ONE_SHOT = new Set(['attack', 'attack2', 'interact', 'death', 'hit', 'jump', 'roll']);
const isEmote = (a) => typeof a === 'string' && a.startsWith('emote_');
const FALLBACK = { roll: [], attack2: ['attack'], attack: ['cast', 'shoot', 'attack2'], interact: ['idle'], jump: ['run'], hit: [], death: [], walk: ['run', 'idle'], run: ['walk', 'idle'] };
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
  const once = ONE_SHOT.has(state) || isEmote(state);
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
  const emote = !dead && kind === 'humanoid' && isEmote(s.action) && !!getAction(g, s.action);
  const acting = !dead && (s.action === 'attack' || s.action === 'attack2' || s.action === 'interact' || emote || (kind === 'humanoid' && s.action === 'roll' && !!getAction(g, 'roll')));
  const speed = s.speed || 0;
  const loco = speed > 4.6 ? 'run' : speed > 0.35 ? 'walk' : 'idle';
  let want;
  if (dead) want = 'death';
  else if (acting) want = s.action;
  else if (kind === 'humanoid' && s.riding && getAction(g, 'ride')) want = 'ride';   // en selle
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
      play(g, want, { dur: emote ? 0 : s.actionDur > 0 ? s.actionDur : 0, fade: emote ? 0.2 : 0.08 });
    } else if (!play(g, want, { fade: 0.2 })) {
      g.state = want;
    }
  }
  // cadence de marche/course proportionnelle à la vitesse
  if (g.action && !ONE_SHOT.has(g.state) && !isEmote(g.state)) {
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
