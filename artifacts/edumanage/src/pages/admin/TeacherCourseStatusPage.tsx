import { useMemo, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useSeances, useCahiers } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { useTeacherCourseStatuses } from "@/hooks/useTeacherCourseStatusStore";
import { usePointages } from "@/hooks/usePointageStore";
import { makeTeacherVolumeId, getTeacherVolume } from "@/data/teacherVolumeStore";
import {
  getTeacherCourseStatus,
  makeTeacherCourseStatusId,
  upsertTeacherCourseStatuses,
  type TeacherCourseStatusRecord,
  type TypeComptabilisation,
} from "@/data/teacherCourseStatusStore";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import {
  filterTeachers,
  teacherDisplayLabel,
  computeVhPointe,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

interface EditableRow {
  courseId: string;
  ecId: string;
  classeId: string;
  filiereLabel: string;
  coursLabel: string;
  detailsLabel: string;
  vhPointe: number;
  vhTotal: number;
  typeComptabilisation: TypeComptabilisation;
}

const COMPTA_OPTIONS: { value: TypeComptabilisation; label: string }[] = [
  { value: "", label: "— Sélectionner —" },
  { value: "normal", label: "Normal" },
  { value: "a_terme", label: "A terme" },
];

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES]
  .sort((a, b) => b.libelle.localeCompare(a.libelle))
  .map((a) => a.libelle);

const DEFAULT_ANNEE =
  ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0] ?? "2025-2026";

export default function TeacherCourseStatusPage() {
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
  const savedVolumes = useTeacherVolumes();
  const savedStatuses = useTeacherCourseStatuses();
  const pointages = usePointages();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(teacherIdParam);
  const [anneeScolaire, setAnneeScolaire] = useState(anneeParam || DEFAULT_ANNEE);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);

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

  useEffect(() => {
    if (!selected) {
      setRows([]);
      return;
    }
    setRows(
      courseItems.map((c) => {
        const statusId = makeTeacherCourseStatusId(selected.id, c.ecId, c.classeId, anneeScolaire);
        const volumeId = makeTeacherVolumeId(selected.id, c.ecId, c.classeId, anneeScolaire);
        const savedVolume = savedVolumes.find((r) => r.id === volumeId) ?? getTeacherVolume(volumeId);
        const savedStatus =
          savedStatuses.find((r) => r.id === statusId) ?? getTeacherCourseStatus(statusId);
        const vhTotal = savedVolume?.nouveauVh ?? c.volumeHoraire;
        const vhPointe = computeVhPointe(
          selected,
          c.ecId,
          c.classeId,
          anneeScolaire,
          cahiers,
          seances,
          pointages,
        );
        return {
          courseId: c.id,
          ecId: c.ecId,
          classeId: c.classeId,
          filiereLabel: c.filiereLabel,
          coursLabel: c.coursLabel,
          detailsLabel: c.detailsLabel,
          vhPointe,
          vhTotal,
          typeComptabilisation: savedStatus?.typeComptabilisation ?? "normal",
        };
      }),
    );
  }, [selected, courseItems, savedStatuses, savedVolumes, anneeScolaire, cahiers, seances, pointages]);

  const syncUrl = (teacherId: string, annee: string) => {
    const qs = new URLSearchParams();
    if (teacherId) qs.set("id", teacherId);
    if (annee) qs.set("annee", annee);
    setLocation(`/admin/teachers/course-status?${qs.toString()}`);
  };

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    syncUrl(t.id, anneeScolaire);
  };

  const handleAnneeChange = (annee: string) => {
    setAnneeScolaire(annee);
    if (selectedId) syncUrl(selectedId, annee);
  };

  const updateRow = (courseId: string, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r) => (r.courseId === courseId ? { ...r, ...patch } : r)));
  };

  const handleSave = () => {
    if (!selected) return;
    const records: TeacherCourseStatusRecord[] = rows.map((r) => ({
      id: makeTeacherCourseStatusId(selected.id, r.ecId, r.classeId, anneeScolaire),
      teacherId: selected.id,
      ecId: r.ecId,
      classeId: r.classeId,
      annee: anneeScolaire,
      typeComptabilisation: r.typeComptabilisation,
    }));
    upsertTeacherCourseStatuses(records);
    toast.success("Statuts cours enregistrés");
  };

  const inputClass =
    "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Mise à jour statut cours" }]}
        title="Mise à jour statut cours"
        subtitle="Sélectionnez un professeur pour gérer le statut de comptabilisation par cours"
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
              placeholder="Veuillez saisir le matricule, le prénom, le nom ou le numéro de téléphone du professeur…"
              className={`${inputClass} pl-10`}
              data-testid="teacher-status-search"
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
          Sélectionnez un professeur pour afficher ses cours
        </div>
      ) : (
        <>
          <div className="bg-muted/60 border border-border rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              {selected.matricule} — {selected.prenom} {selected.nom}
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="annee-scolaire-statut" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Choix année scolaire
              </label>
              <select
                id="annee-scolaire-statut"
                value={anneeScolaire}
                onChange={(e) => handleAnneeChange(e.target.value)}
                className={`${inputClass} min-w-[140px]`}
                data-testid="teacher-status-annee"
              >
                {ANNEE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="bg-card border border-border border-t-0 rounded-b-xl py-16 text-center text-sm text-muted-foreground">
              Aucun cours associé à ce professeur pour l&apos;année {anneeScolaire}
            </div>
          ) : (
            <div
              className="bg-card border border-border border-t-0 rounded-b-xl overflow-x-auto"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3 w-[50%]">Cours</th>
                    <th className="text-center px-3 py-3 w-[20%]">V. H. pointé / V. H. total</th>
                    <th className="text-left px-3 py-3 w-[30%]">Type de comptabilisation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.courseId} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-4">
                        <p className="font-bold text-foreground text-sm leading-snug">{row.filiereLabel}</p>
                        <p className="text-primary font-medium text-sm mt-1">{row.coursLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">{row.detailsLabel}</p>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="font-semibold text-foreground">
                          {row.vhPointe > 0 ? row.vhPointe : "—"} / {row.vhTotal}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <select
                          value={row.typeComptabilisation}
                          onChange={(e) =>
                            updateRow(row.courseId, {
                              typeComptabilisation: e.target.value as TypeComptabilisation,
                            })
                          }
                          className={inputClass}
                        >
                          {COMPTA_OPTIONS.map((o) => (
                            <option key={o.value || "empty"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Save size={15} /> Sauvegarder
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
