// Publie des codes « tickets » dans le salon #codes-cadeaux (créé s'il n'existe pas, lecture seule pour les membres).
// Les codes arrivent par la variable PROMO_CODES (JSON : [{code,label,minutes}]). Rien n'est écrit dans le dépôt.
const API = process.env.DISCORD_API || 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_BOT_TOKEN, GUILD = process.env.DISCORD_GUILD_ID;
if (!TOKEN || !GUILD) { console.error('Il manque DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID.'); process.exit(1); }
let codes; try { codes = JSON.parse(process.env.PROMO_CODES || '[]'); } catch { codes = []; }
if (!Array.isArray(codes) || !codes.length) { console.error('Aucun code à publier.'); process.exit(1); }
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'KorvaluneSetup (korvalune, 1.0)' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 150)}`); return t ? JSON.parse(t) : null;
};
const chans = await call('GET', `/guilds/${GUILD}/channels`);
let ch = chans.find((c) => c.type === 0 && c.name.includes('codes'));
if (!ch) {
  const ann = chans.find((c) => c.type === 0 && c.name.includes('annonces') && !c.name.includes('testeurs'));
  ch = await call('POST', `/guilds/${GUILD}/channels`, {
    name: '🎁・codes-cadeaux', type: 0, parent_id: ann?.parent_id || undefined, topic: 'Codes à usage unique : tickets double XP et butin ×2. Dans le jeu : Compte → Entrer un code.',
    permission_overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(0x800) }]   // @everyone ne peut pas écrire
  });
  console.log('Salon créé :', ch.name);
}
const lines = codes.map((c) => `🎟️ \`${c.code}\` — ${c.label}`);
const head = '# 🎁 Codes cadeaux — tickets de bonus\nChaque code ne fonctionne **qu’une seule fois** : le premier qui le valide gagne le bonus (durée indiquée, qui commence au moment où tu l’entres).\n**Comment faire ?** Dans le jeu : *Compte → Entrer un code* (ou menu Pause → *Entrer un code*), tape le code, valide. Il faut être connecté à ton compte.\n';
let buf = head;
for (const l of lines) { if ((buf + l + '\n').length > 1800) { await call('POST', `/channels/${ch.id}/messages`, { content: buf }); buf = ''; } buf += l + '\n'; }
buf += '\nBonne chasse ! ⚔️'; await call('POST', `/channels/${ch.id}/messages`, { content: buf });
console.log(`${codes.length} codes publiés dans #${ch.name}`);
