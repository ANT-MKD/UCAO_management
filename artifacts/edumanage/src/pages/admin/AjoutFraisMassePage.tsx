import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { useFraisEtudiant } from "@/hooks/useFraisEtudiantStore";
import { ajouterFraisEtudiantMasse, type NouvelleLigneFraisEtudiant } from "@/data/fraisEtudiantStore";
import { cn } from "@/lib/utils";

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES].sort((a, b) => b.libelle.localeCompare(a.libelle));
const DEFAULT_ANNEE = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0]?.libelle ?? "2025-2026";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface DraftLigne extends NouvelleLigneFraisEtudiant {
  key: string;
}

function emptyDraft(): DraftLigne {
  return { key: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, typeFraisId: "", montant: 0, dateLimite: undefined, obligatoire: false, echeance: false, nbEcheances: undefined };
}

export default function AjoutFraisMassePage() {
  const classes = useClasses();
  const etudiants = useStudentStore();
  const typesFraisComplet = useTypesFrais();
  const typesFrais = useMemo(() => typesFraisComplet.filter((t) => t.code !== "REP"), [typesFraisComplet]);
  const fraisEtudiant = useFraisEtudiant();

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(DEFAULT_ANNEE);
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [etudiantId, setEtudiantId] = useState("");
  const [drafts, setDrafts] = useState<DraftLigne[]>([]);
  const [quittancerImmediatement, setQuittancerImmediatement] = useState(false);

  const filteredNiveaux = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const filteredClasses = useMemo(() => {
    if (!filiereId || !niveau) return [];
    return classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau.alias && c.annee === annee);
  }, [classes, filiereId, niveau, annee]);

  const cohorte = useMemo(() => {
    if (!filiereId || !niveau) return [];
    return etudiants.filter((e) =>
      e.filiereId === filiereId &&
      e.niveau === niveau.alias &&
      e.annee === annee &&
      e.statut !== "suspendu" &&
      (!classeId || e.classeId === classeId)
    );
  }, [etudiants, filiereId, niveau, annee, classeId]);

  const handleFiliereChange = (id: string) => {
    setFiliereId(id);
    setNiveauId("");
    setClasseId("");
    setEtudiantId("");
  };
  const handleNiveauChange = (id: string) => {
    setNiveauId(id);
    setClasseId("");
    setEtudiantId("");
  };
  const handleAnneeChange = (v: string) => {
    setAnnee(v);
    setClasseId("");
    setEtudiantId("");
  };

  const typeFraisLabel = (id: string) => typesFraisComplet.find((t) => t.id === id)?.intitule ?? "Frais";

  const addDraft = () => setDrafts((prev) => [...prev, emptyDraft()]);
  const updateDraft = (key: string, patch: Partial<DraftLigne>) => setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const cibleIds = etudiantId ? [etudiantId] : cohorte.map((e) => e.id);

  const doublonWarning = (d: DraftLigne): string | null => {
    if (!d.typeFraisId) return null;
    if (drafts.filter((x) => x.typeFraisId === d.typeFraisId).length > 1) {
      return "Ce type de frais est ajouté plusieurs fois dans cette saisie";
    }
    const nbConcernes = cibleIds.filter((id) =>
      fraisEtudiant.some((l) => l.etudiantId === id && l.annee === annee && l.typeFraisId === d.typeFraisId && !l.annulee)
    ).length;
    if (nbConcernes > 0) {
      return `${nbConcernes} étudiant(s) de cette sélection ont déjà un frais actif de ce type pour cette année`;
    }
    return null;
  };

  const handleSave = () => {
    if (!filiereId || !niveauId || !annee) {
      toast.error("Sélectionnez le programme, l'année et le niveau");
      return;
    }
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
    if (cibleIds.length === 0) {
      toast.error("Aucun étudiant ne correspond à cette sélection");
      return;
    }
    const nb = ajouterFraisEtudiantMasse(cibleIds, annee, drafts.map(({ key, ...rest }) => rest), quittancerImmediatement, typeFraisLabel);
    toast.success(`Frais ajoutés à ${nb} étudiant(s)${quittancerImmediatement ? " et quittancés" : " — en attente de quittance"}`);
    setDrafts([]);
    setQuittancerImmediatement(false);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Mise à jour frais étudiant" }, { label: "Ajout frais en masse" }]}
        title="Ajout frais en masse"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
          <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="masse-ajout-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} className={inputClass} data-testid="masse-ajout-annee">
              {ANNEE_OPTIONS.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} className={inputClass} disabled={!filiereId} data-testid="masse-ajout-niveau">
              <option value="">Sélectionner</option>
              {filteredNiveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
            <select value={classeId} onChange={(e) => { setClasseId(e.target.value); setEtudiantId(""); }} className={inputClass} disabled={!niveauId} data-testid="masse-ajout-classe">
              <option value="">Toutes les classes</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
          <select value={etudiantId} onChange={(e) => setEtudiantId(e.target.value)} className={inputClass} disabled={cohorte.length === 0} data-testid="masse-ajout-etudiant">
            <option value="">Tous les étudiants de cette sélection ({cohorte.length})</option>
            {cohorte.map((e) => <option key={e.id} value={e.id}>{e.matricule} - {e.prenom} {e.nom}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Lignes de frais</h3>
          <button
            onClick={addDraft}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-white rounded-xl text-xs font-medium hover:bg-amber-600 transition-colors"
            data-testid="masse-ajout-nouvelle-ligne"
          >
            <Plus size={14} /> Nouvelle ligne de frais
          </button>
        </div>

        {drafts.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-3 py-2">Type frais *</th>
                  <th className="text-left px-3 py-2">Montant Frais *</th>
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
                      <select value={d.typeFraisId} onChange={(e) => updateDraft(d.key, { typeFraisId: e.target.value })} className={inputClass} data-testid={`masse-ajout-draft-type-${d.key}`}>
                        <option value="">Sélectionner</option>
                        {typesFrais.map((t) => (
                          <option key={t.id} value={t.id}>{t.intitule}</option>
                        ))}
                      </select>
                      {doublonWarning(d) && (
                        <p className="text-[10px] text-amber-600 mt-1" data-testid={`masse-ajout-draft-doublon-${d.key}`}>⚠ {doublonWarning(d)}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} value={d.montant || ""} onChange={(e) => updateDraft(d.key, { montant: Number(e.target.value) || 0 })} className={inputClass} data-testid={`masse-ajout-draft-montant-${d.key}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="date" value={d.dateLimite ?? ""} onChange={(e) => updateDraft(d.key, { dateLimite: e.target.value || undefined })} className={inputClass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={d.obligatoire} onChange={(e) => updateDraft(d.key, { obligatoire: e.target.checked })} className="rounded" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={d.echeance} onChange={(e) => updateDraft(d.key, { echeance: e.target.checked, nbEcheances: e.target.checked ? d.nbEcheances : undefined })} className="rounded" data-testid={`masse-ajout-draft-ech-${d.key}`} />
                    </td>
                    <td className="px-3 py-2">
                      {d.echeance && (
                        <input type="number" min={1} value={d.nbEcheances ?? ""} onChange={(e) => updateDraft(d.key, { nbEcheances: Number(e.target.value) || undefined })} className={inputClass} placeholder="Nb" data-testid={`masse-ajout-draft-nbech-${d.key}`} />
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
            <input type="checkbox" checked={quittancerImmediatement} onChange={(e) => setQuittancerImmediatement(e.target.checked)} className="rounded" data-testid="masse-ajout-quittancer-immediat" />
            Quittancer immédiatement pour tous les étudiants concernés (sinon les frais restent en attente)
          </label>
        )}

        <button onClick={handleSave} className={cn("px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors")} data-testid="masse-ajout-sauvegarder">
          Sauvegarder
        </button>
      </div>
    </div>
  );
}
