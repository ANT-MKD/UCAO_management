import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePortalAccess } from "@/hooks/usePortalAccessStore";
import { setPortalActif, PORTAL_LABELS } from "@/data/portalAccessStore";
import type { UserRole } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const ROLES: UserRole[] = ["admin", "teacher", "student"];

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
        value ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        !disabled && "cursor-pointer hover:opacity-80",
        disabled && "opacity-60 cursor-not-allowed",
      )}
      data-testid={`portail-toggle-${value ? "on" : "off"}`}
    >
      {value ? "Activé" : "Désactivé"}
    </button>
  );
}

export default function PortailsPage() {
  const access = usePortalAccess();

  const handleToggle = (role: UserRole, actif: boolean) => {
    try {
      setPortalActif(role, actif);
      toast.success(`Portail ${PORTAL_LABELS[role]} ${actif ? "activé" : "désactivé"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Portails" }]}
        title="Portails"
        subtitle="Active ou bloque réellement la connexion par portail — appliqué immédiatement au login"
      />

      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              {["Portail", "Statut", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b border-border/60 last:border-0" data-testid={`portail-ligne-${role}`}>
                <td className="px-4 py-3 font-medium text-foreground">{PORTAL_LABELS[role]}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {access[role] ? "Connexion autorisée pour ce rôle" : "Connexion bloquée — les comptes de ce rôle ne peuvent plus se connecter"}
                </td>
                <td className="px-4 py-3">
                  <Toggle value={access[role]} onChange={(v) => handleToggle(role, v)} disabled={role === "admin" && access[role]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3 mt-4">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
        Le portail Administration ne peut pas être désactivé, pour éviter de verrouiller totalement l'accès au système.
      </div>
    </div>
  );
}
