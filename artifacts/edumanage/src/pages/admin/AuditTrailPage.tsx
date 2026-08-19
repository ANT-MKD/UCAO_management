import { useMemo, useState } from "react";
import { Clock, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuditLogs, useUserAccounts } from "@/hooks/useStudentStore";
import { cn, formatDate } from "@/lib/utils";

export default function AuditTrailPage() {
  const logs = useAuditLogs();
  const users = useUserAccounts();
  const [q, setQ] = useState("");

  const userById = useMemo(() => {
    const map = new Map<string, { displayName: string; role?: string }>();
    for (const u of users) map.set(u.id, { displayName: u.displayName, role: u.role });
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((l) => {
      const actor = userById.get(l.actorUserId)?.displayName ?? l.actorUserId;
      return (
        l.action.toLowerCase().includes(query) ||
        l.targetType.toLowerCase().includes(query) ||
        l.targetId.toLowerCase().includes(query) ||
        actor.toLowerCase().includes(query) ||
        (l.meta ?? "").toLowerCase().includes(query)
      );
    });
  }, [logs, q, userById]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Gouvernance" }, { label: "Audit trail" }]}
        title="Journal d’audit"
        subtitle="Historique (mock) des actions : acteur, action, cible, date"
      />

      <div className="max-w-5xl mx-auto space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (action, cible, acteur, meta...)"
            className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Aucun log trouvé.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Acteur</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Cible</th>
                  <th className="px-4 py-3">Meta</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const actor = userById.get(l.actorUserId)?.displayName ?? l.actorUserId;
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock size={14} /> {formatDate(l.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{actor}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">{l.action}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex text-xs px-2 py-1 rounded-lg bg-muted text-foreground", "max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap")}>
                          {l.targetType} · {l.targetId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {l.meta ? (
                          <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">
                            {l.meta}
                          </pre>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

