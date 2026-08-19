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
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";

interface StudentLayoutProps {
  children: React.ReactNode;
}

interface StudentNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const STUDENT_NAV_ITEMS: StudentNavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Emploi du temps", href: "/student/schedule", icon: CalendarDays },
  { label: "Notes & Relevés", href: "/student/grades", icon: FileText },
  { label: "Paiements", href: "/student/payments", icon: CreditCard },
  { label: "Messagerie", href: "/student/messages", icon: MessageCircle },
  { label: "Mes demandes", href: "/student/requests", icon: ClipboardList },
  { label: "Profil", href: "/student/profile", icon: User },
];

export function StudentLayout({ children }: StudentLayoutProps) {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    setLocation("/login");
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
            {STUDENT_NAV_ITEMS.map((item) => {
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
          <button className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          </button>
        </header>

        <div className="p-5 md:p-7 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
