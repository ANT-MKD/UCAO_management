import { useMemo } from "react";
import { useLocation } from "wouter";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useRoles } from "@/hooks/useRoleStore";
import { collectAllLeaves, type NavLeaf } from "@/lib/adminNavConfig";
import { cn } from "@/lib/utils";

interface AccessRow {
  id: string;
  label: string;
  href: string;
  module: string;
  rolesText: string;
}

export default function AccessRightsPage() {
  const [, setLocation] = useLocation();
  const roles = useRoles();

  const rows = useMemo<AccessRow[]>(() => {
    return collectAllLeaves().map((leaf: NavLeaf) => {
      const rolesForLeaf = roles.filter((r) => r.accessibleItemIds.includes(leaf.id));
      return {
        id: leaf.id,
        label: leaf.label,
        href: leaf.href,
        module: leaf.groupLabel ? `${leaf.sectionLabel} › ${leaf.groupLabel}` : leaf.sectionLabel,
        rolesText: `${leaf.label} ${leaf.href} ${rolesForLeaf.map((r) => r.code).join(" ")}`,
      };
    });
  }, [roles]);

  const rolesByLeaf = useMemo(() => {
    const map = new Map<string, typeof roles>();
    roles.forEach((r) => {
      r.accessibleItemIds.forEach((leafId) => {
        map.set(leafId, [...(map.get(leafId) ?? []), r]);
      });
    });
    return map;
  }, [roles]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "label",
      header: "Page",
      sortable: true,
      render: (row) => {
        const r = row as unknown as AccessRow;
        return (
          <div>
            <div className="font-medium text-foreground">{r.label}</div>
            <div className="text-[11px] text-muted-foreground">{r.module}</div>
          </div>
        );
      },
    },
    {
      key: "href",
      header: "URL",
      sortable: true,
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{(row as unknown as AccessRow).href}</span>,
    },
    {
      key: "roles",
      header: "Rôles ayant accès",
      render: (row) => {
        const r = row as unknown as AccessRow;
        const roleList = rolesByLeaf.get(r.id) ?? [];
        return (
          <div className="flex flex-wrap gap-1.5">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground italic"
              title="Tout compte sans rôle assigné garde l'accès complet"
            >
              Comptes sans rôle
            </span>
            {roleList.map((role) => (
              <button
                key={role.id}
                onClick={(e) => { e.stopPropagation(); setLocation(`/admin/roles/${role.id}/access`); }}
                className={cn(
                  "text-[11px] font-mono font-medium px-2 py-0.5 rounded-full",
                  "bg-primary/10 text-primary hover:bg-primary/20 transition-colors",
                )}
                title="Modifier depuis Définir les accès"
                data-testid={`access-role-badge-${r.id}-${role.id}`}
              >
                {role.code}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Droit accès" }]}
        title="Droit accès"
        subtitle="Vue d'ensemble : qui a accès à quelle page — dérivée en direct des rôles, aucune saisie manuelle ici"
      />

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5 mb-4">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          Cette page est une consultation, pas un éditeur : pour changer les droits d'un rôle, clique sur son badge
          ou passe par Sécurité → Gestion des rôles → Définir les accès.
        </span>
      </div>

      <DataTable
        columns={columns}
        data={rows as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Page, URL, rôle..."
        pageSize={25}
        emptyMessage="Aucune page trouvée."
      />
    </div>
  );
}
