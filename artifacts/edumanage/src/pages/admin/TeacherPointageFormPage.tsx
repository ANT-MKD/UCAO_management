import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Clock, AlertTriangle, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useSeances, useCahiers } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import {
  addPointage,
  findPointageDuplicate,
  makePointageId,
  type PointageStatut,
} from "@/data/pointageStore";
import { makeTeacherVolumeId, getTeacherVolume } from "@/data/teacherVolumeStore";
import { buildTeacherCourses, type TeacherCourseItem } from "@/lib/teacherCourseUtils";
import {
  filterTeachers,
  teacherDisplayLabel,
  computeVhPointe,
  seanceDurationMinutes,
  dateToJour,
  mondayOf,
  matchesProf,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

const TYPES = ["CM", "TD", "TP", "EX"] as const;
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES]
  .sort((a, b) => b.libelle.localeCompare(a.libelle))
  .map((a) => a.libelle);

const DEFAULT_ANNEE =
  ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0] ?? "2025-2026";

const NO_SEANCE = "";

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export default function TeacherPointageFormPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const teacherIdParam = params.get("id") ?? "";
  const anneeParam = params.get("annee") ?? "";

  const seances = useSeances();
  const cahiers = useCahiers();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const salles = useSalles();
  const pointages = usePointages();
  const savedVolumes = useTeacherVolumes();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(teacherIdParam);
  const [anneeScolaire, setAnneeScolaire] = useState(anneeParam || DEFAULT_ANNEE);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [courseQuery, setCourseQuery] = useState("");
  const [showCourseList, setShowCourseList] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [seanceId, setSeanceId] = useState(NO_SEANCE);
  const [objet, setObjet] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<(typeof TYPES)[number]>("CM");
  const [salleId, setSalleId] = useState("");
  const [heureDebut, setHeureDebut] = useState("08:00");
  const [heureFin, setHeureFin] = useState("10:00");
  const [volumePointe, setVolumePointe] = useState("2");
  const [volumeManual, setVolumeManual] = useState(false);
  const [remarque, setRemarque] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

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

  const matchingSeances = useMemo(() => {
    if (!selected || !selectedCourse) return [];
    const jour = dateToJour(date);
    const semaineDu = mondayOf(date);
    return seances.filter(
      (s) =>
        matchesProf(selected, s.prof) &&
        s.annee === anneeScolaire &&
        s.ecId === selectedCourse.ecId &&
        s.classeId === selectedCourse.classeId &&
        s.jour === jour &&
        s.semaineDu === semaineDu,
    );
  }, [selected, selectedCourse, seances, anneeScolaire, date]);

  const volumeSummary = useMemo(() => {
    if (!selected || !selectedCourse) {
      return { vhTotal: 0, vhPointe: 0, reste: 0 };
    }
    const volId = makeTeacherVolumeId(selected.id, selectedCourse.ecId, selectedCourse.classeId, anneeScolaire);
    const savedVol = savedVolumes.find((v) => v.id === volId) ?? getTeacherVolume(volId);
    const ec = ecs.find((e) => e.id === selectedCourse.ecId);
    const vhTotal = savedVol?.nouveauVh ?? ec?.vht ?? selectedCourse.volumeHoraire;
    const vhPointe = computeVhPointe(
      selected,
      selectedCourse.ecId,
      selectedCourse.classeId,
      anneeScolaire,
      cahiers,
      seances,
      pointages,
    );
    const reste = Math.max(0, Math.round((vhTotal - vhPointe) * 10) / 10);
    return { vhTotal, vhPointe, reste };
  }, [selected, selectedCourse, anneeScolaire, savedVolumes, ecs, cahiers, seances, pointages]);

  const autoVolume = useMemo(() => {
    const mins = seanceDurationMinutes(heureDebut, heureFin);
    if (mins <= 0) return 0;
    return minutesToHours(mins);
  }, [heureDebut, heureFin]);

  useEffect(() => {
    if (!volumeManual) {
      setVolumePointe(String(autoVolume));
    }
  }, [autoVolume, volumeManual]);

  const pickCourse = (course: TeacherCourseItem) => {
    setSelectedCourseId(course.id);
    setCourseQuery(`${course.coursLabel} — ${course.filiereLabel}`);
    setShowCourseList(false);
    const ec = ecs.find((e) => e.id === course.ecId);
    setObjet(ec?.libelle ?? course.coursLabel);
    setSeanceId(NO_SEANCE);
  };

  const applySeance = useCallback(
    (id: string) => {
      setSeanceId(id);
      if (!id) return;
      const s = seances.find((x) => x.id === id);
      if (!s) return;
      setType((s.type as (typeof TYPES)[number]) || "CM");
      setSalleId(s.salleId);
      setHeureDebut(s.heureDebut);
      setHeureFin(s.heureFin);
      setVolumeManual(false);
    },
    [seances],
  );

  useEffect(() => {
    if (seanceId && !matchingSeances.some((s) => s.id === seanceId)) {
      setSeanceId(NO_SEANCE);
    }
  }, [matchingSeances, seanceId]);

  useEffect(() => {
    if (!selected || !selectedCourse) {
      setDuplicateWarning(null);
      return;
    }
    const dup = findPointageDuplicate(
      selected.id,
      selectedCourse.ecId,
      selectedCourse.classeId,
      date,
      heureDebut,
      heureFin,
    );
    setDuplicateWarning(
      dup ? "Un pointage existe déjà pour ce cours à cette date et ces horaires." : null,
    );
  }, [selected, selectedCourse, date, heureDebut, heureFin]);

  const resetForm = () => {
    setSelectedCourseId("");
    setCourseQuery("");
    setSeanceId(NO_SEANCE);
    setObjet("");
    setDate(new Date().toISOString().slice(0, 10));
    setType("CM");
    setSalleId(salles[0]?.id ?? "");
    setHeureDebut("08:00");
    setHeureFin("10:00");
    setVolumePointe("2");
    setVolumeManual(false);
    setRemarque("");
    setDuplicateWarning(null);
  };

  const syncUrl = (teacherId: string, annee: string) => {
    const qs = new URLSearchParams();
    if (teacherId) qs.set("id", teacherId);
    if (annee) qs.set("annee", annee);
    setLocation(`/admin/teachers/pointage/new?${qs.toString()}`);
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

  const savePointage = (statut: PointageStatut) => {
    if (!selected || !selectedCourse) {
      toast.error("Sélectionnez un professeur et un cours");
      return;
    }
    if (!salleId) {
      toast.error("Sélectionnez une salle");
      return;
    }
    const vol = Number(volumePointe);
    if (!vol || vol <= 0) {
      toast.error("Volume pointé invalide");
      return;
    }
    if (seanceDurationMinutes(heureDebut, heureFin) <= 0) {
      toast.error("L'heure de fin doit être postérieure à l'heure de début");
      return;
    }
    const dup = findPointageDuplicate(
      selected.id,
      selectedCourse.ecId,
      selectedCourse.classeId,
      date,
      heureDebut,
      heureFin,
    );
    if (dup) {
      toast.error("Pointage en doublon — modifiez la date ou les horaires");
      return;
    }

    addPointage({
      id: makePointageId(),
      teacherId: selected.id,
      ecId: selectedCourse.ecId,
      classeId: selectedCourse.classeId,
      annee: anneeScolaire,
      seanceId: seanceId || undefined,
      date,
      heureDebut,
      heureFin,
      type,
      salleId,
      volumePointe: vol,
      remarque: remarque.trim() || undefined,
      statut,
      createdAt: new Date().toISOString(),
    });

    toast.success(statut === "brouillon" ? "Pointage enregistré en brouillon" : "Pointage soumis pour traitement");
    resetForm();
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const volNum = Number(volumePointe) || 0;
  const exceedsReste = selectedCourse && volNum > volumeSummary.reste && volumeSummary.reste >= 0;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Nouveau pointage" }]}
        title="Nouveau pointage"
        subtitle="Enregistrez les heures effectuées par un professeur, avec ou sans lien vers une séance EDT"
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
              data-testid="teacher-pointage-search"
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
          Sélectionnez un professeur pour créer un pointage
        </div>
      ) : (
        <>
          <div className="bg-muted/60 border border-border rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              {selected.matricule} — {selected.prenom} {selected.nom}
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="annee-pointage" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Choix année scolaire
              </label>
              <select
                id="annee-pointage"
                value={anneeScolaire}
                onChange={(e) => handleAnneeChange(e.target.value)}
                className={`${inputClass} min-w-[140px] py-2`}
              >
                {ANNEE_OPTIONS.map((a) => (
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
              {duplicateWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {duplicateWarning}
                </div>
              )}

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
                    if (!e.target.value.trim()) {
                      setSelectedCourseId("");
                      setObjet("");
                      setSeanceId(NO_SEANCE);
                    }
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
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet</label>
                    <input readOnly value={objet} className={`${inputClass} bg-muted/50`} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Séance planifiée (EDT) — optionnel
                    </label>
                    <select
                      value={seanceId}
                      onChange={(e) => applySeance(e.target.value)}
                      className={inputClass}
                    >
                      <option value={NO_SEANCE}>— Pointage sans séance EDT —</option>
                      {matchingSeances.map((s) => (
                        <option key={s.id} value={s.id}>
                          {JOURS[s.jour - 1]} {s.heureDebut}–{s.heureFin} — {s.salle} ({s.type})
                        </option>
                      ))}
                    </select>
                    {matchingSeances.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Aucune séance EDT pour ce cours le {JOURS[dateToJour(date) - 1]?.toLowerCase() ?? "jour sélectionné"} — pointage manuel possible.
                      </p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setSeanceId(NO_SEANCE);
                        }}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Type <span className="text-red-500">*</span>
                      </label>
                      <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className={inputClass}>
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Salle de classe <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={salleId}
                      onChange={(e) => setSalleId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">— Sélectionner —</option>
                      {salles.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nom} — {s.batiment} ({s.capacite} pl.)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        H. début <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={heureDebut}
                        onChange={(e) => {
                          setHeureDebut(e.target.value);
                          setVolumeManual(false);
                        }}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        H. fin <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={heureFin}
                        onChange={(e) => {
                          setHeureFin(e.target.value);
                          setVolumeManual(false);
                        }}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Volume pointé (h) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={volumePointe}
                        onChange={(e) => {
                          setVolumePointe(e.target.value);
                          setVolumeManual(true);
                        }}
                        className={inputClass}
                        required
                      />
                      {!volumeManual && (
                        <p className="text-xs text-muted-foreground mt-1">Calculé automatiquement depuis les horaires</p>
                      )}
                    </div>
                  </div>

                  <section className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                      <Clock size={14} className="text-primary" /> Synthèse volume horaire
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">V.H total</p>
                        <p className="font-semibold text-lg">{volumeSummary.vhTotal} h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Déjà pointé</p>
                        <p className="font-semibold text-lg">{volumeSummary.vhPointe} h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reste à pointer</p>
                        <p className={cn("font-semibold text-lg", volumeSummary.reste === 0 && "text-red-600")}>
                          {volumeSummary.reste} h
                        </p>
                      </div>
                    </div>
                    {exceedsReste && (
                      <p className="text-sm text-amber-700 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Le volume saisi ({volNum} h) dépasse le reste à pointer ({volumeSummary.reste} h).
                      </p>
                    )}
                  </section>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Remarque</label>
                    <textarea
                      value={remarque}
                      onChange={(e) => setRemarque(e.target.value)}
                      rows={3}
                      className={inputClass}
                      placeholder="Notes complémentaires…"
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
                      onClick={() => savePointage("brouillon")}
                      disabled={!selectedCourseId || !!duplicateWarning}
                      className="flex items-center gap-2 px-5 py-2.5 border border-primary text-primary rounded-xl text-sm font-medium hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      <Save size={15} /> Enregistrer brouillon
                    </button>
                    <button
                      type="button"
                      onClick={() => savePointage("soumis")}
                      disabled={!selectedCourseId || !!duplicateWarning}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Send size={15} /> Soumettre
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
