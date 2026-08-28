import { useState } from "react";
import * as XLSX from "xlsx";
import { Settings2, Pencil, RotateCcw, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useAuth } from "@/contexts/AuthContext";
import { useScolariteConfigs, useValeursParDefautScolarite } from "@/hooks/useScolariteConfigStore";
import {
  updateScolariteConfig,
  updateValeursParDefaut,
  appliquerValeursParDefaut,
  type ScolariteConfigRecord,
  type ScolariteConfigPatch,
} from "@/data/scolariteConfigStore";
import { cn, formatDate } from "@/lib/utils";

const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const EMPTY_FORM: ScolariteConfigPatch = { noteBareme: 20, cumulCredit: true, moyennePassage: 10, moyenneEliminatoire: 0 };

export default function ParametrageScolaritePage() {
  const { currentUser } = useAuth();
  const configs = useScolariteConfigs();
  const valeursParDefaut = useValeursParDefautScolarite();

  const [editing, setEditing] = useState<ScolariteConfigRecord | null>(null);
  const [form, setForm] = useState<ScolariteConfigPatch>(EMPTY_FORM);
  const [defautModalOpen, setDefautModalOpen] = useState(false);
  const [defautForm, setDefautForm] = useState<ScolariteConfigPatch>(EMPTY_FORM);

  const auteur = () => currentUser?.name ?? "Administration";

  const openEdit = (r: ScolariteConfigRecord) => {
    setEditing(r);
    setForm({ noteBareme: r.noteBareme, cumulCredit: r.cumulCredit, moyennePassage: r.moyennePassage, moyenneEliminatoire: r.moyenneEliminatoire });
  };

  const handleSave = () => {
    if (!editing) return;
    updateScolariteConfig(editing.id, form, auteur());
    toast.success(`Paramètres mis à jour — ${editing.filiere}`);
    setEditing(null);
  };

  const handleReinitialiser = () => {
    if (!editing) return;
    appliquerValeursParDefaut(editing.id, auteur());
    setForm({ ...valeursParDefaut });
    toast.success("Réinitialisé aux valeurs par défaut");
  };

  const openDefautModal = () => {
    setDefautForm({ ...valeursParDefaut });
    setDefautModalOpen(true);
  };

  const handleSaveDefaut = () => {
    updateValeursParDefaut(defautForm, auteur());
    toast.success("Valeurs par défaut mises à jour");
    setDefautModalOpen(false);
  };

  const exportExcel = () => {
    const rows = configs.map((c) => ({
      Programme: c.filiere,
      "Note B.": c.noteBareme,
      "Cumul crédit ?": c.cumulCredit ? "Oui" : "Non",
      "Moy. passage": c.moyennePassage,
      "Moy. éliminatoire": c.moyenneEliminatoire,
      "Modifié par": c.modifiePar ?? "",
      "Modifié le": c.modifieLe ? formatDate(c.modifieLe) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paramétrage scolarité");
    XLSX.writeFile(wb, `parametrage-scolarite-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const eliminatoireChangeeVersHaut = !!editing && form.moyenneEliminatoire > 0 && form.moyenneEliminatoire !== editing.moyenneEliminatoire;

  const columns: Column<Record<string, unknown>>[] = [
    { key: "filiere", header: "Programme", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.filiere as string}</span> },
    { key: "noteBareme", header: "Note B.", sortable: true, render: (r) => <span>{r.noteBareme as number}</span> },
    {
      key: "cumulCredit",
      header: "Cumul crédit ?",
      render: (r) => (
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", r.cumulCredit ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300")}>
          {r.cumulCredit ? "Oui" : "Non"}
        </span>
      ),
    },
    { key: "moyennePassage", header: "Moy. passage", sortable: true, render: (r) => <span>{r.moyennePassage as number}</span> },
    {
      key: "moyenneEliminatoire",
      header: "Moy. éliminatoire",
      sortable: true,
      render: (r) => {
        const v = r.moyenneEliminatoire as number;
        return v > 0 ? <span className="text-amber-700 dark:text-amber-300 font-medium">{v}</span> : <span className="text-muted-foreground">{v}</span>;
      },
    },
    {
      key: "modifie",
      header: "Dernière modification",
      render: (row) => {
        const r = row as unknown as ScolariteConfigRecord;
        return r.modifiePar ? (
          <div className="text-xs text-muted-foreground">
            <div>{r.modifiePar}</div>
            <div>{formatDate(r.modifieLe!)}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as ScolariteConfigRecord;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            aria-label="Modifier"
            data-testid={`scolarite-config-editer-${r.id}`}
          >
            <Pencil size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Paramétrage scolarité" }]}
        title="Paramétrage scolarité"
        subtitle="Barème de notation, cumul des crédits, moyenne de passage et moyenne éliminatoire par programme"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="scolarite-config-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={openDefautModal}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="scolarite-config-valeurs-defaut"
            >
              <Settings2 size={14} /> Valeurs par défaut
            </button>
          </div>
        }
      />

      <h3 className="text-sm font-semibold text-foreground mb-3">Paramétrage indice cumul crédit, moyenne passage, ....</h3>

      <DataTable
        columns={columns}
        data={configs as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un programme..."
        emptyMessage="Aucun programme"
      />

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Modifier — ${editing.filiere}` : ""}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note de base (barème)</label>
            <input
              type="number" min={0} value={form.noteBareme}
              onChange={(e) => setForm((f) => ({ ...f, noteBareme: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-config-bareme"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" checked={form.cumulCredit}
              onChange={(e) => setForm((f) => ({ ...f, cumulCredit: e.target.checked }))}
              className="rounded" data-testid="scolarite-config-cumul-credit"
            />
            Cumul des crédits entre semestres
          </label>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne de passage</label>
            <input
              type="number" min={0} step={0.5} value={form.moyennePassage}
              onChange={(e) => setForm((f) => ({ ...f, moyennePassage: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-config-moyenne-passage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne éliminatoire</label>
            <input
              type="number" min={0} step={0.5} value={form.moyenneEliminatoire}
              onChange={(e) => setForm((f) => ({ ...f, moyenneEliminatoire: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-config-moyenne-eliminatoire"
            />
            <p className="text-[11px] text-muted-foreground mt-1">0 = désactivée. Au-dessus de 0, tout étudiant sous ce seuil est automatiquement exclu en délibération.</p>
          </div>

          {eliminatoireChangeeVersHaut && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs" data-testid="scolarite-config-avertissement-eliminatoire">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Vous modifiez la moyenne éliminatoire de {editing?.moyenneEliminatoire} à {form.moyenneEliminatoire} — cela peut changer immédiatement les décisions d&apos;exclusion à la prochaine délibération pour {editing?.filiere}.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="scolarite-config-sauvegarder">
              Enregistrer
            </button>
            <button onClick={handleReinitialiser} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors" data-testid="scolarite-config-reinitialiser">
              <RotateCcw size={14} /> Défaut
            </button>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={defautModalOpen}
        onClose={() => setDefautModalOpen(false)}
        title="Valeurs par défaut"
        subtitle={
          valeursParDefaut.modifiePar
            ? `Utilisées pour réinitialiser un programme — n'affectent pas les programmes déjà configurés · Dernière modification : ${valeursParDefaut.modifiePar}, ${formatDate(valeursParDefaut.modifieLe!)}`
            : "Utilisées pour réinitialiser un programme — n'affectent pas les programmes déjà configurés"
        }
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note de base (barème)</label>
            <input
              type="number" min={0} value={defautForm.noteBareme}
              onChange={(e) => setDefautForm((f) => ({ ...f, noteBareme: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-defaut-bareme"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" checked={defautForm.cumulCredit}
              onChange={(e) => setDefautForm((f) => ({ ...f, cumulCredit: e.target.checked }))}
              className="rounded" data-testid="scolarite-defaut-cumul-credit"
            />
            Cumul des crédits entre semestres
          </label>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne de passage</label>
            <input
              type="number" min={0} step={0.5} value={defautForm.moyennePassage}
              onChange={(e) => setDefautForm((f) => ({ ...f, moyennePassage: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-defaut-moyenne-passage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne éliminatoire</label>
            <input
              type="number" min={0} step={0.5} value={defautForm.moyenneEliminatoire}
              onChange={(e) => setDefautForm((f) => ({ ...f, moyenneEliminatoire: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-defaut-moyenne-eliminatoire"
            />
          </div>
          <button onClick={handleSaveDefaut} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="scolarite-defaut-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}
