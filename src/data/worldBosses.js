// V10.92 — BOSS MONDIAUX : un colosse par région, qui apparaît à tour de rôle toute la journée (heure universelle : tous les joueurs voient le même).
// Données pures (aucun import du moteur 3D) : planning, positions, attaques thématiques de chaque boss.
import { REGION_BY_ID } from '../world/Continent.js';

export const WB_SLOT_MS = 60 * 60 * 1000;     // un nouveau boss toutes les heures
export const WB_ACTIVE_MS = 50 * 60 * 1000;   // il reste 50 minutes (ou jusqu'à sa mort)
export const WB_WARN_MS = 5 * 60 * 1000;      // préavis

// Ordre de passage (alterne bas / haut niveaux et les quatre coins du continent)
export const WB_ORDER = ['prairie', 'swamp', 'desert', 'corrupt', 'forest', 'tundra', 'celeste', 'mount', 'abyss', 'void'];

// move : { t: type, cd: délai (s), ... }  —  types : slam (cercle devant lui), rain (pluie autour du joueur), line (ligne vers le joueur),
// ring (couronne autour du boss), spiral (spirale qui s'éloigne), charge (ruée), sweep (grand arc), nova (ondes concentriques)
export const WORLD_BOSSES = {
  prairie: { id: 'wb_scarecrow', species: 'wb_scarecrow', name: "L'Épouvantail Moissonneur", icon: '🎃', color: 0xff9a3c, level: 12, height: 9.9, speed: 4.2, reach: 6.5,
    pre: [24, 24], lore: 'Il fauche tout ce qui ose traverser ses champs.',
    moves: [{ t: 'sweep', cd: 6, r: 11, text: 'Fauchage !' }, { t: 'rain', cd: 9, n: 5, r: 3.4, text: 'Corbeaux !', from: 0 }, { t: 'line', cd: 11, n: 7, r: 3.2, text: 'Lame de moisson !', from: 1 }, { t: 'ring', cd: 14, n: 10, d: 11, r: 3.6, text: 'Cercle de paille !', from: 2 }] },
  forest: { id: 'wb_antler', species: 'wb_antler', name: 'Le Roi-Cerf des Ombres', icon: '🦌', color: 0x4aff9a, level: 24, height: 18.0, speed: 4.6, reach: 8.5,
    pre: [26, 22], lore: 'Les feux follets de sa ramure guident les voyageurs vers la mort.',
    moves: [{ t: 'slam', cd: 6, r: 8, text: 'Écrasement !' }, { t: 'rain', cd: 8, n: 6, r: 3.0, text: 'Feux follets !', from: 0 }, { t: 'line', cd: 11, n: 8, r: 3.0, text: 'Charge de la ramure !', from: 1 }, { t: 'nova', cd: 15, r: 3.6, text: 'Floraison funeste !', from: 2 }] },
  mount: { id: 'wb_forgeron', species: 'wb_forgeron', name: 'Le Colosse Forgeron', icon: '⚒️', color: 0xff7a1a, level: 32, height: 10.8, speed: 3.8, reach: 7.5,
    pre: [24, -18], lore: 'Sa fournaise n\'a jamais cessé de brûler depuis la chute des forges.',
    moves: [{ t: 'slam', cd: 5.5, r: 9, text: 'Coup de marteau !' }, { t: 'line', cd: 9, n: 8, r: 3.4, text: 'Onde de forge !', from: 0 }, { t: 'rain', cd: 10, n: 6, r: 3.2, text: 'Étincelles !', from: 1 }, { t: 'ring', cd: 14, n: 12, d: 12, r: 3.6, text: 'Fournaise !', from: 2 }] },
  desert: { id: 'wb_sphinx', species: 'wb_sphinx', name: 'Le Sphinx-Scorpion', icon: '🦂', color: 0xffb02a, level: 50, height: 9.5, speed: 5.4, reach: 8.0,
    pre: [24, 22], lore: 'Il pose une énigme aux voyageurs ; la réponse est toujours son dard.',
    moves: [{ t: 'charge', cd: 8, len: 22, r: 3.6, text: 'Ruée du sphinx !' }, { t: 'line', cd: 9, n: 8, r: 3.0, text: 'Dard venimeux !', from: 0 }, { t: 'rain', cd: 10, n: 7, r: 3.0, text: 'Sables ardents !', from: 1 }, { t: 'spiral', cd: 15, n: 14, r: 3.2, text: 'Tempête d\'Ambre !', from: 2 }] },
  swamp: { id: 'wb_toad', species: 'wb_toad', name: 'Le Gobe-Lanterne', icon: '🐸', color: 0x6aff9a, level: 65, height: 8.7, speed: 4.4, reach: 8.0,
    pre: [26, 22], lore: 'Sa lanterne attire les égarés. Sa gueule fait le reste.',
    moves: [{ t: 'slam', cd: 6, r: 9, text: 'Bond écrasant !' }, { t: 'rain', cd: 8, n: 7, r: 3.2, text: 'Spores !', from: 0 }, { t: 'charge', cd: 11, len: 20, r: 3.8, text: 'Plongeon !', from: 1 }, { t: 'nova', cd: 15, r: 3.8, text: 'Cri des marais !', from: 2 }] },
  tundra: { id: 'wb_mammoth', species: 'wb_mammoth', name: 'Le Mammouth de Givre', icon: '🦣', color: 0x7ad8ff, level: 80, height: 13.8, speed: 4.8, reach: 9.5,
    pre: [24, -22], lore: 'Chaque pas fait trembler la banquise ; chaque barrit gèle le sang.',
    moves: [{ t: 'charge', cd: 8, len: 26, r: 4.0, text: 'Charge glaciale !' }, { t: 'slam', cd: 7, r: 10, text: 'Piétinement !', from: 0 }, { t: 'line', cd: 10, n: 9, r: 3.2, text: 'Éclats de glace !', from: 1 }, { t: 'ring', cd: 14, n: 12, d: 13, r: 3.8, text: 'Tempête de givre !', from: 2 }] },
  corrupt: { id: 'wb_cathedral', species: 'wb_cathedral', name: 'Le Prélat de Chair', icon: '⛪', color: 0xc46aff, level: 105, height: 13.4, speed: 4.2, reach: 9.0,
    pre: [-26, 22], lore: 'Une cathédrale qui prie, et dont chaque pierre saigne.',
    moves: [{ t: 'rain', cd: 6, n: 7, r: 3.2, text: 'Litanie !' }, { t: 'sweep', cd: 8, r: 11, text: 'Encensoir !', from: 0 }, { t: 'line', cd: 10, n: 9, r: 3.2, text: 'Rayon de la rosace !', from: 1 }, { t: 'nova', cd: 14, r: 3.8, text: 'Sanctuaire corrompu !', from: 2 }] },
  celeste: { id: 'wb_seraph', species: 'wb_seraph', name: 'Le Séraphin Brisé', icon: '👼', color: 0xffe28a, level: 130, height: 15.5, speed: 5.2, reach: 9.5,
    pre: [22, -22], lore: 'Il garde un ciel qui n\'existe plus, et jure de n\'en laisser aucun autre.',
    moves: [{ t: 'line', cd: 7, n: 10, r: 3.2, text: 'Lame solaire !' }, { t: 'rain', cd: 8, n: 8, r: 3.0, text: 'Pluie de plumes !', from: 0 }, { t: 'slam', cd: 9, r: 9, text: 'Jugement !', from: 1 }, { t: 'nova', cd: 14, r: 3.8, text: 'Aurore brisée !', from: 2 }] },
  abyss: { id: 'wb_ember', species: 'wb_ember', name: 'Le Seigneur de Braise', icon: '🔥', color: 0xff4a1a, level: 160, height: 24, speed: 5.2, reach: 10.5,
    pre: [26, 24], lore: 'Les abysses l\'ont forgé ; il en a gardé le feu.',
    moves: [{ t: 'slam', cd: 5.5, r: 10, text: 'Hache de forge !' }, { t: 'line', cd: 8, n: 10, r: 3.4, text: 'Fissure de lave !', from: 0 }, { t: 'rain', cd: 8, n: 8, r: 3.2, text: 'Pluie de braise !', from: 1 }, { t: 'ring', cd: 12, n: 14, d: 14, r: 3.8, text: 'Anneau infernal !', from: 2 }, { t: 'spiral', cd: 15, n: 16, r: 3.4, text: 'Tourbillon de flammes !', from: 2 }] },
  void: { id: 'wb_eye', species: 'wb_eye', name: "L'Œil du Néant", icon: '👁️', color: 0xb46aff, level: 200, height: 18, speed: 5.0, reach: 11.0,
    pre: [-24, -24], lore: 'Il regarde le monde depuis avant le monde, et le monde le regarde mourir.',
    moves: [{ t: 'nova', cd: 6, r: 3.6, text: 'Regard du Néant !' }, { t: 'rain', cd: 7, n: 8, r: 3.2, text: 'Éclats de vide !', from: 0 }, { t: 'line', cd: 9, n: 10, r: 3.4, text: 'Rayon primordial !', from: 1 }, { t: 'spiral', cd: 12, n: 18, r: 3.4, text: 'Spirale du Néant !', from: 1 }, { t: 'ring', cd: 14, n: 14, d: 15, r: 4.0, text: 'Anneaux de vide !', from: 2 }] }
};

export const wbList = () => WB_ORDER.map((rid) => ({ regionId: rid, region: REGION_BY_ID[rid], ...WORLD_BOSSES[rid] }));
export const wbByModelId = (id) => wbList().find((b) => b.id === id) || null;

/** État du planning à l'instant `now` : boss de la tranche courante, temps restant, prochain boss. */
export function wbSchedule(now = Date.now()) {
  const n = Math.floor(now / WB_SLOT_MS);
  const slotStart = n * WB_SLOT_MS;
  const rid = WB_ORDER[((n % WB_ORDER.length) + WB_ORDER.length) % WB_ORDER.length];
  const el = now - slotStart;
  return { slot: n, slotStart, regionId: rid, boss: WORLD_BOSSES[rid], windowOpen: el < WB_ACTIVE_MS, endsIn: Math.max(0, WB_ACTIVE_MS - el), nextIn: WB_SLOT_MS - el };
}

/** Prochaine ouverture du boss de la région `rid` (ms epoch) — la fenêtre courante si elle est encore ouverte. */
export function wbNextWindow(rid, now = Date.now()) {
  const idx = WB_ORDER.indexOf(rid);
  const n = Math.floor(now / WB_SLOT_MS), L = WB_ORDER.length;
  for (let k = 0; k <= L; k++) {
    const s = n + k;
    if (((s % L) + L) % L !== idx) continue;
    const start = s * WB_SLOT_MS;
    if (start + WB_ACTIVE_MS > now) return { slot: s, start, end: start + WB_ACTIVE_MS, open: now >= start };
  }
  return null;
}

export function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
