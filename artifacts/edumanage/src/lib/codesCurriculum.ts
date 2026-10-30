/** Propositions automatiques pour la création des UE et des EC — toujours modifiables à la main. */

/** Prochain numéro libre après un préfixe : « LQHSES5U » + UE existantes U1, U3 → 4. */
function prochainNumero(prefixe: string, codesExistants: string[]): number {
  const p = prefixe.toUpperCase();
  const numeros = codesExistants
    .map((c) => c.toUpperCase())
    .filter((c) => c.startsWith(p))
    .map((c) => Number(c.slice(p.length)))
    .filter((n) => Number.isInteger(n) && n > 0);
  return numeros.length ? Math.max(...numeros) + 1 : 1;
}

/** Code d'UE : filière + semestre + U + numéro suivant (ex. LQHSES5U4). */
export function proposerCodeUe(filiereCode: string, semestreAlias: string, codesUeExistants: string[]): string {
  const prefixe = `${filiereCode}${semestreAlias}U`.toUpperCase();
  return `${prefixe}${prochainNumero(prefixe, codesUeExistants)}`;
}

/** Code d'EC : code de l'UE + E + numéro suivant (ex. LQHSES5U3E3). */
export function proposerCodeEc(codeUe: string, codesEcExistants: string[]): string {
  const prefixe = `${codeUe}E`.toUpperCase();
  return `${prefixe}${prochainNumero(prefixe, codesEcExistants)}`;
}

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "en", "a", "au", "aux", "pour", "par", "sur", "dans", "un", "une", "a"]);

/** Intitulé abrégé : initiales des mots importants (« Système de Management Intégré » → SMI). */
export function abregerIntitule(intitule: string): string {
  const mots = intitule
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((m) => m && !MOTS_VIDES.has(m.toLowerCase()));
  if (mots.length === 0) return "";
  if (mots.length === 1) return mots[0].slice(0, 4).toUpperCase();
  return mots.map((m) => (/^\d+$/.test(m) ? m : m[0])).join("").slice(0, 6).toUpperCase();
}
