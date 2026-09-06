import { useMemo } from "react";
import { CircleDollarSign, CheckCircle2, Clock, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import type { TypeDecompte } from "@/data/decompteStore";
import { buildDecompteHtml } from "@/pages/admin/DecompteDetailPage";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatCFA, formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<TypeDecompte, string> = {
  taux_horaire: "Taux horaire",
  forfait: "Forfait",
  a_terme: "À terme",
};

/** Lecture seule des vrais décomptes (decompteStore.ts) émis pour ce professeur — la génération et
 * le paiement restent des actes administratifs (RH/Finance) ; l'enseignant vient ici consulter le
 * détail réel de chaque décompte (lignes, abattement, net à payer, reste) et l'imprimer, avec
 * exactement le même gabarit que celui utilisé côté admin (buildDecompteHtml). */
export default function TeacherDecomptesPage() {
  const { currentUser } = useAuth();
  const decomptes = useDecomptes();
  const paiements = useDecomptePaiements();

  const mine = useMemo(
    () => decomptes.filter((d) => d.teacherId === currentUser?.linkedId).sort((a, b) => b.date.localeCompare(a.date)),
    [decomptes, currentUser?.linkedId],
  );
  const mesPaiements = useMemo(
    () => paiements.filter((p) => p.teacherId === currentUser?.linkedId && !p.annulee).sort((a, b) => b.date.localeCompare(a.date)),
    [paiements, currentUser?.linkedId],
  );

  const actifs = mine.filter((d) => d.statut !== "annule");
  const netTotal = actifs.reduce((s, d) => s + d.netAPayer, 0);
  const payeTotal = actifs.reduce((s, d) => s + d.montantPaye, 0);
  const resteTotal = netTotal - payeTotal;

  const printDecompte = (d: (typeof mine)[number]) => {
    const statutLabel = d.statut === "annule" ? "Annulé" : d.montantPaye >= d.netAPayer ? "Payé" : "Emis";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDecompteHtml({
        reference: d.reference,
        date: d.date,
        professeur: d.professeur,
        type: TYPE_LABEL[d.type],
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
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes décomptes</h2>
        <p className="text-sm text-muted-foreground mt-1">Décomptes de paiement émis pour vos cours et leur règlement.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <KPICard icon={CircleDollarSign} label="Net à payer (total)" value={formatCFA(netTotal)} accentColor="#4f46e5" />
        <KPICard icon={CheckCircle2} label="Déjà payé" value={formatCFA(payeTotal)} accentColor="#10b981" />
        <KPICard icon={Clock} label="Reste à payer" value={formatCFA(resteTotal)} accentColor={resteTotal > 0 ? "#f59e0b" : "#10b981"} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CircleDollarSign size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun décompte émis pour l'instant.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
              {mine.map((d) => {
                const paye = d.statut !== "annule" && d.montantPaye >= d.netAPayer;
                return (
                  <tr key={d.id} className="border-t border-border align-top" data-testid={`teacher-decompte-${d.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.reference}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                    </td>
                    <td className="px-4 py-3">{TYPE_LABEL[d.type]}</td>
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
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-bold text-sm">Historique des paiements</h3>
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
    </div>
  );
}
