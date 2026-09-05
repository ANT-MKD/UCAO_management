import { useMemo } from "react";
import { Wallet, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useVacations } from "@/hooks/useVacationStore";
import type { VacationStatut } from "@/data/vacationStore";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatCFA } from "@/lib/utils";

const STATUT_LABEL: Record<VacationStatut, string> = {
  brouillon: "Brouillon",
  valide: "Validée",
  paye: "Payée",
};

const STATUT_CLS: Record<VacationStatut, string> = {
  brouillon: "bg-muted text-muted-foreground",
  valide: "bg-blue-50 text-blue-700",
  paye: "bg-emerald-50 text-emerald-700",
};

/** Lecture seule des vraies vacations (vacationStore.ts) — l'administration reste seule à créer,
 * valider et payer une vacation ; l'enseignant vient ici uniquement suivre le montant réel dû ou
 * déjà réglé, exactement les mêmes montants que ceux affichés côté admin (VacationsPage). */
export default function TeacherVacationsPage() {
  const { currentUser } = useAuth();
  const vacations = useVacations();

  const mine = useMemo(
    () => vacations.filter((v) => v.enseignantId === currentUser?.linkedId).sort((a, b) => b.mois.localeCompare(a.mois)),
    [vacations, currentUser?.linkedId],
  );

  const montantTotal = mine.reduce((s, v) => s + v.montantTotal, 0);
  const montantPaye = mine.filter((v) => v.statut === "paye").reduce((s, v) => s + v.montantTotal, 0);
  const enAttente = mine.filter((v) => v.statut !== "paye").length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes vacations</h2>
        <p className="text-sm text-muted-foreground mt-1">Heures complémentaires (CM/TD) déclarées et leur règlement.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <KPICard icon={Wallet} label="Montant total" value={formatCFA(montantTotal)} accentColor="#4f46e5" />
        <KPICard icon={CheckCircle2} label="Déjà payé" value={formatCFA(montantPaye)} accentColor="#10b981" />
        <KPICard icon={Clock} label="En attente" value={enAttente} accentColor={enAttente > 0 ? "#f59e0b" : "#10b981"} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wallet size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucune vacation enregistrée pour l'instant.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Mois</th>
                <th className="px-4 py-3">Modules</th>
                <th className="px-4 py-3">Heures CM/TD</th>
                <th className="px-4 py-3">Taux horaire</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((v) => (
                <tr key={v.id} className="border-t border-border align-top" data-testid={`teacher-vacation-${v.id}`}>
                  <td className="px-4 py-3 font-medium">{v.mois}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.modules.join(", ") || "—"}</td>
                  <td className="px-4 py-3">{v.heuresCm} CM · {v.heuresTd} TD</td>
                  <td className="px-4 py-3">{formatCFA(v.tauxHoraire)}</td>
                  <td className="px-4 py-3 font-medium">{formatCFA(v.montantTotal)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[v.statut])}>{STATUT_LABEL[v.statut]}</span>
                    {v.statut === "paye" && v.moyen && <p className="text-xs text-muted-foreground mt-1">{v.moyen}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
