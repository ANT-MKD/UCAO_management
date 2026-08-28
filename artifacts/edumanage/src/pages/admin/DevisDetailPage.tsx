import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useDevisList } from "@/hooks/useDevisStore";
import { annulerDevis } from "@/data/devisStore";
import { formatCFA, formatDate, cn } from "@/lib/utils";

function ligneDescription(intitule: string, montant: number, modalite: string, nbEcheances: number | undefined, dateLimite: string | undefined, modeleLabel: string): string {
  if (modalite === "echeances" && nbEcheances) {
    const parEcheance = Math.round(montant / nbEcheances);
    const dateTxt = dateLimite ? ` au plus tard le ${dateLimite}` : "";
    return `${intitule} - ${formatCFA(montant)} payable en ${nbEcheances} échéances de ${formatCFA(parEcheance)}${dateTxt} pour le modèle de frais ${modeleLabel}`;
  }
  return `${intitule} - ${formatCFA(montant)} pour le modèle de frais ${modeleLabel} avant inscription`;
}

function buildDevisHtml(args: {
  reference: string;
  date: string;
  filiereLabel: string;
  niveauLabel: string;
  annee: string;
  beneficiaire: string;
  telephone: string;
  email?: string;
  adresse?: string;
  tauxTaxe: number;
  lignesTxt: { desc: string; montantTTC: number }[];
  totalHT: number;
  totalTaxe: number;
  totalTTC: number;
}): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const rows = args.lignesTxt
    .map((l) => `<tr><td>${l.desc}</td><td style="text-align:right">${formatCFA(l.montantTTC)}</td></tr>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.reference}</title>
<style>
body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:40px;color:#1a1a1a}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.header p{font-size:12px;color:#666;margin:4px 0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0}
.meta{display:flex;flex-wrap:wrap;gap:20px;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:20px}
th,td{border:1px solid #ccc;padding:6px 8px}
th{background:#f3f4f6;text-align:left}
.totals{margin-top:16px;text-align:right;font-size:13px}
.footer{margin-top:50px;font-size:11px;color:#666}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
<div class="title">DEVIS N° ${args.reference}</div>
<div class="meta">
  <div>Date : <strong>${formatDate(args.date)}</strong></div>
  <div>Filière : <strong>${args.filiereLabel}</strong></div>
  <div>Niveau : <strong>${args.niveauLabel}</strong> — <strong>${args.annee}</strong></div>
  <div>Adressé à : <strong>${args.beneficiaire}</strong></div>
  <div>Téléphone : <strong>${args.telephone}</strong></div>
  ${args.email ? `<div>Email : <strong>${args.email}</strong></div>` : ""}
  ${args.adresse ? `<div>Adresse : <strong>${args.adresse}</strong></div>` : ""}
  <div>Taxe appliquée : <strong>${args.tauxTaxe}%</strong></div>
</div>
<table><thead><tr><th>Intitulé</th><th>Montant TTC</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">
  <p>Total hors taxe : <strong>${formatCFA(args.totalHT)}</strong></p>
  <p>Total taxe : <strong>${formatCFA(args.totalTaxe)}</strong></p>
  <p style="font-size:16px">Grand Total : <strong>${formatCFA(args.totalTTC)}</strong></p>
</div>
<div class="footer">Fait à Dakar, le ${now} — Document informatif, sans valeur d'engagement financier.</div>
</body></html>`;
}

export default function DevisDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const devisList = useDevisList();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = devisList.find((d) => d.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les devis", href: "/admin/devis" }]}
          title="Devis introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce devis n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    annulerDevis(record.id);
    toast.success("Devis annulé");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDevisHtml({
        reference: record.reference,
        date: record.date,
        filiereLabel: record.filiereLabel,
        niveauLabel: record.niveauLabel,
        annee: record.annee,
        beneficiaire: record.beneficiaire,
        telephone: record.telephone,
        email: record.email,
        adresse: record.adresse,
        tauxTaxe: record.tauxTaxe,
        lignesTxt: record.lignes.map((l) => ({
          desc: ligneDescription(l.intitule, l.montantHT, l.modalite, l.nbEcheances, l.dateLimite, record.modeleFraisLabel),
          montantTTC: l.montantTTC,
        })),
        totalHT: record.totalHT,
        totalTaxe: record.totalTaxe,
        totalTTC: record.totalTTC,
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
          { label: "Les devis", href: "/admin/devis" },
          { label: record.reference },
        ]}
        title={`Devis ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/devis")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="devis-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annule && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce devis a été annulé.
        </div>
      )}

      <div className="mb-5 px-4 py-3 rounded-xl bg-sky-50 text-sky-700 text-xs">
        Document purement informatif : ce devis ne crée aucune dette ni quittance pour un étudiant.
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Filière / Niveau</p>
          <p className="font-semibold text-sm mt-1">{record.filiereLabel}</p>
          <p className="text-xs text-muted-foreground">{record.niveauLabel} — {record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Adressé à</p>
          <p className="font-semibold text-sm mt-1">{record.beneficiaire}</p>
          <p className="text-xs text-muted-foreground">{record.telephone}{record.email ? ` · ${record.email}` : ""}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émis le / Modèle de frais</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{record.modeleFraisLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Grand Total (TTC)</p>
          <p className="font-bold text-primary text-sm mt-1">{formatCFA(record.totalTTC)}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", record.annule ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
            {record.annule ? "Annulé" : "Actif"}
          </span>
        </div>
      </div>

      <div className="bg-sky-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl mb-0">
        Taxe appliquée : {record.tauxTaxe}%
      </div>
      <div className="bg-card border border-border rounded-b-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Intitulé</th>
              <th className="text-right px-4 py-3">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{ligneDescription(l.intitule, l.montantHT, l.modalite, l.nbEcheances, l.dateLimite, record.modeleFraisLabel)}</td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCFA(l.montantTTC)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/20">
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">Total hors taxe</td>
              <td className="px-4 py-2 text-right text-sm">{formatCFA(record.totalHT)}</td>
            </tr>
            <tr className="bg-muted/20">
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">Total taxe</td>
              <td className="px-4 py-2 text-right text-sm">{formatCFA(record.totalTaxe)}</td>
            </tr>
            <tr className="bg-muted/20 font-bold">
              <td className="px-4 py-3 text-right">Grand Total</td>
              <td className="px-4 py-3 text-right text-primary">{formatCFA(record.totalTTC)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!record.annule ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le devis
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Ce devis a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le devis {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Ce devis étant purement informatif, l&apos;annulation n&apos;a aucun impact financier.
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
