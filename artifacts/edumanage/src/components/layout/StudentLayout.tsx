import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  CreditCard,
  User,
  MessageCircle,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Bell,
  Menu,
  X,
  BookOpen,
  NotebookPen,
  Library,
  GraduationCap,
  CalendarX,
  Wallet,
  CircleDollarSign,
  FileStack,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useNotifications, useMessages, useStudentRequests } from "@/hooks/useStudentStore";
import { markNotificationRead } from "@/data/studentStore";
import { STUDENT_PORTAL_FEATURES } from "@/data/portalFeaturesStore";
import { usePortalFeatures } from "@/hooks/usePortalFeaturesStore";

interface StudentLayoutProps {
  children: React.ReactNode;
}

interface StudentNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const ICONS_BY_ID: Record<string, React.ElementType> = {
  "student-dashboard": LayoutDashboard,
  "student-schedule": CalendarDays,
  "student-cours": BookOpen,
  "student-cahier": NotebookPen,
  "student-ressources": Library,
  "student-notes": FileText,
  "student-releves": GraduationCap,
  "student-absences": CalendarX,
  "student-frais-paye": Wallet,
  "student-frais-impaye": CircleDollarSign,
  "student-payer-factures": CreditCard,
  "student-messages": MessageCircle,
  "student-requests": ClipboardList,
  "student-documents": FileStack,
  "student-profile": User,
};

const STUDENT_NAV_ITEMS: StudentNavItem[] = STUDENT_PORTAL_FEATURES.map((f) => ({
  id: f.id,
  label: f.label,
  href: f.href,
  icon: ICONS_BY_ID[f.id],
}));

/** Horodatage de dernière visite de "Mes demandes", posé par StudentRequestsPage.tsx à son
 * montage — sert uniquement à calculer le badge "non lu" du sidebar, jamais une donnée métier. */
export function requestsLastSeenKey(userId: string): string {
  return `edumanage-requests-lastseen-${userId}`;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useNotifications(currentUser?.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const portalFeatures = usePortalFeatures();
  const visibleNavItems = STUDENT_NAV_ITEMS.filter((item) => portalFeatures[item.id] !== false);
  const mainNavItems = visibleNavItems.filter((item) => item.id !== "student-profile");
  const profileNavItem = visibleNavItems.find((item) => item.id === "student-profile");

  const messages = useMessages(currentUser?.id);
  const unreadMessages = messages.filter((m) => m.toUserId === currentUser?.id && !m.read).length;

  const allRequests = useStudentRequests();
  const requestsLastSeen = currentUser && typeof window !== "undefined"
    ? localStorage.getItem(requestsLastSeenKey(currentUser.id)) ?? ""
    : "";
  const unreadRequests = allRequests.filter(
    (r) => r.studentId === currentUser?.linkedId && r.status !== "nouveau" && r.status !== "annule" && r.updatedAt > requestsLastSeen,
  ).length;

  const NAV_BADGES: Record<string, number> = {
    "student-messages": unreadMessages,
    "student-requests": unreadRequests,
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const handleOpenNotif = () => {
    setNotifOpen((o) => !o);
  };

  const NavList = ({ items, onNavigate }: { items: StudentNavItem[]; onNavigate?: () => void }) => (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = location === item.href || location.startsWith(item.href + "/");
        const badgeCount = NAV_BADGES[item.id] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group w-full rounded-xl flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
              collapsed && "lg:justify-center lg:px-2",
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className={cn("truncate flex-1", collapsed && "lg:hidden")}>{item.label}</span>
            {badgeCount > 0 && (
              <span
                className={cn(
                  "flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center",
                  collapsed && "lg:hidden",
                )}
                data-testid={`nav-badge-${item.id}`}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-alt)] flex">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden lg:flex sticky top-0 h-screen border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div className="h-full flex flex-col w-full">
          <div className="h-16 px-3 border-b border-border flex items-center justify-between">
            <Link href="/student/dashboard" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">
                EM
              </div>
              {!collapsed && (
                <span className="font-bold text-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Portail Étudiant
                </span>
              )}
            </Link>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <NavList items={mainNavItems} />
          </nav>

          {profileNavItem && (
            <div className="px-3 pt-2 border-t border-border space-y-1 flex-shrink-0">
              <NavList items={[profileNavItem]} />
            </div>
          )}

          <div className="p-3 border-t border-border space-y-2 flex-shrink-0">
            <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2", collapsed && "justify-center")}>
              <UserAvatar name={currentUser?.name || "Étudiant"} size="sm" />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{currentUser?.name || "Étudiant"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{currentUser?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={cn(
                "w-full rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2",
                collapsed && "justify-center px-2",
              )}
            >
              <LogOut size={16} />
              {!collapsed && "Déconnexion"}
            </button>
          </div>
        </div>
      </aside>

      {/* Menu tiroir (mobile / tablette) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(85%,320px)] bg-card border-r border-border shadow-xl flex flex-col animate-in slide-in-from-left-4 duration-200">
            <div className="h-16 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <span className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                Portail Étudiant
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Fermer le menu"
                data-testid="student-mobile-close"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              <NavList items={mainNavItems} onNavigate={() => setMobileOpen(false)} />
            </nav>

            {profileNavItem && (
              <div className="px-3 pt-2 border-t border-border space-y-1 flex-shrink-0">
                <NavList items={[profileNavItem]} onNavigate={() => setMobileOpen(false)} />
              </div>
            )}

            <div className="p-3 border-t border-border space-y-2 flex-shrink-0">
              <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                <UserAvatar name={currentUser?.name || "Étudiant"} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{currentUser?.name || "Étudiant"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{currentUser?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-screen min-w-0">
        <header className="h-16 border-b border-border bg-card px-3 sm:px-5 md:px-7 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              data-testid="student-mobile-menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>
                Espace Étudiant
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Suivi académique et administratif</p>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={handleOpenNotif}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              data-testid="student-topbar-notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <span className="font-semibold text-sm">Notifications</span>
                  <span className="text-xs text-primary font-medium">{unreadCount} non lue(s)</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-xs text-muted-foreground text-center">Aucune notification</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.read && currentUser) markNotificationRead(n.id, currentUser.id); }}
                        className={cn(
                          "px-4 py-3 border-b border-border last:border-0 hover:bg-muted cursor-pointer transition-colors",
                          !n.read && "bg-primary/[0.03]",
                        )}
                        data-testid={`student-notification-${n.id}`}
                      >
                        <div className="flex gap-2">
                          {!n.read && <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />}
                          <div className={!n.read ? "" : "pl-3.5"}>
                            <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Link
                  href="/student/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-primary text-center hover:bg-muted transition-colors border-t border-border flex-shrink-0"
                  data-testid="student-notifications-see-all"
                >
                  Voir toutes les notifications
                </Link>
              </div>
            )}
          </div>
        </header>

        <div className="p-3 sm:p-5 md:p-7 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
