import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { CurriculumImportButton } from "@/components/admin/CurriculumImportButton";
import { MaquetteExportButton } from "@/components/admin/MaquetteExportButton";
import { deleteUe, type UeRecord } from "@/data/curriculumStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import { FILIERES } from "@/data/mockData";

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Obligatoire: { bg: "#eff6ff", color: "#2563eb" },
  Libre: { bg: "#faf5ff", color: "#a855f7" },
  Fondamentale: { bg: "#eff6ff", color: "#3b82f6" },
  "Spécialité": { bg: "#f0fdf4", color: "#22c55e" },
  Transversale: { bg: "#fefce8", color: "#eab308" },
  Optionnelle: { bg: "#faf5ff", color: "#a855f7" },
};

export default function UEsPage() {
  const [, setLocation] = useLocation();
  const ues = useUes();
  const ecs = useEcs();
  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [semestre, setSemestre] = useState("");

  const filtered = useMemo(() => {
    return ues.filter((u) => {
      if (filiereId && u.filiereId !== filiereId) return false;
      if (niveau && u.niveau !== niveau) return false;
      if (semestre && u.semestre !== semestre) return false;
      return true;
    });
  }, [ues, filiereId, niveau, semestre]);

  const niveaux = useMemo(() => [...new Set(ues.filter((u) => !filiereId || u.filiereId === filiereId).map((u) => u.niveau))].sort(), [ues, filiereId]);
  const semestres = useMemo(
    () => [...new Set(ues.filter((u) => (!filiereId || u.filiereId === filiereId) && (!niveau || u.niveau === niveau)).map((u) => u.semestre))].sort(),
    [ues, filiereId, niveau],
  );

  const totalCredits = filtered.reduce((sum, u) => sum + u.credits, 0);
  const filieresCouvertes = [...new Set(filtered.map((u) => u.filiere))].length;
  const filiereLabel = filiereId ? FILIERES.find((f) => f.id === filiereId)?.nom : undefined;
  const maquetteTitre = [filiereLabel ?? "Toutes filières", niveau, semestre].filter(Boolean).join(" — ");

  const columns: Column<UeRecord>[] = [
    { key: "code", header: "Code UE", render: (r) => <span className="font-mono text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-lg" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.code}</span> },
    { key: "libelle", header: "Unité d'enseignement", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.libelle}</span> },
    { key: "credits", header: "Crédits", sortable: true, render: (r) => <span className="font-bold text-foreground">{r.credits} <span className="text-xs font-normal text-muted-foreground">ECTS</span></span> },
    { key: "nbEc", header: "EC", render: (r) => <span className="text-sm text-muted-foreground">{r.nbEc}</span> },
    { key: "filiere", header: "Filière", render: (r) => <span className="text-xs font-semibold px-2.5 py-1 bg-muted text-foreground rounded-lg">{r.filiere}</span> },
    { key: "niveau", header: "Niveau", render: (r) => <span className="text-sm text-foreground">{r.niveau}</span> },
    { key: "semestre", header: "Semestre", render: (r) => <span className="text-sm text-muted-foreground">{r.semestre}</span> },
    {
      key: "type",
      header: "Caractère",
      render: (r) => {
        const style = TYPE_COLORS[r.type] ?? { bg: "#f8fafc", color: "#64748b" };
        return <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: style.bg, color: style.color }}>{r.type}</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/ues/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer l'UE ${r.code} et ses EC ?`)) deleteUe(r.id);
            }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const selectClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Unités d'Enseignement" }]}
        title="Unités d'Enseignement (UE)"
        subtitle={`${filtered.length} UE — ${totalCredits} crédits ECTS (filtre maquette)`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <MaquetteExportButton ues={filtered} ecs={ecs} titre={maquetteTitre} />
            <CurriculumImportButton />
            <button onClick={() => setLocation("/admin/ues/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={15} /> Nouvelle UE
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <select className={selectClass} value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveau(""); setSemestre(""); }}>
          <option value="">Toutes les filières</option>
          {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
        </select>
        <select className={selectClass} value={niveau} onChange={(e) => { setNiveau(e.target.value); setSemestre(""); }}>
          <option value="">Tous les niveaux</option>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className={selectClass} value={semestre} onChange={(e) => setSemestre(e.target.value)}>
          <option value="">Tous les semestres</option>
          {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={BookOpen} label="UE filtrées" value={filtered.length} accentColor="#4f46e5" />
        <KPICard icon={BookOpen} label="Crédits ECTS" value={totalCredits} accentColor="#10b981" />
        <KPICard icon={BookOpen} label="Filières" value={filieresCouvertes} accentColor="#f59e0b" />
      </div>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filtered as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher une UE..."
      />
    </div>
  );
}
