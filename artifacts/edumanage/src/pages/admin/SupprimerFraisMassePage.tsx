import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore, usePaiements } from "@/hooks/useStudentStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { useFraisEtudiant } from "@/hooks/useFraisEtudiantStore";
import { traiterFraisEtudiantMasse, statutFraisEtudiant } from "@/data/fraisEtudiantStore";
import { cn } from "@/lib/utils";

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES].sort((a, b) => b.libelle.localeCompare(a.libelle));
const DEFAULT_ANNEE = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0]?.libelle ?? "2025-2026";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function SupprimerFraisMassePage() {
  const classes = useClasses();
  const etudiants = useStudentStore();
  const typesFrais = useTypesFrais();
  const fraisEtudiant = useFraisEtudiant();
  const paiements = usePaiements();

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(DEFAULT_ANNEE);
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [etudiantId, setEtudiantId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [motif, setMotif] = useState("");

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
      (!classeId || e.classeId === classeId)
    );
  }, [etudiants, filiereId, niveau, annee, classeId]);

  const handleFiliereChange = (id: string) => {
    setFiliereId(id);
    setNiveauId("");
    setClasseId("");
    setEtudiantId("");
    setSelectedTypes([]);
  };
  const handleNiveauChange = (id: string) => {
    setNiveauId(id);
    setClasseId("");
    setEtudiantId("");
    setSelectedTypes([]);
  };
  const handleAnneeChange = (v: string) => {
    setAnnee(v);
    setClasseId("");
    setEtudiantId("");
    setSelectedTypes([]);
  };

  const cibleIds = etudiantId ? [etudiantId] : cohorte.map((e) => e.id);

  const lignesConcernees = useMemo(() => {
    if (cibleIds.length === 0 || !annee) return [];
    return fraisEtudiant.filter((l) => cibleIds.includes(l.etudiantId) && l.annee === annee && statutFraisEtudiant(l, paiements) !== "annule");
  }, [fraisEtudiant, cibleIds, annee, paiements]);

  const typesPresents = useMemo(() => {
    const ids = new Set(lignesConcernees.map((l) => l.typeFraisId));
    return typesFrais.filter((t) => ids.has(t.id));
  }, [lignesConcernees, typesFrais]);

  const toggleType = (id: string) => setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setSelectedTypes((prev) => (prev.length === typesPresents.length ? [] : typesPresents.map((t) => t.id)));

  const handleSupprimer = () => {
    if (selectedTypes.length === 0) {
      toast.error("Sélectionnez au moins un type de frais");
      return;
    }
    if (!motif.trim()) {
      toast.error("Le motif de la suppression est obligatoire");
      return;
    }
    const ligneIds = lignesConcernees
      .filter((l) => selectedTypes.includes(l.typeFraisId))
      .map((l) => l.id);

    if (ligneIds.length === 0) {
      toast.error("Aucun frais actif à traiter pour cette sélection");
      return;
    }

    const { supprimes, annules } = traiterFraisEtudiantMasse(ligneIds, motif.trim());
    toast.success(`${supprimes} frais supprimé(s), ${annules} frais annulé(s) (motif enregistré)`);
    setSelectedTypes([]);
    setMotif("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Mise à jour frais étudiant" }, { label: "Suppression frais" }]}
        title="Suppression frais en masse"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
          <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="masse-suppr-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} className={inputClass} data-testid="masse-suppr-annee">
              {ANNEE_OPTIONS.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} className={inputClass} disabled={!filiereId} data-testid="masse-suppr-niveau">
              <option value="">Sélectionner</option>
              {filteredNiveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
            <select value={classeId} onChange={(e) => { setClasseId(e.target.value); setEtudiantId(""); setSelectedTypes([]); }} className={inputClass} disabled={!niveauId} data-testid="masse-suppr-classe">
              <option value="">Toutes les classes</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
          <select value={etudiantId} onChange={(e) => { setEtudiantId(e.target.value); setSelectedTypes([]); }} className={inputClass} disabled={cohorte.length === 0} data-testid="masse-suppr-etudiant">
            <option value="">Tous les étudiants de cette sélection ({cohorte.length})</option>
            {cohorte.map((e) => <option key={e.id} value={e.id}>{e.matricule} - {e.prenom} {e.nom}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-4 py-3 text-left w-10">
                <input type="checkbox" checked={typesPresents.length > 0 && selectedTypes.length === typesPresents.length} onChange={toggleAll} className="rounded" disabled={typesPresents.length === 0} data-testid="masse-suppr-select-all" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Intitulé</th>
            </tr>
          </thead>
          <tbody>
            {typesPresents.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-10 text-center text-sm text-muted-foreground">
                  Aucun frais trouvé pour cette sélection
                </td>
              </tr>
            ) : (
              typesPresents.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={selectedTypes.includes(t.id)} onChange={() => toggleType(t.id)} className="rounded" data-testid={`masse-suppr-type-${t.id}`} />
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{t.intitule}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <label className="block text-xs font-medium text-red-500 mb-1.5">Veuillez saisir le motif de la suppression *</label>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          className={cn(inputClass, "resize-y")}
          data-testid="masse-suppr-motif"
        />
        <button
          onClick={handleSupprimer}
          className="mt-4 px-6 py-2.5 bg-red-400 text-white rounded-xl text-sm font-medium hover:bg-red-500 transition-colors"
          data-testid="masse-suppr-confirmer"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
