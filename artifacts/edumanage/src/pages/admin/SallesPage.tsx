import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Building2, Monitor, X, Download, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { deleteSalle, type SallePhysiqueRecord } from "@/data/structureStore";
import { useSalles } from "@/hooks/useStructureStore";
import { downloadSalleTemplate, parseSalleExcel, importSalleRows, exportSallesToExcel } from "@/lib/salleImportExport";

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
      {label}<button onClick={onRemove} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
    </span>
  );
}

export default function SallesPage() {
  const [, setLocation] = useLocation();
  const salles = useSalles();
  const [typeFilter, setTypeFilter] = useState("");
  const [batimentFilter, setBatimentFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [capMin, setCapMin] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await parseSalleExcel(file);
      if (rows.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const created = importSalleRows(rows);
      toast.success(`${created.length} salle(s) importée(s).`);
    } catch {
      toast.error("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const types = [...new Set(salles.map((s) => s.type))];
  const batiments = [...new Set(salles.map((s) => s.batiment))];

  const filteredData = useMemo(() => salles.filter((s) => {
    if (typeFilter && s.type !== typeFilter) return false;
    if (batimentFilter && s.batiment !== batimentFilter) return false;
    if (statutFilter && s.statut !== statutFilter) return false;
    if (capMin && s.capacite < parseInt(capMin)) return false;
    return true;
  }), [salles, typeFilter, batimentFilter, statutFilter, capMin]);

  const activeFiltersCount = [typeFilter, batimentFilter, statutFilter, capMin].filter(Boolean).length;
  const totalCapacite = filteredData.reduce((sum, s) => sum + s.capacite, 0);
  const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const columns: Column<SallePhysiqueRecord>[] = [
    { key: "nom", header: "Salle physique", sortable: true, render: (r) => (
      <div>
        <span className="font-semibold text-foreground">{r.nom}</span>
        {r.etage && <span className="text-[10px] text-muted-foreground ml-2">{r.etage}</span>}
      </div>
    ) },
    { key: "type", header: "Type", render: (r) => <span className="text-xs font-medium px-2.5 py-1 bg-muted rounded-lg text-foreground">{r.type}</span> },
    { key: "capacite", header: "Capacité", sortable: true, render: (r) => <span className="font-bold text-foreground">{r.capacite} <span className="text-xs font-normal text-muted-foreground">places</span></span> },
    { key: "batiment", header: "Bâtiment", render: (r) => <span className="text-sm text-muted-foreground">{r.batiment}</span> },
    {
      key: "equipements", header: "Matériel pédagogique",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.equipements.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : r.equipements.map((eq) => (
            <span key={eq} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded"><Monitor size={9} /> {eq}</span>
          ))}
        </div>
      ),
    },
    { key: "statut", header: "Statut", render: (r) => <StatusBadge status={r.statut} /> },
    {
      key: "actions", header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/salles/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer ${r.nom} ?`)) deleteSalle(r.id); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Salles physiques" }]}
        title="Salles physiques"
        subtitle={`${filteredData.length} locaux — ${totalCapacite} places · noms stables (ex. RDC 1A)`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={downloadSalleTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Télécharger le modèle Excel">
              <FileSpreadsheet size={13} /> Modèle
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground cursor-pointer" title="Importer via Excel">
              <Upload size={13} /> Importer
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} data-testid="salle-import-input" />
            </label>
            <button onClick={() => exportSallesToExcel(filteredData)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Exporter la liste affichée">
              <Download size={13} /> Exporter
            </button>
            <button onClick={() => setLocation("/admin/salles/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={15} /> Nouvelle salle
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={Building2} label="Salles physiques" value={filteredData.length} accentColor="#4f46e5" />
        <KPICard icon={Building2} label="Capacité totale" value={totalCapacite} accentColor="#10b981" />
        <KPICard icon={Building2} label="Disponibles" value={filteredData.filter((s) => s.statut === "actif").length} accentColor="#f59e0b" />
      </div>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filteredData as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher une salle physique..."
        activeFiltersCount={activeFiltersCount}
        onClearFilters={() => { setTypeFilter(""); setBatimentFilter(""); setStatutFilter(""); setCapMin(""); }}
        filterPanel={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputClass}>
                <option value="">Tous</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bâtiment</label>
              <select value={batimentFilter} onChange={(e) => setBatimentFilter(e.target.value)} className={inputClass}>
                <option value="">Tous</option>
                {batiments.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut</label>
              <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className={inputClass}>
                <option value="">Tous</option>
                <option value="actif">Disponible</option>
                <option value="en_maintenance">Maintenance</option>
                <option value="inactif">Hors service</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Capacité min.</label>
              <input type="number" value={capMin} onChange={(e) => setCapMin(e.target.value)} className={inputClass} placeholder="30" />
            </div>
            {activeFiltersCount > 0 && (
              <div className="col-span-full flex flex-wrap gap-2">
                {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter("")} />}
                {batimentFilter && <FilterChip label={`Bâtiment: ${batimentFilter}`} onRemove={() => setBatimentFilter("")} />}
                {statutFilter && <FilterChip label={`Statut: ${statutFilter}`} onRemove={() => setStatutFilter("")} />}
                {capMin && <FilterChip label={`Min: ${capMin} places`} onRemove={() => setCapMin("")} />}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
