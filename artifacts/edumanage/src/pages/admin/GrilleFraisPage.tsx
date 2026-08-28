import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eye, FileSpreadsheet, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { useGrillesFrais } from "@/hooks/useGrilleFraisStore";
import {
  getGrilleFrais,
  upsertGrilleFrais,
  makeLigneGrilleFraisId,
  type GrilleFraisRecord,
  type LigneGrilleFrais,
  type ModaliteFrais,
} from "@/data/grilleFraisStore";
import { parseGrilleFraisExcel, downloadGrilleFraisTemplate, exportGrillesFraisExcel } from "@/lib/grilleFraisImport";
import { niveauLabel } from "@/lib/teacherCourseUtils";
import { formatCFA, cn } from "@/lib/utils";

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle);
const DEFAULT_ANNEE = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0] ?? "2025-2026";

const inputClass =
  "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function GrilleFraisPage() {
  const modelesFrais = useModelesFrais();
  const grillesFrais = useGrillesFrais();

  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [annee, setAnnee] = useState(DEFAULT_ANNEE);
  const [modeleFraisId, setModeleFraisId] = useState("");

  const [tauxTaxe, setTauxTaxe] = useState("18");
  const [lignes, setLignes] = useState<LigneGrilleFrais[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [duplicateTarget, setDuplicateTarget] = useState<GrilleFraisRecord | null>(null);
  const [duplicateAnnee, setDuplicateAnnee] = useState("");

  const niveauxDisponibles = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);

  const combinaisonComplete = !!filiereId && !!niveau && !!annee && !!modeleFraisId;

  useEffect(() => {
    if (!combinaisonComplete) {
      setLignes([]);
      setTauxTaxe("18");
      return;
    }
    const existing = getGrilleFrais(filiereId, niveau, annee, modeleFraisId);
    setTauxTaxe(existing ? String(existing.tauxTaxe) : "18");
    setLignes(existing ? existing.lignes : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiereId, niveau, annee, modeleFraisId, grillesFrais]);

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

  const handleSave = () => {
    if (!combinaisonComplete) return;
    if (lignes.some((l) => !l.intitule.trim() || l.montant <= 0)) {
      toast.error("Chaque ligne doit avoir un intitulé et un montant supérieur à 0");
      return;
    }
    if (lignes.some((l) => l.modalite === "echeances" && (!l.nbEcheances || l.nbEcheances < 1))) {
      toast.error("Indiquez un nombre d'échéances pour chaque ligne payable en échéances");
      return;
    }
    upsertGrilleFrais({
      filiereId,
      niveau,
      annee,
      modeleFraisId,
      tauxTaxe: Number(tauxTaxe) || 0,
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
    setDuplicateAnnee(ANNEE_OPTIONS.find((a) => a !== g.annee) ?? "");
  };

  const confirmerDuplication = () => {
    if (!duplicateTarget || !duplicateAnnee) return;
    upsertGrilleFrais({
      filiereId: duplicateTarget.filiereId,
      niveau: duplicateTarget.niveau,
      annee: duplicateAnnee,
      modeleFraisId: duplicateTarget.modeleFraisId,
      tauxTaxe: duplicateTarget.tauxTaxe,
      lignes: duplicateTarget.lignes.map((l) => ({ ...l, id: makeLigneGrilleFraisId() })),
    });
    toast.success(`Grille dupliquée vers ${duplicateAnnee}`);
    setDuplicateTarget(null);
    editerGrille({ ...duplicateTarget, annee: duplicateAnnee });
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
          tauxTaxe: r.tauxTaxe,
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
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Grilles configurées</h3>
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
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {grillesFrais.map((g) => {
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
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            {ANNEE_OPTIONS.map((a) => (
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
          <div className="bg-card border border-border rounded-xl p-5 mb-5 flex items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <label className="text-sm font-medium text-foreground whitespace-nowrap">Taux de taxe (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={tauxTaxe}
              onChange={(e) => setTauxTaxe(e.target.value)}
              className={`${inputClass} max-w-[120px]`}
              data-testid="grille-frais-taux-taxe"
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto mb-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-3 w-[30%]">Intitulé</th>
                  <th className="text-right px-3 py-3">Montant HT</th>
                  <th className="text-left px-3 py-3">Modalité</th>
                  <th className="text-center px-3 py-3">Échéances</th>
                  <th className="text-left px-3 py-3">Date limite</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Aucune ligne — cliquez sur « Ajouter une ligne »
                    </td>
                  </tr>
                ) : (
                  lignes.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3">
                        <input
                          value={l.intitule}
                          onChange={(e) => updateLigne(l.id, { intitule: e.target.value })}
                          className={inputClass}
                          placeholder="ex. Frais de scolarité"
                          data-testid={`grille-ligne-intitule-${l.id}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          value={l.montant || ""}
                          onChange={(e) => updateLigne(l.id, { montant: Number(e.target.value) || 0 })}
                          className={`${inputClass} text-right`}
                          data-testid={`grille-ligne-montant-${l.id}`}
                        />
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
                          <input
                            type="number"
                            min={1}
                            value={l.nbEcheances ?? ""}
                            onChange={(e) => updateLigne(l.id, { nbEcheances: Number(e.target.value) || undefined })}
                            className={`${inputClass} text-center`}
                            placeholder="Nb"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {l.modalite === "echeances" && (
                          <input
                            value={l.dateLimite ?? ""}
                            onChange={(e) => updateLigne(l.id, { dateLimite: e.target.value })}
                            className={inputClass}
                            placeholder="JJ/MM"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => removeLigne(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lignes.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-3">Total HT</td>
                    <td className="px-3 py-3 text-right">{formatCFA(lignes.reduce((s, l) => s + l.montant, 0))}</td>
                    <td colSpan={4} />
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
            Fichier Excel (.xlsx) avec les colonnes Filière, Niveau, Année, Modèle de frais, Taux taxe, Intitulé, Montant, Modalité, Échéances, Date limite.
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
              Recopier les {duplicateTarget.lignes.length} ligne(s) de {FILIERES.find((f) => f.id === duplicateTarget.filiereId)?.nom} — {niveauLabel(duplicateTarget.niveau)} — {duplicateTarget.annee} vers une autre année.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année scolaire cible</label>
              <select value={duplicateAnnee} onChange={(e) => setDuplicateAnnee(e.target.value)} className={inputClass} data-testid="grille-frais-dupliquer-annee">
                <option value="">— Sélectionner —</option>
                {ANNEE_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDuplicateTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmerDuplication}
                disabled={!duplicateAnnee}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
                data-testid="grille-frais-dupliquer-confirmer"
              >
                Dupliquer
              </button>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
