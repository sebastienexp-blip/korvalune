// V10.13 — Événement Halloween côté serveur : SEULE source de vérité pour les bonbons.
// Les gains sont bornés (plafond quotidien, délai entre deux victoires, distance au bonbon vérifiée) ; les achats sont validés ici.
import { EVENT, CANDY, HUNT_SPOTS, HUNT_BY_ID, EVENT_MONSTERS, HALLOWEEN_BY_ID, eventActive, shopOpen } from '../src/data/halloween.js';
import { ensureShop } from './shop.js';

const day = () => new Date().toISOString().slice(0, 10);

export function ensureEvent(acc) {
  if (!acc.event || typeof acc.event !== 'object') acc.event = {};
  const e = acc.event;
  e.candy = Number.isFinite(e.candy) ? Math.max(0, Math.floor(e.candy)) : 0;
  e.total = Number.isFinite(e.total) ? Math.max(0, Math.floor(e.total)) : 0;
  e.bossKills = Number.isFinite(e.bossKills) ? Math.max(0, Math.floor(e.bossKills)) : 0;
  if (e.day !== day()) { // nouvelle journée : les bonbons cachés, le sac et les défis se renouvellent
    e.day = day(); e.hunt = []; e.kills = 0; e.killCandy = 0; e.dailyBag = false; e.huntBonus = false; e.killBonus = false; e.lastKill = 0;
  }
  e.hunt = Array.isArray(e.hunt) ? e.hunt.filter((id) => HUNT_BY_ID[id]) : [];
  e.kills = Number.isFinite(e.kills) ? Math.max(0, Math.floor(e.kills)) : 0;
  e.killCandy = Number.isFinite(e.killCandy) ? Math.max(0, Math.floor(e.killCandy)) : 0;
  e.lastKill = Number.isFinite(e.lastKill) ? e.lastKill : 0;
  return e;
}

const give = (e, n) => { e.candy += n; e.total += n; };

export function eventView(acc) {
  const e = ensureEvent(acc);
  const s = ensureShop(acc);
  const now = Date.now();
  return {
    t: 'event', active: eventActive(now), shopOpen: shopOpen(now), endsAt: EVENT.end,
    candy: e.candy, total: e.total, hunt: e.hunt, huntTotal: HUNT_SPOTS.length,
    kills: e.kills, killGoal: CANDY.killGoal, killCandy: e.killCandy, killCap: CANDY.killCapPerDay,
    dailyBag: !!e.dailyBag, huntBonus: !!e.huntBonus, killBonus: !!e.killBonus,
    owned: s.owned.filter((id) => HALLOWEEN_BY_ID[id]), eq: { ...s.eq }
  };
}

// Ramasse un bonbon caché. `pos` = position connue du joueur côté serveur. -> { ok, gained, bonus?, error? }
export function collect(acc, id, pos) {
  if (!eventActive()) return { ok: false, error: 'L’événement est terminé.' };
  const e = ensureEvent(acc);
  const h = HUNT_BY_ID[typeof id === 'string' ? id : ''];
  if (!h) return { ok: false, error: 'Bonbon inconnu.' };
  if (e.hunt.includes(h.id)) return { ok: false, error: '' };
  if (!Array.isArray(pos) || Math.hypot((pos[0] || 0) - h.x, (pos[2] || 0) - h.z) > CANDY.pickRange) return { ok: false, error: '' };
  e.hunt.push(h.id);
  give(e, CANDY.perHunt);
  let bonus = 0;
  if (!e.huntBonus && e.hunt.length >= HUNT_SPOTS.length) { e.huntBonus = true; bonus = CANDY.huntBonus; give(e, bonus); }
  return { ok: true, gained: CANDY.perHunt, bonus };
}

// Victoire sur un monstre de l'événement. -> { ok, gained, bonus? }
export function kill(acc, kind) {
  if (!eventActive()) return { ok: false, error: '' };
  const e = ensureEvent(acc);
  const m = EVENT_MONSTERS[typeof kind === 'string' ? kind : ''];
  if (!m) return { ok: false, error: '' };
  const now = Date.now();
  if (!m.boss && now - e.lastKill < CANDY.killMinGapMs) return { ok: false, error: '' };
  e.lastKill = now;
  e.kills += 1;
  let gained = Math.max(0, Math.min(m.candy, CANDY.killCapPerDay - e.killCandy));
  if (m.boss) gained = m.candy; // le boss ne compte pas dans le plafond : c'est un événement rare
  else e.killCandy += gained;
  if (m.boss) e.bossKills += 1;
  give(e, gained);
  let bonus = 0;
  if (!e.killBonus && e.kills >= CANDY.killGoal) { e.killBonus = true; bonus = CANDY.killBonus; give(e, bonus); }
  return { ok: true, gained, bonus, capped: !m.boss && gained < m.candy };
}

export function daily(acc) {
  if (!eventActive()) return { ok: false, error: 'L’événement est terminé.' };
  const e = ensureEvent(acc);
  if (e.dailyBag) return { ok: false, error: 'Tu as déjà pris ton sac de bonbons aujourd’hui. Reviens demain !' };
  e.dailyBag = true;
  give(e, CANDY.daily);
  return { ok: true, gained: CANDY.daily };
}

export function buy(acc, id) {
  if (!shopOpen()) return { ok: false, error: 'La boutique de Jack est fermée.' };
  const e = ensureEvent(acc);
  const s = ensureShop(acc);
  const it = HALLOWEEN_BY_ID[typeof id === 'string' ? id : ''];
  if (!it) return { ok: false, error: 'Objet inconnu.' };
  if (s.owned.includes(it.id)) return { ok: false, error: 'Tu possèdes déjà cet objet.' };
  if (e.candy < it.candy) return { ok: false, error: `Il te manque ${it.candy - e.candy} bonbons.` };
  e.candy -= it.candy;
  s.owned.push(it.id);
  return { ok: true, item: it };
}

// Classement : les 10 comptes qui ont gagné le plus de bonbons.
export function top(accounts) {
  const rows = [];
  for (const [name, acc] of Object.entries(accounts)) {
    const t = acc?.event?.total;
    if (Number.isFinite(t) && t > 0) rows.push({ name, total: Math.floor(t), boss: acc.event.bossKills | 0 });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, 10);
}
