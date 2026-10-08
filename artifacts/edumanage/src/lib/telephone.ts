/** Numéro de téléphone saisi librement (portails, dossiers) : chiffres avec espaces, points, tirets
 * ou parenthèses, « + » de l'indicatif en tête, et 8 à 15 chiffres au total (Sénégal : 9 chiffres,
 * Togo : 8, avec indicatif jusqu'à 12). Un champ vide reste accepté : le téléphone est facultatif. */
export function telephoneValide(valeur: string): boolean {
  const t = valeur.trim();
  if (!t) return true;
  if (!/^\+?[\d\s.\-()]+$/.test(t)) return false;
  const chiffres = t.replace(/\D/g, "").length;
  return chiffres >= 8 && chiffres <= 15;
}

export const TELEPHONE_EXEMPLE = "+221 77 123 45 67";
