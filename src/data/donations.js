// V10.55 — Dons PayPal et Lunes de remerciement. Fichier partagé : le jeu affiche le barème, le serveur calcule (jamais le client).
// Un don est libre et sans contrepartie obligatoire ; en remerciement, le créateur offre des Lunes : 100 par euro,
// avec un bonus de générosité par palier (+10 % dès 5 €, +20 % dès 10 €, +30 % dès 25 €).
export const DON_MIN = 1;      // euros
export const DON_MAX = 200;
export const DON_PER_EURO = 100;
export const DON_BONUS = [[25, 0.3], [10, 0.2], [5, 0.1]]; // [seuil en €, bonus]
export const DON_EXAMPLES = [2, 5, 10, 25];

export function thanksLunes(euros) {
  const e = Number(euros);
  if (!Number.isFinite(e) || e < DON_MIN) return 0;
  const bonus = (DON_BONUS.find(([min]) => e >= min) || [0, 0])[1];
  return Math.round(Math.min(e, DON_MAX) * DON_PER_EURO * (1 + bonus));
}
