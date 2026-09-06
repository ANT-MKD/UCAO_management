import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  ClipboardList,
  NotebookPen,
  Clock3,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Library,
  CalendarX,
  Gauge,
  Wallet,
  CircleDollarSign,
  MessageCircle,
  User,
  Menu,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useNotifications, useMessages } from "@/hooks/useStudentStore";
import { markNotificationRead } from "@/data/studentStore";
import { TEACHER_PORTAL_FEATURES } from "@/data/portalFeaturesStore";
import { usePortalFeatures } from "@/hooks/usePortalFeaturesStore";

const ICONS_BY_ID: Record<string, React.ElementType> = {
  "teacher-dashboard": LayoutDashboard,
  "teacher-schedule": Calendar,
  "teacher-modules": BookOpen,
  "teacher-grades": ClipboardList,
  "teacher-cahier": NotebookPen,
  "teacher-ressources": Library,
  "teacher-absences": CalendarX,
  "teacher-pointage": Clock3,
  "teacher-volume": Gauge,
  "teacher-rallonge": Clock3,
  "teacher-vacations": Wallet,
  "teacher-decomptes": CircleDollarSign,
  "teacher-contract": FileText,
  "teacher-messages": MessageCircle,
  "teacher-profile": User,
};

const NAV = TEACHER_PORTAL_FEATURES.map((f) => ({
  id: f.id,
  to: f.href,
  icon: ICONS_BY_ID[f.id],
  label: f.label,
}));

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useNotifications(currentUser?.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const messages = useMessages(currentUser?.id);
  const unreadMessages = messages.filter((m) => m.toUserId === currentUser?.id && !m.read).length;
  const portalFeatures = usePortalFeatures();
  const visibleNav = NAV.filter((item) => portalFeatures[item.id] !== false);
  const mainNav = visibleNav.filter((item) => item.id !== "teacher-profile");
  const profileNavItem = visibleNav.find((item) => item.id === "teacher-profile");

  const NAV_BADGES: Record<string, number> = { "teacher-messages": unreadMessages };

  const renderNavItem = (item: (typeof NAV)[number], opts?: { forceExpanded?: boolean; onNavigate?: () => void }) => {
    const active = location === item.to;
    const badgeCount = NAV_BADGES[item.id] ?? 0;
    const expanded = opts?.forceExpanded || !collapsed;
    return (
      <Link
        key={item.to}
        href={item.to}
        onClick={opts?.onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {expanded && <span className="flex-1 truncate">{item.label}</span>}
        {badgeCount > 0 && (
          <span className={cn("flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center", !expanded && "hidden")}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={cn("hidden lg:flex border-r border-border bg-card transition-all flex-col shrink-0", collapsed ? "w-16" : "w-60")}>
        <div className="h-14 flex items-center justify-between px-3 border-b border-border">
          {!collapsed && (
            <span className="font-bold text-sm truncate" style={{ fontFamily: "Outfit, sans-serif" }}>
              Espace enseignant
            </span>
          )}
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="p-2 rounded-lg hover:bg-muted">
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {mainNav.map((item) => renderNavItem(item))}
        </nav>
        {profileNavItem && (
          <div className="px-2 pt-2 border-t border-border">
            {renderNavItem(profileNavItem)}
          </div>
        )}
        <div className="p-3 border-t border-border space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1">
              <UserAvatar name={currentUser?.name ?? "Prof"} size="sm" />
              <p className="text-xs truncate">{currentUser?.name}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              setLocation("/login");
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-2 py-2 rounded-lg hover:bg-muted"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Déconnexion"}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(85%,320px)] bg-card border-r border-border shadow-xl flex flex-col animate-in slide-in-from-left-4 duration-200">
            <div className="h-14 flex items-center justify-between px-3 border-b border-border shrink-0">
              <span className="font-bold text-sm truncate" style={{ fontFamily: "Outfit, sans-serif" }}>
                Espace enseignant
              </span>
              <button type="button" onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-muted" data-testid="teacher-mobile-nav-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {mainNav.map((item) => renderNavItem(item, { forceExpanded: true, onNavigate: () => setMobileOpen(false) }))}
            </nav>
            {profileNavItem && (
              <div className="px-2 pt-2 border-t border-border">
                {renderNavItem(profileNavItem, { forceExpanded: true, onNavigate: () => setMobileOpen(false) })}
              </div>
            )}
            <div className="p-3 border-t border-border space-y-2 shrink-0">
              <div className="flex items-center gap-2 px-1">
                <UserAvatar name={currentUser?.name ?? "Prof"} size="sm" />
                <p className="text-xs truncate">{currentUser?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setLocation("/login");
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-2 py-2 rounded-lg hover:bg-muted"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-14 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
          <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted text-muted-foreground" data-testid="teacher-mobile-nav-open">
            <Menu size={20} />
          </button>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              data-testid="teacher-topbar-notifications"
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
                    notifications.filter((n) => !n.archived).slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.read && currentUser) markNotificationRead(n.id, currentUser.id); }}
                        className={cn(
                          "px-4 py-3 border-b border-border last:border-0 hover:bg-muted cursor-pointer transition-colors",
                          !n.read && "bg-primary/[0.03]",
                        )}
                        data-testid={`teacher-notification-${n.id}`}
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
                  href="/teacher/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-primary text-center hover:bg-muted transition-colors border-t border-border flex-shrink-0"
                  data-testid="teacher-notifications-see-all"
                >
                  Voir toutes les notifications
                </Link>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

