import { useMemo } from "react";
import { Wallet, CircleDollarSign, CheckCircle2, Clock, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useVacations } from "@/hooks/useVacationStore";
import type { VacationStatut } from "@/data/vacationStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import type { TypeDecompte } from "@/data/decompteStore";
import { buildDecompteHtml } from "@/pages/admin/DecompteDetailPage";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatCFA, formatDate } from "@/lib/utils";

const VACATION_STATUT_LABEL: Record<VacationStatut, string> = {
  brouillon: "Brouillon",
  valide: "Validée",
  paye: "Payée",
};

const VACATION_STATUT_CLS: Record<VacationStatut, string> = {
  brouillon: "bg-muted text-muted-foreground",
  valide: "bg-blue-50 text-blue-700",
  paye: "bg-emerald-50 text-emerald-700",
};

const DECOMPTE_TYPE_LABEL: Record<TypeDecompte, string> = {
  taux_horaire: "Taux horaire",
  forfait: "Forfait",
  a_terme: "À terme",
};

/** Lecture seule de deux mécanismes de paiement réels et distincts, qui coexistent côté admin sans
 * se vérifier entre eux (voir remunerationOverlap.ts pour le garde-fou anti-double-paiement côté
 * admin) : les vacations (vacationStore.ts, saisie manuelle mensuelle par l'administration) et les
 * décomptes (decompteStore.ts, générés depuis les vraies séances pointées et validées). Regroupés
 * ici en une seule page à deux sections nommées pour que l'enseignant comprenne d'où vient chaque
 * montant, sans les fusionner en un seul tableau — leurs champs sont trop différents pour ça. */
export default function TeacherRemunerationPage() {
  const { currentUser } = useAuth();
  const vacations = useVacations();
  const decomptes = useDecomptes();
  const paiements = useDecomptePaiements();

  const mesVacations = useMemo(
    () => vacations.filter((v) => v.enseignantId === currentUser?.linkedId).sort((a, b) => b.mois.localeCompare(a.mois)),
    [vacations, currentUser?.linkedId],
  );
  const montantVacationsTotal = mesVacations.reduce((s, v) => s + v.montantTotal, 0);
  const montantVacationsPaye = mesVacations.filter((v) => v.statut === "paye").reduce((s, v) => s + v.montantTotal, 0);
  const vacationsEnAttente = mesVacations.filter((v) => v.statut !== "paye").length;

  const mesDecomptes = useMemo(
    () => decomptes.filter((d) => d.teacherId === currentUser?.linkedId).sort((a, b) => b.date.localeCompare(a.date)),
    [decomptes, currentUser?.linkedId],
  );
  const mesPaiements = useMemo(
    () => paiements.filter((p) => p.teacherId === currentUser?.linkedId && !p.annulee).sort((a, b) => b.date.localeCompare(a.date)),
    [paiements, currentUser?.linkedId],
  );
  const decomptesActifs = mesDecomptes.filter((d) => d.statut !== "annule");
  const decompteNetTotal = decomptesActifs.reduce((s, d) => s + d.netAPayer, 0);
  const decomptePayeTotal = decomptesActifs.reduce((s, d) => s + d.montantPaye, 0);
  const decompteResteTotal = decompteNetTotal - decomptePayeTotal;

  const printDecompte = (d: (typeof mesDecomptes)[number]) => {
    const statutLabel = d.statut === "annule" ? "Annulé" : d.montantPaye >= d.netAPayer ? "Payé" : "Emis";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDecompteHtml({
        reference: d.reference,
        date: d.date,
        professeur: d.professeur,
        type: DECOMPTE_TYPE_LABEL[d.type],
        montantDecompte: d.montantDecompte,
        netAPayer: d.netAPayer,
        montantPaye: d.montantPaye,
        statut: statutLabel,
        lignes: d.lignes,
      }),
    );
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Ma rémunération</h2>
        <p className="text-sm text-muted-foreground mt-1">Vacations et décomptes émis pour votre enseignement, et leur règlement.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Wallet size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Vacations déclarées par l&apos;administration</h3>
            <p className="text-xs text-muted-foreground">Heures complémentaires (CM/TD) saisies manuellement, mois par mois.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <KPICard icon={Wallet} label="Montant total" value={formatCFA(montantVacationsTotal)} accentColor="#4f46e5" />
          <KPICard icon={CheckCircle2} label="Déjà payé" value={formatCFA(montantVacationsPaye)} accentColor="#10b981" />
          <KPICard icon={Clock} label="En attente" value={vacationsEnAttente} accentColor={vacationsEnAttente > 0 ? "#f59e0b" : "#10b981"} />
        </div>

        {mesVacations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 rounded-xl border border-dashed border-border">Aucune vacation enregistrée pour l&apos;instant.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
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
                  {mesVacations.map((v) => (
                    <tr key={v.id} className="border-t border-border align-top" data-testid={`teacher-vacation-${v.id}`}>
                      <td className="px-4 py-3 font-medium">{v.mois}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.modules.join(", ") || "—"}</td>
                      <td className="px-4 py-3">{v.heuresCm} CM · {v.heuresTd} TD</td>
                      <td className="px-4 py-3">{formatCFA(v.tauxHoraire)}</td>
                      <td className="px-4 py-3 font-medium">{formatCFA(v.montantTotal)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", VACATION_STATUT_CLS[v.statut])}>{VACATION_STATUT_LABEL[v.statut]}</span>
                        {v.statut === "paye" && v.moyen && <p className="text-xs text-muted-foreground mt-1">{v.moyen}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CircleDollarSign size={16} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Décomptes générés depuis mon pointage</h3>
            <p className="text-xs text-muted-foreground">Calculés automatiquement à partir de vos séances réellement pointées et validées.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <KPICard icon={CircleDollarSign} label="Net à payer (total)" value={formatCFA(decompteNetTotal)} accentColor="#4f46e5" />
          <KPICard icon={CheckCircle2} label="Déjà payé" value={formatCFA(decomptePayeTotal)} accentColor="#10b981" />
          <KPICard icon={Clock} label="Reste à payer" value={formatCFA(decompteResteTotal)} accentColor={decompteResteTotal > 0 ? "#f59e0b" : "#10b981"} />
        </div>

        {mesDecomptes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 rounded-xl border border-dashed border-border">Aucun décompte émis pour l&apos;instant.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">Référence</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Net à payer</th>
                    <th className="px-4 py-3">Payé</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {mesDecomptes.map((d) => {
                    const paye = d.statut !== "annule" && d.montantPaye >= d.netAPayer;
                    return (
                      <tr key={d.id} className="border-t border-border align-top" data-testid={`teacher-decompte-${d.id}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{d.reference}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                        </td>
                        <td className="px-4 py-3">{DECOMPTE_TYPE_LABEL[d.type]}</td>
                        <td className="px-4 py-3 font-medium">{formatCFA(d.netAPayer)}</td>
                        <td className="px-4 py-3">{formatCFA(d.montantPaye)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              d.statut === "annule" ? "bg-muted text-muted-foreground" : paye ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                            )}
                          >
                            {d.statut === "annule" ? "Annulé" : paye ? "Payé" : "Emis"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => printDecompte(d)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                            data-testid={`teacher-decompte-imprimer-${d.id}`}
                          >
                            <Printer size={12} /> Imprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mesPaiements.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wide">Historique des paiements</h4>
            </div>
            <div className="divide-y divide-border">
              {mesPaiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4" data-testid={`teacher-paiement-decompte-${p.id}`}>
                  <div>
                    <p className="text-sm font-medium">{p.reference} — {p.decompteReference}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.date)} · {p.moyen}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600">{formatCFA(p.montant)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
