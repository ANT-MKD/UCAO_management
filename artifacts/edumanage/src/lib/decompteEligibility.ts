import type { SeanceRecord } from "@/data/studentStore";
import type { EcRecord, UeRecord } from "@/data/curriculumStore";
import type { ClassePedagogiqueRecord } from "@/data/structureStore";
import type { TeacherCourseRateRecord } from "@/data/teacherRateStore";
import type { TeacherCourseStatusRecord } from "@/data/teacherCourseStatusStore";
import type { PointageRecord } from "@/data/pointageStore";
import type { EnseignantRecord } from "@/lib/teacherUtils";
import { makeTeacherRateId, TAUX_ABATTEMENT_DEFAUT } from "@/data/teacherRateStore";
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
  tauxHoraire: number;
  /** "fiche" : aucun taux saisi pour ce cours, celui de la fiche du professeur s'applique. */
  sourceTaux: "cours" | "fiche";
}

/** Pourquoi des pointages validés et pas encore décomptés n'apparaissent pas dans le décompte au
 * taux horaire — affiché à la place d'un simple « aucun pointage » qui laissait croire qu'il n'y
 * avait rien à payer. */
export interface DiagnosticDecompte {
  /** Aucun taux pour le cours et aucun taux horaire sur la fiche du professeur. */
  sansTaux: number;
  /** Cours payés au forfait : décompte « Forfait ». */
  forfait: number;
  /** Cours comptabilisés à terme : décompte « À terme ». */
  aTerme: number;
  /** Cours qui n'existe plus pour cette année (EC ou classe supprimée, autre année). */
  horsCours: number;
  /** Pointages soumis ou en brouillon, pas encore validés. */
  enAttente: number;
}

export interface TauxApplicable {
  montant: number;
  tauxAbatt: number;
  source: "cours" | "fiche";
}

/** Taux saisi pour le cours (Professeurs › Taux horaire / Forfait) ; à défaut, le taux horaire de
 * la fiche du professeur avec l'abattement par défaut — les valeurs que cet écran propose déjà. Un
 * cours payé au forfait n'a pas de taux horaire. */
export function tauxHoraireApplicable(teacher: EnseignantRecord, rate: TeacherCourseRateRecord | undefined): TauxApplicable | "forfait" | null {
  if (rate?.modePaiement === "forfait") return "forfait";
  if (rate?.modePaiement === "taux_horaire" && rate.montant != null) return { montant: rate.montant, tauxAbatt: rate.tauxAbatt, source: "cours" };
  const tauxFiche = Number(teacher.tauxHoraire) || 0;
  if (tauxFiche > 0) return { montant: tauxFiche, tauxAbatt: rate?.tauxAbatt ?? TAUX_ABATTEMENT_DEFAUT, source: "fiche" };
  return null;
}

/** Pointages validés, payés au taux horaire, pas encore inclus dans un décompte — exactement le
 * même calcul que celui utilisé pour générer un décompte (DecompteTauxHoraireFormPage), factorisé
 * ici pour qu'une estimation affichée ailleurs (ex. "Mon volume horaire") corresponde toujours à ce
 * que l'admin obtiendrait en générant réellement le décompte, sans dupliquer la logique. */
export function computeEligibleDecompteLines(...args: Parameters<typeof analyserDecompteTauxHoraire>): EligibleDecompteLine[] {
  return analyserDecompteTauxHoraire(...args).lines;
}

export function analyserDecompteTauxHoraire(
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
): { lines: EligibleDecompteLine[]; diagnostic: DiagnosticDecompte } {
  const courseItems = buildTeacherCourses(teacher, seances, ecs, ues, classes, annee);
  const lines: EligibleDecompteLine[] = [];
  const diagnostic: DiagnosticDecompte = { sansTaux: 0, forfait: 0, aTerme: 0, horsCours: 0, enAttente: 0 };
  const aPayer = pointages.filter(
    (p) => p.teacherId === teacher.id && p.annee === annee && p.statut === "valide" && !pointageIdsDejaDecomptes.has(p.id),
  );
  diagnostic.enAttente = pointages.filter(
    (p) => p.teacherId === teacher.id && p.annee === annee && (p.statut === "soumis" || p.statut === "brouillon"),
  ).length;
  diagnostic.horsCours = aPayer.filter((p) => !courseItems.some((c) => c.ecId === p.ecId && c.classeId === p.classeId)).length;
  for (const course of courseItems) {
    const coursPointages = aPayer.filter((p) => p.ecId === course.ecId && p.classeId === course.classeId);
    const statusId = makeTeacherCourseStatusId(teacher.id, course.ecId, course.classeId, annee);
    const status = teacherCourseStatuses.find((s) => s.id === statusId);
    if (status?.typeComptabilisation === "a_terme") { diagnostic.aTerme += coursPointages.length; continue; } // décompte "À terme"
    const rateId = makeTeacherRateId(teacher.id, course.ecId, course.classeId, annee);
    const taux = tauxHoraireApplicable(teacher, teacherRates.find((r) => r.id === rateId));
    if (taux === "forfait") { diagnostic.forfait += coursPointages.length; continue; }
    if (!taux) { diagnostic.sansTaux += coursPointages.length; continue; }
    const classe = classes.find((c) => c.id === course.classeId);
    const ec = ecs.find((e) => e.id === course.ecId);
    const ue = ec ? ues.find((u) => u.id === ec.ueId) : undefined;
    for (const p of coursPointages) {
      const montantBrut = p.volumePointe * taux.montant;
      const abattementMontant = (montantBrut * taux.tauxAbatt) / 100;
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
        abattementPct: taux.tauxAbatt,
        abattementMontant,
        montantNet: montantBrut - abattementMontant,
        tauxHoraire: taux.montant,
        sourceTaux: taux.source,
      });
    }
  }
  return { lines: lines.sort((a, b) => a.date.localeCompare(b.date)), diagnostic };
}
