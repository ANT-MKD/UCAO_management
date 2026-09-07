import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Eye, Download, Plus, X, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useCahiers, useStudentStore } from "@/hooks/useStudentStore";
import { useAbsencesPeriode } from "@/hooks/useAbsencePeriodeStore";
import { getAssiduiteRows, type AssiduiteRow } from "@/data/assiduiteEngine";
import { formatShortDate, cn } from "@/lib/utils";

export default function AssiduitesListPage() {
  const [, setLocation] = useLocation();
  useCahiers(); // souscription pour re-rendre quand un cahier (ou sa justification) change
  useAbsencesPeriode(); // idem pour les couvertures par période
  const etudiants = useStudentStore();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statutFilter, setStatutFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const rows = useMemo(() => {
    let list = getAssiduiteRows();
    if (typeFilter) list = list.filter((r) => r.type === typeFilter);
    if (statutFilter) list = list.filter((r) => (statutFilter === "justifie" ? r.justifie : !r.justifie));
    return list;
  }, [typeFilter, statutFilter]);

  const previewRow = previewId ? rows.find((r) => r.id === previewId) : undefined;
  const previewEtudiant = previewRow ? etudiants.find((e) => e.id === previewRow.etudiantId) : undefined;

  const exportExcel = () => {
    const data = rows.map((r) => ({
      Matricule: r.matricule,
      Étudiant: r.etudiant,
      Cours: r.ec,
      Classe: r.classe,
      "Date": formatShortDate(r.date),
      Assiduité: r.type === "absence" ? "Absence" : "Retard",
      "Durée (min)": r.retardMinutes ?? "",
      Statut: r.justifie ? "Justifié" : "Non justifié",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assiduités");
    XLSX.writeFile(wb, `assiduites-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns: Column<AssiduiteRow>[] = [
    {
      key: "etudiant", header: "Etudiant",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.matricule} - {r.etudiant}</p>
        </div>
      ),
    },
    { key: "ec", header: "Cours", render: (r) => <span className="text-sm text-foreground">{r.ec}</span> },
    { key: "date", header: "Date d'absence", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatShortDate(r.date)}</span> },
    {
      key: "type", header: "Assiduité",
      render: (r) => (
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", r.type === "absence" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
          {r.type === "absence" ? "Absence" : `Retard${r.retardMinutes ? ` (${r.retardMinutes} min)` : ""}`}
        </span>
      ),
    },
    {
      key: "statut", header: "Statut",
      render: (r) => (
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", r.justifie ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
          {r.justifie ? "Justifié" : "Non Justifié"}
        </span>
      ),
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); setPreviewId(r.id); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Consulter" data-testid={`assiduite-consulter-${r.id}`}>
          <Eye size={14} />
        </button>
      ),
    },
  ];

  const filterPanel = (
    <div className="p-4 grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Type</label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">Tous</option>
          <option value="absence">Absence</option>
          <option value="retard">Retard</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Statut</label>
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">Tous</option>
          <option value="justifie">Justifié</option>
          <option value="non_justifie">Non justifié</option>
        </select>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Assiduité" }, { label: "Les assiduités" }]}
        title="Les assiduités des étudiants"
        subtitle="Chaque absence/retard vient du cahier de textes réellement soumis par le professeur — rien n'est ressaisi ici"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters((v) => !v)} className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors">
              <Search size={14} /> Recherche avancée
            </button>
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="assiduites-export">
              <Download size={14} /> Export excel
            </button>
            <button onClick={() => setLocation("/admin/assiduites/nouvelle")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="assiduites-nouvelle">
              <Plus size={14} /> Nouvelle assiduité
            </button>
          </div>
        }
      />

      {showFilters && (
        <div className="bg-card border border-border rounded-xl mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          {filterPanel}
        </div>
      )}

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={rows as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un étudiant ou un cours…"
        pageSize={25}
        onRowClick={(r) => setPreviewId((r as unknown as AssiduiteRow).id)}
        emptyMessage="Aucune assiduité enregistrée — les absences/retards apparaissent ici dès qu'un professeur soumet son cahier de textes."
      />

      {previewRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Consultation assiduité de l&apos;étudiant</h3>
              <button onClick={() => setPreviewId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><X size={16} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={previewRow.etudiant} size="lg" />
                <div>
                  <p className="font-mono text-xs text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{previewRow.matricule}</p>
                  <p className="font-bold text-foreground">{previewRow.etudiant}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", previewRow.type === "absence" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
                      {previewRow.type === "absence" ? "Absence" : "Retard"}
                    </span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", previewRow.justifie ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      {previewRow.justifie ? "JUSTIFIÉ" : "NON JUSTIFIÉ"}
                    </span>
                  </div>
                </div>
              </div>
              {previewEtudiant && (
                <div className="text-sm text-muted-foreground">
                  Né(e) le {formatShortDate(previewEtudiant.dateNaissance)}{previewEtudiant.lieuNaissance ? ` à ${previewEtudiant.lieuNaissance}` : ""}
                  {previewEtudiant.nationalite ? ` · ${previewEtudiant.nationalite}` : ""}
                </div>
              )}
              {previewEtudiant && <div className="text-sm text-muted-foreground">{previewEtudiant.email} · {previewEtudiant.telephone}</div>}
              <div className="text-sm text-foreground">
                {previewRow.type === "absence" ? "Absent(e)" : "En retard"} le {formatShortDate(previewRow.date)} au cours de <strong>{previewRow.ec}</strong> | {previewRow.semestre}
                {previewRow.type === "retard" && previewRow.retardMinutes ? ` — ${previewRow.retardMinutes} min` : ""}
              </div>
              <div className="text-sm text-muted-foreground">Professeur : <strong className="text-foreground">{previewRow.prof}</strong></div>
              <div className="text-sm text-muted-foreground">Classe : <strong className="text-foreground">{previewRow.classe} - {previewRow.niveau} - {previewRow.annee}</strong></div>
              <div className="text-sm text-muted-foreground">
                {previewRow.justification ? previewRow.justification : "Pas de pièce justificative"}
              </div>
            </div>
            <div className="flex justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <span className="text-xs text-muted-foreground self-center">Source : cahier de textes du professeur</span>
              <button onClick={() => setLocation("/admin/assiduites/nouvelle")} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Traiter / justifier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
