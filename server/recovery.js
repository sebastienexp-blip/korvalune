// V10.57 — récupération de compte : question secrète + code de secours (hachés comme les mots de passe).
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from './store.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (s, n) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n) : '');
export const QUESTIONS = [
  'Quel est le prénom de ton meilleur ami d’enfance ?',
  'Quel était le nom de ton premier animal ?',
  'Dans quelle ville es-tu né(e) ?',
  'Quel est ton plat préféré ?',
  'Quel était ton jeu vidéo préféré enfant ?',
  'Quel est le nom de ta rue d’enfance ?'
];
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => { const b = randomBytes(12); let s = ''; for (let i = 0; i < 12; i++) s += ALPHA[b[i] % ALPHA.length]; return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`; };
export const newTempPassword = () => { const b = randomBytes(10); let s = ''; for (let i = 0; i < 10; i++) s += ALPHA[b[i] % ALPHA.length]; return s; };

export const secView = (acc) => ({
  question: acc.sec?.q || '',
  hasQuestion: !!acc.sec?.a,
  hasCode: !!acc.sec?.c,
  email: acc.sec?.email ? acc.sec.email.replace(/^(.).*(@.*)$/, '$1***$2') : ''
});

export async function setQuestion(acc, q, answer) {
  const question = clean(q, 120);
  if (question.length < 5) return { ok: false, error: 'Choisis une question.' };
  if (norm(answer).length < 3) return { ok: false, error: 'Ta réponse est trop courte (3 caractères minimum).' };
  acc.sec = { ...(acc.sec || {}), q: question, a: await hashPassword(norm(answer)), at: Date.now() };
  return { ok: true };
}
export function setEmail(acc, email) {
  const e = clean(email, 120).toLowerCase();
  if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: 'Adresse e-mail invalide.' };
  acc.sec = { ...(acc.sec || {}) }; if (e) acc.sec.email = e; else delete acc.sec.email;
  return { ok: true };
}
export async function makeRecoveryCode(acc) {
  const code = newCode();
  acc.sec = { ...(acc.sec || {}), c: await hashPassword(norm(code)), cat: Date.now() };
  return code;
}
// vérifie la réponse secrète ou le code de secours
export async function checkRecovery(acc, method, secret) {
  const sec = acc?.sec;
  const h = method === 'code' ? sec?.c : sec?.a;
  if (!h) return false;
  return verifyPassword(norm(secret), h);
}
