import { useMemo, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useSeances } from "@/hooks/useStudentStore";
import { addTeacherAbsence, type TeacherAbsenceType } from "@/data/teacherAbsenceStore";
import { filterTeachers, teacherDisplayLabel, matchesProf, dateToJour, type EnseignantRecord } from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES]
  .sort((a, b) => b.libelle.localeCompare(a.libelle))
  .map((a) => a.libelle);

const DEFAULT_ANNEE =
  ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0] ?? "2025-2026";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function TeacherAbsenceFormPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const teacherIdParam = params.get("id") ?? "";

  const { currentUser } = useAuth();
  const seances = useSeances();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(teacherIdParam);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [anneeScolaire] = useState(DEFAULT_ANNEE);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [seanceId, setSeanceId] = useState("");
  const [type, setType] = useState<TeacherAbsenceType>("absence");
  const [dureeMinutes, setDureeMinutes] = useState("15");
  const [motif, setMotif] = useState("");
  const [justifie, setJustifie] = useState(false);

  const selected = teachers.find((t) => t.id === selectedId) ?? null;
  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  useEffect(() => {
    if (!teacherIdParam) return;
    setSelectedId(teacherIdParam);
    const t = teachers.find((x) => x.id === teacherIdParam);
    if (t) setQuery(teacherDisplayLabel(t));
  }, [teacherIdParam, teachers]);

  const matchingSeances = useMemo(() => {
    if (!selected) return [];
    const jour = dateToJour(date);
    return seances.filter(
      (s) => matchesProf(selected, s.prof) && s.jour === jour && s.annee === anneeScolaire,
    );
  }, [selected, seances, date, anneeScolaire]);

  useEffect(() => {
    if (seanceId && !matchingSeances.some((s) => s.id === seanceId)) {
      setSeanceId("");
    }
  }, [matchingSeances, seanceId]);

  const resetForm = () => {
    setSeanceId("");
    setType("absence");
    setDureeMinutes("15");
    setMotif("");
    setJustifie(false);
  };

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    resetForm();
    setLocation(`/admin/teachers/absence/new?id=${t.id}`);
  };

  const handleSubmit = () => {
    if (!selected) {
      toast.error("Sélectionnez un professeur");
      return;
    }
    const seance = matchingSeances.find((s) => s.id === seanceId);
    if (!seance) {
      toast.error("Sélectionnez la séance concernée");
      return;
    }
    if (!motif.trim()) {
      toast.error("Indiquez un motif");
      return;
    }
    const duree = type === "retard" ? Number(dureeMinutes) : undefined;
    if (type === "retard" && (!duree || duree <= 0)) {
      toast.error("Indiquez une durée de retard valide");
      return;
    }

    addTeacherAbsence({
      teacherId: selected.id,
      ecId: seance.ecId,
      classeId: seance.classeId,
      annee: anneeScolaire,
      seanceId: seance.id,
      date,
      type,
      dureeMinutes: duree,
      motif: motif.trim(),
      justifie,
      createdBy: currentUser?.name ?? "Admin",
    });

    toast.success(type === "absence" ? "Absence enregistrée" : "Retard enregistré");
    resetForm();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Nouveau constat" }]}
        title="Nouveau constat absence / retard"
        subtitle="Enregistrez l'absence ou le retard d'un professeur sur une séance prévue"
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
              data-testid="teacher-absence-search"
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
          Sélectionnez un professeur pour enregistrer une absence ou un retard
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
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
                  setSeanceId("");
                }}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Séance concernée <span className="text-red-500">*</span>
              </label>
              <select value={seanceId} onChange={(e) => setSeanceId(e.target.value)} className={inputClass} required>
                <option value="">— Sélectionner —</option>
                {matchingSeances.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.heureDebut}–{s.heureFin} — {s.ec} ({s.classe})
                  </option>
                ))}
              </select>
              {matchingSeances.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Aucune séance planifiée pour ce professeur à cette date.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("absence")}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                  type === "absence" ? "bg-red-600 text-white border-red-600" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                Absence
              </button>
              <button
                type="button"
                onClick={() => setType("retard")}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                  type === "retard" ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                Retard
              </button>
            </div>
          </div>

          {type === "retard" && (
            <div className="max-w-[220px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Durée du retard (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={5}
                value={dureeMinutes}
                onChange={(e) => setDureeMinutes(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Motif <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Circonstances constatées…"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={justifie} onChange={(e) => setJustifie(e.target.checked)} className="rounded" />
            Justifié(e)
          </label>

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
              <Save size={15} /> Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
