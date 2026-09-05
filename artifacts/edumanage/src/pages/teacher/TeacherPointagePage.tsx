import { useMemo } from "react";
import { Clock3, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePointages } from "@/hooks/usePointageStore";
import type { PointageStatut } from "@/data/pointageStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatDate } from "@/lib/utils";

const STATUT_LABEL: Record<PointageStatut, string> = {
  brouillon: "Brouillon",
  soumis: "Soumis",
  valide: "Validé",
  rejete: "Rejeté",
};

const STATUT_CLS: Record<PointageStatut, string> = {
  brouillon: "bg-muted text-muted-foreground",
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
};

const STATUT_ICON: Record<PointageStatut, React.ElementType> = {
  brouillon: Clock,
  soumis: Clock,
  valide: CheckCircle2,
  rejete: XCircle,
};

/** Lecture seule des vrais pointages (pointageStore.ts) déclarés par l'administration pour ce
 * professeur — la validation/rejet reste un acte administratif (TeacherPointageTraitementPage) ;
 * l'enseignant vient ici uniquement suivre le statut réel de chaque séance pointée. */
export default function TeacherPointagePage() {
  const { currentUser } = useAuth();
  const pointages = usePointages();
  const ecs = useEcs();
  const classes = useClasses();

  const mine = useMemo(
    () => pointages.filter((p) => p.teacherId === currentUser?.linkedId).sort((a, b) => b.date.localeCompare(a.date)),
    [pointages, currentUser?.linkedId],
  );

  const valides = mine.filter((p) => p.statut === "valide").length;
  const soumis = mine.filter((p) => p.statut === "soumis").length;
  const rejetes = mine.filter((p) => p.statut === "rejete").length;
  const heuresValidees = mine.filter((p) => p.statut === "valide").reduce((s, p) => s + p.volumePointe, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon pointage</h2>
        <p className="text-sm text-muted-foreground mt-1">Suivi des heures pointées pour vos cours et leur statut de validation.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={Clock3} label="Heures validées" value={`${heuresValidees} h`} accentColor="#10b981" />
        <KPICard icon={Clock} label="En attente" value={soumis} accentColor="#f59e0b" />
        <KPICard icon={CheckCircle2} label="Validés" value={valides} accentColor="#2563eb" />
        <KPICard icon={XCircle} label="Rejetés" value={rejetes} accentColor={rejetes > 0 ? "#ef4444" : "#10b981"} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Clock3 size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun pointage enregistré pour l'instant.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((p) => {
                const ec = ecs.find((e) => e.id === p.ecId);
                const classe = classes.find((c) => c.id === p.classeId);
                const Icon = STATUT_ICON[p.statut];
                return (
                  <tr key={p.id} className="border-t border-border align-top" data-testid={`teacher-pointage-${p.id}`}>
                    <td className="px-4 py-3">{formatDate(p.date)} · {p.heureDebut}–{p.heureFin}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : p.ecId}</p>
                      <p className="text-xs text-muted-foreground">{classe?.nom}</p>
                    </td>
                    <td className="px-4 py-3">{p.type}</td>
                    <td className="px-4 py-3">{p.volumePointe} h</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[p.statut])}>
                        <Icon size={11} /> {STATUT_LABEL[p.statut]}
                      </span>
                      {p.statut === "rejete" && p.motifRejet && <p className="text-xs text-red-600 mt-1">{p.motifRejet}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
