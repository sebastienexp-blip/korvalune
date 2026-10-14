// Korvalune — serveur multijoueur (ÉTAPES 5 & 6)
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
import { loadSecret, makeToken, verifyToken, tokenIssuedAt, KeyedLimiter } from './server/security.js';
import { QUESTIONS, secView, setQuestion, setEmail, makeRecoveryCode, checkRecovery } from './server/recovery.js';
import { addMessage as supAdd, playerView as supView, markRead as supRead, threadView as supThread, inbox as supInbox } from './server/support.js';
import { getMotd, setMotd, maint as maintCfg, setMaint, boost as worldBoost, setBoost, stopBoost, createCode, codeList, stopCode, redeem as redeemCode } from './server/adminTools.js';
import { adminLog, readLog, searchAccounts, summary as accSummary, resetPassword, giveLunes } from './server/accountAdmin.js';
import { isMountId, MAX_MOUNTS } from './src/data/mounts.js';
import { normalizeLook, sanitizeAppearance } from './src/data/looks.js';
import { RateLimiter } from './server/rateLimit.js';
import { sanitizeGeneratedItem, sanitizeItemSlots, sanitizeCubePowers, itemKey } from './server/itemValidate.js';
import { requestDonation, pendingDonations, resolveDonation, isOwnerKey } from './server/donations.js';
import { passView, addEvents as passEvents, claim as passClaim, claimAll as passClaimAll, missionClaim as passMission, buyPremium as passBuyPremium, buyTier as passBuyTier } from './server/pass.js';
import { ensureEvent, eventView, collect as evCollect, kill as evKill, daily as evDaily, buy as evBuy, top as evTop } from './server/event.js';
import { CATALOG_BY_ID as COSMETICS_BY_ID } from './src/data/shopCatalog.js';
import { cleanPotions } from './src/data/potions.js';
import { cleanSatchel, SATCHEL_MAX } from './src/data/satchel.js';
import { cleanZenith } from './src/data/zenith.js';
import { riftBoard } from './server/riftBoard.js';
import { MAX_DIFFICULTY } from './src/data/difficulty.js';
import { cleanRanks, setSkillTable } from './src/combat/SkillRanks.js';
import { readFileSync, writeFileSync } from 'node:fs';
setSkillTable(Object.fromEntries(JSON.parse(readFileSync(new URL('./src/data/skills.json', import.meta.url), 'utf8')).map((s) => [s.id, s])));
import { setOwnerLookup, ensureShop, shopView, buy as shopBuy, equip as shopEquip, claimDaily, levelReward, publicCos, bankCapOf } from './server/shop.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const MAX_GROUP_SIZE = 5;
const MAX_NAME_LEN = 16;
const MAX_CHAT_LEN = 240;
const MIN_PASSWORD_LEN = 8; // pour les NOUVEAUX comptes (les anciens mots de passe de 6 caractères restent valables)
const HOST = process.env.HOST || '0.0.0.0';
const DIST = path.resolve(process.env.DIST_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'));
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // à activer derrière un hébergeur / proxy (Render, Railway, Fly, Caddy, nginx…)
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 12;
// V10.14 : les cosmétiques sont liés au compte — jamais des objets d'inventaire : ni vendables, ni échangeables, ni stockables
const noCosmetics = (slots) => (Array.isArray(slots) ? slots.map((x) => (x && typeof x.defId === 'string' && COSMETICS_BY_ID[x.defId] ? null : x)) : slots);
const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype', 'tostring', 'valueof', 'hasownproperty', 'admin', 'administrateur', 'moderateur', 'system', 'systeme']);

const accounts = await loadAccounts();
/** @type {Map<string, string>} token -> username */
const SECRET = await loadSecret(DATA_DIR);
// index insensible à la casse : « Bob » et « bob » sont le même compte (anti-usurpation)
const lcIndex = new Map(Object.keys(accounts).map((k) => [k.toLowerCase(), k]));
const keyOf = new WeakMap(); // objet de compte -> nom de compte (pour savoir si c'est le créateur)
for (const [k, a] of Object.entries(accounts)) keyOf.set(a, k);
const resolveAccount = (name) => { const k = lcIndex.get(String(name).toLowerCase()) ?? null; if (k && accounts[k]) keyOf.set(accounts[k], k); return k; };
setOwnerLookup((acc) => isOwnerKey(keyOf.get(acc)));
const regLimiter = new KeyedLimiter(4, 10 * 60 * 1000);     // créations de compte par IP
const loginLimiter = new KeyedLimiter(15, 60 * 1000);       // tentatives de connexion par IP
const codeLimiter = new KeyedLimiter(8, 10 * 60 * 1000);
const recLimiter = new KeyedLimiter(5, 15 * 60 * 1000);     // V10.57 : échecs de récupération par compte (verrouillage 15 min)
const failLimiter = new KeyedLimiter(6, 5 * 60 * 1000);     // échecs par compte (verrouillage 5 min)
const connsPerIp = new Map();

function ipOf(req) {
  if (TRUST_PROXY) { const xf = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean); if (xf.length) return xf[xf.length - 1]; }
  return req.socket.remoteAddress || 'inconnue';
}

const httpServer = createWebServer({ distDir: DIST, onApi: (req, res, base) => handleApi(req, res, base), onHealth: () => ({ ok: true, players: players.size, accounts: Object.keys(accounts).length }) });
const wss = new WebSocketServer({ server: httpServer, maxPayload: 600 * 1024, perMessageDeflate: false });
httpServer.listen(PORT, HOST, () => {
  console.log(`[Korvalune] Jeu + serveur multijoueur sur http://${HOST}:${PORT}`);
  console.log(`[Korvalune] ${Object.keys(accounts).length} compte(s) chargé(s) depuis ${DATA_DIR}`);
});
import('fs').then((fs) => { if (!fs.existsSync(path.join(DIST, 'index.html'))) console.warn(`[Korvalune] Dossier ${DIST} introuvable : lancez « npm run build » pour servir le jeu (le WebSocket fonctionne quand même).`); });
// battement de cœur : coupe les connexions mortes
const beat = setInterval(() => { for (const c of wss.clients) { if (c.isAlive === false) { c.terminate(); continue; } c.isAlive = false; try { c.ping(); } catch { /* ignoré */ } } }, 30000);
beat.unref?.();

/** @type {Map<string, Player>} */
const players = new Map();

// ---- API HTTP (V10.55 : plus aucun paiement par carte ; les dons passent par PayPal, voir server/donations.js) ----
const readBody = (req, max = 65536) => new Promise((resolve, reject) => {
  let n = 0; const ch = [];
  req.on('data', (c) => { n += c.length; if (n > max) { reject(new Error('corps trop grand')); req.destroy(); } else ch.push(c); });
  req.on('end', () => resolve(Buffer.concat(ch).toString('utf8')));
  req.on('error', reject);
});
const jsonOut = (res, base, code, obj) => { const b = Buffer.from(JSON.stringify(obj)); res.writeHead(code, { ...base, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }); res.end(b); };
async function handleApi(req, res, base) {
  let url; try { url = new URL(req.url, 'http://x'); } catch { return jsonOut(res, base, 400, { error: 'requête invalide' }); }
  return jsonOut(res, base, 404, { error: 'introuvable' });
}
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
  return { id: p.id, name: p.name, classId: p.classId, level: p.level, pos: p.pos, yaw: p.yaw, anim: p.anim, hp: p.hp, maxHp: p.maxHp, inst: p.inst | 0, cos: p.cos || {}, mnt: p.mnt || '', app: p.app || null };
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
// V10.8 — messages privés entre amis, conservés sur les comptes (lisibles même si l'ami était hors ligne)
const DM_KEEP = 40;
function dmConv(acc, w, create = false) {
  if (!Array.isArray(acc.dm)) { if (!create) return {}; acc.dm = []; }
  let c = acc.dm.find((x) => x.w === w);
  if (!c && create) { c = { w, m: [], u: 0 }; acc.dm.push(c); if (acc.dm.length > 120) acc.dm.shift(); }
  return c || {};
}
function friendsState(key) {
  const acc = accounts[key] || {};
  const friends = (acc.friends || []).map((fk) => {
    const online = !!acctWs.get(fk)?.size;
    let ch = null;
    if (online) for (const p of players.values()) if (p.account === fk) { ch = p; break; }
    return { name: fk, online, char: ch?.name || null, level: ch?.level || null, classId: ch?.classId || null, unread: dmConv(acc, fk).u || 0 };
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

// ---- Échanges d'objets entre joueurs (V10.9) ----
// Le serveur orchestre : proposition, offres, double confirmation, puis double accusé « j'ai bien les objets et la place »
// avant l'échange final. Seuls des OBJETS s'échangent (ni pièces ni cosmétiques/Lunes de la boutique).
const trades = new Map(); // tid -> { a, b, off:{a,b}, ok:{a,b}, ack:{}, phase, t }
const tradeOf = new Map(); // playerId -> tid
const pendingTrade = new Map(); // idCible -> { from, t }
const TRADE_MAX_ITEMS = 6;
const sideOf = (tr, pid) => (tr.a === pid ? 'a' : 'b');
function tradeState(tr, pid) {
  const me = sideOf(tr, pid), ot = me === 'a' ? 'b' : 'a', other = players.get(tr[ot]);
  return { t: 'trade:state', with: other?.name || '?', mine: tr.off[me], theirs: tr.off[ot], okMe: tr.ok[me], okThem: tr.ok[ot] };
}
function pushTrade(tr) { for (const pid of [tr.a, tr.b]) { const p = players.get(pid); if (p) send(p.ws, tradeState(tr, pid)); } }
function endTrade(pid, reason) {
  const tid = tradeOf.get(pid); if (!tid) return;
  const tr = trades.get(tid); trades.delete(tid);
  if (!tr) { tradeOf.delete(pid); return; }
  for (const id of [tr.a, tr.b]) { tradeOf.delete(id); const p = players.get(id); if (p && reason) send(p.ws, { t: 'trade:end', reason }); }
}
setInterval(() => { // échanges abandonnés / invitations périmées
  const now = Date.now();
  for (const [tid, tr] of trades) if (now - tr.t > (tr.phase === 'exec' ? 20000 : 10 * 60 * 1000)) endTrade(tr.a, 'Échange expiré.');
  for (const [id, pe] of pendingTrade) if (now - pe.t > 30000) pendingTrade.delete(id);
}, 5000).unref?.();

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
const ENEMY_LIST = (() => { try { const d = JSON.parse(readFileSync(new URL('./src/data/enemies.json', import.meta.url), 'utf8')); return Object.entries(d).map(([id, e]) => ({ id, name: e.name || id, boss: !!e.boss })); } catch { return []; } })();
const ENEMY_IDS = new Set(ENEMY_LIST.map((e) => e.id));
const sendEveryone = (m) => { for (const c of wss.clients) send(c, m); }; // tous les clients connectés (même ceux qui sont encore dans les menus)
const bannerAll = (b) => sendEveryone({ t: 'banner', ...b });
const loginExtras = (ws, acc, key) => { // message du jour, boost en cours, réponses de l'admin
  const n = supNotify(acc); if (n) send(ws, n);
  const m = getMotd(); if (m) { send(ws, { t: 'system', text: '📜 ' + m }); send(ws, { t: 'banner', kind: 'message', icon: '📜', text: m, secs: 8 }); }
  const b = worldBoost(); if (b) send(ws, { t: 'world:boost', ...b, left: b.until - Date.now() });
};
const banText = (acc) => `Compte suspendu${acc.ban?.reason ? ' : ' + acc.ban.reason : ''}. Contacte le créateur du jeu.`;
const supNotify = (acc) => ((acc.supportUnread | 0) > 0 ? { t: 'system', text: `📩 Tu as ${acc.supportUnread} réponse(s) de l’administrateur : Compte → Contacter l’administrateur.` } : null);
const accView = (acc) => { ensureChars(acc); return { chars: acc.chars, bank: acc.sharedBank, save: acc.chars.find(Boolean) || null }; };

// V10.51 — ANTI-TRICHE
// 1) « Budgets » de progression par personnage (jetons qui se rechargent avec le temps réel) : spammer les sauvegardes ne
//    rapporte rien de plus que d'attendre. 2) Registre des objets générés : un objet appartient à UN compte ; il ne change de
//    propriétaire que par un échange validé par le serveur, donc dupliquer un objet (échange non retiré, sauvegarde rejouée) échoue.
const BUDGET = { coinRate: 4000, coinBurst: 4000 * 60, soldRate: 6e5, soldBurst: 3e6, lvRate: 3, lvBurst: 10 };
function refillBudget(b, now) {
  const dt = b.at ? Math.max(0, Math.min(1440, (now - b.at) / 60000)) : 1e9; // première fois : plein
  b.at = now;
  b.coin = Math.min(BUDGET.coinBurst, (b.coin ?? BUDGET.coinBurst) + dt * BUDGET.coinRate);
  b.sold = Math.min(BUDGET.soldBurst, (b.sold ?? BUDGET.soldBurst) + dt * BUDGET.soldRate);
  b.lv = Math.min(BUDGET.lvBurst, (b.lv ?? BUDGET.lvBurst) + dt * BUDGET.lvRate);
  return b;
}
const itemOwner = new Map(); // clé d'objet → compte propriétaire
// Les propriétaires issus d'échanges sont conservés sur disque : après un redémarrage, ils l'emportent sur les anciennes sauvegardes.
const TRANSFER_FILE = path.join(DATA_DIR, 'item-owners.json');
let transfers = {};
try { transfers = JSON.parse(readFileSync(TRANSFER_FILE, 'utf8')) || {}; } catch { transfers = {}; }
for (const [k, u] of Object.entries(transfers)) itemOwner.set(k, u);
function noteTransfer(key, username) {
  itemOwner.set(key, username); transfers[key] = username;
  const ks = Object.keys(transfers); if (ks.length > 30000) for (const old of ks.slice(0, ks.length - 30000)) delete transfers[old];
}
function saveTransfers() { try { writeFileSync(TRANSFER_FILE, JSON.stringify(transfers)); } catch (e) { console.error('[Korvalune] item-owners.json :', e.message); } }
function registerOwned(username, slots) {
  for (const s of slots || []) if (s?.gen?.uid && !itemOwner.has(itemKey(s.gen))) itemOwner.set(itemKey(s.gen), username);
}
for (const [u, a] of Object.entries(accounts)) { // reconstruit le registre au démarrage (premier arrivé, premier servi)
  const lists = [a.sharedBank, ...(Array.isArray(a.chars) ? a.chars.map((c) => c && [...(c.inventory || []), ...Object.values(c.equipment || {})]) : [])];
  for (const l of lists) registerOwned(u, l);
}
// retire d'une sauvegarde les objets déjà possédés par un autre compte (copie ou objet échangé puis gardé)
function stripForeignItems(username, slots) {
  if (!Array.isArray(slots)) return slots;
  return slots.map((s) => {
    if (!s?.gen?.uid) return s;
    const k = itemKey(s.gen), o = itemOwner.get(k);
    if (!o) { itemOwner.set(k, username); return s; }
    return o === username ? s : null;
  });
}

function sanitizeSave(prev, incoming, elapsedMs, budget) {
  if (!incoming || typeof incoming !== 'object') return null;
  const elapsedMin = Math.max(0.2, Math.min(elapsedMs / 60000, 1440)); // temps réel (plancher 12 s) : plus de gain « minimum 1 minute » par sauvegarde
  const bud = refillBudget(budget || {}, Date.now());
  if (!prev) { bud.coin = Math.min(bud.coin, 5000); bud.sold = Math.min(bud.sold, 50000); } // nouveau personnage : pas de réserve de départ
  const clean = {};

  clean.name = sanitize(incoming.name, MAX_NAME_LEN) || 'Aventurier';
  clean.classId = sanitize(incoming.classId, 20) || 'warrior';
  clean.skin = Number.isInteger(incoming.skin) && incoming.skin >= 0 && incoming.skin <= 0xffffff ? incoming.skin : (Number.isInteger(prev?.skin) ? prev.skin : null);
  for (const k of ['hairCol', 'eyeCol']) clean[k] = Number.isInteger(incoming[k]) && incoming[k] >= 0 && incoming[k] <= 0xffffff ? incoming[k] : (Number.isInteger(prev?.[k]) ? prev[k] : undefined);
  // V10.12 : apparence (sexe, taille, visage, coiffure…) — valeurs du catalogue uniquement, bornées
  clean.look = normalizeLook(incoming.look && typeof incoming.look === 'object' ? incoming.look : prev?.look);
  clean.pos = Array.isArray(incoming.pos) && incoming.pos.length === 3 && incoming.pos.every(Number.isFinite) ? incoming.pos : (prev?.pos || [0, 0, 12]);
  clean.yaw = Number.isFinite(incoming.yaw) ? incoming.yaw : 0;

  const prevLevel = prev?.level || 1;
  const wantLevel = Number.isFinite(incoming.level) ? Math.floor(incoming.level) : prevLevel;
  const lvGain = Math.max(0, Math.min(wantLevel - prevLevel, Math.floor(bud.lv), 200 - prevLevel)); // jamais de retour en arrière ; gain de niveaux limité par le budget (3 niveaux/min, rafale de 10)
  bud.lv -= lvGain;
  clean.level = prevLevel + lvGain;

  clean.xp = Number.isFinite(incoming.xp) ? Math.max(0, Math.floor(incoming.xp)) : 0;
  clean.statPoints = Number.isFinite(incoming.statPoints) ? Math.max(0, Math.min(1100, Math.floor(incoming.statPoints))) : (prev?.statPoints ?? 0);

  const prevCoins = prev?.coins ?? 0;
  const wantCoins = Number.isFinite(incoming.coins) ? Math.floor(incoming.coins) : prevCoins;
  // V10.21 : les ventes d'objets (valeurs très élevées en haute rareté) ne doivent pas être rabotées par le plafond
  // de gains par minute : le client tient un compteur cumulé `soldTotal` (monotone), seule la hausse est acceptée.
  const prevSold = Math.max(0, Math.floor(prev?.soldTotal ?? 0));
  const wantSold = Number.isFinite(incoming.soldTotal) ? Math.max(prevSold, Math.floor(incoming.soldTotal)) : prevSold;
  const saleAllow = Math.max(0, Math.min(wantSold - prevSold, Math.floor(bud.sold)));
  bud.sold -= saleAllow;
  clean.soldTotal = prevSold + saleAllow;
  const coinGain = Math.max(0, wantCoins - prevCoins - saleAllow);
  const coinOk = Math.min(coinGain, Math.floor(bud.coin));
  bud.coin -= coinOk;
  clean.coins = Math.max(0, Math.min(wantCoins < prevCoins ? wantCoins : prevCoins + coinOk + saleAllow, 99999999));

  clean.stats = {};
  for (const k of ['str', 'agi', 'int', 'vit', 'spi', 'luck']) {
    const v = incoming.stats?.[k];
    clean.stats[k] = Number.isFinite(v) ? Math.max(0, Math.min(999, Math.floor(v))) : (prev?.stats?.[k] ?? 5);
  }
  { // points de caractéristiques : jamais plus que ceux gagnés (5 par niveau + marge pour le Zénith et les récompenses)
    const spent = Object.values(clean.stats).reduce((a, b2) => a + b2, 0) - 30;
    if (spent + clean.statPoints > 5 * (clean.level - 1) + 60 + 6 * ((Number(incoming.zenith?.lvl) || 0) | 0)) {
      clean.stats = {}; for (const k of ['str', 'agi', 'int', 'vit', 'spi', 'luck']) clean.stats[k] = prev?.stats?.[k] ?? 5;
      clean.statPoints = prev?.statPoints ?? 0;
    }
  }
  clean.hp = Number.isFinite(incoming.hp) ? Math.max(0, incoming.hp) : (prev?.hp ?? 100);
  clean.mana = Number.isFinite(incoming.mana) ? Math.max(0, incoming.mana) : (prev?.mana ?? 50);

  clean.active = Array.isArray(incoming.active) ? incoming.active.slice(0, 40).map((s) => sanitize(s, 60)) : [];
  clean.completed = Array.isArray(incoming.completed) ? incoming.completed.slice(0, 400).map((s) => sanitize(s, 60)) : [];
  // V10.10 : montures de l'écurie (identifiants du catalogue uniquement)
  clean.mounts = [...new Set((Array.isArray(incoming.mounts) ? incoming.mounts : []).filter(isMountId))].slice(0, MAX_MOUNTS);
  clean.difficulty = Number.isInteger(incoming.difficulty) ? Math.max(0, Math.min(MAX_DIFFICULTY, incoming.difficulty)) : (prev?.difficulty | 0); // V10.18
  clean.potions = cleanPotions(incoming.potions, prev?.potions); // V10.22 : potions permanentes
  { // V10.26 : besace des matériaux — gain par minute plafonné (large : le démontage d'objets rend beaucoup)
    const inc = cleanSatchel(incoming.satchel, prev?.satchel), old = cleanSatchel(prev?.satchel);
    clean.satchel = {};
    for (const [id, n] of Object.entries(inc)) { const cap = Math.min(SATCHEL_MAX, (old[id] || 0) + Math.ceil(3000 * elapsedMin) + 400); clean.satchel[id] = Math.min(n, cap); }
  }
  { // V10.26 : rangs de compétences — bornés par le niveau ; +3 rangs par compétence et par sauvegarde au plus
    const inc = cleanRanks(incoming.skillRanks, clean.level), old = cleanRanks(prev?.skillRanks, 200);
    clean.skillRanks = {};
    for (const [id, r] of Object.entries(inc)) clean.skillRanks[id] = Math.min(r, (old[id] || 0) + 3);
  }
  { // V10.28 : Zénith — seulement à partir du niveau 200 ; hausse du niveau bornée par sauvegarde et par minute
    const pz = cleanZenith(prev?.zenith);
    clean.zenith = clean.level >= 200 ? cleanZenith(incoming.zenith, pz.lvl + 2 + Math.ceil(3 * elapsedMin)) : { lvl: 0, ranks: {} };
  }
  clean.mountSel = isMountId(incoming.mountSel) && clean.mounts.includes(incoming.mountSel) ? incoming.mountSel : '';
  clean.progress = incoming.progress && typeof incoming.progress === 'object' ? incoming.progress : {};
  // Compteurs d'objectifs (ex: 3/8 loups tués) : uniquement des entiers bornés.
  clean.counts = {};
  if (incoming.counts && typeof incoming.counts === 'object') {
    for (const [qid, c] of Object.entries(incoming.counts).slice(0, 40)) {
      if (!c || typeof c !== 'object') continue;
      clean.counts[sanitize(qid, 60)] = Object.fromEntries(Object.entries(c).slice(0, 4).map(([k, v]) => [sanitize(k, 20), Number.isFinite(v) ? Math.max(0, Math.min(1000, Math.floor(v))) : 0]));
    }
  }

  clean.inventory = noCosmetics(sanitizeItemSlots(incoming.inventory, 30, sanitize)) ?? (prev?.inventory || []);

  clean.equipment = {};
  if (incoming.equipment && typeof incoming.equipment === 'object') {
    for (const [slot, item] of Object.entries(incoming.equipment)) {
      if (!item) continue;
      if (item.gen) { const g = sanitizeGeneratedItem(item.gen); if (g) clean.equipment[sanitize(slot, 20)] = { gen: g }; }
      else if (typeof item.defId === 'string') clean.equipment[sanitize(slot, 20)] = { defId: sanitize(item.defId, 40) };
    }
  }

  clean.cube = incoming.cube === undefined ? (prev?.cube || {}) : sanitizeCubePowers(incoming.cube); // V10.19

  clean.skillBar = Array.isArray(incoming.skillBar)
    ? incoming.skillBar.slice(0, 10).map((id) => (typeof id === 'string' ? sanitize(id, 40) : null))
    : (prev?.skillBar || []);

  clean.mouseSlots = incoming.mouseSlots && typeof incoming.mouseSlots === 'object'
    ? { l: typeof incoming.mouseSlots.l === 'string' ? sanitize(incoming.mouseSlots.l, 40) : null, r: typeof incoming.mouseSlots.r === 'string' ? sanitize(incoming.mouseSlots.r, 40) : null }
    : (prev?.mouseSlots || undefined);

  // V4.7 : coffres du monde déjà ouverts (identifiants courts)
  clean.chests = Array.isArray(incoming.chests) ? incoming.chests.filter((x) => typeof x === 'string' && x.length <= 20).slice(0, 300) : (prev?.chests || []);
  clean.bank = noCosmetics(sanitizeItemSlots(incoming.bank, 240, sanitize)) ?? (prev?.bank || []);

  // V3.7 : spires de Éther (clés, éclats, cristaux, records) — bornées, jamais de gain brutal d'une sauvegarde à l'autre
  {
    // anciennes sauvegardes (V3.7/V3.8) : anciens noms de champs/modes → nouveaux
    const mig = (o) => {
      if (!o || typeof o !== 'object') return o;
      const x = { ...o };
      const mode = (m) => (m === 'greater' ? 'zenith' : m);
      if (x.zkeys === undefined && x.gkeys !== undefined) x.zkeys = x.gkeys;
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
        pending: num(r.pending, 0, 3, 0), pendingLevel: num(r.pendingLevel, 0, 999, 0),
        open: r.open && ['ascent', 'zenith', 'trial'].includes(r.open.modeId) ? { modeId: r.open.modeId, level: num(r.open.level, 1, 999, 1) } : null,
        bestAscent: num(r.bestAscent, 0, Math.min(999, Math.max(25, (pr.bestAscent ?? 0) + 25)), 0), // V10.29 : hausse du record bornée par sauvegarde (classement)
        bestZenith: { level: num(r.bestZenith?.level, 0, Math.min(999, Math.max(25, (pr.bestZenith?.level ?? 0) + 25)), 0), time: num(r.bestZenith?.time, 0, 99999, 0) },
        history: Array.isArray(r.history) ? r.history.slice(0, 10).map((h) => ({ mode: ['ascent', 'zenith', 'trial'].includes(h?.mode) ? h.mode : 'ascent', level: num(h?.level, 1, 999, 1), time: num(h?.time, 0, 99999, 0), ok: !!h?.ok })) : []
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

const admState = () => ({ t: 'adm:state', motd: getMotd(), maint: maintCfg(), boost: worldBoost(), uptime: Math.round(process.uptime()), memMb: Math.round(process.memoryUsage().rss / 1048576), accounts: Object.keys(accounts).length, online: acctWs.size, players: players.size, enemies: ENEMY_LIST });
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
    refreshCos(key);
  };
  // V10.1 — cosmétiques équipés : lus sur le compte (jamais envoyés par le client), diffusés aux autres joueurs
  const refreshCos = (key) => {
    if (!player) return;
    player.cos = key && accounts[key] ? publicCos(accounts[key]) : {};
    broadcastAll({ t: 'playerCos', id: player.id, cos: player.cos }, player.id);
  };
  // V10.7 — réglages du joueur conservés sur le compte (retrouvés sur n'importe quel appareil / lien)
  const pushSettings = () => { if (authUsername && accounts[authUsername]) send(ws, { t: 'settings', s: accounts[authUsername].settings || null }); };
  const settingsLimiter = new RateLimiter(4, 5000);
  const tradeLimiter = new RateLimiter(30, 5000);
  const eventLimiter = new RateLimiter(20, 5000);
  const passLimiter = new RateLimiter(30, 10000);
  const shopLimiter = new RateLimiter(30, 10000); // V10.17 : la boutique n'est plus bridée par la limite des messages d'amis (8/10 s), qui ignorait des équipements en silence
  const pushShop = () => { if (authUsername && accounts[authUsername]) { send(ws, shopView(accounts[authUsername])); send(ws, eventView(accounts[authUsername])); } };
  const moveLimiter = new RateLimiter(20, 1000);
  const chatLimiter = new RateLimiter(6, 1000);
  const authLimiter = new RateLimiter(5, 10000);
  const supLimiter = new RateLimiter(6, 10000);
  const saveLimiter = new RateLimiter(5, 20000); // V10.51 : au plus 5 sauvegardes / 20 s (l'autosave est de 60 s)

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    // --- Comptes ---
    if (msg.t === 'resume') { // reconnexion automatique avec le jeton enregistré dans le navigateur
      const u = verifyToken(SECRET, msg.token);
      const key = u && resolveAccount(u);
      if (!key || tokenIssuedAt(msg.token) < (accounts[key].revokedAt || 0)) { send(ws, { t: 'authResult', ok: false, error: '', silent: true }); return; }
      if (accounts[key].ban) { send(ws, { t: 'authResult', ok: false, error: banText(accounts[key]) }); return; }
      if (maintCfg().on && !isOwnerKey(key)) { send(ws, { t: 'authResult', ok: false, error: '🛠️ ' + (maintCfg().text || 'Maintenance en cours, reviens bientôt.') }); return; }
      setAuth(key);
      send(ws, { t: 'authResult', ok: true, token: msg.token, username: key, ...accView(accounts[key]), resumed: true });
      pushShop(); pushSettings(); loginExtras(ws, accounts[key], key);
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
        if (accounts[key].ban) { fail(banText(accounts[key])); return; }
        if (maintCfg().on && !isOwnerKey(key)) { fail('🛠️ ' + (maintCfg().text || 'Maintenance en cours, reviens bientôt.')); return; }
        const token = makeToken(SECRET, key);
        setAuth(key);
        send(ws, { t: 'authResult', ok: true, token, username: key, ...accView(accounts[key]) });
        pushShop(); pushSettings(); loginExtras(ws, accounts[key], key);
      })().catch((e) => { console.error('[Korvalune] auth :', e.message); fail('Erreur serveur.'); });
      return;
    }
    if (msg.t === 'logout') { const old = authUsername; if (old) { presence(old, ws, false); if (player) player.account = null; } authUsername = null; refreshCos(null); if (old) pushFriendsOf(old); return; }

    // --- Messages privés entre amis (V10.8) ---
    if (msg.t === 'friend:msg' || msg.t === 'friend:history') {
      if (!authUsername) { send(ws, { t: 'system', text: 'Connecte-toi à ton compte pour utiliser les messages.' }); return; }
      if (!chatLimiter.allow()) return;
      const me = authUsername, acc = accounts[me];
      const fk = resolveAccount(sanitizeUsername(msg.t === 'friend:msg' ? msg.to : msg.with));
      const other = fk && accounts[fk];
      if (!other || !(acc.friends || []).includes(fk) || !(other.friends || []).includes(me)) { send(ws, { t: 'system', text: 'Tu ne peux écrire qu\u2019à tes amis.' }); return; }
      if (msg.t === 'friend:history') {
        const c = dmConv(acc, fk);
        send(ws, { t: 'dmHistory', with: fk, msgs: (c.m || []).map((x) => ({ me: x.f === me, text: x.x, at: x.t })) });
        if (c.u) { c.u = 0; persistAccounts(accounts); pushFriends(me); }
        return;
      }
      const text = sanitize(msg.text, MAX_CHAT_LEN);
      if (!text) return;
      const at = Date.now();
      const mine = dmConv(acc, fk, true), theirs = dmConv(other, me, true);
      mine.m.push({ f: me, x: text, t: at }); theirs.m.push({ f: me, x: text, t: at });
      if (mine.m.length > DM_KEEP) mine.m.splice(0, mine.m.length - DM_KEEP);
      if (theirs.m.length > DM_KEEP) theirs.m.splice(0, theirs.m.length - DM_KEEP);
      theirs.u = Math.min(99, (theirs.u || 0) + 1);
      persistAccounts(accounts);
      for (const w of acctWs.get(me) || []) send(w, { t: 'dm', with: fk, me: true, text, at });
      for (const w of acctWs.get(fk) || []) send(w, { t: 'dm', with: me, me: false, text, at });
      pushFriends(fk);
      return;
    }

    // --- Amis (V6.0) : par nom de compte ---
    if (msg.t.startsWith('friend:')) {
      if (!authUsername) { send(ws, { t: 'system', text: 'Connecte-toi à ton compte pour utiliser les amis.' }); return; }
      if (!friendLimiter.allow()) return;
      const me = authUsername, acc = accounts[me];
      acc.friends = acc.friends || []; acc.requests = acc.requests || [];
      const sys = (text) => send(ws, { t: 'system', text });
      if (msg.t === 'friend:list') { send(ws, friendsState(me)); return; }
      if (msg.t === 'friend:add') {
        if (typeof msg.id === 'string' && !msg.to) { // V10.34 : ajout depuis l'avatar d'un joueur
          const tp = players.get(msg.id);
          if (!tp?.account) { sys('Ce joueur n\u2019est pas connecté à un compte : impossible de l\u2019ajouter.'); return; }
          msg.to = tp.account;
        }
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
        if (Array.isArray(acc.dm)) acc.dm = acc.dm.filter((x) => x.w !== fk);
        if (other && Array.isArray(other.dm)) other.dm = other.dm.filter((x) => x.w !== me);
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
      if (!saveLimiter.allow()) { send(ws, { t: 'saveAck', ok: true }); return; } // trop rapproché : la prochaine sauvegarde (instantané complet) rattrapera
      const acc = ensureChars(accounts[username]);
      const slot = Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < MAX_CHARS ? msg.slot : 0;
      const prevChar = acc.chars[slot];
      const elapsed = Date.now() - (acc.charSaveAt[slot] || 0);
      if (!acc.budget || typeof acc.budget !== 'object') acc.budget = {};
      if (!acc.budget[slot] || typeof acc.budget[slot] !== 'object') acc.budget[slot] = {};
      const clean = sanitizeSave(prevChar, msg.data, elapsed, acc.budget[slot]);
      if (!clean) { send(ws, { t: 'saveAck', ok: false, error: 'Données de sauvegarde invalides.' }); return; }
      // V10.51 : un objet ne peut appartenir qu'à un seul compte (anti-duplication)
      clean.inventory = stripForeignItems(username, clean.inventory);
      for (const [sl, it] of Object.entries(clean.equipment || {})) if (it?.gen && !stripForeignItems(username, [it])[0]) delete clean.equipment[sl];
      // le coffre est partagé par tous les personnages du compte
      const bank = stripForeignItems(username, sanitizeItemSlots(msg.data?.bank, bankCapOf(acc), sanitize));
      if (bank) acc.sharedBank = bank;
      delete clean.bank;
      acc.chars[slot] = clean;
      acc.charSaveAt[slot] = Date.now();
      acc.lastSaveAt = Date.now();
      const gainL = levelReward(acc, clean.level);
      persistAccounts(accounts);
      send(ws, { t: 'saveAck', ok: true });
      if (gainL > 0) { send(ws, shopView(acc)); send(ws, { t: 'shop:msg', ok: true, text: `+${gainL} Lunes pour ta progression !` }); }
      return;
    }

    // --- Réglages du compte (V10.7) ---
    if (msg.t === 'settings:save') {
      const key = authUsername && resolveAccount(authUsername);
      if (!key || !settingsLimiter.allow()) return;
      if (!msg.s || typeof msg.s !== 'object' || Array.isArray(msg.s)) return;
      let txt; try { txt = JSON.stringify(msg.s); } catch { return; }
      if (txt.length > 12000) return;
      accounts[key].settings = JSON.parse(txt);
      persistAccounts(accounts);
      return;
    }

    // --- Événement Halloween (V10.13) ---
    if (msg.t.startsWith('event:')) {
      if (!eventLimiter.allow()) return;
      const key = authUsername && resolveAccount(authUsername);
      if (!key) { send(ws, { t: 'event:msg', ok: false, text: 'Connecte-toi à ton compte pour participer à l’événement.' }); return; }
      const acc = ensureChars(accounts[key]);
      const push = () => send(ws, eventView(acc));
      const note = (ok, text) => { if (text) send(ws, { t: 'event:msg', ok, text }); };
      if (msg.t === 'event:get') { push(); return; }
      if (msg.t === 'event:top') { send(ws, { t: 'event:top', rows: evTop(accounts) }); return; }
      if (msg.t === 'event:collect') { const r = evCollect(acc, msg.id, player?.pos); if (r.ok) { persistAccounts(accounts); note(true, `+${r.gained} 🍬${r.bonus ? ` · bonus de la chasse : +${r.bonus} 🍬 !` : ''}`); } else note(false, r.error); push(); return; }
      if (msg.t === 'event:kill') { const r = evKill(acc, msg.kind); if (r.ok) { persistAccounts(accounts); if (r.gained || r.bonus) note(true, `+${r.gained + (r.bonus || 0)} 🍬${r.bonus ? ' · défi du jour accompli !' : ''}${r.capped ? ' (plafond du jour presque atteint)' : ''}`); } push(); return; }
      if (msg.t === 'event:daily') { const r = evDaily(acc); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? `+${r.gained} 🍬 : sac de bonbons du jour !` : r.error); push(); return; }
      if (msg.t === 'event:buy') { const r = evBuy(acc, msg.id); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? `Acheté : ${r.item.name}` : r.error); push(); send(ws, shopView(acc)); return; }
      return;
    }

    if (msg.t === 'rift:board') { if (passLimiter.allow()) send(ws, { t: 'rift:board', ...riftBoard(accounts) }); return; } // V10.29

    // --- Pass de combat (V10.23) ---
    if (msg.t.startsWith('pass:')) {
      if (!passLimiter.allow()) return;
      const key = authUsername && resolveAccount(authUsername);
      if (!key) { send(ws, { t: 'pass:msg', ok: false, text: 'Connecte-toi à ton compte pour utiliser le pass de combat.' }); return; }
      const acc = ensureChars(accounts[key]);
      const push = () => { send(ws, passView(acc)); send(ws, shopView(acc)); };
      const note = (ok, text) => { if (text) send(ws, { t: 'pass:msg', ok, text }); };
      const gainText = (r) => `${r.lunes ? `+${r.lunes} 🌙` : ''}${r.items?.length ? ` · ${r.items.join(', ')}` : ''}`.replace(/^ · /, '');
      if (msg.t === 'pass:get') { push(); return; }
      if (msg.t === 'pass:ev') { const r = passEvents(acc, msg.c); if (r.ok) persistAccounts(accounts); send(ws, passView(acc)); return; }
      if (msg.t === 'pass:claim') { const r = passClaim(acc, msg.track, msg.tier | 0); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? `Récompense : ${gainText(r)}` : r.error); push(); return; }
      if (msg.t === 'pass:claimAll') { const r = passClaimAll(acc); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? `${r.n} récompense${r.n > 1 ? 's' : ''} : ${gainText(r)}` : r.error); push(); return; }
      if (msg.t === 'pass:mission') { const r = passMission(acc, msg.id); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? `+${r.xp} XP de pass` : r.error); push(); return; }
      if (msg.t === 'pass:premium') { const r = passBuyPremium(acc); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? 'Pass premium débloqué ! Récupère tes récompenses.' : r.error); push(); return; }
      if (msg.t === 'pass:tier') { const r = passBuyTier(acc); if (r.ok) persistAccounts(accounts); note(r.ok, r.ok ? `Palier ${r.tier} atteint !` : r.error); push(); return; }
      return;
    }

    // --- Récupération de compte (V10.57) ---
    if (msg.t === 'acct:recoverInfo' || msg.t === 'acct:recover') {
      const rf = (text, extra = {}) => send(ws, { t: 'acct:recoverResult', ok: false, text, ...extra });
      if (!authLimiter.allow() || !loginLimiter.hit(ip)) { rf('Trop de tentatives, réessaie dans un instant.'); return; }
      const k = resolveAccount(sanitizeUsername(msg.username));
      const a = k && accounts[k];
      if (msg.t === 'acct:recoverInfo') {
        send(ws, { t: 'acct:recoverInfo', username: k || sanitizeUsername(msg.username), hasQuestion: !!a?.sec?.a, question: a?.sec?.a ? a.sec.q : '', hasCode: !!a?.sec?.c });
        return;
      }
      (async () => {
        const lock = 'rec:' + (k ? k.toLowerCase() : 'x:' + sanitizeUsername(msg.username).toLowerCase());
        if (recLimiter.count(lock) >= recLimiter.max) { rf('Trop d’échecs : récupération bloquée 15 minutes.'); return; }
        const method = msg.method === 'code' ? 'code' : 'question';
        const np = String(msg.newPassword || '');
        if (np.length < MIN_PASSWORD_LEN) { rf(`Nouveau mot de passe trop court (${MIN_PASSWORD_LEN} caractères minimum).`); return; }
        const ok = a ? await checkRecovery(a, method, msg.secret) : (await hashPassword('x'), false);
        if (!ok) { recLimiter.hit(lock); rf(method === 'code' ? 'Code de secours incorrect.' : 'Réponse incorrecte.'); return; }
        if (a.ban) { rf(banText(a)); return; }
        a.passwordHash = await hashPassword(np); a.revokedAt = Date.now();
        if (method === 'code' && a.sec) delete a.sec.c; // un code de secours ne sert qu’une fois
        recLimiter.reset(lock); failLimiter.reset(k.toLowerCase());
        await persistAccounts(accounts);
        console.log(`[Korvalune] mot de passe récupéré : ${k} (${method})`);
        send(ws, { t: 'acct:recoverResult', ok: true, text: 'Mot de passe changé ! Tu peux te connecter.' + (method === 'code' ? ' Ton code de secours est maintenant utilisé : génères-en un nouveau dans « Sécurité du compte ».' : '') });
      })().catch((e) => { console.error('[Korvalune] récupération :', e.message); rf('Erreur serveur.'); });
      return;
    }
    // --- Sécurité du compte (connecté) ---
    if (msg.t.startsWith('acct:')) {
      const akey = authUsername && resolveAccount(authUsername);
      const am = (ok, text) => send(ws, { t: 'acct:msg', ok, text });
      if (!akey) { am(false, 'Connecte-toi à ton compte.'); return; }
      if (!passLimiter.allow()) return;
      const aacc = accounts[akey];
      if (msg.t === 'acct:secInfo') { send(ws, { t: 'acct:sec', ...secView(aacc), questions: QUESTIONS }); return; }
      (async () => {
        if (!(await verifyPassword(String(msg.password || ''), aacc.passwordHash))) { failLimiter.hit(akey.toLowerCase()); am(false, 'Mot de passe actuel incorrect.'); return; }
        if (msg.t === 'acct:secSet') {
          if (msg.answer) { const r = await setQuestion(aacc, msg.question, msg.answer); if (!r.ok) { am(false, r.error); return; } }
          if (typeof msg.email === 'string') { const r = setEmail(aacc, msg.email); if (!r.ok) { am(false, r.error); return; } }
          await persistAccounts(accounts); am(true, 'Sécurité du compte enregistrée.'); send(ws, { t: 'acct:sec', ...secView(aacc), questions: QUESTIONS });
        } else if (msg.t === 'acct:genCode') {
          const code = await makeRecoveryCode(aacc); await persistAccounts(accounts);
          send(ws, { t: 'acct:code', code }); send(ws, { t: 'acct:sec', ...secView(aacc), questions: QUESTIONS });
        } else if (msg.t === 'acct:passChange') {
          const np = String(msg.newPassword || '');
          if (np.length < MIN_PASSWORD_LEN) { am(false, `Nouveau mot de passe trop court (${MIN_PASSWORD_LEN} caractères minimum).`); return; }
          aacc.passwordHash = await hashPassword(np); aacc.revokedAt = Date.now(); await persistAccounts(accounts);
          send(ws, { t: 'acct:passOk', token: makeToken(SECRET, akey) }); am(true, 'Mot de passe changé. Tes autres appareils devront se reconnecter.');
        }
      })().catch((e) => { console.error('[Korvalune] sécurité compte :', e.message); am(false, 'Erreur serveur.'); });
      return;
    }
    // --- Contacter l'administrateur (V10.58) ---
    if (msg.t === 'support:get' || msg.t === 'support:send') {
      const k = authUsername && resolveAccount(authUsername);
      if (!k) { send(ws, { t: 'support:msg', ok: false, text: 'Connecte-toi à ton compte.' }); return; }
      if (!supLimiter.allow()) { send(ws, { t: 'support:msg', ok: false, text: 'Doucement : patiente quelques secondes.' }); return; }
      const a = accounts[k];
      if (msg.t === 'support:send') {
        if (a.support && a.support.filter((m) => m.f === 'p' && Date.now() - m.at < 3600e3).length >= 10) { send(ws, { t: 'support:msg', ok: false, text: 'Tu as déjà envoyé beaucoup de messages : attends la réponse de l\u2019administrateur.' }); return; }
        const r = supAdd(a, 'p', msg.text);
        if (!r.ok) { send(ws, { t: 'support:msg', ok: false, text: r.error }); return; }
        persistAccounts(accounts); console.log(`[Korvalune] message à l'admin de ${k}`);
        send(ws, { t: 'support:msg', ok: true, text: 'Message envoyé ✔ Tu auras une réponse ici.' });
      } else supRead(a);
      if (msg.t === 'support:get') persistAccounts(accounts);
      send(ws, { t: 'support', ...supView(a), unread: 0 });
      return;
    }
    // --- Administration (créateur uniquement, V10.57) ---
    if (msg.t.startsWith('adm:')) {
      const me = authUsername && resolveAccount(authUsername);
      const ar = (ok, text, extra = {}) => send(ws, { t: 'adm:res', ok, text, ...extra });
      if (!me || !isOwnerKey(me)) { ar(false, 'Réservé au créateur.'); return; }
      if (!shopLimiter.allow()) return;
      const online = (k) => acctWs.has(k);
      const target = () => { const k = resolveAccount(sanitizeUsername(msg.account)); return k ? [k, accounts[k]] : [null, null]; };
      (async () => {
        if (msg.t === 'adm:list') { send(ws, { t: 'adm:list', ...searchAccounts(accounts, msg.q, online), onlineAccounts: acctWs.size, players: players.size, accounts: Object.keys(accounts).length }); return; }
        if (msg.t === 'adm:state') { send(ws, admState()); return; }
        if (msg.t === 'adm:online') {
          send(ws, { t: 'adm:online', list: [...players.values()].map((p) => ({ name: p.name, account: p.account || '', level: p.level, classId: p.classId, muted: !!(p.account && accounts[p.account]?.mutedUntil > Date.now()) })) }); return;
        }
        if (msg.t === 'adm:motd') { await setMotd(msg.text); await adminLog(me, 'message du jour', '-', getMotd()); ar(true, getMotd() ? 'Message du jour enregistré (affiché à chaque connexion).' : 'Message du jour retiré.'); send(ws, admState()); return; }
        if (msg.t === 'adm:maint') {
          await setMaint(msg.on, msg.text); await adminLog(me, msg.on ? 'maintenance activée' : 'maintenance terminée', '-', msg.text || '');
          if (msg.on) { broadcastAll({ t: 'system', text: '🛠️ Maintenance : ' + (maintCfg().text || 'le jeu va être indisponible un moment.') }); bannerAll({ kind: 'alert', icon: '🛠️', text: 'Maintenance', sub: maintCfg().text || 'Le jeu va être indisponible un moment.', secs: 12 }); }
          ar(true, msg.on ? 'Maintenance activée : seuls les créateurs peuvent se connecter.' : 'Maintenance terminée : le jeu est ouvert.'); send(ws, admState()); return;
        }
        if (msg.t === 'adm:boost') {
          if (msg.off) { await stopBoost(); sendEveryone({ t: 'world:boost', xp: 1, drop: 1, left: 0 }); await adminLog(me, 'boost arrêté', '-'); ar(true, 'Boost arrêté.'); send(ws, admState()); return; }
          const r = setBoost(msg.xp, msg.drop, msg.minutes, msg.label); if (!r.ok) { ar(false, r.error); return; }
          sendEveryone({ t: 'world:boost', ...r.boost, left: r.boost.until - Date.now() }); bannerAll({ kind: 'event', icon: '✨', text: r.boost.label, sub: `XP ×${r.boost.xp} · Butin ×${r.boost.drop} · pendant ${Math.round((r.boost.until - Date.now()) / 60000)} min`, secs: 10 }); broadcastAll({ t: 'system', text: `✨ ${r.boost.label} : XP ×${r.boost.xp}, butin ×${r.boost.drop} pendant ${Math.round((r.boost.until - Date.now()) / 60000)} min !` });
          await adminLog(me, 'boost', '-', `XP×${r.boost.xp} butin×${r.boost.drop} ${msg.minutes} min`); ar(true, 'Boost lancé pour tous les joueurs.'); send(ws, admState()); return;
        }
        if (msg.t === 'adm:spawn') {
          const id = String(msg.enemy || ''); if (!ENEMY_IDS.has(id)) { ar(false, 'Monstre inconnu.'); return; }
          const count = Math.min(30, Math.max(1, Math.floor(Number(msg.count) || 1)));
          let targets;
          if (msg.target && msg.target !== '*') { const tk = resolveAccount(sanitizeUsername(msg.target)); targets = tk ? [...(acctWs.get(tk) || [])] : []; if (!targets.length) { ar(false, 'Ce joueur n\u2019est pas en ligne.'); return; } }
          else targets = [...players.values()].map((p) => p.ws);
          if (!targets.length) { ar(false, 'Personne n\u2019est en ligne.'); return; }
          const label = sanitize(msg.label, 50).trim();
          for (const w of new Set(targets)) send(w, { t: 'world:spawn', enemy: id, count, label, boss: !!msg.boss });
          await adminLog(me, 'invasion', msg.target && msg.target !== '*' ? msg.target : 'tous', `${count}× ${id}`);
          ar(true, `${count}× ${ENEMY_LIST.find((e) => e.id === id)?.name || id} envoyé(s) chez ${new Set(targets).size} joueur(s).`); return;
        }
        if (msg.t === 'adm:giftAll') {
          const l = Math.floor(Number(msg.lunes)); if (!(l >= 1 && l <= 5000)) { ar(false, 'Cadeau : entre 1 et 5 000 Lunes par joueur.'); return; }
          const names = new Set(); for (const [k] of acctWs) names.add(k);
          for (const k of names) { const a = accounts[k]; if (!a) continue; ensureShop(a).gems += l; for (const w of acctWs.get(k) || []) { send(w, shopView(a)); send(w, { t: 'system', text: `🎁 Cadeau du créateur : +${l} Lunes !${msg.text ? ' ' + sanitize(msg.text, 80) : ''}` }); send(w, { t: 'banner', kind: 'event', icon: '🎁', text: `+${l} Lunes offertes !`, sub: msg.text ? sanitize(msg.text, 80) : 'Cadeau du créateur', secs: 8 }); } }
          await persistAccounts(accounts); await adminLog(me, 'cadeau à tous les connectés', `${names.size} comptes`, `+${l} Lunes`); ar(true, `+${l} Lunes offertes à ${names.size} joueur(s) connecté(s).`); return;
        }
        if (msg.t === 'adm:codes') { send(ws, { t: 'adm:codes', list: codeList() }); return; }
        if (msg.t === 'adm:codeNew') { const r = createCode(msg.code, msg.lunes, msg.uses, msg.days); ar(r.ok, r.ok ? `Code ${r.code} créé.` : r.error); if (r.ok) { await adminLog(me, 'code cadeau créé', r.code, `${msg.lunes} Lunes ×${msg.uses}`); send(ws, { t: 'adm:codes', list: codeList() }); } return; }
        if (msg.t === 'adm:codeOff') { stopCode(msg.code); await adminLog(me, 'code cadeau désactivé', String(msg.code)); send(ws, { t: 'adm:codes', list: codeList() }); ar(true, 'Code désactivé.'); return; }
        if (msg.t === 'adm:whisper' || msg.t === 'adm:mute') {
          const [k2, a2] = target(); if (!k2) { ar(false, 'Compte introuvable.'); return; }
          if (msg.t === 'adm:whisper') { const tx = sanitize(msg.text, 200).trim(); if (tx.length < 2) { ar(false, 'Message trop court.'); return; } const ws2 = acctWs.get(k2); if (!ws2) { ar(false, 'Ce joueur n\u2019est pas en ligne.'); return; } for (const w of ws2) { send(w, { t: 'system', text: '📣 Message du créateur : ' + tx }); send(w, { t: 'banner', kind: 'message', icon: '📣', text: tx, sub: 'Message du créateur', secs: 10 }); } await adminLog(me, 'message privé', k2, tx); ar(true, `Message envoyé à ${k2}.`); return; }
          if (isOwnerKey(k2)) { ar(false, 'Impossible de faire taire un créateur.'); return; }
          const mins = Math.min(7 * 1440, Math.max(0, Math.floor(Number(msg.minutes) || 0)));
          if (mins) a2.mutedUntil = Date.now() + mins * 60000; else delete a2.mutedUntil;
          await persistAccounts(accounts); await adminLog(me, mins ? 'joueur muet' : 'joueur de nouveau audible', k2, mins ? mins + ' min' : '');
          for (const w of acctWs.get(k2) || []) send(w, { t: 'system', text: mins ? `🔇 Tu as été réduit au silence pour ${mins} min.` : '🔊 Tu peux de nouveau parler.' });
          ar(true, mins ? `${k2} est muet pendant ${mins} min.` : `${k2} peut de nouveau parler.`); return;
        }
        if (msg.t === 'adm:inbox') { send(ws, { t: 'adm:inbox', ...supInbox(accounts) }); return; }
        if (msg.t === 'adm:log') { send(ws, { t: 'adm:log', list: await readLog(40) }); return; }
        if (msg.t === 'adm:announce') {
          const text = sanitize(msg.text, 200).trim();
          if (text.length < 3) { ar(false, 'Message trop court.'); return; }
          sendEveryone({ t: 'system', text: '📢 ' + text }); bannerAll({ kind: 'announce', icon: '📢', text, secs: Math.min(30, Math.max(4, Math.floor(Number(msg.secs) || 8))) }); await adminLog(me, 'annonce', '-', text); ar(true, `Annonce envoyée à ${players.size} joueur(s) connecté(s).`); return;
        }
        const [k, a] = target();
        if (!k) { ar(false, 'Compte introuvable.'); return; }
        const row = () => send(ws, { t: 'adm:row', row: accSummary(k, a, online(k)) });
        if (msg.t === 'adm:reset') {
          const temp = await resetPassword(a); await persistAccounts(accounts); await adminLog(me, 'mot de passe réinitialisé', k);
          for (const w of acctWs.get(k) || []) send(w, { t: 'system', text: 'Ton mot de passe a été réinitialisé par le créateur : reconnecte-toi.' });
          ar(true, `Mot de passe temporaire de ${k} : ${temp} — donne-le au joueur, il pourra le changer dans « Sécurité du compte ».`, { temp }); row(); return;
        }
        if (msg.t === 'adm:lunes') {
          const r = giveLunes(a, msg.delta); if (!r.ok) { ar(false, r.error); return; }
          await persistAccounts(accounts); await adminLog(me, 'Lunes', k, `${r.delta > 0 ? '+' : ''}${r.delta} → ${r.gems}`);
          for (const w of acctWs.get(k) || []) send(w, shopView(a));
          ar(true, `${k} : ${r.delta > 0 ? '+' : ''}${r.delta} Lunes (total ${r.gems}).`); row(); return;
        }
        if (msg.t === 'adm:ban') {
          if (isOwnerKey(k)) { ar(false, 'Impossible de bloquer un compte créateur.'); return; }
          if (msg.on) { a.ban = { reason: sanitize(msg.reason, 80).trim(), at: Date.now() }; for (const w of [...(acctWs.get(k) || [])]) { send(w, { t: 'system', text: banText(a) }); try { w.close(1008, 'suspendu'); } catch { /* ignoré */ } } }
          else delete a.ban;
          await persistAccounts(accounts); await adminLog(me, msg.on ? 'compte bloqué' : 'compte débloqué', k, a.ban?.reason || '');
          ar(true, msg.on ? `${k} est bloqué et déconnecté.` : `${k} est débloqué.`); row(); return;
        }
        if (msg.t === 'adm:kick') {
          for (const w of [...(acctWs.get(k) || [])]) { send(w, { t: 'system', text: 'Tu as été déconnecté par le créateur.' }); try { w.close(1000, 'kick'); } catch { /* ignoré */ } }
          await adminLog(me, 'déconnecté', k); ar(true, `${k} déconnecté.`); row(); return;
        }
        if (msg.t === 'adm:thread') { send(ws, { t: 'adm:thread', account: k, msgs: supThread(a) }); return; }
        if (msg.t === 'adm:reply') {
          const r = supAdd(a, 'a', msg.text); if (!r.ok) { ar(false, r.error); return; }
          await persistAccounts(accounts); await adminLog(me, 'réponse support', k);
          for (const w of acctWs.get(k) || []) { send(w, { t: 'support', ...supView(a) }); const n = supNotify(a); if (n) send(w, n); }
          send(ws, { t: 'adm:thread', account: k, msgs: supThread(a) }); ar(true, `Réponse envoyée à ${k}.`); return;
        }
        if (msg.t === 'adm:info') { row(); return; }
      })().catch((e) => { console.error('[Korvalune] admin :', e.message); ar(false, 'Erreur serveur.'); });
      return;
    }

    // --- Boutique des Lunes (V10.1) ---
    if (msg.t.startsWith('shop:')) {
      if (!shopLimiter.allow()) return;
      const key = authUsername && resolveAccount(authUsername);
      if (!key) { send(ws, { t: 'shop:msg', ok: false, text: 'Connecte-toi à ton compte pour utiliser la boutique.' }); return; }
      const acc = ensureChars(accounts[key]);
      const reply = (r, okText) => { send(ws, { t: 'shop:msg', ok: !!r.ok, text: r.ok ? okText : r.error }); send(ws, shopView(acc)); };
      if (msg.t === 'shop:get') { send(ws, shopView(acc)); return; }
      if (msg.t === 'shop:code') {
        if (!codeLimiter.hit(key)) { send(ws, { t: 'shop:msg', ok: false, text: 'Trop d\u2019essais : réessaie dans quelques minutes.' }); return; }
        const r = redeemCode(acc, key, msg.code);
        if (r.ok) { persistAccounts(accounts); console.log(`[Korvalune] code cadeau utilisé : ${key} +${r.lunes}`); }
        reply(r, `🎁 Code validé : +${r.lunes} Lunes !`); return;
      }
      // V10.55 — dons PayPal : le donateur déclare son don, le créateur (OWNER_ACCOUNTS) le valide après l'avoir reçu sur PayPal
      if (msg.t === 'shop:donate') {
        const r = requestDonation(acc, msg.amount, msg.note);
        if (r.ok) { persistAccounts(accounts); console.log(`[Korvalune] don déclaré : ${key} ${msg.amount} €`); }
        reply(r, `Merci ! Ton don de ${Number(msg.amount)} € est signalé au créateur : dès qu'il l'a reçu, tu recevras ${r.lunes} Lunes de remerciement.`);
        return;
      }
      if (msg.t === 'shop:donAdmin') {
        if (!isOwnerKey(key)) { send(ws, { t: 'shop:msg', ok: false, text: 'Réservé au créateur.' }); return; }
        send(ws, { t: 'shop:donList', list: pendingDonations(accounts) });
        return;
      }
      if (msg.t === 'shop:donResolve') {
        if (!isOwnerKey(key)) { send(ws, { t: 'shop:msg', ok: false, text: 'Réservé au créateur.' }); return; }
        const tk = resolveAccount(sanitizeUsername(msg.account));
        if (!tk) { send(ws, { t: 'shop:msg', ok: false, text: 'Compte introuvable.' }); return; }
        const tacc = ensureChars(accounts[tk]);
        const r = resolveDonation(tacc, String(msg.id || ''), msg.ok === true, msg.amount);
        if (r.ok) {
          persistAccounts(accounts); console.log(`[Korvalune] don ${r.refused ? 'refusé' : 'validé'} : ${tk}${r.refused ? '' : ` +${r.lunes} Lunes (${r.amount} €)`} par ${key}`);
          for (const w of acctWs.get(tk) || []) { send(w, shopView(tacc)); send(w, { t: 'shop:msg', ok: !r.refused, text: r.refused ? 'Ton don n\u2019a pas pu être confirmé : contacte le créateur si c\u2019est une erreur.' : `Merci pour ton don ! +${r.lunes} Lunes de remerciement ont été ajoutées.` }); }
        }
        send(ws, { t: 'shop:msg', ok: !!r.ok, text: r.ok ? (r.refused ? 'Demande refusée.' : `Validé : +${r.lunes} Lunes pour ${tk}.`) : r.error });
        send(ws, { t: 'shop:donList', list: pendingDonations(accounts) });
        return;
      }
      if (msg.t === 'shop:buy') { const r = shopBuy(acc, msg.id); if (r.ok) persistAccounts(accounts); reply(r, r.ok ? `Acheté : ${r.item.name}` : ''); return; }
      if (msg.t === 'shop:equip') { const r = shopEquip(acc, msg.slot, msg.id ?? null); if (r.ok) { persistAccounts(accounts); for (const p of players.values()) if (p.account === key) { p.cos = publicCos(acc); broadcastAll({ t: 'playerCos', id: p.id, cos: p.cos }, p.id); } } reply(r, msg.id ? 'Équipé.' : 'Retiré.'); return; }
      if (msg.t === 'shop:daily') { const r = claimDaily(acc); if (r.ok) persistAccounts(accounts); reply(r, r.ok ? `+${r.amount} Lunes : récompense quotidienne !` : ''); return; }
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
        inst: 0, account: authUsername,
        cos: authUsername && accounts[authUsername] ? publicCos(accounts[authUsername]) : {},
        app: msg.app ? sanitizeAppearance(msg.app) : null // V10.12 : apparence visible des autres joueurs
      };
      players.set(id, player);
      send(ws, { t: 'welcome', id, players: [...players.values()].filter((p) => p.id !== id).map(playerSummary) });
      broadcastAll({ t: 'playerJoined', player: playerSummary(player) }, id);
      broadcastAll({ t: 'system', text: `${player.name} a rejoint Korvalune.` }, id);
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
      player.mnt = isMountId(msg.mnt) ? msg.mnt : '';
      broadcastAll({ t: 'playerMoved', id: player.id, pos: player.pos, yaw: player.yaw, anim: player.anim, hp: player.hp, maxHp: player.maxHp, level: player.level, inst: player.inst | 0, mnt: player.mnt }, player.id);
      const gid = groupOf(player.id);
      if (gid) broadcastGroupUpdate(gid, instChanged);
      return;
    }

    // --- V10.12 : nouvelle apparence (barbier) ---
    if (msg.t === 'look') {
      if (!chatLimiter.allow()) return;
      player.app = sanitizeAppearance(msg.app);
      broadcastAll({ t: 'playerLook', id: player.id, app: player.app }, player.id);
      return;
    }

    // --- Chat ---
    if (msg.t === 'chat') {
      if (!chatLimiter.allow()) return;
      { const ma = authUsername && accounts[authUsername]; if (ma && ma.mutedUntil > Date.now()) { send(ws, { t: 'system', text: `🔇 Tu es réduit au silence encore ${Math.ceil((ma.mutedUntil - Date.now()) / 60000)} min.` }); return; } }
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
    // --- Échanges d'objets (V10.9) ---
    if (msg.t.startsWith('trade:')) {
      const sys = (text) => send(ws, { t: 'system', text });
      if (!tradeLimiter.allow()) return;
      if (msg.t === 'trade:invite') {
        if (!player.account) { sys('Connecte-toi à ton compte pour échanger.'); return; }
        const target = (typeof msg.id === 'string' && players.get(msg.id)) || findByName(sanitize(msg.to, MAX_NAME_LEN));
        if (!target || target.id === player.id) { sys(`Joueur introuvable : ${msg.to || ''}`); return; }
        if (!target.account) { sys(`${target.name} n'est pas connecté à un compte : échange impossible.`); return; }
        if (tradeOf.has(player.id)) { sys('Tu es déjà en train d\u2019échanger.'); return; }
        if (tradeOf.has(target.id) || pendingTrade.has(target.id)) { sys(`${target.name} est occupé.`); return; }
        pendingTrade.set(target.id, { from: player.id, t: Date.now() });
        send(target.ws, { t: 'trade:invited', from: player.name });
        sys(`Proposition d'échange envoyée à ${target.name}.`);
        return;
      }
      if (msg.t === 'trade:accept' || msg.t === 'trade:decline') {
        const pe = pendingTrade.get(player.id); pendingTrade.delete(player.id);
        const from = pe && players.get(pe.from);
        if (!from || Date.now() - pe.t > 30000) { sys('Proposition expirée.'); return; }
        if (msg.t === 'trade:decline') { send(from.ws, { t: 'system', text: `${player.name} refuse l'échange.` }); return; }
        if (tradeOf.has(from.id) || tradeOf.has(player.id)) { sys('Échange impossible : un des joueurs est occupé.'); return; }
        const tid = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const tr = { a: from.id, b: player.id, off: { a: [], b: [] }, ok: { a: false, b: false }, ack: {}, phase: 'edit', t: Date.now() };
        trades.set(tid, tr); tradeOf.set(from.id, tid); tradeOf.set(player.id, tid);
        for (const p of [from, player]) send(p.ws, { t: 'trade:open' });
        pushTrade(tr);
        return;
      }
      const tid = tradeOf.get(player.id), tr = tid && trades.get(tid);
      if (!tr) return;
      const me = sideOf(tr, player.id), ot = me === 'a' ? 'b' : 'a', other = players.get(tr[ot]);
      if (msg.t === 'trade:cancel') { endTrade(player.id, `${player.name} a annulé l'échange.`); return; }
      if (!other) { endTrade(player.id, 'L\u2019autre joueur est parti : échange annulé.'); return; }
      if (msg.t === 'trade:offer') {
        if (tr.phase !== 'edit') return;
        const items = (noCosmetics(sanitizeItemSlots(Array.isArray(msg.items) ? msg.items.slice(0, TRADE_MAX_ITEMS) : [], TRADE_MAX_ITEMS, sanitize)) || []).filter(Boolean)
          .filter((it) => { const o = it.gen && itemOwner.get(itemKey(it.gen)); return !o || o === player.account; }); // V10.51 : on n'offre pas l'objet d'un autre compte
        tr.off[me] = items; tr.ok = { a: false, b: false }; tr.t = Date.now();
        pushTrade(tr);
        return;
      }
      if (msg.t === 'trade:confirm') {
        if (tr.phase !== 'edit') return;
        if (!tr.off.a.length && !tr.off.b.length) { sys('Ajoute au moins un objet à l\u2019échange.'); return; }
        tr.ok[me] = true;
        if (tr.ok.a && tr.ok.b) {
          tr.phase = 'exec'; tr.ack = {}; tr.t = Date.now();
          for (const s of ['a', 'b']) { const p = players.get(tr[s]); if (p) send(p.ws, { t: 'trade:exec', give: tr.off[s], get: tr.off[s === 'a' ? 'b' : 'a'] }); }
        }
        pushTrade(tr);
        return;
      }
      if (msg.t === 'trade:ack') {
        if (tr.phase !== 'exec') return;
        if (!msg.ok) { endTrade(player.id, 'Échange impossible (objet manquant ou inventaire plein) : rien n\u2019a été échangé.'); return; }
        tr.ack[me] = true;
        if (tr.ack.a && tr.ack.b) {
          { // V10.51 : le serveur change le propriétaire des objets échangés (l'ancien propriétaire perd la copie à sa prochaine sauvegarde)
            const pa = players.get(tr.a), pb = players.get(tr.b);
            if (pa?.account && pb?.account) {
              for (const it of tr.off.a) if (it.gen) noteTransfer(itemKey(it.gen), pb.account);
              for (const it of tr.off.b) if (it.gen) noteTransfer(itemKey(it.gen), pa.account);
              saveTransfers();
            }
          }
          for (const s of ['a', 'b']) { const p = players.get(tr[s]); if (p) send(p.ws, { t: 'trade:final', give: tr.off[s], get: tr.off[s === 'a' ? 'b' : 'a'] }); }
          console.log(`[Korvalune] échange : ${players.get(tr.a)?.name} (${tr.off.a.length}) <-> ${players.get(tr.b)?.name} (${tr.off.b.length})`);
          trades.delete(tid); tradeOf.delete(tr.a); tradeOf.delete(tr.b);
        }
        return;
      }
      return;
    }
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
      if (!HOST_ONLY.has(k) && !GUEST_ONLY.has(k) && k !== 'hit' && k !== 'rift' && k !== 'tp') return;
      let body; try { body = JSON.stringify(msg.d ?? {}); } catch { return; }
      if (body.length > 12000) return;
      const room = player.inst | 0;
      const host = roomHost(gid, room);
      if (HOST_ONLY.has(k) && player.id !== host) return;
      if (GUEST_ONLY.has(k) && player.id === host) return;
      const out = `{"t":"gr","k":${JSON.stringify(k)},"from":${JSON.stringify(player.id)},"d":${body}}`;
      const sendRaw = (p) => { if (p && p.ws.readyState === p.ws.OPEN) p.ws.send(out); };
      if (k === 'rift' || k === 'tp') { // annonce « j'entre dans une spire » : à tout le groupe, quelle que soit la salle
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
    endTrade(player.id, 'L\u2019autre joueur s\u2019est déconnecté : échange annulé.'); pendingTrade.delete(player.id);
    disbandOrLeave(player.id);
    players.delete(player.id);
    pendingInvites.delete(player.id);
    for (const [id, inv] of pendingInvites) if (inv === player.id) pendingInvites.delete(id);
    broadcastAll({ t: 'playerLeft', id: player.id });
    broadcastAll({ t: 'system', text: `${player.name} a quitté Korvalune.` });
  });

  ws.on('error', () => {});
});
