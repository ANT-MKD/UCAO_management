import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Pencil, Trash2, KeyRound, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useRole } from "@/hooks/useRoleStore";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { upsertRole, deleteRole } from "@/data/roleStore";
import { ADMIN_NAV_SECTIONS, getLeafIdsForSection } from "@/lib/adminNavConfig";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RoleDetailPage({ id }: { id: string }) {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const role = useRole(id);
  const comptes = useUserAccounts();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ code: "", description: "" });
  const [error, setError] = useState("");

  const assignes = useMemo(() => comptes.filter((c) => c.roleId === id), [comptes, id]);

  const sectionsResume = useMemo(() => {
    if (!role) return [];
    const allowed = new Set(role.accessibleItemIds);
    return ADMIN_NAV_SECTIONS
      .map((section) => {
        const leafIds = getLeafIdsForSection(section.id);
        const accordes = leafIds.filter((lid) => allowed.has(lid)).length;
        return { section, accordes, total: leafIds.length };
      })
      .filter((s) => s.total > 0 && s.accordes > 0);
  }, [role]);

  if (!role) {
    return (
      <div>
        <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Les rôles", href: "/admin/roles" }, { label: "Rôle introuvable" }]} title="Rôle introuvable" />
        <button onClick={() => setLocation("/admin/roles")} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Retour à la liste
        </button>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({ code: role.code, description: role.description });
    setError("");
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editForm.code.trim() || !editForm.description.trim()) return;
    try {
      upsertRole(editForm, currentUser?.id ?? "", role.id);
      toast.success("Rôle mis à jour.");
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    }
  };

  const handleDelete = () => {
    try {
      deleteRole(role.id);
      toast.success("Rôle supprimé.");
      setLocation("/admin/roles");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Sécurité" },
          { label: "Les rôles", href: "/admin/roles" },
          { label: role.code },
        ]}
        title={role.code}
        subtitle={role.description}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="role-editer">
              <Pencil size={13} /> Éditer
            </button>
            <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline" data-testid="role-supprimer">
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        }
      />

      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Pages accessibles</p>
              <p className="text-2xl font-bold text-foreground" data-testid="role-nb-pages">{role.accessibleItemIds.length}</p>
            </div>
            <button
              onClick={() => setLocation(`/admin/roles/${role.id}/access`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              data-testid="role-definir-acces"
            >
              <KeyRound size={14} /> Définir les accès
            </button>
          </div>

          {sectionsResume.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun accès défini — ce rôle ne donne accès à aucune page du menu.</p>
          ) : (
            <div className="space-y-2">
              {sectionsResume.map(({ section, accordes, total }) => {
                const Icon = section.icon;
                return (
                  <div key={section.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40" data-testid={`role-module-${section.id}`}>
                    <div className="flex items-center gap-2.5">
                      {Icon && <Icon size={15} className="text-primary" />}
                      <span className="text-sm font-medium text-foreground">{section.label}</span>
                    </div>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", accordes === total ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300")}>
                      {accordes} / {total}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Comptes assignés ({assignes.length})</p>
          {assignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun compte n'utilise encore ce rôle.</p>
          ) : (
            <div className="space-y-2">
              {assignes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setLocation(`/admin/users/${c.id}`)}
                  className="w-full flex items-center gap-2.5 text-left hover:bg-muted/40 rounded-lg p-1.5 -m-1.5"
                  data-testid={`role-compte-${c.id}`}
                >
                  <UserAvatar name={c.displayName} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{c.displayName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border flex items-center gap-1.5">
            <ShieldCheck size={12} /> Créé le {formatDate(role.createdAt)}
          </p>
        </div>
      </div>

      <FormModal open={editOpen} onClose={() => setEditOpen(false)} title="Éditer le rôle" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code du rôle *</label>
            <input value={editForm.code} onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="role-edit-code" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description *</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="role-edit-description" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={handleSaveEdit}
            disabled={!editForm.code.trim() || !editForm.description.trim()}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="role-edit-sauvegarder"
          >
            Sauvegarder
          </button>
        </div>
      </FormModal>
    </div>
  );
}
