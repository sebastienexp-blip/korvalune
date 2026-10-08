// V10.1 — Boutique des Lunes côté serveur : SEULE source de vérité pour le solde, les achats et l'équipement.
// Le client ne peut jamais décider qu'il possède un objet : il envoie une demande, le serveur valide et répond.
import { CATALOG_BY_ID, COSMETIC_SLOTS, LUNES } from '../src/data/shopCatalog.js';
import { PACK_BY_ID, payView } from './payments.js';

const today = () => new Date().toISOString().slice(0, 10); // jour UTC

export function ensureShop(acc) {
  if (!acc.shop || typeof acc.shop !== 'object') {
    acc.shop = { gems: LUNES.welcome, owned: [], eq: {}, lvlMax: 1, daily: '' };
  }
  const s = acc.shop;
  s.gems = Number.isFinite(s.gems) ? Math.max(0, Math.floor(s.gems)) : 0;
  s.owned = Array.isArray(s.owned) ? s.owned.filter((id) => CATALOG_BY_ID[id]) : [];
  s.eq = s.eq && typeof s.eq === 'object' ? s.eq : {};
  s.lvlMax = Number.isFinite(s.lvlMax) ? Math.max(1, Math.floor(s.lvlMax)) : 1;
  s.daily = typeof s.daily === 'string' ? s.daily : '';
  // un équipement n'est valide que si l'objet est possédé et du bon type
  for (const slot of COSMETIC_SLOTS) {
    const id = s.eq[slot];
    if (id && !(s.owned.includes(id) && CATALOG_BY_ID[id]?.cat === slot)) delete s.eq[slot];
  }
  return s;
}

export const bankTabsOf = (acc) => ensureShop(acc).owned.filter((id) => CATALOG_BY_ID[id]?.perk === 'bank').length;

// Taille maximale du coffre autorisée pour ce compte (120 de base + 30 par onglet acheté)
export const bankCapOf = (acc) => 120 + 30 * Math.min(LUNES.maxBankTabs, bankTabsOf(acc));

// Cosmétiques équipés, visibles par les autres joueurs (identifiants uniquement, jamais d'autres données du compte)
export function publicCos(acc) {
  const s = ensureShop(acc);
  const out = {};
  for (const slot of COSMETIC_SLOTS) if (s.eq[slot]) out[slot] = s.eq[slot];
  return out;
}

export function shopView(acc) {
  const s = ensureShop(acc);
  return { t: 'shop', gems: s.gems, owned: s.owned, eq: { ...s.eq }, bankTabs: bankTabsOf(acc), dailyReady: s.daily !== today(), dailyAmount: LUNES.daily, pay: payView() };
}

// -> { ok, error? }
export function buy(acc, id) {
  const s = ensureShop(acc);
  const it = CATALOG_BY_ID[typeof id === 'string' ? id : ''];
  if (!it) return { ok: false, error: 'Objet inconnu.' };
  if (s.owned.includes(it.id)) return { ok: false, error: 'Tu possèdes déjà cet objet.' };
  if (it.requires && !s.owned.includes(it.requires)) return { ok: false, error: 'Achète d’abord l’onglet précédent.' };
  if (s.gems < it.price) return { ok: false, error: `Il te manque ${it.price - s.gems} Lunes.` };
  s.gems -= it.price;
  s.owned.push(it.id);
  return { ok: true, item: it };
}

// slot : 'aura' | 'ring' | 'trail' | 'wings' | 'title' ; id = null pour retirer
export function equip(acc, slot, id) {
  const s = ensureShop(acc);
  if (!COSMETIC_SLOTS.includes(slot)) return { ok: false, error: 'Emplacement invalide.' };
  if (id == null) { delete s.eq[slot]; return { ok: true }; }
  const it = CATALOG_BY_ID[id];
  if (!it || it.cat !== slot) return { ok: false, error: 'Objet invalide.' };
  if (!s.owned.includes(id)) return { ok: false, error: 'Tu ne possèdes pas cet objet.' };
  s.eq[slot] = id;
  return { ok: true };
}

export function claimDaily(acc) {
  const s = ensureShop(acc);
  if (s.daily === today()) return { ok: false, error: 'Récompense déjà récupérée aujourd’hui. Reviens demain !' };
  s.daily = today();
  s.gems += LUNES.daily;
  return { ok: true, amount: LUNES.daily };
}

// Gain de Lunes par PALIER de niveau (tous les `levelStep` niveaux), sur le record du compte : créer d'autres personnages ne rapporte rien de plus.
// Le niveau lu ici est celui déjà borné par la validation de sauvegarde. -> nombre de Lunes gagnées
export function levelReward(acc, level) {
  const s = ensureShop(acc);
  const lv = Number.isFinite(level) ? Math.max(1, Math.min(200, Math.floor(level))) : 1;
  if (lv <= s.lvlMax) return 0;
  const steps = Math.floor(lv / LUNES.levelStep) - Math.floor(s.lvlMax / LUNES.levelStep);
  s.lvlMax = lv;
  const gain = Math.max(0, steps) * LUNES.perStep;
  s.gems += gain;
  return gain;
}

// V10.2 — crédite un achat de Lunes payé via Stripe. Idempotent : Stripe peut renvoyer le même événement plusieurs fois.
// `session` = objet Checkout Session reçu par webhook (déjà authentifié par signature). On revérifie pack, devise et montant.
export function creditPayment(acc, session) {
  const s = ensureShop(acc);
  if (!session || session.payment_status !== 'paid') return { ok: false, reason: 'non payé' };
  const pack = PACK_BY_ID[typeof session.metadata?.pack === 'string' ? session.metadata.pack : ''];
  if (!pack) return { ok: false, reason: 'pack inconnu' };
  if (String(session.currency).toLowerCase() !== 'eur' || session.amount_total !== pack.cents) return { ok: false, reason: 'montant incohérent' };
  if (typeof session.id !== 'string') return { ok: false, reason: 'session invalide' };
  s.paid = Array.isArray(s.paid) ? s.paid : [];
  if (s.paid.some((p) => p.id === session.id)) return { ok: true, duplicate: true, lunes: 0 };
  s.gems += pack.lunes;
  s.paid.push({ id: session.id, pack: pack.id, lunes: pack.lunes, cents: pack.cents, at: new Date().toISOString(), consent: String(session.metadata?.consent || '').slice(0, 40) });
  if (s.paid.length > 300) s.paid = s.paid.slice(-300);
  return { ok: true, lunes: pack.lunes };
}
