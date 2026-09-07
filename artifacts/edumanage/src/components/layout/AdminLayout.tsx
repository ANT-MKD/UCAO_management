import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap, ChevronDown, ChevronRight, Bell, Moon, Sun, Search, LogOut, Settings,
  Menu, X, ArrowLeft,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useAdminAlerts } from "@/hooks/useAdminAlerts";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_SECTIONS,
  resolveNavFromLocation,
  hasChildren,
  filterSectionsByAccess,
  type AdminNavNode,
  type AdminNavSection,
} from "@/lib/adminNavConfig";
import { useRoles } from "@/hooks/useRoleStore";

const TOPBAR_H = "h-16";
const SIDEBAR_W = "w-[88px]";
const SUBNAV_W = "w-60";

function isHrefActive(location: string, href?: string): boolean {
  if (!href) return false;
  if (location === href) return true;
  return location.startsWith(href + "/");
}

function SubNavPanel({
  section,
  panelStack,
  onDrill,
  onBack,
  location,
  onNavigate,
}: {
  section: AdminNavSection;
  panelStack: AdminNavNode[];
  onDrill: (node: AdminNavNode) => void;
  onBack: () => void;
  location: string;
  onNavigate?: () => void;
}) {
  const currentParent = panelStack[panelStack.length - 1];
  const items = currentParent?.children ?? section.children ?? [];
  const title = currentParent?.label ?? section.label;
  const backLabel = panelStack.length > 1
    ? panelStack[panelStack.length - 2]?.label
    : panelStack.length === 1
      ? section.label
      : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border flex-shrink-0">
        {panelStack.length > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1.5"
          >
            <ArrowLeft size={13} />
            {backLabel ?? section.label}
          </button>
        ) : null}
        <h2
          className="text-sm font-bold text-foreground truncate"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          {title}
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map((item) => {
          const nested = hasChildren(item);
          const active = isHrefActive(location, item.href);

          if (nested) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onDrill(item)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors",
                  "text-foreground hover:bg-muted",
                )}
              >
                <span className="truncate font-medium">{item.label}</span>
                <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground" />
              </button>
            );
          }

          if (item.href) {
            const isWip = item.href.startsWith("/admin/wip/");
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <span className="truncate">{item.label}</span>
                {isWip && (
                  <span className="text-[9px] uppercase tracking-wide flex-shrink-0 text-amber-600 dark:text-amber-400 opacity-80">
                    WIP
                  </span>
                )}
              </Link>
            );
          }

          return null;
        })}
      </nav>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const roles = useRoles();
  const [location, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"primary" | "secondary">("primary");

  const resolved = useMemo(() => resolveNavFromLocation(location), [location]);

  const activeRole = currentUser?.roleId ? roles.find((r) => r.id === currentUser.roleId) : undefined;
  const navSections = useMemo(() => {
    if (!currentUser?.roleId) return ADMIN_NAV_SECTIONS;
    if (!activeRole) return ADMIN_NAV_SECTIONS;
    const allowed = new Set(activeRole.accessibleItemIds);
    return filterSectionsByAccess(ADMIN_NAV_SECTIONS, (id) => allowed.has(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeRole dérivé de roles+currentUser.roleId
  }, [currentUser?.roleId, activeRole]);

  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    () => resolved.section?.id ?? "dashboard",
  );
  const [panelStack, setPanelStack] = useState<AdminNavNode[]>([]);

  // Synchronise section + profondeur du panneau avec l'URL
  useEffect(() => {
    if (!resolved.section) return;
    setActiveSectionId(resolved.section.id);
    const trail = resolved.trail;
    if (trail.length <= 1) {
      setPanelStack([]);
    } else {
      setPanelStack(trail.slice(0, -1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on location change only
  }, [location]);

  const activeSection = navSections.find((s) => s.id === activeSectionId) ?? null;
  const showSubnav = !!(activeSection && activeSection.children && activeSection.children.length > 0);

  const adminAlerts = useAdminAlerts();
  const unreadCount = adminAlerts.length;

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const selectSection = (section: AdminNavSection) => {
    setActiveSectionId(section.id);
    setPanelStack([]);
    if (section.href && !section.children) {
      setLocation(section.href);
      setMobileOpen(false);
      setMobileView("primary");
      return;
    }
    setMobileView("secondary");
  };

  const drill = (node: AdminNavNode) => {
    setPanelStack((prev) => [...prev, node]);
  };

  const goBack = () => {
    setPanelStack((prev) => prev.slice(0, -1));
  };

  const closeMobile = () => {
    setMobileOpen(false);
    setMobileView("primary");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-alt)]">
      {/* —— Topbar (sans navigation métier) —— */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 bg-card border-b border-border flex items-center px-3 md:px-5",
          TOPBAR_H,
        )}
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground mr-1"
          onClick={() => { setMobileOpen(true); setMobileView("primary"); }}
          aria-label="Ouvrir le menu"
          data-testid="topbar-menu"
        >
          <Menu size={20} />
        </button>

        <Link href="/admin/dashboard" className="flex items-center gap-2 mr-4 flex-shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg hidden sm:inline" style={{ fontFamily: "Outfit, sans-serif" }}>
            Edu<span className="text-primary">Manage</span>
          </span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-1 md:gap-2">
          <div className="relative">
            {searchOpen ? (
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Search size={15} className="text-muted-foreground" />
                <input
                  autoFocus
                  className="bg-transparent text-sm outline-none w-28 sm:w-40 placeholder:text-muted-foreground"
                  placeholder="Rechercher..."
                />
                <button type="button" onClick={() => setSearchOpen(false)}>
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                data-testid="topbar-search"
              >
                <Search size={18} />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
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
                  <span className="text-xs text-primary font-medium">{unreadCount} alerte(s)</span>
                </div>
                {adminAlerts.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">Aucune alerte — tout est à jour.</p>
                ) : (
                  adminAlerts.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => { setLocation(n.href); setNotifOpen(false); }}
                      className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted cursor-pointer transition-colors bg-primary/[0.03]"
                    >
                      <div className="flex gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{n.temps}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            data-testid="topbar-theme-toggle"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setAvatarOpen((o) => !o); setNotifOpen(false); }}
              className="flex items-center gap-2 pl-2 pr-2 md:pr-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
              data-testid="topbar-avatar"
            >
              <UserAvatar name={currentUser?.name || "Admin"} size="sm" />
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-foreground leading-tight">{currentUser?.name}</div>
                <div className="text-[10px] text-muted-foreground">Administrateur</div>
              </div>
              <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
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
                  type="button"
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

      {/* —— Corps : Sidebar + Subnav + Contenu —— */}
      <div className={cn("pt-16 flex min-h-screen")}>
        {/* Sidebar principal (desktop) */}
        <aside
          className={cn(
            "hidden lg:flex flex-col fixed left-0 top-16 bottom-0 z-30",
            "bg-card border-r border-border",
            SIDEBAR_W,
          )}
        >
          <nav className="flex-1 overflow-y-auto py-3 px-1.5 space-y-1">
            {navSections.map((section) => {
              const Icon = section.icon;
              const active = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section)}
                  title={section.label}
                  className={cn(
                    "w-full flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl text-[10px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  data-testid={`sidebar-${section.id}`}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="leading-tight text-center line-clamp-2 px-0.5">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Panneau sous-navigation (desktop) */}
        <aside
          className={cn(
            "hidden lg:flex flex-col fixed top-16 bottom-0 z-20",
            "bg-card border-r border-border transition-all duration-200 ease-out",
            "left-[88px]",
            showSubnav ? cn(SUBNAV_W, "opacity-100") : "w-0 opacity-0 overflow-hidden border-0",
          )}
        >
          {showSubnav && activeSection && (
            <SubNavPanel
              section={activeSection}
              panelStack={panelStack}
              onDrill={drill}
              onBack={goBack}
              location={location}
            />
          )}
        </aside>

        {/* Contenu principal */}
        <main
          className={cn(
            "flex-1 min-w-0 min-h-[calc(100vh-4rem)] transition-[margin] duration-200 ease-out",
            "lg:ml-[88px]",
            showSubnav && "lg:ml-[calc(88px+15rem)]",
          )}
        >
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* —— Navigation mobile / tablette —— */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <div className="absolute inset-y-0 left-0 w-[min(100%,320px)] bg-card border-r border-border shadow-xl flex flex-col animate-in slide-in-from-left-4 duration-200">
            <div className="h-14 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
              {mobileView === "secondary" && showSubnav ? (
                <button
                  type="button"
                  onClick={() => {
                    if (panelStack.length > 0) goBack();
                    else setMobileView("primary");
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={16} />
                  {panelStack.length > 0 ? (panelStack[panelStack.length - 1]?.label ?? "Retour") : "Menu"}
                </button>
              ) : (
                <span className="font-bold text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Navigation
                </span>
              )}
              <button type="button" onClick={closeMobile} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            {mobileView === "primary" || !showSubnav ? (
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {navSections.map((section) => {
                  const Icon = section.icon;
                  const active = activeSectionId === section.id;
                  const hasSub = !!(section.children && section.children.length > 0);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => selectSection(section)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      <span className="flex-1 text-left">{section.label}</span>
                      {hasSub && <ChevronRight size={16} className="text-muted-foreground" />}
                    </button>
                  );
                })}
              </nav>
            ) : activeSection ? (
              <SubNavPanel
                section={activeSection}
                panelStack={panelStack}
                onDrill={drill}
                onBack={() => {
                  if (panelStack.length > 0) goBack();
                  else setMobileView("primary");
                }}
                location={location}
                onNavigate={closeMobile}
              />
            ) : null}
          </div>
        </div>
      )}

      {(notifOpen || avatarOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setNotifOpen(false); setAvatarOpen(false); }}
        />
      )}
    </div>
  );
}
