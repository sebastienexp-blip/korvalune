// Construit le serveur Discord Korvalune d'après blueprint.mjs. Sûr à relancer : ne supprime rien, ne recrée pas ce qui existe.
// Variables : DISCORD_BOT_TOKEN, DISCORD_GUILD_ID (jamais écrits dans le dépôt). DISCORD_API : adresse de l'API (tests).
import { ROLES, CATEGORIES, MESSAGES, STAFF } from './blueprint.mjs';

const API = process.env.DISCORD_API || 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_BOT_TOKEN, GUILD = process.env.DISCORD_GUILD_ID;
if (!TOKEN || !GUILD) { console.error('Il manque DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID (secrets du dépôt GitHub).'); process.exit(1); }

const P = { VIEW: 1n << 10n, SEND: 1n << 11n, REACT: 1n << 6n, CONNECT: 1n << 20n, SPEAK: 1n << 21n, HISTORY: 1n << 16n, THREADS: 1n << 35n };
const ROLE_PERMS = { ADMINISTRATOR: 1n << 3n, KICK: 1n << 1n, BAN: 1n << 2n, MANAGE_MESSAGES: 1n << 13n, MODERATE_MEMBERS: 1n << 40n, VIEW_AUDIT_LOG: 1n << 7n, MUTE_MEMBERS: 1n << 22n, MOVE_MEMBERS: 1n << 24n, MANAGE_NICKNAMES: 1n << 27n, MENTION_EVERYONE: 1n << 17n };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body, tries = 0) {
  const r = await fetch(API + path, { method, headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'KorvaluneSetup (korvalune, 1.0)' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 429 && tries < 6) { const j = await r.json().catch(() => ({})); await sleep(Math.ceil((j.retry_after || 1) * 1000) + 200); return call(method, path, body, tries + 1); }
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* ignoré */ }
  if (!r.ok) { const e = new Error(`${method} ${path} → ${r.status} ${data?.message || text.slice(0, 120)}`); e.status = r.status; throw e; }
  await sleep(250); // reste loin des limites de débit
  return data;
}

const me = await call('GET', '/users/@me'); console.log('Bot connecté :', me.username);
const roles = new Map((await call('GET', `/guilds/${GUILD}/roles`)).map((r) => [r.name, r]));
const chans = await call('GET', `/guilds/${GUILD}/channels`);
const find = (name, type, parent) => chans.find((c) => c.name === name && c.type === type && (parent === undefined || c.parent_id === parent));

// ---- rôles ----
for (const def of ROLES) {
  if (roles.has(def.name)) { console.log('= rôle existant :', def.name); continue; }
  const perms = def.perms.reduce((a, k) => a | ROLE_PERMS[k], 0n);
  const r = await call('POST', `/guilds/${GUILD}/roles`, { name: def.name, color: def.color, hoist: !!def.hoist, mentionable: !!def.mentionable, permissions: perms.toString() });
  roles.set(def.name, r); console.log('+ rôle créé :', def.name);
}
const rid = (n) => roles.get(n)?.id;
const everyone = GUILD;
const staffIds = STAFF.map(rid).filter(Boolean);
const guide = rid('🤝 Guide');

function overwrites(access, readonly, voice) {
  const ow = [];
  const allow = (id, bits) => ow.push({ id, type: 0, allow: bits.toString(), deny: '0' });
  const base = P.VIEW | P.HISTORY | P.REACT;
  if (access === 'public') {
    ow.push({ id: everyone, type: 0, allow: '0', deny: readonly ? (P.SEND | P.THREADS).toString() : '0' });
  } else {
    const who = access === 'testeurs' ? rid('🧪 Testeur') : access === 'mecenes' ? rid('💛 Mécène') : null;
    ow.push({ id: everyone, type: 0, allow: '0', deny: P.VIEW.toString() });
    if (who) allow(who, readonly ? base : base | P.SEND);
  }
  for (const id of staffIds) allow(id, base | P.SEND | P.CONNECT | P.SPEAK);
  ow.push({ id: me.id, type: 1, allow: (base | P.SEND | P.CONNECT | P.SPEAK).toString(), deny: '0' }); // le bot doit pouvoir publier dans les salons en lecture seule
  if (guide && access === 'public') allow(guide, base | P.SEND);
  return ow;
}

// ---- catégories et salons ----
const made = {};
for (const cat of CATEGORIES) {
  let parent = find(cat.name, 4);
  if (!parent) { parent = await call('POST', `/guilds/${GUILD}/channels`, { name: cat.name, type: 4, permission_overwrites: overwrites(cat.access, false) }); chans.push(parent); console.log('+ catégorie :', cat.name); }
  for (const ch of cat.channels) {
    const type = ch.voice ? 2 : 0;
    let c = find(ch.name, type, parent.id);
    if (!c) {
      const body = { name: ch.name, type, parent_id: parent.id, permission_overwrites: overwrites(cat.access, !!ch.readonly, !!ch.voice) };
      if (!ch.voice) { body.topic = ch.topic || ''; if (ch.slow) body.rate_limit_per_user = ch.slow; } else if (ch.limit) body.user_limit = ch.limit;
      c = await call('POST', `/guilds/${GUILD}/channels`, body); chans.push(c); console.log('+ salon :', ch.name);
    } else console.log('= salon existant :', ch.name);
    made[ch.name] = { c, def: ch };
  }
}

// ---- messages d'accueil (seulement dans un salon encore vide) ----
const idOf = (frag) => Object.values(made).find((m) => m.def.name.includes(frag))?.c.id;
const REF = { RULES: idOf('règlement'), INTRO: idOf('présentations'), BEGINNERS: idOf('aide-débutants'), BUGS: idOf('bugs'), SUPPORT: idOf('aide-technique') };
for (const { c, def } of Object.values(made)) {
  for (const key of def.post || []) {
    const hist = await call('GET', `/channels/${c.id}/messages?limit=1`).catch(() => [1]);
    if (hist.length) { console.log('= messages déjà présents :', def.name); break; }
    for (const text of MESSAGES[key]) await call('POST', `/channels/${c.id}/messages`, { content: text.replace(/<#(\w+)>/g, (m, k) => (REF[k] ? `<#${REF[k]}>` : '')) });
    console.log('+ message publié :', def.name);
  }
}

// ---- modération automatique (facultative : ignorée si le serveur ne l'autorise pas) ----
try {
  const rules = await call('GET', `/guilds/${GUILD}/auto-moderation/rules`);
  const exempt = staffIds;
  if (!rules.some((r) => r.name === 'Korvalune : spam de mentions')) {
    await call('POST', `/guilds/${GUILD}/auto-moderation/rules`, { name: 'Korvalune : spam de mentions', event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 6 }, actions: [{ type: 1 }], enabled: true, exempt_roles: exempt });
    console.log('+ modération auto : spam de mentions');
  }
  if (!rules.some((r) => r.name === 'Korvalune : liens d’invitation')) {
    await call('POST', `/guilds/${GUILD}/auto-moderation/rules`, { name: 'Korvalune : liens d’invitation', event_type: 1, trigger_type: 1, trigger_metadata: { regex_patterns: ['(discord\\.gg|discord(app)?\\.com/invite)/\\w+'] }, actions: [{ type: 1, metadata: { custom_message: 'Les liens d’invitation vers d’autres serveurs sont interdits ici.' } }], enabled: true, exempt_roles: exempt });
    console.log('+ modération auto : liens d’invitation');
  }
} catch (e) { console.log('(modération automatique ignorée :', e.message + ')'); }

console.log('\nTerminé. Étapes manuelles restantes : voir DISCORD.md (rôle du bot au-dessus des autres, Communauté, Accueil).');
