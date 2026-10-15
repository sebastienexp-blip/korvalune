// Génère des codes « tickets » à usage unique. Écrit UNIQUEMENT les empreintes SHA-256 dans server/promoSeed.json (dépôt)
// et les codes en clair dans le fichier donné en argument (à ne PAS versionner). Relancer ajoute de nouveaux codes sans toucher aux anciens.
import { randomInt, createHash } from 'node:crypto';
import fs from 'node:fs';
const out = process.argv[2] || 'codes-en-clair.json';
const SEED = new URL('../server/promoSeed.json', import.meta.url);
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = () => Array.from({ length: 12 }, () => A[randomInt(A.length)]).join('');
const PLAN = [
  { xp: 2, drop: 1, minutes: 30, label: 'Double XP 30 min', n: 2 }, { xp: 2, drop: 1, minutes: 60, label: 'Double XP 1 h', n: 2 },
  { xp: 1, drop: 2, minutes: 30, label: 'Butin x2 30 min', n: 2 }, { xp: 1, drop: 2, minutes: 60, label: 'Butin x2 1 h', n: 2 },
  { xp: 2, drop: 2, minutes: 30, label: 'Double XP + Butin x2 30 min', n: 2 }, { xp: 2, drop: 2, minutes: 60, label: 'Double XP + Butin x2 1 h', n: 2 }
];
let seed = []; try { seed = JSON.parse(fs.readFileSync(SEED, 'utf8')); } catch { /* nouveau */ }
const clear = [];
for (const p of PLAN) for (let i = 0; i < p.n; i++) {
  const raw = 'KORV' + rnd(), h = createHash('sha256').update(raw).digest('hex');
  seed.push({ h, xp: p.xp, drop: p.drop, minutes: p.minutes, label: p.label });
  clear.push({ code: `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`, label: p.label, minutes: p.minutes, xp: p.xp, drop: p.drop });
}
fs.writeFileSync(SEED, JSON.stringify(seed, null, 1) + '\n'); fs.writeFileSync(out, JSON.stringify(clear, null, 1) + '\n');
console.log(`${clear.length} codes générés ; empreintes dans server/promoSeed.json, codes en clair dans ${out}`);
