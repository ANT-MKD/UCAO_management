import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Download, Eye, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useEncaissements } from "@/hooks/useEncaissementStore";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import { useAvoirDepots } from "@/hooks/useAvoirDepotStore";
import { useRemboursementsAvoir } from "@/hooks/useRemboursementAvoirStore";
import { useReductionsFrais } from "@/hooks/useReductionFraisStore";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { useFacturesAutreService } from "@/hooks/useFactureAutreServiceStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { usePersonnel } from "@/hooks/usePersonnelStore";
import { useExportsComptables } from "@/hooks/useExportComptableStore";
import { enregistrerExportComptable, trouverExportIdentique, type ExportComptableRecord } from "@/data/exportComptableStore";
import { useAuth } from "@/contexts/AuthContext";
import {
  construireLignesComptables,
  calculerTotaux,
  calculerTotauxParCategorie,
  genererExcelComptable,
  CATEGORIE_LABELS,
  TOUTES_CATEGORIES,
  type CategorieExport,
} from "@/lib/exportComptable";
import { formatCFA, formatShortDate, formatDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ExportComptablePage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const encaissements = useEncaissements();
  const paiementsProfesseur = useDecomptePaiements();
  const avoirsDepots = useAvoirDepots();
  const avoirsRemboursements = useRemboursementsAvoir();
  const reductions = useReductionsFrais();
  const prisesEnCharge = usePrisesEnCharge();
  const facturesAutresServices = useFacturesAutreService();
  const etudiants = useStudentStore();
  const personnel = usePersonnel();
  const exports = useExportsComptables();

  const [periodeDebut, setPeriodeDebut] = useState(todayMinus(30));
  const [periodeFin, setPeriodeFin] = useState(new Date().toISOString().slice(0, 10));
  const [categories, setCategories] = useState<CategorieExport[]>(TOUTES_CATEGORIES);
  const [generating, setGenerating] = useState(false);

  const etudiantLabel = (id: string) => {
    const e = etudiants.find((s) => s.id === id);
    return e ? `${e.matricule} - ${e.prenom} ${e.nom}` : "—";
  };
  const personnelLabel = (id: string) => {
    const p = personnel.find((u) => u.id === id);
    return p ? `${p.username} - ${p.nom}` : "—";
  };

  const toggleCategorie = (cat: CategorieExport) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const lignes = useMemo(() => {
    if (!periodeDebut || !periodeFin || categories.length === 0) return [];
    return construireLignesComptables(
      { encaissements, paiementsProfesseur, avoirsDepots, avoirsRemboursements, reductions, prisesEnCharge, facturesAutresServices, etudiantLabel, personnelLabel },
      periodeDebut,
      periodeFin,
      categories,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encaissements, paiementsProfesseur, avoirsDepots, avoirsRemboursements, reductions, prisesEnCharge, facturesAutresServices, etudiants, personnel, periodeDebut, periodeFin, categories]);

  const totaux = calculerTotaux(lignes);

  const exportIdentique = useMemo(
    () => (periodeDebut && periodeFin && categories.length > 0 ? trouverExportIdentique(periodeDebut, periodeFin, categories) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exports, periodeDebut, periodeFin, categories],
  );

  const handleGenerer = () => {
    if (!periodeDebut || !periodeFin) {
      toast.error("Sélectionnez une période");
      return;
    }
    if (periodeFin < periodeDebut) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }
    if (lignes.length === 0) {
      toast.error("Aucun mouvement trouvé pour cette période et ces catégories");
      return;
    }
    setGenerating(true);
    try {
      genererExcelComptable(lignes, periodeDebut, periodeFin);
      const record = enregistrerExportComptable({
        periodeDebut,
        periodeFin,
        categories,
        parCategorie: calculerTotauxParCategorie(lignes),
        genereePar: currentUser?.name ?? "Administration",
        totalRecettes: totaux.totalRecettes,
        totalDepenses: totaux.totalDepenses,
        totalAjustements: totaux.totalAjustements,
        nbLignes: lignes.length,
      });
      toast.success(`Export ${record.reference} généré — ${lignes.length} ligne(s)`);
    } finally {
      setGenerating(false);
    }
  };

  const regenerer = (record: ExportComptableRecord) => {
    setPeriodeDebut(record.periodeDebut);
    setPeriodeFin(record.periodeFin);
    setCategories(record.categories as CategorieExport[]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Filtres repris de cet export — vérifiez l'aperçu puis générez à nouveau");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "reference", header: "Référence", sortable: true },
    {
      key: "periode",
      header: "Période",
      render: (row) => {
        const r = row as unknown as ExportComptableRecord;
        return <span className="text-sm">{formatShortDate(r.periodeDebut)} → {formatShortDate(r.periodeFin)}</span>;
      },
    },
    { key: "date", header: "Généré le", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.date as string)}</span> },
    { key: "nbLignes", header: "Lignes", sortable: true },
    { key: "totalRecettes", header: "Recettes", sortable: true, render: (r) => <span className="text-emerald-600 font-semibold">{formatCFA(r.totalRecettes as number)}</span> },
    { key: "totalDepenses", header: "Dépenses", sortable: true, render: (r) => <span className="text-red-500 font-semibold">{formatCFA(r.totalDepenses as number)}</span> },
    { key: "soldeNet", header: "Solde net", sortable: true, render: (r) => <span className="font-bold">{formatCFA(r.soldeNet as number)}</span> },
    { key: "genereePar", header: "Généré par", render: (r) => <span className="text-sm text-muted-foreground">{r.genereePar as string}</span> },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as ExportComptableRecord;
        return (
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={() => setLocation(`/admin/export-comptable/${r.id}`)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Voir le détail"
              data-testid={`export-comptable-view-${r.id}`}
            >
              <Eye size={14} />
            </button>
            <button
              onClick={() => regenerer(r)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Régénérer avec les mêmes filtres"
              data-testid={`export-comptable-regenerer-${r.id}`}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Export comptable" }]}
        title="Export comptable"
        subtitle="Consolide les mouvements financiers réels (encaissements, paiements professeur, avoirs, réductions, prises en charge, factures autres services) sur une période"
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de début *</label>
            <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} className={inputClass} data-testid="export-periode-debut" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de fin *</label>
            <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} className={inputClass} data-testid="export-periode-fin" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Catégories à inclure</label>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(Object.entries(CATEGORIE_LABELS) as [CategorieExport, string][]).map(([cat, label]) => (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2 border border-border rounded-xl hover:bg-muted/40 transition-colors">
                <input type="checkbox" checked={categories.includes(cat)} onChange={() => toggleCategorie(cat)} className="rounded" data-testid={`export-cat-${cat}`} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold">Recettes</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCFA(totaux.totalRecettes)}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">
            <p className="text-[10px] text-red-600 dark:text-red-300 uppercase font-semibold">Dépenses</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-300">{formatCFA(totaux.totalDepenses)}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl">
            <p className="text-[10px] text-primary uppercase font-semibold">Solde net</p>
            <p className={cn("text-sm font-bold", totaux.soldeNet >= 0 ? "text-primary" : "text-red-600")}>{formatCFA(totaux.soldeNet)}</p>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ajustements (réductions)</p>
            <p className="text-sm font-bold text-foreground">{formatCFA(totaux.totalAjustements)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{lignes.length} mouvement(s) trouvé(s) pour cette sélection.</p>

        {exportIdentique && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs" data-testid="export-comptable-doublon">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Un export identique (même période, mêmes catégories) existe déjà : <strong>{exportIdentique.reference}</strong> généré le {formatDate(exportIdentique.date)} par {exportIdentique.genereePar}.
          </div>
        )}

        <button
          onClick={handleGenerer}
          disabled={generating || lignes.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="export-generer"
        >
          <Download size={14} /> {generating ? "Génération…" : "Générer l'export"}
        </button>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-3">Historique des exports</h3>
      <DataTable
        columns={columns}
        data={exports as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher..."
        emptyMessage="Aucun export généré pour l'instant"
      />
    </div>
  );
}
