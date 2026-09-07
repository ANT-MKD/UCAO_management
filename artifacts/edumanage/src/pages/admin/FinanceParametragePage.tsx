import { useRef, useState } from "react";
import { Link } from "wouter";
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import {
  typeFraisStore,
  modePaiementFinanceStore,
  typeFactureStore,
  modeleFraisStore,
  articleServiceStore,
  banqueStore,
  activiteServiceStore,
  importArticlesService,
  importActivitesService,
  type TypeFraisRecord,
  type ModePaiementFinanceRecord,
  type TypeFactureRecord,
  type ModeleFraisRecord,
  type ArticleServiceRecord,
  type BanqueRecord,
  type ActiviteServiceRecord,
} from "@/data/financeSettingsStore";
import {
  useTypesFrais,
  useModesPaiementFinance,
  useTypesFacture,
  useModelesFrais,
  useArticlesService,
  useBanques,
  useActivitesService,
} from "@/hooks/useFinanceSettingsStore";
import {
  parseArticleServiceExcel,
  downloadArticleServiceTemplate,
  parseActiviteServiceExcel,
  downloadActiviteServiceTemplate,
} from "@/lib/financeArticleImport";
import { formatCFA, cn } from "@/lib/utils";

const SECTIONS = [
  { id: "type-frais", label: "Type frais" },
  { id: "mode-paiement", label: "Mode de paiement" },
  { id: "type-facture", label: "Type facture" },
  { id: "modele-frais", label: "Modèle de frais" },
  { id: "article-service", label: "Article autre service" },
  { id: "banque", label: "Banque" },
  { id: "activite-service", label: "Activités autres services" },
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function DeleteConfirm({
  open,
  label,
  onClose,
  onConfirm,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
        <h2 className="text-base font-semibold mb-1">Supprimer « {label} » ?</h2>
        <p className="text-xs text-muted-foreground mb-4">Cette action est irréversible.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  onAdd,
  extraActions,
  children,
}: {
  title: string;
  onAdd: () => void;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h3>
        <div className="flex items-center gap-2">
          {extraActions}
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function TypeFraisSection() {
  const items = useTypesFrais();
  const [editing, setEditing] = useState<TypeFraisRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [remarques, setRemarques] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TypeFraisRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setRemarques("");
    setCreating(true);
  };
  const startEdit = (r: TypeFraisRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setRemarques(r.remarques ?? "");
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      typeFraisStore.update(editing.id, { code: code.trim(), intitule: intitule.trim(), remarques: remarques.trim() || undefined });
      toast.success("Type de frais modifié");
    } else {
      typeFraisStore.add({ code: code.trim(), intitule: intitule.trim(), remarques: remarques.trim() || undefined });
      toast.success("Type de frais ajouté");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les types de frais" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun type de frais.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-left px-4 py-3">Remarques</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.remarques ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier le type frais" : "Nouveau type frais"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Remarques</label>
            <textarea value={remarques} onChange={(e) => setRemarques(e.target.value)} rows={3} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) typeFraisStore.remove(deleteTarget.id);
          toast.success("Type de frais supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function ModePaiementSection() {
  const items = useModesPaiementFinance();
  const [editing, setEditing] = useState<ModePaiementFinanceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ModePaiementFinanceRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setCreating(true);
  };
  const startEdit = (r: ModePaiementFinanceRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      modePaiementFinanceStore.update(editing.id, { code: code.trim(), intitule: intitule.trim() });
      toast.success("Mode de paiement modifié");
    } else {
      modePaiementFinanceStore.add({ code: code.trim(), intitule: intitule.trim() });
      toast.success("Mode de paiement ajouté");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les modes de paiement" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun mode de paiement.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier le mode de paiement" : "Nouveau mode de paiement"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) modePaiementFinanceStore.remove(deleteTarget.id);
          toast.success("Mode de paiement supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function TypeFactureSection() {
  const items = useTypesFacture();
  const [editing, setEditing] = useState<TypeFactureRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [facturePedagogique, setFacturePedagogique] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TypeFactureRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setFacturePedagogique(false);
    setCreating(true);
  };
  const startEdit = (r: TypeFactureRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setFacturePedagogique(r.facturePedagogique);
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      typeFactureStore.update(editing.id, { code: code.trim(), intitule: intitule.trim(), facturePedagogique });
      toast.success("Type de facture modifié");
    } else {
      typeFactureStore.add({ code: code.trim(), intitule: intitule.trim(), facturePedagogique });
      toast.success("Type de facture ajouté");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les types de facture" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun type de facture.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-center px-4 py-3">Facture pédagogique</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        r.facturePedagogique ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {r.facturePedagogique ? "Oui" : "Non"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier le type facture" : "Nouveau type facture"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={facturePedagogique} onChange={(e) => setFacturePedagogique(e.target.checked)} className="rounded" />
            Facture pédagogique
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) typeFactureStore.remove(deleteTarget.id);
          toast.success("Type de facture supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function ModeleFraisSection() {
  const items = useModelesFrais();
  const [editing, setEditing] = useState<ModeleFraisRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ModeleFraisRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setCreating(true);
  };
  const startEdit = (r: ModeleFraisRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      modeleFraisStore.update(editing.id, { code: code.trim(), intitule: intitule.trim() });
      toast.success("Modèle de frais modifié");
    } else {
      modeleFraisStore.add({ code: code.trim(), intitule: intitule.trim() });
      toast.success("Modèle de frais ajouté");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les modèles de frais" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun modèle de frais.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier le modèle de frais" : "Nouveau modèle de frais"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) modeleFraisStore.remove(deleteTarget.id);
          toast.success("Modèle de frais supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function ArticleServiceSection() {
  const items = useArticlesService();
  const [editing, setEditing] = useState<ArticleServiceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [prixUnitaire, setPrixUnitaire] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ArticleServiceRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setPrixUnitaire("");
    setCreating(true);
  };
  const startEdit = (r: ArticleServiceRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setPrixUnitaire(String(r.prixUnitaire));
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim() || !prixUnitaire.trim()) {
      toast.error("Code, intitulé et prix unitaire sont obligatoires");
      return;
    }
    const prix = Number(prixUnitaire);
    if (!Number.isFinite(prix) || prix < 0) {
      toast.error("Prix unitaire invalide");
      return;
    }
    if (editing) {
      articleServiceStore.update(editing.id, { code: code.trim(), intitule: intitule.trim(), prixUnitaire: prix });
      toast.success("Article modifié");
    } else {
      articleServiceStore.add({ code: code.trim(), intitule: intitule.trim(), prixUnitaire: prix });
      toast.success("Article ajouté");
    }
    close();
  };

  const handleFile = async (file: File) => {
    setImportLoading(true);
    setImportMessage("");
    try {
      const rows = await parseArticleServiceExcel(file);
      if (rows.length === 0) {
        setImportMessage("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const count = importArticlesService(rows);
      setImportMessage(`Import réussi : ${count} article(s) importé(s).`);
    } catch (err) {
      console.error(err);
      setImportMessage("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <SectionShell
        title="Les articles autres services"
        onAdd={startCreate}
        extraActions={
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
          >
            <FileSpreadsheet size={14} /> Importer
          </button>
        }
      >
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun article.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-right px-4 py-3">Prix Unitaire</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCFA(r.prixUnitaire)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier l'article" : "Nouvel article"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Prix Unitaire <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} value={prixUnitaire} onChange={(e) => setPrixUnitaire(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <FormModal open={importOpen} onClose={() => setImportOpen(false)} title="Importer des articles" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Fichier Excel (.xlsx) avec les colonnes Code, Intitulé, Prix Unitaire.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadArticleServiceTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
            >
              <Download size={14} /> Télécharger le modèle
            </button>
            <button
              type="button"
              disabled={importLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-60"
            >
              <Upload size={14} /> {importLoading ? "Import..." : "Choisir un fichier"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
          {importMessage && (
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">{importMessage}</div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Fermer
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) articleServiceStore.remove(deleteTarget.id);
          toast.success("Article supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function BanqueSection() {
  const items = useBanques();
  const [editing, setEditing] = useState<BanqueRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [numeroCompte, setNumeroCompte] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BanqueRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setNumeroCompte("");
    setCreating(true);
  };
  const startEdit = (r: BanqueRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setNumeroCompte(r.numeroCompte);
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim() || !numeroCompte.trim()) {
      toast.error("Code, intitulé et numéro de compte sont obligatoires");
      return;
    }
    if (editing) {
      banqueStore.update(editing.id, { code: code.trim(), intitule: intitule.trim(), numeroCompte: numeroCompte.trim() });
      toast.success("Banque modifiée");
    } else {
      banqueStore.add({ code: code.trim(), intitule: intitule.trim(), numeroCompte: numeroCompte.trim() });
      toast.success("Banque ajoutée");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Liste des banques" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune banque.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-left px-4 py-3">Numéro Compte</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.numeroCompte}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier la banque" : "Nouvelle banque"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Numéro Compte <span className="text-red-500">*</span>
            </label>
            <input value={numeroCompte} onChange={(e) => setNumeroCompte(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) banqueStore.remove(deleteTarget.id);
          toast.success("Banque supprimée");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function ActiviteServiceSection() {
  const items = useActivitesService();
  const [editing, setEditing] = useState<ActiviteServiceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [montant, setMontant] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ActiviteServiceRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setMontant("");
    setCreating(true);
  };
  const startEdit = (r: ActiviteServiceRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setMontant(String(r.montant));
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim() || !montant.trim()) {
      toast.error("Code, intitulé et montant sont obligatoires");
      return;
    }
    const value = Number(montant);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Montant invalide");
      return;
    }
    if (editing) {
      activiteServiceStore.update(editing.id, { code: code.trim(), intitule: intitule.trim(), montant: value });
      toast.success("Activité modifiée");
    } else {
      activiteServiceStore.add({ code: code.trim(), intitule: intitule.trim(), montant: value });
      toast.success("Activité ajoutée");
    }
    close();
  };

  const handleFile = async (file: File) => {
    setImportLoading(true);
    setImportMessage("");
    try {
      const rows = await parseActiviteServiceExcel(file);
      if (rows.length === 0) {
        setImportMessage("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const count = importActivitesService(rows);
      setImportMessage(`Import réussi : ${count} activité(s) importée(s).`);
    } catch (err) {
      console.error(err);
      setImportMessage("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <SectionShell
        title="Les activités autres services"
        onAdd={startCreate}
        extraActions={
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
          >
            <FileSpreadsheet size={14} /> Importer
          </button>
        }
      >
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune activité.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCFA(r.montant)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier l'activité" : "Nouvelle activité"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Montant <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <FormModal open={importOpen} onClose={() => setImportOpen(false)} title="Importer des activités" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Fichier Excel (.xlsx) avec les colonnes Code, Intitulé, Montant.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadActiviteServiceTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
            >
              <Download size={14} /> Télécharger le modèle
            </button>
            <button
              type="button"
              disabled={importLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-60"
            >
              <Upload size={14} /> {importLoading ? "Import..." : "Choisir un fichier"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
          {importMessage && (
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">{importMessage}</div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Fermer
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) activiteServiceStore.remove(deleteTarget.id);
          toast.success("Activité supprimée");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

export default function FinanceParametragePage({ section }: { section: string }) {
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div>
      <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Paramétrage Finance" }]} title="Paramétrage Finance" />

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="bg-card border border-border rounded-xl p-2 h-fit" style={{ boxShadow: "var(--shadow-sm)" }}>
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/admin/finance-parametrage/${s.id}`}
              className={cn(
                "block px-3 py-2.5 rounded-lg text-sm transition-colors",
                s.id === current.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div>
          {current.id === "type-frais" && <TypeFraisSection />}
          {current.id === "mode-paiement" && <ModePaiementSection />}
          {current.id === "type-facture" && <TypeFactureSection />}
          {current.id === "modele-frais" && <ModeleFraisSection />}
          {current.id === "article-service" && <ArticleServiceSection />}
          {current.id === "banque" && <BanqueSection />}
          {current.id === "activite-service" && <ActiviteServiceSection />}
        </div>
      </div>
    </div>
  );
}
