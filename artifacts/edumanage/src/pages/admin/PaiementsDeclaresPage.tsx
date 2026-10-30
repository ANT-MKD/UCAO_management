import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { usePaiementsDeclares } from "@/hooks/usePaiementDeclareStore";
import { confirmerPaiementDeclare, rejeterPaiementDeclare, type PaiementDeclareRecord, type StatutPaiementDeclare } from "@/data/paiementDeclareStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

const ONGLETS: { id: StatutPaiementDeclare; label: string }[] = [
  { id: "a_verifier", label: "À vérifier" },
  { id: "confirme", label: "Confirmés" },
  { id: "rejete", label: "Rejetés" },
];

function formatDateHeure(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** File de vérification des paiements Wave / Orange Money déclarés par les étudiants : la caisse
 * rapproche chaque déclaration de son relevé avant qu'elle ne règle la facture. */
export default function PaiementsDeclaresPage() {
  const { currentUser } = useAuth();
  const declarations = usePaiementsDeclares();
  const [onglet, setOnglet] = useState<StatutPaiementDeclare>("a_verifier");
  const [aRejeter, setARejeter] = useState<PaiementDeclareRecord | null>(null);
  const [motif, setMotif] = useState("");

  const liste = useMemo(() => declarations.filter((d) => d.statut === onglet), [declarations, onglet]);
  const compte = (s: StatutPaiementDeclare) => declarations.filter((d) => d.statut === s).length;
  const totalAVerifier = declarations.filter((d) => d.statut === "a_verifier").reduce((s, d) => s + d.montant, 0);

  const confirmer = (d: PaiementDeclareRecord) => {
    if (!currentUser) return;
    try {
      confirmerPaiementDeclare(d.id, { id: currentUser.id, name: currentUser.name });
      toast.success(`Paiement de ${formatCFA(d.montant)} confirmé et encaissé pour ${d.etudiantLabel}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation impossible.");
    }
  };

  const rejeter = () => {
    if (!currentUser || !aRejeter) return;
    try {
      rejeterPaiementDeclare(aRejeter.id, { id: currentUser.id, name: currentUser.name }, motif);
      toast.success("Déclaration rejetée — l'étudiant a été prévenu.");
      setARejeter(null);
      setMotif("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejet impossible.");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Encaissement" }, { label: "Paiements en ligne à vérifier" }]}
        title="Paiements en ligne à vérifier"
        subtitle="Paiements Wave / Orange Money déclarés par les étudiants — à rapprocher du relevé avant encaissement"
      />

      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3 text-sm" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Smartphone size={18} className="text-primary" />
        <p className="text-muted-foreground flex-1 min-w-[240px]">
          Retrouvez chaque transaction sur le relevé Wave ou Orange Money (référence, téléphone, montant). <strong className="text-foreground">Confirmer</strong> règle la facture et crée l&apos;encaissement ; <strong className="text-foreground">Rejeter</strong> ne change rien à la facture et prévient l&apos;étudiant.
        </p>
        <span className="font-semibold" data-testid="paiements-declares-total">{formatCFA(totalAVerifier)} à vérifier</span>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 mb-4 w-fit">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={cn("px-3 py-1.5 text-sm rounded-lg font-medium transition-colors", onglet === o.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
            data-testid={`paiements-declares-onglet-${o.id}`}
          >
            {o.label} ({compte(o.id)})
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/40">
              <th className="text-left px-4 py-3">Déclaré le</th>
              <th className="text-left px-3 py-3">Étudiant</th>
              <th className="text-left px-3 py-3">Facture</th>
              <th className="text-right px-3 py-3">Montant</th>
              <th className="text-left px-3 py-3">Moyen · téléphone</th>
              <th className="text-left px-3 py-3">Référence</th>
              <th className="text-right px-4 py-3">{onglet === "a_verifier" ? "Action" : "Traité"}</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-12">
                  {onglet === "a_verifier" ? "Aucun paiement à vérifier." : "Aucune déclaration dans cette catégorie."}
                </td>
              </tr>
            ) : (
              liste.map((d) => (
                <tr key={d.id} className="border-t border-border align-top" data-testid={`paiement-declare-${d.id}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateHeure(d.declareLe)}</td>
                  <td className="px-3 py-3 font-medium">{d.etudiantLabel}</td>
                  <td className="px-3 py-3">
                    {d.rubrique}
                    <div className="text-[11px] text-muted-foreground font-mono">{d.quittanceReference}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatCFA(d.montant)}</td>
                  <td className="px-3 py-3">{d.moyen}<div className="text-[11px] text-muted-foreground">{d.telephone}</div></td>
                  <td className="px-3 py-3 font-mono text-xs">{d.referenceTransaction}</td>
                  <td className="px-4 py-3 text-right">
                    {d.statut === "a_verifier" ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => confirmer(d)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700" data-testid={`paiement-declare-confirmer-${d.id}`}>
                          <CheckCircle2 size={13} /> Confirmer
                        </button>
                        <button onClick={() => { setARejeter(d); setMotif(""); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40" data-testid={`paiement-declare-rejeter-${d.id}`}>
                          <XCircle size={13} /> Rejeter
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {d.traiteLe ? formatDateHeure(d.traiteLe) : ""} · {d.traitePar}
                        {d.motifRejet && <div className="text-red-600 mt-0.5">{d.motifRejet}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FormModal open={!!aRejeter} onClose={() => setARejeter(null)} title="Rejeter la déclaration" size="sm">
        {aRejeter && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {aRejeter.etudiantLabel} — {formatCFA(aRejeter.montant)} ({aRejeter.moyen}, réf. {aRejeter.referenceTransaction}). La facture reste due ; l&apos;étudiant reçoit le motif.
            </p>
            <div>
              <label htmlFor="motif-rejet" className="block text-xs font-medium text-muted-foreground mb-1.5">Motif *</label>
              <input
                id="motif-rejet"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="ex : transaction introuvable sur le relevé"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="paiement-declare-motif"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setARejeter(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted">Annuler</button>
              <button onClick={rejeter} disabled={!motif.trim()} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-40" data-testid="paiement-declare-rejeter-confirmer">
                Rejeter
              </button>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
