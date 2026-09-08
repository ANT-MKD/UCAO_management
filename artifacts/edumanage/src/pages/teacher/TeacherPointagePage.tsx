import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Clock3, CheckCircle2, Clock, XCircle, Search, CalendarClock, Download, MapPin, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePointages } from "@/hooks/usePointageStore";
import type { PointageStatut } from "@/data/pointageStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { KPICard } from "@/components/admin/KPICard";
import { exportPointagesToExcel } from "@/lib/pointageExport";
import { cn, formatDate } from "@/lib/utils";

const STATUT_LABEL: Record<PointageStatut, string> = {
  brouillon: "Brouillon",
  soumis: "Soumis",
  valide: "Validé",
  rejete: "Rejeté",
};

const STATUT_CLS: Record<PointageStatut, string> = {
  brouillon: "bg-muted text-muted-foreground",
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
};

const STATUT_ICON: Record<PointageStatut, React.ElementType> = {
  brouillon: Clock,
  soumis: Clock,
  valide: CheckCircle2,
  rejete: XCircle,
};

/** Lecture seule des vrais pointages (pointageStore.ts) déclarés par l'administration pour ce
 * professeur — la validation/rejet reste un acte administratif (TeacherPointageTraitementPage) ;
 * l'enseignant vient ici uniquement suivre le statut réel de chaque séance pointée. */
export default function TeacherPointagePage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const pointages = usePointages();
  const ecs = useEcs();
  const classes = useClasses();
  const salles = useSalles();

  const mine = useMemo(
    () => pointages.filter((p) => p.teacherId === currentUser?.linkedId).sort((a, b) => b.date.localeCompare(a.date)),
    [pointages, currentUser?.linkedId],
  );

  const [query, setQuery] = useState("");
  const [ecFiltre, setEcFiltre] = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [classeFiltre, setClasseFiltre] = useState("");
  const [typeSeanceFiltre, setTypeSeanceFiltre] = useState("");
  const [salleFiltre, setSalleFiltre] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [filtresAvancesOuverts, setFiltresAvancesOuverts] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const valides = mine.filter((p) => p.statut === "valide").length;
  const soumis = mine.filter((p) => p.statut === "soumis").length;
  const rejetes = mine.filter((p) => p.statut === "rejete").length;
  const heuresValidees = mine.filter((p) => p.statut === "valide").reduce((s, p) => s + p.volumePointe, 0);

  const mesEcsIds = useMemo(() => Array.from(new Set(mine.map((p) => p.ecId))), [mine]);
  const mesClasseIds = useMemo(() => Array.from(new Set(mine.map((p) => p.classeId))), [mine]);
  const mesSalleIds = useMemo(() => Array.from(new Set(mine.map((p) => p.salleId))), [mine]);
  const typesSeance = useMemo(() => Array.from(new Set(mine.map((p) => p.type))), [mine]);

  const filtresActifs = [query, ecFiltre, statutFiltre, classeFiltre, typeSeanceFiltre, salleFiltre, dateDebut, dateFin].some(Boolean);

  function reinitialiserFiltres() {
    setQuery("");
    setEcFiltre("");
    setStatutFiltre("");
    setClasseFiltre("");
    setTypeSeanceFiltre("");
    setSalleFiltre("");
    setDateDebut("");
    setDateFin("");
  }

  function contexteDe(p: (typeof mine)[number]) {
    const ec = ecs.find((e) => e.id === p.ecId);
    const classe = classes.find((c) => c.id === p.classeId);
    const salle = salles.find((s) => s.id === p.salleId);
    return {
      coursLabel: ec ? `${ec.code} — ${ec.libelle}` : p.ecId,
      classeLabel: classe?.nom ?? "—",
      salleLabel: salle?.nom ?? "—",
    };
  }

  const filtrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((p) => {
      if (ecFiltre && p.ecId !== ecFiltre) return false;
      if (statutFiltre && p.statut !== statutFiltre) return false;
      if (classeFiltre && p.classeId !== classeFiltre) return false;
      if (typeSeanceFiltre && p.type !== typeSeanceFiltre) return false;
      if (salleFiltre && p.salleId !== salleFiltre) return false;
      if (dateDebut && p.date < dateDebut) return false;
      if (dateFin && p.date > dateFin) return false;
      if (q) {
        const { coursLabel, classeLabel, salleLabel } = contexteDe(p);
        if (!`${coursLabel} ${classeLabel} ${salleLabel}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [mine, query, ecFiltre, statutFiltre, classeFiltre, typeSeanceFiltre, salleFiltre, dateDebut, dateFin, ecs, classes, salles]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = mine.find((p) => p.id === selectedId) ?? mine[0] ?? null;

  function handleExport() {
    if (filtrees.length === 0) {
      toast.error("Aucun pointage à exporter.");
      return;
    }
    exportPointagesToExcel(filtrees, filtrees.map(contexteDe));
    toast.success("Export Excel généré.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon pointage</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivi des heures pointées pour vos cours et leur statut de validation.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted"
            data-testid="teacher-pointage-exporter"
          >
            <Download size={15} /> Exporter
          </button>
          <button
            type="button"
            onClick={() => setLocation("/teacher/schedule")}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted"
          >
            <CalendarClock size={15} /> Voir mon planning
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={Clock3} label="Heures validées" value={`${heuresValidees} h`} accentColor="#10b981" />
        <KPICard icon={Clock} label="En attente" value={soumis} accentColor="#f59e0b" />
        <KPICard icon={CheckCircle2} label="Validés" value={valides} accentColor="#2563eb" />
        <KPICard icon={XCircle} label="Rejetés" value={rejetes} accentColor={rejetes > 0 ? "#ef4444" : "#10b981"} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Clock3 size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun pointage enregistré pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un cours, une classe, une salle…"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-pointage-recherche"
                  />
                </div>
                <select
                  value={statutFiltre}
                  onChange={(e) => setStatutFiltre(e.target.value)}
                  className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="teacher-pointage-filtre-statut"
                >
                  <option value="">Tous les statuts</option>
                  {(Object.keys(STATUT_LABEL) as PointageStatut[]).map((s) => (
                    <option key={s} value={s}>{STATUT_LABEL[s]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setFiltresAvancesOuverts((o) => !o)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl border font-medium",
                    filtresAvancesOuverts ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted",
                  )}
                  data-testid="teacher-pointage-toggle-filtres-avances"
                >
                  <SlidersHorizontal size={14} /> Filtres avancés
                </button>
                {filtresActifs && (
                  <button
                    type="button"
                    onClick={reinitialiserFiltres}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid="teacher-pointage-reinitialiser-filtres"
                  >
                    <X size={12} /> Réinitialiser les filtres
                  </button>
                )}
              </div>

              {filtresAvancesOuverts && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border">
                  <select
                    value={ecFiltre}
                    onChange={(e) => setEcFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-pointage-filtre-cours"
                  >
                    <option value="">Tous les cours</option>
                    {mesEcsIds.map((id) => {
                      const ec = ecs.find((e) => e.id === id);
                      return <option key={id} value={id}>{ec ? `${ec.code} — ${ec.libelle}` : id}</option>;
                    })}
                  </select>
                  <select
                    value={classeFiltre}
                    onChange={(e) => setClasseFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-pointage-filtre-classe"
                  >
                    <option value="">Toutes les classes</option>
                    {mesClasseIds.map((id) => {
                      const classe = classes.find((c) => c.id === id);
                      return <option key={id} value={id}>{classe?.nom ?? id}</option>;
                    })}
                  </select>
                  <select
                    value={typeSeanceFiltre}
                    onChange={(e) => setTypeSeanceFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-pointage-filtre-type"
                  >
                    <option value="">Tous les types de séance</option>
                    {typesSeance.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={salleFiltre}
                    onChange={(e) => setSalleFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-pointage-filtre-salle"
                  >
                    <option value="">Toutes les salles</option>
                    {mesSalleIds.map((id) => {
                      const salle = salles.find((s) => s.id === id);
                      return <option key={id} value={id}>{salle?.nom ?? id}</option>;
                    })}
                  </select>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Du</label>
                    <input
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="teacher-pointage-date-debut"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Au</label>
                    <input
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="teacher-pointage-date-fin"
                    />
                  </div>
                </div>
              )}
            </div>

            {filtrees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
                Aucun pointage ne correspond.
              </p>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Cours</th>
                        <th className="px-4 py-3">Classe</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Salle</th>
                        <th className="px-4 py-3">Durée</th>
                        <th className="px-4 py-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrees.map((p) => {
                        const { coursLabel, classeLabel, salleLabel } = contexteDe(p);
                        const Icon = STATUT_ICON[p.statut];
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className={cn("border-t border-border align-top cursor-pointer hover:bg-muted/40", selected?.id === p.id && "bg-primary/5")}
                            data-testid={`teacher-pointage-${p.id}`}
                          >
                            <td className="px-4 py-3">{formatDate(p.date)}<br /><span className="text-xs text-muted-foreground">{p.heureDebut}–{p.heureFin}</span></td>
                            <td className="px-4 py-3">{coursLabel}</td>
                            <td className="px-4 py-3">{classeLabel}</td>
                            <td className="px-4 py-3">{p.type}</td>
                            <td className="px-4 py-3">{salleLabel}</td>
                            <td className="px-4 py-3">{p.volumePointe} h</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[p.statut])}>
                                <Icon size={11} /> {STATUT_LABEL[p.statut]}
                              </span>
                              {p.statut === "rejete" && p.motifRejet && <p className="text-xs text-red-600 mt-1">{p.motifRejet}</p>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {selected && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Détail du pointage</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[selected.statut])}>{STATUT_LABEL[selected.statut]}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{contexteDe(selected).coursLabel}</p>
                <p className="text-xs text-muted-foreground mb-3">{contexteDe(selected).classeLabel} · {selected.type}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><CalendarClock size={12} /> {formatDate(selected.date)} · {selected.heureDebut}–{selected.heureFin}</p>
                  <p className="flex items-center gap-1.5"><MapPin size={12} /> {contexteDe(selected).salleLabel}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground">Heures pointées</p>
                  <p className="text-lg font-bold text-foreground">{selected.volumePointe} h</p>
                </div>
                {selected.remarque && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Remarque</p>
                    <p className="text-xs text-foreground">{selected.remarque}</p>
                  </div>
                )}
                {selected.statut === "rejete" && selected.motifRejet && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[11px] text-red-600 mb-0.5">Motif de rejet</p>
                    <p className="text-xs text-red-600">{selected.motifRejet}</p>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Historique des pointages</h3>
              <div className="space-y-3">
                {mine.slice(0, 5).map((p) => {
                  const Icon = STATUT_ICON[p.statut];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn("w-full flex items-start gap-2.5 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted/60", selected?.id === p.id && "bg-primary/5")}
                    >
                      <Icon size={13} className={cn("mt-0.5 flex-shrink-0", p.statut === "valide" ? "text-emerald-500" : p.statut === "rejete" ? "text-red-500" : "text-amber-500")} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{formatDate(p.date)} · {p.heureDebut}–{p.heureFin}</p>
                        <p className="text-[11px] text-muted-foreground">{STATUT_LABEL[p.statut]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
