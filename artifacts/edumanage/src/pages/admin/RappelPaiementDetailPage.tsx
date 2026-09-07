import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useRappelsPaiement } from "@/hooks/useRappelPaiementStore";
import { usePaiements } from "@/hooks/useStudentStore";
import { formatCFA, formatDate, formatShortDate } from "@/lib/utils";

export default function RappelPaiementDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const rappels = useRappelsPaiement();
  const paiements = usePaiements();

  const record = rappels.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Rappel paiement", href: "/admin/rappel-paiement" }]}
          title="Rappel introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce rappel n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const quittancesConcernees = record.quittanceIds
    .map((qid) => paiements.find((p) => p.id === qid))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Rappel paiement", href: "/admin/rappel-paiement" }, { label: record.reference }]}
        title={`Rappel ${record.reference}`}
        subtitle={formatDate(record.date)}
        actions={
          <button onClick={() => setLocation("/admin/rappel-paiement")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="max-w-3xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-6 grid sm:grid-cols-2 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cohorte</p>
            <p className="text-sm font-medium text-foreground">{record.filiereLabel}{record.niveauLabel ? ` — ${record.niveauLabel}` : " — Tous niveaux"} ({record.annee})</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Frais échus avant</p>
            <p className="text-sm font-medium text-foreground">{formatShortDate(record.fraisEchusAvant)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nouvelle échéance appliquée</p>
            <p className="text-sm font-medium text-foreground">{record.nouvelleEcheance ? formatShortDate(record.nouvelleEcheance) : "Aucune"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Notifications envoyées</p>
            <p className="text-sm font-medium text-foreground">{record.nbNotificationsEnvoyees} sur {record.quittanceIds.length} quittance(s) ({record.nbEtudiants} étudiant(s))</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-sm font-semibold text-foreground mb-3">Quittances concernées</h3>
          {quittancesConcernees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune quittance retrouvée.</p>
          ) : (
            <div className="space-y-2">
              {quittancesConcernees.map((p) => (
                <div key={p.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{p.etudiant}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.numeroRecu}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">{formatCFA(p.montant)}</div>
                    <div className="text-[10px] text-muted-foreground">{p.dateLimite ? `Échéance ${formatShortDate(p.dateLimite)}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
