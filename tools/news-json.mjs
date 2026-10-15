// Génère public/bienvenue/news.json (nouveautés du site vitrine) à partir des notes de version du jeu.
import fs from 'node:fs';
import { PATCH_NOTES } from '../src/data/patchNotes.js';
const out = PATCH_NOTES.slice(0, 5).map((n) => ({ version: n.version, title: n.title, items: (n.items || []).slice(0, 5) }));
fs.mkdirSync('public/bienvenue', { recursive: true });
fs.writeFileSync('public/bienvenue/news.json', JSON.stringify(out));
console.log('news.json :', out.length, 'versions');
