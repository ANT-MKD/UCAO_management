import { useMemo, useEffect, useState } from "react";
import { Filter, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import {
  ENSEIGNANTS,
  FILIERES,
  NIVEAUX,
  SEMESTRES,
} from "@/data/mockData";
import {
  deleteTeacherAbsence,
  updateTeacherAbsence,
  type TeacherAbsenceRecord,
  type TeacherAbsenceType,
} from "@/data/teacherAbsenceStore";
import { useTeacherAbsences } from "@/hooks/useTeacherAbsenceStore";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { filterTeachers, teacherDisplayLabel, type EnseignantRecord } from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

type TypeFilter = "" | TeacherAbsenceType;
type JustifieFilter = "" | "oui" | "non";

interface AdvancedFilters {
  filiereId: string;
  annee: string;
  niveauId: string;
  classeId: string;
  semestreId: string;
  justifie: JustifieFilter;
  dateDebut: string;
  dateFin: string;
  teacherId: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  filiereId: "",
  annee: "",
  niveauId: "",
  classeId: "",
  semestreId: "",
  justifie: "",
  dateDebut: "",
  dateFin: "",
  teacherId: "",
};

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "absence", label: "Absences" },
  { key: "retard", label: "Retards" },
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function hasAnyCriterion(f: AdvancedFilters): boolean {
  return Object.values(f).some((v) => v !== "");
}

function isThisMonth(iso: string): boolean {
  const now = new Date();
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function TeacherAbsencePage() {
  const records = useTeacherAbsences();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );

  const [applied, setApplied] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [quickSearch, setQuickSearch] = useState("");
  const [typeTab, setTypeTab] = useState<TypeFilter>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherAbsenceRecord | null>(null);
  const [editType, setEditType] = useState<TeacherAbsenceType>("absence");
  const [editDuree, setEditDuree] = useState("15");
  const [editMotif, setEditMotif] = useState("");
  const [editJustifie, setEditJustifie] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeacherAbsenceRecord | null>(null);

  const matchesFilters = (
    r: TeacherAbsenceRecord,
    f: AdvancedFilters,
  ): boolean => {
    const teacher = teachers.find((t) => t.id === r.teacherId);
    const classe = classes.find((c) => c.id === r.classeId);
    const ec = ecs.find((e) => e.id === r.ecId);
    const ue = ues.find((u) => u.id === ec?.ueId);

    if (f.teacherId && r.teacherId !== f.teacherId) return false;
    if (f.annee && r.annee !== f.annee) return false;
    if (f.filiereId && classe?.filiereId !== f.filiereId) return false;
    if (f.niveauId) {
      const niveau = NIVEAUX.find((n) => n.id === f.niveauId);
      if (niveau && classe?.niveau !== niveau.alias) return false;
    }
    if (f.classeId && r.classeId !== f.classeId) return false;
    if (f.semestreId) {
      const semestre = SEMESTRES.find((s) => s.id === f.semestreId);
      if (semestre && ue?.semestre !== semestre.alias) return false;
    }
    if (f.justifie === "oui" && !r.justifie) return false;
    if (f.justifie === "non" && r.justifie) return false;
    if (f.dateDebut && r.date < f.dateDebut) return false;
    if (f.dateFin && r.date > f.dateFin) return false;
    if (!teacher || !classe) return false;
    return true;
  };

  const quickMatchIds = useMemo(() => {
    if (!quickSearch.trim()) return null;
    return new Set(filterTeachers(teachers, quickSearch).map((t) => t.id));
  }, [teachers, quickSearch]);

  const baseForTabs = useMemo(
    () =>
      records.filter(
        (r) => matchesFilters(r, applied) && (!quickMatchIds || quickMatchIds.has(r.teacherId)),
      ),
    [records, applied, quickMatchIds, teachers, classes, ecs, ues],
  );

  const tabCounts: Record<TypeFilter, number> = {
    "": baseForTabs.length,
    absence: baseForTabs.filter((r) => r.type === "absence").length,
    retard: baseForTabs.filter((r) => r.type === "retard").length,
  };

  const filtered = useMemo(
    () =>
      [...baseForTabs]
        .filter((r) => !typeTab || r.type === typeTab)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [baseForTabs, typeTab],
  );

  const absencesCeMois = records.filter((r) => r.type === "absence" && isThisMonth(r.createdAt)).length;
  const retardsCeMois = records.filter((r) => r.type === "retard" && isThisMonth(r.createdAt)).length;
  const hasActiveRefinement = hasAnyCriterion(applied) || quickSearch.trim() !== "" || typeTab !== "";

  const openEdit = (r: TeacherAbsenceRecord) => {
    setEditing(r);
    setEditType(r.type);
    setEditDuree(String(r.dureeMinutes ?? 15));
    setEditMotif(r.motif);
    setEditJustifie(r.justifie);
  };

  const handleEditSave = () => {
    if (!editing) return;
    if (!editMotif.trim()) {
      toast.error("Indiquez un motif");
      return;
    }
    const duree = editType === "retard" ? Number(editDuree) : undefined;
    if (editType === "retard" && (!duree || duree <= 0)) {
      toast.error("Indiquez une durée de retard valide");
      return;
    }
    updateTeacherAbsence(editing.id, {
      type: editType,
      dureeMinutes: duree,
      motif: editMotif.trim(),
      justifie: editJustifie,
    });
    toast.success("Constat mis à jour");
    setEditing(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTeacherAbsence(deleteTarget.id);
    toast.success("Constat supprimé");
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Absence / Retard" }]}
        title="Absence / Retard professeur"
        subtitle="Historique des absences et retards constatés sur les séances prévues"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="absence-recherche-avancee"
          >
            <Filter size={15} /> Recherche avancée
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="font-bold">{absencesCeMois}</span> absence{absencesCeMois > 1 ? "s" : ""} ce mois
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="font-bold">{retardsCeMois}</span> retard{retardsCeMois > 1 ? "s" : ""} ce mois
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Rechercher un professeur (nom, matricule)…"
            className={`${inputClass} pl-10`}
            data-testid="absence-quick-search"
          />
        </div>
        {hasActiveRefinement && (
          <button
            type="button"
            onClick={() => {
              setApplied(EMPTY_FILTERS);
              setQuickSearch("");
              setTypeTab("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TYPE_TABS.map((tab) => {
          const active = typeTab === tab.key;
          return (
            <button
              key={tab.key || "toutes"}
              type="button"
              onClick={() => setTypeTab(tab.key)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              data-testid={`absence-tab-${tab.key || "toutes"}`}
            >
              {tab.label} <span className="opacity-70">({tabCounts[tab.key]})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          {hasActiveRefinement
            ? "Aucun constat ne correspond aux critères sélectionnés."
            : "Aucune absence ou retard constaté pour le moment."}
        </div>
      ) : (
        <div
          className="bg-card border border-border rounded-xl overflow-x-auto"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Professeur</th>
                <th className="text-left px-4 py-3">Cours</th>
                <th className="text-left px-4 py-3">Classe</th>
                <th className="text-center px-3 py-3">Type</th>
                <th className="text-center px-3 py-3">Durée</th>
                <th className="text-left px-4 py-3">Motif</th>
                <th className="text-center px-3 py-3">Justifié</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const teacher = teachers.find((t) => t.id === r.teacherId);
                const classe = classes.find((c) => c.id === r.classeId);
                const ec = ecs.find((e) => e.id === r.ecId);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{teacher ? `${teacher.prenom} ${teacher.nom}` : r.teacherId}</p>
                      <p className="text-xs text-muted-foreground">{teacher?.matricule}</p>
                    </td>
                    <td className="px-4 py-3">{ec ? `${ec.code} — ${ec.libelle}` : r.ecId}</td>
                    <td className="px-4 py-3">
                      {classe?.nom ?? r.classeId}
                      <p className="text-xs text-muted-foreground">{classe?.filiere} · {classe?.niveau}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          r.type === "absence" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {r.type === "absence" ? "Absence" : "Retard"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">{r.type === "retard" ? `${r.dureeMinutes} min` : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.motif}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          r.justifie ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {r.justifie ? "Oui" : "Non"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted"
                          aria-label="Modifier"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AdvancedSearchModal
          teachers={teachers}
          classes={classes}
          initial={applied}
          onClose={() => setModalOpen(false)}
          onApply={(next) => {
            setApplied(next);
            setModalOpen(false);
          }}
        />
      )}

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Modifier le constat"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditType("absence")}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                editType === "absence" ? "bg-red-600 text-white border-red-600" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Absence
            </button>
            <button
              type="button"
              onClick={() => setEditType("retard")}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                editType === "retard" ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Retard
            </button>
          </div>
          {editType === "retard" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Durée du retard (minutes)</label>
              <input
                type="number"
                min={1}
                step={5}
                value={editDuree}
                onChange={(e) => setEditDuree(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motif</label>
            <textarea
              value={editMotif}
              onChange={(e) => setEditMotif(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editJustifie} onChange={(e) => setEditJustifie(e.target.checked)} className="rounded" />
            Justifié(e)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleEditSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Enregistrer
            </button>
          </div>
        </div>
      </FormModal>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1">Supprimer ce constat ?</h2>
            <p className="text-xs text-muted-foreground mb-4">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdvancedSearchModal({
  teachers,
  classes,
  initial,
  onClose,
  onApply,
}: {
  teachers: EnseignantRecord[];
  classes: { id: string; nom: string; filiereId: string; niveau: string; annee: string }[];
  initial: AdvancedFilters;
  onClose: () => void;
  onApply: (filters: AdvancedFilters) => void;
}) {
  const [draft, setDraft] = useState<AdvancedFilters>(initial);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );

  useEffect(() => {
    const t = teachers.find((x) => x.id === draft.teacherId);
    if (t) setTeacherQuery(teacherDisplayLabel(t));
  }, []);

  const filteredNiveaux = useMemo(() => {
    if (!draft.filiereId) return [];
    return NIVEAUX.filter((n) => n.filiereId === draft.filiereId);
  }, [draft.filiereId]);

  const filteredClasses = useMemo(() => {
    if (!draft.niveauId) return [];
    const niveau = NIVEAUX.find((n) => n.id === draft.niveauId);
    if (!niveau) return [];
    return classes.filter((c) => {
      if (c.niveau !== niveau.alias) return false;
      if (draft.filiereId && c.filiereId !== draft.filiereId) return false;
      if (draft.annee && c.annee !== draft.annee) return false;
      return true;
    });
  }, [classes, draft.niveauId, draft.filiereId, draft.annee]);

  const filteredSemestres = useMemo(() => {
    if (!draft.niveauId) return [];
    return SEMESTRES.filter((s) => s.niveauId === draft.niveauId);
  }, [draft.niveauId]);

  const suggestions = useMemo(
    () => filterTeachers(teachers, teacherQuery).slice(0, 8),
    [teachers, teacherQuery],
  );

  const patch = (partial: Partial<AdvancedFilters>) => setDraft((d) => ({ ...d, ...partial }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Recherche avancée</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Filtrer les absences / retards</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
              <select
                value={draft.filiereId}
                onChange={(e) =>
                  patch({ filiereId: e.target.value, niveauId: "", classeId: "", semestreId: "" })
                }
                className={inputClass}
              >
                <option value="">— Sélectionner —</option>
                {FILIERES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom} ({f.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique</label>
              <select
                value={draft.annee}
                onChange={(e) => patch({ annee: e.target.value, classeId: "" })}
                className={inputClass}
              >
                <option value="">— Sélectionner —</option>
                {anneeOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveaux</label>
              <select
                value={draft.niveauId}
                onChange={(e) => patch({ niveauId: e.target.value, classeId: "" })}
                className={inputClass}
                disabled={!draft.filiereId}
              >
                <option value="">— Sélectionner —</option>
                {filteredNiveaux.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nom} ({n.alias})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
              <select
                value={draft.classeId}
                onChange={(e) => patch({ classeId: e.target.value })}
                className={inputClass}
                disabled={!draft.niveauId}
              >
                <option value="">— Sélectionner —</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Semestre</label>
              <select
                value={draft.semestreId}
                onChange={(e) => patch({ semestreId: e.target.value })}
                className={inputClass}
                disabled={!draft.niveauId}
              >
                <option value="">— Sélectionner —</option>
                {filteredSemestres.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.alias})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Justifié</label>
              <select
                value={draft.justifie}
                onChange={(e) => patch({ justifie: e.target.value as JustifieFilter })}
                className={inputClass}
              >
                <option value="">— Tous —</option>
                <option value="oui">Justifié</option>
                <option value="non">Non justifié</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de début</label>
              <input
                type="date"
                value={draft.dateDebut}
                onChange={(e) => patch({ dateDebut: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de fin</label>
              <input
                type="date"
                value={draft.dateFin}
                onChange={(e) => patch({ dateFin: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Professeur</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
              <input
                type="search"
                value={teacherQuery}
                onChange={(e) => {
                  setTeacherQuery(e.target.value);
                  setShowSuggestions(true);
                  if (!e.target.value.trim()) patch({ teacherId: "" });
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Matricule, prénom, nom ou téléphone…"
                className={`${inputClass} pl-10`}
              />
              {showSuggestions && suggestions.length > 0 && teacherQuery.trim().length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {suggestions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        patch({ teacherId: t.id });
                        setTeacherQuery(teacherDisplayLabel(t));
                        setShowSuggestions(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 text-left text-sm hover:bg-muted",
                        t.id === draft.teacherId && "bg-primary/5",
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

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setTeacherQuery("");
            }}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Effacer critères
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90"
            >
              Filtrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
