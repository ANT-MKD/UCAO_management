import { useEffect, useMemo, useState } from "react";
import { Check, Filter, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  ANNEES_ACADEMIQUES,
  ENSEIGNANTS,
  FILIERES,
  NIVEAUX,
  SEMESTRES,
} from "@/data/mockData";
import { updatePointageStatut, type PointageRecord, type PointageStatut } from "@/data/pointageStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import {
  filterTeachers,
  teacherDisplayLabel,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

type TraitementStatut = "" | "soumis" | "valide" | "rejete";

interface AdvancedFilters {
  filiereId: string;
  annee: string;
  niveauId: string;
  classeId: string;
  semestreId: string;
  statut: TraitementStatut;
  anneeAcademique: string;
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
  statut: "",
  anneeAcademique: "",
  dateDebut: "",
  dateFin: "",
  teacherId: "",
};

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES]
  .sort((a, b) => b.libelle.localeCompare(a.libelle))
  .map((a) => a.libelle);

const STATUT_LABEL: Record<Exclude<TraitementStatut, "">, string> = {
  soumis: "En attente",
  valide: "Validée",
  rejete: "Rejetée",
};

const STATUT_CLS: Record<string, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
  brouillon: "bg-slate-100 text-slate-600",
};

const STATUT_TABS: { key: TraitementStatut; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "soumis", label: "En attente" },
  { key: "valide", label: "Validées" },
  { key: "rejete", label: "Rejetées" },
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function hasAnyCriterion(f: AdvancedFilters): boolean {
  return Object.values(f).some((v) => v !== "");
}

export default function TeacherPointageTraitementPage() {
  const pointages = usePointages();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const salles = useSalles();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [applied, setApplied] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [quickSearch, setQuickSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [motifRejet, setMotifRejet] = useState("");

  const treatable = useMemo(
    () => pointages.filter((p) => p.statut !== "brouillon"),
    [pointages],
  );

  const matchesFilters = (
    p: PointageRecord,
    f: AdvancedFilters,
    opts: { skipStatut?: boolean } = {},
  ): boolean => {
    const teacher = teachers.find((t) => t.id === p.teacherId);
    const classe = classes.find((c) => c.id === p.classeId);
    const ec = ecs.find((e) => e.id === p.ecId);
    const ue = ues.find((u) => u.id === ec?.ueId);

    if (f.teacherId && p.teacherId !== f.teacherId) return false;
    if (f.anneeAcademique && p.annee !== f.anneeAcademique) return false;
    if (f.annee && classe?.annee !== f.annee && p.annee !== f.annee) return false;
    if (f.filiereId && classe?.filiereId !== f.filiereId) return false;
    if (f.niveauId) {
      const niveau = NIVEAUX.find((n) => n.id === f.niveauId);
      if (niveau && classe?.niveau !== niveau.alias) return false;
    }
    if (f.classeId && p.classeId !== f.classeId) return false;
    if (f.semestreId) {
      const semestre = SEMESTRES.find((s) => s.id === f.semestreId);
      if (semestre && ue?.semestre !== semestre.alias) return false;
    }
    if (!opts.skipStatut && f.statut && p.statut !== f.statut) return false;
    if (f.dateDebut && p.date < f.dateDebut) return false;
    if (f.dateFin && p.date > f.dateFin) return false;
    if (!teacher || !classe) return false;
    return true;
  };

  const quickMatchIds = useMemo(() => {
    if (!quickSearch.trim()) return null;
    return new Set(filterTeachers(teachers, quickSearch).map((t) => t.id));
  }, [teachers, quickSearch]);

  // Tous les pointages traitables respectant les filtres avancés, hors statut —
  // sert de base aux compteurs des onglets rapides.
  const baseForTabs = useMemo(
    () =>
      treatable.filter(
        (p) =>
          matchesFilters(p, applied, { skipStatut: true }) &&
          (!quickMatchIds || quickMatchIds.has(p.teacherId)),
      ),
    [treatable, applied, quickMatchIds, teachers, classes, ecs, ues],
  );

  const tabCounts: Record<TraitementStatut, number> = {
    "": baseForTabs.length,
    soumis: baseForTabs.filter((p) => p.statut === "soumis").length,
    valide: baseForTabs.filter((p) => p.statut === "valide").length,
    rejete: baseForTabs.filter((p) => p.statut === "rejete").length,
  };

  const filtered = useMemo(() => {
    const order: Record<PointageStatut, number> = { soumis: 0, valide: 1, rejete: 2, brouillon: 3 };
    return baseForTabs
      .filter((p) => !applied.statut || p.statut === applied.statut)
      .sort((a, b) => {
        const byStatut = order[a.statut] - order[b.statut];
        return byStatut !== 0 ? byStatut : b.date.localeCompare(a.date);
      });
  }, [baseForTabs, applied.statut]);

  const pendingCount = pointages.filter((p) => p.statut === "soumis").length;
  const hasActiveRefinement = hasAnyCriterion(applied) || quickSearch.trim() !== "";

  const handleValidate = (id: string) => {
    updatePointageStatut(id, "valide");
    toast.success("Pointage validé");
  };

  const handleReject = () => {
    if (!rejectId) return;
    if (!motifRejet.trim()) {
      toast.error("Indiquez un motif de rejet");
      return;
    }
    updatePointageStatut(rejectId, "rejete", motifRejet.trim());
    toast.success("Pointage rejeté");
    setRejectId(null);
    setMotifRejet("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Traitement pointage" }]}
        title="Traitement pointage"
        subtitle="Validez ou rejetez les heures pointées par l'administration"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="pointage-recherche-avancee"
          >
            <Filter size={15} /> Recherche avancée
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="font-bold">{pendingCount}</span> pointage{pendingCount > 1 ? "s" : ""} en attente
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Rechercher un professeur (nom, matricule)…"
            className={`${inputClass} pl-10`}
            data-testid="pointage-quick-search"
          />
        </div>
        {hasActiveRefinement && (
          <button
            type="button"
            onClick={() => {
              setApplied(EMPTY_FILTERS);
              setQuickSearch("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUT_TABS.map((tab) => {
          const active = applied.statut === tab.key;
          return (
            <button
              key={tab.key || "toutes"}
              type="button"
              onClick={() => setApplied((a) => ({ ...a, statut: tab.key }))}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              data-testid={`pointage-tab-${tab.key || "toutes"}`}
            >
              {tab.label} <span className="opacity-70">({tabCounts[tab.key]})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          {hasActiveRefinement
            ? "Aucun pointage ne correspond aux critères sélectionnés."
            : "Aucun pointage à traiter pour le moment."}
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
                <th className="text-center px-3 py-3">Horaires</th>
                <th className="text-center px-3 py-3">V.H</th>
                <th className="text-center px-3 py-3">Statut</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const teacher = teachers.find((t) => t.id === p.teacherId);
                const classe = classes.find((c) => c.id === p.classeId);
                const ec = ecs.find((e) => e.id === p.ecId);
                const salle = salles.find((s) => s.id === p.salleId);
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{p.date}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {teacher ? `${teacher.prenom} ${teacher.nom}` : p.teacherId}
                      </p>
                      <p className="text-xs text-muted-foreground">{teacher?.matricule}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : p.ecId}</p>
                      {salle && <p className="text-xs text-muted-foreground">{salle.nom}</p>}
                      {p.remarque && (
                        <p className="text-xs text-muted-foreground mt-1">{p.remarque}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {classe?.nom ?? p.classeId}
                      <p className="text-xs text-muted-foreground">{classe?.filiere} · {classe?.niveau}</p>
                    </td>
                    <td className="px-3 py-3 text-center font-medium">{p.type}</td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {p.heureDebut} – {p.heureFin}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold">{p.volumePointe} h</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[p.statut])}>
                        {STATUT_LABEL[p.statut as Exclude<TraitementStatut, "">] ?? p.statut}
                      </span>
                      {p.statut === "rejete" && p.motifRejet && (
                        <p className="text-[11px] text-red-600 mt-1">{p.motifRejet}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.statut === "soumis" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleValidate(p.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Check size={12} /> Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectId(p.id);
                              setMotifRejet("");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <X size={12} /> Rejeter
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectId(null)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1">Rejeter le pointage</h2>
            <p className="text-xs text-muted-foreground mb-4">Le motif sera visible dans la liste de traitement.</p>
            <textarea
              value={motifRejet}
              onChange={(e) => setMotifRejet(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Motif du rejet…"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
              >
                Confirmer le rejet
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

  useEffect(() => {
    if (!draft.niveauId) {
      if (draft.semestreId) setDraft((d) => ({ ...d, semestreId: "" }));
      return;
    }
    const match = SEMESTRES.filter((s) => s.niveauId === draft.niveauId);
    const preferred = match.find((s) => s.statut === "actif") ?? match[0];
    if (preferred && draft.semestreId !== preferred.id) {
      const stillValid = match.some((s) => s.id === draft.semestreId);
      if (!stillValid) {
        setDraft((d) => ({ ...d, semestreId: preferred.id }));
      }
    }
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
            <p className="text-xs text-muted-foreground mt-0.5">Filtrer les pointages à traiter</p>
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
                  patch({
                    filiereId: e.target.value,
                    niveauId: "",
                    classeId: "",
                    semestreId: "",
                  })
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année</label>
              <select
                value={draft.annee}
                onChange={(e) => patch({ annee: e.target.value, classeId: "" })}
                className={inputClass}
              >
                <option value="">— Sélectionner —</option>
                {ANNEE_OPTIONS.map((a) => (
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut</label>
              <select
                value={draft.statut}
                onChange={(e) => patch({ statut: e.target.value as TraitementStatut })}
                className={inputClass}
              >
                <option value="">— Sélectionner —</option>
                <option value="soumis">En attente</option>
                <option value="valide">Validée</option>
                <option value="rejete">Rejetée</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique</label>
              <select
                value={draft.anneeAcademique}
                onChange={(e) => patch({ anneeAcademique: e.target.value })}
                className={inputClass}
              >
                <option value="">— Sélectionner —</option>
                {ANNEE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted"
            >
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
