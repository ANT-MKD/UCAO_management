import type { ENSEIGNANTS } from "@/data/mockData";

export type EnseignantRecord = (typeof ENSEIGNANTS)[number] & { telephone?: string };

export function stripTitle(prenom: string): string {
  return prenom.replace(/^(Pr\.|Dr\.|M\.|Me\.)\s*/i, "").trim();
}

export function teacherProfLabel(teacher: EnseignantRecord): string {
  return `${stripTitle(teacher.prenom)} ${teacher.nom}`;
}

export function teacherDisplayLabel(teacher: EnseignantRecord): string {
  const tel = teacher.telephone ? ` (${teacher.telephone})` : "";
  return `${teacher.matricule} - ${teacher.prenom} ${teacher.nom}${tel} | ${teacher.grade}`;
}

function normaliserNom(texte: string): string {
  return stripTitle(texte.trim()).toLowerCase().replace(/\s+/g, " ");
}

/** Ce cours / cette séance appartient-il à ce professeur ? Par identifiant dès qu'il est connu
 * (seul lien fiable : deux enseignants peuvent porter le même nom). Sans identifiant (données
 * saisies avant son ajout), on exige le nom complet exact, prénom-nom ou nom-prénom, titre
 * ignoré — jamais le seul nom de famille, très souvent partagé (DIALLO, NDIAYE, FALL...). */
export function matchesProf(teacher: EnseignantRecord, profLabel: string | undefined, profId?: string): boolean {
  if (profId) return profId === teacher.id;
  const label = normaliserNom(profLabel ?? "");
  if (!label) return false;
  const prenom = normaliserNom(teacher.prenom);
  const nom = normaliserNom(teacher.nom);
  return label === `${prenom} ${nom}` || label === `${nom} ${prenom}`;
}

export function filterTeachers(
  teachers: EnseignantRecord[],
  query: string,
): EnseignantRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return teachers;
  return teachers.filter(
    (t) =>
      t.matricule.toLowerCase().includes(q) ||
      t.prenom.toLowerCase().includes(q) ||
      t.nom.toLowerCase().includes(q) ||
      (t.telephone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
      stripTitle(t.prenom).toLowerCase().includes(q),
  );
}

export function seanceDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dateToJour(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  return dow === 0 ? 7 : dow;
}

/** Lundi (date ISO) de la semaine contenant cette date — l'emploi du temps est propre à
 * chaque semaine (pas un modèle qui se répète à l'identique), donc toute comparaison de
 * créneau doit se faire à la fois sur le jour ET la semaine. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** V.H pointé en heures — pointages soumis/validés, sinon cahiers, sinon séances planifiées. */
export function computeVhPointe(
  teacher: EnseignantRecord,
  ecId: string,
  classeId: string,
  annee: string,
  cahiers: { ecId: string; classeId: string; annee: string; prof: string; profId?: string; heureDebut: string; heureFin: string; etatSeance?: string }[],
  seances: { ecId: string; classeId: string; annee: string; prof: string; profId?: string; heureDebut: string; heureFin: string }[],
  pointages: { teacherId: string; ecId: string; classeId: string; annee: string; volumePointe: number; statut: string }[] = [],
): number {
  const pointedRows = pointages.filter(
    (p) =>
      p.teacherId === teacher.id &&
      p.ecId === ecId &&
      p.classeId === classeId &&
      p.annee === annee &&
      (p.statut === "soumis" || p.statut === "valide"),
  );
  if (pointedRows.length > 0) {
    const total = pointedRows.reduce((sum, p) => sum + p.volumePointe, 0);
    return Math.round(total * 10) / 10;
  }

  const cahierRows = cahiers.filter(
    (c) =>
      c.ecId === ecId &&
      c.classeId === classeId &&
      c.annee === annee &&
      matchesProf(teacher, c.prof, c.profId) &&
      c.etatSeance !== "annulee",
  );
  const source =
    cahierRows.length > 0
      ? cahierRows
      : seances.filter(
          (s) =>
            s.ecId === ecId &&
            s.classeId === classeId &&
            s.annee === annee &&
            matchesProf(teacher, s.prof, s.profId),
        );
  const minutes = source.reduce(
    (sum, row) => sum + seanceDurationMinutes(row.heureDebut, row.heureFin),
    0,
  );
  return Math.round((minutes / 60) * 10) / 10;
}
