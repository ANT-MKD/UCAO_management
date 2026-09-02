import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Plus, Eye, Pencil, Users, X, Download, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useTeachers } from "@/hooks/useTeacherStore";
import type { TeacherRecord } from "@/data/teacherStore";
import { downloadTeacherTemplate, parseTeacherExcel, importTeacherRows, exportTeachersToExcel } from "@/lib/teacherImportExport";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA } from "@/lib/utils";

type Enseignant = TeacherRecord;

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  Permanent: { bg: "#ecfdf5", text: "#10b981" },
  Vacataire: { bg: "#fffbeb", text: "#f59e0b" },
  Contractuel: { bg: "#eff6ff", text: "#3b82f6" },
};

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5"><X size={10} /></button>
    </span>
  );
}

export default function TeachersPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const [gradeFilter, setGradeFilter] = useState("");
  const [specialiteFilter, setSpecialiteFilter] = useState("");
  const [tauxMin, setTauxMin] = useState("");
  const [tauxMax, setTauxMax] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const enseignants = useTeachers();
  const specialites = useMemo(() => [...new Set(enseignants.map((e) => e.specialite))], [enseignants]);

  const handleImportFile = async (file: File | undefined) => {
    if (!file || !currentUser) return;
    try {
      const rows = await parseTeacherExcel(file);
      if (rows.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const created = importTeacherRows(rows, currentUser.id);
      toast.success(`${created.length} enseignant(s) ajouté(s).`);
    } catch {
      toast.error("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const filteredData = useMemo(() => {
    return enseignants.filter((e) => {
      if (gradeFilter && e.grade !== gradeFilter) return false;
      if (specialiteFilter && e.specialite !== specialiteFilter) return false;
      if (tauxMin && e.tauxHoraire < parseInt(tauxMin)) return false;
      if (tauxMax && e.tauxHoraire > parseInt(tauxMax)) return false;
      return true;
    });
  }, [enseignants, gradeFilter, specialiteFilter, tauxMin, tauxMax]);

  const permanents = enseignants.filter((e) => e.grade === "Permanent").length;
  const vacataires = enseignants.filter((e) => e.grade === "Vacataire").length;
  const activeFiltersCount = [gradeFilter, specialiteFilter, tauxMin, tauxMax].filter(Boolean).length;

  const columns: Column<Enseignant>[] = [
    {
      key: "nom",
      header: "Enseignant",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar name={`${r.prenom} ${r.nom}`} size="sm" src={r.photoDataUrl} />
          <div>
            <div className="font-medium text-foreground text-sm">{r.prenom} {r.nom}</div>
            <div className="text-[10px] text-muted-foreground">{r.specialite}</div>
          </div>
        </div>
      ),
    },
    { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.matricule}</span> },
    {
      key: "grade",
      header: "Statut",
      render: (r) => {
        const style = GRADE_COLORS[r.grade] ?? { bg: "#f8fafc", text: "#64748b" };
        return <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: style.bg, color: style.text }}>{r.grade}</span>;
      },
    },
    { key: "modulesAssignes", header: "Modules", sortable: true, render: (r) => <span className="font-bold text-foreground">{r.modulesAssignes}</span> },
    { key: "heuresMois", header: "H/mois", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{r.heuresMois}h</span> },
    { key: "tauxHoraire", header: "Taux/h", sortable: true, render: (r) => <span className="font-medium text-emerald-600">{formatCFA(r.tauxHoraire)}</span> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/teachers/${r.id}`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Eye size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/teachers/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
        </div>
      ),
    },
  ];

  const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Utilisateurs" }, { label: "Enseignants" }]}
        title="Enseignants"
        subtitle={`${filteredData.length} enseignant(s) affiché(s)`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={downloadTeacherTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Télécharger le modèle Excel">
              <FileSpreadsheet size={13} /> Modèle
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground cursor-pointer" title="Importer via Excel">
              <Upload size={13} /> Importer
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} data-testid="teacher-import-input" />
            </label>
            <button onClick={() => exportTeachersToExcel(filteredData)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Exporter la liste affichée">
              <Download size={13} /> Exporter
            </button>
            <button onClick={() => setLocation("/admin/teachers/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={15} /> Ajouter un Enseignant
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={Users} label="Total Enseignants" value={enseignants.length} accentColor="#4f46e5" />
        <KPICard icon={Users} label="Permanents" value={permanents} accentColor="#10b981" />
        <KPICard icon={Users} label="Vacataires" value={vacataires} accentColor="#f59e0b" />
      </div>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filteredData as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un enseignant..."
        activeFiltersCount={activeFiltersCount}
        onClearFilters={() => { setGradeFilter(""); setSpecialiteFilter(""); setTauxMin(""); setTauxMax(""); }}
        filterPanel={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut</label>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className={inputClass}>
                <option value="">Tous</option>
                <option value="Permanent">Permanent</option>
                <option value="Vacataire">Vacataire</option>
                <option value="Contractuel">Contractuel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Spécialité</label>
              <select value={specialiteFilter} onChange={(e) => setSpecialiteFilter(e.target.value)} className={inputClass}>
                <option value="">Toutes</option>
                {specialites.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Taux min (FCFA)</label>
              <input type="number" value={tauxMin} onChange={(e) => setTauxMin(e.target.value)} className={inputClass} placeholder="8000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Taux max (FCFA)</label>
              <input type="number" value={tauxMax} onChange={(e) => setTauxMax(e.target.value)} className={inputClass} placeholder="20000" />
            </div>
            {activeFiltersCount > 0 && (
              <div className="col-span-full flex flex-wrap gap-2">
                {gradeFilter && <FilterChip label={`Statut: ${gradeFilter}`} onRemove={() => setGradeFilter("")} />}
                {specialiteFilter && <FilterChip label={`Spécialité: ${specialiteFilter}`} onRemove={() => setSpecialiteFilter("")} />}
                {tauxMin && <FilterChip label={`Min: ${formatCFA(parseInt(tauxMin))}`} onRemove={() => setTauxMin("")} />}
                {tauxMax && <FilterChip label={`Max: ${formatCFA(parseInt(tauxMax))}`} onRemove={() => setTauxMax("")} />}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
