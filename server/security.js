// Sécurité de la version en ligne : jetons de session signés (valables après un redémarrage du serveur),
// limites par adresse IP et verrouillage temporaire après plusieurs échecs de connexion.
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export async function loadSecret(dataDir) {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, 'session.key');
  try { const s = (await fs.readFile(file, 'utf8')).trim(); if (s.length >= 32) return s; } catch { /* à créer */ }
  const s = randomBytes(32).toString('hex');
  try { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(file, s, { mode: 0o600 }); } catch (e) { console.error('[Aetheria] Impossible d\'écrire session.key :', e.message); }
  return s;
}

const b64 = (s) => Buffer.from(s).toString('base64url');
export function makeToken(secret, username, ttlMs = 14 * 24 * 3600 * 1000) {
  const body = b64(JSON.stringify({ u: username, e: Date.now() + ttlMs }));
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
// renvoie le nom du compte, ou null si le jeton est faux / expiré
export function verifyToken(secret, token) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const d = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return d.e > Date.now() && typeof d.u === 'string' ? d.u : null; } catch { return null; }
}

// compteur glissant par clé (adresse IP, nom de compte…)
export class KeyedLimiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.map = new Map(); }
  hit(key) {
    const now = Date.now();
    let e = this.map.get(key);
    if (!e || now - e.t0 >= this.windowMs) { e = { t0: now, n: 0 }; this.map.set(key, e); }
    e.n++;
    if (this.map.size > 5000) for (const [k, v] of this.map) if (now - v.t0 >= this.windowMs) this.map.delete(k);
    return e.n <= this.max;
  }
  count(key) { const e = this.map.get(key); return e && Date.now() - e.t0 < this.windowMs ? e.n : 0; }
  reset(key) { this.map.delete(key); }
}
