import { useLocation } from "wouter";
import { ArrowLeft, Info } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useExportsComptables } from "@/hooks/useExportComptableStore";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";

export default function ExportComptableDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const exports = useExportsComptables();

  const record = exports.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Export comptable", href: "/admin/export-comptable" }]}
          title="Export introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cet export n&apos;existe pas.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Export comptable", href: "/admin/export-comptable" }, { label: record.reference }]}
        title={`Export ${record.reference}`}
        subtitle={`Généré le ${formatDate(record.date)} par ${record.genereePar}`}
        actions={
          <button onClick={() => setLocation("/admin/export-comptable")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="max-w-3xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-6 grid sm:grid-cols-2 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Période couverte</p>
            <p className="text-sm font-medium text-foreground">{formatShortDate(record.periodeDebut)} → {formatShortDate(record.periodeFin)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Généré par</p>
            <p className="text-sm font-medium text-foreground">{record.genereePar}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nombre de mouvements</p>
            <p className="text-sm font-medium text-foreground">{record.nbLignes}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Date de génération</p>
            <p className="text-sm font-medium text-foreground">{formatDate(record.date)}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold">Recettes</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCFA(record.totalRecettes)}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">
            <p className="text-[10px] text-red-600 dark:text-red-300 uppercase font-semibold">Dépenses</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-300">{formatCFA(record.totalDepenses)}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl">
            <p className="text-[10px] text-primary uppercase font-semibold">Solde net</p>
            <p className={cn("text-sm font-bold", record.soldeNet >= 0 ? "text-primary" : "text-red-600")}>{formatCFA(record.soldeNet)}</p>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ajustements (réductions)</p>
            <p className="text-sm font-bold text-foreground">{formatCFA(record.totalAjustements)}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide px-6 pt-5 pb-3">Ventilation par catégorie</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase">
                <th className="text-left px-6 py-2 font-medium">Catégorie</th>
                <th className="text-right px-6 py-2 font-medium">Lignes</th>
                <th className="text-right px-6 py-2 font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {record.parCategorie.filter((c) => c.nbLignes > 0).map((c) => (
                <tr key={c.categorie} className="border-b border-border last:border-0">
                  <td className="px-6 py-2.5 text-foreground">{c.label}</td>
                  <td className="px-6 py-2.5 text-right text-muted-foreground">{c.nbLignes}</td>
                  <td className="px-6 py-2.5 text-right font-medium text-foreground">{formatCFA(c.montant)}</td>
                </tr>
              ))}
              {record.parCategorie.every((c) => c.nbLignes === 0) && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-muted-foreground">Aucune catégorie avec mouvement.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 text-muted-foreground text-xs">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          Le fichier Excel généré n&apos;est pas conservé sur la plateforme — seul ce résumé reste consultable. Utilisez « Régénérer » depuis la liste des exports pour reproduire le fichier avec les mêmes filtres.
        </div>
      </div>
    </div>
  );
}
