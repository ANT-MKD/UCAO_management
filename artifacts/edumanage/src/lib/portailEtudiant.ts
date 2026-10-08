import type { EtudiantRecord, NoteRecord, SeanceRecord } from "@/data/studentStore";
import type { UeRecord, EcRecord } from "@/data/curriculumStore";
import { formatNote } from "@/lib/notes";

/** Libellés lisibles des types de note (codes internes CC / EF). */
export const TYPE_NOTE_LABELS: Record<string, string> = { CC: "Contrôle continu", EF: "Examen" };

export function libelleTypeNote(type: string, session?: string): string {
  const base = TYPE_NOTE_LABELS[type] ?? type;
  return session === "rattrapage" ? `${base} (rattrapage)` : base;
}

/** Statuts d'un dossier étudiant, avec la teinte du badge — "inscrit" et "actif" sont les deux
 * valeurs historiques d'un étudiant régulièrement inscrit. */
export const STATUTS_ETUDIANT: Record<string, { label: string; ton: "ok" | "attente" | "alerte" | "neutre" }> = {
  inscrit: { label: "Inscrit", ton: "ok" },
  actif: { label: "Inscrit", ton: "ok" },
  preinscrit: { label: "Préinscrit", ton: "attente" },
  en_attente: { label: "En attente", ton: "attente" },
  suspendu: { label: "Suspendu", ton: "alerte" },
  abandon: { label: "Abandon", ton: "neutre" },
};

export const TON_BADGE: Record<"ok" | "attente" | "alerte" | "neutre", string> = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  attente: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  alerte: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  neutre: "bg-muted text-muted-foreground",
};

export function statutEtudiant(statut: string | undefined): { label: string; className: string } {
  const s = STATUTS_ETUDIANT[statut ?? ""];
  if (!s) {
    const brut = (statut ?? "").replace(/_/g, " ");
    return { label: brut ? brut.charAt(0).toUpperCase() + brut.slice(1) : "—", className: TON_BADGE.neutre };
  }
  return { label: s.label, className: TON_BADGE[s.ton] };
}

/** Dernier semestre (dans l'ordre du niveau) qui a déjà des données ; à défaut, le premier. */
export function semestreLePlusAvance(semestres: string[], avecDonnees: Set<string>): string {
  const ordre = [...semestres].sort((a, b) => (Number(a.replace(/\D/g, "")) || 0) - (Number(b.replace(/\D/g, "")) || 0) || a.localeCompare(b));
  return [...ordre].reverse().find((s) => avecDonnees.has(s)) ?? ordre[0] ?? "";
}

/** Semestre « en cours » de l'étudiant, le même pour le tableau de bord et la page Notes : le plus
 * avancé qui a déjà des notes publiées ; avant toute note, celui des cours programmés pour sa
 * classe. Renvoie aussi la liste des semestres de son niveau, dans l'ordre. */
export function semestresDeLEtudiant(
  etudiant: Pick<EtudiantRecord, "id" | "classeId" | "filiereId" | "niveau"> | undefined,
  ues: UeRecord[],
  ecs: EcRecord[],
  notes: NoteRecord[],
  seances: SeanceRecord[],
): { semestres: string[]; semestreParDefaut: string } {
  if (!etudiant) return { semestres: [], semestreParDefaut: "" };
  const mesUes = ues.filter((u) => u.filiereId === etudiant.filiereId && u.niveau === etudiant.niveau).sort((a, b) => a.semestre.localeCompare(b.semestre));
  const semestres = Array.from(new Set(mesUes.map((u) => u.semestre)));
  const ueParId = new Map(mesUes.map((u) => [u.id, u]));
  const semestreDeLEc = (ecId: string) => ueParId.get(ecs.find((e) => e.id === ecId)?.ueId ?? "")?.semestre;
  const semestresDe = (ecIds: string[]) => new Set(ecIds.map(semestreDeLEc).filter((x): x is string => !!x));
  const avecNotes = semestresDe(notes.filter((n) => n.etudiantId === etudiant.id && n.statut === "publie").map((n) => n.ecId));
  const semestreParDefaut = avecNotes.size > 0
    ? semestreLePlusAvance(semestres, avecNotes)
    : semestreLePlusAvance(semestres, semestresDe(seances.filter((se) => se.classeId === etudiant.classeId).map((se) => se.ecId)));
  return { semestres, semestreParDefaut };
}

/** Date de référence d'une note pour la trier : dernière modification, sinon création. */
export function dateDeNote(n: Pick<NoteRecord, "dateCreation" | "dateModification">): string {
  return n.dateModification ?? n.dateCreation ?? "";
}

/** Valeur affichée d'une note : « 14,00/20 », ou « ABS (0) » pour un absent à l'évaluation. */
export function valeurNote(n: Pick<NoteRecord, "note" | "absent">): string {
  return n.absent ? "ABS (0)" : `${formatNote(n.note)}/20`;
}
