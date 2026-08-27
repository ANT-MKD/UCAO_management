import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { cancelPriseEnCharge } from "@/data/priseEnChargeStore";
import { statutPEC, montantPEC } from "@/pages/admin/PriseEnChargePage";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Expirée: "bg-red-50 text-red-700",
  Annulée: "bg-slate-100 text-slate-600",
};

function buildPECHtml(args: {
  reference: string;
  organisme: string;
  etudiant: string;
  filiere: string;
  annee: string;
  debut: string;
  fin: string;
  dateLimite: string;
  type: string;
  lignes: { label: string; montantFrais: number; montantPEC: number }[];
}): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const total = args.lignes.reduce((s, l) => s + l.montantPEC, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.reference}</title>
<style>
body{font-family:Georgia,serif;max-width:750px;margin:40px auto;padding:40px;color:#1a1a1a}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.header p{font-size:12px;color:#666;margin:4px 0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0}
.meta{display:flex;flex-wrap:wrap;gap:20px;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
th{background:#f4f4f8}
.total-row td{font-weight:bold;background:#f9f9fc}
.footer{margin-top:50px;font-size:11px;color:#666}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
<div class="title">PRISE EN CHARGE N° ${args.reference}</div>
<div class="meta">
  <div>Organisme : <strong>${args.organisme}</strong></div>
  <div>Étudiant : <strong>${args.etudiant}</strong></div>
  <div>Filière : <strong>${args.filiere} (${args.annee})</strong></div>
</div>
<div class="meta">
  <div>Début : <strong>${formatDate(args.debut)}</strong></div>
  <div>Fin : <strong>${formatDate(args.fin)}</strong></div>
  <div>Date limite : <strong>${formatDate(args.dateLimite)}</strong></div>
</div>
<table>
<thead><tr><th>Frais</th><th>Montant</th><th>Montant PEC</th></tr></thead>
<tbody>
${args.lignes.map((l) => `<tr><td>${l.label}</td><td>${formatCFA(l.montantFrais)}</td><td>${formatCFA(l.montantPEC)}</td></tr>`).join("")}
<tr class="total-row"><td colspan="2">Total pris en charge</td><td>${formatCFA(total)}</td></tr>
</tbody>
</table>
<div class="footer">Fait à Dakar, le ${now}</div>
</body></html>`;
}

export default function PriseEnChargeDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const prisesEnCharge = usePrisesEnCharge();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = prisesEnCharge.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les prises en charge", href: "/admin/prises-en-charge" }]}
          title="Prise en charge introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette prise en charge n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const statut = statutPEC(record);
  const total = montantPEC(record);

  const handleCancel = () => {
    cancelPriseEnCharge(record.id);
    toast.success("Prise en charge annulée — les quittances couvertes ont été rétablies");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildPECHtml({
        reference: record.reference,
        organisme: record.organisme,
        etudiant: record.etudiant,
        filiere: record.filiere,
        annee: record.annee,
        debut: record.debut,
        fin: record.fin,
        dateLimite: record.dateLimite,
        type: record.type,
        lignes: record.lignes.map((l) => ({ label: l.label, montantFrais: l.montantFrais, montantPEC: l.montantPEC })),
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
          { label: "Les prises en charge", href: "/admin/prises-en-charge" },
          { label: record.reference },
        ]}
        title={`Prise en charge ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/prises-en-charge")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="pec-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Cette prise en charge a été annulée. Les quittances qu&apos;elle couvrait ont été rétablies.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Organisme</p>
          <p className="font-semibold text-sm mt-1">{record.organisme}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Étudiant</p>
          <p className="font-semibold text-sm mt-1">{record.etudiant}</p>
          <p className="text-xs text-muted-foreground">{record.filiere} / {record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Période / Date limite</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.debut)} → {formatDate(record.fin)}</p>
          <p className="text-xs text-muted-foreground">Limite : {formatDate(record.dateLimite)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {record.type === "montant" ? "Montant pris en charge" : `Pourcentage (${record.pourcentage}%)`}
          </p>
          <p className="font-semibold text-sm mt-1">{formatCFA(total)}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Frais couverts</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Frais</th>
              <th className="text-right px-4 py-3">Montant</th>
              <th className="text-right px-4 py-3">Montant PEC</th>
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{l.label}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{formatCFA(l.montantFrais)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCFA(l.montantPEC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler la prise en charge
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cette prise en charge a été annulée.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler la prise en charge {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Les quittances couvertes redeviendront dues pour le montant retiré. Action irréversible.
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
