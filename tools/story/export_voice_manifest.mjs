// Exporte toutes les répliques du mode histoire en CSV (id, personnage, voix prévue, texte, nom du fichier attendu)
// usage : node tools/story/export_voice_manifest.mjs > repliques.csv
import { STORY_LINES, STORY_TALKS, SPEAKERS } from '../../src/data/story.js';
const rows = [];
for (const [scene, lines] of Object.entries(STORY_LINES)) for (const l of lines) rows.push([l.id, `cinématique ${scene}`, l.who, l.t]);
for (const [quest, steps] of Object.entries(STORY_TALKS)) for (const [step, lines] of Object.entries(steps)) for (const l of lines) rows.push([l.id, `${quest}/${step}`, l.who, l.t]);
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
console.log('id;scene;personnage;voix_prevue;texte;fichier');
for (const [id, scene, who, t] of rows) console.log([id, scene, who, SPEAKERS[who]?.voice || '', q(t), `public/voices/${id}.mp3`].join(';'));
