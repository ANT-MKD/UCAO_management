import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useRole } from "@/hooks/useRoleStore";
import { setRoleAccess } from "@/data/roleStore";
import { ADMIN_NAV_SECTIONS, type AdminNavNode } from "@/lib/adminNavConfig";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function collectLeafIds(node: AdminNavNode): string[] {
  if (!node.children || node.children.length === 0) {
    return node.href ? [node.id] : [];
  }
  return node.children.flatMap(collectLeafIds);
}

interface NodeRowProps {
  node: AdminNavNode;
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleSelect: (node: AdminNavNode, checked: boolean) => void;
  onToggleExpand: (id: string) => void;
}

function TriState({ checked, indeterminate }: { checked: boolean; indeterminate: boolean }) {
  return (
    <span
      className={cn(
        "w-4 h-4 rounded flex items-center justify-center border flex-shrink-0",
        checked || indeterminate ? "bg-primary border-primary text-white" : "border-border bg-background",
      )}
    >
      {checked && <Check size={11} />}
      {!checked && indeterminate && <Minus size={11} />}
    </span>
  );
}

export default function RoleAccessPage({ id }: { id: string }) {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const role = useRole(id);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(role?.accessibleItemIds ?? []));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggleExpand = (nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleSelect = (node: AdminNavNode, checked: boolean) => {
    const leafIds = collectLeafIds(node);
    setSelected((prev) => {
      const next = new Set(prev);
      leafIds.forEach((lid) => { if (checked) next.add(lid); else next.delete(lid); });
      return next;
    });
  };

  const handleSave = () => {
    if (!currentUser) return;
    setRoleAccess(role.id, Array.from(selected), currentUser.id);
    toast.success("Accès enregistrés.");
    setLocation(`/admin/roles/${role.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Sécurité" },
          { label: "Les rôles", href: "/admin/roles" },
          { label: role.code, href: `/admin/roles/${role.id}` },
          { label: "Définir les accès" },
        ]}
        title={`Définir les accès — ${role.code}`}
        subtitle={`${selected.size} page(s) sélectionnée(s)`}
        actions={
          <button onClick={handleSave} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors" data-testid="access-sauvegarder">
            Sauvegarder
          </button>
        }
      />

      <div className="bg-card border border-border rounded-2xl p-2" style={{ boxShadow: "var(--shadow-sm)" }}>
        {ADMIN_NAV_SECTIONS.map((section) => {
          const leafIds = collectLeafIds(section);
          if (leafIds.length === 0) return null;
          const nbSelected = leafIds.filter((lid) => selected.has(lid)).length;
          const checked = nbSelected === leafIds.length;
          const indeterminate = nbSelected > 0 && nbSelected < leafIds.length;
          const isOpen = expanded.has(section.id);
          const Icon = section.icon;
          const hasChildren = !!(section.children && section.children.length > 0);

          return (
            <div key={section.id} className="border-b border-border last:border-b-0">
              <div className="flex items-center gap-2 py-2.5 px-2">
                {hasChildren ? (
                  <button onClick={() => toggleExpand(section.id)} className="p-0.5 text-muted-foreground" data-testid={`access-expand-${section.id}`}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="w-[18px]" />
                )}
                <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleSelect(section, e.target.checked)}
                    className="sr-only"
                  />
                  <TriState checked={checked} indeterminate={indeterminate} />
                  <Icon size={15} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">{section.label}</span>
                </label>
                <span className="text-[11px] text-muted-foreground">{nbSelected} / {leafIds.length}</span>
              </div>

              {isOpen && hasChildren && (
                <div className="pb-2">
                  {section.children!.map((node) => (
                    <RecursiveNode
                      key={node.id}
                      node={node}
                      depth={1}
                      selected={selected}
                      expanded={expanded}
                      onToggleSelect={toggleSelect}
                      onToggleExpand={toggleExpand}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecursiveNode({ node, depth, selected, expanded, onToggleSelect, onToggleExpand }: NodeRowProps) {
  const isGroup = !!(node.children && node.children.length > 0);
  const leafIds = collectLeafIds(node);
  const nbSelected = leafIds.filter((id) => selected.has(id)).length;
  const checked = leafIds.length > 0 && nbSelected === leafIds.length;
  const indeterminate = nbSelected > 0 && nbSelected < leafIds.length;
  const isOpen = expanded.has(node.id);

  if (!isGroup) {
    if (!node.href) return null;
    return (
      <label
        className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-muted/40 rounded-lg"
        style={{ paddingLeft: 20 + depth * 20, paddingRight: 8 }}
        data-testid={`access-item-${node.id}`}
      >
        <input type="checkbox" checked={selected.has(node.id)} onChange={(e) => onToggleSelect(node, e.target.checked)} className="sr-only" />
        <TriState checked={selected.has(node.id)} indeterminate={false} />
        <span className="text-sm text-foreground">{node.label}</span>
      </label>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: 8 + depth * 20, paddingRight: 8 }}>
        <button onClick={() => onToggleExpand(node.id)} className="p-0.5 text-muted-foreground" data-testid={`access-expand-${node.id}`}>
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => onToggleSelect(node, e.target.checked)} className="sr-only" />
          <TriState checked={checked} indeterminate={indeterminate} />
          <span className="text-sm font-medium text-foreground">{node.label}</span>
        </label>
        <span className="text-[11px] text-muted-foreground">{nbSelected} / {leafIds.length}</span>
      </div>
      {isOpen && (
        <div>
          {node.children!.map((child) => (
            <RecursiveNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
