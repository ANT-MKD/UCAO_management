import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, Layers, HeartHandshake, UserSquare2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePaiements, useStudentStore } from "@/hooks/useStudentStore";
import { cancelPaiement } from "@/data/studentStore";
import { montantQuittance, statutQuittance } from "@/pages/admin/PaiementsPage";
import { useEmissionsMasse } from "@/hooks/useEmissionMasseStore";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Payé: "bg-emerald-50 text-emerald-700",
  Acompte: "bg-amber-50 text-amber-700",
  Annulé: "bg-red-50 text-red-700",
  Impayé: "bg-slate-100 text-slate-600",
};

function buildQuittanceHtml(args: {
  numero: string;
  emise: string;
  limite: string;
  etudiant: string;
  matricule: string;
  classe: string;
  montantQuittance: number;
  montantPaye: number;
  statut: string;
  lignes: { label: string; montant: number }[];
  moyen: string;
  reference: string;
}): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.numero}</title>
<style>
body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:40px;color:#1a1a1a}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.header p{font-size:12px;color:#666;margin:4px 0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0}
.meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
th{background:#f4f4f8}
.total-row td{font-weight:bold;background:#f9f9fc}
.footer{margin-top:50px;font-size:11px;color:#666}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
<div class="title">QUITTANCE N° ${args.numero}</div>
<div class="meta">
  <div>Émise le : <strong>${args.emise}</strong></div>
  <div>Date limite : <strong>${args.limite || "—"}</strong></div>
  <div>Statut : <strong>${args.statut}</strong></div>
</div>
<p>Adressée à : <strong>${args.matricule} — ${args.etudiant}</strong> (${args.classe})</p>
<table>
<thead><tr><th>Rubrique</th><th>Montant</th></tr></thead>
<tbody>
${args.lignes.map((l) => `<tr><td>${l.label}</td><td>${formatCFA(l.montant)}</td></tr>`).join("")}
<tr class="total-row"><td>Montant quittancé</td><td>${formatCFA(args.montantQuittance)}</td></tr>
</tbody>
</table>
<p>Montant payé : <strong>${formatCFA(args.montantPaye)}</strong> — Mode : ${args.moyen} — Référence : ${args.reference}</p>
<div class="footer">Fait à Dakar, le ${now}</div>
</body></html>`;
}

export default function PaiementDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const paiements = usePaiements();
  const etudiants = useStudentStore();
  const emissions = useEmissionsMasse();
  const prisesEnCharge = usePrisesEnCharge();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = paiements.find((p) => p.id === id);
  const emissionOrigine = record ? emissions.find((e) => e.quittanceIds.includes(record.id)) : undefined;
  const priseEnChargeOrigine = record ? prisesEnCharge.find((r) => r.lignes.some((l) => l.quittanceId === record.id)) : undefined;

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les quittances", href: "/admin/paiements" }]}
          title="Quittance introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette quittance n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const etu = etudiants.find((e) => e.id === record.etudiantId);
  const mtQuittance = montantQuittance(record);
  const statut = statutQuittance(record);
  const lignes = record.lignes && record.lignes.length > 0 ? record.lignes : [{ label: record.rubrique, montant: record.montant }];

  const handleCancel = () => {
    cancelPaiement(record.id);
    toast.success("Quittance annulée");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildQuittanceHtml({
        numero: record.numeroRecu,
        emise: formatDate(record.date),
        limite: record.dateLimite ? formatDate(record.dateLimite) : "",
        etudiant: record.etudiant,
        matricule: etu?.matricule ?? "",
        classe: record.classe,
        montantQuittance: mtQuittance,
        montantPaye: record.montant,
        statut,
        lignes,
        moyen: record.moyen,
        reference: record.reference,
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
          { label: "Les quittances", href: "/admin/paiements" },
          { label: record.numeroRecu },
        ]}
        title={`Quittance ${record.numeroRecu}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/paiements")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            {etu && (
              <button
                onClick={() => setLocation(`/admin/students/${etu.id}`)}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
                data-testid="quittance-voir-dossier"
              >
                <UserSquare2 size={15} /> Dossier étudiant
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="quittance-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {emissionOrigine && (
        <button
          onClick={() => setLocation(`/admin/emissions-masse/${emissionOrigine.id}`)}
          className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm hover:bg-indigo-100 transition-colors"
          data-testid="quittance-emission-origine"
        >
          <Layers size={15} /> Issue de l&apos;émission en masse <strong>{emissionOrigine.reference}</strong>
        </button>
      )}

      {priseEnChargeOrigine && (
        <button
          onClick={() => setLocation(`/admin/prises-en-charge/${priseEnChargeOrigine.id}`)}
          className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 transition-colors"
          data-testid="quittance-pec-origine"
        >
          <HeartHandshake size={15} /> Réglée par la prise en charge <strong>{priseEnChargeOrigine.reference}</strong> ({priseEnChargeOrigine.organisme})
        </button>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Adressée à</p>
          <p className="font-semibold text-sm mt-1">{record.etudiant}</p>
          <p className="text-xs text-muted-foreground font-mono">{etu?.matricule}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émise le / Date limite</p>
          <p className="font-semibold text-sm mt-1">
            {formatDate(record.date)}
            {record.dateLimite && <span className="text-muted-foreground font-normal"> → {formatDate(record.dateLimite)}</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mt quittancé / Mt payé</p>
          <p className="font-semibold text-sm mt-1">
            {formatCFA(mtQuittance)} <span className="text-muted-foreground font-normal">/ {formatCFA(record.montant)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Statut</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Détails de la quittance</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Rubrique</th>
              <th className="text-right px-4 py-3">Montant</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{l.label}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCFA(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Détails de l&apos;encaissement</h3>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          {record.montant === 0 ? (
            <span className="text-muted-foreground">Aucun encaissement enregistré pour cette quittance.</span>
          ) : (
            <>
              <span>
                <strong>{formatCFA(record.montant)}</strong> payé le <strong>{formatDate(record.date)}</strong>
              </span>
              <span className="text-muted-foreground">
                Par : {record.moyen} — Référence : {record.reference}
              </span>
            </>
          )}
        </div>
      </div>

      {record.statut !== "annule" ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler la quittance
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cette quittance a été annulée.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler la quittance {record.numeroRecu} ?
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
