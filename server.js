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
import { loadSecret, makeToken, verifyToken, KeyedLimiter } from './server/security.js';
import { isMountId, MAX_MOUNTS } from './src/data/mounts.js';
import { normalizeLook, sanitizeAppearance } from './src/data/looks.js';
import { RateLimiter } from './server/rateLimit.js';
import { sanitizeGeneratedItem, sanitizeItemSlots, sanitizeCubePowers } from './server/itemValidate.js';
import { createCheckout, verifySignature, payEnabled, PACK_BY_ID } from './server/payments.js';
import { passView, addEvents as passEvents, claim as passClaim, claimAll as passClaimAll, missionClaim as passMission, buyPremium as passBuyPremium, buyTier as passBuyTier } from './server/pass.js';
import { ensureEvent, eventView, collect as evCollect, kill as evKill, daily as evDaily, buy as evBuy, top as evTop } from './server/event.js';
import { CATALOG_BY_ID as COSMETICS_BY_ID } from './src/data/shopCatalog.js';
import { cleanPotions } from './src/data/potions.js';
import { cleanSatchel, SATCHEL_MAX } from './src/data/satchel.js';
import { cleanZenith } from './src/data/zenith.js';
import { riftBoard } from './server/riftBoard.js';
import { cleanRanks, setSkillTable } from './src/combat/SkillRanks.js';
import { readFileSync } from 'node:fs';
setSkillTable(Object.fromEntries(JSON.parse(readFileSync(new URL('./src/data/skills.json', import.meta.url), 'utf8')).map((s) => [s.id, s])));
import { creditPayment, ensureShop, shopView, buy as shopBuy, equip as shopEquip, claimDaily, levelReward, publicCos, bankCapOf } from './server/shop.js';

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
const resolveAccount = (name) => lcIndex.get(String(name).toLowerCase()) ?? null;
const regLimiter = new KeyedLimiter(4, 10 * 60 * 1000);     // créations de compte par IP
const loginLimiter = new KeyedLimiter(15, 60 * 1000);       // tentatives de connexion par IP
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

// ---- V10.2 : API paiements (Stripe Checkout) ----
const checkoutLimiter = new KeyedLimiter(8, 10 * 60 * 1000); // créations de sessions de paiement par IP
const readBody = (req, max = 65536) => new Promise((resolve, reject) => {
  let n = 0; const ch = [];
  req.on('data', (c) => { n += c.length; if (n > max) { reject(new Error('corps trop grand')); req.destroy(); } else ch.push(c); });
  req.on('end', () => resolve(Buffer.concat(ch).toString('utf8')));
  req.on('error', reject);
});
const jsonOut = (res, base, code, obj) => { const b = Buffer.from(JSON.stringify(obj)); res.writeHead(code, { ...base, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }); res.end(b); };
async function handleApi(req, res, base) {
  let url; try { url = new URL(req.url, 'http://x'); } catch { return jsonOut(res, base, 400, { error: 'requête invalide' }); }
  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    if (!payEnabled()) return jsonOut(res, base, 503, { error: 'Les paiements ne sont pas activés.' });
    if (!checkoutLimiter.hit(ipOf(req))) return jsonOut(res, base, 429, { error: 'Trop de tentatives, réessaie dans quelques minutes.' });
    let body; try { body = JSON.parse(await readBody(req, 4096)); } catch { return jsonOut(res, base, 400, { error: 'requête invalide' }); }
    const key = resolveAccount(verifyToken(SECRET, body?.token) || '');
    if (!key) return jsonOut(res, base, 401, { error: 'Session expirée — reconnecte-toi.' });
    if (body.consent !== true) return jsonOut(res, base, 400, { error: 'Tu dois accepter les conditions de vente et la livraison immédiate.' });
    if (!PACK_BY_ID[typeof body.pack === 'string' ? body.pack : '']) return jsonOut(res, base, 400, { error: 'Pack inconnu.' });
    try { const r = await createCheckout({ account: key, packId: body.pack, consentAt: new Date().toISOString() }); return jsonOut(res, base, 200, { url: r.url }); }
    catch (e) { console.error('[Korvalune] checkout :', e.message); return jsonOut(res, base, 502, { error: 'Le service de paiement est indisponible, réessaie plus tard.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/stripe-webhook') {
    if (!payEnabled()) return jsonOut(res, base, 503, { error: 'désactivé' });
    let raw; try { raw = await readBody(req); } catch { return jsonOut(res, base, 400, { error: 'corps invalide' }); }
    if (!verifySignature(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) return jsonOut(res, base, 400, { error: 'signature invalide' });
    let ev; try { ev = JSON.parse(raw); } catch { return jsonOut(res, base, 400, { error: 'JSON invalide' }); }
    if (ev?.type === 'checkout.session.completed' || ev?.type === 'checkout.session.async_payment_succeeded') {
      const session = ev.data?.object;
      const key = resolveAccount(String(session?.metadata?.account || ''));
      if (!key) { console.error('[Korvalune] paiement reçu pour un compte introuvable :', session?.id); return jsonOut(res, base, 200, { received: true, ignored: 'compte introuvable' }); }
      const acc = ensureChars(accounts[key]);
      const r = creditPayment(acc, session);
      if (r.ok && !r.duplicate) {
        await persistAccounts(accounts); // sauvegardé AVANT de répondre 200 à Stripe
        console.log(`[Korvalune] paiement crédité : ${key} +${r.lunes} Lunes (${session.id})`);
        for (const w of acctWs.get(key) || []) { send(w, shopView(acc)); send(w, { t: 'shop:msg', ok: true, text: `Merci ! +${r.lunes} Lunes ajoutées à ton compte.` }); }
      } else if (!r.ok) console.warn('[Korvalune] paiement non crédité :', r.reason, session?.id);
    }
    return jsonOut(res, base, 200, { received: true });
  }
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
const accView = (acc) => { ensureChars(acc); return { chars: acc.chars, bank: acc.sharedBank, save: acc.chars.find(Boolean) || null }; };

function sanitizeSave(prev, incoming, elapsedMs) {
  if (!incoming || typeof incoming !== 'object') return null;
  const elapsedMin = Math.max(1, elapsedMs / 60000);
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
  clean.level = Math.max(prevLevel, Math.min(wantLevel, prevLevel + 10, 200)); // jamais de retour en arrière, +10 niveaux max par sauvegarde

  clean.xp = Number.isFinite(incoming.xp) ? Math.max(0, Math.floor(incoming.xp)) : 0;
  clean.statPoints = Number.isFinite(incoming.statPoints) ? Math.max(0, Math.min(500, Math.floor(incoming.statPoints))) : (prev?.statPoints ?? 0);

  const prevCoins = prev?.coins ?? 0;
  const wantCoins = Number.isFinite(incoming.coins) ? Math.floor(incoming.coins) : prevCoins;
  // V10.21 : les ventes d'objets (valeurs très élevées en haute rareté) ne doivent pas être rabotées par le plafond
  // de gains par minute : le client tient un compteur cumulé `soldTotal` (monotone), seule la hausse est acceptée.
  const prevSold = Math.max(0, Math.floor(prev?.soldTotal ?? 0));
  const wantSold = Number.isFinite(incoming.soldTotal) ? Math.max(prevSold, Math.floor(incoming.soldTotal)) : prevSold;
  const saleAllow = Math.min(wantSold - prevSold, 50000000);
  clean.soldTotal = prevSold + saleAllow;
  const coinCap = prevCoins + Math.ceil(4000 * elapsedMin) + saleAllow; // plafond généreux mais fini
  clean.coins = Math.max(0, Math.min(wantCoins, coinCap, 99999999));

  clean.stats = {};
  for (const k of ['str', 'agi', 'int', 'vit', 'spi', 'luck']) {
    const v = incoming.stats?.[k];
    clean.stats[k] = Number.isFinite(v) ? Math.max(0, Math.min(999, Math.floor(v))) : (prev?.stats?.[k] ?? 5);
  }
  clean.hp = Number.isFinite(incoming.hp) ? Math.max(0, incoming.hp) : (prev?.hp ?? 100);
  clean.mana = Number.isFinite(incoming.mana) ? Math.max(0, incoming.mana) : (prev?.mana ?? 50);

  clean.active = Array.isArray(incoming.active) ? incoming.active.slice(0, 40).map((s) => sanitize(s, 60)) : [];
  clean.completed = Array.isArray(incoming.completed) ? incoming.completed.slice(0, 400).map((s) => sanitize(s, 60)) : [];
  // V10.10 : montures de l'écurie (identifiants du catalogue uniquement)
  clean.mounts = [...new Set((Array.isArray(incoming.mounts) ? incoming.mounts : []).filter(isMountId))].slice(0, MAX_MOUNTS);
  clean.difficulty = Number.isInteger(incoming.difficulty) ? Math.max(0, Math.min(7, incoming.difficulty)) : (prev?.difficulty | 0); // V10.18
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
      pushShop(); pushSettings();
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
        pushShop(); pushSettings();
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
      const acc = ensureChars(accounts[username]);
      const slot = Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < MAX_CHARS ? msg.slot : 0;
      const prevChar = acc.chars[slot];
      const elapsed = Date.now() - (acc.charSaveAt[slot] || 0);
      const clean = sanitizeSave(prevChar, msg.data, elapsed);
      if (!clean) { send(ws, { t: 'saveAck', ok: false, error: 'Données de sauvegarde invalides.' }); return; }
      // le coffre est partagé par tous les personnages du compte
      const bank = sanitizeItemSlots(msg.data?.bank, bankCapOf(acc), sanitize);
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

    // --- Boutique des Lunes (V10.1) ---
    if (msg.t.startsWith('shop:')) {
      if (!shopLimiter.allow()) return;
      const key = authUsername && resolveAccount(authUsername);
      if (!key) { send(ws, { t: 'shop:msg', ok: false, text: 'Connecte-toi à ton compte pour utiliser la boutique.' }); return; }
      const acc = ensureChars(accounts[key]);
      const reply = (r, okText) => { send(ws, { t: 'shop:msg', ok: !!r.ok, text: r.ok ? okText : r.error }); send(ws, shopView(acc)); };
      if (msg.t === 'shop:get') { send(ws, shopView(acc)); return; }
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
        const items = (noCosmetics(sanitizeItemSlots(Array.isArray(msg.items) ? msg.items.slice(0, TRADE_MAX_ITEMS) : [], TRADE_MAX_ITEMS, sanitize)) || []).filter(Boolean);
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
