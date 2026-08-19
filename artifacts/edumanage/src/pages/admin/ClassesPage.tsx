import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Copy, Plus, Pencil, Trash2, Users, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES } from "@/data/mockData";
import { deleteClasse, type ClassePedagogiqueRecord } from "@/data/structureStore";
import { transferClasseRoster } from "@/data/studentStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { useStudentStore } from "@/hooks/useStudentStore";

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
      {label}<button onClick={onRemove} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
    </span>
  );
}

const NIVEAU_SUIVANT: Record<string, string> = {
  L1: "L2",
  L2: "L3",
  L3: "M1",
  M1: "M2",
  M2: "D1",
};

function suggestTarget(
  source: ClassePedagogiqueRecord,
  all: ClassePedagogiqueRecord[],
): string {
  const next = NIVEAU_SUIVANT[source.niveau];
  if (!next) return "";
  const match = all.find(
    (c) =>
      c.id !== source.id &&
      c.filiereId === source.filiereId &&
      c.niveau === next,
  );
  return match?.id ?? "";
}

export default function ClassesPage() {
  const [, setLocation] = useLocation();
  const classes = useClasses();
  const salles = useSalles();
  const etudiants = useStudentStore();
  const [filiereFilter, setFiliereFilter] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("");
  const [anneeFilter, setAnneeFilter] = useState("");
  const [dupSourceId, setDupSourceId] = useState<string | null>(null);
  const [dupTargetId, setDupTargetId] = useState("");
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [dupResult, setDupResult] = useState<string | null>(null);

  const filteredData = useMemo(() => classes.filter((c) => {
    if (filiereFilter && c.filiereId !== filiereFilter) return false;
    if (niveauFilter && c.niveau !== niveauFilter) return false;
    if (anneeFilter && c.annee !== anneeFilter) return false;
    return true;
  }), [classes, filiereFilter, niveauFilter, anneeFilter]);

  const niveaux = [...new Set(classes.map((c) => c.niveau))];
  const annees = [...new Set(classes.map((c) => c.annee))];
  const activeFiltersCount = [filiereFilter, niveauFilter, anneeFilter].filter(Boolean).length;
  const totalInscrits = filteredData.reduce((sum, c) => sum + c.inscrits, 0);
  const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const sourceClasse = classes.find((c) => c.id === dupSourceId);
  const rosterSource = useMemo(
    () => (dupSourceId ? etudiants.filter((e) => e.classeId === dupSourceId) : []),
    [etudiants, dupSourceId],
  );

  const openDuplicate = (classeId: string) => {
    const src = classes.find((c) => c.id === classeId);
    setDupSourceId(classeId);
    setDupTargetId(src ? suggestTarget(src, classes) : "");
    setExcludeIds([]);
    setDupResult(null);
  };

  const runDuplicate = () => {
    if (!dupSourceId || !dupTargetId) return;
    const n = transferClasseRoster(dupSourceId, dupTargetId, excludeIds);
    const target = classes.find((c) => c.id === dupTargetId);
    setDupResult(`${n} étudiant(s) versés vers ${target?.nom ?? "la classe cible"}.`);
  };

  const columns: Column<ClassePedagogiqueRecord>[] = [
    { key: "nom", header: "Classe pédagogique", sortable: true, render: (r) => <span className="font-semibold text-foreground font-mono text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.nom}</span> },
    { key: "filiere", header: "Filière", render: (r) => <span className="text-xs font-semibold px-2.5 py-1 bg-muted text-foreground rounded-lg">{r.filiere}</span> },
    { key: "niveau", header: "Niveau", render: (r) => <span className="text-sm text-foreground">{r.niveau}</span> },
    {
      key: "inscrits", header: "Effectif", sortable: true,
      render: (r) => {
        const pct = Math.round((r.inscrits / r.max) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{r.inscrits}/{r.max}</span>
          </div>
        );
      },
    },
    {
      key: "salleParDefautId",
      header: "Salle défaut",
      render: (r) => {
        const salle = salles.find((s) => s.id === r.salleParDefautId);
        return <span className="text-xs text-muted-foreground">{salle?.nom ?? "—"}</span>;
      },
    },
    { key: "delegue", header: "Délégué", render: (r) => r.delegue ? (
      <div className="flex items-center gap-1.5"><UserAvatar name={r.delegue} size="xs" /><span className="text-xs text-foreground">{r.delegue}</span></div>
    ) : <span className="text-xs text-muted-foreground">—</span> },
    { key: "annee", header: "Année", render: (r) => <span className="text-xs text-muted-foreground">{r.annee}</span> },
    {
      key: "actions", header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            title="Dupliquer la liste vers L+1"
            onClick={(e) => { e.stopPropagation(); openDuplicate(r.id); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
          >
            <Copy size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/classes/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer ${r.nom} ?`)) deleteClasse(r.id); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Classes pédagogiques" }]}
        title="Classes pédagogiques"
        subtitle={`${filteredData.length} groupes — ${totalInscrits} étudiants · distinctes des salles physiques`}
        actions={
          <button onClick={() => setLocation("/admin/classes/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouvelle classe
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={Users} label="Classes pédagogiques" value={filteredData.length} accentColor="#4f46e5" />
        <KPICard icon={Users} label="Total inscrits" value={totalInscrits} accentColor="#10b981" />
        <KPICard icon={Users} label="Filières" value={[...new Set(filteredData.map((c) => c.filiere))].length} accentColor="#f59e0b" />
      </div>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filteredData as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher une classe pédagogique..."
        activeFiltersCount={activeFiltersCount}
        onClearFilters={() => { setFiliereFilter(""); setNiveauFilter(""); setAnneeFilter(""); }}
        filterPanel={
          <div className="grid grid-cols-3 gap-4 p-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
              <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className={inputClass}>
                <option value="">Toutes</option>
                {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau</label>
              <select value={niveauFilter} onChange={(e) => setNiveauFilter(e.target.value)} className={inputClass}>
                <option value="">Tous</option>
                {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année</label>
              <select value={anneeFilter} onChange={(e) => setAnneeFilter(e.target.value)} className={inputClass}>
                <option value="">Toutes</option>
                {annees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {activeFiltersCount > 0 && (
              <div className="col-span-full flex flex-wrap gap-2">
                {filiereFilter && <FilterChip label={`Filière: ${FILIERES.find((f) => f.id === filiereFilter)?.code}`} onRemove={() => setFiliereFilter("")} />}
                {niveauFilter && <FilterChip label={`Niveau: ${niveauFilter}`} onRemove={() => setNiveauFilter("")} />}
                {anneeFilter && <FilterChip label={`Année: ${anneeFilter}`} onRemove={() => setAnneeFilter("")} />}
              </div>
            )}
          </div>
        }
      />

      {dupSourceId && sourceClasse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Dupliquer la liste
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Transférer les étudiants de <strong>{sourceClasse.nom}</strong> vers le niveau suivant (ex. L1 → L2).
                </p>
              </div>
              <button type="button" onClick={() => setDupSourceId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe cible *</label>
              <select
                value={dupTargetId}
                onChange={(e) => setDupTargetId(e.target.value)}
                className={inputClass}
              >
                <option value="">Sélectionner</option>
                {classes
                  .filter((c) => c.id !== sourceClasse.id && c.filiereId === sourceClasse.filiereId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} · {c.niveau} ({c.inscrits}/{c.max})
                      {NIVEAU_SUIVANT[sourceClasse.niveau] === c.niveau ? " — suggéré" : ""}
                    </option>
                  ))}
              </select>
            </div>

            {rosterSource.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Exclure des étudiants ({excludeIds.length} exclus / {rosterSource.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                  {rosterSource.map((e) => {
                    const excluded = excludeIds.includes(e.id);
                    return (
                      <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={excluded}
                          onChange={() =>
                            setExcludeIds((prev) =>
                              excluded ? prev.filter((id) => id !== e.id) : [...prev, e.id],
                            )
                          }
                          className="w-3.5 h-3.5"
                        />
                        <span className={excluded ? "line-through text-muted-foreground" : "text-foreground"}>
                          {e.prenom} {e.nom}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{e.matricule}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {dupResult && (
              <p className="text-sm text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                {dupResult}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDupSourceId(null)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={!dupTargetId || !!dupResult}
                onClick={runDuplicate}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Copy size={14} /> Transférer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
