import { useState, useCallback } from "react";
import { Save, Upload, CheckCircle, AlertCircle, TrendingUp, Users, Info } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { saveNotesGrid, submitNotesForValidation, validateNotesByAdmin, publishNotesForClasseEc, type GridNoteInput } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { updateEvaluation, type EvaluationRecord } from "@/data/evaluationStore";
import { usePortefeuilleCours } from "@/hooks/usePortefeuilleCoursStore";
import { getEtudiantsAjoutesPourCours, getEtudiantsRetiresPourCours } from "@/data/portefeuilleCoursStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NoteEntry = {
  note: string;
  absent: boolean;
};

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function NotesPage() {
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const notes = useNotes();
  const ECS = useEcs();
  const UES = useUes();
  const CLASSES = useClasses();
  const scolariteConfigs = useScolariteConfigs();
  const evaluations = useEvaluations();
  usePortefeuilleCours(); // souscription pour re-rendre quand une exception cours étudiant change

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [ecId, setEcId] = useState("");
  const [professeurId, setProfesseurId] = useState("");
  const [evaluationId, setEvaluationId] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [entries, setEntries] = useState<Record<string, NoteEntry>>({});
  const [saved, setSaved] = useState(false);

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);
  const evaluationChoisie = evaluations.find((e) => e.id === evaluationId);
  const bareme = scolariteConfigs.find((c) => c.filiereId === filiereId)?.noteBareme ?? 20;

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = CLASSES.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);
  const coursDisponibles = ECS.filter((ec) => {
    const ue = UES.find((u) => u.id === ec.ueId);
    return !!ue && ue.filiereId === filiereId && ue.niveau === niveau?.alias && ue.semestre === semestre?.alias;
  });

  // Les évaluations réellement planifiées (Nouvelle évaluation) pour ce cours/classe/session
  // remplacent l'ancien "Mode de saisie" libre (CC/EF/Projet/Rattrapage, sans lien avec la réalité).
  // Les sessions de rattrapage ont leur propre page dédiée, exclues d'ici pour ne pas les mélanger.
  const evaluationsPourCours = evaluations.filter(
    (e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.session === undefined,
  );
  const professeurOptions = Array.from(
    new Map(evaluationsPourCours.filter((e) => e.professeurId).map((e) => [e.professeurId!, { id: e.professeurId!, label: e.professeur }])).values(),
  );
  const evaluationsDuProf = evaluationsPourCours
    .filter((e) => e.professeurId === professeurId)
    .sort((a, b) => a.type.localeCompare(b.type) || a.dateCreation.localeCompare(b.dateCreation));

  // Le roster d'un (classe, EC) n'est plus juste "tous les membres de la classe" : un étudiant
  // retiré de ce cours (Mise à jour cours étudiants — déjà validé par équivalence, etc.) en
  // sort, et un étudiant ajouté à ce cours (ex. redoublant reprenant un seul EC d'un niveau
  // déjà quitté) y entre même s'il n'est plus membre de cette classe.
  const etudiantsRetiresIds = classeId && ecId ? new Set(getEtudiantsRetiresPourCours(classeId, ecId)) : new Set<string>();
  const etudiantsAjoutesIds = classeId && ecId ? new Set(getEtudiantsAjoutesPourCours(classeId, ecId)) : new Set<string>();
  const classeStudents = etudiants.filter((e) => {
    if (e.statut === "abandon") return false;
    const estMembre = e.classeId === classeId;
    const estAjoute = etudiantsAjoutesIds.has(e.id);
    if (!((estMembre && !etudiantsRetiresIds.has(e.id)) || estAjoute)) return false;
    if (searchStudent) {
      const q = searchStudent.toLowerCase();
      if (!`${e.prenom} ${e.nom}`.toLowerCase().includes(q) && !e.matricule.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const noteType: "CC" | "EF" | undefined = evaluationChoisie ? (evaluationChoisie.type === "devoir" ? "CC" : "EF") : undefined;
  const canShowTable = !!evaluationId;

  const getEntry = (id: string): NoteEntry => entries[id] ?? { note: "", absent: false };

  const updateEntry = useCallback((id: string, patch: Partial<NoteEntry>) => {
    setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { note: "", absent: false }), ...patch } }));
  }, []);

  const toggleAbsent = (id: string) => {
    const e = getEntry(id);
    updateEntry(id, { absent: !e.absent });
  };

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId("");
    setProfesseurId(""); setEvaluationId(""); setEntries({});
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId("");
    setProfesseurId(""); setEvaluationId(""); setEntries({});
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setEcId("");
    setProfesseurId(""); setEvaluationId(""); setEntries({});
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setEcId("");
    setProfesseurId(""); setEvaluationId(""); setEntries({});
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setEcId("");
    setProfesseurId(""); setEvaluationId(""); setEntries({});
  };
  const prefillFromEvaluation = (ev: EvaluationRecord | undefined) => {
    if (!ev) { setEntries({}); return; }
    const type = ev.type === "devoir" ? "CC" : "EF";
    const existing = notes.filter((n) => n.classeId === ev.classeId && n.ecId === ev.ecId && n.type === type && n.session === ev.session);
    const prefill: Record<string, NoteEntry> = {};
    for (const n of existing) prefill[n.etudiantId] = { note: String(n.note), absent: false };
    setEntries(prefill);
  };
  const handleCoursChange = (value: string) => {
    setEcId(value);
    const matches = evaluations.filter((e) => e.classeId === classeId && e.ecId === value && e.semestreId === semestreId && e.professeurId);
    const profsUniques = Array.from(new Set(matches.map((e) => e.professeurId)));
    const profAuto = profsUniques.length === 1 ? profsUniques[0]! : "";
    setProfesseurId(profAuto);
    if (profAuto) {
      const matchesPourProf = matches.filter((e) => e.professeurId === profAuto);
      const evAuto = matchesPourProf.length === 1 ? matchesPourProf[0] : undefined;
      setEvaluationId(evAuto?.id ?? "");
      prefillFromEvaluation(evAuto);
    } else {
      setEvaluationId(""); setEntries({});
    }
  };
  const handleProfesseurChange = (value: string) => {
    setProfesseurId(value);
    const matches = evaluations.filter((e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.professeurId === value);
    const evAuto = matches.length === 1 ? matches[0] : undefined;
    setEvaluationId(evAuto?.id ?? "");
    prefillFromEvaluation(evAuto);
  };
  const handleEvaluationChange = (value: string) => {
    setEvaluationId(value);
    prefillFromEvaluation(evaluations.find((e) => e.id === value));
  };

  const handleUpdateDetails = (patch: { dateCreation?: string; description?: string }) => {
    if (!evaluationChoisie) return;
    updateEvaluation(evaluationChoisie.id, {
      semestreId: evaluationChoisie.semestreId,
      semestre: evaluationChoisie.semestre,
      ecId: evaluationChoisie.ecId,
      type: evaluationChoisie.type,
      poids: evaluationChoisie.poids,
      modifiePar: currentUser?.name ?? "Administration",
      ...patch,
    });
  };

  // Stats calculation
  const validNotes = classeStudents.flatMap((s) => {
    const e = getEntry(s.id);
    if (e.absent) return [];
    const val = parseFloat(e.note);
    return !isNaN(val) ? [val] : [];
  });

  const nbAbsents = classeStudents.filter((s) => getEntry(s.id).absent).length;
  const nbSaisis = validNotes.length;
  const moyenne = nbSaisis > 0 ? validNotes.reduce((a, b) => a + b, 0) / nbSaisis : null;
  const noteMax = nbSaisis > 0 ? Math.max(...validNotes) : null;
  const noteMin = nbSaisis > 0 ? Math.min(...validNotes) : null;
  const nbAdmis = validNotes.filter((n) => n >= 10).length;
  const tauxReussite = nbSaisis > 0 ? Math.round((nbAdmis / nbSaisis) * 100) : null;

  const buildInputs = (): GridNoteInput[] =>
    classeStudents.map((s) => {
      const e = getEntry(s.id);
      const val = e.note ? parseFloat(e.note) : undefined;
      return {
        etudiantId: s.id,
        cc: evaluationChoisie?.type === "devoir" ? val : undefined,
        examen: evaluationChoisie?.type === "examen" ? val : undefined,
        absent: e.absent,
      };
    });

  const handleSave = (publish: boolean) => {
    if (!classeId || !ecId || !evaluationChoisie) return;
    const ecLabel = ECS.find((e) => e.id === ecId)?.libelle ?? "";
    try {
      saveNotesGrid(classeId, ecId, ecLabel, buildInputs(), publish);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
    }
  };

  const handleSubmitValidation = () => {
    if (!classeId || !ecId) return;
    try {
      submitNotesForValidation(classeId, ecId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Soumission impossible");
    }
  };

  const handleAdminValidate = () => {
    if (!classeId || !ecId || !currentUser) return;
    try {
      validateNotesByAdmin(classeId, ecId, currentUser.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation impossible");
    }
  };

  const handlePublish = () => {
    if (!classeId || !ecId) return;
    try {
      publishNotesForClasseEc(classeId, ecId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publication impossible");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Saisie des Notes" }]}
        title="Saisie des Notes"
        subtitle="Saisissez les notes d'une évaluation réellement planifiée — gestion des absences intégrée"
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-semibold text-foreground text-sm">Évaluation</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="saisie-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
              <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-annee">
                <option value="">Sélectionner</option>
                {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
              <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-niveau">
                <option value="">Sélectionner</option>
                {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
              <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-classe">
                <option value="">Sélectionner</option>
                {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
              <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-semestre">
                <option value="">Sélectionner</option>
                {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cours *</label>
            <select value={ecId} onChange={(e) => handleCoursChange(e.target.value)} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-cours">
              <option value="">Sélectionner</option>
              {coursDisponibles.map((ec) => <option key={ec.id} value={ec.id}>{ec.code} — {ec.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Professeur *</label>
            <select value={professeurId} onChange={(e) => handleProfesseurChange(e.target.value)} disabled={!ecId} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-professeur">
              <option value="">Sélectionner</option>
              {professeurOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {ecId && professeurOptions.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1"><Info size={11} /> Aucune évaluation planifiée pour ce cours et cette session.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Évaluation *</label>
            <select value={evaluationId} onChange={(e) => handleEvaluationChange(e.target.value)} disabled={!professeurId} className={cn(inputClass, "disabled:opacity-50")} data-testid="saisie-evaluation">
              <option value="">Sélectionner</option>
              {evaluationsDuProf.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.type === "devoir" ? "Devoir" : "Examen"} du {new Date(ev.dateCreation).toLocaleDateString("fr-FR")}
                </option>
              ))}
            </select>
            {professeurId && evaluationsDuProf.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                Aucune évaluation pour ce professeur — <a href="/admin/evaluation/nouvelle" className="underline">créez-en une via Nouvelle évaluation</a>.
              </p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 bg-primary/10 border-b border-border">
            <h3 className="font-bold text-foreground text-sm">
              {evaluationChoisie ? `${evaluationChoisie.type === "devoir" ? "Devoir" : "Examen"} du ${new Date(evaluationChoisie.dateCreation).toLocaleDateString("fr-FR")}` : "Détails"}
            </h3>
          </div>
          {!evaluationChoisie ? (
            <div className="py-12 text-center text-sm text-muted-foreground px-5">Choisissez une évaluation pour afficher ses détails.</div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{evaluationChoisie.code}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date effective</label>
                <input
                  type="date"
                  value={evaluationChoisie.dateCreation}
                  onChange={(e) => handleUpdateDetails({ dateCreation: e.target.value })}
                  className={inputClass}
                  data-testid="saisie-date-effective"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
                <textarea
                  value={evaluationChoisie.description ?? ""}
                  onChange={(e) => handleUpdateDetails({ description: e.target.value })}
                  rows={3}
                  className={inputClass}
                  data-testid="saisie-description"
                />
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Noté sur</span>
                <span className="font-bold text-foreground">{bareme}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Cette évaluation compte pour {evaluationChoisie.poids}% de la moyenne du cours.</p>
            </div>
          )}
        </div>
      </div>

      {!canShowTable ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <Save size={24} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Choisissez une évaluation</h3>
          <p className="text-sm text-muted-foreground">Sélectionnez la filière, la classe, le cours puis l&apos;évaluation à noter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats panel */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><TrendingUp size={11} /> Moyenne</p>
              <p className={cn("text-2xl font-bold", moyenne !== null ? (moyenne >= 10 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground")}>
                {moyenne !== null ? moyenne.toFixed(2) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">/{bareme}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs text-muted-foreground mb-1">Max / Min</p>
              <p className="text-lg font-bold text-foreground">
                {noteMax !== null ? noteMax.toFixed(1) : "—"} <span className="text-muted-foreground text-sm">/</span> {noteMin !== null ? noteMin.toFixed(1) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{nbSaisis}/{classeStudents.length} saisies</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs text-muted-foreground mb-1">% Réussite</p>
              <p className={cn("text-2xl font-bold", tauxReussite !== null ? (tauxReussite >= 50 ? "text-emerald-600" : "text-amber-500") : "text-muted-foreground")}>
                {tauxReussite !== null ? `${tauxReussite}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{nbAdmis} admis</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><AlertCircle size={11} /> Absents</p>
              <p className={cn("text-2xl font-bold", nbAbsents > 0 ? "text-red-500" : "text-foreground")}>{nbAbsents}</p>
              <p className="text-[10px] text-muted-foreground">{classeStudents.length - nbAbsents} présent(s)</p>
            </div>
          </div>

          {/* Table de saisie */}
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {ECS.find((e) => e.id === ecId)?.libelle} — {evaluationChoisie?.type === "devoir" ? "Devoir" : "Examen"}
                </h3>
                <p className="text-xs text-muted-foreground">{classeStudents.length} étudiants dans la liste</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} placeholder="Rechercher un étudiant…" className="px-3 py-2 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-48" />
                <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="px-3 py-2 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Tous statuts</option>
                  <option value="brouillon_prof">Brouillon</option>
                  <option value="publie">Publié</option>
                </select>
                <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                  <Upload size={13} /> Importer CSV
                </button>
                {saved && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle size={14} /> Enregistré
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Matricule</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Note /{bareme}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Absent</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {classeStudents.map((etu, i) => {
                  const entry = getEntry(etu.id);
                  const noteVal = parseFloat(entry.note);
                  const hasNote = !isNaN(noteVal) && !entry.absent;
                  const isAdmis = hasNote && noteVal >= 10;
                  const isAjourne = hasNote && noteVal < 10;
                  const noteExistante = notes.find((n) => n.etudiantId === etu.id && n.classeId === classeId && n.ecId === ecId && n.type === noteType && n.session === evaluationChoisie?.session);
                  if (statutFilter && noteExistante?.statut !== statutFilter) return null;
                  const rowBg = entry.absent ? "bg-red-50/40 dark:bg-red-950/20" : isAjourne ? "bg-red-50/30 dark:bg-red-950/10" : "";

                  return (
                    <tr key={etu.id} className={cn("border-b border-border last:border-0 transition-colors", rowBg)}>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{etu.matricule}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("font-medium", entry.absent ? "text-muted-foreground line-through" : "text-foreground")}>
                          {etu.prenom} {etu.nom}
                        </span>
                        {etu.classeId !== classeId && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" title={`Ajouté à ce cours — classe réelle : ${etu.classe}`}>
                            Ajouté ({etu.classe})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={bareme}
                          step={0.25}
                          disabled={entry.absent}
                          value={entry.note}
                          onChange={(e) => updateEntry(etu.id, { note: e.target.value })}
                          className={cn(
                            "w-20 text-center px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background",
                            entry.absent ? "opacity-30 cursor-not-allowed border-border" : isAdmis ? "border-emerald-300" : isAjourne ? "border-red-300" : "border-border",
                          )}
                          placeholder="—"
                          data-testid={`saisie-note-${etu.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAbsent(etu.id)}
                          className={cn("w-8 h-5 rounded-full transition-all duration-200 relative", entry.absent ? "bg-red-500" : "bg-muted border border-border")}
                          data-testid={`saisie-absent-${etu.id}`}
                        >
                          <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200", entry.absent ? "left-3.5" : "left-0.5")} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.absent ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300">Absent</span>
                        ) : noteExistante ? (
                          <span className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-full",
                            noteExistante.statut === "publie" ? "bg-indigo-50 text-indigo-600" :
                            isAdmis ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
                          )}>
                            {noteExistante.statut === "publie" ? "Publié" : noteExistante.statut === "valide_admin" ? "Validé" : noteExistante.statut === "soumis_admin" ? "Soumis" : isAdmis ? "Admis" : "Ajourné"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">En attente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex gap-3 px-5 py-4 border-t border-border flex-wrap">
              <button onClick={() => handleSave(false)} className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="saisie-brouillon">
                <Save size={14} /> Enregistrer brouillon
              </button>
              <button onClick={() => handleSave(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="saisie-publier">
                <CheckCircle size={14} /> Publier les notes
              </button>
              <button onClick={handleSubmitValidation} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
                Soumettre admin
              </button>
              <button onClick={handleAdminValidate} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
                Valider admin
              </button>
              <button onClick={handlePublish} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
                Publier validées
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
