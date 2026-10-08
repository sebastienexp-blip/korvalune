// V10.2 — Paiements Stripe (Checkout hébergé) : AUCUNE carte ne transite par le jeu, tout se passe sur la page Stripe.
// Désactivé tant que STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET et PUBLIC_URL ne sont pas définis (voir STRIPE.md).
// Pas de dépendance npm : appels REST via fetch (Node 20) et vérification de signature via crypto.
import { createHmac, timingSafeEqual } from 'crypto';

// ⚠️ Prix et quantités = PLACEHOLDERS à décider par vous. Les centimes sont en EUR.
export const PACKS = [
  { id: 'lunes_300', lunes: 300, cents: 199, label: 'Poignée de Lunes' },
  { id: 'lunes_700', lunes: 700, cents: 399, label: 'Bourse de Lunes' },
  { id: 'lunes_1600', lunes: 1600, cents: 799, label: 'Coffre de Lunes' },
  { id: 'lunes_4000', lunes: 4000, cents: 1799, label: 'Trésor de Lunes' }
];
export const PACK_BY_ID = Object.assign(Object.create(null), Object.fromEntries(PACKS.map((p) => [p.id, p])));

const env = () => process.env;
export const payEnabled = () => !!(env().STRIPE_SECRET_KEY && env().STRIPE_WEBHOOK_SECRET && env().PUBLIC_URL);
export const apiBase = () => env().STRIPE_API_BASE || 'https://api.stripe.com'; // surchargeable pour les tests
export const publicUrl = () => String(env().PUBLIC_URL || '').replace(/\/+$/, '');

// Ce que le client a le droit de savoir (jamais de clé)
export const payView = () => (payEnabled() ? { enabled: true, packs: PACKS.map(({ id, lunes, cents, label }) => ({ id, lunes, cents, label })), test: /^sk_test_/.test(env().STRIPE_SECRET_KEY || '') } : { enabled: false });

const form = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) p.append(k, String(v));
  return p.toString();
};

// Crée une session Stripe Checkout. consentAt = horodatage du consentement exprès (contenu numérique livré immédiatement).
export async function createCheckout({ account, packId, consentAt }) {
  const pack = PACK_BY_ID[packId];
  if (!pack) throw new Error('Pack inconnu.');
  const body = form({
    mode: 'payment',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': pack.cents,
    'line_items[0][price_data][product_data][name]': `${pack.lunes} Lunes — Korvalune`,
    'line_items[0][price_data][product_data][description]': `${pack.label} : monnaie virtuelle du jeu Korvalune, sans valeur monétaire.`,
    client_reference_id: account,
    'metadata[account]': account,
    'metadata[pack]': pack.id,
    'metadata[consent]': consentAt,
    'payment_intent_data[metadata][account]': account,
    'payment_intent_data[metadata][pack]': pack.id,
    success_url: `${publicUrl()}/?paid=1`,
    cancel_url: `${publicUrl()}/?paid=0`
  });
  const r = await fetch(`${apiBase()}/v1/checkout/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env().STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j?.error?.message || `Stripe a répondu ${r.status}`);
  return { url: j.url, id: j.id };
}

// Vérifie l'en-tête « Stripe-Signature: t=...,v1=... » (HMAC-SHA256 du « t.corps »), avec tolérance anti-rejeu.
export function verifySignature(rawBody, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]; }));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  // plusieurs v1 possibles (rotation de secret) : on accepte si l'un correspond
  const sigs = String(header).split(',').filter((x) => x.trim().startsWith('v1=')).map((x) => x.trim().slice(3));
  for (const s of sigs) {
    let b; try { b = Buffer.from(s, 'hex'); } catch { continue; }
    if (b.length === expected.length && timingSafeEqual(b, expected)) return true;
  }
  return false;
}
