import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Gauge, Clock3, CheckCircle2, Clock, CircleDollarSign, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { useTeacherRates } from "@/hooks/useTeacherRateStore";
import { useTeacherCourseStatuses } from "@/hooks/useTeacherCourseStatusStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { getTeacherVolume, makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { getPointageIdsDejaDecomptes } from "@/data/decompteStore";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { computeEligibleDecompteLines } from "@/lib/decompteEligibility";
import { ENSEIGNANTS } from "@/data/mockData";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatCFA } from "@/lib/utils";

/** VH prévu = volume théorique de l'EC (curriculumStore), ajusté par une éventuelle rallonge déjà
 * validée (teacherVolumeStore — même source que "Mise à jour V.H" côté admin, jamais recalculé
 * séparément). Heures effectuées = pointages soumis OU validés (tout ce qui a réellement été
 * dispensé) ; Heures validées = sous-ensemble déjà validé par l'administration — un pointage rejeté
 * ne compte jamais. L'estimation du prochain décompte réutilise exactement le calcul des lignes
 * éligibles utilisé par l'admin pour générer un vrai décompte (decompteEligibility.ts), pour ne
 * jamais afficher un montant que la génération réelle ne confirmerait pas. */
export default function TeacherVolumeHorairePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const pointages = usePointages();
  const teacherRates = useTeacherRates();
  const teacherCourseStatuses = useTeacherCourseStatuses();
  const decomptes = useDecomptes();
  useTeacherVolumes(); // s'abonne pour re-rendre si une rallonge validée ajuste le VH

  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0] ?? "";
  const [annee, setAnnee] = useState(defaultAnnee);

  const myTeacher = useMemo(() => ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null, [currentUser?.linkedId]);

  const rows = useMemo(() => {
    if (!myTeacher) return [];
    const courses = buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee);
    return courses.map((c) => {
      const volumeId = makeTeacherVolumeId(myTeacher.id, c.ecId, c.classeId, annee);
      const vhPrevu = getTeacherVolume(volumeId)?.nouveauVh ?? c.volumeHoraire;
      const mesPointages = pointages.filter((p) => p.teacherId === myTeacher.id && p.ecId === c.ecId && p.classeId === c.classeId && p.annee === annee);
      const vhEffectue = mesPointages.filter((p) => p.statut === "soumis" || p.statut === "valide").reduce((s, p) => s + p.volumePointe, 0);
      const vhValide = mesPointages.filter((p) => p.statut === "valide").reduce((s, p) => s + p.volumePointe, 0);
      const classe = classes.find((cl) => cl.id === c.classeId);
      return { ...c, classeLabel: classe?.nom ?? "—", vhPrevu, vhEffectue, vhValide };
    });
  }, [myTeacher, seances, ecs, ues, classes, annee, pointages]);

  const totalPrevu = rows.reduce((s, r) => s + r.vhPrevu, 0);
  const totalEffectue = rows.reduce((s, r) => s + r.vhEffectue, 0);
  const totalValide = rows.reduce((s, r) => s + r.vhValide, 0);
  const totalRestant = Math.max(0, totalPrevu - totalEffectue);
  const pct = (v: number) => (totalPrevu > 0 ? Math.round((v / totalPrevu) * 100) : 0);
  const progressionPct = Math.min(100, pct(totalEffectue));

  const pointageIdsDejaDecomptes = useMemo(() => getPointageIdsDejaDecomptes(), [decomptes]);
  const eligibleLines = useMemo(
    () => (myTeacher ? computeEligibleDecompteLines(myTeacher, seances, ecs, ues, classes, annee, teacherRates, teacherCourseStatuses, pointages, pointageIdsDejaDecomptes) : []),
    [myTeacher, seances, ecs, ues, classes, annee, teacherRates, teacherCourseStatuses, pointages, pointageIdsDejaDecomptes],
  );
  const estimationHeures = eligibleLines.reduce((s, l) => s + l.duree, 0);
  const estimationNet = eligibleLines.reduce((s, l) => s + l.montantNet, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon volume horaire</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivez votre charge d&apos;enseignement et l&apos;évolution de vos heures.</p>
        </div>
        {anneeOptions.length > 1 && (
          <select
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="teacher-volume-filtre-annee"
          >
            {anneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={Gauge} label="Volume prévu" value={`${totalPrevu} h`} subtitle="Total des heures à effectuer" accentColor="#4f46e5" />
        <KPICard icon={CheckCircle2} label="Heures effectuées" value={`${totalEffectue} h`} subtitle={`Soit ${pct(totalEffectue)} % du volume`} accentColor="#10b981" />
        <KPICard icon={Clock3} label="Heures validées" value={`${totalValide} h`} subtitle={`Soit ${pct(totalValide)} % du volume`} accentColor="#2563eb" />
        <KPICard icon={Clock} label="Heures restantes" value={`${totalRestant} h`} subtitle={`Soit ${pct(totalRestant)} % du volume`} accentColor={totalRestant > 0 ? "#f59e0b" : "#10b981"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={16} className="text-primary" />
          <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Progression globale</h3>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-lg font-bold text-foreground shrink-0">{totalEffectue} h / {totalPrevu} h</p>
          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressionPct}%` }} />
          </div>
          <p className="text-sm font-semibold text-muted-foreground shrink-0">{pct(totalEffectue)} %</p>
        </div>
      </div>

      {!myTeacher ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Compte non rattaché à une fiche professeur.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun cours trouvé pour cette année académique.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Mes enseignements</h3>
              <Link href="/teacher/pointage" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid="teacher-volume-voir-pointage">
                Voir mon pointage détaillé <ArrowRight size={12} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">Cours</th>
                    <th className="px-4 py-3">Classe</th>
                    <th className="px-4 py-3">Heures prévues</th>
                    <th className="px-4 py-3">Heures effectuées</th>
                    <th className="px-4 py-3">Progression</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rowPct = r.vhPrevu > 0 ? Math.round((r.vhEffectue / r.vhPrevu) * 100) : 0;
                    const termine = r.vhPrevu > 0 && r.vhEffectue >= r.vhPrevu;
                    return (
                      <tr key={r.id} className="border-t border-border align-top" data-testid={`teacher-volume-${r.id}`}>
                        <td className="px-4 py-3 font-medium">{r.coursLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.classeLabel}</td>
                        <td className="px-4 py-3">{r.vhPrevu} h</td>
                        <td className="px-4 py-3">{r.vhEffectue} h</td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, rowPct)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{rowPct} %</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", termine ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
                            {termine ? "Terminé" : "En cours"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/teacher/pointage?ec=${r.ecId}`}
                            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                            data-testid={`teacher-volume-detail-${r.id}`}
                          >
                            Voir le détail →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <User size={16} className="text-primary" />
                <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Ma situation</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Volume contractuel</span>
                  <span className="font-semibold">{totalPrevu} h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Heures effectuées</span>
                  <span className="font-semibold">{totalEffectue} h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Heures validées</span>
                  <span className="font-semibold">{totalValide} h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Heures restantes</span>
                  <span className={cn("font-semibold", totalRestant > 0 ? "text-amber-600" : "text-emerald-600")}>{totalRestant} h</span>
                </div>
              </div>
            </div>

            {estimationHeures > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CircleDollarSign size={16} className="text-primary" />
                  <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Estimation du prochain décompte</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{estimationHeures} h de pointages validés, payés au taux horaire, pas encore décomptés.</p>
                <p className="text-xl font-bold text-primary mb-3">{formatCFA(estimationNet)}</p>
                <Link
                  href="/teacher/remuneration"
                  className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  data-testid="teacher-volume-voir-remuneration"
                >
                  Voir mes décomptes <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
