import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { useRoles } from "@/hooks/useRoleStore";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { upsertRole, type RoleRecord } from "@/data/roleStore";
import { collectAllLeaves } from "@/lib/adminNavConfig";
import { useAuth } from "@/contexts/AuthContext";

const EMPTY_FORM = { code: "", description: "" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RolesPage() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const roles = useRoles();
  const comptes = useUserAccounts();
  const totalPages = collectAllLeaves().length;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const nbComptes = (roleId: string) => comptes.filter((c) => c.roleId === roleId).length;

  const handleSave = () => {
    if (!currentUser || !form.code.trim() || !form.description.trim()) return;
    setError("");
    try {
      const role = upsertRole({ code: form.code, description: form.description }, currentUser.id);
      toast.success("Rôle créé. Définissez maintenant ses accès.");
      setForm(EMPTY_FORM);
      setOpen(false);
      setLocation(`/admin/roles/${role.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "code",
      header: "Rôle",
      sortable: true,
      render: (row) => {
        const r = row as unknown as RoleRecord;
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={14} />
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-foreground">{r.code}</div>
              <div className="text-[11px] text-muted-foreground">{r.description}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "accessibleItemIds",
      header: "Accès",
      render: (row) => {
        const r = row as unknown as RoleRecord;
        return <span className="text-sm">{r.accessibleItemIds.length} / {totalPages} pages</span>;
      },
    },
    {
      key: "comptes",
      header: "Comptes assignés",
      render: (row) => {
        const r = row as unknown as RoleRecord;
        const n = nbComptes(r.id);
        return <span className="text-sm">{n} compte{n > 1 ? "s" : ""}</span>;
      },
    },
    { key: "createdAt", header: "Créé le", sortable: true, render: (row) => formatDate((row as unknown as RoleRecord).createdAt) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const r = row as unknown as RoleRecord;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(`/admin/roles/${r.id}`); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"
            title="Consulter le rôle"
            data-testid={`role-voir-${r.id}`}
          >
            <Eye size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Les rôles" }]}
        title="Les rôles"
        subtitle="Un rôle donne accès à un sous-ensemble des pages du menu — les comptes sans rôle gardent l'accès complet"
        actions={
          <button onClick={() => { setForm(EMPTY_FORM); setError(""); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors" data-testid="role-ajouter">
            <Plus size={14} /> Nouveau rôle
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={roles as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Code, description..."
        onRowClick={(row) => setLocation(`/admin/roles/${(row as unknown as RoleRecord).id}`)}
        emptyMessage="Aucun rôle."
      />

      <FormModal open={open} onClose={() => setOpen(false)} title="Nouveau rôle" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code du rôle *</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ex: ROLE_SECRETARIAT" className={inputClass} data-testid="role-code" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="ex: Gestion des étudiants et de la scolarité" className={inputClass} data-testid="role-description" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!form.code.trim() || !form.description.trim()}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="role-sauvegarder"
          >
            Créer et définir les accès
          </button>
        </div>
      </FormModal>
    </div>
  );
}
