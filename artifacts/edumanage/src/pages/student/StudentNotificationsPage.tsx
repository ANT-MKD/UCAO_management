import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Bell, CheckCheck, Circle, Search, Archive, ArchiveRestore, Sliders,
  Wallet, FileText, CalendarDays, CalendarX, ClipboardList, MessageCircle, ShieldAlert, FolderOpen, GraduationCap,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useStudentStore";
import { markNotificationRead, markAllNotificationsRead, archiveNotification } from "@/data/studentStore";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatDate } from "@/lib/utils";

type Filtre = "toutes" | "non_lues" | "importantes" | "archivees";

interface Categorie {
  label: string;
  icon: React.ElementType;
  color: string;
}

/** Catégorise une notification à partir de son message réel — reprend exactement les gabarits
 * effectivement utilisés par pushNotification()/pushNotificationEtPersister() dans le code
 * (studentStore.ts, attestationStore.ts, mailEnvoyeStore.ts, AuthContext.tsx), jamais une
 * taxonomie inventée séparément de ce que l'app envoie réellement. */
const CATEGORIES: Record<string, Categorie> = {
  finances: { label: "Finances", icon: Wallet, color: "#10b981" },
  notes: { label: "Notes", icon: FileText, color: "#8b5cf6" },
  emploi_du_temps: { label: "Emploi du temps", icon: CalendarDays, color: "#2563eb" },
  absences: { label: "Absences", icon: CalendarX, color: "#f59e0b" },
  demandes: { label: "Demandes", icon: ClipboardList, color: "#0ea5e9" },
  messagerie: { label: "Messagerie", icon: MessageCircle, color: "#6366f1" },
  compte: { label: "Compte", icon: ShieldAlert, color: "#ef4444" },
  documents: { label: "Documents", icon: FolderOpen, color: "#d97706" },
  academique: { label: "Académique", icon: GraduationCap, color: "#14b8a6" },
  autres: { label: "Autres", icon: Bell, color: "#64748b" },
};

function categoriser(message: string): string {
  if (/bloqu/i.test(message)) return "compte";
  if (/nouveau document disponible/i.test(message)) return "documents";
  if (/votre demande/i.test(message)) return "demandes";
  if (/nouveau message/i.test(message)) return "messagerie";
  if (/nouvelle note publiée/i.test(message)) return "notes";
  if (/absence constatée/i.test(message)) return "absences";
  if (/edt mis à jour|nouveau créneau/i.test(message)) return "emploi_du_temps";
  if (/paiement validé|quittance|reçu /i.test(message)) return "finances";
  if (/affecté à la classe/i.test(message)) return "academique";
  return "autres";
}

/** Rappel de paiement et blocage de compte sont les deux seuls types de notification ayant un
 * vrai impact bloquant pour l'étudiant — c'est le seul critère "important" objectivement fondé. */
function estImportante(message: string): boolean {
  return /bloqu/i.test(message) || /rappel.*quittance.*attente/i.test(message);
}

function groupeDateLabel(dateStr: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = dateStr.slice(0, 10);
  if (day === today) return "Aujourd'hui";
  if (day === yesterday) return "Hier";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const PAGE_SIZE = 8;

/** Historique complet des notifications, avec une vraie catégorisation (dérivée du contenu des
 * messages réellement envoyés) et un archivage (nouveau champ, jamais posé automatiquement). Le
 * dropdown de la cloche (StudentLayout.tsx) n'en montre que les 8 plus récentes non archivées. */
export default function StudentNotificationsPage() {
  const { currentUser } = useAuth();
  const notifications = useNotifications(currentUser?.id);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const actives = notifications.filter((n) => !n.archived);
  const unreadCount = actives.filter((n) => !n.read).length;
  const importantCount = actives.filter((n) => estImportante(n.message)).length;
  const archivedCount = notifications.filter((n) => n.archived).length;

  const parCategorie = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of actives) {
      const cat = categoriser(n.message);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [actives]);

  const repartition = useMemo(
    () => Object.entries(parCategorie)
      .map(([key, count]) => ({ key, count, ...CATEGORIES[key] }))
      .sort((a, b) => b.count - a.count),
    [parCategorie],
  );

  const base =
    filtre === "archivees" ? notifications.filter((n) => n.archived)
      : filtre === "non_lues" ? actives.filter((n) => !n.read)
      : filtre === "importantes" ? actives.filter((n) => estImportante(n.message))
      : actives;

  const q = query.trim().toLowerCase();
  const filtered = base.filter((n) => {
    if (categorieFiltre && categoriser(n.message) !== categorieFiltre) return false;
    if (q && !n.message.toLowerCase().includes(q)) return false;
    return true;
  });

  const visibles = filtered.slice(0, visibleCount);

  const groupes = useMemo(() => {
    const map = new Map<string, typeof visibles>();
    for (const n of visibles) {
      const key = groupeDateLabel(n.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [visibles]);

  const changeFiltre = (f: Filtre) => {
    setFiltre(f);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={Bell} label="Toutes notifications" value={actives.length} accentColor="#4f46e5" />
        <KPICard icon={Circle} label="Non lues" value={unreadCount} accentColor="#2563eb" />
        <KPICard icon={ShieldAlert} label="Importantes" value={importantCount} accentColor={importantCount > 0 ? "#ef4444" : "#10b981"} />
        <KPICard icon={Archive} label="Archivées" value={archivedCount} accentColor="#64748b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1">
              {([["toutes", "Toutes"], ["non_lues", "Non lues"], ["importantes", "Importantes"], ["archivees", "Archivées"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeFiltre(key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                    filtre === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                  data-testid={`notifications-filtre-${key}`}
                >
                  {label}
                  {key === "non_lues" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                  {key === "importantes" && importantCount > 0 ? ` (${importantCount})` : ""}
                  {key === "archivees" && archivedCount > 0 ? ` (${archivedCount})` : ""}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une notification..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="notifications-recherche"
              />
            </div>
            {categorieFiltre && (
              <button
                type="button"
                onClick={() => setCategorieFiltre(null)}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Catégorie : {CATEGORIES[categorieFiltre].label} ✕
              </button>
            )}
          </div>

          {groupes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <Bell size={28} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucune notification ne correspond.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupes.map(([date, items]) => (
                <div key={date} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase">{date}</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((n) => {
                      const cat = CATEGORIES[categoriser(n.message)];
                      const important = estImportante(n.message);
                      return (
                        <div
                          key={n.id}
                          className={cn("px-5 py-3.5 flex items-start gap-3 transition-colors", !n.read && "bg-primary/[0.03]")}
                          data-testid={`notification-${n.id}`}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}18` }}>
                            <cat.icon size={14} style={{ color: cat.color }} />
                          </div>
                          <div
                            className={cn("min-w-0 flex-1", !n.read && "cursor-pointer")}
                            onClick={() => { if (!n.read && currentUser) markNotificationRead(n.id, currentUser.id); }}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap" style={{ color: cat.color, background: `${cat.color}18` }}>{cat.label}</span>
                              {important && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 whitespace-nowrap">Important</span>}
                              {!n.read && <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />}
                            </div>
                            <p className={cn("text-sm mt-1", !n.read ? "text-foreground font-medium" : "text-muted-foreground")}>{n.message}</p>
                            <p className="text-[11px] text-muted-foreground/80 mt-1">
                              {new Date(n.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {formatDate(n.createdAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => currentUser && archiveNotification(n.id, currentUser.id, !n.archived)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0"
                            title={n.archived ? "Désarchiver" : "Archiver"}
                            data-testid={`notification-archiver-${n.id}`}
                          >
                            {n.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filtered.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="w-full py-2.5 text-sm font-medium text-primary hover:underline"
                  data-testid="notifications-afficher-plus"
                >
                  Afficher plus
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Filtres rapides</h3>
            {repartition.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune notification.</p>
            ) : (
              <div className="space-y-1">
                {repartition.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setCategorieFiltre(categorieFiltre === r.key ? null : r.key)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                      categorieFiltre === r.key ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground",
                    )}
                    data-testid={`notifications-cat-${r.key}`}
                  >
                    <span className="flex items-center gap-2 min-w-0"><r.icon size={13} style={{ color: r.color }} className="flex-shrink-0" /> <span className="truncate">{r.label}</span></span>
                    <span className="font-semibold flex-shrink-0">{r.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {repartition.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Répartition par catégorie</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={repartition} cx="50%" cy="50%" outerRadius={65} innerRadius={35} dataKey="count">
                    {repartition.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, _n, item) => [`${v} notification(s)`, item.payload.label]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Sliders size={15} className="text-primary" /> Préférences</h3>
            <p className="text-xs text-muted-foreground mb-3">Le thème et les autres préférences d'affichage se gèrent depuis votre profil.</p>
            <Link href="/student/profile" className="inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors w-full">
              Gérer mes préférences
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
