import { useMemo, useState } from "react";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useStudentStore";
import { markNotificationRead, markAllNotificationsRead } from "@/data/studentStore";
import { cn, formatDate } from "@/lib/utils";

type Filtre = "toutes" | "non_lues";

function groupeDateLabel(dateStr: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = dateStr.slice(0, 10);
  if (day === today) return "Aujourd'hui";
  if (day === yesterday) return "Hier";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Historique complet des notifications — le dropdown de la cloche (StudentLayout.tsx) n'en
 * montre que les 8 plus récentes ; cette page lit exactement la même source (getNotificationsByUser)
 * sans troncature, avec les mêmes actions (lecture individuelle, tout marquer comme lu). */
export default function StudentNotificationsPage() {
  const { currentUser } = useAuth();
  const notifications = useNotifications(currentUser?.id);
  const [filtre, setFiltre] = useState<Filtre>("toutes");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filtre === "non_lues" ? notifications.filter((n) => !n.read) : notifications;

  const groupes = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const n of filtered) {
      const key = groupeDateLabel(n.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : "Vous êtes à jour"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => currentUser && markAllNotificationsRead(currentUser.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
            data-testid="notifications-tout-marquer-lu"
          >
            <CheckCheck size={14} /> Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {([["toutes", "Toutes"], ["non_lues", "Non lues"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFiltre(key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              filtre === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`notifications-filtre-${key}`}
          >
            {label}{key === "non_lues" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {groupes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Bell size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {filtre === "non_lues" ? "Aucune notification non lue." : "Aucune notification pour l'instant."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupes.map(([date, items]) => (
            <div key={date} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30">
                <h3 className="text-xs font-bold text-muted-foreground uppercase">{date}</h3>
              </div>
              <div className="divide-y divide-border">
                {items.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.read && currentUser) markNotificationRead(n.id, currentUser.id); }}
                    className={cn(
                      "px-5 py-3.5 flex items-start gap-3 transition-colors",
                      !n.read && "bg-primary/[0.03] cursor-pointer hover:bg-primary/[0.06]",
                    )}
                    data-testid={`notification-${n.id}`}
                  >
                    {!n.read ? (
                      <Circle size={8} className="mt-1.5 flex-shrink-0 fill-primary text-primary" />
                    ) : (
                      <span className="w-2 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", !n.read ? "text-foreground font-medium" : "text-muted-foreground")}>{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        {new Date(n.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {formatDate(n.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
