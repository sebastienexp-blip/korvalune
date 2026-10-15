// V10.59 — outils du créateur : maintenance, message du jour, boosts mondiaux, codes cadeaux. Config conservée dans DATA_DIR.
import { readFileSync, promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { DATA_DIR } from './store.js';
import { ensureShop } from './shop.js';

const FILE = path.join(DATA_DIR, 'admin-config.json');
let cfg = { motd: '', maint: { on: false, text: '' }, boost: null, codes: {} };
try { const j = JSON.parse(readFileSync(FILE, 'utf8')); cfg = { ...cfg, ...j, maint: { ...cfg.maint, ...(j.maint || {}) }, codes: j.codes || {} }; } catch { /* première fois */ }
let w = Promise.resolve();
const save = () => (w = w.then(async () => { try { await fs.mkdir(DATA_DIR, { recursive: true }); await fs.writeFile(FILE, JSON.stringify(cfg)); } catch (e) { console.error('[Korvalune] admin-config :', e.message); } }));
const clean = (s, n) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n) : '');

export const getMotd = () => cfg.motd;
export const setMotd = (t) => { cfg.motd = clean(t, 200); return save(); };
export const maint = () => cfg.maint;
export const setMaint = (on, text) => { cfg.maint = { on: !!on, text: clean(text, 120) }; return save(); };

// boost mondial : { xp, drop, until, label } ; renvoie null s'il est terminé
export function boost() { if (cfg.boost && cfg.boost.until <= Date.now()) { cfg.boost = null; save(); } return cfg.boost; }
export function setBoost(xp, drop, minutes, label) {
  const x = Math.min(3, Math.max(1, Number(xp) || 1)), d = Math.min(3, Math.max(1, Number(drop) || 1)), m = Math.min(24 * 60, Math.max(1, Math.floor(Number(minutes) || 0)));
  if (x === 1 && d === 1) return { ok: false, error: 'Choisis au moins un bonus (XP ou butin supérieur à ×1).' };
  if (!m) return { ok: false, error: 'Durée invalide.' };
  cfg.boost = { xp: x, drop: d, until: Date.now() + m * 60000, label: clean(label, 60) || 'Événement du créateur' };
  save(); return { ok: true, boost: cfg.boost };
}
export const stopBoost = () => { cfg.boost = null; return save(); };

// codes cadeaux
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
export function createCode(code, lunes, maxUses, days) {
  const c = normCode(code); const l = Math.floor(Number(lunes));
  if (c.length < 4) return { ok: false, error: 'Code trop court (4 caractères minimum, lettres/chiffres).' };
  if (!(l >= 1 && l <= 100000)) return { ok: false, error: 'Lunes : entre 1 et 100 000.' };
  if (cfg.codes[c] && !cfg.codes[c].off) return { ok: false, error: 'Ce code existe déjà.' };
  const mu = Math.min(100000, Math.max(1, Math.floor(Number(maxUses) || 1))), d = Math.floor(Number(days) || 0);
  cfg.codes[c] = { lunes: l, max: mu, used: 0, by: [], until: d > 0 ? Date.now() + Math.min(d, 365) * 86400000 : 0, at: Date.now(), off: false };
  save(); return { ok: true, code: c };
}
export const codeList = () => Object.entries(cfg.codes).map(([code, c]) => ({ code: code.startsWith('h:') ? `🎟️ ${c.label || 'Ticket'} (${code.slice(2, 8)}…)` : code, lunes: c.lunes, used: c.used, max: c.max, until: c.until, off: !!c.off })).sort((a, b) => b.used - a.used || a.code.localeCompare(b.code));
export function stopCode(code) { const c = cfg.codes[normCode(code)]; if (!c) return false; c.off = true; save(); return true; }
// V10.70 — codes à usage unique « tickets » : bonus personnel (XP ×2 et/ou butin ×2) pendant 30 min ou 1 h.
// Les codes distribués sont fournis HACHÉS (SHA-256) dans server/promoSeed.json : le dépôt ne contient jamais un code en clair.
const hashCode = (c) => createHash('sha256').update(c).digest('hex');
try {
  const seed = JSON.parse(readFileSync(new URL('./promoSeed.json', import.meta.url), 'utf8'));
  let add = 0;
  for (const e of Array.isArray(seed) ? seed : []) {
    const key = 'h:' + String(e.h || '');
    if (!/^h:[0-9a-f]{64}$/.test(key) || cfg.codes[key]) continue;   // déjà connu : on garde son état (utilisé ou non)
    const xp = Math.min(3, Math.max(1, +e.xp || 1)), drop = Math.min(3, Math.max(1, +e.drop || 1)), minutes = Math.min(240, Math.max(1, Math.floor(+e.minutes) || 30));
    if (xp === 1 && drop === 1) continue;
    cfg.codes[key] = { lunes: 0, boost: { xp, drop, minutes }, label: String(e.label || '').slice(0, 40), max: 1, used: 0, by: [], until: 0, at: Date.now(), off: false };
    add++;
  }
  if (add) save();
} catch { /* pas de fichier de codes */ }

// bonus personnel encore actif d'un compte, sinon null
export const personalBoost = (acc) => (acc && acc.boost && acc.boost.until > Date.now() ? acc.boost : null);

export function redeem(acc, accName, code) {
  const k = normCode(code);
  const hk = 'h:' + hashCode(k);
  const key = cfg.codes[k] ? k : (cfg.codes[hk] ? hk : '');
  const c = key && cfg.codes[key];
  if (!c || c.off) return { ok: false, error: 'Code invalide.' };
  if (c.until && c.until < Date.now()) return { ok: false, error: 'Ce code a expiré.' };
  if (c.used >= c.max) return { ok: false, error: c.max === 1 ? 'Ce code a déjà été utilisé.' : 'Ce code a déjà été utilisé au maximum.' };
  if (c.by.includes(accName)) return { ok: false, error: 'Tu as déjà utilisé ce code.' };
  c.used++; c.by.push(accName);
  if (c.boost) {
    const cur = personalBoost(acc), now = Date.now();
    acc.boost = { xp: Math.max(c.boost.xp, cur ? cur.xp : 1), drop: Math.max(c.boost.drop, cur ? cur.drop : 1), until: (cur ? cur.until : now) + c.boost.minutes * 60000, label: 'Ticket' };
    save();
    return { ok: true, boost: { ...acc.boost, minutes: c.boost.minutes } };
  }
  ensureShop(acc).gems += c.lunes; save();
  return { ok: true, lunes: c.lunes };
}
