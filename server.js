// Legends of Aetheria — serveur multijoueur (ÉTAPES 5 & 6)
// -----------------------------------------------------------------------------
// Relais WebSocket : positions/animations des joueurs, chat (général/groupe/
// privé) et groupes (jusqu'à 5 joueurs) — voir aussi comptes, sauvegarde
// persistante et contrôles de sécurité ci-dessous.
//
// Portée réelle de la "sécurité" à ce stade (voir le README pour le détail) :
// le serveur authentifie les comptes (mot de passe haché, jamais stocké en
// clair), est la seule source de vérité pour la sauvegarde d'un personnage
// une fois connecté, et applique des garde-fous (limites de débit, bornes
// plausibles sur les gains de niveau/or entre deux sauvegardes). Ce n'est PAS
// un système anti-triche complet : le serveur ne rejoue pas chaque coup porté
// en combat et ne recalcule pas les dégâts lui-même (cela demanderait de
// dupliquer tout le moteur de jeu côté serveur) — un joueur mal intentionné
// pourrait donc encore truquer son XP/or dans une certaine mesure. Les
// garde-fous ci-dessous limitent l'ampleur de la triche, ils ne l'éliminent
// pas entièrement.
//
// Lancement : node server.js (ou "npm run server"), port 8787 par défaut.
// -----------------------------------------------------------------------------
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAccounts, persistAccounts, hashPassword, verifyPassword, sanitizeUsername, DATA_DIR } from './server/store.js';
import { createWebServer } from './server/web.js';
import { loadSecret, makeToken, verifyToken, KeyedLimiter } from './server/security.js';
import { RateLimiter } from './server/rateLimit.js';
import { sanitizeGeneratedItem, sanitizeItemSlots } from './server/itemValidate.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const MAX_GROUP_SIZE = 5;
const MAX_NAME_LEN = 16;
const MAX_CHAT_LEN = 240;
const MIN_PASSWORD_LEN = 8; // pour les NOUVEAUX comptes (les anciens mots de passe de 6 caractères restent valables)
const HOST = process.env.HOST || '0.0.0.0';
const DIST = path.resolve(process.env.DIST_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'));
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // à activer derrière un hébergeur / proxy (Render, Railway, Fly, Caddy, nginx…)
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 12;
const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype', 'tostring', 'valueof', 'hasownproperty', 'admin', 'administrateur', 'moderateur', 'system', 'systeme']);

const accounts = await loadAccounts();
/** @type {Map<string, string>} token -> username */
const SECRET = await loadSecret(DATA_DIR);
// index insensible à la casse : « Bob » et « bob » sont le même compte (anti-usurpation)
const lcIndex = new Map(Object.keys(accounts).map((k) => [k.toLowerCase(), k]));
const resolveAccount = (name) => lcIndex.get(String(name).toLowerCase()) ?? null;
const regLimiter = new KeyedLimiter(4, 10 * 60 * 1000);     // créations de compte par IP
const loginLimiter = new KeyedLimiter(15, 60 * 1000);       // tentatives de connexion par IP
const failLimiter = new KeyedLimiter(6, 5 * 60 * 1000);     // échecs par compte (verrouillage 5 min)
const connsPerIp = new Map();

function ipOf(req) {
  if (TRUST_PROXY) { const xf = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean); if (xf.length) return xf[xf.length - 1]; }
  return req.socket.remoteAddress || 'inconnue';
}

const httpServer = createWebServer({ distDir: DIST, onHealth: () => ({ ok: true, players: players.size, accounts: Object.keys(accounts).length }) });
const wss = new WebSocketServer({ server: httpServer, maxPayload: 600 * 1024, perMessageDeflate: false });
httpServer.listen(PORT, HOST, () => {
  console.log(`[Aetheria] Jeu + serveur multijoueur sur http://${HOST}:${PORT}`);
  console.log(`[Aetheria] ${Object.keys(accounts).length} compte(s) chargé(s) depuis ${DATA_DIR}`);
});
import('fs').then((fs) => { if (!fs.existsSync(path.join(DIST, 'index.html'))) console.warn(`[Aetheria] Dossier ${DIST} introuvable : lancez « npm run build » pour servir le jeu (le WebSocket fonctionne quand même).`); });
// battement de cœur : coupe les connexions mortes
const beat = setInterval(() => { for (const c of wss.clients) { if (c.isAlive === false) { c.terminate(); continue; } c.isAlive = false; try { c.ping(); } catch { /* ignoré */ } } }, 30000);
beat.unref?.();

/** @type {Map<string, Player>} */
const players = new Map();
/** @type {Map<string, Set<string>>} groupId -> Set<playerId> */
const groups = new Map();
/** groupId -> pending invites: Map<targetPlayerId, inviterPlayerId> */
const pendingInvites = new Map();

let nextId = 1;
function makeId() { return 'p' + nextId++; }
function sanitize(str, max) { return String(str ?? '').replace(/[<>]/g, '').slice(0, max); }

function send(ws, msg) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); }
function broadcastAll(msg, exceptId) {
  for (const p of players.values()) if (p.id !== exceptId) send(p.ws, msg);
}
function playerSummary(p) {
  return { id: p.id, name: p.name, classId: p.classId, level: p.level, pos: p.pos, yaw: p.yaw, anim: p.anim, hp: p.hp, maxHp: p.maxHp, inst: p.inst | 0 };
}

function findByName(name) {
  const low = name.toLowerCase();
  for (const p of players.values()) if (p.name.toLowerCase() === low) return p;
  for (const p of players.values()) if (p.account && p.account.toLowerCase() === low) return p; // aussi par nom de compte (amis)
  return null;
}

// ---- Présence des comptes + amis (V6.0) ----
/** @type {Map<string, Set<any>>} compte -> connexions ouvertes */
const acctWs = new Map();
function presence(key, ws, on) {
  let set = acctWs.get(key);
  if (on) { if (!set) acctWs.set(key, (set = new Set())); set.add(ws); }
  else if (set) { set.delete(ws); if (!set.size) acctWs.delete(key); }
}
function friendsState(key) {
  const acc = accounts[key] || {};
  const friends = (acc.friends || []).map((fk) => {
    const online = !!acctWs.get(fk)?.size;
    let ch = null;
    if (online) for (const p of players.values()) if (p.account === fk) { ch = p; break; }
    return { name: fk, online, char: ch?.name || null, level: ch?.level || null, classId: ch?.classId || null };
  }).sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  return { t: 'friends', friends, requests: [...(acc.requests || [])] };
}
function pushFriends(key) {
  const set = acctWs.get(key);
  if (!set) return;
  const st = friendsState(key);
  for (const w of set) send(w, st);
}
function notifyAccount(key, text) { for (const w of acctWs.get(key) || []) send(w, { t: 'system', text }); }
function pushFriendsOf(key) { for (const fk of accounts[key]?.friends || []) pushFriends(fk); }

function groupOf(playerId) {
  for (const [gid, members] of groups) if (members.has(playerId)) return gid;
  return null;
}

// Vérifie la forme des données de sauvegarde et borne les progressions
// implausibles par rapport à la sauvegarde précédente du même compte. Ce
// n'est pas une re-simulation du jeu — voir la note de sécurité en tête de
// fichier — seulement un garde-fou contre les valeurs aberrantes ou
// malformées.
// V8.4 — jusqu'à 5 personnages par compte + un coffre partagé. Migration : l'ancienne sauvegarde unique devient le personnage 1,
// son coffre devient le coffre partagé du compte (rien n'est perdu).
const MAX_CHARS = 5;
function ensureChars(acc) {
  if (!Array.isArray(acc.chars)) {
    acc.chars = acc.save ? [acc.save] : [];
    acc.sharedBank = Array.isArray(acc.save?.bank) ? acc.save.bank : [];
    if (acc.chars[0]) { acc.chars[0] = { ...acc.chars[0] }; delete acc.chars[0].bank; }
    acc.charSaveAt = { 0: acc.lastSaveAt || 0 };
  }
  if (!Array.isArray(acc.sharedBank)) acc.sharedBank = [];
  if (!acc.charSaveAt) acc.charSaveAt = {};
  while (acc.chars.length < MAX_CHARS) acc.chars.push(null);
  acc.chars.length = MAX_CHARS;
  return acc;
}
const accView = (acc) => { ensureChars(acc); return { chars: acc.chars, bank: acc.sharedBank, save: acc.chars.find(Boolean) || null }; };

function sanitizeSave(prev, incoming, elapsedMs) {
  if (!incoming || typeof incoming !== 'object') return null;
  const elapsedMin = Math.max(1, elapsedMs / 60000);
  const clean = {};

  clean.name = sanitize(incoming.name, MAX_NAME_LEN) || 'Aventurier';
  clean.classId = sanitize(incoming.classId, 20) || 'warrior';
  clean.skin = Number.isInteger(incoming.skin) && incoming.skin >= 0 && incoming.skin <= 0xffffff ? incoming.skin : (Number.isInteger(prev?.skin) ? prev.skin : null);
  for (const k of ['hairCol', 'eyeCol']) clean[k] = Number.isInteger(incoming[k]) && incoming[k] >= 0 && incoming[k] <= 0xffffff ? incoming[k] : (Number.isInteger(prev?.[k]) ? prev[k] : undefined);
  clean.pos = Array.isArray(incoming.pos) && incoming.pos.length === 3 && incoming.pos.every(Number.isFinite) ? incoming.pos : (prev?.pos || [0, 0, 12]);
  clean.yaw = Number.isFinite(incoming.yaw) ? incoming.yaw : 0;

  const prevLevel = prev?.level || 1;
  const wantLevel = Number.isFinite(incoming.level) ? Math.floor(incoming.level) : prevLevel;
  clean.level = Math.max(prevLevel, Math.min(wantLevel, prevLevel + 10, 200)); // jamais de retour en arrière, +10 niveaux max par sauvegarde

  clean.xp = Number.isFinite(incoming.xp) ? Math.max(0, Math.floor(incoming.xp)) : 0;
  clean.statPoints = Number.isFinite(incoming.statPoints) ? Math.max(0, Math.min(500, Math.floor(incoming.statPoints))) : (prev?.statPoints ?? 0);

  const prevCoins = prev?.coins ?? 0;
  const wantCoins = Number.isFinite(incoming.coins) ? Math.floor(incoming.coins) : prevCoins;
  const coinCap = prevCoins + Math.ceil(4000 * elapsedMin); // plafond généreux mais fini
  clean.coins = Math.max(0, Math.min(wantCoins, coinCap, 999999));

  clean.stats = {};
  for (const k of ['str', 'agi', 'int', 'vit', 'spi', 'luck']) {
    const v = incoming.stats?.[k];
    clean.stats[k] = Number.isFinite(v) ? Math.max(0, Math.min(999, Math.floor(v))) : (prev?.stats?.[k] ?? 5);
  }
  clean.hp = Number.isFinite(incoming.hp) ? Math.max(0, incoming.hp) : (prev?.hp ?? 100);
  clean.mana = Number.isFinite(incoming.mana) ? Math.max(0, incoming.mana) : (prev?.mana ?? 50);

  clean.active = Array.isArray(incoming.active) ? incoming.active.slice(0, 40).map((s) => sanitize(s, 60)) : [];
  clean.completed = Array.isArray(incoming.completed) ? incoming.completed.slice(0, 400).map((s) => sanitize(s, 60)) : [];
  clean.progress = incoming.progress && typeof incoming.progress === 'object' ? incoming.progress : {};
  // Compteurs d'objectifs (ex: 3/8 loups tués) : uniquement des entiers bornés.
  clean.counts = {};
  if (incoming.counts && typeof incoming.counts === 'object') {
    for (const [qid, c] of Object.entries(incoming.counts).slice(0, 40)) {
      if (!c || typeof c !== 'object') continue;
      clean.counts[sanitize(qid, 60)] = Object.fromEntries(Object.entries(c).slice(0, 4).map(([k, v]) => [sanitize(k, 20), Number.isFinite(v) ? Math.max(0, Math.min(1000, Math.floor(v))) : 0]));
    }
  }

  clean.inventory = sanitizeItemSlots(incoming.inventory, 30, sanitize) ?? (prev?.inventory || []);

  clean.equipment = {};
  if (incoming.equipment && typeof incoming.equipment === 'object') {
    for (const [slot, item] of Object.entries(incoming.equipment)) {
      if (!item) continue;
      if (item.gen) { const g = sanitizeGeneratedItem(item.gen); if (g) clean.equipment[sanitize(slot, 20)] = { gen: g }; }
      else if (typeof item.defId === 'string') clean.equipment[sanitize(slot, 20)] = { defId: sanitize(item.defId, 40) };
    }
  }

  clean.skillBar = Array.isArray(incoming.skillBar)
    ? incoming.skillBar.slice(0, 10).map((id) => (typeof id === 'string' ? sanitize(id, 40) : null))
    : (prev?.skillBar || []);

  // V4.7 : coffres du monde déjà ouverts (identifiants courts)
  clean.chests = Array.isArray(incoming.chests) ? incoming.chests.filter((x) => typeof x === 'string' && x.length <= 20).slice(0, 300) : (prev?.chests || []);
  clean.bank = sanitizeItemSlots(incoming.bank, 240, sanitize) ?? (prev?.bank || []);

  // V3.7 : spires de Éther (clés, éclats, cristaux, records) — bornées, jamais de gain brutal d'une sauvegarde à l'autre
  {
    // anciennes sauvegardes (V3.7/V3.8) : anciens noms de champs/modes → nouveaux
    const mig = (o) => {
      if (!o || typeof o !== 'object') return o;
      const x = { ...o };
      const mode = (m) => (m === 'nephalem' ? 'ascent' : m === 'greater' ? 'zenith' : m);
      if (x.zkeys === undefined && x.gkeys !== undefined) x.zkeys = x.gkeys;
      if (x.bestAscent === undefined && x.bestNephalem !== undefined) x.bestAscent = x.bestNephalem;
      if (x.bestZenith === undefined && x.bestGreater !== undefined) x.bestZenith = x.bestGreater;
      if (x.open && typeof x.open === 'object') x.open = { ...x.open, modeId: mode(x.open.modeId) };
      if (Array.isArray(x.history)) x.history = x.history.map((h) => (h && typeof h === 'object' ? { ...h, mode: mode(h.mode) } : h));
      return x;
    };
    const r = incoming.rift && typeof incoming.rift === 'object' ? mig(incoming.rift) : null;
    const pr = mig(prev?.rift) || {};
    const num = (v, lo, hi, def) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : def);
    if (r) {
      clean.rift = {
        keys: num(r.keys, 0, Math.min(9999, (pr.keys ?? 5) + 400), pr.keys ?? 5),
        zkeys: num(r.zkeys, 0, Math.min(9999, (pr.zkeys ?? 1) + 200), pr.zkeys ?? 1),
        shards: num(r.shards, 0, Math.min(999999, (pr.shards ?? 0) + 5000), pr.shards ?? 0),
        gems: {},
        pending: num(r.pending, 0, 3, 0), pendingLevel: num(r.pendingLevel, 0, 200, 0),
        open: r.open && ['ascent', 'zenith', 'trial'].includes(r.open.modeId) ? { modeId: r.open.modeId, level: num(r.open.level, 1, 200, 1) } : null,
        bestAscent: num(r.bestAscent, 0, 200, 0),
        bestZenith: { level: num(r.bestZenith?.level, 0, 200, 0), time: num(r.bestZenith?.time, 0, 99999, 0) },
        history: Array.isArray(r.history) ? r.history.slice(0, 10).map((h) => ({ mode: ['ascent', 'zenith', 'trial'].includes(h?.mode) ? h.mode : 'ascent', level: num(h?.level, 1, 200, 1), time: num(h?.time, 0, 99999, 0), ok: !!h?.ok })) : []
      };
      for (const id of ['power', 'vigor', 'haste', 'fury', 'ease']) clean.rift.gems[id] = num(r.gems?.[id], 1, Math.min(250, (pr.gems?.[id] ?? 1) + 12), pr.gems?.[id] ?? 1);
    } else if (pr && Object.keys(pr).length) clean.rift = pr;
  }

  return clean;
}

// « Salle » d'un joueur : 0 = monde ouvert, sinon identifiant (graine) de la spire où il se trouve.
// L'hôte d'une salle = le premier membre du groupe (le chef d'abord) qui s'y trouve ; il simule les monstres de cette salle.
function roomHost(gid, inst) {
  const members = groups.get(gid);
  if (!members) return null;
  for (const id of members) { const p = players.get(id); if (p && (p.inst | 0) === (inst | 0)) return id; }
  return null;
}
const lastGroupPush = new Map();
function broadcastGroupUpdate(gid, force = true) {
  const members = groups.get(gid);
  if (!members) return;
  const now = Date.now();
  if (!force && now - (lastGroupPush.get(gid) || 0) < 200) return; // ≤ 5 envois/s par groupe
  lastGroupPush.set(gid, now);
  const list = [...members].map((id) => players.get(id)).filter(Boolean).map(playerSummary);
  const msg = { t: 'group:update', members: list, leader: [...members][0] || null };
  for (const id of members) {
    const p = players.get(id);
    if (p) send(p.ws, msg);
  }
}

function disbandOrLeave(playerId) {
  const gid = groupOf(playerId);
  if (!gid) return;
  const members = groups.get(gid);
  members.delete(playerId);
  const leaver = players.get(playerId);
  if (leaver) send(leaver.ws, { t: 'group:update', members: [] });
  if (members.size <= 1) {
    // Un groupe à 0 ou 1 membre restant est dissous.
    for (const id of members) {
      const p = players.get(id);
      if (p) send(p.ws, { t: 'group:update', members: [] });
    }
    groups.delete(gid); lastGroupPush.delete(gid);
  } else {
    broadcastGroupUpdate(gid);
  }
}

wss.on('connection', (ws, req) => {
  const ip = ipOf(req);
  const nConn = (connsPerIp.get(ip) || 0) + 1;
  if (nConn > MAX_CONN_PER_IP) { ws.close(1013, 'Trop de connexions'); return; }
  connsPerIp.set(ip, nConn);
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { const n = (connsPerIp.get(ip) || 1) - 1; if (n <= 0) connsPerIp.delete(ip); else connsPerIp.set(ip, n); });
  let player = null;
  let authUsername = null;
  const friendLimiter = new RateLimiter(8, 10000);
  const relayLimiter = new RateLimiter(90, 1000);
  const setAuth = (key) => {
    if (authUsername && authUsername !== key) presence(authUsername, ws, false);
    authUsername = key;
    if (key) { presence(key, ws, true); if (player) player.account = key; pushFriends(key); pushFriendsOf(key); }
  };
  const moveLimiter = new RateLimiter(20, 1000);
  const chatLimiter = new RateLimiter(6, 1000);
  const authLimiter = new RateLimiter(5, 10000);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    // --- Comptes ---
    if (msg.t === 'resume') { // reconnexion automatique avec le jeton enregistré dans le navigateur
      const u = verifyToken(SECRET, msg.token);
      const key = u && resolveAccount(u);
      if (!key) { send(ws, { t: 'authResult', ok: false, error: '', silent: true }); return; }
      setAuth(key);
      send(ws, { t: 'authResult', ok: true, token: msg.token, username: key, ...accView(accounts[key]), resumed: true });
      return;
    }
    if (msg.t === 'register' || msg.t === 'login') {
      const fail = (error) => send(ws, { t: 'authResult', ok: false, error });
      if (!authLimiter.allow() || !loginLimiter.hit(ip)) { fail('Trop de tentatives, réessaie dans un instant.'); return; }
      const username = sanitizeUsername(msg.username);
      const password = String(msg.password || '');
      if (username.length < 3) { fail('Identifiant trop court (3 caractères minimum).'); return; }
      if (msg.t === 'register') {
        if (password.length < MIN_PASSWORD_LEN) { fail(`Mot de passe trop court (${MIN_PASSWORD_LEN} caractères minimum).`); return; }
        if (RESERVED_NAMES.has(username.toLowerCase())) { fail('Cet identifiant n\'est pas disponible.'); return; }
        if (!regLimiter.hit(ip)) { fail('Trop de comptes créés depuis cette connexion. Réessaie plus tard.'); return; }
      } else if (!password) { fail('Mot de passe requis.'); return; }

      (async () => {
        let key;
        if (msg.t === 'register') {
          if (resolveAccount(username)) { fail('Ce nom de compte existe déjà.'); return; }
          const passwordHash = await hashPassword(password);
          if (resolveAccount(username)) { fail('Ce nom de compte existe déjà.'); return; } // course : deux inscriptions simultanées
          key = username;
          accounts[key] = { passwordHash, save: null, lastSaveAt: 0, createdAt: Date.now() };
          lcIndex.set(key.toLowerCase(), key);
          await persistAccounts(accounts);
        } else {
          key = resolveAccount(username);
          const lock = key ? key.toLowerCase() : 'x:' + username.toLowerCase();
          if (failLimiter.count(lock) >= failLimiter.max) { fail('Trop d\'échecs : compte verrouillé 5 minutes.'); return; }
          const acc = key && accounts[key];
          const ok = acc ? await verifyPassword(password, acc.passwordHash) : (await hashPassword(password), false); // même durée si le compte n'existe pas
          if (!ok) {
            failLimiter.hit(lock);
            fail('Identifiant ou mot de passe incorrect.');
            return;
          }
          failLimiter.reset(lock);
        }
        const token = makeToken(SECRET, key);
        setAuth(key);
        send(ws, { t: 'authResult', ok: true, token, username: key, ...accView(accounts[key]) });
      })().catch((e) => { console.error('[Aetheria] auth :', e.message); fail('Erreur serveur.'); });
      return;
    }
    if (msg.t === 'logout') { const old = authUsername; if (old) { presence(old, ws, false); if (player) player.account = null; } authUsername = null; if (old) pushFriendsOf(old); return; }

    // --- Amis (V6.0) : par nom de compte ---
    if (msg.t.startsWith('friend:')) {
      if (!authUsername) { send(ws, { t: 'system', text: 'Connecte-toi à ton compte pour utiliser les amis.' }); return; }
      if (!friendLimiter.allow()) return;
      const me = authUsername, acc = accounts[me];
      acc.friends = acc.friends || []; acc.requests = acc.requests || [];
      const sys = (text) => send(ws, { t: 'system', text });
      if (msg.t === 'friend:list') { send(ws, friendsState(me)); return; }
      if (msg.t === 'friend:add') {
        const fk = resolveAccount(sanitizeUsername(msg.to));
        if (!fk) { sys(`Aucun compte nommé « ${sanitize(msg.to, 24)} ».`); return; }
        if (fk === me) { sys('Tu ne peux pas t\'ajouter toi-même.'); return; }
        const other = accounts[fk]; other.friends = other.friends || []; other.requests = other.requests || [];
        if (acc.friends.includes(fk)) { sys(`${fk} est déjà dans tes amis.`); return; }
        if (acc.requests.includes(fk)) { // l'autre avait déjà demandé : on accepte directement
          acc.requests = acc.requests.filter((x) => x !== fk);
          acc.friends.push(fk); other.friends.push(me);
          persistAccounts(accounts); pushFriends(me); pushFriends(fk);
          sys(`Tu es maintenant ami avec ${fk}.`); notifyAccount(fk, `${me} a accepté ton amitié.`);
          return;
        }
        if (other.requests.includes(me)) { sys(`Demande déjà envoyée à ${fk}.`); return; }
        if (acc.friends.length >= 100 || other.requests.length >= 50) { sys('Liste pleine.'); return; }
        other.requests.push(me);
        persistAccounts(accounts); pushFriends(fk);
        sys(`Demande d'ami envoyée à ${fk}.`); notifyAccount(fk, `${me} te demande en ami (menu Amis).`);
        return;
      }
      if (msg.t === 'friend:accept' || msg.t === 'friend:decline') {
        const fk = resolveAccount(sanitizeUsername(msg.from));
        if (!fk || !acc.requests.includes(fk)) { sys('Demande introuvable.'); return; }
        acc.requests = acc.requests.filter((x) => x !== fk);
        if (msg.t === 'friend:accept') {
          const other = accounts[fk]; other.friends = other.friends || [];
          if (!acc.friends.includes(fk)) acc.friends.push(fk);
          if (!other.friends.includes(me)) other.friends.push(me);
          notifyAccount(fk, `${me} a accepté ton amitié.`);
          sys(`Tu es maintenant ami avec ${fk}.`);
        }
        persistAccounts(accounts); pushFriends(me); pushFriends(fk);
        return;
      }
      if (msg.t === 'friend:remove') {
        const fk = resolveAccount(sanitizeUsername(msg.name));
        if (!fk) return;
        acc.friends = acc.friends.filter((x) => x !== fk);
        const other = accounts[fk]; if (other) other.friends = (other.friends || []).filter((x) => x !== me);
        persistAccounts(accounts); pushFriends(me); pushFriends(fk);
        return;
      }
      return;
    }
    if (msg.t === 'delchar') {
      const username = resolveAccount(verifyToken(SECRET, msg.token) || '');
      if (!username) return;
      const acc = ensureChars(accounts[username]);
      const slot = Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < MAX_CHARS ? msg.slot : -1;
      if (slot >= 0) { acc.chars[slot] = null; delete acc.charSaveAt[slot]; persistAccounts(accounts); }
      send(ws, { t: 'charsUpdate', ...accView(acc) });
      return;
    }
    if (msg.t === 'save') {
      const username = resolveAccount(verifyToken(SECRET, msg.token) || '');
      if (!username) { send(ws, { t: 'saveAck', ok: false, error: 'Session expirée — reconnecte-toi.' }); return; }
      const acc = ensureChars(accounts[username]);
      const slot = Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < MAX_CHARS ? msg.slot : 0;
      const prevChar = acc.chars[slot];
      const elapsed = Date.now() - (acc.charSaveAt[slot] || 0);
      const clean = sanitizeSave(prevChar, msg.data, elapsed);
      if (!clean) { send(ws, { t: 'saveAck', ok: false, error: 'Données de sauvegarde invalides.' }); return; }
      // le coffre est partagé par tous les personnages du compte
      const bank = sanitizeItemSlots(msg.data?.bank, 240, sanitize);
      if (bank) acc.sharedBank = bank;
      delete clean.bank;
      acc.chars[slot] = clean;
      acc.charSaveAt[slot] = Date.now();
      acc.lastSaveAt = Date.now();
      persistAccounts(accounts);
      send(ws, { t: 'saveAck', ok: true });
      return;
    }

    // --- Arrivée ---
    if (msg.t === 'join') {
      if (player) return;
      const id = makeId();
      player = {
        id, ws,
        name: sanitize(msg.name, MAX_NAME_LEN) || `Aventurier${id}`,
        classId: sanitize(msg.classId, 20) || 'warrior',
        level: Number.isFinite(msg.level) ? Math.max(1, Math.min(200, msg.level)) : 1,
        pos: Array.isArray(msg.pos) && msg.pos.length === 3 ? msg.pos : [0, 0, 12],
        yaw: Number(msg.yaw) || 0,
        anim: 'idle',
        hp: Number(msg.hp) || 100,
        maxHp: Number(msg.maxHp) || 100,
        inst: 0, account: authUsername
      };
      players.set(id, player);
      send(ws, { t: 'welcome', id, players: [...players.values()].filter((p) => p.id !== id).map(playerSummary) });
      broadcastAll({ t: 'playerJoined', player: playerSummary(player) }, id);
      broadcastAll({ t: 'system', text: `${player.name} a rejoint Aetheria.` }, id);
      if (authUsername) pushFriendsOf(authUsername);
      return;
    }
    if (!player) return; // tout le reste nécessite d'avoir rejoint

    // --- Mouvement / état ---
    if (msg.t === 'move') {
      if (!moveLimiter.allow()) return;
      if (Array.isArray(msg.pos) && msg.pos.length === 3) player.pos = msg.pos;
      if (Number.isFinite(msg.yaw)) player.yaw = msg.yaw;
      if (typeof msg.anim === 'string') player.anim = msg.anim.slice(0, 20);
      if (Number.isFinite(msg.hp)) player.hp = msg.hp;
      if (Number.isFinite(msg.maxHp)) player.maxHp = msg.maxHp;
      if (Number.isFinite(msg.level)) player.level = msg.level;
      const newInst = Number.isFinite(msg.inst) ? (msg.inst | 0) : (msg.inst ? 1 : 0);
      const instChanged = newInst !== (player.inst | 0);
      player.inst = newInst;
      broadcastAll({ t: 'playerMoved', id: player.id, pos: player.pos, yaw: player.yaw, anim: player.anim, hp: player.hp, maxHp: player.maxHp, level: player.level, inst: player.inst | 0 }, player.id);
      const gid = groupOf(player.id);
      if (gid) broadcastGroupUpdate(gid, instChanged);
      return;
    }

    // --- Chat ---
    if (msg.t === 'chat') {
      if (!chatLimiter.allow()) return;
      const text = sanitize(msg.text, MAX_CHAT_LEN);
      if (!text) return;
      if (msg.channel === 'group') {
        const gid = groupOf(player.id);
        if (!gid) { send(ws, { t: 'system', text: "Tu n'es dans aucun groupe." }); return; }
        for (const id of groups.get(gid)) {
          const p = players.get(id);
          if (p) send(p.ws, { t: 'chat', channel: 'group', from: player.name, text });
        }
      } else {
        broadcastAll({ t: 'chat', channel: 'general', from: player.name, text });
        send(ws, { t: 'chat', channel: 'general', from: player.name, text });
      }
      return;
    }
    if (msg.t === 'whisper') {
      if (!chatLimiter.allow()) return;
      const target = findByName(sanitize(msg.to, MAX_NAME_LEN));
      const text = sanitize(msg.text, MAX_CHAT_LEN);
      if (!target || !text) { send(ws, { t: 'system', text: `Joueur introuvable : ${msg.to || ''}` }); return; }
      send(target.ws, { t: 'whisper', from: player.name, text, to: target.name });
      send(ws, { t: 'whisper', from: player.name, text, to: target.name, self: true });
      return;
    }
    if (msg.t === 'who') {
      send(ws, { t: 'who', players: [...players.values()].map((p) => ({ name: p.name, level: p.level, classId: p.classId })) });
      return;
    }

    // --- Groupes ---
    if (msg.t === 'group:invite') {
      const target = (typeof msg.id === 'string' && players.get(msg.id)) || findByName(sanitize(msg.to, MAX_NAME_LEN));
      if (!target || target.id === player.id) { send(ws, { t: 'system', text: `Joueur introuvable : ${msg.to || ''}` }); return; }
      let gid = groupOf(player.id);
      const size = gid ? groups.get(gid).size : 1;
      if (size >= MAX_GROUP_SIZE) { send(ws, { t: 'system', text: 'Groupe complet (5 joueurs maximum).' }); return; }
      if (groupOf(target.id)) { send(ws, { t: 'system', text: `${target.name} est déjà dans un groupe.` }); return; }
      pendingInvites.set(target.id, player.id);
      send(target.ws, { t: 'group:invited', from: player.name });
      send(ws, { t: 'system', text: `Invitation envoyée à ${target.name}.` });
      return;
    }
    if (msg.t === 'group:accept') {
      const inviterId = pendingInvites.get(player.id);
      pendingInvites.delete(player.id);
      const inviter = inviterId && players.get(inviterId);
      if (!inviter) { send(ws, { t: 'system', text: 'Invitation expirée.' }); return; }
      let gid = groupOf(inviter.id);
      if (!gid) { gid = 'g' + Date.now(); groups.set(gid, new Set([inviter.id])); }
      const members = groups.get(gid);
      if (members.size >= MAX_GROUP_SIZE) { send(ws, { t: 'system', text: 'Groupe complet (5 joueurs maximum).' }); return; }
      members.add(player.id);
      broadcastGroupUpdate(gid);
      return;
    }
    if (msg.t === 'group:leave') {
      disbandOrLeave(player.id);
      return;
    }
    if (msg.t === 'group:decline') { pendingInvites.delete(player.id); return; }
    if (msg.t === 'group:kick') { // le chef retire un membre
      const gid = groupOf(player.id);
      const members = gid && groups.get(gid);
      if (!members || [...members][0] !== player.id || msg.id === player.id || !members.has(msg.id)) return;
      const t = players.get(msg.id);
      disbandOrLeave(msg.id);
      if (t) send(t.ws, { t: 'system', text: 'Tu as été retiré du groupe.' });
      return;
    }

    // --- Monde de groupe (V6.0) : relais des monstres / dégâts entre membres d'un même groupe ---
    if (msg.t === 'gr') {
      if (!relayLimiter.allow()) return;
      const gid = groupOf(player.id);
      const members = gid && groups.get(gid);
      if (!members || members.size < 2) return;
      const HOST_ONLY = new Set(['snap', 'ekill', 'evt']);
      const GUEST_ONLY = new Set(['dmg', 'st']);
      const k = String(msg.k || '').slice(0, 8);
      if (!HOST_ONLY.has(k) && !GUEST_ONLY.has(k) && k !== 'hit' && k !== 'rift') return;
      let body; try { body = JSON.stringify(msg.d ?? {}); } catch { return; }
      if (body.length > 12000) return;
      const room = player.inst | 0;
      const host = roomHost(gid, room);
      if (HOST_ONLY.has(k) && player.id !== host) return;
      if (GUEST_ONLY.has(k) && player.id === host) return;
      const out = `{"t":"gr","k":${JSON.stringify(k)},"from":${JSON.stringify(player.id)},"d":${body}}`;
      const sendRaw = (p) => { if (p && p.ws.readyState === p.ws.OPEN) p.ws.send(out); };
      if (k === 'rift') { // annonce « j'entre dans une spire » : à tout le groupe, quelle que soit la salle
        for (const id of members) if (id !== player.id) sendRaw(players.get(id));
      } else if (msg.to === 'group') { for (const id of members) { const p = players.get(id); if (id !== player.id && p && (p.inst | 0) === room) sendRaw(p); } }
      else if (msg.to === 'host') { if (host && host !== player.id) sendRaw(players.get(host)); }
      else if (typeof msg.to === 'string' && members.has(msg.to) && msg.to !== player.id && k === 'hit' && player.id === host) { const p = players.get(msg.to); if (p && (p.inst | 0) === room) sendRaw(p); }
      return;
    }
  });

  ws.on('close', () => {
    if (authUsername) { const old = authUsername; presence(old, ws, false); pushFriendsOf(old); }
    if (!player) return;
    disbandOrLeave(player.id);
    players.delete(player.id);
    pendingInvites.delete(player.id);
    for (const [id, inv] of pendingInvites) if (inv === player.id) pendingInvites.delete(id);
    broadcastAll({ t: 'playerLeft', id: player.id });
    broadcastAll({ t: 'system', text: `${player.name} a quitté Aetheria.` });
  });

  ws.on('error', () => {});
});
