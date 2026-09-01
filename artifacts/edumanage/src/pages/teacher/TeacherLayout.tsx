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
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useNotifications } from "@/hooks/useStudentStore";
import { markNotificationRead } from "@/data/studentStore";

const NAV = [
  { to: "/teacher/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/teacher/schedule", icon: Calendar, label: "Mon EDT" },
  { to: "/teacher/modules", icon: BookOpen, label: "Mes modules" },
  { to: "/teacher/grades", icon: ClipboardList, label: "Saisie notes" },
  { to: "/teacher/cahier", icon: NotebookPen, label: "Cahier de séance" },
  { to: "/teacher/rallonge", icon: Clock3, label: "Demande de rallonge" },
  { to: "/teacher/contract", icon: FileText, label: "Mon contrat" },
];

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useNotifications(currentUser?.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={cn("border-r border-border bg-card transition-all flex flex-col shrink-0", collapsed ? "w-16" : "w-60")}>
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
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((item) => {
            const active = location === item.to;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
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
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-14 border-b border-border bg-card px-4 md:px-6 flex items-center justify-end shrink-0">
          <div className="relative">
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
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

