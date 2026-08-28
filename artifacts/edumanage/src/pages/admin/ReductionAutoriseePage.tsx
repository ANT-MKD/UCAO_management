import { useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Pencil, Trash2, Download, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useReductionsAutorisees } from "@/hooks/useFinanceSettingsStore";
import { reductionAutoriseeStore, type ReductionAutoriseeRecord } from "@/data/financeSettingsStore";
import { usePersonnel } from "@/hooks/usePersonnelStore";
import { useReductionsFrais } from "@/hooks/useReductionFraisStore";
import { totalReduitParPersonnelSurPeriode } from "@/data/reductionFraisStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

type Statut = "a_venir" | "actif" | "expire";

const STATUT_META: Record<Statut, { label: string; cls: string }> = {
  a_venir: { label: "À venir", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  actif: { label: "Actif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  expire: { label: "Expiré", cls: "bg-muted text-muted-foreground" },
};

function computeStatut(r: ReductionAutoriseeRecord): Statut {
  const today = new Date().toISOString().slice(0, 10);
  if (today < r.dateDebut) return "a_venir";
  if (today > r.dateFin) return "expire";
  return "actif";
}

interface FormState {
  personnelId: string;
  tauxMax: string;
  montantPlafond: string;
  dateDebut: string;
  dateFin: string;
}

const EMPTY_FORM: FormState = { personnelId: "", tauxMax: "", montantPlafond: "", dateDebut: "", dateFin: "" };

export default function ReductionAutoriseePage() {
  const reductions = useReductionsAutorisees();
  const personnel = usePersonnel();
  useReductionsFrais(); // s'abonne pour recalculer le plafond utilisé quand une réduction est accordée/annulée

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReductionAutoriseeRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ReductionAutoriseeRecord | null>(null);

  const personnelLabel = (id: string) => {
    const p = personnel.find((u) => u.id === id);
    return p ? `${p.username} - ${p.nom}` : "—";
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (r: ReductionAutoriseeRecord) => {
    setEditing(r);
    setForm({
      personnelId: r.personnelId,
      tauxMax: String(r.tauxMax),
      montantPlafond: String(r.montantPlafond),
      dateDebut: r.dateDebut,
      dateFin: r.dateFin,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.personnelId) {
      toast.error("Sélectionnez un utilisateur");
      return;
    }
    const taux = Number(form.tauxMax);
    if (!taux || taux <= 0 || taux > 100) {
      toast.error("Le taux maximum doit être compris entre 1 et 100%");
      return;
    }
    const plafond = Number(form.montantPlafond);
    if (!plafond || plafond <= 0) {
      toast.error("Le montant plafond doit être supérieur à 0");
      return;
    }
    if (!form.dateDebut || !form.dateFin) {
      toast.error("Les dates de début et de fin sont requises");
      return;
    }
    if (form.dateFin < form.dateDebut) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }
    const chevauchement = reductions.find((r) =>
      r.id !== editing?.id &&
      r.personnelId === form.personnelId &&
      r.dateDebut <= form.dateFin &&
      r.dateFin >= form.dateDebut
    );
    if (chevauchement) {
      toast.error(
        `${personnelLabel(form.personnelId)} a déjà une autorisation du ${formatShortDate(chevauchement.dateDebut)} au ${formatShortDate(chevauchement.dateFin)} — les périodes ne peuvent pas se chevaucher.`,
      );
      return;
    }
    if (editing) {
      reductionAutoriseeStore.update(editing.id, {
        personnelId: form.personnelId,
        tauxMax: taux,
        montantPlafond: plafond,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin,
      });
      toast.success("Autorisation mise à jour");
    } else {
      reductionAutoriseeStore.add({
        personnelId: form.personnelId,
        tauxMax: taux,
        montantPlafond: plafond,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin,
      });
      toast.success("Autorisation créée");
    }
    setModalOpen(false);
  };

  const desactiverMaintenant = (r: ReductionAutoriseeRecord) => {
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    reductionAutoriseeStore.update(r.id, { dateFin: hier < r.dateDebut ? r.dateDebut : hier });
    toast.success(`Autorisation de ${personnelLabel(r.personnelId)} désactivée`);
  };

  const confirmerSuppression = () => {
    if (!deleteTarget) return;
    reductionAutoriseeStore.remove(deleteTarget.id);
    toast.success("Autorisation supprimée");
    setDeleteTarget(null);
  };

  const exportExcel = () => {
    const rows = reductions.map((r) => ({
      Utilisateur: personnelLabel(r.personnelId),
      "Taux (%)": r.tauxMax,
      Plafond: r.montantPlafond,
      "Date début": formatShortDate(r.dateDebut),
      "Date fin": formatShortDate(r.dateFin),
      Statut: STATUT_META[computeStatut(r)].label,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Réductions autorisées");
    XLSX.writeFile(wb, `reductions-autorisees-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "personnelId", header: "Utilisateur", render: (r) => <span className="font-medium text-foreground">{personnelLabel(r.personnelId as string)}</span> },
    { key: "tauxMax", header: "Taux(%)", sortable: true, render: (r) => <span className="font-semibold text-foreground">{r.tauxMax as number}%</span> },
    {
      key: "montantPlafond",
      header: "Plafond",
      sortable: true,
      render: (r) => {
        const rec = r as unknown as ReductionAutoriseeRecord;
        const utilise = totalReduitParPersonnelSurPeriode(rec.personnelId, rec.dateDebut, rec.dateFin);
        const restant = Math.max(0, rec.montantPlafond - utilise);
        return (
          <div>
            <div>{formatCFA(rec.montantPlafond)}</div>
            <div className={cn("text-[10px] mt-0.5", restant === 0 ? "text-red-500" : "text-muted-foreground")}>
              Utilisé {formatCFA(utilise)} · Restant {formatCFA(restant)}
            </div>
          </div>
        );
      },
    },
    { key: "dateDebut", header: "Date début", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatShortDate(r.dateDebut as string)}</span> },
    { key: "dateFin", header: "Date fin", sortable: true, render: (r) => <span className="text-sm text-muted-foreground">{formatShortDate(r.dateFin as string)}</span> },
    {
      key: "statut",
      header: "Statut",
      render: (r) => {
        const meta = STATUT_META[computeStatut(r as unknown as ReductionAutoriseeRecord)];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", meta.cls)}>{meta.label}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) => {
        const rec = r as unknown as ReductionAutoriseeRecord;
        return (
          <div className="flex items-center gap-1">
            {computeStatut(rec) === "actif" && (
              <button
                onClick={(e) => { e.stopPropagation(); desactiverMaintenant(rec); }}
                className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950 text-muted-foreground hover:text-amber-600 transition-colors"
                aria-label="Désactiver maintenant"
                title="Désactiver maintenant"
                data-testid={`reduction-autorisee-desactiver-${r.id}`}
              >
                <PowerOff size={14} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(rec); }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              aria-label="Modifier"
              data-testid={`reduction-autorisee-editer-${r.id}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(rec); }}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"
              aria-label="Supprimer"
              data-testid={`reduction-autorisee-supprimer-${r.id}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Réduction" }, { label: "Réduction autorisée" }]}
        title="Les réductions autorisées"
        subtitle="Taux et plafond de réduction que chaque utilisateur est habilité à accorder"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="reduction-autorisee-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
              data-testid="reduction-autorisee-ajouter"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={reductions as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un utilisateur..."
        emptyMessage="Aucune donnée disponible dans le tableau"
      />

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier l'autorisation" : "Nouvelle autorisation"}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Utilisateur *</label>
            <select
              value={form.personnelId}
              onChange={(e) => setForm((f) => ({ ...f, personnelId: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="reduction-autorisee-utilisateur"
            >
              <option value="">Sélectionner</option>
              {personnel.map((p) => (
                <option key={p.id} value={p.id}>{p.username} - {p.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Taux maximum *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={form.tauxMax}
                onChange={(e) => setForm((f) => ({ ...f, tauxMax: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="reduction-autorisee-taux"
              />
              <span className="px-3 py-2.5 text-sm bg-muted rounded-xl text-muted-foreground">%</span>
            </div>
          </div>

          <p className="text-xs font-semibold text-primary uppercase tracking-wide pt-2 border-t border-border">Gestion de plafond</p>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant plafond *</label>
            <input
              type="number"
              min={0}
              value={form.montantPlafond}
              onChange={(e) => setForm((f) => ({ ...f, montantPlafond: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="reduction-autorisee-plafond"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date début *</label>
              <input
                type="date"
                value={form.dateDebut}
                onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="reduction-autorisee-date-debut"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date fin *</label>
              <input
                type="date"
                value={form.dateFin}
                onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="reduction-autorisee-date-fin"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          <button onClick={handleSave} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="reduction-autorisee-sauvegarder">
            Sauvegarder
          </button>
        </div>
      </FormModal>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4" style={{ boxShadow: "var(--shadow-lg)" }}>
            <h3 className="text-sm font-semibold text-foreground">Supprimer cette autorisation ?</h3>
            <p className="text-xs text-muted-foreground">
              {personnelLabel(deleteTarget.personnelId)} — taux max {deleteTarget.tauxMax}%. Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors">Annuler</button>
              <button onClick={confirmerSuppression} data-testid="reduction-autorisee-supprimer-confirmer" className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
