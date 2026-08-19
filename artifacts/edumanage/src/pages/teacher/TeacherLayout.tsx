import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  ClipboardList,
  NotebookPen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";

const NAV = [
  { to: "/teacher/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/teacher/schedule", icon: Calendar, label: "Mon EDT" },
  { to: "/teacher/modules", icon: BookOpen, label: "Mes modules" },
  { to: "/teacher/grades", icon: ClipboardList, label: "Saisie notes" },
  { to: "/teacher/cahier", icon: NotebookPen, label: "Cahier de sÃ©ance" },
];

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
            {!collapsed && "DÃ©connexion"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}

