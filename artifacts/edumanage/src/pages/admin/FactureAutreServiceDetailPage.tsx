import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useFacturesAutreService } from "@/hooks/useFactureAutreServiceStore";
import { payerFactureAutreService, cancelFactureAutreService } from "@/data/factureAutreServiceStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { montantFactureAS, statutFactureAS } from "@/pages/admin/FactureAutreServicePage";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Payé: "bg-emerald-50 text-emerald-700",
  Acompte: "bg-amber-50 text-amber-700",
  Impayé: "bg-slate-100 text-slate-600",
  Annulé: "bg-red-50 text-red-700",
};

function buildFactureHtml(args: {
  reference: string;
  date: string;
  beneficiaire: string;
  telephone?: string;
  adresse?: string;
  remarque: string;
  lignes: { article: string; prixUnitaire: number; quantite: number; montant: number }[];
  montantTotal: number;
  montantPaye: number;
}): string {
  return buildPrintDocumentHtml({
    badge: "FACTURE",
    numeroLabel: "N° facture",
    numero: args.reference,
    dateLabel: "Émise le",
    date: formatDate(args.date),
    destinataireLabel: "Bénéficiaire",
    destinataireNom: args.beneficiaire,
    destinataireLignes: [
      ...(args.telephone ? [`Tél. +221 ${args.telephone}`] : []),
      ...(args.adresse ? [args.adresse] : []),
    ],
    tableauPersonnalise: {
      entetes: ["Article", "Prix unitaire", "Quantité", "Montant"],
      lignes: args.lignes.map((l) => [l.article, formatCFA(l.prixUnitaire), String(l.quantite), formatCFA(l.montant)]),
    },
    encartLabel: "Remarque",
    encartLignes: [args.remarque],
    summary: [
      { label: "Total facture", montant: args.montantTotal },
      { label: "Montant payé", montant: args.montantPaye, emphasis: "total" },
    ],
  });
}

export default function FactureAutreServiceDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const factures = useFacturesAutreService();
  const modesPaiement = useModesPaiementFinance();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showEncaisser, setShowEncaisser] = useState(false);
  const [montantVerse, setMontantVerse] = useState("");
  const [selectedMoyen, setSelectedMoyen] = useState("");
  const [referenceBancaire, setReferenceBancaire] = useState("");
  const [dateOperation, setDateOperation] = useState(new Date().toISOString().split("T")[0]);

  const record = factures.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les factures des autres services", href: "/admin/factures-autres-services" }]}
          title="Facture introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette facture n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const montantTotal = montantFactureAS(record);
  const statut = statutFactureAS(record);
  const resteAPayer = Math.max(0, montantTotal - record.montant);

  const handleCancel = () => {
    cancelFactureAutreService(record.id);
    toast.success("Facture annulée");
    setConfirmCancel(false);
  };

  const handleEncaisser = () => {
    if (!selectedMoyen || Number(montantVerse) <= 0) return;
    payerFactureAutreService({
      id: record.id,
      montant: Number(montantVerse),
      moyen: selectedMoyen,
      reference: referenceBancaire || undefined,
      date: dateOperation,
    });
    toast.success("Versement enregistré");
    setShowEncaisser(false);
    setMontantVerse("");
    setReferenceBancaire("");
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildFactureHtml({
        reference: record.reference,
        date: record.date,
        beneficiaire: record.beneficiaire,
        telephone: record.telephone,
        adresse: record.adresse,
        remarque: record.remarque,
        lignes: record.lignes,
        montantTotal,
        montantPaye: record.montant,
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
          { label: "Les factures des autres services", href: "/admin/factures-autres-services" },
          { label: record.reference },
        ]}
        title={`Facture ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/factures-autres-services")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="fas-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Bénéficiaire</p>
          <p className="font-semibold text-sm mt-1">{record.beneficiaire}</p>
          {record.telephone && <p className="text-xs text-muted-foreground">+221 {record.telephone}</p>}
          {record.adresse && <p className="text-xs text-muted-foreground">{record.adresse}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émise le</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          {record.referenceExterne && <p className="text-xs text-muted-foreground">Réf. {record.referenceExterne}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mt facture / Mt payé</p>
          <p className="font-semibold text-sm mt-1">
            {formatCFA(montantTotal)} <span className="text-muted-foreground font-normal">/ {formatCFA(record.montant)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Statut</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
          <p className="text-xs text-muted-foreground mt-1">Ajoutée par : {record.ajouteePar}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Remarque</h3>
        </div>
        <p className="px-5 py-4 text-sm">{record.remarque}</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Articles</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Article</th>
              <th className="text-right px-4 py-3">Prix unitaire</th>
              <th className="text-right px-4 py-3">Quantité</th>
              <th className="text-right px-4 py-3">Montant</th>
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{l.article}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{formatCFA(l.prixUnitaire)}</td>
                <td className="px-4 py-3 text-right">{l.quantite}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCFA(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Paiement</h3>
          {statut !== "Annulé" && resteAPayer > 0 && !showEncaisser && (
            <button
              onClick={() => { setShowEncaisser(true); setMontantVerse(String(resteAPayer)); setSelectedMoyen(modesPaiement[0]?.intitule ?? ""); }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              data-testid="fas-btn-encaisser"
            >
              <Wallet size={13} /> Enregistrer un versement
            </button>
          )}
        </div>
        <div className="px-5 py-4">
          {record.montant === 0 ? (
            <span className="text-sm text-muted-foreground">Aucun versement enregistré pour cette facture.</span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                <strong>{formatCFA(record.montant)}</strong> payé le <strong>{record.datePaiement ? formatDate(record.datePaiement) : "—"}</strong>
              </span>
              <span className="text-muted-foreground">
                Mode : {record.moyen ?? "—"} — Référence : {record.referenceBancairePaiement || "—"}
              </span>
            </div>
          )}
          {showEncaisser && (
            <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant versé (FCFA)</label>
                <input type="number" min={0} max={resteAPayer} value={montantVerse} onChange={(e) => setMontantVerse(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background font-mono" data-testid="fas-enc-montant" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mode de paiement</label>
                <select value={selectedMoyen} onChange={(e) => setSelectedMoyen(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background" data-testid="fas-enc-moyen">
                  {modesPaiement.map((m) => <option key={m.id} value={m.intitule}>{m.intitule}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence</label>
                <input value={referenceBancaire} onChange={(e) => setReferenceBancaire(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
                <input type="date" value={dateOperation} onChange={(e) => setDateOperation(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background" />
              </div>
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <button onClick={() => setShowEncaisser(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
                <button onClick={handleEncaisser} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="fas-enc-valider">Valider</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {record.statut !== "annule" ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler la facture
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cette facture a été annulée.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler la facture {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Cette action est irréversible.</p>
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
