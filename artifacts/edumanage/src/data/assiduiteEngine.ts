import { getCahiers, getEtudiantById, durationHours } from "./studentStore";
import { getAbsencePeriodeCouvrant } from "./absencePeriodeStore";

/** Une ligne d'assiduité = une absence ou un retard réellement constaté par un cahier de
 * textes soumis (jamais un brouillon) — jamais ressaisi ailleurs. Justifie() vérifie d'abord la
 * justification posée directement sur la présence (Nouvelle assiduité), puis si une déclaration
 * d'Absence par période couvre cette date pour cet étudiant. */
export interface AssiduiteRow {
  id: string;
  cahierId: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  ec: string;
  classeId: string;
  classe: string;
  filiere: string;
  niveau: string;
  annee: string;
  semestre: string;
  date: string;
  prof: string;
  type: "absence" | "retard";
  retardMinutes?: number;
  justifie: boolean;
  justification?: string;
  couvertParPeriode: boolean;
}

export function getAssiduiteRows(): AssiduiteRow[] {
  const cahiers = getCahiers();
  const rows: AssiduiteRow[] = [];
  for (const c of cahiers) {
    if (c.statut === "brouillon") continue;
    for (const p of c.presences) {
      if (p.statut === "present") continue;
      const periode = getAbsencePeriodeCouvrant(p.etudiantId, c.date);
      const justifie = !!p.justification || !!(periode && periode.justifie);
      const etudiant = getEtudiantById(p.etudiantId);
      rows.push({
        id: `${c.id}-${p.etudiantId}`,
        cahierId: c.id,
        etudiantId: p.etudiantId,
        etudiant: p.nom,
        matricule: etudiant?.matricule ?? "—",
        ec: c.ec,
        classeId: c.classeId,
        classe: c.classe,
        filiere: c.filiere,
        niveau: c.niveau,
        annee: c.annee,
        semestre: c.semestre,
        date: c.date,
        prof: c.prof,
        type: p.statut === "absent" ? "absence" : "retard",
        retardMinutes: p.retardMinutes,
        justifie,
        justification: p.justification || (periode?.justifie ? `Couvert par déclaration de période — ${periode.motif}` : undefined),
        couvertParPeriode: !!periode,
      });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function getAssiduiteRowsPourEtudiant(etudiantId: string): AssiduiteRow[] {
  return getAssiduiteRows().filter((r) => r.etudiantId === etudiantId);
}

/** Taux de présence réel d'un étudiant : séances où il a été noté présent, sur toutes les
 * séances où il apparaît dans un cahier de textes réellement soumis — jamais un total de
 * séances fabriqué. */
export function getTauxPresencePourEtudiant(etudiantId: string): { present: number; total: number; pct: number } {
  const cahiers = getCahiers().filter((c) => c.statut !== "brouillon");
  let present = 0;
  let total = 0;
  for (const c of cahiers) {
    const p = c.presences.find((x) => x.etudiantId === etudiantId);
    if (!p) continue;
    total++;
    if (p.statut === "present") present++;
  }
  return { present, total, pct: total > 0 ? Math.round((present / total) * 100) : 100 };
}

/** Heures d'absence réellement non justifiées d'un étudiant pour une classe/session — utilisées
 * par Délibérations pour la décision d'exclusion disciplinaire. Une absence justifiée (par le
 * cahier ou couverte par une déclaration de période) ne compte jamais contre l'étudiant. */
export function getHeuresAbsenceNonJustifieePourEtudiant(etudiantId: string, classeId: string, semestreAlias: string): number {
  const cahiers = getCahiers().filter((c) => c.statut !== "brouillon" && c.classeId === classeId && c.semestre === semestreAlias);
  let heures = 0;
  for (const c of cahiers) {
    const p = c.presences.find((x) => x.etudiantId === etudiantId);
    if (!p || p.statut !== "absent" || p.justification) continue;
    const periode = getAbsencePeriodeCouvrant(etudiantId, c.date);
    if (periode?.justifie) continue;
    heures += durationHours(c.heureDebut, c.heureFin);
  }
  return Math.round(heures * 10) / 10;
}
