import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePECsMasse } from "@/hooks/usePECMasseStore";
import { cancelPECMasse } from "@/data/pecMasseStore";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { statutPEC, montantPEC } from "@/pages/admin/PriseEnChargePage";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Expirée: "bg-red-50 text-red-700",
  Annulée: "bg-slate-100 text-slate-600",
};

export default function PECMasseDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const pecsMasse = usePECsMasse();
  const prisesEnCharge = usePrisesEnCharge();
  const [expanded, setExpanded] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = pecsMasse.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "PEC en masse", href: "/admin/pec-masse" }]}
          title="PEC en masse introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette génération n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const pecs = record.priseEnChargeIds.map((pecId) => prisesEnCharge.find((p) => p.id === pecId)).filter((p): p is NonNullable<typeof p> => !!p);
  const montantTotal = pecs.reduce((sum, p) => sum + montantPEC(p), 0);

  const handleCancel = () => {
    cancelPECMasse(record.id);
    toast.success("Génération annulée — chaque prise en charge créée a été annulée");
    setConfirmCancel(false);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "PEC en masse", href: "/admin/pec-masse" },
          { label: record.reference },
        ]}
        title={`PEC en masse ${record.reference}`}
        actions={
          <button
            onClick={() => setLocation("/admin/pec-masse")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Fermer
          </button>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Cette génération a été annulée. Chaque prise en charge qu&apos;elle avait créée a été annulée.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Organisme</p>
          <p className="font-semibold text-sm mt-1">{record.organisme}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Programme</p>
          <p className="font-semibold text-sm mt-1">{record.classe}</p>
          <p className="text-xs text-muted-foreground">{record.filiere} — {record.niveau} — {record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émis le / Effectuée par</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.emisLe)}</p>
          <p className="text-xs text-muted-foreground">{record.ajouteePar}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total engagé</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(montantTotal)}</p>
          <p className="text-xs text-muted-foreground">{pecs.length} prise(s) en charge</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Conditions</h3>
        <p className="text-sm">
          Type : <strong>{record.type === "montant" ? "PEC par montant" : "PEC par pourcentage"}</strong>
          {record.type === "montant" ? (
            <span className="text-muted-foreground"> — {formatCFA(record.montant ?? 0)} par étudiant</span>
          ) : (
            <span className="text-muted-foreground"> — {record.pourcentage}%</span>
          )}
        </p>
        <p className="text-sm">
          Valable du <strong>{formatDate(record.debut)}</strong> au <strong>{formatDate(record.fin)}</strong> — Date limite :{" "}
          <strong>{formatDate(record.dateLimite)}</strong>
        </p>
        {record.filtreFrais && <p className="text-sm text-muted-foreground">Frais concernés : {record.filtreFrais}</p>}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
          data-testid="pecm-toggle"
        >
          <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {pecs.length} prise(s) en charge créée(s) — cliquer ici pour consulter
          </span>
        </button>
        {expanded && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Référence PEC</th>
                <th className="text-left px-4 py-3">Étudiant</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-center px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {pecs.map((p) => {
                const s = statutPEC(p);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setLocation(`/admin/prises-en-charge/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{p.reference}</td>
                    <td className="px-4 py-3">{p.etudiant}</td>
                    <td className="px-4 py-3 text-right">{formatCFA(montantPEC(p))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[s])}>{s}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler la génération
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cette génération a été annulée.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler la génération {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Chaque prise en charge créée par ce lot sera annulée (les quittances couvertes redeviennent dues). Action irréversible.
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
