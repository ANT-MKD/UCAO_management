import type { VacationRecord } from "@/data/vacationStore";
import type { DecompteRecord } from "@/data/decompteStore";

const MOIS_FR: Record<string, string> = {
  "janvier": "01", "février": "02", "mars": "03", "avril": "04", "mai": "05", "juin": "06",
  "juillet": "07", "août": "08", "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
};

/** "Octobre 2025" -> "2025-10" (même format que le préfixe d'une date ISO), ou null si le libellé
 * ne suit pas le format "Mois AAAA" attendu (garde-fou silencieux plutôt qu'un plantage). */
export function moisLabelToYearMonth(mois: string): string | null {
  const [nom, annee] = mois.trim().toLowerCase().split(/\s+/);
  const moisNum = MOIS_FR[nom];
  if (!moisNum || !/^\d{4}$/.test(annee ?? "")) return null;
  return `${annee}-${moisNum}`;
}

/** Un décompte non annulé de ce professeur contient-il déjà une ligne (séance pointée) datée dans
 * ce mois de vacation ? Vacations et décomptes taux horaire rémunèrent le même type d'heures
 * (CM/TD) sans se vérifier entre eux — ce croisement est le seul garde-fou anti-double-paiement. */
export function findDecompteChevauchantVacation(
  teacherId: string,
  mois: string,
  decomptes: DecompteRecord[],
): DecompteRecord | undefined {
  const yearMonth = moisLabelToYearMonth(mois);
  if (!yearMonth) return undefined;
  return decomptes.find(
    (d) => d.teacherId === teacherId && d.statut !== "annule" && d.lignes.some((l) => l.date.startsWith(yearMonth)),
  );
}

/** Une vacation (tout statut confondu — même un brouillon signale une intention de paiement) de ce
 * professeur couvre-t-elle un mois qui apparaît parmi les dates de séances proposées pour un
 * décompte taux horaire ? */
export function findVacationChevauchantDecompte(
  teacherId: string,
  dates: string[],
  vacations: VacationRecord[],
): VacationRecord | undefined {
  const yearMonths = new Set(dates.map((d) => d.slice(0, 7)));
  return vacations.find((v) => {
    if (v.enseignantId !== teacherId) return false;
    const yearMonth = moisLabelToYearMonth(v.mois);
    return yearMonth ? yearMonths.has(yearMonth) : false;
  });
}
