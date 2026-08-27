import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Eye, Send } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { addReglementMasse, type ReglementMasseLigne } from "@/data/reglementMasseStore";
import { statutPEC, resteAEncaisser } from "@/pages/admin/PriseEnChargePage";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { useAuth } from "@/contexts/AuthContext";
import { ANNEES_ACADEMIQUES } from "@/data/mockData";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const DEFAULT_ANNEE = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReglementMasseFormPage() {
  const [, setLocation] = useLocation();
  const organismes = useOrganismesPEC();
  const prisesEnCharge = usePrisesEnCharge();
  const modesPaiement = useModesPaiementFinance();
  const { currentUser } = useAuth();

  const [organismeId, setOrganismeId] = useState("");
  const [annee, setAnnee] = useState(DEFAULT_ANNEE);
  const [montantGlobal, setMontantGlobal] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [date, setDate] = useState(today());
  const [modePaiement, setModePaiement] = useState("");
  const [referenceBancaire, setReferenceBancaire] = useState("");

  const organisme = organismes.find((o) => o.id === organismeId);

  // Trie par date limite croissante : on règle les PEC les plus anciennes d'abord (FIFO).
  const pecEligibles = useMemo(() => {
    if (!organismeId || !annee) return [];
    return prisesEnCharge
      .filter((r) => r.organismeId === organismeId && r.annee === annee && statutPEC(r) !== "Annulée" && resteAEncaisser(r) > 0)
      .map((r) => ({ id: r.id, reference: r.reference, etudiant: r.etudiant, reste: resteAEncaisser(r), dateLimite: r.dateLimite }))
      .sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
  }, [prisesEnCharge, organismeId, annee]);

  const allocation = useMemo(() => {
    let remaining = Number(montantGlobal) || 0;
    return pecEligibles.map((p) => {
      const applied = Math.min(remaining, p.reste);
      remaining -= applied;
      return { ...p, montant: applied };
    });
  }, [pecEligibles, montantGlobal]);

  const totalAlloue = allocation.reduce((s, l) => s + l.montant, 0);
  const nonAffecte = Math.max(0, (Number(montantGlobal) || 0) - totalAlloue);

  const handleAfficher = () => {
    if (!organismeId) {
      toast.error("Sélectionnez une entité");
      return;
    }
    if (!annee) {
      toast.error("Sélectionnez une année de référence");
      return;
    }
    if (!Number(montantGlobal) || Number(montantGlobal) <= 0) {
      toast.error("Indiquez un montant global valide");
      return;
    }
    setRevealed(true);
  };

  const handleSubmit = () => {
    if (!modePaiement) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }
    if (allocation.length === 0 || totalAlloue <= 0) {
      toast.error("Aucune prise en charge à régler pour cette entité/année");
      return;
    }

    const lignes: ReglementMasseLigne[] = allocation
      .filter((l) => l.montant > 0)
      .map((l) => ({ priseEnChargeId: l.id, reference: l.reference, etudiant: l.etudiant, montant: l.montant }));

    const record = addReglementMasse({
      organismeId,
      organisme: organisme?.intitule ?? "",
      annee,
      date,
      modePaiement,
      referenceBancaire: referenceBancaire || undefined,
      montantGlobal: Number(montantGlobal),
      ajouteePar: currentUser?.name ?? "Administration",
      lignes,
    });

    toast.success(`Règlement en masse ${record.reference} enregistré`);
    setLocation(`/admin/encaissements-pec-masse/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les règlements en masse", href: "/admin/encaissements-pec-masse" },
          { label: "Nouvel encaissement organismes PEC en masse" },
        ]}
        title="Nouvel encaissement organismes PEC en masse"
        subtitle="Répartit automatiquement un montant global reçu d'un organisme sur toutes ses PEC encore dues (les plus anciennes d'abord)"
        actions={
          <button
            onClick={() => setLocation("/admin/encaissements-pec-masse")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5 max-w-4xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Entité <span className="text-red-500">*</span>
            </label>
            <select
              value={organismeId}
              onChange={(e) => {
                setOrganismeId(e.target.value);
                setRevealed(false);
              }}
              className={inputClass}
              data-testid="regm-organisme"
            >
              <option value="">Sélectionner…</option>
              {organismes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.intitule}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Année référence <span className="text-red-500">*</span>
            </label>
            <select
              value={annee}
              onChange={(e) => {
                setAnnee(e.target.value);
                setRevealed(false);
              }}
              className={inputClass}
              data-testid="regm-annee"
            >
              {ANNEES_ACADEMIQUES.map((a) => (
                <option key={a.id} value={a.libelle}>
                  {a.libelle}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Montant global règlement <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                value={montantGlobal}
                onChange={(e) => {
                  setMontantGlobal(e.target.value);
                  setRevealed(false);
                }}
                className={inputClass}
                data-testid="regm-montant"
              />
            </div>
            <button
              type="button"
              onClick={handleAfficher}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors h-fit"
              data-testid="regm-afficher"
            >
              <Eye size={15} /> Afficher
            </button>
          </div>
        </div>

        {revealed && (
          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Répartition proposée (les plus anciennes d&apos;abord)</h3>

            {pecEligibles.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                Aucune prise en charge active avec un reste à encaisser pour cette entité sur {annee}.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-3 py-2">Référence PEC</th>
                      <th className="text-left px-3 py-2">Étudiant</th>
                      <th className="text-left px-3 py-2">Date limite</th>
                      <th className="text-right px-3 py-2">Reste à encaisser</th>
                      <th className="text-right px-3 py-2">Montant réglé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocation.map((l) => (
                      <tr key={l.id} className={cn("border-b border-border last:border-0", l.montant === 0 && "text-muted-foreground")}>
                        <td className="px-3 py-2 font-medium">{l.reference}</td>
                        <td className="px-3 py-2">{l.etudiant}</td>
                        <td className="px-3 py-2">{formatShortDate(l.dateLimite)}</td>
                        <td className="px-3 py-2 text-right">{formatCFA(l.reste)}</td>
                        <td className="px-3 py-2 text-right font-medium text-primary">{formatCFA(l.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-muted/20 flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Total réparti : <strong className="text-foreground">{formatCFA(totalAlloue)}</strong>
                  </span>
                  {nonAffecte > 0 && <span className="text-amber-600">Non affecté : {formatCFA(nonAffecte)}</span>}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Date d&apos;encaissement <span className="text-red-500">*</span>
                </label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Mode de paiement <span className="text-red-500">*</span>
                </label>
                <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={inputClass} data-testid="regm-mode">
                  <option value="">Sélectionner…</option>
                  {modesPaiement.map((m) => (
                    <option key={m.id} value={m.intitule}>
                      {m.intitule}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence bancaire / N° chèque</label>
                <input value={referenceBancaire} onChange={(e) => setReferenceBancaire(e.target.value)} className={cn(inputClass, "font-mono")} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                data-testid="regm-submit"
              >
                <Send size={15} /> Sauvegarder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
