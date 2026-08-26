import { FILIERES, NIVEAUX, type ENSEIGNANTS } from "@/data/mockData";
import type { EcRecord } from "@/data/curriculumStore";
import type { UeRecord } from "@/data/curriculumStore";
import type { ClassePedagogiqueRecord } from "@/data/structureStore";
import type { SeanceRecord } from "@/data/studentStore";
import { matchesProf, type EnseignantRecord } from "@/lib/teacherUtils";

export interface TeacherCourseItem {
  id: string;
  ecId: string;
  classeId: string;
  filiereLabel: string;
  coursLabel: string;
  detailsLabel: string;
  volumeHoraire: number;
}

export function niveauLabel(alias: string): string {
  const n = NIVEAUX.find((x) => x.alias === alias);
  if (n) return n.nom;
  if (/^L\d$/i.test(alias)) return `Licence ${alias.slice(1)}`;
  if (/^M\d$/i.test(alias)) return `Master ${alias.slice(1)}`;
  return alias;
}

function filiereFullLabel(code: string): string {
  const f = FILIERES.find((x) => x.code === code);
  if (!f) return code;
  return `${f.nom.toUpperCase()} — ${f.code}`;
}

export function buildTeacherCourses(
  teacher: EnseignantRecord,
  seances: SeanceRecord[],
  ecs: EcRecord[],
  ues: UeRecord[],
  classes: ClassePedagogiqueRecord[],
  annee: string,
): TeacherCourseItem[] {
  const seen = new Set<string>();
  const items: TeacherCourseItem[] = [];

  const push = (ecId: string, classeId: string) => {
    const key = `${ecId}:${classeId}:${annee}`;
    if (seen.has(key)) return;
    seen.add(key);
    const ec = ecs.find((e) => e.id === ecId);
    const classe = classes.find((c) => c.id === classeId);
    if (!ec || !classe) return;
    if (classe.annee !== annee) return;
    const ue = ues.find((u) => u.id === ec.ueId);
    items.push({
      id: key,
      ecId,
      classeId,
      filiereLabel: filiereFullLabel(classe.filiere),
      coursLabel: `${ec.code} — ${ec.libelle}`,
      detailsLabel: [
        `Niveau : ${niveauLabel(classe.niveau)}`,
        `Classe : ${classe.nom}`,
        ue?.semestre ? `Session : ${ue.semestre}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      volumeHoraire: ec.vht,
    });
  };

  for (const s of seances.filter((s) => matchesProf(teacher, s.prof) && s.annee === annee)) {
    push(s.ecId, s.classeId);
  }

  for (const ec of ecs) {
    if (!matchesProf(teacher, ec.responsable) && !ec.responsable.includes(teacher.nom)) continue;
    const ue = ues.find((u) => u.id === ec.ueId);
    for (const classe of classes.filter((c) => c.filiere === ue?.filiere && c.annee === annee)) {
      push(ec.id, classe.id);
    }
  }

  return items.sort((a, b) => a.coursLabel.localeCompare(b.coursLabel, "fr"));
}

export type Enseignant = (typeof ENSEIGNANTS)[number];
