import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useEncaissements } from "@/hooks/useEncaissementStore";
import { annulerEncaissement } from "@/data/encaissementStore";
import { reverserReglementQuittance, crediterAvoir } from "@/data/studentStore";
import { statutEncaissement } from "@/pages/admin/EncaissementsPage";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Validée: "bg-emerald-50 text-emerald-700",
  Annulée: "bg-red-50 text-red-700",
};

function buildEncaissementHtml(args: {
  reference: string;
  date: string;
  payeur: string;
  quittanceReference: string;
  quittanceDateEmission: string;
  quittanceDateLimite?: string;
  montantQuittanceTotal: number;
  montant: number;
  moyen: string;
  referenceBancaire?: string;
  encaissePar: string;
  lignes: { label: string; montantApplique: number; montantLigneTotal: number }[];
}): string {
  return buildPrintDocumentHtml({
    badge: "ENCAISSEMENT",
    numero: args.reference,
    date: formatDate(args.date),
    destinataireLabel: "Payeur",
    destinataireNom: args.payeur,
    destinataireLignes: [`Quittance : ${args.quittanceReference}`, `Encaissé par : ${args.encaissePar}`],
    tableauPersonnalise: {
      entetes: ["Rubrique", "Montant appliqué", "Montant de la rubrique"],
      lignes: args.lignes.map((l) => [l.label, formatCFA(l.montantApplique), formatCFA(l.montantLigneTotal)]),
    },
    encartLabel: "Méthode de paiement",
    encartLignes: [`Mode : ${args.moyen}`, ...(args.referenceBancaire ? [`Référence : ${args.referenceBancaire}`] : [])],
    summary: [
      { label: "Montant total de la quittance", montant: args.montantQuittanceTotal },
      { label: "Montant encaissé", montant: args.montant, emphasis: "total" },
    ],
  });
}

export default function EncaissementDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const encaissements = useEncaissements();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = encaissements.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les encaissements", href: "/admin/encaissements" }]}
          title="Encaissement introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cet encaissement n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const statut = statutEncaissement(record);

  const handleCancel = () => {
    reverserReglementQuittance(record.quittanceId, record.montant);
    if (record.moyen.toUpperCase() === "AVOIR") {
      crediterAvoir(record.etudiantId, record.montant);
    }
    annulerEncaissement(record.id);
    toast.success("Encaissement annulé — le montant a été retiré de la quittance");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildEncaissementHtml({
        reference: record.reference,
        date: record.date,
        payeur: record.payeur,
        quittanceReference: record.quittanceReference,
        quittanceDateEmission: record.quittanceDateEmission,
        quittanceDateLimite: record.quittanceDateLimite,
        montantQuittanceTotal: record.montantQuittanceTotal,
        montant: record.montant,
        moyen: record.moyen,
        referenceBancaire: record.referenceBancaire,
        encaissePar: record.encaissePar,
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
          { label: "Les encaissements", href: "/admin/encaissements" },
          { label: record.reference },
        ]}
        title={`Encaissé par : ${record.encaissePar}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/encaissements")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="enc-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Numéro facture</p>
          <button
            onClick={() => setLocation(`/admin/paiements/${record.quittanceId}`)}
            className="font-semibold text-sm mt-1 text-primary hover:underline text-left"
            data-testid="enc-voir-quittance"
          >
            {record.quittanceReference}
          </button>
          <p className="text-xs text-muted-foreground">{record.payeur}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émise le / Date limite</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.quittanceDateEmission)}</p>
          {record.quittanceDateLimite && <p className="text-xs text-muted-foreground">{formatDate(record.quittanceDateLimite)}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant quittance / Payé(e) par</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.montantQuittanceTotal)}</p>
          <p className="text-xs text-muted-foreground">{record.moyen}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant encaissé</p>
          <p className="font-bold text-primary text-sm mt-1">{formatCFA(record.montant)}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
          <ReceiptText size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Détails de l&apos;encaissement</h3>
        </div>
        {record.lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Aucun détail par rubrique disponible pour cet encaissement.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Rubrique</th>
                <th className="text-right px-4 py-3">Payé sur cette rubrique</th>
                <th className="text-right px-4 py-3">Montant de la rubrique</th>
              </tr>
            </thead>
            <tbody>
              {record.lignes.map((l, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{l.label}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCFA(l.montantApplique)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCFA(l.montantLigneTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler l&apos;encaissement
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cet encaissement a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler l&apos;encaissement {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Le montant sera retiré de la quittance {record.quittanceReference} (elle redeviendra Acompte ou Impayée selon les autres versements). Action irréversible.
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
