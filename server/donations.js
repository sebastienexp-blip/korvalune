// V10.55 — Dons PayPal. Le jeu n'a AUCUN accès à PayPal : il affiche le lien de réception du créateur ; le donateur déclare son don
// dans le jeu, le créateur (compte listé dans OWNER_ACCOUNTS) vérifie l'argent reçu sur PayPal puis valide : les Lunes de remerciement
// sont alors créditées (une seule fois par demande). Aucune donnée de paiement ne transite par le jeu.
import { thanksLunes, DON_MIN, DON_MAX } from '../src/data/donations.js';
import { ensureShop } from './shop.js';

const env = () => process.env;
// Lien de réception du créateur (QR PayPal « Recevoir des paiements »). Surchargeable par PAYPAL_DONATE_URL (Render).
export const DEFAULT_DONATE_URL = 'https://www.paypal.com/qrcodes/p2pqrc/U5392UEE3VMRA';
export function donateUrl() {
  const raw = String(env().PAYPAL_DONATE_URL || DEFAULT_DONATE_URL).trim();
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ['www.paypal.com', 'paypal.com', 'paypal.me', 'www.paypal.me'].includes(u.hostname) ? u.toString() : DEFAULT_DONATE_URL;
  } catch { return DEFAULT_DONATE_URL; }
}
export const ownerSet = () => new Set(String(env().OWNER_ACCOUNTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isOwnerKey = (key) => ownerSet().has(String(key || '').toLowerCase());

const MAX_PENDING = 3, MAX_HISTORY = 60;
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const money = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };
const clean = (s, n) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n) : '');

export function ensureDon(acc) {
  acc.don = (Array.isArray(acc.don) ? acc.don : []).filter((d) => d && typeof d.id === 'string').slice(-MAX_HISTORY);
  return acc.don;
}

// Vue envoyée au joueur : son lien de don et ses propres demandes (jamais celles des autres)
export function donView(acc) {
  return { url: donateUrl(), mine: ensureDon(acc).slice(-6).reverse().map((d) => ({ id: d.id, amount: d.amount, status: d.status, lunes: d.lunes || 0, at: d.at })) };
}

export function requestDonation(acc, amount, note, now = Date.now()) {
  const don = ensureDon(acc);
  const a = money(amount);
  if (!Number.isFinite(a) || a < DON_MIN || a > DON_MAX) return { ok: false, error: `Indique un montant entre ${DON_MIN} et ${DON_MAX} €.` };
  if (don.filter((d) => d.status === 'pending').length >= MAX_PENDING) return { ok: false, error: 'Tu as déjà des dons en attente de vérification : patiente un peu, merci !' };
  don.push({ id: rid(), amount: a, note: clean(note, 60), at: new Date(now).toISOString(), status: 'pending', lunes: 0 });
  acc.don = don.slice(-MAX_HISTORY);
  return { ok: true, lunes: thanksLunes(a) };
}

// Liste des demandes en attente de tous les comptes (réservé au créateur)
export function pendingDonations(accounts) {
  const rows = [];
  for (const [key, acc] of Object.entries(accounts)) for (const d of ensureDon(acc)) if (d.status === 'pending') rows.push({ id: d.id, account: key, amount: d.amount, note: d.note || '', at: d.at, lunes: thanksLunes(d.amount) });
  return rows.sort((x, y) => x.at.localeCompare(y.at)).slice(0, 100);
}

// Valide (ok=true : crédite les Lunes) ou refuse une demande. Idempotent : une demande déjà traitée ne peut plus l'être.
export function resolveDonation(acc, id, ok, amountOverride) {
  const d = ensureDon(acc).find((x) => x.id === id);
  if (!d) return { ok: false, error: 'Demande introuvable.' };
  if (d.status !== 'pending') return { ok: false, error: 'Cette demande a déjà été traitée.' };
  if (!ok) { d.status = 'refused'; d.doneAt = new Date().toISOString(); return { ok: true, refused: true }; }
  const over = amountOverride === undefined || amountOverride === null || amountOverride === '' ? d.amount : money(amountOverride);
  if (!Number.isFinite(over) || over < DON_MIN || over > DON_MAX) return { ok: false, error: `Montant invalide (${DON_MIN} à ${DON_MAX} €).` };
  const lunes = thanksLunes(over);
  ensureShop(acc).gems += lunes;
  d.status = 'done'; d.amount = over; d.lunes = lunes; d.doneAt = new Date().toISOString();
  return { ok: true, lunes, amount: over };
}
