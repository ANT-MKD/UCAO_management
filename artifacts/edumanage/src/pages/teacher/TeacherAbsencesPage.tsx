import { useMemo } from "react";
import { CalendarX, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherAbsences } from "@/hooks/useTeacherAbsenceStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { absence: "Absence", retard: "Retard" };

/** Lecture seule des constats réels (teacherAbsenceStore.ts) déclarés par l'administration sur ce
 * professeur — jamais de saisie ici : l'enseignant consulte et voit si un constat est justifié,
 * exactement le même statut que celui utilisé pour valider/rejeter côté admin (TeacherAbsencePage). */
export default function TeacherAbsencesPage() {
  const { currentUser } = useAuth();
  const absences = useTeacherAbsences();
  const ecs = useEcs();
  const classes = useClasses();

  const mine = useMemo(
    () => absences.filter((a) => a.teacherId === currentUser?.linkedId).sort((a, b) => b.date.localeCompare(a.date)),
    [absences, currentUser?.linkedId],
  );

  const justifiees = mine.filter((a) => a.justifie).length;
  const nonJustifiees = mine.length - justifiees;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes absences</h2>
        <p className="text-sm text-muted-foreground mt-1">Absences et retards constatés par l'administration.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KPICard icon={CalendarX} label="Total constats" value={mine.length} accentColor="#4f46e5" />
        <KPICard icon={CheckCircle2} label="Justifiées" value={justifiees} accentColor="#10b981" />
        <KPICard icon={AlertCircle} label="Non justifiées" value={nonJustifiees} accentColor={nonJustifiees > 0 ? "#ef4444" : "#10b981"} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CheckCircle2 size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucune absence ni retard constaté.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((a) => {
                const ec = ecs.find((e) => e.id === a.ecId);
                const classe = classes.find((c) => c.id === a.classeId);
                return (
                  <tr key={a.id} className="border-t border-border align-top" data-testid={`teacher-absence-${a.id}`}>
                    <td className="px-4 py-3">{formatDate(a.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : a.ecId}</p>
                      <p className="text-xs text-muted-foreground">{classe?.nom}</p>
                    </td>
                    <td className="px-4 py-3">{TYPE_LABEL[a.type] ?? a.type}</td>
                    <td className="px-4 py-3">{a.dureeMinutes ? `${a.dureeMinutes} min` : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.motif}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                          a.justifie ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {a.justifie ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {a.justifie ? "Justifiée" : "En attente"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
