import { useMemo, useEffect, useState } from "react";
import { Check, Filter, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  ENSEIGNANTS,
  FILIERES,
  NIVEAUX,
  SEMESTRES,
} from "@/data/mockData";
import { updateRallongeStatut, type RallongeRecord, type RallongeStatut } from "@/data/rallongeStore";
import { useRallonges } from "@/hooks/useRallongeStore";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import {
  filterTeachers,
  teacherDisplayLabel,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

type TraitementStatut = "" | RallongeStatut;

interface AdvancedFilters {
  filiereId: string;
  annee: string;
  niveauId: string;
  classeId: string;
  semestreId: string;
  statut: TraitementStatut;
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
  dateDebut: "",
  dateFin: "",
  teacherId: "",
};

const STATUT_LABEL: Record<RallongeStatut, string> = {
  soumis: "En attente",
  valide: "Validée",
  rejete: "Rejetée",
};

const STATUT_CLS: Record<RallongeStatut, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
};

const ORIGINE_LABEL: Record<RallongeRecord["origine"], string> = {
  prof: "Professeur",
  admin: "Admin",
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

export default function TeacherRallongeTraitementPage() {
  const rallonges = useRallonges();
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
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [motifRejet, setMotifRejet] = useState("");

  const matchesFilters = (
    r: RallongeRecord,
    f: AdvancedFilters,
    opts: { skipStatut?: boolean } = {},
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
    if (!opts.skipStatut && f.statut && r.statut !== f.statut) return false;
    const createdDate = r.createdAt.slice(0, 10);
    if (f.dateDebut && createdDate < f.dateDebut) return false;
    if (f.dateFin && createdDate > f.dateFin) return false;
    if (!teacher || !classe) return false;
    return true;
  };

  const quickMatchIds = useMemo(() => {
    if (!quickSearch.trim()) return null;
    return new Set(filterTeachers(teachers, quickSearch).map((t) => t.id));
  }, [teachers, quickSearch]);

  // Toutes les demandes respectant les filtres avancés, hors statut — sert de
  // base aux compteurs des onglets rapides.
  const baseForTabs = useMemo(
    () =>
      rallonges.filter(
        (r) =>
          matchesFilters(r, applied, { skipStatut: true }) &&
          (!quickMatchIds || quickMatchIds.has(r.teacherId)),
      ),
    [rallonges, applied, quickMatchIds, teachers, classes, ecs, ues],
  );

  const tabCounts: Record<TraitementStatut, number> = {
    "": baseForTabs.length,
    soumis: baseForTabs.filter((r) => r.statut === "soumis").length,
    valide: baseForTabs.filter((r) => r.statut === "valide").length,
    rejete: baseForTabs.filter((r) => r.statut === "rejete").length,
  };

  const filtered = useMemo(() => {
    const order: Record<RallongeStatut, number> = { soumis: 0, valide: 1, rejete: 2 };
    return baseForTabs
      .filter((r) => !applied.statut || r.statut === applied.statut)
      .sort((a, b) => {
        const byStatut = order[a.statut] - order[b.statut];
        return byStatut !== 0 ? byStatut : b.createdAt.localeCompare(a.createdAt);
      });
  }, [baseForTabs, applied.statut]);

  const pendingCount = rallonges.filter((r) => r.statut === "soumis").length;
  const hasActiveRefinement = hasAnyCriterion(applied) || quickSearch.trim() !== "";

  const handleValidate = (id: string) => {
    updateRallongeStatut(id, "valide");
    toast.success("Rallonge validée — le V.H du cours a été mis à jour");
  };

  const handleReject = () => {
    if (!rejectId) return;
    if (!motifRejet.trim()) {
      toast.error("Indiquez un motif de rejet");
      return;
    }
    updateRallongeStatut(rejectId, "rejete", motifRejet.trim());
    toast.success("Demande rejetée");
    setRejectId(null);
    setMotifRejet("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Traitement rallonge" }]}
        title="Traitement rallonge"
        subtitle="Validez ou rejetez les demandes de rallonge de volume horaire"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="rallonge-recherche-avancee"
          >
            <Filter size={15} /> Recherche avancée
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="font-bold">{pendingCount}</span> demande{pendingCount > 1 ? "s" : ""} en attente
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Rechercher un professeur (nom, matricule)…"
            className={`${inputClass} pl-10`}
            data-testid="rallonge-quick-search"
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
              data-testid={`rallonge-tab-${tab.key || "toutes"}`}
            >
              {tab.label} <span className="opacity-70">({tabCounts[tab.key]})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          {hasActiveRefinement
            ? "Aucune demande ne correspond aux critères sélectionnés."
            : "Aucune demande de rallonge pour le moment."}
        </div>
      ) : (
        <div
          className="bg-card border border-border rounded-xl overflow-x-auto"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Professeur</th>
                <th className="text-left px-4 py-3">Cours</th>
                <th className="text-left px-4 py-3">Classe</th>
                <th className="text-center px-3 py-3">Origine</th>
                <th className="text-center px-3 py-3">V.H actuel</th>
                <th className="text-center px-3 py-3">Rallonge</th>
                <th className="text-center px-3 py-3">Nouveau V.H</th>
                <th className="text-center px-3 py-3">Statut</th>
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
                    <td className="px-4 py-3 whitespace-nowrap">{r.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {teacher ? `${teacher.prenom} ${teacher.nom}` : r.teacherId}
                      </p>
                      <p className="text-xs text-muted-foreground">{teacher?.matricule}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : r.ecId}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.motif}</p>
                    </td>
                    <td className="px-4 py-3">
                      {classe?.nom ?? r.classeId}
                      <p className="text-xs text-muted-foreground">{classe?.filiere} · {classe?.niveau}</p>
                    </td>
                    <td className="px-3 py-3 text-center">{ORIGINE_LABEL[r.origine]}</td>
                    <td className="px-3 py-3 text-center font-medium">{r.vhActuel} h</td>
                    <td className="px-3 py-3 text-center font-semibold text-primary">+{r.vhSupplementaire} h</td>
                    <td className="px-3 py-3 text-center font-semibold">{r.vhActuel + r.vhSupplementaire} h</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[r.statut])}>
                        {STATUT_LABEL[r.statut]}
                      </span>
                      {r.statut === "rejete" && r.motifRejet && (
                        <p className="text-[11px] text-red-600 mt-1">{r.motifRejet}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.statut === "soumis" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleValidate(r.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Check size={12} /> Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectId(r.id);
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
            <h2 className="text-base font-semibold mb-1">Rejeter la demande</h2>
            <p className="text-xs text-muted-foreground mb-4">Le motif sera visible par le professeur.</p>
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
            <p className="text-xs text-muted-foreground mt-0.5">Filtrer les demandes de rallonge</p>
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
