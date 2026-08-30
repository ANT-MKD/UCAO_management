import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore, useAnneesAcademiques } from "@/hooks/useStudentStore";
import {
  addEmissionMasse,
  findActiveEmissionForClasse,
  montantGrilleParRubrique,
  RUBRIQUE_EMISSION_LABELS,
  type RubriqueEmission,
} from "@/data/emissionMasseStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

const RUBRIQUE_OPTIONS: RubriqueEmission[] = ["inscription", "scolarite", "fraisDivers"];

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
  const anneeOptions = useMemo(() => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)), [anneesAcademiques]);
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0]?.libelle ?? "2025-2026";

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(defaultAnnee);
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [rubriques, setRubriques] = useState<RubriqueEmission[]>(["scolarite"]);
  const [nbMensualites, setNbMensualites] = useState("1");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [dateEcheance, setDateEcheance] = useState(todayPlus(0));
  const [dateLimite, setDateLimite] = useState(todayPlus(30));
  const [commentaire, setCommentaire] = useState("");

  const filteredNiveaux = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const filteredClasses = useMemo(() => {
    const niveau = NIVEAUX.find((n) => n.id === niveauId);
    if (!filiereId || !niveau) return [];
    return classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau.alias && c.annee === annee);
  }, [classes, filiereId, niveauId, annee]);

  const selectedClasse = filteredClasses.find((c) => c.id === classeId) ?? null;
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const grilleTotal = montantGrilleParRubrique(filiereId, niveau?.alias ?? "", annee, rubriques);
  const classeStudents = selectedClasse
    ? etudiants.filter((e) => e.classeId === selectedClasse.id && e.statut !== "suspendu")
    : [];
  const includedStudents = classeStudents.filter((e) => !excludedIds.includes(e.id));
  const nbMens = Math.max(1, Math.round(Number(nbMensualites) || 1));
  const montantParEcheance = nbMens > 1 ? Math.round(grilleTotal / nbMens) : grilleTotal;

  const activeExisting = classeId ? findActiveEmissionForClasse(classeId, annee) : undefined;

  useEffect(() => {
    setExcludedIds([]);
  }, [classeId]);

  const handleFiliereChange = (id: string) => {
    setFiliereId(id);
    setNiveauId("");
    setClasseId("");
  };

  const handleNiveauChange = (id: string) => {
    setNiveauId(id);
    setClasseId("");
  };

  const handleAnneeChange = (v: string) => {
    setAnnee(v);
    setClasseId("");
  };

  const toggleRubrique = (r: RubriqueEmission) => {
    setRubriques((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const toggleExclude = (id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    if (!filiereId || !niveauId || !classeId) {
      toast.error("Sélectionnez la filière, le niveau et la classe");
      return;
    }
    if (rubriques.length === 0) {
      toast.error("Sélectionnez au moins une rubrique à facturer");
      return;
    }
    if (!dateEcheance || !dateLimite) {
      toast.error("Indiquez la date d'échéance et la date limite");
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
      dateEcheance,
      dateLimite,
      commentaire,
      emisPar: currentUser?.name ?? "Administration",
      rubriques,
      nbMensualites: nbMens,
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
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Rubriques à facturer <span className="text-red-500">*</span>
              </label>
              <div className="grid sm:grid-cols-3 gap-2">
                {RUBRIQUE_OPTIONS.map((r) => {
                  const checked = rubriques.includes(r);
                  return (
                    <label
                      key={r}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors text-sm",
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleRubrique(r)} className="rounded" />
                      {RUBRIQUE_EMISSION_LABELS[r]}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Répartition</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={nbMensualites}
                    onChange={(e) => setNbMensualites(e.target.value)}
                    className={cn(inputClass, "max-w-[100px]")}
                  />
                  <span className="text-xs text-muted-foreground">mensualité(s) — 1 = paiement unique</span>
                </div>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-sm flex flex-col justify-center">
                <span className="text-xs text-muted-foreground">Montant par étudiant</span>
                <span className="font-semibold">
                  {formatCFA(grilleTotal)}
                  {nbMens > 1 && (
                    <span className="text-muted-foreground font-normal"> ({nbMens} × {formatCFA(montantParEcheance)})</span>
                  )}
                </span>
              </div>
            </div>

            {rubriques.length > 0 && grilleTotal === 0 && (
              <p className="text-xs text-amber-600">Aucune grille tarifaire configurée pour ce niveau/année — le montant sera de 0 FCFA.</p>
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date échéance <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date limite <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} className={inputClass} />
          </div>
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
