import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { CurriculumImportButton } from "@/components/admin/CurriculumImportButton";
import { deleteEc, type EcRecord } from "@/data/curriculumStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { FILIERES } from "@/data/mockData";

export default function ECsPage() {
  const [, setLocation] = useLocation();
  const ecs = useEcs();
  const ues = useUes();
  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [semestre, setSemestre] = useState("");
  const [ueId, setUeId] = useState("");

  const filteredUes = useMemo(() => {
    return ues.filter((u) => {
      if (filiereId && u.filiereId !== filiereId) return false;
      if (niveau && u.niveau !== niveau) return false;
      if (semestre && u.semestre !== semestre) return false;
      return true;
    });
  }, [ues, filiereId, niveau, semestre]);

  const filtered = useMemo(() => {
    const ueIds = new Set(filteredUes.map((u) => u.id));
    return ecs.filter((e) => {
      if ((filiereId || niveau || semestre) && !ueIds.has(e.ueId)) return false;
      if (ueId && e.ueId !== ueId) return false;
      return true;
    });
  }, [ecs, filteredUes, filiereId, niveau, semestre, ueId]);

  const niveaux = useMemo(
    () => [...new Set(ues.filter((u) => !filiereId || u.filiereId === filiereId).map((u) => u.niveau))].sort(),
    [ues, filiereId],
  );
  const semestres = useMemo(
    () =>
      [...new Set(ues.filter((u) => (!filiereId || u.filiereId === filiereId) && (!niveau || u.niveau === niveau)).map((u) => u.semestre))].sort(),
    [ues, filiereId, niveau],
  );

  const totalVolCm = filtered.reduce((sum, e) => sum + e.volCm, 0);
  const totalVolTd = filtered.reduce((sum, e) => sum + e.volTd, 0);
  const totalVht = filtered.reduce((sum, e) => sum + e.vht, 0);

  const columns: Column<EcRecord>[] = [
    { key: "code", header: "Code EC", render: (r) => <span className="font-mono text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-lg" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.code}</span> },
    { key: "libelle", header: "Élément constitutif", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.libelle}</span> },
    { key: "ue", header: "Code UE", render: (r) => <span className="text-xs text-muted-foreground font-mono">{r.ue}</span> },
    {
      key: "volumes",
      header: "CM / TD / TP / TPE",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded font-medium">CM {r.volCm}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded font-medium">TD {r.volTd}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded font-medium">TP {r.volTp}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded font-medium">TPE {r.volTpe}</span>
        </div>
      ),
    },
    { key: "vht", header: "VHT", sortable: true, render: (r) => <span className="font-bold text-foreground">{r.vht}h</span> },
    {
      key: "responsable",
      header: "Responsable",
      render: (r) => r.responsable ? (
        <div className="flex items-center gap-1.5">
          <UserAvatar name={r.responsable} size="xs" />
          <span className="text-xs text-foreground">{r.responsable}</span>
        </div>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/ecs/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer l'EC ${r.code} ?`)) deleteEc(r.id);
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
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Éléments Constitutifs" }]}
        title="Éléments Constitutifs (EC)"
        subtitle={`${filtered.length} EC — ${totalVht}h VHT (filtre filière → niveau → semestre → UE)`}
        actions={
          <div className="flex items-center gap-2">
            <CurriculumImportButton />
            <button onClick={() => setLocation("/admin/ecs/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={15} /> Nouvel EC
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <select className={selectClass} value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveau(""); setSemestre(""); setUeId(""); }}>
          <option value="">Toutes les filières</option>
          {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
        </select>
        <select className={selectClass} value={niveau} onChange={(e) => { setNiveau(e.target.value); setSemestre(""); setUeId(""); }}>
          <option value="">Tous les niveaux</option>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className={selectClass} value={semestre} onChange={(e) => { setSemestre(e.target.value); setUeId(""); }}>
          <option value="">Tous les semestres</option>
          {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectClass} value={ueId} onChange={(e) => setUeId(e.target.value)}>
          <option value="">Toutes les UE</option>
          {filteredUes.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.libelle}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={FileText} label="EC filtrés" value={filtered.length} accentColor="#4f46e5" />
        <KPICard icon={FileText} label="Heures CM" value={`${totalVolCm}h`} accentColor="#10b981" />
        <KPICard icon={FileText} label="Heures TD" value={`${totalVolTd}h`} accentColor="#f59e0b" />
        <KPICard icon={FileText} label="VHT total" value={`${totalVht}h`} accentColor="#2563eb" />
      </div>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filtered as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un EC..."
      />
    </div>
  );
}
