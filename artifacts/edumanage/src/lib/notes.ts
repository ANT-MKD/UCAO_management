/** Règle de l'UCAO : jamais d'arrondi. Une moyenne est coupée au centième — 9,996 s'affiche 9,99
 * et reste sous 10, exactement comme la décision prise sur la valeur exacte. Le petit epsilon
 * neutralise les erreurs de calcul en virgule flottante (12,6 × 100 = 1259,9999…). */
export function tronquer(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.floor(n * f + 1e-9) / f;
}

/** Affichage d'une note ou d'une moyenne, coupée (jamais arrondie) ; « — » si absente. */
export function formatNote(n: number | undefined | null, decimales = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return tronquer(n, decimales).toFixed(decimales);
}

/** Comparaison à un seuil (10, 12…) sans être piégé par la virgule flottante : une moyenne qui
 * vaut exactement 10 ne doit jamais tomber à 9,9999999 et rater sa validation. */
export function atteint(valeur: number, seuil: number): boolean {
  return valeur >= seuil - 1e-9;
}
