import { useState, useCallback } from "react";
import { Save, CheckCircle, AlertCircle, TrendingUp, Info, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import {
  saveNotesGrid, submitNotesForValidation, validateNotesByAdmin, publishNotesForClasseEc,
  getEffectiveNote, type GridNoteInput,
} from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { createEvaluation, updateEvaluation, getPoidsForClasseEc } from "@/data/evaluationStore";
import { usePortefeuilleCours } from "@/hooks/usePortefeuilleCoursStore";
import { getEtudiantsAjoutesPourCours, getEtudiantsRetiresPourCours } from "@/data/portefeuilleCoursStore";
import { cn } from "@/lib/utils";

type NoteEntry = { note: string; absent: boolean };

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
const POIDS_CC_DEFAUT = 30;
const POIDS_EXAMEN_DEFAUT = 70;

export default function RattrapagePage() {
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
  const [searchStudent, setSearchStudent] = useState("");
  const [entries, setEntries] = useState<Record<string, NoteEntry>>({});
  const [saved, setSaved] = useState(false);

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);
  const bareme = scolariteConfigs.find((c) => c.filiereId === filiereId)?.noteBareme ?? 20;
  const moyennePassage = scolariteConfigs.find((c) => c.filiereId === filiereId)?.moyennePassage ?? 10;

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = CLASSES.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);
  const coursDisponibles = ECS.filter((ec) => {
    const ue = UES.find((u) => u.id === ec.ueId);
    return !!ue && ue.filiereId === filiereId && ue.niveau === niveau?.alias && ue.semestre === semestre?.alias;
  });

  // Seul un examen normal déjà administré peut être rattrapé.
  const evaluationOriginal = evaluations.find(
    (e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.type === "examen" && e.session === undefined,
  );
  const evaluationRattrapage = evaluations.find(
    (e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.type === "examen" && e.session === "rattrapage",
  );

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId(""); setEntries({});
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId(""); setEntries({});
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setEcId(""); setEntries({});
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setEcId(""); setEntries({});
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setEcId(""); setEntries({});
  };
  const handleCoursChange = (value: string) => {
    setEcId(value);
    setEntries({});
  };

  const handleCreerRattrapage = () => {
    if (!evaluationOriginal || !niveau || !semestre) return;
    createEvaluation({
      filiereId, annee, niveauId, niveau: niveau.alias, classeId,
      semestreId, semestre: `${semestre.nom} (${semestre.alias})`, ecId,
      professeurId: evaluationOriginal.professeurId, professeur: evaluationOriginal.professeur,
      type: "examen", poids: evaluationOriginal.poids,
      creePar: currentUser?.name ?? "Administration", session: "rattrapage",
    });
  };

  const handleUpdateDetails = (patch: { dateCreation?: string; description?: string }) => {
    if (!evaluationRattrapage) return;
    updateEvaluation(evaluationRattrapage.id, {
      semestreId: evaluationRattrapage.semestreId,
      semestre: evaluationRattrapage.semestre,
      ecId: evaluationRattrapage.ecId,
      type: evaluationRattrapage.type,
      poids: evaluationRattrapage.poids,
      modifiePar: currentUser?.name ?? "Administration",
      ...patch,
    });
  };

  const getEntry = (id: string): NoteEntry => entries[id] ?? { note: "", absent: false };
  const updateEntry = useCallback((id: string, patch: Partial<NoteEntry>) => {
    setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { note: "", absent: false }), ...patch } }));
  }, []);
  const toggleAbsent = (id: string) => updateEntry(id, { absent: !getEntry(id).absent });

  // Ne montre que les étudiants réellement ajournés sur ce cours (moyenne effective — CC +
  // meilleur EF disponible, vrais poids — sous la moyenne de passage réelle de la filière) :
  // le rattrapage n'a de sens que pour eux.
  const etudiantsRetiresIds = classeId && ecId ? new Set(getEtudiantsRetiresPourCours(classeId, ecId)) : new Set<string>();
  const etudiantsAjoutesIds = classeId && ecId ? new Set(getEtudiantsAjoutesPourCours(classeId, ecId)) : new Set<string>();
  const classeStudentsAll = etudiants.filter((e) => {
    const estMembre = e.classeId === classeId;
    const estAjoute = etudiantsAjoutesIds.has(e.id);
    return (estMembre && !etudiantsRetiresIds.has(e.id)) || estAjoute;
  });
  const { devoir: poidsDevoirReel, examen: poidsExamenReel } = ecId ? getPoidsForClasseEc(classeId, ecId) : {};
  const poidsCc = (poidsDevoirReel ?? POIDS_CC_DEFAUT) / 100;
  const poidsExamen = (poidsExamenReel ?? POIDS_EXAMEN_DEFAUT) / 100;
  // Ajourné = moyenne normale (CC + EF, tous deux déjà saisis) réellement sous la moyenne de
  // passage. Un étudiant dont l'examen normal n'a pas encore été noté n'apparaît pas ici — ce
  // n'est pas un cas de rattrapage, c'est une saisie normale à faire d'abord.
  const ajournes = classeStudentsAll.filter((etu) => {
    const cc = getEffectiveNote(etu.id, classeId, ecId, "CC")?.note;
    const ef = getEffectiveNote(etu.id, classeId, ecId, "EF")?.note;
    if (cc === undefined || ef === undefined) return false;
    return cc * poidsCc + ef * poidsExamen < moyennePassage;
  });
  const classeStudents = ajournes.filter((e) => {
    if (!searchStudent) return true;
    const q = searchStudent.toLowerCase();
    return `${e.prenom} ${e.nom}`.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q);
  });

  const canShowTable = !!evaluationRattrapage;

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
      return { etudiantId: s.id, examen: val, absent: e.absent };
    });

  const handleSave = (publish: boolean) => {
    if (!classeId || !ecId || !evaluationRattrapage) return;
    const ecLabel = ECS.find((e) => e.id === ecId)?.libelle ?? "";
    saveNotesGrid(classeId, ecId, ecLabel, buildInputs(), publish, "rattrapage");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const handleSubmitValidation = () => {
    if (!classeId || !ecId) return;
    submitNotesForValidation(classeId, ecId, "rattrapage");
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const handleAdminValidate = () => {
    if (!classeId || !ecId || !currentUser) return;
    validateNotesByAdmin(classeId, ecId, currentUser.id, "rattrapage");
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const handlePublish = () => {
    if (!classeId || !ecId) return;
    publishNotesForClasseEc(classeId, ecId, "rattrapage");
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Rattrapage" }]}
        title="Rattrapage"
        subtitle="Reprise de l'examen pour les étudiants ajournés — la nouvelle note remplace l'examen normal dans le calcul final"
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-semibold text-foreground text-sm">Cours à rattraper</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="rattrapage-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
              <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="rattrapage-annee">
                <option value="">Sélectionner</option>
                {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
              <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="rattrapage-niveau">
                <option value="">Sélectionner</option>
                {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
              <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="rattrapage-classe">
                <option value="">Sélectionner</option>
                {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
              <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="rattrapage-semestre">
                <option value="">Sélectionner</option>
                {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cours *</label>
            <select value={ecId} onChange={(e) => handleCoursChange(e.target.value)} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="rattrapage-cours">
              <option value="">Sélectionner</option>
              {coursDisponibles.map((ec) => <option key={ec.id} value={ec.id}>{ec.code} — {ec.libelle}</option>)}
            </select>
          </div>
          {ecId && !evaluationOriginal && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1"><Info size={11} /> Aucun examen normal n&apos;a encore été planifié pour ce cours — le rattrapage nécessite un examen déjà administré.</p>
          )}
          {evaluationOriginal && (
            <p className="text-[11px] text-muted-foreground">Professeur : <strong className="text-foreground">{evaluationOriginal.professeur}</strong></p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 bg-amber-500/10 border-b border-border">
            <h3 className="font-bold text-foreground text-sm">
              {evaluationRattrapage ? `Rattrapage du ${new Date(evaluationRattrapage.dateCreation).toLocaleDateString("fr-FR")}` : "Session de rattrapage"}
            </h3>
          </div>
          {!evaluationOriginal ? (
            <div className="py-12 text-center text-sm text-muted-foreground px-5">Choisissez un cours dont l&apos;examen normal a déjà été noté.</div>
          ) : !evaluationRattrapage ? (
            <div className="py-10 text-center px-5 space-y-3">
              <p className="text-sm text-muted-foreground">Aucune session de rattrapage n&apos;existe encore pour cet examen.</p>
              <button
                onClick={handleCreerRattrapage}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                data-testid="rattrapage-creer"
              >
                <RotateCcw size={14} /> Créer la session de rattrapage
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{evaluationRattrapage.code}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date effective</label>
                <input type="date" value={evaluationRattrapage.dateCreation} onChange={(e) => handleUpdateDetails({ dateCreation: e.target.value })} className={inputClass} data-testid="rattrapage-date-effective" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
                <textarea value={evaluationRattrapage.description ?? ""} onChange={(e) => handleUpdateDetails({ description: e.target.value })} rows={3} className={inputClass} data-testid="rattrapage-description" />
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Noté sur</span>
                <span className="font-bold text-foreground">{bareme}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Cette note remplace l&apos;examen normal ({evaluationRattrapage.poids}% de la moyenne du cours) dans le calcul final.</p>
            </div>
          )}
        </div>
      </div>

      {!canShowTable ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <Save size={24} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Aucune session de rattrapage sélectionnée</h3>
          <p className="text-sm text-muted-foreground">Choisissez un cours dont l&apos;examen normal existe, puis créez ou sélectionnez sa session de rattrapage</p>
        </div>
      ) : classeStudents.length === 0 && ajournes.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border rounded-xl text-sm text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>
          Aucun étudiant ajourné sur ce cours — personne n&apos;a besoin de rattrapage.
        </div>
      ) : (
        <div className="space-y-4">
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

          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {ECS.find((e) => e.id === ecId)?.libelle} — Rattrapage
                </h3>
                <p className="text-xs text-muted-foreground">{ajournes.length} étudiant(s) ajourné(s) (moyenne &lt; {moyennePassage})</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} placeholder="Rechercher un étudiant…" className="px-3 py-2 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-48" />
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
                  const noteExistante = notes.find((n) => n.etudiantId === etu.id && n.classeId === classeId && n.ecId === ecId && n.type === "EF" && n.session === "rattrapage");
                  const rowBg = entry.absent ? "bg-red-50/40 dark:bg-red-950/20" : isAjourne ? "bg-red-50/30 dark:bg-red-950/10" : "";
                  return (
                    <tr key={etu.id} className={cn("border-b border-border last:border-0 transition-colors", rowBg)}>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{etu.matricule}</span></td>
                      <td className="px-4 py-3">
                        <span className={cn("font-medium", entry.absent ? "text-muted-foreground line-through" : "text-foreground")}>{etu.prenom} {etu.nom}</span>
                        {etu.classeId !== classeId && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" title={`Ajouté à ce cours — classe réelle : ${etu.classe}`}>
                            Ajouté ({etu.classe})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number" min={0} max={bareme} step={0.25} disabled={entry.absent} value={entry.note}
                          onChange={(e) => updateEntry(etu.id, { note: e.target.value })}
                          className={cn(
                            "w-20 text-center px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background",
                            entry.absent ? "opacity-30 cursor-not-allowed border-border" : isAdmis ? "border-emerald-300" : isAjourne ? "border-red-300" : "border-border",
                          )}
                          placeholder="—" data-testid={`rattrapage-note-${etu.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleAbsent(etu.id)} className={cn("w-8 h-5 rounded-full transition-all duration-200 relative", entry.absent ? "bg-red-500" : "bg-muted border border-border")} data-testid={`rattrapage-absent-${etu.id}`}>
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
              <button onClick={() => handleSave(false)} className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="rattrapage-brouillon">
                <Save size={14} /> Enregistrer brouillon
              </button>
              <button onClick={() => handleSave(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="rattrapage-publier">
                <CheckCircle size={14} /> Publier les notes
              </button>
              <button onClick={handleSubmitValidation} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">Soumettre admin</button>
              <button onClick={handleAdminValidate} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">Valider admin</button>
              <button onClick={handlePublish} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">Publier validées</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
