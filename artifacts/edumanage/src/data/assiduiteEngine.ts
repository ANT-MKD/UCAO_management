import { getCahiers, getEtudiantById, durationHours } from "./studentStore";
import { getAbsencePeriodeCouvrant } from "./absencePeriodeStore";
import { mondayOf } from "@/lib/teacherUtils";

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
  heureDebut: string;
  heureFin: string;
  salle: string;
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
        heureDebut: c.heureDebut,
        heureFin: c.heureFin,
        salle: c.salle,
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
 * séances fabriqué. Filtrable par semestre (alias réel, ex. "S1") pour scoper aux séances de
 * la période sélectionnée plutôt qu'à l'historique complet. */
export function getTauxPresencePourEtudiant(etudiantId: string, semestreAlias?: string): { present: number; total: number; pct: number } {
  const cahiers = getCahiers().filter((c) => c.statut !== "brouillon" && (!semestreAlias || c.semestre === semestreAlias));
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

export interface PresenceHebdo {
  semaineLabel: string;
  weekStart: string;
  present: number;
  total: number;
  pct: number;
}

/** Évolution réelle de la présence semaine par semaine — une entrée seulement pour chaque
 * semaine où l'étudiant apparaît dans au moins un cahier réellement soumis, jamais une semaine
 * future ou vide comblée artificiellement. */
export function getPresenceHebdoPourEtudiant(etudiantId: string, semestreAlias?: string): PresenceHebdo[] {
  const cahiers = getCahiers().filter((c) => c.statut !== "brouillon" && (!semestreAlias || c.semestre === semestreAlias));
  const parSemaine = new Map<string, { present: number; total: number }>();
  for (const c of cahiers) {
    const p = c.presences.find((x) => x.etudiantId === etudiantId);
    if (!p) continue;
    const weekStart = mondayOf(c.date);
    const entry = parSemaine.get(weekStart) ?? { present: 0, total: 0 };
    entry.total++;
    if (p.statut === "present") entry.present++;
    parSemaine.set(weekStart, entry);
  }
  return [...parSemaine.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, e], i) => ({
      semaineLabel: `Sem. ${i + 1}`,
      weekStart,
      present: e.present,
      total: e.total,
      pct: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
    }));
}

export interface PresenceParEc {
  ec: string;
  present: number;
  total: number;
  pct: number;
}

/** Taux de présence réel par matière (EC) — permet de repérer les cours où l'assiduité décroche,
 * jamais une moyenne globale déguisée en détail par matière. */
export function getPresenceParEcPourEtudiant(etudiantId: string, semestreAlias?: string): PresenceParEc[] {
  const cahiers = getCahiers().filter((c) => c.statut !== "brouillon" && (!semestreAlias || c.semestre === semestreAlias));
  const parEc = new Map<string, { present: number; total: number }>();
  for (const c of cahiers) {
    const p = c.presences.find((x) => x.etudiantId === etudiantId);
    if (!p) continue;
    const entry = parEc.get(c.ec) ?? { present: 0, total: 0 };
    entry.total++;
    if (p.statut === "present") entry.present++;
    parEc.set(c.ec, entry);
  }
  return [...parEc.entries()]
    .map(([ec, e]) => ({ ec, present: e.present, total: e.total, pct: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
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
