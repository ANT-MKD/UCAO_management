import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, Download, Plus, X, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useAbandons } from "@/hooks/useAbandonStore";
import { reintegrerAbandon, type AbandonRecord } from "@/data/abandonStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

export default function AbandonsPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const abandons = useAbandons();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewRecord = previewId ? abandons.find((a) => a.id === previewId) : undefined;

  const exportExcel = () => {
    const rows = abandons.map((a) => ({
      Code: a.matricule,
      Nom: a.nom,
      Prénom: a.prenom,
      "Cumul payé": a.cumulPaye,
      "Cumul impayé": a.cumulImpaye,
      "Date abandon": formatShortDate(a.dateAbandon),
      Programme: a.filiere,
      Statut: a.reintegre ? "Réintégré" : "Abandon",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Abandons");
    XLSX.writeFile(wb, `abandons-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleReintegrer = (record: AbandonRecord) => {
    if (!confirm(`Réintégrer ${record.prenom} ${record.nom} ? Son statut redeviendra "${record.statutAvant}".`)) return;
    reintegrerAbandon(record.id, currentUser?.name ?? "Administration");
    toast.success(`${record.prenom} ${record.nom} réintégré(e)`);
    setPreviewId(null);
  };

  const columns: Column<AbandonRecord>[] = [
    { key: "matricule", header: "Code", sortable: true, render: (r) => <span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.matricule}</span> },
    { key: "nom", header: "Nom", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.nom}</span> },
    { key: "prenom", header: "Prénom", sortable: true, render: (r) => <span className="text-foreground">{r.prenom}</span> },
    { key: "cumulPaye", header: "Cumul payé", sortable: true, render: (r) => <span className="text-sm font-semibold text-emerald-600">{formatCFA(r.cumulPaye)}</span> },
    {
      key: "cumulImpaye", header: "Cumul impayé", sortable: true,
      render: (r) => <span className={cn("text-sm font-semibold", r.cumulImpaye > 0 ? "text-red-500" : "text-muted-foreground")}>{r.cumulImpaye > 0 ? formatCFA(r.cumulImpaye) : "—"}</span>,
    },
    { key: "dateAbandon", header: "Date abandon", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatShortDate(r.dateAbandon)}</span> },
    { key: "filiere", header: "Programme", render: (r) => <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-lg">{r.filiere}</span> },
    {
      key: "statutDossier", header: "Statut",
      render: (r) => (
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", r.reintegre ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
          {r.reintegre ? "Réintégré" : "Abandon"}
        </span>
      ),
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setPreviewId(r.id); }}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Consulter"
          data-testid={`abandon-consulter-${r.id}`}
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Les abandons" }]}
        title="Les abandons"
        subtitle="Étudiants ayant abandonné leur formation, avec leur situation financière au moment de l'abandon"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="abandons-export">
              <Download size={14} /> Export excel
            </button>
            <button onClick={() => setLocation("/admin/abandons/nouveau")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="abandons-nouveau">
              <Plus size={14} /> Nouvel abandon
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={abandons as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un étudiant…"
        pageSize={25}
        onRowClick={(r) => setPreviewId((r as unknown as AbandonRecord).id)}
        emptyMessage="Aucun abandon enregistré."
      />

      {previewRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
              <h3 className="text-base font-bold text-white flex items-center gap-2"><Eye size={16} /> Consultation Abandon étudiant</h3>
              <button onClick={() => setPreviewId(null)} className="text-white/80 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={`${previewRecord.prenom} ${previewRecord.nom}`} size="lg" />
                <div>
                  <p className="font-mono text-xs text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{previewRecord.matricule}</p>
                  <p className="font-bold text-foreground">{previewRecord.prenom} {previewRecord.nom}</p>
                  <span className={cn("inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full", previewRecord.reintegre ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
                    {previewRecord.reintegre ? "Réintégré" : "Abandon"}
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Né(e) le {formatShortDate(previewRecord.dateNaissance)}{previewRecord.lieuNaissance ? ` à ${previewRecord.lieuNaissance}` : ""}
                {previewRecord.nationalite ? ` · ${previewRecord.nationalite}` : ""}
              </div>
              <div className="text-sm text-muted-foreground">{previewRecord.email} · {previewRecord.telephone}</div>

              <div className="p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground">
                Abandon validé par <strong className="text-foreground">{previewRecord.valideParLabel}</strong> le {formatShortDate(previewRecord.dateAbandon)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Cumul payé</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCFA(previewRecord.cumulPaye)}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl">
                  <p className="text-[11px] text-red-700 dark:text-red-300">Cumul impayé</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCFA(previewRecord.cumulImpaye)}</p>
                </div>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Sa classe à l&apos;abandon : </span>
                <span className="font-semibold text-foreground">{previewRecord.filiere} | {previewRecord.annee} | {previewRecord.niveau} | {previewRecord.classe}</span>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Session(s) abandonnée(s) : </span>
                {previewRecord.sessionsAbandonnees.map((s) => (
                  <span key={s} className="inline-block ml-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300">{s}</span>
                ))}
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Motif abandon :</p>
                <p className="text-foreground">{previewRecord.motif}</p>
              </div>

              {previewRecord.reintegre && (
                <p className="text-xs text-emerald-600">
                  Réintégré(e) par {previewRecord.reintegreParLabel} le {previewRecord.dateReintegration ? formatShortDate(previewRecord.dateReintegration) : "—"}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setPreviewId(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Fermer</button>
              {!previewRecord.reintegre && (
                <button onClick={() => handleReintegrer(previewRecord)} className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="abandon-reintegrer">
                  <RotateCcw size={14} /> Réintégrer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
