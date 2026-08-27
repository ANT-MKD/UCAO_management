import { useState } from "react";
import { Link } from "wouter";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import {
  typeFraisStore,
  modePaiementFinanceStore,
  typeFactureStore,
  type TypeFraisRecord,
  type ModePaiementFinanceRecord,
  type TypeFactureRecord,
} from "@/data/financeSettingsStore";
import { useTypesFrais, useModesPaiementFinance, useTypesFacture } from "@/hooks/useFinanceSettingsStore";
import { cn } from "@/lib/utils";

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
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Ajouter
        </button>
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

function ComingSoonSection({ label }: { label: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
      La section « {label} » n&apos;est pas encore configurée.
    </div>
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
          {current.id === "modele-frais" && <ComingSoonSection label="Modèle de frais" />}
          {current.id === "article-service" && <ComingSoonSection label="Article autre service" />}
          {current.id === "banque" && <ComingSoonSection label="Banque" />}
          {current.id === "activite-service" && <ComingSoonSection label="Activités autres services" />}
        </div>
      </div>
    </div>
  );
}
