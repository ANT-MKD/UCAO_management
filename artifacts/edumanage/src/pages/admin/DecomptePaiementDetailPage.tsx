import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import { annulerPaiementDecompte, type DecomptePaiementLigneDetail } from "@/data/decomptePaiementStore";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";

function buildPaiementHtml(args: {
  reference: string;
  date: string;
  professeur: string;
  decompteReference: string;
  decompteDateEmission: string;
  montantDecompteTotal: number;
  abattementMontant: number;
  montant: number;
  moyen: string;
  referenceBancaire?: string;
  lignes: DecomptePaiementLigneDetail[];
}): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const rows = args.lignes
    .map(
      (l) =>
        `<tr><td>${l.coursLabel}</td><td>${formatShortDate(l.date)}</td><td style="text-align:center">${l.duree}H</td><td style="text-align:right">${formatCFA(l.montantApplique)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.reference}</title>
<style>
body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:40px;color:#1a1a1a}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.header p{font-size:12px;color:#666;margin:4px 0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0}
.meta{display:flex;flex-wrap:wrap;gap:20px;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:20px}
th,td{border:1px solid #ccc;padding:6px 8px}
th{background:#f3f4f6;text-align:left}
.footer{margin-top:50px;font-size:11px;color:#666}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
<div class="title">PAIEMENT PROFESSEUR N° ${args.reference}</div>
<div class="meta">
  <div>Date : <strong>${formatDate(args.date)}</strong></div>
  <div>Professeur : <strong>${args.professeur}</strong></div>
  <div>Décompte réglé : <strong>${args.decompteReference}</strong> (émis le ${formatDate(args.decompteDateEmission)})</div>
  <div>Mt total décompté : <strong>${formatCFA(args.montantDecompteTotal)}</strong></div>
  <div>Montant abattement : <strong>${formatCFA(args.abattementMontant)}</strong></div>
  <div>Montant payé : <strong>${formatCFA(args.montant)}</strong></div>
  <div>Mode de règlement : <strong>${args.moyen}</strong></div>
  ${args.referenceBancaire ? `<div>Référence : <strong>${args.referenceBancaire}</strong></div>` : ""}
</div>
${rows ? `<table><thead><tr><th>Cours</th><th>Date du cours</th><th>Durée</th><th>Payés</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
<div class="footer">Fait à Dakar, le ${now}</div>
</body></html>`;
}

export default function DecomptePaiementDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const paiements = useDecomptePaiements();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const record = paiements.find((p) => p.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les paiements professeurs", href: "/admin/decomptes-professeurs" }]}
          title="Paiement introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce paiement n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    annulerPaiementDecompte(record.id);
    toast.success("Paiement annulé — le montant a été retiré du décompte concerné");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildPaiementHtml({
        reference: record.reference,
        date: record.date,
        professeur: record.professeur,
        decompteReference: record.decompteReference,
        decompteDateEmission: record.decompteDateEmission,
        montantDecompteTotal: record.montantDecompteTotal,
        abattementMontant: record.abattementMontant,
        montant: record.montant,
        moyen: record.moyen,
        referenceBancaire: record.referenceBancaire,
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
          { label: "Les paiements professeurs", href: "/admin/decomptes-professeurs" },
          { label: record.reference },
        ]}
        title={`Paiement professeur ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/decomptes-professeurs")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="paiement-decompte-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce paiement a été annulé. Le montant a été retiré du décompte concerné.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Professeur</p>
          <button onClick={() => setLocation(`/admin/teachers/${record.teacherId}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="paiement-decompte-voir-professeur">
            {record.professeur}
          </button>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Décompte réglé</p>
          <button onClick={() => setLocation(`/admin/decomptes/${record.decompteId}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="paiement-decompte-voir-decompte">
            {record.decompteReference}
          </button>
          <p className="text-xs text-muted-foreground">Émis le {formatDate(record.decompteDateEmission)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Date / Mode de règlement</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{record.moyen}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant payé</p>
          <p className="font-bold text-primary text-sm mt-1">{formatCFA(record.montant)}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", record.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
            {record.annulee ? "Annulé" : "Validé"}
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 flex flex-wrap items-center gap-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Mt total décompté</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.montantDecompteTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant abattement</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.abattementMontant)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mt décompté (net)</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.montantDecompteTotal - record.abattementMontant)}</p>
        </div>
      </div>

      {record.lignes.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
            data-testid="paiement-decompte-toggle-detail"
          >
            <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Détails du paiement — {record.lignes.length} ligne(s)
            </span>
          </button>
          {expanded && (
            <div className="divide-y divide-border">
              {record.lignes.map((l, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{l.coursLabel}</p>
                    <p className="text-xs text-muted-foreground">Date du cours : {formatDate(l.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCFA(l.montantApplique)} payés</p>
                    <p className="text-xs text-muted-foreground">Durée : {l.duree}H</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {record.referenceBancaire && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Référence</h3>
          </div>
          <p className="px-5 py-4 text-sm">{record.referenceBancaire}</p>
        </div>
      )}

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le paiement
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Ce paiement a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le paiement {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Le montant sera retiré du décompte {record.decompteReference}. Action irréversible.
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
