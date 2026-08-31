import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAvoirDepots } from "@/hooks/useAvoirDepotStore";
import { annulerDepotAvoir } from "@/data/avoirDepotStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

function buildDepotHtml(args: {
  reference: string;
  date: string;
  payeur: string;
  montant: number;
  motif: string;
  moyenOrigine?: string;
  referenceBancaire?: string;
}): string {
  return buildPrintDocumentHtml({
    badge: "DÉPÔT AVOIR",
    numero: args.reference,
    date: formatDate(args.date),
    destinataireLabel: "Bénéficiaire",
    destinataireNom: args.payeur,
    colonneLabel: "Motif",
    lignes: [{ label: args.motif, montant: args.montant }],
    encartLabel: args.moyenOrigine ? "Méthode de règlement" : undefined,
    encartLignes: args.moyenOrigine ? [`Mode : ${args.moyenOrigine}`, ...(args.referenceBancaire ? [`Référence : ${args.referenceBancaire}`] : [])] : undefined,
    summary: [{ label: "Montant crédité", montant: args.montant, emphasis: "total" }],
    messageMerci: "Ce document atteste du dépôt effectué sur le solde avoir de l'étudiant.",
  });
}

export default function AvoirDepotDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const depots = useAvoirDepots();
  const etudiants = useStudentStore();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = depots.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les encaissements", href: "/admin/encaissements" }]}
          title="Dépôt introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce dépôt n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const etudiant = etudiants.find((e) => e.id === record.etudiantId);

  const handleCancel = () => {
    const result = annulerDepotAvoir(record.id);
    if (!result.ok) {
      toast.error(result.reason ?? "Impossible d'annuler ce dépôt.");
      setConfirmCancel(false);
      return;
    }
    toast.success("Dépôt avoir annulé — le solde de l'étudiant a été débité d'autant");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDepotHtml({
        reference: record.reference,
        date: record.date,
        payeur: record.payeur,
        montant: record.montant,
        motif: record.motif,
        moyenOrigine: record.moyenOrigine,
        referenceBancaire: record.referenceBancaire,
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
        title={`Dépôt avoir ${record.reference}`}
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
              data-testid="depot-avoir-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce dépôt a été annulé. Le solde de l&apos;étudiant a été débité d&apos;autant.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Bénéficiaire</p>
          {etudiant ? (
            <button onClick={() => setLocation(`/admin/students/${etudiant.id}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="depot-avoir-voir-etudiant">
              {record.payeur}
            </button>
          ) : (
            <p className="font-semibold text-sm mt-1">{record.payeur}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant crédité</p>
          <p className="font-bold text-primary text-sm mt-1">{formatCFA(record.montant)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Solde avoir actuel de l&apos;étudiant</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(etudiant?.soldeAvoir ?? 0)}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", record.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
            {record.annulee ? "Annulé" : "Validé"}
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Motif</h3>
        </div>
        <p className="px-5 py-4 text-sm">{record.motif}</p>
        {(record.moyenOrigine || record.referenceBancaire) && (
          <p className="px-5 pb-4 text-xs text-muted-foreground">
            {record.moyenOrigine && <>Mode de règlement : {record.moyenOrigine} </>}
            {record.referenceBancaire && <>— Référence : {record.referenceBancaire}</>}
          </p>
        )}
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le dépôt
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Ce dépôt a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le dépôt {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Le solde d&apos;avoir de l&apos;étudiant sera débité de {formatCFA(record.montant)}. Refusé si ce crédit a déjà été utilisé. Action irréversible.
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
