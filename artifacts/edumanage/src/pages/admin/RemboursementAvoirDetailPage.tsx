import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useRemboursementsAvoir } from "@/hooks/useRemboursementAvoirStore";
import { annulerRemboursementAvoir } from "@/data/remboursementAvoirStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { formatCFA, formatDate, cn } from "@/lib/utils";

function buildRemboursementHtml(args: {
  reference: string;
  date: string;
  payeur: string;
  montant: number;
  motif: string;
  moyenRemboursement: string;
  referenceBancaire?: string;
}): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.reference}</title>
<style>
body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:40px;color:#1a1a1a}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.header p{font-size:12px;color:#666;margin:4px 0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0}
.meta{display:flex;flex-wrap:wrap;gap:20px;font-size:13px;margin-bottom:20px}
.footer{margin-top:50px;font-size:11px;color:#666}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
<div class="title">REMBOURSEMENT AVOIR N° ${args.reference}</div>
<div class="meta">
  <div>Date : <strong>${formatDate(args.date)}</strong></div>
  <div>Bénéficiaire : <strong>${args.payeur}</strong></div>
  <div>Montant remboursé : <strong>${formatCFA(args.montant)}</strong></div>
  <div>Mode de règlement : <strong>${args.moyenRemboursement}</strong></div>
  ${args.referenceBancaire ? `<div>Référence : <strong>${args.referenceBancaire}</strong></div>` : ""}
</div>
<p>Motif : ${args.motif}</p>
<div class="footer">Fait à Dakar, le ${now}</div>
</body></html>`;
}

export default function RemboursementAvoirDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const remboursements = useRemboursementsAvoir();
  const etudiants = useStudentStore();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = remboursements.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les remboursements", href: "/admin/avoir/remboursements" }]}
          title="Remboursement introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce remboursement n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const etudiant = etudiants.find((e) => e.id === record.etudiantId);

  const handleCancel = () => {
    annulerRemboursementAvoir(record.id);
    toast.success("Remboursement annulé — le solde avoir de l'étudiant a été recrédité");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildRemboursementHtml({
        reference: record.reference,
        date: record.date,
        payeur: record.payeur,
        montant: record.montant,
        motif: record.motif,
        moyenRemboursement: record.moyenRemboursement,
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
          { label: "Les remboursements", href: "/admin/avoir/remboursements" },
          { label: record.reference },
        ]}
        title={`Remboursement avoir ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/avoir/remboursements")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="remb-avoir-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce remboursement a été annulé. Le solde avoir de l&apos;étudiant a été recrédité.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Bénéficiaire</p>
          {etudiant ? (
            <button onClick={() => setLocation(`/admin/students/${etudiant.id}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="remb-avoir-voir-etudiant">
              {record.payeur}
            </button>
          ) : (
            <p className="font-semibold text-sm mt-1">{record.payeur}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Date / Mode de règlement</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{record.moyenRemboursement}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant remboursé</p>
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
        {record.referenceBancaire && (
          <p className="px-5 pb-4 text-xs text-muted-foreground">Référence : {record.referenceBancaire}</p>
        )}
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le remboursement
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Ce remboursement a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le remboursement {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Le solde d&apos;avoir de l&apos;étudiant sera recrédité de {formatCFA(record.montant)}. Action irréversible.
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
