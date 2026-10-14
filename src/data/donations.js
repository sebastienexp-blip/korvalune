// V10.55 — Dons PayPal et Lunes de remerciement. Fichier partagé : le jeu affiche le barème, le serveur calcule (jamais le client).
// Un don est libre et sans contrepartie obligatoire ; en remerciement, le créateur offre des Lunes : 100 par euro,
// avec un bonus qui grandit avec le don : +10 % dès 3 €, +20 % dès 5 €, +50 % dès 10 € (1 500), +60 % dès 20 €, +70 % dès 50 €, +100 % dès 100 €.
export const DON_MIN = 1;      // euros
export const DON_MAX = 200;
export const DON_PER_EURO = 100;
export const DON_BONUS = [[100, 1], [50, 0.7], [20, 0.6], [10, 0.5], [5, 0.2], [3, 0.1]]; // [seuil en €, bonus]
export const DON_EXAMPLES = [1, 3, 5, 10, 20, 50];

export function thanksLunes(euros) {
  const e = Number(euros);
  if (!Number.isFinite(e) || e < DON_MIN) return 0;
  const bonus = (DON_BONUS.find(([min]) => e >= min) || [0, 0])[1];
  return Math.round(Math.min(e, DON_MAX) * DON_PER_EURO * (1 + bonus));
}
