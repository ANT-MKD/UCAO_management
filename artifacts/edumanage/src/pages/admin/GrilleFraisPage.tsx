import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Copy, Download, Eye, FileSpreadsheet, Plus, Save, Trash2, Upload, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useModelesFrais, useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { useGrillesFrais } from "@/hooks/useGrilleFraisStore";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import {
  getGrilleFrais,
  upsertGrilleFrais,
  supprimerGrilleFrais,
  makeLigneGrilleFraisId,
  calculerEcheances,
  nbEcheancesEffectif,
  type GrilleFraisRecord,
  type LigneGrilleFrais,
  type EcheancePersonnalisee,
  type ModaliteFrais,
} from "@/data/grilleFraisStore";
import { parseGrilleFraisExcel, downloadGrilleFraisTemplate, exportGrillesFraisExcel } from "@/lib/grilleFraisImport";
import { niveauLabel } from "@/lib/teacherCourseUtils";
import { formatCFA, cn } from "@/lib/utils";

const inputClass =
  "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface OverviewFilters {
  filiereId: string;
  niveau: string;
  annee: string;
  modeleFraisId: string;
}

const EMPTY_FILTERS: OverviewFilters = { filiereId: "", niveau: "", annee: "", modeleFraisId: "" };

export default function GrilleFraisPage() {
  const modelesFrais = useModelesFrais();
  const typesFrais = useTypesFrais();
  const grillesFrais = useGrillesFrais();
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0] ?? "2025-2026";

  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [annee, setAnnee] = useState(defaultAnnee);
  const [modeleFraisId, setModeleFraisId] = useState("");

  const [lignes, setLignes] = useState<LigneGrilleFrais[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [duplicateTarget, setDuplicateTarget] = useState<GrilleFraisRecord | null>(null);
  const [dupFiliereId, setDupFiliereId] = useState("");
  const [dupNiveau, setDupNiveau] = useState("");
  const [dupAnnee, setDupAnnee] = useState("");
  const [dupModeleFraisId, setDupModeleFraisId] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<GrilleFraisRecord | null>(null);

  const [overviewFilters, setOverviewFilters] = useState<OverviewFilters>(EMPTY_FILTERS);

  const niveauxDisponibles = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const dupNiveauxDisponibles = useMemo(() => NIVEAUX.filter((n) => n.filiereId === dupFiliereId), [dupFiliereId]);

  const combinaisonComplete = !!filiereId && !!niveau && !!annee && !!modeleFraisId;

  useEffect(() => {
    if (!combinaisonComplete) {
      setLignes([]);
      return;
    }
    const existing = getGrilleFrais(filiereId, niveau, annee, modeleFraisId);
    setLignes(existing ? existing.lignes : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiereId, niveau, annee, modeleFraisId, grillesFrais]);

  const filteredGrilles = useMemo(() => {
    return grillesFrais.filter((g) => {
      if (overviewFilters.filiereId && g.filiereId !== overviewFilters.filiereId) return false;
      if (overviewFilters.niveau && g.niveau !== overviewFilters.niveau) return false;
      if (overviewFilters.annee && g.annee !== overviewFilters.annee) return false;
      if (overviewFilters.modeleFraisId && g.modeleFraisId !== overviewFilters.modeleFraisId) return false;
      return true;
    });
  }, [grillesFrais, overviewFilters]);

  const patchOverviewFilter = (patch: Partial<OverviewFilters>) => setOverviewFilters((f) => ({ ...f, ...patch }));

  const addLigne = () => {
    setLignes((prev) => [
      ...prev,
      { id: makeLigneGrilleFraisId(), intitule: "", montant: 0, modalite: "avant_inscription" as ModaliteFrais },
    ]);
  };

  const updateLigne = (id: string, patch: Partial<LigneGrilleFrais>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLigne = (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  };

  /** Active/désactive le mode échéances personnalisées d'une ligne. À l'activation, on part du
   * partage automatique actuel (nbEcheances/dateLimite) comme point de départ à ajuster. */
  const togglePersonnaliserEcheances = (l: LigneGrilleFrais) => {
    if (l.echeancesPersonnalisees && l.echeancesPersonnalisees.length > 0) {
      updateLigne(l.id, { echeancesPersonnalisees: undefined });
      return;
    }
    const depart = calculerEcheances(l, annee).map((e) => ({ date: e.date, montant: e.montant }));
    updateLigne(l.id, { echeancesPersonnalisees: depart });
  };

  const updateEcheancePerso = (ligneId: string, idx: number, patch: Partial<EcheancePersonnalisee>) => {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== ligneId || !l.echeancesPersonnalisees) return l;
        const echeances = l.echeancesPersonnalisees.map((e, i) => (i === idx ? { ...e, ...patch } : e));
        const montant = echeances.reduce((s, e) => s + (Number(e.montant) || 0), 0);
        return { ...l, echeancesPersonnalisees: echeances, montant };
      }),
    );
  };

  const addEcheancePerso = (ligneId: string) => {
    setLignes((prev) =>
      prev.map((l) => (l.id === ligneId ? { ...l, echeancesPersonnalisees: [...(l.echeancesPersonnalisees ?? []), { date: "", montant: 0 }] } : l)),
    );
  };

  const removeEcheancePerso = (ligneId: string, idx: number) => {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== ligneId || !l.echeancesPersonnalisees) return l;
        const echeances = l.echeancesPersonnalisees.filter((_, i) => i !== idx);
        const montant = echeances.reduce((s, e) => s + (Number(e.montant) || 0), 0);
        return { ...l, echeancesPersonnalisees: echeances, montant };
      }),
    );
  };

  const handleSave = () => {
    if (!combinaisonComplete) return;
    if (lignes.some((l) => !l.intitule.trim() || l.montant <= 0)) {
      toast.error("Chaque ligne doit avoir un intitulé et un montant supérieur à 0");
      return;
    }
    if (lignes.some((l) => l.modalite === "echeances" && !(l.echeancesPersonnalisees && l.echeancesPersonnalisees.length > 0) && (!l.nbEcheances || l.nbEcheances < 1))) {
      toast.error("Indiquez un nombre d'échéances (ou personnalisez-les) pour chaque ligne payable en échéances");
      return;
    }
    if (lignes.some((l) => l.echeancesPersonnalisees && l.echeancesPersonnalisees.some((e) => !e.date || e.montant <= 0))) {
      toast.error("Chaque échéance personnalisée doit avoir une date et un montant supérieur à 0");
      return;
    }
    upsertGrilleFrais({
      filiereId,
      niveau,
      annee,
      modeleFraisId,
      lignes,
    });
    toast.success("Grille tarifaire enregistrée");
  };

  const editerGrille = (g: GrilleFraisRecord) => {
    setFiliereId(g.filiereId);
    setNiveau(g.niveau);
    setAnnee(g.annee);
    setModeleFraisId(g.modeleFraisId);
  };

  const ouvrirDuplication = (g: GrilleFraisRecord) => {
    setDuplicateTarget(g);
    setDupFiliereId(g.filiereId);
    setDupNiveau(g.niveau);
    setDupAnnee(anneeOptions.find((a) => a !== g.annee) ?? g.annee);
    setDupModeleFraisId(g.modeleFraisId);
  };

  const confirmerDuplication = () => {
    if (!duplicateTarget || !dupFiliereId || !dupNiveau || !dupAnnee || !dupModeleFraisId) return;
    upsertGrilleFrais({
      filiereId: dupFiliereId,
      niveau: dupNiveau,
      annee: dupAnnee,
      modeleFraisId: dupModeleFraisId,
      lignes: duplicateTarget.lignes.map((l) => ({ ...l, id: makeLigneGrilleFraisId() })),
    });
    toast.success("Grille dupliquée");
    setDuplicateTarget(null);
    editerGrille({ ...duplicateTarget, filiereId: dupFiliereId, niveau: dupNiveau, annee: dupAnnee, modeleFraisId: dupModeleFraisId });
  };

  const confirmerSuppression = () => {
    if (!deleteTarget) return;
    supprimerGrilleFrais(deleteTarget.id);
    toast.success("Grille tarifaire supprimée");
    if (
      deleteTarget.filiereId === filiereId &&
      deleteTarget.niveau === niveau &&
      deleteTarget.annee === annee &&
      deleteTarget.modeleFraisId === modeleFraisId
    ) {
      setFiliereId("");
      setNiveau("");
      setModeleFraisId("");
    }
    setDeleteTarget(null);
  };

  const handleFile = async (file: File) => {
    setImportLoading(true);
    setImportMessage("");
    try {
      const records = await parseGrilleFraisExcel(file, modelesFrais);
      if (records.length === 0) {
        setImportMessage("Aucune ligne valide trouvée dans le fichier (vérifiez les codes filière/niveau/modèle de frais).");
        return;
      }
      for (const r of records) {
        upsertGrilleFrais({
          filiereId: r.filiereId,
          niveau: r.niveau,
          annee: r.annee,
          modeleFraisId: r.modeleFraisId,
          lignes: r.lignes,
        });
      }
      setImportMessage(`Import réussi : ${records.length} grille(s) remplacée(s)/créée(s).`);
    } catch (err) {
      console.error(err);
      setImportMessage("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const overviewFiltersActive = Object.values(overviewFilters).some(Boolean);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Devis" }, { label: "Grille tarifaire" }]}
        title="Grille tarifaire"
        subtitle="Configure les frais applicables par filière, niveau, année et modèle de frais — utilisée pour générer les devis"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="grille-frais-importer"
            >
              <FileSpreadsheet size={14} /> Importer
            </button>
            <button
              onClick={() => exportGrillesFraisExcel(grillesFrais, modelesFrais)}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="grille-frais-exporter"
            >
              <Download size={14} /> Exporter tout
            </button>
          </div>
        }
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Grilles configurées</h3>
          {overviewFiltersActive && (
            <button onClick={() => setOverviewFilters(EMPTY_FILTERS)} className="text-[11px] text-muted-foreground hover:text-foreground underline">
              Réinitialiser les filtres
            </button>
          )}
        </div>
        {grillesFrais.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucune grille configurée pour l&apos;instant.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Filière</th>
                <th className="text-left px-3 py-3">Niveau</th>
                <th className="text-left px-3 py-3">Année</th>
                <th className="text-left px-3 py-3">Modèle de frais</th>
                <th className="text-center px-3 py-3">Lignes</th>
                <th className="text-right px-3 py-3">Total HT</th>
                <th className="px-3 py-3 w-24" />
              </tr>
              <tr className="border-b border-border bg-card">
                <th className="px-3 py-2">
                  <select value={overviewFilters.filiereId} onChange={(e) => patchOverviewFilter({ filiereId: e.target.value })} className={filterInputClass}>
                    <option value="">Toutes</option>
                    {FILIERES.map((f) => (
                      <option key={f.id} value={f.id}>{f.code}</option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2">
                  <select value={overviewFilters.niveau} onChange={(e) => patchOverviewFilter({ niveau: e.target.value })} className={filterInputClass}>
                    <option value="">Tous</option>
                    {[...new Set(grillesFrais.map((g) => g.niveau))].map((n) => (
                      <option key={n} value={n}>{niveauLabel(n)}</option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2">
                  <select value={overviewFilters.annee} onChange={(e) => patchOverviewFilter({ annee: e.target.value })} className={filterInputClass}>
                    <option value="">Toutes</option>
                    {anneeOptions.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2">
                  <select value={overviewFilters.modeleFraisId} onChange={(e) => patchOverviewFilter({ modeleFraisId: e.target.value })} className={filterInputClass}>
                    <option value="">Tous</option>
                    {modelesFrais.map((m) => (
                      <option key={m.id} value={m.id}>{m.intitule}</option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2" colSpan={3} />
              </tr>
            </thead>
            <tbody>
              {filteredGrilles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Aucune grille ne correspond aux critères sélectionnés.</td>
                </tr>
              ) : (
                filteredGrilles.map((g) => {
                  const filiere = FILIERES.find((f) => f.id === g.filiereId);
                  const modele = modelesFrais.find((m) => m.id === g.modeleFraisId);
                  const active = g.filiereId === filiereId && g.niveau === niveau && g.annee === annee && g.modeleFraisId === modeleFraisId;
                  return (
                    <tr key={g.id} className={cn("border-b border-border last:border-0 cursor-pointer hover:bg-muted/30", active && "bg-primary/5")} onClick={() => editerGrille(g)} data-testid={`grille-frais-row-${g.id}`}>
                      <td className="px-4 py-3">{filiere?.nom ?? g.filiereId}</td>
                      <td className="px-3 py-3">{niveauLabel(g.niveau)}</td>
                      <td className="px-3 py-3">{g.annee}</td>
                      <td className="px-3 py-3">{modele?.intitule ?? g.modeleFraisId}</td>
                      <td className="px-3 py-3 text-center">{g.lignes.length}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatCFA(g.lignes.reduce((s, l) => s + l.montant, 0))}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); editerGrille(g); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Éditer" data-testid={`grille-frais-editer-${g.id}`}>
                            <Eye size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); ouvrirDuplication(g); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Dupliquer" data-testid={`grille-frais-dupliquer-${g.id}`}>
                            <Copy size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer" data-testid={`grille-frais-supprimer-${g.id}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Filière <span className="text-red-500">*</span>
          </label>
          <select
            value={filiereId}
            onChange={(e) => { setFiliereId(e.target.value); setNiveau(""); }}
            className={inputClass}
            data-testid="grille-frais-filiere"
          >
            <option value="">— Sélectionner —</option>
            {FILIERES.map((f) => (
              <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Niveau <span className="text-red-500">*</span>
          </label>
          <select
            value={niveau}
            onChange={(e) => setNiveau(e.target.value)}
            className={inputClass}
            disabled={!filiereId}
            data-testid="grille-frais-niveau"
          >
            <option value="">— Sélectionner —</option>
            {niveauxDisponibles.map((n) => (
              <option key={n.id} value={n.alias}>{n.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Année scolaire <span className="text-red-500">*</span>
          </label>
          <select value={annee} onChange={(e) => setAnnee(e.target.value)} className={inputClass} data-testid="grille-frais-annee">
            {anneeOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Modèle de frais <span className="text-red-500">*</span>
          </label>
          <select
            value={modeleFraisId}
            onChange={(e) => setModeleFraisId(e.target.value)}
            className={inputClass}
            data-testid="grille-frais-modele"
          >
            <option value="">— Sélectionner —</option>
            {modelesFrais.map((m) => (
              <option key={m.id} value={m.id}>{m.intitule}</option>
            ))}
          </select>
        </div>
      </div>

      {!combinaisonComplete ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Sélectionnez une filière, un niveau, une année et un modèle de frais pour configurer sa grille tarifaire
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-x-auto mb-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-3 w-[30%]">Intitulé</th>
                  <th className="text-right px-3 py-3">Montant HT</th>
                  <th className="text-left px-3 py-3">Modalité</th>
                  <th className="text-center px-3 py-3">Échéances</th>
                  <th className="text-left px-3 py-3">Date début</th>
                  <th className="text-left px-3 py-3">Date fin</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Aucune ligne — cliquez sur « Ajouter une ligne »
                    </td>
                  </tr>
                ) : (
                  lignes.map((l) => {
                    const personnalisee = !!l.echeancesPersonnalisees && l.echeancesPersonnalisees.length > 0;
                    const arrondiInexact = l.modalite === "echeances" && !personnalisee && !!l.nbEcheances && l.montant % l.nbEcheances !== 0;
                    return (
                      <Fragment key={l.id}>
                      <tr className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-3">
                          <select
                            value={l.typeFraisId ?? ""}
                            onChange={(e) => {
                              const t = typesFrais.find((tf) => tf.id === e.target.value);
                              updateLigne(l.id, { typeFraisId: e.target.value || undefined, intitule: t ? t.intitule : l.intitule });
                            }}
                            className={inputClass}
                            data-testid={`grille-ligne-type-${l.id}`}
                          >
                            <option value="">{l.intitule ? `${l.intitule} (à relier)` : "— Sélectionner un type de frais —"}</option>
                            {typesFrais.map((t) => (
                              <option key={t.id} value={t.id}>{t.intitule}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min={0}
                            value={l.montant || ""}
                            onChange={(e) => updateLigne(l.id, { montant: Number(e.target.value) || 0 })}
                            className={`${inputClass} text-right`}
                            readOnly={personnalisee}
                            disabled={personnalisee}
                            data-testid={`grille-ligne-montant-${l.id}`}
                          />
                          {personnalisee && (
                            <p className="text-[10px] text-muted-foreground mt-1 text-right">= somme des échéances</p>
                          )}
                          {arrondiInexact && (
                            <p className="text-[10px] text-amber-600 mt-1 text-right">
                              ⚠ ne se divise pas exactement par {l.nbEcheances} (reste {l.montant % (l.nbEcheances ?? 1)} F)
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={l.modalite}
                            onChange={(e) => updateLigne(l.id, { modalite: e.target.value as ModaliteFrais })}
                            className={inputClass}
                          >
                            <option value="avant_inscription">Avant inscription</option>
                            <option value="echeances">Échéances</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {l.modalite === "echeances" && (
                            personnalisee ? (
                              <span className="text-xs text-muted-foreground">{l.echeancesPersonnalisees!.length} perso.</span>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                value={l.nbEcheances ?? ""}
                                onChange={(e) => updateLigne(l.id, { nbEcheances: Number(e.target.value) || undefined })}
                                className={`${inputClass} text-center`}
                                placeholder="Nb"
                                data-testid={`grille-ligne-echeances-${l.id}`}
                              />
                            )
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {l.modalite === "echeances" && (
                            personnalisee ? (
                              <span className="text-xs text-muted-foreground">Dates perso.</span>
                            ) : (
                              <input
                                value={l.dateDebut ?? ""}
                                onChange={(e) => updateLigne(l.id, { dateDebut: e.target.value })}
                                className={inputClass}
                                placeholder="JJ/MM"
                                title="Optionnel — sans date début, les échéances tombent chaque mois avant la date fin"
                                data-testid={`grille-ligne-date-debut-${l.id}`}
                              />
                            )
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {l.modalite === "echeances" && (
                            personnalisee ? (
                              <span className="text-xs text-muted-foreground">Dates perso.</span>
                            ) : (
                              <input
                                value={l.dateLimite ?? ""}
                                onChange={(e) => updateLigne(l.id, { dateLimite: e.target.value })}
                                className={inputClass}
                                placeholder="JJ/MM"
                                data-testid={`grille-ligne-date-fin-${l.id}`}
                              />
                            )
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {l.modalite === "echeances" && (
                              <button
                                type="button"
                                onClick={() => togglePersonnaliserEcheances(l)}
                                className={cn("p-1.5 rounded-lg hover:bg-muted transition-colors", personnalisee ? "text-primary" : "text-muted-foreground hover:text-primary")}
                                aria-label="Personnaliser les échéances"
                                title="Personnaliser chaque échéance (date et montant)"
                                data-testid={`grille-ligne-perso-${l.id}`}
                              >
                                <CalendarClock size={14} />
                              </button>
                            )}
                            <button type="button" onClick={() => removeLigne(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {personnalisee && (
                        <tr className="border-b border-border last:border-0 bg-muted/20">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Échéances personnalisées — {l.intitule || "cette ligne"}
                              </p>
                              {l.echeancesPersonnalisees!.map((e, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={e.date}
                                    onChange={(ev) => updateEcheancePerso(l.id, idx, { date: ev.target.value })}
                                    className={`${inputClass} max-w-[170px]`}
                                    data-testid={`grille-ligne-eperso-date-${l.id}-${idx}`}
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={e.montant || ""}
                                    onChange={(ev) => updateEcheancePerso(l.id, idx, { montant: Number(ev.target.value) || 0 })}
                                    className={`${inputClass} max-w-[160px] text-right`}
                                    placeholder="Montant"
                                    data-testid={`grille-ligne-eperso-montant-${l.id}-${idx}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeEcheancePerso(l.id, idx)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                                    aria-label="Supprimer cette échéance"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addEcheancePerso(l.id)}
                                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                data-testid={`grille-ligne-eperso-ajouter-${l.id}`}
                              >
                                <Plus size={13} /> Ajouter une échéance
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
              {lignes.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-3">Total HT</td>
                    <td className="px-3 py-3 text-right">{formatCFA(lignes.reduce((s, l) => s + l.montant, 0))}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addLigne}
              className={cn("flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors")}
              data-testid="grille-frais-ajouter-ligne"
            >
              <Plus size={15} /> Ajouter une ligne
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="grille-frais-enregistrer"
            >
              <Save size={15} /> Enregistrer
            </button>
          </div>
        </>
      )}

      <FormModal open={importOpen} onClose={() => setImportOpen(false)} title="Importer une grille tarifaire" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fichier Excel (.xlsx) avec les colonnes Filière, Niveau, Année, Modèle de frais, Intitulé, Montant, Modalité, Échéances, Date début, Date limite.
            Le fichier remplace intégralement les grilles pour les combinaisons qu&apos;il contient.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadGrilleFraisTemplate} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted">
              <Download size={14} /> Télécharger le modèle
            </button>
            <button
              type="button"
              disabled={importLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-60"
            >
              <Upload size={14} /> {importLoading ? "Import..." : "Choisir un fichier"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
          {importMessage && <p className="text-xs text-muted-foreground">{importMessage}</p>}
        </div>
      </FormModal>

      <FormModal open={!!duplicateTarget} onClose={() => setDuplicateTarget(null)} title="Dupliquer la grille tarifaire" size="sm">
        {duplicateTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Recopier les {duplicateTarget.lignes.length} ligne(s) de {FILIERES.find((f) => f.id === duplicateTarget.filiereId)?.nom} — {niveauLabel(duplicateTarget.niveau)} — {duplicateTarget.annee} — {modelesFrais.find((m) => m.id === duplicateTarget.modeleFraisId)?.intitule} vers une nouvelle combinaison.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
                <select value={dupFiliereId} onChange={(e) => { setDupFiliereId(e.target.value); setDupNiveau(""); }} className={inputClass} data-testid="grille-frais-dupliquer-filiere">
                  {FILIERES.map((f) => (
                    <option key={f.id} value={f.id}>{f.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau</label>
                <select value={dupNiveau} onChange={(e) => setDupNiveau(e.target.value)} className={inputClass} data-testid="grille-frais-dupliquer-niveau">
                  {dupNiveauxDisponibles.map((n) => (
                    <option key={n.id} value={n.alias}>{n.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année scolaire</label>
                <select value={dupAnnee} onChange={(e) => setDupAnnee(e.target.value)} className={inputClass} data-testid="grille-frais-dupliquer-annee">
                  {anneeOptions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Modèle de frais</label>
                <select value={dupModeleFraisId} onChange={(e) => setDupModeleFraisId(e.target.value)} className={inputClass} data-testid="grille-frais-dupliquer-modele">
                  {modelesFrais.map((m) => (
                    <option key={m.id} value={m.id}>{m.intitule}</option>
                  ))}
                </select>
              </div>
            </div>
            {dupFiliereId === duplicateTarget.filiereId && dupNiveau === duplicateTarget.niveau && dupAnnee === duplicateTarget.annee && dupModeleFraisId === duplicateTarget.modeleFraisId && (
              <p className="text-xs text-amber-600">Cette combinaison est identique à la grille source — elle sera simplement réenregistrée telle quelle.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDuplicateTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmerDuplication}
                disabled={!dupFiliereId || !dupNiveau || !dupAnnee || !dupModeleFraisId}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
                data-testid="grille-frais-dupliquer-confirmer"
              >
                Dupliquer
              </button>
            </div>
          </div>
        )}
      </FormModal>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Supprimer cette grille tarifaire ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {FILIERES.find((f) => f.id === deleteTarget.filiereId)?.nom} — {niveauLabel(deleteTarget.niveau)} — {deleteTarget.annee} — {modelesFrais.find((m) => m.id === deleteTarget.modeleFraisId)?.intitule} ({deleteTarget.lignes.length} ligne(s)). Les devis déjà générés à partir de cette grille ne sont pas affectés. Action irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={confirmerSuppression} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700" data-testid="grille-frais-supprimer-confirmer">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
