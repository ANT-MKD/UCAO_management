import { useState } from "react";
import { useLocation } from "wouter";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useReductionsFrais } from "@/hooks/useReductionFraisStore";
import { annulerReductionFrais } from "@/data/reductionFraisStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { usePersonnel } from "@/hooks/usePersonnelStore";
import { formatCFA, formatDate, cn } from "@/lib/utils";

export default function ReductionFraisDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const reductions = useReductionsFrais();
  const etudiants = useStudentStore();
  const personnel = usePersonnel();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = reductions.find((r) => r.id === id);
  const etudiant = record ? etudiants.find((e) => e.id === record.etudiantId) : undefined;
  const emetteur = record ? personnel.find((p) => p.id === record.personnelId) : undefined;

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Réduction" }, { label: "Les réductions", href: "/admin/reductions-frais" }]}
          title="Réduction introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette réduction n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    const result = annulerReductionFrais(record.id);
    if (!result.ok) {
      toast.error(result.reason);
      setConfirmCancel(false);
      return;
    }
    toast.success("Réduction annulée — le montant a été restauré sur le solde dû de l'étudiant");
    setConfirmCancel(false);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Réduction" }, { label: "Les réductions", href: "/admin/reductions-frais" }, { label: record.reference }]}
        title={`Réduction ${record.reference}`}
        subtitle={formatDate(record.date)}
        actions={
          <span className={cn("text-xs px-3 py-1.5 rounded-full font-medium", record.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
            {record.annulee ? "Annulée" : "Validée"}
          </span>
        }
      />

      <div className="max-w-2xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Étudiant</p>
          {etudiant ? (
            <button
              onClick={() => setLocation(`/admin/students/${etudiant.id}`)}
              className="text-left w-full p-3 rounded-xl border border-border hover:bg-muted transition-colors"
            >
              <div className="font-medium text-foreground text-sm">{etudiant.prenom} {etudiant.nom}</div>
              <div className="text-xs text-muted-foreground font-mono">{etudiant.matricule}</div>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Étudiant introuvable (peut-être supprimé)</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-2 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Émise par</p>
            <p className="text-sm font-medium text-foreground">{emetteur ? `${emetteur.username} - ${emetteur.nom}` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Taux appliqué</p>
            <p className="text-sm font-medium text-foreground">{record.tauxApplique}%</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Total réduit</p>
            <p className="text-lg font-bold text-primary">{formatCFA(record.totalReduit)}</p>
          </div>
        </div>

        {!record.annulee ? (
          <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
            <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
            Annuler la réduction
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">Cette réduction a été annulée — le montant a été restauré sur le solde dû de l&apos;étudiant.</p>
        )}
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler la réduction {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Le montant de {formatCFA(record.totalReduit)} sera restauré sur le solde dû de l&apos;étudiant, et le plafond de {emetteur?.nom ?? "cette personne"} sera libéré d&apos;autant.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmCancel(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleCancel} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700" data-testid="reduction-frais-confirmer-annulation">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
