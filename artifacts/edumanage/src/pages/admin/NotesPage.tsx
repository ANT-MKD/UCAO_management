import { useState, useCallback } from "react";
import { Save, Upload, CheckCircle, AlertCircle, TrendingUp, Users, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, SEMESTRES } from "@/data/mockData";
import { saveNotesGrid, submitNotesForValidation, validateNotesByAdmin, publishNotesForClasseEc } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { cn } from "@/lib/utils";

type NoteEntry = {
  cc: string;
  examen: string;
  absent: boolean;
  justifie: boolean;
  publie: boolean;
};

export default function NotesPage() {
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const ECS = useEcs();
  const CLASSES = useClasses();
  const scolariteConfigs = useScolariteConfigs();
  const [selectedFiliere, setSelectedFiliere] = useState("");
  const [selectedClasse, setSelectedClasse] = useState("");
  const [selectedEc, setSelectedEc] = useState("");
  const [selectedSemestre, setSelectedSemestre] = useState("");
  const [selectedAnnee, setSelectedAnnee] = useState("2025-2026");
  const [selectedType, setSelectedType] = useState("grille");
  const [statutFilter, setStatutFilter] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [entries, setEntries] = useState<Record<string, NoteEntry>>({});
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);

  const filteredClasses = CLASSES.filter((c) => {
    if (selectedFiliere && c.filiereId !== selectedFiliere) return false;
    if (selectedAnnee && c.annee !== selectedAnnee) return false;
    return true;
  });
  const classeStudents = etudiants.filter((e) => {
    if (e.classeId !== selectedClasse) return false;
    if (searchStudent) {
      const q = searchStudent.toLowerCase();
      if (!`${e.prenom} ${e.nom}`.toLowerCase().includes(q) && !e.matricule.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const filteredEcs = ECS.filter((ec) => {
    if (!selectedFiliere) return true;
    if (selectedFiliere === "f1") return ec.ue.includes("INFO");
    if (selectedFiliere === "f3") return ec.ue.includes("GEST");
    return true;
  });
  const canShowTable = selectedClasse && selectedEc;
  const isGrilleMode = selectedType === "grille";
  const bareme = scolariteConfigs.find((c) => c.filiereId === selectedFiliere)?.noteBareme ?? 20;

  const getEntry = (id: string): NoteEntry => entries[id] ?? { cc: "", examen: "", absent: false, justifie: false, publie: false };

  const updateEntry = useCallback((id: string, patch: Partial<NoteEntry>) => {
    setEntries((prev) => ({ ...prev, [id]: { ...getEntry(id), ...patch } }));
  }, [entries]);

  const toggleAbsent = (id: string) => {
    const e = getEntry(id);
    const newAbsent = !e.absent;
    updateEntry(id, { absent: newAbsent, justifie: newAbsent ? e.justifie : false });
  };

  const toggleJustifie = (id: string) => {
    const e = getEntry(id);
    updateEntry(id, { justifie: !e.justifie });
  };

  // Stats calculation
  const validNotes = classeStudents.flatMap((s) => {
    const e = getEntry(s.id);
    if (e.absent) return [];
    if (isGrilleMode) {
      const cc = parseFloat(e.cc);
      const ex = parseFloat(e.examen);
      if (!isNaN(cc) && !isNaN(ex)) return [cc * 0.4 + ex * 0.6];
      return [];
    }
    const val = parseFloat(selectedType === "CC" ? e.cc : e.examen);
    return !isNaN(val) ? [val] : [];
  });

  const nbAbsents = classeStudents.filter((s) => getEntry(s.id).absent).length;
  const nbJustifies = classeStudents.filter((s) => { const e = getEntry(s.id); return e.absent && e.justifie; }).length;
  const nbSaisis = validNotes.length;
  const moyenne = nbSaisis > 0 ? validNotes.reduce((a, b) => a + b, 0) / nbSaisis : null;
  const noteMax = nbSaisis > 0 ? Math.max(...validNotes) : null;
  const noteMin = nbSaisis > 0 ? Math.min(...validNotes) : null;
  const nbAdmis = validNotes.filter((n) => n >= 10).length;
  const tauxReussite = nbSaisis > 0 ? Math.round((nbAdmis / nbSaisis) * 100) : null;

  const handleSave = (publish: boolean) => {
    if (!selectedClasse || !selectedEc) return;
    const ecLabel = ECS.find((e) => e.id === selectedEc)?.libelle ?? "";
    const inputs = classeStudents.map((s) => {
      const e = getEntry(s.id);
      return {
        etudiantId: s.id,
        cc: e.cc ? parseFloat(e.cc) : undefined,
        examen: e.examen ? parseFloat(e.examen) : undefined,
        absent: e.absent,
      };
    });
    saveNotesGrid(selectedClasse, selectedEc, ecLabel, inputs, publish);
    if (publish) setPublished(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSubmitValidation = () => {
    if (!selectedClasse || !selectedEc) return;
    submitNotesForValidation(selectedClasse, selectedEc);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdminValidate = () => {
    if (!selectedClasse || !selectedEc || !currentUser) return;
    validateNotesByAdmin(selectedClasse, selectedEc, currentUser.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePublish = () => {
    if (!selectedClasse || !selectedEc) return;
    publishNotesForClasseEc(selectedClasse, selectedEc);
    setPublished(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Saisie des Notes" }]}
        title="Saisie des Notes"
        subtitle="Saisissez les notes par EC et par type d'évaluation — gestion des absences intégrée"
      />

      {/* Filtres */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <h3 className="font-semibold text-foreground mb-4 text-sm">Filtres de saisie</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année</label>
            <select value={selectedAnnee} onChange={(e) => setSelectedAnnee(e.target.value)} className={inputClass}>
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
            <select value={selectedFiliere} onChange={(e) => { setSelectedFiliere(e.target.value); setSelectedClasse(""); setSelectedEc(""); }} className={inputClass}>
              <option value="">Toutes</option>
              {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Semestre</label>
            <select value={selectedSemestre} onChange={(e) => setSelectedSemestre(e.target.value)} className={inputClass}>
              <option value="">Tous</option>
              {SEMESTRES.filter((s) => !selectedFiliere || s.filiere === FILIERES.find((f) => f.id === selectedFiliere)?.code).map((s) => (
                <option key={s.id} value={s.id}>{s.alias} — {s.niveau}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className={inputClass}>
              <option value="">Sélectionner</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">EC / Module *</label>
            <select value={selectedEc} onChange={(e) => setSelectedEc(e.target.value)} className={inputClass}>
              <option value="">Sélectionner</option>
              {filteredEcs.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mode de saisie *</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={inputClass}>
              <option value="grille">Grille CC + Examen</option>
              {["CC", "EF", "Projet", "Rattrapage"].map((t) => <option key={t} value={t}>{t} uniquement</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut publication</label>
            <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className={inputClass}>
              <option value="">Tous</option>
              <option value="brouillon">Brouillon</option>
              <option value="publie">Publié</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rechercher un étudiant</label>
            <input value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} placeholder="Nom ou matricule…" className={inputClass} />
          </div>
        </div>
      </div>

      {!canShowTable ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <Save size={24} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Sélectionnez les filtres</h3>
          <p className="text-sm text-muted-foreground">Choisissez une classe, un EC et un type d'évaluation pour saisir les notes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats panel */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              <p className={cn("text-2xl font-bold", nbAbsents > 0 ? "text-red-500" : "text-foreground")}>
                {nbAbsents}
              </p>
              <p className="text-[10px] text-muted-foreground">{nbJustifies} justifié(s)</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Users size={11} /> Présents</p>
              <p className="text-2xl font-bold text-foreground">{classeStudents.length - nbAbsents}</p>
              <p className="text-[10px] text-muted-foreground">sur {classeStudents.length}</p>
            </div>
          </div>

          {/* Table de saisie */}
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {ECS.find((e) => e.id === selectedEc)?.libelle} — {isGrilleMode ? "Grille CC / Examen" : selectedType}
                </h3>
                <p className="text-xs text-muted-foreground">{classeStudents.length} étudiants dans la liste</p>
              </div>
              <div className="flex items-center gap-2">
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
                  {isGrilleMode ? (
                    <>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">CC /{bareme}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Examen /{bareme}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Moy.</th>
                    </>
                  ) : (
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{selectedType} /{bareme}</th>
                  )}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Absent</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Justifié</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {classeStudents.map((etu, i) => {
                  const entry = getEntry(etu.id);
                  const ccVal = parseFloat(entry.cc);
                  const exVal = parseFloat(entry.examen);
                  const noteVal = isGrilleMode
                    ? (!isNaN(ccVal) && !isNaN(exVal) ? (ccVal * 0.4 + exVal * 0.6) : NaN)
                    : parseFloat(selectedType === "CC" || selectedType === "grille" ? entry.cc : entry.examen);
                  const hasNote = !isNaN(noteVal) && !entry.absent;
                  const isAdmis = hasNote && !entry.absent && noteVal >= 10;
                  const isAjourne = hasNote && !entry.absent && noteVal < 10;
                  const rowBg = entry.absent
                    ? entry.justifie
                      ? "bg-amber-50/50 dark:bg-amber-950/20"
                      : "bg-red-50/40 dark:bg-red-950/20"
                    : isAjourne
                    ? "bg-red-50/30 dark:bg-red-950/10"
                    : "";

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
                      </td>
                      {isGrilleMode ? (
                        <>
                          <td className="px-4 py-3 text-center">
                            <input type="number" min={0} max={bareme} step={0.25} disabled={entry.absent} value={entry.cc}
                              onChange={(e) => updateEntry(etu.id, { cc: e.target.value })}
                              className="w-20 text-center px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background disabled:opacity-30"
                              placeholder="—" />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input type="number" min={0} max={bareme} step={0.25} disabled={entry.absent} value={entry.examen}
                              onChange={(e) => updateEntry(etu.id, { examen: e.target.value })}
                              className="w-20 text-center px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background disabled:opacity-30"
                              placeholder="—" />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("font-bold text-sm", hasNote ? (noteVal >= 10 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground")}>
                              {hasNote ? noteVal.toFixed(2) : "—"}
                            </span>
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={bareme}
                            step={0.25}
                            disabled={entry.absent}
                            value={selectedType === "CC" ? entry.cc : entry.examen}
                            onChange={(e) => updateEntry(etu.id, selectedType === "CC" ? { cc: e.target.value } : { examen: e.target.value })}
                            className={cn(
                              "w-20 text-center px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background",
                              entry.absent ? "opacity-30 cursor-not-allowed border-border" :
                              isAdmis ? "border-emerald-300" : isAjourne ? "border-red-300" : "border-border",
                            )}
                            placeholder="—"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAbsent(etu.id)}
                          className={cn(
                            "w-8 h-5 rounded-full transition-all duration-200 relative",
                            entry.absent ? "bg-red-500" : "bg-muted border border-border"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200",
                            entry.absent ? "left-3.5" : "left-0.5"
                          )} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.absent ? (
                          <button
                            onClick={() => toggleJustifie(etu.id)}
                            className={cn(
                              "w-8 h-5 rounded-full transition-all duration-200 relative",
                              entry.justifie ? "bg-amber-500" : "bg-muted border border-border"
                            )}
                          >
                            <span className={cn(
                              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200",
                              entry.justifie ? "left-3.5" : "left-0.5"
                            )} />
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.absent ? (
                          <span className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-full",
                            entry.justifie
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
                          )}>
                            {entry.justifie ? "Abs. justifiée" : "Absent"}
                          </span>
                        ) : hasNote ? (
                          <span className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-full",
                            entry.publie ? "bg-indigo-50 text-indigo-600" :
                            isAdmis ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
                          )}>
                            {entry.publie ? "Publié" : isAdmis ? "Admis" : "Ajourné"}
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

            <div className="flex gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={() => handleSave(false)}
                className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
              >
                <Save size={14} /> Enregistrer brouillon
              </button>
              <button
                onClick={() => handleSave(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
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
