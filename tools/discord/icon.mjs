// Met l'icône du serveur Discord (docs/play/icon-512.png : croissant de lune Korvalune).
import fs from 'node:fs';
const API = process.env.DISCORD_API || 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_BOT_TOKEN, GUILD = process.env.DISCORD_GUILD_ID;
if (!TOKEN || !GUILD) { console.error('Il manque DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID.'); process.exit(1); }
const img = fs.readFileSync(process.env.ICON_FILE || 'docs/play/icon-512.png');
const r = await fetch(`${API}/guilds/${GUILD}`, { method: 'PATCH', headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'KorvaluneSetup (korvalune, 1.0)' }, body: JSON.stringify({ icon: 'data:image/png;base64,' + img.toString('base64') }) });
if (!r.ok) { console.error('Échec', r.status, (await r.text()).slice(0, 150)); process.exit(1); }
console.log('Icône du serveur mise à jour.');
