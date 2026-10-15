// Crée (ou retrouve) un lien d'invitation PERMANENT (sans expiration, sans limite) et l'écrit dans public/discord.json.
// Le jeu et le site lisent ce fichier : changer de lien ne demande aucune modification de code.
import fs from 'node:fs';
const API = process.env.DISCORD_API || 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_BOT_TOKEN, GUILD = process.env.DISCORD_GUILD_ID;
if (!TOKEN || !GUILD) { console.error('Il manque DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID.'); process.exit(1); }
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'KorvaluneSetup (korvalune, 1.0)' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 150)}`); return t ? JSON.parse(t) : null;
};
const chans = await call('GET', `/guilds/${GUILD}/channels`);
const ch = chans.find((c) => c.type === 0 && c.name.includes('bienvenue')) || chans.find((c) => c.type === 0);
if (!ch) throw new Error('Aucun salon texte trouvé.');
const inv = await call('POST', `/channels/${ch.id}/invites`, { max_age: 0, max_uses: 0, unique: false, temporary: false });
if (inv.expires_at) throw new Error('Le lien créé expire : refus de l’enregistrer.');
const url = 'https://discord.gg/' + inv.code;
fs.writeFileSync(process.env.INVITE_OUT || 'public/discord.json', JSON.stringify({ invite: url }) + '\n');
console.log('Lien permanent enregistré :', url);
