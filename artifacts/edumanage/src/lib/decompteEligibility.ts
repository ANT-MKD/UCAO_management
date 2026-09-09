import type { SeanceRecord } from "@/data/studentStore";
import type { EcRecord, UeRecord } from "@/data/curriculumStore";
import type { ClassePedagogiqueRecord } from "@/data/structureStore";
import type { TeacherCourseRateRecord } from "@/data/teacherRateStore";
import type { TeacherCourseStatusRecord } from "@/data/teacherCourseStatusStore";
import type { PointageRecord } from "@/data/pointageStore";
import type { EnseignantRecord } from "@/lib/teacherUtils";
import { makeTeacherRateId } from "@/data/teacherRateStore";
import { makeTeacherCourseStatusId } from "@/data/teacherCourseStatusStore";
import { buildTeacherCourses, niveauLabel } from "@/lib/teacherCourseUtils";

export interface EligibleDecompteLine {
  pointageId: string;
  ecId: string;
  classeId: string;
  coursLabel: string;
  duree: number;
  date: string;
  niveauLabel: string;
  classeLabel: string;
  anneeLabel: string;
  semestreLabel: string;
  montantBrut: number;
  abattementPct: number;
  abattementMontant: number;
  montantNet: number;
}

/** Pointages validés, payés au taux horaire, pas encore inclus dans un décompte — exactement le
 * même calcul que celui utilisé pour générer un décompte (DecompteTauxHoraireFormPage), factorisé
 * ici pour qu'une estimation affichée ailleurs (ex. "Mon volume horaire") corresponde toujours à ce
 * que l'admin obtiendrait en générant réellement le décompte, sans dupliquer la logique. */
export function computeEligibleDecompteLines(
  teacher: EnseignantRecord,
  seances: SeanceRecord[],
  ecs: EcRecord[],
  ues: UeRecord[],
  classes: ClassePedagogiqueRecord[],
  annee: string,
  teacherRates: TeacherCourseRateRecord[],
  teacherCourseStatuses: TeacherCourseStatusRecord[],
  pointages: PointageRecord[],
  pointageIdsDejaDecomptes: Set<string>,
): EligibleDecompteLine[] {
  const courseItems = buildTeacherCourses(teacher, seances, ecs, ues, classes, annee);
  const lines: EligibleDecompteLine[] = [];
  for (const course of courseItems) {
    const rateId = makeTeacherRateId(teacher.id, course.ecId, course.classeId, annee);
    const rate = teacherRates.find((r) => r.id === rateId);
    if (!rate || rate.modePaiement !== "taux_horaire" || rate.montant == null) continue;
    const statusId = makeTeacherCourseStatusId(teacher.id, course.ecId, course.classeId, annee);
    const status = teacherCourseStatuses.find((s) => s.id === statusId);
    if (status?.typeComptabilisation === "a_terme") continue; // ces cours passent par le décompte "À terme"
    const classe = classes.find((c) => c.id === course.classeId);
    const ec = ecs.find((e) => e.id === course.ecId);
    const ue = ec ? ues.find((u) => u.id === ec.ueId) : undefined;
    const coursPointages = pointages.filter(
      (p) =>
        p.teacherId === teacher.id &&
        p.ecId === course.ecId &&
        p.classeId === course.classeId &&
        p.annee === annee &&
        p.statut === "valide" &&
        !pointageIdsDejaDecomptes.has(p.id),
    );
    for (const p of coursPointages) {
      const montantBrut = p.volumePointe * (rate.montant ?? 0);
      const abattementMontant = (montantBrut * rate.tauxAbatt) / 100;
      lines.push({
        pointageId: p.id,
        ecId: course.ecId,
        classeId: course.classeId,
        coursLabel: course.coursLabel,
        duree: p.volumePointe,
        date: p.date,
        niveauLabel: classe ? niveauLabel(classe.niveau) : "",
        classeLabel: classe?.nom ?? "",
        anneeLabel: annee,
        semestreLabel: ue?.semestre ?? "",
        montantBrut,
        abattementPct: rate.tauxAbatt,
        abattementMontant,
        montantNet: montantBrut - abattementMontant,
      });
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date));
}
