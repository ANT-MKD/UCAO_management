import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, Plus, Trash2, Receipt, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore, useInscriptions } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { useFraisEtudiant } from "@/hooks/useFraisEtudiantStore";
import { ajouterFraisEtudiant, supprimerFraisEtudiant, quittancerFraisEtudiant, type NouvelleLigneFraisEtudiant } from "@/data/fraisEtudiantStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface DraftLigne extends NouvelleLigneFraisEtudiant {
  key: string;
}

function emptyDraft(): DraftLigne {
  return { key: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, typeFraisId: "", montant: 0, dateLimite: undefined, obligatoire: false, echeance: false, nbEcheances: undefined };
}

export default function FraisEtudiantPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const typesFrais = useTypesFrais();
  const fraisEtudiant = useFraisEtudiant();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [autresAnneesOpen, setAutresAnneesOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftLigne[]>([]);
  const [quittancerImmediatement, setQuittancerImmediatement] = useState(false);

  const inscriptions = useInscriptions(selectedStudent?.id ?? "");

  const filteredStudents = searchQuery.length > 1 && !selectedStudent
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.telephone.includes(searchQuery)
      ).slice(0, 6)
    : [];

  const pickStudent = (s: EtudiantRecord) => {
    setSelectedStudent(s);
    setSearchQuery(`${s.matricule} - ${s.prenom.toUpperCase()} ${s.nom.toUpperCase()} (+${s.telephone})`);
    setDrafts([]);
    setQuittancerImmediatement(false);
  };

  const typeFraisLabel = (id: string) => typesFrais.find((t) => t.id === id)?.intitule ?? "Frais";

  const lignesEnAttente = useMemo(
    () => (selectedStudent ? fraisEtudiant.filter((l) => l.etudiantId === selectedStudent.id && l.annee === selectedStudent.annee && !l.quittanceId) : []),
    [fraisEtudiant, selectedStudent],
  );

  const addDraft = () => setDrafts((prev) => [...prev, emptyDraft()]);
  const updateDraft = (key: string, patch: Partial<DraftLigne>) => setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const handleSave = () => {
    if (!selectedStudent) return;
    if (drafts.length === 0) {
      toast.error("Ajoutez au moins une ligne de frais");
      return;
    }
    if (drafts.some((d) => !d.typeFraisId || d.montant <= 0)) {
      toast.error("Chaque ligne doit avoir un type de frais et un montant supérieur à 0");
      return;
    }
    if (drafts.some((d) => d.echeance && (!d.nbEcheances || d.nbEcheances < 1))) {
      toast.error("Indiquez un nombre d'échéances pour chaque ligne payable en échéances");
      return;
    }
    ajouterFraisEtudiant(
      selectedStudent.id,
      selectedStudent.annee,
      drafts.map(({ key, ...rest }) => rest),
      quittancerImmediatement,
      typeFraisLabel,
    );
    toast.success(quittancerImmediatement ? "Frais ajoutés et quittancés" : "Frais ajoutés — en attente de quittance");
    setDrafts([]);
    setQuittancerImmediatement(false);
  };

  const handleQuittancer = (id: string) => {
    const result = quittancerFraisEtudiant(id, typeFraisLabel);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success("Frais quittancé — le solde dû de l'étudiant a été mis à jour");
  };

  const handleSupprimer = (id: string) => {
    supprimerFraisEtudiant(id);
    toast.success("Frais supprimé");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Mise à jour frais étudiant" }, { label: "Ajouter frais étudiant" }]}
        title="Mise à jour frais étudiant"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="relative">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setSelectedStudent(null); }}
              placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone de l'étudiant…"
              className={cn(inputClass, "pl-10")}
              data-testid="frais-etudiant-search"
            />
          </div>
          {searchQuery.length > 1 && !selectedStudent && filteredStudents.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStudent(s)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
                  data-testid={`frais-etudiant-option-${s.id}`}
                >
                  <UserAvatar name={`${s.prenom} ${s.nom}`} size="sm" />
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{s.matricule}</span> — {s.prenom} {s.nom} (+{s.telephone})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
            <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
            <div className="flex-1">
              <div className="font-semibold text-foreground text-sm">{selectedStudent.matricule} - {selectedStudent.prenom.toUpperCase()} {selectedStudent.nom.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground">Solde dû actuel : <span className="font-semibold text-foreground">{formatCFA(selectedStudent.soldeDu)}</span></div>
            </div>
            <div className="relative">
              <button
                onClick={() => setAutresAnneesOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                data-testid="frais-etudiant-autres-annees"
              >
                Autres années <ChevronDown size={12} />
              </button>
              {autresAnneesOpen && (
                <div className="absolute right-0 z-20 mt-1 w-64 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                  {inscriptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Aucune autre inscription</p>
                  ) : (
                    [...inscriptions].sort((a, b) => b.annee.localeCompare(a.annee)).map((ins) => (
                      <div key={ins.id} className={cn("px-3 py-2 text-xs border-b border-border last:border-0", ins.annee === selectedStudent.annee && "bg-primary/5")}>
                        <div className="font-medium text-foreground">{ins.annee}{ins.annee === selectedStudent.annee ? " (en cours)" : ""}</div>
                        <div className="text-muted-foreground">{ins.filiere} · {ins.niveau} · {ins.classe} — solde dû {formatCFA(ins.soldeDu)}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {selectedStudent.filiere} | {selectedStudent.niveau} | {selectedStudent.annee}
            </div>
          </div>
        )}
      </div>

      {selectedStudent && (
        <>
          <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="text-sm font-semibold text-foreground mb-3">Frais non quittancés</h3>
            {lignesEnAttente.length === 0 ? (
              <p className="text-sm text-red-500" data-testid="frais-etudiant-aucun-en-attente">
                Aucun frais non quittancé détecté ou tous les frais ont été quittancés
              </p>
            ) : (
              <div className="space-y-2">
                {lignesEnAttente.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl border border-border" data-testid={`frais-etudiant-attente-${l.id}`}>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{typeFraisLabel(l.typeFraisId)}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.obligatoire ? "Obligatoire" : "Optionnel"} {l.echeance ? `· ${l.nbEcheances} échéance(s)` : ""} {l.dateLimite ? `· Limite ${formatShortDate(l.dateLimite)}` : ""}
                      </div>
                    </div>
                    <div className="font-bold text-foreground">{formatCFA(l.montant)}</div>
                    <button
                      onClick={() => handleQuittancer(l.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                      data-testid={`frais-etudiant-quittancer-${l.id}`}
                    >
                      <Receipt size={12} /> Quittancer
                    </button>
                    <button
                      onClick={() => handleSupprimer(l.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"
                      aria-label="Supprimer"
                      data-testid={`frais-etudiant-supprimer-${l.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Nouveau frais</h3>
              <button
                onClick={addDraft}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-white rounded-xl text-xs font-medium hover:bg-amber-600 transition-colors"
                data-testid="frais-etudiant-nouveau"
              >
                <Plus size={14} /> Nouveau frais
              </button>
            </div>

            {drafts.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-3 py-2">Type frais *</th>
                      <th className="text-left px-3 py-2">Montant *</th>
                      <th className="text-left px-3 py-2">Date limite</th>
                      <th className="text-center px-3 py-2">Obl?</th>
                      <th className="text-center px-3 py-2">Ech</th>
                      <th className="text-left px-3 py-2">Échéances</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d) => (
                      <tr key={d.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <select value={d.typeFraisId} onChange={(e) => updateDraft(d.key, { typeFraisId: e.target.value })} className={inputClass} data-testid={`frais-etudiant-draft-type-${d.key}`}>
                            <option value="">Sélectionner</option>
                            {typesFrais.map((t) => (
                              <option key={t.id} value={t.id}>{t.intitule}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={0} value={d.montant || ""} onChange={(e) => updateDraft(d.key, { montant: Number(e.target.value) || 0 })} className={inputClass} data-testid={`frais-etudiant-draft-montant-${d.key}`} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" value={d.dateLimite ?? ""} onChange={(e) => updateDraft(d.key, { dateLimite: e.target.value || undefined })} className={inputClass} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={d.obligatoire} onChange={(e) => updateDraft(d.key, { obligatoire: e.target.checked })} className="rounded" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={d.echeance} onChange={(e) => updateDraft(d.key, { echeance: e.target.checked, nbEcheances: e.target.checked ? d.nbEcheances : undefined })} className="rounded" data-testid={`frais-etudiant-draft-ech-${d.key}`} />
                        </td>
                        <td className="px-3 py-2">
                          {d.echeance && (
                            <input type="number" min={1} value={d.nbEcheances ?? ""} onChange={(e) => updateDraft(d.key, { nbEcheances: Number(e.target.value) || undefined })} className={inputClass} placeholder="Nb" data-testid={`frais-etudiant-draft-nbech-${d.key}`} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeDraft(d.key)} className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors" aria-label="Supprimer la ligne">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {drafts.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-4 cursor-pointer w-fit">
                <input type="checkbox" checked={quittancerImmediatement} onChange={(e) => setQuittancerImmediatement(e.target.checked)} className="rounded" data-testid="frais-etudiant-quittancer-immediat" />
                Quittancer immédiatement (augmente tout de suite le solde dû de l'étudiant, sinon le frais reste en attente)
              </label>
            )}

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={drafts.length === 0} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-testid="frais-etudiant-sauvegarder">
                Sauvegarder
              </button>
              <button onClick={() => setDrafts([])} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
