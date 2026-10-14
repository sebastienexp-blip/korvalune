// V10.57 — administration des comptes (réservée au créateur) : recherche, mot de passe temporaire, Lunes, blocage, journal.
import { promises as fs } from 'fs';
import path from 'path';
import { DATA_DIR, hashPassword } from './store.js';
import { ensureShop } from './shop.js';
import { newTempPassword } from './recovery.js';

const LOG = path.join(DATA_DIR, 'admin-log.jsonl');
export async function adminLog(by, action, target, extra = '') {
  const line = JSON.stringify({ at: new Date().toISOString(), by, action, target, extra: String(extra).slice(0, 200) });
  console.log(`[Korvalune] admin ${by} : ${action} ${target} ${extra}`);
  try { await fs.mkdir(DATA_DIR, { recursive: true }); await fs.appendFile(LOG, line + '\n'); } catch { /* journal best-effort */ }
}
export async function readLog(n = 40) {
  try { const t = await fs.readFile(LOG, 'utf8'); return t.trim().split('\n').slice(-n).reverse().map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
export function summary(key, acc, online) {
  return {
    name: key, createdAt: acc.createdAt || 0, lunes: ensureShop(acc).gems | 0,
    chars: (acc.chars || []).filter(Boolean).length, online: !!online,
    banned: acc.ban ? (acc.ban.reason || 'oui') : '', recovery: !!(acc.sec?.a || acc.sec?.c), email: acc.sec?.email || ''
  };
}
export function searchAccounts(accounts, q, onlineFn, limit = 40) {
  const s = String(q || '').trim().toLowerCase();
  const rows = [];
  for (const [k, a] of Object.entries(accounts)) {
    if (s && !k.toLowerCase().includes(s)) continue;
    rows.push(summary(k, a, onlineFn(k)));
  }
  rows.sort((a, b) => (b.online - a.online) || (b.createdAt - a.createdAt));
  return { total: rows.length, list: rows.slice(0, limit) };
}
export async function resetPassword(acc) {
  const temp = newTempPassword();
  acc.passwordHash = await hashPassword(temp);
  acc.revokedAt = Date.now();
  return temp;
}
export function giveLunes(acc, delta) {
  const d = Math.trunc(Number(delta));
  if (!Number.isFinite(d) || d === 0 || Math.abs(d) > 1_000_000) return { ok: false, error: 'Montant invalide (entre -1 000 000 et 1 000 000).' };
  const sh = ensureShop(acc);
  sh.gems = Math.max(0, (sh.gems | 0) + d);
  return { ok: true, gems: sh.gems, delta: d };
}
