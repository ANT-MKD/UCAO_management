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
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useNotifications } from "@/hooks/useStudentStore";
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
  "student-grades": FileText,
  "student-payments": CreditCard,
  "student-messages": MessageCircle,
  "student-requests": ClipboardList,
  "student-profile": User,
};

const STUDENT_NAV_ITEMS: StudentNavItem[] = STUDENT_PORTAL_FEATURES.map((f) => ({
  id: f.id,
  label: f.label,
  href: f.href,
  icon: ICONS_BY_ID[f.id],
}));

export function StudentLayout({ children }: StudentLayoutProps) {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useNotifications(currentUser?.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const portalFeatures = usePortalFeatures();
  const visibleNavItems = STUDENT_NAV_ITEMS.filter((item) => portalFeatures[item.id] !== false);

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const handleOpenNotif = () => {
    setNotifOpen((o) => !o);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-alt)] flex">
      <aside
        className={cn(
          "sticky top-0 h-screen border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div className="h-full flex flex-col">
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

          <nav className="flex-1 p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group w-full rounded-xl flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    collapsed && "justify-center px-2",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border space-y-2">
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

      <main className="flex-1 min-h-screen">
        <header className="h-16 border-b border-border bg-card px-5 md:px-7 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Espace Étudiant
            </h1>
            <p className="text-xs text-muted-foreground">Suivi académique et administratif</p>
          </div>
          <div className="relative">
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
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-popover">
                  <span className="font-semibold text-sm">Notifications</span>
                  <span className="text-xs text-primary font-medium">{unreadCount} non lue(s)</span>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">Aucune notification</p>
                ) : (
                  notifications.map((n) => (
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
            )}
          </div>
        </header>

        <div className="p-5 md:p-7 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
