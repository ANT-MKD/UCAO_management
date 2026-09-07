import { useState } from "react";
import { useLocation } from "wouter";
import { Download, Plus, Search, CheckCircle2, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useAbsencesPeriode } from "@/hooks/useAbsencePeriodeStore";
import { marquerJustifieAbsencePeriode, type AbsencePeriodeRecord } from "@/data/absencePeriodeStore";
import { formatShortDate, cn } from "@/lib/utils";

export default function AbsencePeriodeListPage() {
  const [, setLocation] = useLocation();
  const records = useAbsencesPeriode();
  const [showFilters, setShowFilters] = useState(false);
  const [statutFilter, setStatutFilter] = useState("");

  const rows = statutFilter
    ? records.filter((r) => (statutFilter === "justifie" ? r.justifie : !r.justifie))
    : records;

  const exportExcel = () => {
    const data = rows.map((r) => ({
      Étudiant: `${r.matricule} - ${r.etudiant}`,
      Classe: r.classe,
      "Date début": formatShortDate(r.dateDebut),
      "Date fin": formatShortDate(r.dateFin),
      Motif: r.motif,
      Statut: r.justifie ? "Justifié" : "Non justifié",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absences par période");
    XLSX.writeFile(wb, `absences-periode-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleToggleJustifie = (r: AbsencePeriodeRecord) => {
    marquerJustifieAbsencePeriode(r.id, !r.justifie, r.justificatif);
    toast.success(r.justifie ? "Marqué non justifié" : "Marqué justifié");
  };

  const columns: Column<AbsencePeriodeRecord>[] = [
    {
      key: "etudiant", header: "Etudiant",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.matricule} - {r.etudiant}</p>
          <p className="text-[11px] text-muted-foreground">{r.motif}</p>
        </div>
      ),
    },
    { key: "classe", header: "Classe", render: (r) => <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-lg">{r.classe}</span> },
    { key: "dateDebut", header: "Date début", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatShortDate(r.dateDebut)}</span> },
    { key: "dateFin", header: "Date fin", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatShortDate(r.dateFin)}</span> },
    {
      key: "statut", header: "Statut",
      render: (r) => (
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", r.justifie ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
          {r.justifie ? "Justifié" : "Non justifié"}
        </span>
      ),
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleJustifie(r); }}
          className={cn("p-1.5 rounded-lg transition-colors", r.justifie ? "hover:bg-red-50 text-emerald-600 hover:text-red-600" : "hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600")}
          title={r.justifie ? "Marquer non justifié" : "Marquer justifié"}
          data-testid={`periode-toggle-${r.id}`}
        >
          {r.justifie ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Assiduité" }, { label: "Liste absence par période" }]}
        title="Les absences sur une période des étudiants"
        subtitle="Absences prolongées déclarées (maladie, sortie scolaire, congé autorisé)"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters((v) => !v)} className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors">
              <Search size={14} /> Recherche avancée
            </button>
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="periode-export">
              <Download size={14} /> Export excel
            </button>
            <button onClick={() => setLocation("/admin/assiduites/periode/nouvelle")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="periode-nouvelle">
              <Plus size={14} /> Nouvelle assiduité
            </button>
          </div>
        }
      />

      {showFilters && (
        <div className="bg-card border border-border rounded-xl mb-5 p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Statut</label>
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="w-full max-w-xs px-3 py-2 text-sm border border-border rounded-lg bg-background">
            <option value="">Tous</option>
            <option value="justifie">Justifié</option>
            <option value="non_justifie">Non justifié</option>
          </select>
        </div>
      )}

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={rows as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un étudiant…"
        pageSize={25}
        emptyMessage="Aucune donnée à afficher"
      />
    </div>
  );
}
