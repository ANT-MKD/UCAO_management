import { useMemo, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { useSeances, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { getTeacherVolume, makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { addRallonge } from "@/data/rallongeStore";
import { buildTeacherCourses, type TeacherCourseItem } from "@/lib/teacherCourseUtils";
import { filterTeachers, teacherDisplayLabel, type EnseignantRecord } from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function TeacherRallongeFormPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const teacherIdParam = params.get("id") ?? "";
  const anneeParam = params.get("annee") ?? "";

  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const savedVolumes = useTeacherVolumes();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0] ?? "2025-2026";

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(teacherIdParam);
  const [anneeScolaire, setAnneeScolaire] = useState(anneeParam || defaultAnnee);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [courseQuery, setCourseQuery] = useState("");
  const [showCourseList, setShowCourseList] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [heuresSupp, setHeuresSupp] = useState("2");
  const [motif, setMotif] = useState("");

  const selected = teachers.find((t) => t.id === selectedId) ?? null;
  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  useEffect(() => {
    if (anneeParam) setAnneeScolaire(anneeParam);
  }, [anneeParam]);

  useEffect(() => {
    if (!teacherIdParam) return;
    setSelectedId(teacherIdParam);
    const t = teachers.find((x) => x.id === teacherIdParam);
    if (t) setQuery(teacherDisplayLabel(t));
  }, [teacherIdParam, teachers]);

  const courseItems = useMemo(() => {
    if (!selected) return [];
    return buildTeacherCourses(selected, seances, ecs, ues, classes, anneeScolaire);
  }, [selected, seances, ecs, ues, classes, anneeScolaire]);

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return courseItems;
    return courseItems.filter(
      (c) =>
        c.coursLabel.toLowerCase().includes(q) ||
        c.filiereLabel.toLowerCase().includes(q) ||
        c.detailsLabel.toLowerCase().includes(q),
    );
  }, [courseItems, courseQuery]);

  const selectedCourse = courseItems.find((c) => c.id === selectedCourseId) ?? null;

  const vhActuel = useMemo(() => {
    if (!selected || !selectedCourse) return 0;
    const volId = makeTeacherVolumeId(selected.id, selectedCourse.ecId, selectedCourse.classeId, anneeScolaire);
    const saved = savedVolumes.find((v) => v.id === volId) ?? getTeacherVolume(volId);
    return saved?.nouveauVh ?? selectedCourse.volumeHoraire;
  }, [selected, selectedCourse, anneeScolaire, savedVolumes]);

  const pickCourse = (course: TeacherCourseItem) => {
    setSelectedCourseId(course.id);
    setCourseQuery(`${course.coursLabel} — ${course.filiereLabel}`);
    setShowCourseList(false);
  };

  const resetForm = () => {
    setSelectedCourseId("");
    setCourseQuery("");
    setHeuresSupp("2");
    setMotif("");
  };

  const syncUrl = (teacherId: string, annee: string) => {
    const qs = new URLSearchParams();
    if (teacherId) qs.set("id", teacherId);
    if (annee) qs.set("annee", annee);
    setLocation(`/admin/teachers/rallonge/new?${qs.toString()}`);
  };

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    resetForm();
    syncUrl(t.id, anneeScolaire);
  };

  const handleAnneeChange = (annee: string) => {
    setAnneeScolaire(annee);
    resetForm();
    if (selectedId) syncUrl(selectedId, annee);
  };

  const handleSubmit = () => {
    if (!selected || !selectedCourse) {
      toast.error("Sélectionnez un professeur et un cours");
      return;
    }
    const heures = Number(heuresSupp);
    if (!heures || heures <= 0) {
      toast.error("Indiquez un nombre d'heures supplémentaires valide");
      return;
    }
    if (!motif.trim()) {
      toast.error("Indiquez un motif pour la demande");
      return;
    }

    addRallonge({
      teacherId: selected.id,
      ecId: selectedCourse.ecId,
      classeId: selectedCourse.classeId,
      annee: anneeScolaire,
      vhActuel,
      vhSupplementaire: heures,
      motif: motif.trim(),
      origine: "admin",
    });

    toast.success("Demande de rallonge soumise pour traitement");
    resetForm();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Nouvelle demande de rallonge" }]}
        title="Nouvelle demande de rallonge"
        subtitle="Demandez des heures supplémentaires sur un cours dont le volume prévu est dépassé"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">
            Professeur <span className="text-red-500">*</span>
          </label>
          <div className="relative flex-1 min-w-[280px] max-w-2xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Matricule, prénom, nom ou téléphone du professeur…"
              className={`${inputClass} pl-10`}
              data-testid="teacher-rallonge-search"
            />
            {showSuggestions && suggestions.length > 0 && query.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTeacher(t)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors",
                      t.id === selectedId && "bg-primary/5",
                    )}
                  >
                    {teacherDisplayLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Sélectionnez un professeur pour créer une demande de rallonge
        </div>
      ) : (
        <>
          <div className="bg-muted/60 border border-border rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              {selected.matricule} — {selected.prenom} {selected.nom}
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="annee-rallonge" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Choix année scolaire
              </label>
              <select
                id="annee-rallonge"
                value={anneeScolaire}
                onChange={(e) => handleAnneeChange(e.target.value)}
                className={`${inputClass} min-w-[140px] py-2`}
              >
                {anneeOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {courseItems.length === 0 ? (
            <div className="bg-card border border-border border-t-0 rounded-b-xl py-16 text-center text-sm text-muted-foreground">
              Aucun cours associé à ce professeur pour l&apos;année {anneeScolaire}
            </div>
          ) : (
            <div className="bg-card border border-border border-t-0 rounded-b-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="relative">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Cours <span className="text-red-500">*</span>
                </label>
                <input
                  type="search"
                  value={courseQuery}
                  onChange={(e) => {
                    setCourseQuery(e.target.value);
                    setShowCourseList(true);
                    if (!e.target.value.trim()) setSelectedCourseId("");
                  }}
                  onFocus={() => setShowCourseList(true)}
                  placeholder="Rechercher un cours…"
                  className={inputClass}
                  required={!selectedCourseId}
                />
                {showCourseList && filteredCourses.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredCourses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickCourse(c)}
                        className={cn(
                          "w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors",
                          c.id === selectedCourseId && "bg-primary/5",
                        )}
                      >
                        <span className="font-medium">{c.coursLabel}</span>
                        <span className="text-muted-foreground text-xs block">{c.filiereLabel} — {c.detailsLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCourse && (
                <>
                  <section className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Volume horaire
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm items-end">
                      <div>
                        <p className="text-xs text-muted-foreground">V.H actuel</p>
                        <p className="font-semibold text-lg">{vhActuel} h</p>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Heures supplémentaires <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={heuresSupp}
                          onChange={(e) => setHeuresSupp(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nouveau V.H (si validé)</p>
                        <p className="font-semibold text-lg text-primary">
                          {vhActuel + (Number(heuresSupp) || 0)} h
                        </p>
                      </div>
                    </div>
                  </section>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Motif <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                      rows={3}
                      className={inputClass}
                      placeholder="Justification de la rallonge demandée…"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Effacer
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Send size={15} /> Soumettre la demande
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
