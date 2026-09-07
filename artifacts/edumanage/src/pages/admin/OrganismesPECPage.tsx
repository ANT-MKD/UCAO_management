import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import {
  addOrganismePEC,
  updateOrganismePEC,
  deleteOrganismePEC,
  type OrganismePECRecord,
  type OrganismePECPayload,
} from "@/data/organismePECStore";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const EMPTY_FORM: OrganismePECPayload = {
  intitule: "",
  adresse: "",
  telephone: "",
  email: "",
  remarques: "",
  contactNom: "",
  contactTelephone: "",
  contactEmail: "",
};

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

export default function OrganismesPECPage() {
  const [, setLocation] = useLocation();
  const organismes = useOrganismesPEC();
  const [filterOrganisme, setFilterOrganisme] = useState("");
  const [filterTelephone, setFilterTelephone] = useState("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<OrganismePECRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganismePECRecord | null>(null);
  const [form, setForm] = useState<OrganismePECPayload>(EMPTY_FORM);

  const open = creating || !!editing;

  const filtered = useMemo(() => {
    return organismes.filter((o) => {
      if (filterOrganisme && !o.intitule.toLowerCase().includes(filterOrganisme.toLowerCase())) return false;
      if (filterTelephone && !(o.telephone ?? "").toLowerCase().includes(filterTelephone.toLowerCase())) return false;
      return true;
    });
  }, [organismes, filterOrganisme, filterTelephone]);

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setCreating(true);
  };

  const startEdit = (o: OrganismePECRecord) => {
    setForm({
      intitule: o.intitule,
      adresse: o.adresse,
      telephone: o.telephone ?? "",
      email: o.email ?? "",
      remarques: o.remarques ?? "",
      contactNom: o.contactNom,
      contactTelephone: o.contactTelephone ?? "",
      contactEmail: o.contactEmail ?? "",
    });
    setEditing(o);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const patch = (p: Partial<OrganismePECPayload>) => setForm((f) => ({ ...f, ...p }));

  const handleSave = () => {
    if (!form.intitule.trim() || !form.adresse.trim() || !form.contactNom.trim()) {
      toast.error("Intitulé, adresse et nom du contact principal sont obligatoires");
      return;
    }
    const payload: OrganismePECPayload = {
      intitule: form.intitule.trim(),
      adresse: form.adresse.trim(),
      telephone: form.telephone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      remarques: form.remarques?.trim() || undefined,
      contactNom: form.contactNom.trim(),
      contactTelephone: form.contactTelephone?.trim() || undefined,
      contactEmail: form.contactEmail?.trim() || undefined,
    };
    if (editing) {
      updateOrganismePEC(editing.id, payload);
      toast.success("Organisme modifié");
    } else {
      addOrganismePEC(payload);
      toast.success("Organisme ajouté");
    }
    close();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les organismes de prise en charge" }]}
        title="Les organismes de prise en charge"
        actions={
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="btn-new-organisme-pec"
          >
            <Plus size={15} /> Ajouter
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Organisme</th>
              <th className="text-left px-4 py-3">Téléphone</th>
              <th className="text-right px-4 py-3 w-32">Action</th>
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2">
                <input value={filterOrganisme} onChange={(e) => setFilterOrganisme(e.target.value)} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filterTelephone} onChange={(e) => setFilterTelephone(e.target.value)} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-16 text-center text-sm text-muted-foreground">
                  Aucun organisme ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/organismes-pec/${o.id}`)}
                  data-testid={`organisme-pec-row-${o.id}`}
                >
                  <td className="px-4 py-3 font-medium">{o.intitule}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.telephone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/admin/organismes-pec/${o.id}`);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Voir le détail"
                        data-testid={`organisme-pec-view-${o.id}`}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(o);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(o);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={open}
        onClose={close}
        title={editing ? "Modifier l'organisme de prise en charge" : "Nouvel organisme de prise en charge"}
        size="md"
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">Informations de l&apos;organisme</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Intitulé <span className="text-red-500">*</span>
                </label>
                <input value={form.intitule} onChange={(e) => patch({ intitule: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Adresse <span className="text-red-500">*</span>
                </label>
                <input value={form.adresse} onChange={(e) => patch({ adresse: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
                  <input value={form.telephone} onChange={(e) => patch({ telephone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Remarques</label>
                <textarea value={form.remarques} onChange={(e) => patch({ remarques: e.target.value })} rows={3} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">Contact principal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input value={form.contactNom} onChange={(e) => patch({ contactNom: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
                  <input value={form.contactTelephone} onChange={(e) => patch({ contactTelephone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="organisme-pec-save">
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
          if (deleteTarget) deleteOrganismePEC(deleteTarget.id);
          toast.success("Organisme supprimé");
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
