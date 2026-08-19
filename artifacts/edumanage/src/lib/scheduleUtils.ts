export interface SeanceSlot {
  id: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  classeId: string;
  salleId: string;
  prof: string;
  classe?: string;
  salle?: string;
  ec?: string;
}

export type ConflictType = "salle" | "prof" | "classe";

export interface ScheduleConflict {
  type: ConflictType;
  seanceId: string;
  label: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
}

export function sameDayOverlap(
  a: Pick<SeanceSlot, "jour" | "heureDebut" | "heureFin">,
  b: Pick<SeanceSlot, "jour" | "heureDebut" | "heureFin">,
): boolean {
  return a.jour === b.jour && timesOverlap(a.heureDebut, a.heureFin, b.heureDebut, b.heureFin);
}

export function detectScheduleConflicts(
  seances: SeanceSlot[],
  candidate: SeanceSlot,
  excludeId?: string,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const others = seances.filter((s) => s.id !== excludeId && s.id !== candidate.id);

  for (const s of others) {
    if (!sameDayOverlap(candidate, s)) continue;

    if (s.salleId === candidate.salleId) {
      conflicts.push({
        type: "salle",
        seanceId: s.id,
        label: `Salle occupée : ${s.ec ?? s.classe ?? s.salleId} (${s.heureDebut}–${s.heureFin})`,
      });
    }
    if (s.prof === candidate.prof) {
      conflicts.push({
        type: "prof",
        seanceId: s.id,
        label: `Professeur indisponible : ${s.ec ?? "cours"} (${s.heureDebut}–${s.heureFin})`,
      });
    }
    if (s.classeId === candidate.classeId) {
      conflicts.push({
        type: "classe",
        seanceId: s.id,
        label: `Classe déjà planifiée : ${s.ec ?? "cours"} (${s.heureDebut}–${s.heureFin})`,
      });
    }
  }

  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = `${c.type}-${c.seanceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
