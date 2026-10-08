// Persistance des comptes (ÉTAPE 6). Stockage simple en fichier JSON — largement
// suffisant pour un prototype ; pour une mise en production réelle, remplacer
// par une vraie base de données (Postgres, SQLite...), l'interface ci-dessous
// resterait la même.
import { promises as fs } from 'fs';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import path from 'path';

const scryptAsync = promisify(scrypt);
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'accounts.json');

export async function loadAccounts() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code !== 'ENOENT') { // fichier abîmé : on tente la copie de secours plutôt que de repartir de zéro
      try { return JSON.parse(await fs.readFile(FILE + '.bak', 'utf8')); } catch { /* pas de copie */ }
    }
    return {};
  }
}

let writeQueue = Promise.resolve();
export function persistAccounts(accounts) {
  // Sérialise les écritures pour éviter une corruption si deux sauvegardes
  // arrivent au même instant.
  writeQueue = writeQueue
    .then(() => fs.mkdir(DATA_DIR, { recursive: true }))
    // écriture atomique (fichier temporaire puis renommage) + une copie de secours de la version précédente
    .then(async () => {
      const tmp = FILE + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(accounts, null, 2), 'utf8');
      try { await fs.copyFile(FILE, FILE + '.bak'); } catch { /* première écriture */ }
      await fs.rename(tmp, FILE);
    })
    .catch((err) => console.error('[Korvalune] Échec écriture accounts.json :', err.message));
  return writeQueue;
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)).toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hashHex] = String(stored || '').split(':');
  if (!salt || !hashHex) return false;
  const hash = await scryptAsync(password, salt, 64);
  const stored_ = Buffer.from(hashHex, 'hex');
  if (hash.length !== stored_.length) return false;
  return timingSafeEqual(hash, stored_);
}

export function sanitizeUsername(name) {
  return String(name || '').trim().slice(0, 20).replace(/[^a-zA-Z0-9_\-]/g, '');
}
