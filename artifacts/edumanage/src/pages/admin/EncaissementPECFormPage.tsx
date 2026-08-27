import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { addEncaissementPEC, type EncaissementPECLigne } from "@/data/encaissementPECStore";
import { statutPEC, resteAEncaisser } from "@/pages/admin/PriseEnChargePage";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EncaissementPECFormPage() {
  const [, setLocation] = useLocation();
  const organismes = useOrganismesPEC();
  const prisesEnCharge = usePrisesEnCharge();
  const modesPaiement = useModesPaiementFinance();
  const { currentUser } = useAuth();

  const [organismeId, setOrganismeId] = useState("");
  const [date, setDate] = useState(today());
  const [modePaiement, setModePaiement] = useState("");
  const [referenceBancaire, setReferenceBancaire] = useState("");
  const [montantTotal, setMontantTotal] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const pecAEncaisser = useMemo(() => {
    if (!organismeId) return [];
    return prisesEnCharge
      .filter((r) => r.organismeId === organismeId && statutPEC(r) !== "Annulée" && resteAEncaisser(r) > 0)
      .map((r) => ({ id: r.id, reference: r.reference, etudiant: r.etudiant, reste: resteAEncaisser(r), dateLimite: r.dateLimite }));
  }, [prisesEnCharge, organismeId]);

  const allocation = useMemo(() => {
    const checked = pecAEncaisser.filter((p) => checkedIds.includes(p.id));
    let remaining = Number(montantTotal) || 0;
    return checked.map((p) => {
      const applied = Math.min(remaining, p.reste);
      remaining -= applied;
      return { ...p, montant: applied };
    });
  }, [pecAEncaisser, checkedIds, montantTotal]);

  const totalAlloue = allocation.reduce((s, l) => s + l.montant, 0);
  const nonAffecte = Math.max(0, (Number(montantTotal) || 0) - totalAlloue);

  const handleOrganismeChange = (id: string) => {
    setOrganismeId(id);
    setCheckedIds([]);
  };

  const toggleLigne = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTous = () => {
    const ids = pecAEncaisser.map((p) => p.id);
    const tousCoches = ids.every((id) => checkedIds.includes(id));
    setCheckedIds(tousCoches ? [] : ids);
  };

  const handleSubmit = () => {
    if (!organismeId) {
      toast.error("Sélectionnez un organisme");
      return;
    }
    if (!modePaiement) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }
    if (!Number(montantTotal) || Number(montantTotal) <= 0) {
      toast.error("Indiquez un montant encaissé valide");
      return;
    }
    if (allocation.length === 0 || totalAlloue <= 0) {
      toast.error("Sélectionnez au moins une prise en charge à encaisser");
      return;
    }

    const organisme = organismes.find((o) => o.id === organismeId);
    const lignes: EncaissementPECLigne[] = allocation
      .filter((l) => l.montant > 0)
      .map((l) => ({ priseEnChargeId: l.id, reference: l.reference, montant: l.montant }));

    const record = addEncaissementPEC({
      organismeId,
      organisme: organisme?.intitule ?? "",
      date,
      modePaiement,
      referenceBancaire: referenceBancaire || undefined,
      ajouteePar: currentUser?.name ?? "Administration",
      lignes,
    });

    toast.success(`Encaissement ${record.reference} enregistré`);
    setLocation(`/admin/encaissements-pec/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les encaissements PEC", href: "/admin/encaissements-pec" },
          { label: "Nouvel encaissement de PEC" },
        ]}
        title="Nouvel encaissement de PEC"
        subtitle="Enregistre l'argent reçu d'un organisme pour ses prises en charge déjà engagées"
        actions={
          <button
            onClick={() => setLocation("/admin/encaissements-pec")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5 max-w-4xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Organisme <span className="text-red-500">*</span>
            </label>
            <select value={organismeId} onChange={(e) => handleOrganismeChange(e.target.value)} className={inputClass} data-testid="enc-pec-organisme">
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
              Date d&apos;encaissement <span className="text-red-500">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Mode de paiement <span className="text-red-500">*</span>
            </label>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={inputClass} data-testid="enc-pec-mode">
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

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Montant encaissé (FCFA) <span className="text-red-500">*</span>
          </label>
          <input type="number" min={0} value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)} className={inputClass} data-testid="enc-pec-montant" />
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground">Prises en charge à encaisser</h3>
            {pecAEncaisser.length > 0 && (
              <button onClick={toggleTous} className="text-xs text-primary hover:underline">
                Tout {pecAEncaisser.every((p) => checkedIds.includes(p.id)) ? "décocher" : "cocher"}
              </button>
            )}
          </div>

          {!organismeId ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Sélectionnez un organisme pour voir ses prises en charge encore à encaisser.
            </div>
          ) : pecAEncaisser.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Aucune prise en charge active avec un reste à encaisser pour cet organisme.
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-3 py-2 w-8" />
                    <th className="text-left px-3 py-2">Référence</th>
                    <th className="text-left px-3 py-2">Étudiant</th>
                    <th className="text-right px-3 py-2">Reste à encaisser</th>
                    <th className="text-right px-3 py-2">Montant encaissé</th>
                  </tr>
                </thead>
                <tbody>
                  {pecAEncaisser.map((p) => {
                    const checked = checkedIds.includes(p.id);
                    const ligne = allocation.find((l) => l.id === p.id);
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={checked} onChange={() => toggleLigne(p.id)} className="rounded" data-testid={`enc-pec-ligne-${p.id}`} />
                        </td>
                        <td className="px-3 py-2 font-medium">{p.reference}</td>
                        <td className="px-3 py-2">{p.etudiant}</td>
                        <td className="px-3 py-2 text-right">{formatCFA(p.reste)}</td>
                        <td className="px-3 py-2 text-right font-medium text-primary">{checked ? formatCFA(ligne?.montant ?? 0) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-muted/20 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {checkedIds.length} PEC sélectionnée(s) — total réparti : <strong className="text-foreground">{formatCFA(totalAlloue)}</strong>
                </span>
                {nonAffecte > 0 && <span className="text-amber-600">Non affecté : {formatCFA(nonAffecte)}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="enc-pec-submit"
          >
            <Send size={15} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
