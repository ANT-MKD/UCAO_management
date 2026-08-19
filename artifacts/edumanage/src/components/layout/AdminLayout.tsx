import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap, ChevronDown, Bell, Moon, Sun, Search, LogOut, Settings,
  LayoutDashboard, BookOpen, Users, FileText, DollarSign, X
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { NOTIFICATIONS } from "@/data/mockData";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ElementType;
  children?: { label: string; href: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Académiques", icon: BookOpen,
    children: [
      { label: "Filières", href: "/admin/filieres" },
      { label: "Niveaux", href: "/admin/niveaux" },
      { label: "Semestres", href: "/admin/semestres" },
      { label: "Classes", href: "/admin/classes" },
      { label: "Salles", href: "/admin/salles" },
      { label: "Unités d'Ens. (UE)", href: "/admin/ues" },
      { label: "Éléments Const. (EC)", href: "/admin/ecs" },
      { label: "Emploi du Temps", href: "/admin/schedule" },
      { label: "Cahiers de séance", href: "/admin/cahiers" },
      { label: "Années Académiques", href: "/admin/annees" },
    ],
  },
  {
    label: "Utilisateurs", icon: Users,
    children: [
      { label: "Étudiants", href: "/admin/students" },
      { label: "Enseignants", href: "/admin/teachers" },
      { label: "Comptes & Rôles", href: "/admin/users" },
    ],
  },
  {
    label: "Évaluations", icon: FileText,
    children: [
      { label: "Saisie des Notes", href: "/admin/notes" },
      { label: "Moyennes", href: "/admin/moyennes" },
      { label: "Délibérations", href: "/admin/deliberations" },
      { label: "Relevés & Bulletins", href: "/admin/releves" },
      { label: "Attestations", href: "/admin/attestations" },
    ],
  },
  {
    label: "Messages", icon: Bell,
    children: [
      { label: "Messagerie", href: "/admin/messages" },
      { label: "Demandes", href: "/admin/requests" },
    ],
  },
  {
    label: "Finances", icon: DollarSign,
    children: [
      { label: "Config. Frais Scolarité", href: "/admin/frais" },
      { label: "Paiements Étudiants", href: "/admin/paiements" },
      { label: "Vacations Enseignants", href: "/admin/vacations" },
      { label: "Journal des Transactions", href: "/admin/transactions" },
    ],
  },
];

function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = item.children?.some((c) => location.startsWith(c.href));

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        data-testid={`nav-dropdown-${item.label}`}
      >
        {item.label}
        <ChevronDown size={14} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-52 bg-popover border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in-0 slide-in-from-top-2 duration-150">
          {item.children?.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "block px-4 py-2 text-sm transition-colors",
                location === child.href
                  ? "text-primary bg-primary/5 font-medium"
                  : "text-foreground hover:bg-muted"
              )}
              onClick={() => setOpen(false)}
              data-testid={`nav-link-${child.label}`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const unreadCount = NOTIFICATIONS.filter((n) => !n.lue).length;

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-alt)]">
      {/* Topbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-card border-b border-border flex items-center px-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-center gap-2 mr-8 flex-shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
            Edu<span className="text-primary">Manage</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  location === item.href || location.startsWith(item.href + "/")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`nav-link-${item.label}`}
              >
                {item.label}
              </Link>
            ) : (
              <NavDropdown key={item.label} item={item} />
            )
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Search */}
          <div className="relative">
            {searchOpen ? (
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Search size={15} className="text-muted-foreground" />
                <input
                  autoFocus
                  className="bg-transparent text-sm outline-none w-40 placeholder:text-muted-foreground"
                  placeholder="Rechercher..."
                />
                <button onClick={() => setSearchOpen(false)}>
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                data-testid="topbar-search"
              >
                <Search size={18} />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen((o) => !o); setAvatarOpen(false); }}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              data-testid="topbar-notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-sm">Notifications</span>
                  <span className="text-xs text-primary font-medium">{unreadCount} non lues</span>
                </div>
                {NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    className={cn("px-4 py-3 border-b border-border last:border-0 hover:bg-muted cursor-pointer transition-colors", !n.lue && "bg-primary/[0.03]")}
                  >
                    <div className="flex gap-2">
                      {!n.lue && <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />}
                      <div className={!n.lue ? "" : "pl-3.5"}>
                        <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{n.temps}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dark mode */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            data-testid="topbar-theme-toggle"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Avatar */}
          <div className="relative">
            <button
              onClick={() => { setAvatarOpen((o) => !o); setNotifOpen(false); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
              data-testid="topbar-avatar"
            >
              <UserAvatar name={currentUser?.name || "Admin"} size="sm" />
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-foreground leading-tight">{currentUser?.name}</div>
                <div className="text-[10px] text-muted-foreground">Administrateur</div>
              </div>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
            {avatarOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-popover border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <div className="font-semibold text-sm text-foreground">{currentUser?.name}</div>
                  <div className="text-xs text-muted-foreground">{currentUser?.email}</div>
                </div>
                <Link
                  href="/admin/settings"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Settings size={14} />
                  Paramètres
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  data-testid="topbar-logout"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 min-h-screen">
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      {/* Overlay for dropdowns */}
      {(notifOpen || avatarOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setNotifOpen(false); setAvatarOpen(false); }}
        />
      )}
    </div>
  );
}
