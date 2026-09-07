import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Lock, Plus, Pencil, Trash2, Users, X, Download, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES } from "@/data/mockData";
import { deleteClasse, type ClassePedagogiqueRecord } from "@/data/structureStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { downloadClasseTemplate, parseClasseExcel, importClasseRows, exportClassesToExcel } from "@/lib/classeImportExport";

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
      {label}<button onClick={onRemove} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
    </span>
  );
}

export default function ClassesPage() {
  const [, setLocation] = useLocation();
  const classes = useClasses();
  const salles = useSalles();
  const [filiereFilter, setFiliereFilter] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("");
  const [anneeFilter, setAnneeFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await parseClasseExcel(file);
      if (rows.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const created = importClasseRows(rows);
      toast.success(`${created.length} classe(s) importée(s).`);
    } catch {
      toast.error("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const filteredData = useMemo(() => classes.filter((c) => {
    if (filiereFilter && c.filiereId !== filiereFilter) return false;
    if (niveauFilter && c.niveau !== niveauFilter) return false;
    if (anneeFilter && c.annee !== anneeFilter) return false;
    if (statutFilter === "cloturee" && !c.cloturee) return false;
    if (statutFilter === "ouverte" && c.cloturee) return false;
    return true;
  }), [classes, filiereFilter, niveauFilter, anneeFilter, statutFilter]);

  const niveaux = [...new Set(classes.map((c) => c.niveau))];
  const annees = [...new Set(classes.map((c) => c.annee))];
  const activeFiltersCount = [filiereFilter, niveauFilter, anneeFilter, statutFilter].filter(Boolean).length;
  const totalInscrits = filteredData.reduce((sum, c) => sum + c.inscrits, 0);
  const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const columns: Column<ClassePedagogiqueRecord>[] = [
    {
      key: "nom", header: "Classe pédagogique", sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground font-mono text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.nom}</span>
          {r.cloturee && (
            <span title={`Clôturée le ${r.dateCloture ?? "—"} par ${r.clotureePar ?? "—"}${r.observationCloture ? ` — ${r.observationCloture}` : ""}`}>
              <StatusBadge status="clos" />
            </span>
          )}
        </div>
      ),
    },
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
          {!r.cloturee && (
            <button
              title="Clôturer cette classe"
              onClick={(e) => { e.stopPropagation(); setLocation(`/admin/classe/cloture-annee?filiereId=${r.filiereId}&niveau=${r.niveau}&annee=${encodeURIComponent(r.annee)}`); }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            >
              <Lock size={14} />
            </button>
          )}
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
          <div className="flex items-center gap-2">
            <button onClick={downloadClasseTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Télécharger le modèle Excel">
              <FileSpreadsheet size={13} /> Modèle
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground cursor-pointer" title="Importer via Excel">
              <Upload size={13} /> Importer
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} data-testid="classe-import-input" />
            </label>
            <button onClick={() => exportClassesToExcel(filteredData)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Exporter la liste affichée">
              <Download size={13} /> Exporter
            </button>
            <button onClick={() => setLocation("/admin/classes/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={15} /> Nouvelle classe
            </button>
          </div>
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
        onClearFilters={() => { setFiliereFilter(""); setNiveauFilter(""); setAnneeFilter(""); setStatutFilter(""); }}
        filterPanel={
          <div className="grid grid-cols-4 gap-4 p-4">
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut</label>
              <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className={inputClass}>
                <option value="">Tous</option>
                <option value="ouverte">Ouverte</option>
                <option value="cloturee">Clôturée</option>
              </select>
            </div>
            {activeFiltersCount > 0 && (
              <div className="col-span-full flex flex-wrap gap-2">
                {filiereFilter && <FilterChip label={`Filière: ${FILIERES.find((f) => f.id === filiereFilter)?.code}`} onRemove={() => setFiliereFilter("")} />}
                {niveauFilter && <FilterChip label={`Niveau: ${niveauFilter}`} onRemove={() => setNiveauFilter("")} />}
                {anneeFilter && <FilterChip label={`Année: ${anneeFilter}`} onRemove={() => setAnneeFilter("")} />}
                {statutFilter && <FilterChip label={`Statut: ${statutFilter === "cloturee" ? "Clôturée" : "Ouverte"}`} onRemove={() => setStatutFilter("")} />}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
