import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Plus, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useReprisFrais } from "@/hooks/useReprisFraisStore";
import { associerEtudiantReprise, validerReprisFrais, validerReprisFraisMasse, rejeterReprisFrais, type ReprisFraisLigne } from "@/data/reprisFraisStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { formatCFA, cn } from "@/lib/utils";

const STATUT_META: Record<string, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  valide: { label: "Validé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  rejete: { label: "Rejeté", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

const REP_TYPE_ID = "tf-seed-5";

export default function ReprisFraisPage() {
  const [, setLocation] = useLocation();
  const reprises = useReprisFrais();
  const etudiants = useStudentStore();
  const typesFrais = useTypesFrais();

  const [statutFilter, setStatutFilter] = useState("");
  const [nonAssocieesSeulement, setNonAssocieesSeulement] = useState(false);
  const [rejetTarget, setRejetTarget] = useState<ReprisFraisLigne | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const typeFraisLabel = (id: string) => typesFrais.find((t) => t.id === id)?.intitule ?? "Frais";
  const repTypeId = typesFrais.find((t) => t.code === "REP")?.id ?? REP_TYPE_ID;

  const etudiantLabel = (id?: string) => {
    if (!id) return undefined;
    const e = etudiants.find((s) => s.id === id);
    return e ? `${e.matricule} - ${e.prenom} ${e.nom}` : undefined;
  };

  const filtered = useMemo(() => {
    return reprises.filter((r) => {
      if (statutFilter && r.statut !== statutFilter) return false;
      if (nonAssocieesSeulement && (r.statut !== "en_attente" || r.etudiantId)) return false;
      return true;
    });
  }, [reprises, statutFilter, nonAssocieesSeulement]);

  const validables = filtered.filter((r) => r.statut === "en_attente" && r.etudiantId);
  const selectedValidables = selectedIds.filter((id) => validables.some((r) => r.id === id));

  const handleAssocier = (id: string, etudiantId: string) => {
    if (!etudiantId) return;
    associerEtudiantReprise(id, etudiantId);
  };

  const handleValider = (r: ReprisFraisLigne) => {
    const result = validerReprisFrais(r.id, repTypeId, typeFraisLabel);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(`Reprise validée — ${formatCFA(r.montant)} ajoutés au solde dû`);
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelectedIds((prev) => (prev.length === validables.length ? [] : validables.map((r) => r.id)));

  const handleValiderSelection = () => {
    const nb = validerReprisFraisMasse(selectedValidables, repTypeId, typeFraisLabel);
    toast.success(`${nb} reprise(s) validée(s)`);
    setSelectedIds([]);
  };

  const exportExcel = () => {
    const rows = filtered.map((r) => ({
      "Ancien code": r.ancienCode,
      Nom: r.nom,
      Prénom: r.prenom,
      "Année Scolaire": r.libelleAnneeScolaire,
      Montant: r.montant,
      Étudiant: etudiantLabel(r.etudiantId) ?? "Non associé",
      Statut: STATUT_META[r.statut].label,
      "Motif rejet": r.motifRejet ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reprise frais");
    XLSX.writeFile(wb, `reprise-frais-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const confirmerRejet = () => {
    if (!rejetTarget) return;
    if (!motifRejet.trim()) {
      toast.error("Le motif du rejet est obligatoire");
      return;
    }
    const result = rejeterReprisFrais(rejetTarget.id, motifRejet.trim());
    if (!result.ok) {
      toast.error(result.reason);
    } else {
      toast.success("Reprise rejetée");
    }
    setRejetTarget(null);
    setMotifRejet("");
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "select",
      header: "",
      render: (row) => {
        const r = row as unknown as ReprisFraisLigne;
        if (r.statut !== "en_attente" || !r.etudiantId) return null;
        return (
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            onChange={() => toggleSelect(r.id)}
            className="rounded"
            data-testid={`reprise-frais-select-${r.id}`}
          />
        );
      },
    },
    { key: "ancienCode", header: "Ancien code", sortable: true, render: (r) => <span className="font-mono text-xs">{r.ancienCode as string}</span> },
    { key: "nom", header: "Nom", sortable: true },
    { key: "prenom", header: "Prénom", sortable: true },
    { key: "libelleAnneeScolaire", header: "Année Scolaire", sortable: true },
    { key: "montant", header: "Montant", sortable: true, render: (r) => <span className="font-semibold">{formatCFA(r.montant as number)}</span> },
    {
      key: "etudiant",
      header: "Étudiant",
      render: (row) => {
        const r = row as unknown as ReprisFraisLigne;
        const label = etudiantLabel(r.etudiantId);
        if (label) return <span className="text-xs text-foreground">{label}</span>;
        if (r.statut !== "en_attente") return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <select
            className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            defaultValue=""
            onChange={(e) => handleAssocier(r.id, e.target.value)}
            data-testid={`reprise-frais-associer-${r.id}`}
          >
            <option value="" disabled>Associer un étudiant…</option>
            {[...etudiants].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => (
              <option key={e.id} value={e.id}>{e.matricule} - {e.prenom} {e.nom}</option>
            ))}
          </select>
        );
      },
    },
    {
      key: "statut",
      header: "Statut",
      render: (r) => {
        const meta = STATUT_META[r.statut as string];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", meta.cls)}>{meta.label}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as ReprisFraisLigne;
        if (r.statut !== "en_attente") return null;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleValider(r)}
              disabled={!r.etudiantId}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid={`reprise-frais-valider-${r.id}`}
            >
              <CheckCircle2 size={12} /> Valider
            </button>
            <button
              onClick={() => setRejetTarget(r)}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              data-testid={`reprise-frais-rejeter-${r.id}`}
            >
              <XCircle size={12} /> Rejeter
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Reprise frais" }, { label: "Reprise frais étudiant" }]}
        title="Reprise des frais étudiants"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="reprise-frais-filtre-statut"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="valide">Validé</option>
              <option value="rejete">Rejeté</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2">
              <input type="checkbox" checked={nonAssocieesSeulement} onChange={(e) => setNonAssocieesSeulement(e.target.checked)} className="rounded" data-testid="reprise-frais-non-associees" />
              Non associées uniquement
            </label>
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="reprise-frais-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={() => setLocation("/admin/reprise-frais/new")}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
              data-testid="reprise-frais-nouvelle"
            >
              <Plus size={14} /> Nouvelle reprise
            </button>
          </div>
        }
      />

      {validables.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={selectedIds.length === validables.length} onChange={toggleSelectAll} className="rounded" data-testid="reprise-frais-select-all" />
            Sélectionner tout ({validables.length} associée(s) prête(s))
          </label>
          {selectedValidables.length > 0 && (
            <button
              onClick={handleValiderSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
              data-testid="reprise-frais-valider-selection"
            >
              <CheckCircle2 size={12} /> Valider la sélection ({selectedValidables.length})
            </button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher..."
        emptyMessage="Aucune donnée disponible dans le tableau"
      />

      {rejetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4" style={{ boxShadow: "var(--shadow-lg)" }}>
            <h3 className="text-sm font-semibold text-foreground">Rejeter cette reprise ?</h3>
            <p className="text-xs text-muted-foreground">
              {rejetTarget.nom} {rejetTarget.prenom} — {formatCFA(rejetTarget.montant)} ({rejetTarget.libelleAnneeScolaire}). Cette dette ne sera pas reprise.
            </p>
            <div>
              <label className="block text-xs font-medium text-red-500 mb-1.5">Motif *</label>
              <textarea
                value={motifRejet}
                onChange={(e) => setMotifRejet(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background resize-y"
                data-testid="reprise-frais-motif-rejet"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejetTarget(null); setMotifRejet(""); }} className="px-4 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors">Annuler</button>
              <button onClick={confirmerRejet} data-testid="reprise-frais-confirmer-rejet" className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
