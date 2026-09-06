import { useMemo } from "react";
import { Gauge, Clock3, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { getTeacherVolume, makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { ENSEIGNANTS } from "@/data/mockData";
import { KPICard } from "@/components/admin/KPICard";
import { cn } from "@/lib/utils";

/** VH prévu = volume théorique de l'EC (curriculumStore), ajusté par une éventuelle rallonge déjà
 * validée (teacherVolumeStore — même source que "Mise à jour V.H" côté admin, jamais recalculé
 * séparément). VH réalisé = somme des pointages réellement validés (pointageStore) pour ce cours —
 * un pointage soumis ou rejeté ne compte jamais tant qu'il n'est pas validé par l'administration. */
export default function TeacherVolumeHorairePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const pointages = usePointages();
  useTeacherVolumes(); // s'abonne pour re-rendre si une rallonge validée ajuste le VH

  const anneesAcademiques = useAnneesAcademiques();
  const annee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneesAcademiques[0]?.libelle ?? "";

  const myTeacher = useMemo(() => ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null, [currentUser?.linkedId]);

  const rows = useMemo(() => {
    if (!myTeacher) return [];
    const courses = buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee);
    return courses.map((c) => {
      const volumeId = makeTeacherVolumeId(myTeacher.id, c.ecId, c.classeId, annee);
      const vhPrevu = getTeacherVolume(volumeId)?.nouveauVh ?? c.volumeHoraire;
      const vhRealise = pointages
        .filter((p) => p.teacherId === myTeacher.id && p.ecId === c.ecId && p.classeId === c.classeId && p.annee === annee && p.statut === "valide")
        .reduce((s, p) => s + p.volumePointe, 0);
      return { ...c, vhPrevu, vhRealise, ecart: vhRealise - vhPrevu };
    });
  }, [myTeacher, seances, ecs, ues, classes, annee, pointages]);

  const totalPrevu = rows.reduce((s, r) => s + r.vhPrevu, 0);
  const totalRealise = rows.reduce((s, r) => s + r.vhRealise, 0);
  const totalEcart = totalRealise - totalPrevu;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon volume horaire</h2>
        <p className="text-sm text-muted-foreground mt-1">Volume prévu par cours comparé aux heures réellement pointées et validées — {annee}.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KPICard icon={Gauge} label="VH prévu (total)" value={`${totalPrevu} h`} accentColor="#4f46e5" />
        <KPICard icon={Clock3} label="VH réalisé (validé)" value={`${totalRealise} h`} accentColor="#10b981" />
        <KPICard
          icon={totalEcart >= 0 ? TrendingUp : TrendingDown}
          label="Écart"
          value={`${totalEcart >= 0 ? "+" : ""}${totalEcart} h`}
          accentColor={totalEcart >= 0 ? "#10b981" : "#ef4444"}
        />
      </div>

      {!myTeacher ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Compte non rattaché à une fiche professeur.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun cours trouvé pour cette année académique.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">VH prévu</th>
                <th className="px-4 py-3">VH réalisé</th>
                <th className="px-4 py-3">Écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top" data-testid={`teacher-volume-${r.id}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.coursLabel}</p>
                    <p className="text-xs text-muted-foreground">{r.detailsLabel}</p>
                  </td>
                  <td className="px-4 py-3">{r.vhPrevu} h</td>
                  <td className="px-4 py-3">{r.vhRealise} h</td>
                  <td className={cn("px-4 py-3 font-medium", r.ecart >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {r.ecart >= 0 ? "+" : ""}{r.ecart} h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
