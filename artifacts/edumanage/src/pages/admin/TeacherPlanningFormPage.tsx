import { useMemo, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, AlertTriangle, Clock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { addSeance } from "@/data/studentStore";
import { useSeances } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { useTypesSeance } from "@/hooks/useScheduleSettingsStore";
import {
  matchesProf,
  minutesToHHMM,
  seanceDurationMinutes,
  teacherProfLabel,
  dateToJour,
  mondayOf,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

interface CourseOption {
  id: string;
  ecId: string;
  classeId: string;
  label: string;
  objet: string;
}

interface PlanningForm {
  courseKey: string;
  objet: string;
  salleId: string;
  date: string;
  type: string;
  heureDebut: string;
  heureFin: string;
  remarque?: string;
}

function buildCourseLabel(
  filiere: string,
  annee: string,
  ecLibelle: string,
  semestre: string,
): string {
  return [filiere && annee ? `${filiere}/${annee}` : filiere || annee, ecLibelle, semestre]
    .filter(Boolean)
    .join(" / ");
}

export default function TeacherPlanningFormPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const teacherId = params.get("teacherId") ?? "";
  const defaultDate = params.get("date") ?? new Date().toISOString().slice(0, 10);
  const defaultDebut = params.get("heureDebut") ?? "08:00";
  const defaultFin = params.get("heureFin") ?? "09:00";

  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const salles = useSalles();
  const typesSeance = useTypesSeance().filter((t) => t.categorie === "emploi_du_temps");
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const teacher = teachers.find((t) => t.id === teacherId) ?? null;
  const [courseQuery, setCourseQuery] = useState("");
  const [showCourseList, setShowCourseList] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const form = useForm<PlanningForm>({
    defaultValues: {
      courseKey: "",
      objet: "",
      salleId: salles[0]?.id ?? "",
      date: defaultDate,
      type: typesSeance[0]?.code ?? "CM",
      heureDebut: defaultDebut,
      heureFin: defaultFin,
      remarque: "",
    },
  });

  const values = form.watch();

  const courseOptions = useMemo((): CourseOption[] => {
    if (!teacher) return [];
    const seen = new Set<string>();
    const options: CourseOption[] = [];

    const pushOption = (ecId: string, classeId: string) => {
      const key = `${ecId}:${classeId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const ec = ecs.find((e) => e.id === ecId);
      const classe = classes.find((c) => c.id === classeId);
      const ue = ues.find((u) => u.id === ec?.ueId);
      if (!ec || !classe) return;
      options.push({
        id: key,
        ecId,
        classeId,
        label: buildCourseLabel(classe.filiere, classe.annee, ec.libelle, ue?.semestre ?? ""),
        objet: ec.libelle,
      });
    };

    for (const s of seances.filter((s) => matchesProf(teacher, s.prof))) {
      pushOption(s.ecId, s.classeId);
    }

    for (const ec of ecs) {
      if (!matchesProf(teacher, ec.responsable) && !ec.responsable.includes(teacher.nom)) continue;
      const ue = ues.find((u) => u.id === ec.ueId);
      for (const classe of classes.filter((c) => c.filiere === ue?.filiere)) {
        pushOption(ec.id, classe.id);
      }
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [teacher, seances, ecs, ues, classes]);

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return courseOptions;
    return courseOptions.filter(
      (c) => c.label.toLowerCase().includes(q) || c.objet.toLowerCase().includes(q),
    );
  }, [courseOptions, courseQuery]);

  const selectedCourse = courseOptions.find((c) => c.id === values.courseKey) ?? null;
  const selectedEc = ecs.find((e) => e.id === selectedCourse?.ecId);

  const volume = useMemo(() => {
    if (!teacher || !selectedEc) {
      return { global: 0, planifie: 0, reste: 0, globalLabel: "0", planifieLabel: "00:00", resteLabel: "00:00" };
    }
    const globalMins = selectedEc.vht * 60;
    const planifieMins = seances
      .filter((s) => s.ecId === selectedEc.id && matchesProf(teacher, s.prof))
      .reduce((sum, s) => sum + seanceDurationMinutes(s.heureDebut, s.heureFin), 0);
    const resteMins = Math.max(0, globalMins - planifieMins);
    return {
      global: selectedEc.vht,
      planifie: planifieMins,
      reste: resteMins,
      globalLabel: String(selectedEc.vht),
      planifieLabel: minutesToHHMM(planifieMins),
      resteLabel: minutesToHHMM(resteMins),
    };
  }, [teacher, selectedEc, seances]);

  useEffect(() => {
    if (selectedCourse) {
      form.setValue("objet", selectedCourse.objet);
      setCourseQuery(selectedCourse.label);
    }
  }, [selectedCourse, form]);

  const pickCourse = (course: CourseOption) => {
    form.setValue("courseKey", course.id);
    form.setValue("objet", course.objet);
    setCourseQuery(course.label);
    setShowCourseList(false);
  };

  const onSubmit = form.handleSubmit((data) => {
    if (!teacher || !selectedCourse) return;
    setConflicts([]);
    if (dateToJour(data.date) === 7) {
      setConflicts(["Aucun cours ne peut être planifié un dimanche — choisissez une date du lundi au samedi"]);
      return;
    }
    const result = addSeance({
      ecId: selectedCourse.ecId,
      classeId: selectedCourse.classeId,
      salleId: data.salleId,
      prof: teacherProfLabel(teacher),
      jour: dateToJour(data.date),
      semaineDu: mondayOf(data.date),
      heureDebut: data.heureDebut,
      heureFin: data.heureFin,
      type: data.type,
    });
    if (result.conflicts.length > 0) {
      setConflicts(result.conflicts.map((c) => c.label));
      return;
    }
    setLocation(`/admin/teachers/planning?id=${encodeURIComponent(teacher.id)}`);
  });

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  if (!teacher) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">Professeur introuvable</p>
        <button
          type="button"
          onClick={() => setLocation("/admin/teachers/planning")}
          className="text-primary hover:underline text-sm"
        >
          Retour au planning professeur
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Professeurs" },
          { label: "Planning professeur", href: `/admin/teachers/planning?id=${teacher.id}` },
          { label: "Nouvel emploi du temps" },
        ]}
        title="Nouvel emploi du temps"
        subtitle={`Professeur : ${teacher.matricule} — ${teacher.prenom} ${teacher.nom}`}
        actions={
          <button
            type="button"
            onClick={() => setLocation(`/admin/teachers/planning?id=${encodeURIComponent(teacher.id)}`)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour au planning
          </button>
        }
      />

      <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
        {conflicts.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <AlertTriangle size={16} /> Impossible d&apos;enregistrer — conflits détectés
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="bg-primary px-5 py-3 text-white text-sm font-semibold">
            Nouvel emploi du temps — Professeur : {teacher.matricule} — {teacher.prenom} {teacher.nom}
          </div>
          <div className="p-6 space-y-4">
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
                  if (!e.target.value.trim()) form.setValue("courseKey", "");
                }}
                onFocus={() => setShowCourseList(true)}
                placeholder="Rechercher un cours (filière / année / matière / semestre)…"
                className={inputClass}
                required={!values.courseKey}
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
                        c.id === values.courseKey && "bg-primary/5",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Objet <span className="text-red-500">*</span>
              </label>
              <input {...form.register("objet", { required: true })} className={inputClass} readOnly={!!selectedCourse} />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Salle de classe <span className="text-red-500">*</span>
              </label>
              <select {...form.register("salleId", { required: true })} className={inputClass}>
                <option value="">— Sélectionner —</option>
                {salles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} — {s.batiment} ({s.capacite} pl.)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Date <span className="text-red-500">*</span>
                </label>
                <input type="date" {...form.register("date", { required: true })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Type <span className="text-red-500">*</span>
                </label>
                <select {...form.register("type")} className={inputClass}>
                  {typesSeance.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.code} — {t.intitule}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  H. début <span className="text-red-500">*</span>
                </label>
                <input type="time" {...form.register("heureDebut", { required: true })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  H. fin <span className="text-red-500">*</span>
                </label>
                <input type="time" {...form.register("heureFin", { required: true })} className={inputClass} />
              </div>
            </div>
          </div>
        </section>

        {selectedEc && (
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Volume horaire
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Déjà planifié <span className="text-red-500">*</span>
                </label>
                <input readOnly value={volume.planifieLabel} className={`${inputClass} bg-muted/50`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Reste à planifier <span className="text-red-500">*</span>
                </label>
                <input readOnly value={volume.resteLabel} className={`${inputClass} bg-muted/50`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Globale</label>
                <input readOnly value={volume.globalLabel} className={`${inputClass} bg-muted/50`} />
              </div>
            </div>
            {volume.reste === 0 && (
              <p className="text-sm text-red-600 font-medium">
                Le volume horaire restant à planifier pour ce cours est égal à 0
              </p>
            )}
          </section>
        )}

        <section className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Remarque</label>
          <textarea {...form.register("remarque")} rows={3} className={inputClass} placeholder="Notes complémentaires…" />
        </section>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setLocation(`/admin/teachers/planning?id=${encodeURIComponent(teacher.id)}`)}
            className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!values.courseKey || volume.reste === 0}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  );
}
