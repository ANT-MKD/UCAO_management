import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, ChevronDown, ChevronRight, CircleDollarSign, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { annulerDecompte } from "@/data/decompteStore";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  taux_horaire: "Taux horaire",
  forfait: "Forfait",
  a_terme: "À terme",
};

function buildDecompteHtml(args: {
  reference: string;
  date: string;
  professeur: string;
  type: string;
  montantDecompte: number;
  netAPayer: number;
  montantPaye: number;
  statut: string;
  lignes: { coursLabel: string; date: string; duree: number; montantBrut: number; abattementPct: number; montantNet: number }[];
}): string {
  const resteAPayer = Math.max(0, args.netAPayer - args.montantPaye);
  return buildPrintDocumentHtml({
    badge: "DÉCOMPTE",
    numero: args.reference,
    date: formatDate(args.date),
    destinataireLabel: "Professeur",
    destinataireNom: args.professeur,
    destinataireLignes: [`Type : ${args.type}`],
    metaDroiteLabel: "Statut",
    metaDroiteValeur: args.statut,
    tableauPersonnalise: {
      entetes: ["Cours", "Fait le", "Durée (h)", "Montant brut", "Abatt.", "Montant net"],
      lignes: args.lignes.map((l) => [
        l.coursLabel,
        formatShortDate(l.date),
        String(l.duree),
        formatCFA(l.montantBrut),
        `${l.abattementPct}%`,
        formatCFA(l.montantNet),
      ]),
    },
    summary: [
      { label: "Montant décompté", montant: args.montantDecompte },
      { label: "Montant payé", montant: args.montantPaye },
      ...(resteAPayer > 0 ? [{ label: "Reste à payer", montant: resteAPayer, emphasis: "due" as const }] : []),
      { label: "Net à payer", montant: args.netAPayer, emphasis: "total" },
    ],
    signatureLabel: "Le Responsable RH / Finance",
  });
}

export default function DecompteDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const decomptes = useDecomptes();
  const paiements = useDecomptePaiements();
  const [expanded, setExpanded] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = decomptes.find((d) => d.id === id);
  const historiquePaiements = record ? paiements.filter((p) => p.decompteId === record.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les décomptes", href: "/admin/decomptes" }]}
          title="Décompte introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce décompte n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    const result = annulerDecompte(record.id);
    if (!result.ok) {
      toast.error(result.reason);
      setConfirmCancel(false);
      return;
    }
    toast.success("Décompte annulé — les pointages qu'il contenait redeviennent éligibles à un futur décompte");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDecompteHtml({
        reference: record.reference,
        date: record.date,
        professeur: record.professeur,
        type: TYPE_LABEL[record.type] ?? record.type,
        montantDecompte: record.montantDecompte,
        netAPayer: record.netAPayer,
        montantPaye: record.montantPaye,
        statut: record.statut === "annule" ? "Annulé" : record.montantPaye >= record.netAPayer ? "Payé" : "Emis",
        lignes: record.lignes,
      }),
    );
    win.document.close();
    win.print();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les décomptes", href: "/admin/decomptes" },
          { label: record.reference },
        ]}
        title={`Décompte ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/decomptes")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="decompte-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
            {record.statut !== "annule" && record.netAPayer - record.montantPaye > 0 && (
              <button
                onClick={() => setLocation(`/admin/decomptes-professeurs/new?decompteId=${record.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                data-testid="decompte-payer"
              >
                <CircleDollarSign size={15} /> Payer
              </button>
            )}
          </div>
        }
      />

      {record.statut === "annule" && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce décompte a été annulé. Les pointages qu&apos;il contenait sont redevenus éligibles à un futur décompte.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Créé par</p>
          <p className="font-semibold text-sm mt-1">{record.ajouteePar}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émis le</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{TYPE_LABEL[record.type] ?? record.type} — {record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pour le professeur</p>
          <button onClick={() => setLocation(`/admin/teachers/${record.teacherId}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="decompte-voir-professeur">
            {record.professeur}
          </button>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mt total décompté / Net à payer</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.montantDecompte)}</p>
          <p className="text-xs font-bold text-primary">{formatCFA(record.netAPayer)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 flex flex-wrap items-center gap-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Montant payé</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.montantPaye)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Reste à payer</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(Math.max(0, record.netAPayer - record.montantPaye))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Statut</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", record.statut === "annule" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
            {record.statut === "annule" ? "Annulé" : "Emis"}
          </span>
        </div>
      </div>

      {historiquePaiements.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Historique des paiements</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {historiquePaiements.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/decomptes-professeurs/${p.id}`)}
                  data-testid={`decompte-paiement-hist-${p.id}`}
                >
                  <td className="px-5 py-3 font-medium">{p.reference}</td>
                  <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{formatDate(p.date)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.moyen}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatCFA(p.montant)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", p.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                      {p.annulee ? "Annulé" : "Validé"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
          data-testid="decompte-toggle-detail"
        >
          <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Détails du décompte — {record.lignes.length} ligne(s)
          </span>
        </button>
        {expanded && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Cours</th>
                  <th className="text-left px-4 py-3">{record.type === "forfait" ? "Terminé le" : "Fait le"}</th>
                  <th className="text-left px-4 py-3">Niveau / Classe / Année / Semestre</th>
                  <th className="text-center px-4 py-3">{record.type === "forfait" ? "V.H total" : "Durée (h)"}</th>
                  <th className="text-right px-4 py-3">Montant brut</th>
                  <th className="text-center px-4 py-3">Abattement</th>
                  <th className="text-right px-4 py-3">Montant net</th>
                </tr>
              </thead>
              <tbody>
                {record.lignes.map((l, i) => (
                  <tr key={`${l.pointageId}-${i}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{l.coursLabel}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(l.date)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {l.niveauLabel} — {l.classeLabel} — {l.anneeLabel}
                      {l.semestreLabel ? ` — ${l.semestreLabel}` : ""}
                    </td>
                    <td className="px-4 py-3 text-center">{l.duree}</td>
                    <td className="px-4 py-3 text-right">{formatCFA(l.montantBrut)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {l.abattementPct}% (-{formatCFA(l.abattementMontant)})
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCFA(l.montantNet)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-4 py-3" colSpan={4}>Total</td>
                  <td className="px-4 py-3 text-right">{formatCFA(record.montantDecompte)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-primary">{formatCFA(record.netAPayer)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {record.statut === "annule" ? (
        <p className="text-sm text-red-600 font-medium">Ce décompte a été annulé.</p>
      ) : record.montantPaye > 0 ? (
        <p className="text-xs text-muted-foreground">
          Un paiement a déjà été enregistré sur ce décompte — annulation impossible.
        </p>
      ) : (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le décompte
        </label>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le décompte {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Les pointages qu&apos;il contient redeviendront éligibles à un futur décompte. Action irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmCancel(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleCancel} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
