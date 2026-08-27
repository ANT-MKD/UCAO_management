import { useMemo, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { enregistrerPaiementDecompte } from "@/data/decomptePaiementStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { useAuth } from "@/contexts/AuthContext";
import { filterTeachers, teacherDisplayLabel, type EnseignantRecord } from "@/lib/teacherUtils";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function DecomptePaiementFormPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const decompteIdParam = params.get("decompteId") ?? "";

  const decomptes = useDecomptes();
  const modesPaiement = useModesPaiementFinance();
  const { currentUser } = useAuth();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const modesDisponibles = modesPaiement.filter((m) => m.intitule.toUpperCase() !== "AVOIR");

  const [query, setQuery] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDecompteId, setSelectedDecompteId] = useState(decompteIdParam);
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState("");
  const [referenceBancaire, setReferenceBancaire] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const preselected = decompteIdParam ? decomptes.find((d) => d.id === decompteIdParam) : undefined;

  useEffect(() => {
    if (!preselected) return;
    setSelectedTeacherId(preselected.teacherId);
    const t = teachers.find((x) => x.id === preselected.teacherId);
    if (t) setQuery(teacherDisplayLabel(t));
    setSelectedDecompteId(preselected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decompteIdParam]);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId) ?? null;
  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  const decomptesPayables = useMemo(() => {
    if (!selectedTeacherId) return [];
    return decomptes
      .filter((d) => d.teacherId === selectedTeacherId && d.statut === "emis" && d.netAPayer - d.montantPaye > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [decomptes, selectedTeacherId]);

  const selectedDecompte = decomptesPayables.find((d) => d.id === selectedDecompteId) ?? null;
  const resteAPayer = selectedDecompte ? selectedDecompte.netAPayer - selectedDecompte.montantPaye : 0;
  const montantDepasse = selectedDecompte ? Number(montant) > resteAPayer : false;

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedTeacherId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    setSelectedDecompteId("");
    setMontant("");
  };

  const pickDecompte = (decompteId: string, reste: number) => {
    setSelectedDecompteId(decompteId);
    setMontant(String(reste));
  };

  const canSubmit =
    !!selectedDecompte &&
    Number(montant) > 0 &&
    !montantDepasse &&
    moyen.trim().length > 0;

  const handleSubmit = () => {
    if (!selectedDecompte) return;
    if (!canSubmit) {
      toast.error("Sélectionnez un décompte, un montant valide et un mode de règlement");
      return;
    }
    const result = enregistrerPaiementDecompte({
      decompteId: selectedDecompte.id,
      montant: Number(montant),
      moyen,
      referenceBancaire: referenceBancaire.trim() || undefined,
      date,
      payePar: currentUser?.name ?? "Administration",
    });
    if (!result.ok || !result.record) {
      toast.error(result.reason ?? "Impossible d'enregistrer ce paiement.");
      return;
    }
    toast.success(`Paiement ${result.record.reference} enregistré — ${formatCFA(result.record.montant)}`);
    setLocation(`/admin/decomptes/${selectedDecompte.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Paiement professeur" }]}
        title="Nouveau paiement professeur"
        subtitle="Enregistre le règlement (total ou partiel) d'un décompte émis"
        actions={
          <button onClick={() => setLocation("/admin/decomptes-professeurs")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            Annuler
          </button>
        }
      />

      <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Professeur <span className="text-red-500">*</span>
          </label>
          {selectedTeacher ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
              <div className="flex-1">
                <div className="font-medium text-foreground text-sm">{selectedTeacher.prenom} {selectedTeacher.nom}</div>
                <div className="text-xs text-muted-foreground font-mono">{selectedTeacher.matricule}</div>
              </div>
              <button onClick={() => { setSelectedTeacherId(""); setQuery(""); setSelectedDecompteId(""); setMontant(""); }} className="text-xs text-muted-foreground hover:text-foreground underline ml-2">
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Matricule, prénom, nom ou téléphone…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="decompte-paiement-search"
                />
                {showSuggestions && suggestions.length > 0 && query.trim().length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {suggestions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTeacher(t)}
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
                        data-testid={`decompte-paiement-option-${t.id}`}
                      >
                        {teacherDisplayLabel(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {selectedTeacher && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Décompte à régler <span className="text-red-500">*</span>
            </label>
            {decomptesPayables.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                Aucun décompte émis avec un reste à payer pour {selectedTeacher.prenom} {selectedTeacher.nom}.
              </p>
            ) : (
              <div className="space-y-2">
                {decomptesPayables.map((d) => {
                  const reste = d.netAPayer - d.montantPaye;
                  const active = d.id === selectedDecompteId;
                  return (
                    <div
                      key={d.id}
                      onClick={() => pickDecompte(d.id, reste)}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                      )}
                      data-testid={`decompte-paiement-choix-${d.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{d.reference}</p>
                        <p className="text-xs text-muted-foreground">Émis le {formatDate(d.date)} — {formatCFA(d.montantPaye)} déjà payé</p>
                      </div>
                      <p className="font-semibold text-sm text-primary">Reste : {formatCFA(reste)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedDecompte && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Montant à régler (FCFA) <span className="text-red-500">*</span>
                </label>
                <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} className={cn(inputClass, "font-mono")} data-testid="decompte-paiement-montant" />
                <p className={cn("text-[11px] mt-1", montantDepasse ? "text-red-600 font-medium" : "text-muted-foreground")}>
                  Reste à payer : {formatCFA(resteAPayer)}
                  {montantDepasse && " — dépasse le reste à payer"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Choisir un mode de règlement <span className="text-red-500">*</span>
                </label>
                <select value={moyen} onChange={(e) => setMoyen(e.target.value)} className={inputClass} data-testid="decompte-paiement-mode">
                  <option value="">Sélectionner…</option>
                  {modesDisponibles.map((m) => (
                    <option key={m.id} value={m.intitule}>{m.intitule}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence</label>
                <input value={referenceBancaire} onChange={(e) => setReferenceBancaire(e.target.value)} className={cn(inputClass, "font-mono")} />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={() => setLocation("/admin/decomptes-professeurs")} className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="decompte-paiement-submit"
          >
            <Send size={15} /> Enregistrer le paiement
          </button>
        </div>
      </div>
    </div>
  );
}
