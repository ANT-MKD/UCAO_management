import type { PaiementRecord } from "@/data/studentStore";
import type { DecompteRecord } from "@/data/decompteStore";
import type { DeliberationRecord } from "@/data/deliberationStore";
import type { AssiduiteRow } from "@/data/assiduiteEngine";

import { getAnneesAcademiques } from "@/data/studentStore";

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

/** Les mois d'une année académique, de sa rentrée réelle à sa date de fin (Paramétrage
 * académique → dates de l'année) — une année qui commence en novembre commence en novembre.
 * Sans dates renseignées, septembre → août, pour ne perdre aucun encaissement de l'été. */
export function moisAcademiques(anneeLibelle: string): { label: string; year: number; month: number }[] {
  const annee = getAnneesAcademiques().find((a) => a.libelle === anneeLibelle);
  let y: number, m: number, nb: number;
  if (annee?.dateDebut && annee.dateFin && annee.dateFin >= annee.dateDebut) {
    y = Number(annee.dateDebut.slice(0, 4));
    m = Number(annee.dateDebut.slice(5, 7));
    nb = (Number(annee.dateFin.slice(0, 4)) - y) * 12 + (Number(annee.dateFin.slice(5, 7)) - m) + 1;
  } else {
    const y1 = parseInt(anneeLibelle.split("-")[0] ?? "", 10);
    y = Number.isFinite(y1) ? y1 : new Date().getFullYear();
    m = 9;
    nb = 12;
  }
  return Array.from({ length: nb }, (_, i) => {
    const month = ((m - 1 + i) % 12) + 1;
    const year = y + Math.floor((m - 1 + i) / 12);
    return { label: MOIS_COURTS[month - 1], year, month };
  });
}

export function libelleFenetreAcademique(anneeLibelle: string): string {
  const mois = moisAcademiques(anneeLibelle);
  const premier = mois[0];
  const dernier = mois[mois.length - 1];
  return `${premier.label} ${premier.year} – ${dernier.label} ${dernier.year}`;
}

export interface PointFinancier {
  mois: string;
  recettes: number;
  depenses: number;
}

/** Recettes = paiements réellement encaissés ce mois-là. Décaissements enseignants = décomptes
 * effectivement payés (montantPaye) ce mois-là — la seule sortie de trésorerie récurrente
 * réellement suivie par l'appli, donc la meilleure approximation honnête de "dépenses". */
export function calculerEvolutionFinanciere(
  paiements: PaiementRecord[],
  decomptes: DecompteRecord[],
  anneeLibelle: string,
): PointFinancier[] {
  return moisAcademiques(anneeLibelle).map(({ label, year, month }) => {
    const recettes = paiements
      .filter((p) => {
        if (p.statut === "annule") return false;
        const d = new Date(p.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((s, p) => s + p.montant, 0);
    const depenses = decomptes
      .filter((d) => {
        if (d.statut === "annule" || d.montantPaye <= 0) return false;
        const dt = new Date(d.date);
        return dt.getFullYear() === year && dt.getMonth() + 1 === month;
      })
      .reduce((s, d) => s + d.montantPaye, 0);
    return { mois: label, recettes, depenses };
  });
}

export const PALETTE = ["#4f46e5", "#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9", "#ec4899"];

export interface TauxReussiteFiliere {
  name: string;
  value: number;
  color: string;
}

/** Taux de réussite = part des lignes de délibération "admis" sur l'ensemble des lignes
 * connues pour cette filière (toutes classes/semestres confondus) — rien n'apparaît tant
 * qu'aucune délibération réelle n'a été effectuée pour la filière. */
export function calculerTauxReussiteParFiliere(
  deliberations: DeliberationRecord[],
  filieres: { id: string; code: string }[],
): TauxReussiteFiliere[] {
  const resultats: TauxReussiteFiliere[] = [];
  filieres.forEach((f, i) => {
    const lignes = deliberations.filter((d) => d.filiereId === f.id).flatMap((d) => d.lignes);
    if (lignes.length === 0) return;
    const admis = lignes.filter((l) => l.decisionFinale === "admis").length;
    resultats.push({ name: f.code, value: Math.round((admis / lignes.length) * 100), color: PALETTE[i % PALETTE.length] });
  });
  return resultats;
}

/** Évolution du taux de réussite par semestre délibéré (tous ceux enregistrés, triés
 * chronologiquement par date de délibération), avec une colonne par filière. */
export function calculerReussiteParSemestre(
  deliberations: DeliberationRecord[],
  filieres: { id: string; code: string }[],
): Record<string, number | string>[] {
  const semestresVus = new Map<string, DeliberationRecord[]>();
  for (const d of [...deliberations].sort((a, b) => a.dateDeliberation.localeCompare(b.dateDeliberation))) {
    const cle = `${d.semestre} ${d.annee}`;
    if (!semestresVus.has(cle)) semestresVus.set(cle, []);
    semestresVus.get(cle)!.push(d);
  }
  return [...semestresVus.entries()].map(([semestre, records]) => {
    const row: Record<string, number | string> = { semestre };
    for (const f of filieres) {
      const lignes = records.filter((d) => d.filiereId === f.id).flatMap((d) => d.lignes);
      if (lignes.length > 0) {
        row[f.code] = Math.round((lignes.filter((l) => l.decisionFinale === "admis").length / lignes.length) * 100);
      }
    }
    return row;
  });
}

export interface PointAbsences {
  mois: string;
  justifiees: number;
  nonJustifiees: number;
}

/** Absences constatées par cahier de textes (jamais un total fabriqué), regroupées par mois
 * de l'année académique sélectionnée. */
export function calculerAbsencesParMois(rows: AssiduiteRow[], anneeLibelle: string): PointAbsences[] {
  return moisAcademiques(anneeLibelle).map(({ label, year, month }) => {
    const duMois = rows.filter((r) => {
      if (r.type !== "absence") return false;
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    return {
      mois: label,
      justifiees: duMois.filter((r) => r.justifie).length,
      nonJustifiees: duMois.filter((r) => !r.justifie).length,
    };
  });
}
