import { useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import * as XLSX from "xlsx";
import { Save, Upload, Download, CheckCircle, AlertCircle, TrendingUp, ArrowLeft, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useNotes, useSeances } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { useTypesEvaluation } from "@/hooks/useTypeEvaluationStore";
import { usePortefeuilleCours } from "@/hooks/usePortefeuilleCoursStore";
import { getEtudiantsAjoutesPourCours, getEtudiantsRetiresPourCours } from "@/data/portefeuilleCoursStore";
import { saveNoteEvaluationGrid, submitNotesForValidation, getNoteForEvaluation, type EvaluationGridInput } from "@/data/studentStore";
import { resolveRoleEvaluation } from "@/data/evaluationStore";
import { ANNEES_ACADEMIQUES } from "@/data/mockData";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { matchesProf } from "@/lib/teacherUtils";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NoteEntry = { note: string; absent: boolean };

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const STATUT_LABEL: Record<string, string> = {
  brouillon_prof: "Brouillon",
  soumis_admin: "Soumis à l'admin",
  valide_admin: "Validé",
  publie: "Publié",
};

export default function TeacherGradesPage() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const etudiants = useStudentStore();
  const notes = useNotes();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const teachers = useTeachers();
  const seances = useSeances();
  const scolariteConfigs = useScolariteConfigs();
  const evaluations = useEvaluations();
  const typesEvaluation = useTypesEvaluation();
  usePortefeuilleCours();

  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);
  const annee = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";
  const mesCours = useMemo(() => (myTeacher ? buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee) : []), [myTeacher, seances, ecs, ues, classes, annee]);

  const initialParams = useMemo(() => new URLSearchParams(searchStr), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [courseId, setCourseId] = useState(() => {
    const classeId = initialParams.get("classeId");
    const ecId = initialParams.get("ecId");
    return classeId && ecId ? `${ecId}:${classeId}:${annee}` : "";
  });
  const [evaluationId, setEvaluationId] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [entries, setEntries] = useState<Record<string, NoteEntry>>({});
  const [saved, setSaved] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const course = mesCours.find((c) => c.id === courseId);
  const classe = classes.find((c) => c.id === course?.classeId);
  const ec = ecs.find((e) => e.id === course?.ecId);
  const bareme = scolariteConfigs.find((c) => c.filiereId === classe?.filiereId)?.noteBareme ?? 20;
  const salleCours = course
    ? [...seances].reverse().find((s) => s.ecId === course.ecId && s.classeId === course.classeId)?.salle
    : undefined;

  const evaluationsDuCours = useMemo(
    () => (course
      ? evaluations
        .filter((e) => e.classeId === course.classeId && e.ecId === course.ecId && e.session === undefined)
        .filter((e) => !myTeacher || !e.professeurId || e.professeurId === myTeacher.id || matchesProf(myTeacher, e.professeur))
        .sort((a, b) => a.dateCreation.localeCompare(b.dateCreation))
      : []),
    [course, evaluations, myTeacher],
  );
  const evaluationChoisie = evaluationsDuCours.find((e) => e.id === evaluationId);
  const roleEvaluationChoisie = evaluationChoisie ? resolveRoleEvaluation(evaluationChoisie) : undefined;

  const etudiantsRetiresIds = course ? new Set(getEtudiantsRetiresPourCours(course.classeId, course.ecId)) : new Set<string>();
  const etudiantsAjoutesIds = course ? new Set(getEtudiantsAjoutesPourCours(course.classeId, course.ecId)) : new Set<string>();
  const classeStudents = etudiants.filter((e) => {
    if (e.statut === "abandon") return false;
    const estMembre = e.classeId === course?.classeId;
    const estAjoute = etudiantsAjoutesIds.has(e.id);
    if (!((estMembre && !etudiantsRetiresIds.has(e.id)) || estAjoute)) return false;
    if (searchStudent) {
      const q = searchStudent.toLowerCase();
      if (!`${e.prenom} ${e.nom}`.toLowerCase().includes(q) && !e.matricule.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getEntry = (id: string): NoteEntry => entries[id] ?? { note: "", absent: false };
  const updateEntry = useCallback((id: string, patch: Partial<NoteEntry>) => {
    setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { note: "", absent: false }), ...patch } }));
  }, []);
  const toggleAbsent = (id: string) => updateEntry(id, { absent: !getEntry(id).absent });

  const prefillFromEvaluation = (evId: string) => {
    const existing = notes.filter((n) => n.evaluationId === evId);
    const prefill: Record<string, NoteEntry> = {};
    for (const n of existing) prefill[n.etudiantId] = { note: String(n.note), absent: false };
    setEntries(prefill);
  };

  const handleCourseChange = (value: string) => {
    setCourseId(value);
    setEvaluationId("");
    setEntries({});
  };
  const handleEvaluationChange = (value: string) => {
    setEvaluationId(value);
    prefillFromEvaluation(value);
  };

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

  const recap = useMemo(() => {
    if (!evaluationChoisie) return { nonSaisies: 0, brouillons: 0, soumises: 0, validees: 0 };
    let brouillons = 0, soumises = 0, validees = 0;
    for (const s of classeStudents) {
      const n = getNoteForEvaluation(s.id, evaluationChoisie.id);
      if (!n) continue;
      if (n.statut === "brouillon_prof") brouillons++;
      else if (n.statut === "soumis_admin") soumises++;
      else validees++;
    }
    return { nonSaisies: classeStudents.length - brouillons - soumises - validees, brouillons, soumises, validees };
  }, [evaluationChoisie, classeStudents, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildInputs = (): EvaluationGridInput[] =>
    classeStudents.map((s) => {
      const e = getEntry(s.id);
      const val = e.note ? parseFloat(e.note) : undefined;
      return { etudiantId: s.id, note: val, absent: e.absent };
    });

  const getCell = (raw: Record<string, unknown>, ...keys: string[]): string => {
    const lower = new Map(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), v]));
    for (const key of keys) {
      const v = lower.get(key.toLowerCase());
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const json = sheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" }) : [];
      if (json.length === 0) { toast.error("Aucune ligne trouvée dans le fichier."); return; }
      const next = { ...entries };
      let count = 0;
      for (const raw of json) {
        const matricule = getCell(raw, "matricule");
        if (!matricule) continue;
        const etu = classeStudents.find((s) => s.matricule.toLowerCase() === matricule.toLowerCase());
        if (!etu) continue;
        const absentTxt = getCell(raw, "absent").toLowerCase();
        const absent = ["oui", "x", "1", "true"].includes(absentTxt);
        next[etu.id] = { note: absent ? "" : getCell(raw, "note"), absent };
        count++;
      }
      setEntries(next);
      toast.success(count > 0 ? `${count} note(s) importée(s) — vérifiez puis enregistrez.` : "Aucun matricule du fichier ne correspond à cette liste.");
    } catch {
      toast.error("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const handleExport = () => {
    if (!course) return;
    const rows = classeStudents.map((s) => {
      const e = getEntry(s.id);
      return { Matricule: s.matricule, Étudiant: `${s.prenom} ${s.nom}`, Note: e.absent ? "" : e.note, Absent: e.absent ? "Oui" : "Non" };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notes");
    XLSX.writeFile(wb, `notes-${ec?.code ?? "cours"}-${classe?.nom ?? ""}.xlsx`);
  };

  const handleSave = (submit: boolean) => {
    if (!course || !evaluationChoisie || !roleEvaluationChoisie) return;
    try {
      saveNoteEvaluationGrid(course.classeId, course.ecId, ec?.libelle ?? "", evaluationChoisie.id, roleEvaluationChoisie, evaluationChoisie.session, buildInputs(), false);
      if (submit) {
        const count = submitNotesForValidation(course.classeId, course.ecId);
        toast.success(count > 0 ? `${count} note(s) soumise(s) à l'admin.` : "Notes enregistrées.");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Saisie des notes</h2>
          <p className="text-sm text-muted-foreground mt-1">Consultez et saisissez les notes de vos évaluations.</p>
        </div>
        <button onClick={() => setLocation("/teacher/modules")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
          <ArrowLeft size={14} /> Retour à mes cours
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-semibold text-foreground text-sm">Évaluation</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mon cours *</label>
            <select value={courseId} onChange={(e) => handleCourseChange(e.target.value)} className={inputClass} data-testid="notes-cours">
              <option value="">Sélectionner</option>
              {mesCours.map((c) => <option key={c.id} value={c.id}>{c.coursLabel} — {c.detailsLabel}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type d&apos;évaluation *</label>
            <select value={evaluationId} onChange={(e) => handleEvaluationChange(e.target.value)} disabled={!course} className={cn(inputClass, "disabled:opacity-50")} data-testid="notes-evaluation">
              <option value="">Sélectionner</option>
              {evaluationsDuCours.map((ev) => {
                const typeLabel = ev.typeEvaluationId ? typesEvaluation.find((t) => t.id === ev.typeEvaluationId)?.intitule : undefined;
                return (
                  <option key={ev.id} value={ev.id}>
                    {typeLabel ?? (ev.type === "devoir" ? "Devoir" : "Examen")} du {new Date(ev.dateCreation).toLocaleDateString("fr-FR")}
                  </option>
                );
              })}
            </select>
            {course && evaluationsDuCours.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1"><Info size={11} /> Aucune évaluation planifiée pour ce cours pour le moment.</p>
            )}
          </div>
          {evaluationChoisie && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Progression de la saisie</label>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${classeStudents.length > 0 ? Math.round(((recap.brouillons + recap.soumises + recap.validees) / classeStudents.length) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{recap.brouillons + recap.soumises + recap.validees} / {classeStudents.length} · {classeStudents.length > 0 ? Math.round(((recap.brouillons + recap.soumises + recap.validees) / classeStudents.length) * 100) : 0}%</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 bg-primary/10 border-b border-border">
            <h3 className="font-bold text-foreground text-sm">
              {evaluationChoisie ? `${evaluationChoisie.type === "devoir" ? "Devoir" : "Examen"} du ${new Date(evaluationChoisie.dateCreation).toLocaleDateString("fr-FR")}` : "Détails"}
            </h3>
          </div>
          {!course ? (
            <div className="py-12 text-center text-sm text-muted-foreground px-5">Sélectionnez un cours pour afficher ses informations.</div>
          ) : (
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Classe</span><span className="font-medium text-foreground">{classe?.nom}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Étudiants</span><span className="font-medium text-foreground">{classeStudents.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Salle</span><span className="font-medium text-foreground">{salleCours ?? "—"}</span></div>
              {evaluationChoisie && (
                <>
                  <div className="flex items-center justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Noté sur</span><span className="font-bold text-foreground">{bareme}</span></div>
                  <p className="text-[11px] text-muted-foreground">Cette évaluation compte pour {evaluationChoisie.poids}% de la moyenne du cours.</p>
                  {evaluationChoisie.description && <p className="text-xs text-muted-foreground">{evaluationChoisie.description}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!evaluationChoisie ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3"><Save size={24} className="text-muted-foreground" /></div>
          <h3 className="font-semibold text-foreground mb-1">Choisissez une évaluation</h3>
          <p className="text-sm text-muted-foreground">Sélectionnez votre cours puis l&apos;évaluation à noter</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><TrendingUp size={11} /> Moyenne</p>
                <p className={cn("text-2xl font-bold", moyenne !== null ? (moyenne >= 10 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground")}>{moyenne !== null ? moyenne.toFixed(2) : "—"}</p>
                <p className="text-[10px] text-muted-foreground">/{bareme}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs text-muted-foreground mb-1">Max / Min</p>
                <p className="text-lg font-bold text-foreground">{noteMax !== null ? noteMax.toFixed(1) : "—"} <span className="text-muted-foreground text-sm">/</span> {noteMin !== null ? noteMin.toFixed(1) : "—"}</p>
                <p className="text-[10px] text-muted-foreground">{nbSaisis}/{classeStudents.length} saisies</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs text-muted-foreground mb-1">% Réussite</p>
                <p className={cn("text-2xl font-bold", tauxReussite !== null ? (tauxReussite >= 50 ? "text-emerald-600" : "text-amber-500") : "text-muted-foreground")}>{tauxReussite !== null ? `${tauxReussite}%` : "—"}</p>
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
                  <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{ec?.libelle} — {evaluationChoisie.type === "devoir" ? "Devoir" : "Examen"}</h3>
                  <p className="text-xs text-muted-foreground">{classeStudents.length} étudiants dans la liste</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} placeholder="Rechercher un étudiant…" className="px-3 py-2 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-44" />
                  <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="px-3 py-2 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Tous les statuts</option>
                    <option value="brouillon_prof">Brouillon</option>
                    <option value="soumis_admin">Soumis</option>
                    <option value="valide_admin">Validé</option>
                    <option value="publie">Publié</option>
                  </select>
                  <label className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                    <Upload size={13} /> Importer
                    <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleImport(e.target.files?.[0])} data-testid="notes-import-input" />
                  </label>
                  <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors" data-testid="notes-export">
                    <Download size={13} /> Exporter
                  </button>
                  {saved && <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle size={14} /> Enregistré</div>}
                </div>
              </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">#</th>
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
                    const noteExistante = getNoteForEvaluation(etu.id, evaluationChoisie.id);
                    if (statutFilter && noteExistante?.statut !== statutFilter) return null;
                    const rowBg = entry.absent ? "bg-red-50/40 dark:bg-red-950/20" : isAjourne ? "bg-red-50/30 dark:bg-red-950/10" : "";
                    return (
                      <tr key={etu.id} className={cn("border-b border-border last:border-0 transition-colors", rowBg)}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {etu.photoDataUrl ? <img src={etu.photoDataUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <UserAvatar name={`${etu.prenom} ${etu.nom}`} size="sm" />}
                            <div className="min-w-0">
                              <span className={cn("font-medium block truncate", entry.absent ? "text-muted-foreground line-through" : "text-foreground")}>{etu.prenom} {etu.nom}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{etu.matricule}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number" min={0} max={bareme} step={0.25} disabled={entry.absent}
                            value={entry.note} onChange={(e) => updateEntry(etu.id, { note: e.target.value })}
                            className={cn("w-20 text-center px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background",
                              entry.absent ? "opacity-30 cursor-not-allowed border-border" : isAdmis ? "border-emerald-300" : isAjourne ? "border-red-300" : "border-border")}
                            placeholder="—" data-testid={`notes-note-${etu.id}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleAbsent(etu.id)} className={cn("w-8 h-5 rounded-full transition-all duration-200 relative", entry.absent ? "bg-red-500" : "bg-muted border border-border")} data-testid={`notes-absent-${etu.id}`}>
                            <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200", entry.absent ? "left-3.5" : "left-0.5")} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {entry.absent ? (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300">Absent</span>
                          ) : noteExistante ? (
                            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                              noteExistante.statut === "publie" ? "bg-indigo-50 text-indigo-600" :
                              noteExistante.statut === "valide_admin" ? "bg-blue-50 text-blue-600" :
                              noteExistante.statut === "soumis_admin" ? "bg-amber-50 text-amber-600" :
                              isAdmis ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
                              {STATUT_LABEL[noteExistante.statut]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">Manquante</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>

              <div className="flex gap-3 px-5 py-4 border-t border-border flex-wrap">
                <button onClick={() => handleSave(false)} className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="notes-brouillon">
                  <Save size={14} /> Enregistrer brouillon
                </button>
                <button onClick={() => handleSave(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="notes-soumettre">
                  <CheckCircle size={14} /> Soumettre à l&apos;admin
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground text-sm mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Récapitulatif</h3>
              <p className="text-2xl font-bold text-foreground">{recap.brouillons + recap.soumises + recap.validees} / {classeStudents.length}</p>
              <p className="text-xs text-muted-foreground mb-3">notes saisies</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-slate-300" />Non saisies</span><span className="font-semibold text-foreground">{recap.nonSaisies}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-amber-400" />Brouillons</span><span className="font-semibold text-foreground">{recap.brouillons}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-blue-400" />Soumises</span><span className="font-semibold text-foreground">{recap.soumises}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-emerald-400" />Validées/Publiées</span><span className="font-semibold text-foreground">{recap.validees}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground text-sm mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Actions rapides</h3>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer py-1">
                  <Upload size={13} /> Importer des notes
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleImport(e.target.files?.[0])} />
                </label>
                <button onClick={handleExport} className="flex items-center gap-2 text-sm text-primary hover:underline py-1"><Download size={13} /> Exporter les résultats</button>
                <button onClick={() => setLocation("/teacher/modules")} className="flex items-center gap-2 text-sm text-primary hover:underline py-1"><ArrowLeft size={13} /> Retourner à mes cours</button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground text-sm mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Légende des statuts</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p><span className="font-semibold text-foreground">Brouillon</span> — enregistrée, pas encore soumise</p>
                <p><span className="font-semibold text-foreground">Soumis à l&apos;admin</span> — en attente de validation</p>
                <p><span className="font-semibold text-foreground">Validé</span> — vérifié par l&apos;administration</p>
                <p><span className="font-semibold text-foreground">Publié</span> — visible par l&apos;étudiant</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
