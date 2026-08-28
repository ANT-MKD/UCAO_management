import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES, ENSEIGNANTS } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { createEvaluation, findEvaluationsDoublon, getPoidsAutreType, type EvaluationRecord } from "@/data/evaluationStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const POIDS_DEFAUT: Record<EvaluationRecord["type"], number> = { devoir: 30, examen: 70 };

export default function NouvelleEvaluationPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const classes = useClasses();
  const ecs = useEcs();
  const ues = useUes();

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [ecId, setEcId] = useState("");
  const [professeurId, setProfesseurId] = useState("");
  const [professeur, setProfesseur] = useState("");
  const [type, setType] = useState<"" | EvaluationRecord["type"]>("");
  const [poids, setPoids] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);
  const coursChoisi = ecs.find((e) => e.id === ecId);

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  // Pas de useMemo : classes/ecs/ues viennent de stores qui clonent leur tableau à chaque
  // persist(), un calcul en ligne à chaque rendu reste la façon la plus sûre de rester à jour.
  const classesDisponibles = classes.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);
  const coursDisponibles = ecs.filter((ec) => {
    const ue = ues.find((u) => u.id === ec.ueId);
    return !!ue && ue.filiereId === filiereId && ue.niveau === niveau?.alias && ue.semestre === semestre?.alias;
  });

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId("");
    setProfesseurId(""); setProfesseur(""); setType(""); setPoids("");
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId("");
    setProfesseurId(""); setProfesseur(""); setType(""); setPoids("");
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setEcId("");
    setProfesseurId(""); setProfesseur(""); setType(""); setPoids("");
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setEcId("");
    setProfesseurId(""); setProfesseur(""); setType(""); setPoids("");
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setEcId("");
    setProfesseurId(""); setProfesseur(""); setType(""); setPoids("");
  };
  const handleCoursChange = (value: string) => {
    setEcId(value);
    const ec = ecs.find((e) => e.id === value);
    // ec.responsableId n'est renseigné que si un admin l'a défini via ECFormPage ; à défaut,
    // le nom en clair du responsable (issu des mêmes données de seed) permet de retrouver le
    // même enseignant réel dans ENSEIGNANTS plutôt que de laisser le champ vide sans raison.
    const normalize = (s: string) => s.replace(/^(Pr\.|Dr\.|M\.|Me\.)\s*/i, "").trim().toLowerCase();
    const enseignant =
      (ec?.responsableId ? ENSEIGNANTS.find((en) => en.id === ec.responsableId) : undefined) ??
      ENSEIGNANTS.find((en) => normalize(`${en.prenom} ${en.nom}`) === normalize(ec?.responsable ?? ""));
    setProfesseurId(enseignant?.id ?? "");
    setProfesseur(enseignant ? `${enseignant.prenom} ${enseignant.nom}` : "");
    setType(""); setPoids("");
  };
  const handleProfesseurChange = (value: string) => {
    setProfesseurId(value);
    const enseignant = ENSEIGNANTS.find((en) => en.id === value);
    setProfesseur(enseignant ? `${enseignant.prenom} ${enseignant.nom}` : "");
  };
  const handleTypeChange = (value: "" | EvaluationRecord["type"]) => {
    setType(value);
    if (!value) { setPoids(""); return; }
    // Si l'autre type (Devoir/Examen) est déjà posé pour ce cours/classe/session, on propose
    // le complément à 100 plutôt que le poids par défaut fixe, pour partir d'un total cohérent.
    const poidsAutre = classeId && ecId && semestreId ? getPoidsAutreType(classeId, ecId, semestreId, value) : undefined;
    setPoids(poidsAutre !== undefined ? Math.max(1, 100 - poidsAutre) : POIDS_DEFAUT[value]);
  };

  const doublons = classeId && ecId && semestreId && type ? findEvaluationsDoublon(classeId, ecId, semestreId, type) : [];
  const poidsAutreType = classeId && ecId && semestreId && type ? getPoidsAutreType(classeId, ecId, semestreId, type) : undefined;
  const totalPoids = poidsAutreType !== undefined && poids !== "" ? poidsAutreType + Number(poids) : undefined;

  const peutSoumettre =
    !!filiereId && !!annee && !!niveauId && !!classeId && !!semestreId && !!ecId &&
    !!professeur.trim() && !!type && poids !== "" && Number(poids) > 0;

  const handleSave = () => {
    if (!peutSoumettre || !niveau || !semestre || !type) return;
    setSaving(true);
    try {
      createEvaluation({
        filiereId,
        annee,
        niveauId,
        niveau: niveau.alias,
        classeId,
        semestreId,
        semestre: `${semestre.nom} (${semestre.alias})`,
        ecId,
        professeurId: professeurId || undefined,
        professeur: professeur.trim(),
        type,
        poids: Number(poids),
        creePar: currentUser?.name ?? "Administration",
      });
      toast.success(`Évaluation "${type === "devoir" ? "Devoir" : "Examen"}" créée pour ${coursChoisi?.libelle ?? "le cours"}`);
      handleFiliereChange("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Nouvelle évaluation" }]}
        title="Nouvelle évaluation"
        subtitle="Planifier une évaluation (Devoir ou Examen) pour une classe et un cours"
        actions={
          <button onClick={() => setLocation("/admin/notes")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-3xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
          <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="eval-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.inscrits} étudiants)</option>)}
            </select>
            {niveauId && classesDisponibles.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">Aucune classe ouverte pour ce niveau en {annee}.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
            <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-semestre">
              <option value="">Sélectionner</option>
              {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cours *</label>
          <select value={ecId} onChange={(e) => handleCoursChange(e.target.value)} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-cours">
            <option value="">Sélectionner</option>
            {coursDisponibles.map((ec) => <option key={ec.id} value={ec.id}>{ec.code} — {ec.libelle}</option>)}
          </select>
          {semestreId && coursDisponibles.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">Aucun cours programmé pour cette filière, ce niveau et cette session.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Professeur *</label>
            <select value={professeurId} onChange={(e) => handleProfesseurChange(e.target.value)} disabled={!ecId} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-professeur">
              <option value="">Sélectionner</option>
              {ENSEIGNANTS.map((en) => <option key={en.id} value={en.id}>{en.prenom} {en.nom} — {en.specialite}</option>)}
            </select>
            {ecId && !professeurId && (
              <p className="text-[11px] text-muted-foreground mt-1">Aucun enseignant responsable défini pour ce cours — sélectionnez-en un.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type évaluation *</label>
            <select value={type} onChange={(e) => handleTypeChange(e.target.value as "" | EvaluationRecord["type"])} disabled={!professeurId} className={cn(inputClass, "disabled:opacity-50")} data-testid="eval-type">
              <option value="">Sélectionner</option>
              <option value="devoir">Devoir</option>
              <option value="examen">Examen</option>
            </select>
          </div>
        </div>

        {type && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Poids (%) *</label>
            <input
              type="number"
              min={1}
              max={100}
              value={poids}
              onChange={(e) => setPoids(e.target.value === "" ? "" : Number(e.target.value))}
              className={cn(inputClass, "sm:w-40")}
              data-testid="eval-poids"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Modifiable ensuite via Mise à jour poids évaluation.</p>
          </div>
        )}

        {totalPoids !== undefined && totalPoids !== 100 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-700 dark:text-amber-300" data-testid="eval-poids-total-warning">
            Devoir ({type === "devoir" ? poids : poidsAutreType}%) + Examen ({type === "examen" ? poids : poidsAutreType}%) = {totalPoids}%, pas 100%. La moyenne de Saisie des Notes utilisera quand même ces poids tels quels.
          </div>
        )}

        {doublons.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-700 dark:text-amber-300" data-testid="eval-doublon-warning">
            Une évaluation « {type === "devoir" ? "Devoir" : "Examen"} » existe déjà pour ce cours, dans cette classe et cette session
            (créée le {doublons[0].dateCreation}{doublons[0].creePar ? ` par ${doublons[0].creePar}` : ""}). Vous pouvez tout de même en créer une nouvelle.
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={!peutSoumettre || saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="eval-sauvegarder"
          >
            <ClipboardList size={14} /> {saving ? "Enregistrement…" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}
