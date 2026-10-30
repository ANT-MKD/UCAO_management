import type { AnneeAcademiqueRecord } from "@/data/studentStore";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/** Première année civile d'un libellé "2026-2027" (2026), ou NaN si le libellé est mal formé. */
export function premiereAnneeCivile(libelle: string): number {
  return /^\d{4}-\d{4}$/.test(libelle) ? Number(libelle.slice(0, 4)) : NaN;
}

/** Mois couverts par une année académique, au format "Novembre 2026" attendu par
 * moisLabelToYearMonth (croisement vacations/décomptes). Suit les dates de début et de fin
 * réelles de l'année quand elles sont renseignées ; sinon, faute de mieux, septembre → août. */
export function moisDeLAnneeAcademique(annee: Pick<AnneeAcademiqueRecord, "libelle" | "dateDebut" | "dateFin">): string[] {
  let annee0: number;
  let mois0: number;
  let nbMois: number;
  if (annee.dateDebut && annee.dateFin && annee.dateFin >= annee.dateDebut) {
    annee0 = Number(annee.dateDebut.slice(0, 4));
    mois0 = Number(annee.dateDebut.slice(5, 7)) - 1;
    const anneeFin = Number(annee.dateFin.slice(0, 4));
    const moisFin = Number(annee.dateFin.slice(5, 7)) - 1;
    nbMois = (anneeFin - annee0) * 12 + (moisFin - mois0) + 1;
  } else {
    annee0 = premiereAnneeCivile(annee.libelle);
    if (!Number.isFinite(annee0)) return [];
    mois0 = 8; // septembre
    nbMois = 12;
  }
  return Array.from({ length: nbMois }, (_, i) => {
    const m = mois0 + i;
    return `${MOIS_NOMS[m % 12]} ${annee0 + Math.floor(m / 12)}`;
  });
}

/** Vérifie la cohérence des dates d'une année "AAAA-AAAA+1" : début dans la première année
 * civile, fin après le début et au plus tard dans la seconde. Renvoie le motif du refus, ou null. */
export function validerDatesAnnee(libelle: string, dateDebut: string, dateFin: string): string | null {
  if (!dateDebut || !dateFin) return "Renseignez la date de début et la date de fin.";
  const premiere = premiereAnneeCivile(libelle);
  if (!Number.isFinite(premiere)) return "Le libellé doit suivre le format 2026-2027.";
  if (Number(dateDebut.slice(0, 4)) !== premiere) return `La rentrée de l'année ${libelle} doit tomber en ${premiere}.`;
  if (dateFin <= dateDebut) return "La date de fin doit être postérieure à la date de début.";
  if (Number(dateFin.slice(0, 4)) > premiere + 1) return `L'année ${libelle} doit se terminer au plus tard en ${premiere + 1}.`;
  return null;
}

/** Décale une date ISO de `n` années (négatif = vers le passé ; 29 février → 28 février les
 * années non bissextiles). */
export function decalerDeNAns(dateIso: string, n: number): string {
  const [a, m, j] = dateIso.split("-").map(Number);
  const dernierJour = new Date(Date.UTC(a + n, m, 0)).getUTCDate();
  return `${a + n}-${String(m).padStart(2, "0")}-${String(Math.min(j, dernierJour)).padStart(2, "0")}`;
}

/** Décale une date ISO d'un an. */
export function decalerDUnAn(dateIso: string): string {
  return decalerDeNAns(dateIso, 1);
}

/** "2 nov. 2026" — affichage court d'une date ISO sans décalage de fuseau. */
export function formatDateCourte(dateIso: string): string {
  const [a, m, j] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
