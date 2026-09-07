import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { useGrillesFrais } from "@/hooks/useGrilleFraisStore";
import { getGrilleFrais, getModelesFraisDisponibles } from "@/data/grilleFraisStore";
import {
  addEmissionMasse,
  findActiveEmissionForClasse,
  montantGrilleLignes,
} from "@/data/emissionMasseStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function EmissionMasseFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const classes = useClasses();
  const etudiants = useStudentStore();
  const anneesAcademiques = useAnneesAcademiques();
  const modelesFrais = useModelesFrais();
  useGrillesFrais(); // s'abonne pour recalculer si la grille tarifaire change
  const anneeOptions = useMemo(() => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)), [anneesAcademiques]);
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0]?.libelle ?? "2025-2026";

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(defaultAnnee);
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [modeleFraisId, setModeleFraisId] = useState("");
  const [ligneIds, setLigneIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [dateFacturation, setDateFacturation] = useState(todayPlus(0));
  const [commentaire, setCommentaire] = useState("");

  const filteredNiveaux = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const filteredClasses = useMemo(() => {
    const niveau = NIVEAUX.find((n) => n.id === niveauId);
    if (!filiereId || !niveau) return [];
    return classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau.alias && c.annee === annee);
  }, [classes, filiereId, niveauId, annee]);

  const selectedClasse = filteredClasses.find((c) => c.id === classeId) ?? null;
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  const modelesDisponibles = useMemo(() => {
    if (!filiereId || !niveau) return [];
    const ids = new Set(getModelesFraisDisponibles(filiereId, niveau.alias, annee));
    return modelesFrais.filter((m) => ids.has(m.id));
  }, [filiereId, niveau, annee, modelesFrais]);

  const grille = filiereId && niveau && modeleFraisId ? getGrilleFrais(filiereId, niveau.alias, annee, modeleFraisId) : undefined;
  const grilleTotal = montantGrilleLignes(filiereId, niveau?.alias ?? "", annee, modeleFraisId, ligneIds);
  const classeStudents = selectedClasse
    ? etudiants.filter((e) => e.classeId === selectedClasse.id && e.statut !== "suspendu")
    : [];
  const includedStudents = classeStudents.filter((e) => !excludedIds.includes(e.id));

  const activeExisting = classeId ? findActiveEmissionForClasse(classeId, annee) : undefined;

  useEffect(() => {
    setExcludedIds([]);
  }, [classeId]);

  // Par défaut, toutes les lignes de la grille sont sélectionnées ; l'admin peut en décocher.
  useEffect(() => {
    setLigneIds(grille?.lignes.map((l) => l.id) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grille?.id]);

  const handleFiliereChange = (id: string) => {
    setFiliereId(id);
    setNiveauId("");
    setClasseId("");
    setModeleFraisId("");
  };

  const handleNiveauChange = (id: string) => {
    setNiveauId(id);
    setClasseId("");
    setModeleFraisId("");
  };

  const handleAnneeChange = (v: string) => {
    setAnnee(v);
    setClasseId("");
    setModeleFraisId("");
  };

  const toggleLigne = (id: string) => {
    setLigneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleExclude = (id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    if (!filiereId || !niveauId || !classeId) {
      toast.error("Sélectionnez la filière, le niveau et la classe");
      return;
    }
    if (!modeleFraisId) {
      toast.error("Sélectionnez un modèle de frais");
      return;
    }
    if (ligneIds.length === 0) {
      toast.error("Sélectionnez au moins une ligne de la grille tarifaire à facturer");
      return;
    }
    if (!dateFacturation) {
      toast.error("Indiquez la date de facturation");
      return;
    }
    if (includedStudents.length === 0) {
      toast.error("Aucun étudiant retenu pour cette génération");
      return;
    }

    const filiere = FILIERES.find((f) => f.id === filiereId);

    const record = addEmissionMasse({
      filiereId,
      filiere: filiere?.nom ?? "",
      annee,
      niveauId,
      niveau: niveau?.alias ?? "",
      classeId,
      classe: selectedClasse?.nom ?? "",
      modeleFraisId,
      ligneIds,
      dateFacturation,
      commentaire,
      emisPar: currentUser?.name ?? "Administration",
      etudiantIds: includedStudents.map((e) => e.id),
    });

    toast.success(`Émission ${record.reference} générée pour ${includedStudents.length} étudiant(s)`);
    setLocation(`/admin/emissions-masse/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Émission en masse", href: "/admin/emissions-masse" },
          { label: "Nouvelle émission" },
        ]}
        title="Nouvelle émission en masse"
        subtitle="Génère une quittance pour chaque étudiant retenu de la classe sélectionnée, selon la grille tarifaire en vigueur"
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Filière <span className="text-red-500">*</span>
            </label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="emm-filiere">
              <option value="">Sélectionner…</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Année <span className="text-red-500">*</span>
              </label>
              <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} className={inputClass} data-testid="emm-annee">
                {anneeOptions.map((a) => (
                  <option key={a.id} value={a.libelle}>
                    {a.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                value={niveauId}
                onChange={(e) => handleNiveauChange(e.target.value)}
                className={inputClass}
                disabled={!filiereId}
                data-testid="emm-niveau"
              >
                <option value="">Sélectionner…</option>
                {filteredNiveaux.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Classe <span className="text-red-500">*</span>
          </label>
          <select
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            className={inputClass}
            disabled={!niveauId}
            data-testid="emm-classe"
          >
            <option value="">Sélectionner…</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} ({c.inscrits} inscrits)
              </option>
            ))}
          </select>
          {niveauId && filteredClasses.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">Aucune classe pour ce niveau sur l&apos;année {annee}.</p>
          )}
        </div>

        {activeExisting && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              Une émission active existe déjà pour cette classe sur {annee} : <strong>{activeExisting.reference}</strong> (
              {activeExisting.quittanceIds.length} quittance(s), émise le {activeExisting.emisLe}). Vérifiez avant de continuer pour
              éviter une double facturation.
            </span>
          </div>
        )}

        {selectedClasse && (
          <>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Modèle de frais <span className="text-red-500">*</span>
              </label>
              <select value={modeleFraisId} onChange={(e) => setModeleFraisId(e.target.value)} className={inputClass} data-testid="emm-modele-frais">
                <option value="">Sélectionner…</option>
                {modelesDisponibles.map((m) => (
                  <option key={m.id} value={m.id}>{m.intitule}</option>
                ))}
              </select>
              {modeleFraisId && !grille && (
                <p className="text-xs text-amber-600 mt-1.5">Aucune grille tarifaire configurée pour ce modèle sur cette filière/niveau/année.</p>
              )}
            </div>

            {grille && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Lignes de la grille tarifaire à facturer <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {grille.lignes.map((l) => {
                    const checked = ligneIds.includes(l.id);
                    return (
                      <label
                        key={l.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors text-sm",
                          checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <input type="checkbox" checked={checked} onChange={() => toggleLigne(l.id)} className="rounded" />
                          <span className="font-medium text-foreground">{l.intitule}</span>
                          <span className="text-xs text-muted-foreground">
                            {l.modalite === "echeances" ? `Échéances (${l.echeancesPersonnalisees?.length ?? l.nbEcheances ?? 1})` : "Avant inscription"}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-foreground">{formatCFA(l.montant)}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-border text-sm font-bold">
                  <span>Montant par étudiant</span>
                  <span className="text-primary">{formatCFA(grilleTotal)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Étudiants de la classe ({includedStudents.length}/{classeStudents.length} retenu(s))
              </label>
              <div className="border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border">
                {classeStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Aucun étudiant actif dans cette classe.</p>
                ) : (
                  classeStudents.map((e) => {
                    const excluded = excludedIds.includes(e.id);
                    return (
                      <label key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(e.id)} className="rounded" />
                          <span className={cn(excluded && "text-muted-foreground line-through")}>
                            {e.prenom} {e.nom}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{e.matricule}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Date de facturation <span className="text-red-500">*</span>
          </label>
          <input type="date" value={dateFacturation} onChange={(e) => setDateFacturation(e.target.value)} className={inputClass} />
          <p className="text-[11px] text-muted-foreground mt-1">
            Date de la quittance des lignes « avant inscription ». Les lignes « échéances » sont facturées à leurs propres dates, définies dans la grille tarifaire.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Commentaire</label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Précisions à l'attention des étudiants ou de la comptabilité…"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => setLocation("/admin/emissions-masse")}
            className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="emm-submit"
          >
            <Send size={15} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
