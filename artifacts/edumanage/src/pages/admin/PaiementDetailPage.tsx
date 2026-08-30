import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, Layers, HeartHandshake, UserSquare2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePaiements, useStudentStore } from "@/hooks/useStudentStore";
import { cancelPaiement, crediterAvoir } from "@/data/studentStore";
import { montantQuittance, statutQuittance } from "@/pages/admin/PaiementsPage";
import { useEmissionsMasse } from "@/hooks/useEmissionMasseStore";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { useEncaissements } from "@/hooks/useEncaissementStore";
import { annulerEncaissement } from "@/data/encaissementStore";
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
  telephone: string;
  email: string;
  montantQuittance: number;
  montantPaye: number;
  statut: string;
  lignes: { label: string; montant: number }[];
  moyen: string;
  reference: string;
}): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const resteAPayer = Math.max(0, args.montantQuittance - args.montantPaye);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.numero}</title>
<style>
* { box-sizing: border-box; }
body{font-family:'Segoe UI',Arial,sans-serif;max-width:760px;margin:32px auto;padding:48px;color:#1a1a2e;font-size:13px}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
.brand{display:flex;align-items:center;gap:12px}
.mark{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#22c1a0);flex-shrink:0}
.brand h1{font-size:16px;margin:0;color:#1a1a2e}
.brand p{font-size:11px;margin:2px 0 0;color:#888}
.receipt-title{text-align:right}
.receipt-title h2{font-size:28px;letter-spacing:2px;margin:0;color:#4f46e5;font-weight:800}
.receipt-title p{font-size:11px;margin:6px 0 0;color:#888}
.receipt-title strong{color:#1a1a2e}
.meta-row{display:flex;justify-content:space-between;margin-bottom:28px;gap:24px}
.meta-row .label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}
.meta-row .name{font-size:14px;font-weight:700;color:#1a1a2e}
.meta-row .sub{font-size:12px;color:#555;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{background:#1a2f5e;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:11px 14px}
th.num,td.num{text-align:right}
td{padding:11px 14px;border-bottom:1px solid #ececf2;font-size:13px}
tbody tr:last-child td{border-bottom:none}
.bottom{display:flex;justify-content:space-between;gap:32px;align-items:flex-start;margin-top:8px}
.payment-box{font-size:12px;color:#444;max-width:260px}
.payment-box .label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:6px;font-weight:700}
.payment-box div{margin:2px 0}
.summary{min-width:230px;border:1px solid #ececf2;border-radius:8px;overflow:hidden}
.summary .row{display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;background:#f7f8fc}
.summary .row + .row{border-top:1px solid #ececf2}
.summary .row.due{color:#c0392b;font-weight:600}
.summary .row.total{background:#1a2f5e;color:#fff;font-weight:800;font-size:14px}
.thanks{margin-top:32px;font-size:13px;font-weight:600;color:#1a2f5e}
.footer{margin-top:56px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#888}
.signature{text-align:center}
.signature .line{width:170px;border-top:1px solid #ccc;margin-bottom:6px}
.signature strong{color:#1a1a2e;font-size:12px}
@media print { body{margin:0} }
</style></head><body>
<div class="top">
  <div class="brand">
    <div class="mark"></div>
    <div><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
  </div>
  <div class="receipt-title">
    <h2>REÇU</h2>
    <p>Date : <strong>${args.emise}</strong></p>
    <p>N° : <strong>${args.numero}</strong></p>
  </div>
</div>

<div class="meta-row">
  <div>
    <div class="label">Adressé à</div>
    <div class="name">${args.etudiant}</div>
    <div class="sub">${args.matricule}${args.classe ? ` — ${args.classe}` : ""}</div>
    ${args.telephone ? `<div class="sub">${args.telephone}</div>` : ""}
    ${args.email ? `<div class="sub">${args.email}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div class="label">Statut</div>
    <div class="name">${args.statut}</div>
    ${args.limite ? `<div class="sub">Date limite : ${args.limite}</div>` : ""}
  </div>
</div>

<table>
<thead><tr><th>Rubrique</th><th class="num">Montant</th></tr></thead>
<tbody>
${args.lignes.map((l) => `<tr><td>${l.label}</td><td class="num">${formatCFA(l.montant)}</td></tr>`).join("")}
</tbody>
</table>

<div class="bottom">
  <div class="payment-box">
    <div class="label">Méthode de paiement</div>
    <div>Mode : ${args.moyen || "—"}</div>
    <div>Référence : ${args.reference || "—"}</div>
  </div>
  <div class="summary">
    <div class="row"><span>Sous-total</span><span>${formatCFA(args.montantQuittance)}</span></div>
    <div class="row"><span>Montant payé</span><span>${formatCFA(args.montantPaye)}</span></div>
    ${resteAPayer > 0 ? `<div class="row due"><span>Reste à payer</span><span>${formatCFA(resteAPayer)}</span></div>` : ""}
    <div class="row total"><span>Total</span><span>${formatCFA(args.montantQuittance)}</span></div>
  </div>
</div>

<p class="thanks">Merci pour votre confiance !</p>

<div class="footer">
  <div>
    Institut Supérieur EduManage<br />
    Dakar, Sénégal<br />
    Fait le ${now}
  </div>
  <div class="signature">
    <div class="line"></div>
    <strong>Le Responsable Financier</strong>
  </div>
</div>
</body></html>`;
}

export default function PaiementDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const paiements = usePaiements();
  const etudiants = useStudentStore();
  const emissions = useEmissionsMasse();
  const prisesEnCharge = usePrisesEnCharge();
  const encaissements = useEncaissements();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = paiements.find((p) => p.id === id);
  const emissionOrigine = record ? emissions.find((e) => e.quittanceIds.includes(record.id)) : undefined;
  const priseEnChargeOrigine = record ? prisesEnCharge.find((r) => r.lignes.some((l) => l.quittanceId === record.id)) : undefined;
  const encaissementsQuittance = record
    ? encaissements.filter((e) => e.quittanceId === record.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

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
    // Recrédite le solde avoir pour chaque versement AVOIR non déjà annulé, et marque ces encaissements comme annulés
    // (la part réglée en espèces/Wave/etc. n'est pas remboursée automatiquement : ça reste un mouvement d'argent réel).
    encaissementsQuittance
      .filter((e) => !e.annulee && e.moyen.toUpperCase() === "AVOIR")
      .forEach((e) => {
        crediterAvoir(record.etudiantId, e.montant);
        annulerEncaissement(e.id);
      });
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
        telephone: etu?.telephone ?? "",
        email: etu?.email ?? "",
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
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Historique des encaissements</h3>
          {encaissementsQuittance.length > 0 && (
            <button onClick={() => setLocation("/admin/encaissements")} className="text-xs text-primary hover:underline">
              Voir tous les encaissements
            </button>
          )}
        </div>
        {encaissementsQuittance.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-4">Aucun encaissement enregistré pour cette quittance.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Numéro</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Mode</th>
                <th className="text-center px-4 py-3">Statut</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {encaissementsQuittance.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/encaissements/${e.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{e.reference}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCFA(e.montant)}</td>
                  <td className="px-4 py-3">{e.moyen}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", e.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                      {e.annulee ? "Annulé" : "Validé"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-primary">Voir</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
