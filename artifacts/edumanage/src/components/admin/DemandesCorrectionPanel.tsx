import { useState } from "react";
import { PencilLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandesCorrection } from "@/hooks/useCorrectionNoteStore";
import { libelleValeurNote, traiterDemandeCorrection, type DemandeCorrectionNoteRecord } from "@/data/correctionNoteStore";
import { MotifModal } from "@/components/admin/MotifModal";
import { formatDate } from "@/lib/utils";

/** Demandes de correction de notes envoyées par les professeurs (notes déjà validées ou publiées) :
 * la scolarité accepte — la note est corrigée et la correction inscrite au journal — ou refuse
 * avec un motif que le professeur verra. N'affiche rien quand aucune demande n'attend. */
export function DemandesCorrectionPanel() {
  const { currentUser } = useAuth();
  const demandes = useDemandesCorrection().filter((d) => d.statut === "en_attente");
  const [aRefuser, setARefuser] = useState<DemandeCorrectionNoteRecord | null>(null);

  if (demandes.length === 0) return null;

  const decider = (d: DemandeCorrectionNoteRecord, decision: "accepter" | "refuser", motif?: string) => {
    if (!currentUser) return;
    try {
      traiterDemandeCorrection(d.id, decision, currentUser.id, motif);
      toast.success(decision === "accepter" ? `Note corrigée : ${d.etudiant} — ${libelleValeurNote(d.nouvelleNote, d.nouvelAbsent)}.` : "Demande refusée — le professeur a été prévenu du motif.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  return (
    <div className="bg-card border border-amber-200 dark:border-amber-900 rounded-xl mb-5 overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }} data-testid="demandes-correction">
      <div className="px-5 py-3 border-b border-border bg-amber-50/60 dark:bg-amber-950/30 flex items-center gap-2">
        <PencilLine size={15} className="text-amber-700 dark:text-amber-300" />
        <h3 className="font-semibold text-sm text-foreground">Demandes de correction de notes ({demandes.length})</h3>
      </div>
      <div className="divide-y divide-border">
        {demandes.map((d) => (
          <div key={d.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3" data-testid={`demande-correction-${d.id}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {d.etudiant} <span className="text-muted-foreground font-normal">({d.matricule})</span> — {d.ec} · {d.typeLabel}
              </p>
              <p className="text-sm text-foreground mt-0.5">
                <span className="tabular-nums">{libelleValeurNote(d.ancienneNote, d.ancienAbsent)}</span> → <span className="font-semibold tabular-nums">{libelleValeurNote(d.nouvelleNote, d.nouvelAbsent)}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Motif : {d.motif} — demandée par {d.demandePar} le {formatDate(d.createdAt)}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" onClick={() => decider(d, "accepter")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700" data-testid={`demande-correction-accepter-${d.id}`}>Accepter</button>
              <button type="button" onClick={() => setARefuser(d)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950" data-testid={`demande-correction-refuser-${d.id}`}>Refuser</button>
            </div>
          </div>
        ))}
      </div>
      <MotifModal
        open={!!aRefuser}
        title={aRefuser ? `Refuser la correction — ${aRefuser.etudiant}` : ""}
        description="Le professeur verra ce motif dans sa saisie des notes."
        obligatoire
        libelleConfirmer="Refuser la correction"
        onCancel={() => setARefuser(null)}
        onConfirm={(motif) => { if (aRefuser) decider(aRefuser, "refuser", motif); setARefuser(null); }}
        testId="demande-correction-refus"
      />
    </div>
  );
}
