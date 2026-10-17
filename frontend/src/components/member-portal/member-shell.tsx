'use client';

import {
  IconBell,
  IconChevronRight,
  IconFilter,
  IconMoon,
  IconPanelLeftOpen,
  IconSun,
} from "@/lib/tabler-icons";
import { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/member-portal/portal-ui";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  member,
  memberNavigation,
  navigationGroups,
} from "@/lib/member-portal-config";
import { apiClient, logout, getAuthUser } from "@/lib/auth";

interface SearchContextValue {
  query: string;
  setQuery: (query: string) => void;
  onlyPending: boolean;
  setOnlyPending: (onlyPending: boolean) => void;
}

const MemberSearchContext = createContext<SearchContextValue>({
  query: "",
  setQuery: () => undefined,
  onlyPending: false,
  setOnlyPending: () => undefined,
});

export function useMemberSearch() {
  return useContext(MemberSearchContext);
}

function MemberLogo({
  compact = false,
  onClick,
}: {
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/accueil"
      className="member-logo"
      aria-label="Mwangaza Wetu, accueil"
      onClick={onClick}
    >
      <Image src="/logo.png" alt="" width={38} height={38} className="member-logo-image" priority />
      {!compact ? (
        <span className="member-brand-copy">
          <span>Mwangaza <strong>Wetu</strong></span>
          <small>ESPACE MEMBRE</small>
        </span>
      ) : null}
    </Link>
  );
}

function MemberSidebar({
  activePath,
  isMobile = false,
  onNavigate,
}: {
  activePath: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const authUser = getAuthUser();
  const displayName = authUser?.fullName || member.name;
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || member.initials;
  const displayNumber = authUser?.accountNumber || member.number;

  const handleLogout = () => {
    if (authUser) {
      logout();
    } else {
      setFeedback("Session de démonstration active");
    }
  };

  return (
    <aside
      className={`member-sidebar${collapsed ? " is-collapsed" : ""}${isMobile ? " is-mobile" : ""}`}
    >
      <div className="sidebar-brand-row">
        <MemberLogo compact={collapsed} onClick={onNavigate} />
      </div>
      <nav className="sidebar-navigation" aria-label="Navigation principale">
        {navigationGroups.map((group) => (
          <div className="sidebar-nav-group" key={group.id}>
            {!collapsed ? (
              <h2>{group.label}</h2>
            ) : (
              <span className="sr-only">{group.label}</span>
            )}
            <ul>
              {memberNavigation
                .filter(
                  (item) =>
                    item.group === group.id && item.showInNavigation !== false,
                )
                .map((item) => {
                  const Icon = item.icon;
                  const active = activePath === item.href;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        className={`sidebar-link${active ? " is-active" : ""}`}
                        onClick={onNavigate}
                      >
                        <Icon size={17} stroke={1.7} aria-hidden="true" />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        {feedback ? (
          <p className="sidebar-feedback" role="status">
            {feedback}
          </p>
        ) : null}
        <div className="sidebar-member">
          <Avatar name={displayName} initials={initials} small />
          {!collapsed ? (
            <span className="sidebar-member-copy">
              <strong>{displayName}</strong>
              <span>{displayNumber}</span>
            </span>
          ) : null}
          <button
            className="sidebar-logout"
            type="button"
            onClick={handleLogout}
          >
            {collapsed ? "Sortir" : "Déconnexion"}
          </button>
        </div>
        <button
          className="sidebar-collapse"
          type="button"
          aria-label={
            collapsed
              ? "Développer la barre latérale"
              : "Réduire la barre latérale"
          }
          title={
            collapsed
              ? "Développer la barre latérale"
              : "Réduire la barre latérale"
          }
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "Développer" : "Réduire la sidebar"}
        </button>
      </div>
    </aside>
  );
}

function MemberTopbar({ activePath }: { activePath: string }) {
  const [isDark, setIsDark] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { onlyPending, setOnlyPending } = useMemberSearch();
  const activeItem = memberNavigation.find((item) => item.href === activePath);
  const activeTitle = activeItem?.label ?? "Accueil";
  const authUser = getAuthUser();
  const displayName = authUser?.fullName || member.name;
  const firstName = displayName.split(" ")[0];
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    let active = true;
    const refreshUnreadCount = () => apiClient.get<{ count: number }>("/notifications/moi/non-lues")
      .then((response) => { if (active) setUnreadCount(response.data.count); })
      .catch(() => { if (active) setUnreadCount(0); });
    void refreshUnreadCount();
    const interval = window.setInterval(() => void refreshUnreadCount(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function toggleTheme() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    document.documentElement.classList.toggle("light", !nextIsDark);
    document.documentElement.style.colorScheme = nextIsDark ? "dark" : "light";
    window.localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  return (
    <header className="member-topbar">
      <div className="desktop-topbar">
        <div className="topbar-leading">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="icon-button mobile-sidebar-trigger"
                aria-label="Ouvrir le menu de navigation"
              >
                <IconPanelLeftOpen size={19} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="mobile-sidebar-sheet">
              <SheetTitle className="sr-only">Navigation du membre</SheetTitle>
              <MemberSidebar
                activePath={activePath}
                isMobile
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="topbar-context">Espace membre</span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-button notification-trigger"
            aria-label={`Notifications, ${unreadCount} non lue(s)`}
            aria-pressed={notificationOpen}
            onClick={() => setNotificationOpen((value) => !value)}
          >
            <IconBell size={19} aria-hidden="true" />
            {unreadCount > 0 ? <span className="notification-dot" aria-hidden="true" /> : null}
          </button>
          <span className="topbar-locale" aria-label="Langue : français">FR</span>
          <button
            type="button"
            className="icon-button"
            aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
            onClick={toggleTheme}
          >
            {isDark ? <IconSun size={18} aria-hidden="true" /> : <IconMoon size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {notificationOpen ? (
        <div className="notification-popover" role="status">
          <span className="notification-popover-mark">
            <IconBell size={16} aria-hidden="true" />
          </span>
          <Link href="/annonces">{unreadCount ? `${unreadCount} notification(s) non lue(s). Voir les annonces.` : "Aucune notification non lue."}</Link>
        </div>
      ) : null}
      <div className="page-toolbar">
        <div className="page-heading">
          {activePath !== "/accueil" ? (
            <div className="breadcrumbs">
              <Link href="/accueil">Accueil</Link>
              <IconChevronRight size={13} aria-hidden="true" />
              <span>{activeTitle}</span>
            </div>
          ) : null}
          {activePath === "/accueil" ? (
            <>
              <h1>Bonjour, {firstName} !</h1>
              <p className="welcome-subtitle">Gérez votre épargne en toute simplicité</p>
            </>
          ) : <h1>{activeTitle}</h1>}
        </div>
        {activePath === "/accueil" || activePath === "/transactions" ? (
          <div className="toolbar-controls">
            <button
              type="button"
              className={`filter-button${onlyPending ? " is-selected" : ""}`}
              aria-label={
                onlyPending
                  ? "Afficher toutes les opérations"
                  : "Filtrer les opérations en attente"
              }
              aria-pressed={onlyPending}
              onClick={() => setOnlyPending(!onlyPending)}
            >
              <IconFilter size={15} aria-hidden="true" />
              <span>{onlyPending ? "En attente" : "Filtrer"}</span>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function MemberShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const activePath = pathname === "/" ? "/accueil" : pathname;

  return (
    <MemberSearchContext.Provider
      value={{ query, setQuery, onlyPending, setOnlyPending }}
    >
      <div className="member-page-backdrop">
        <div className="member-app-frame">
          <MemberSidebar activePath={activePath} />
          <main className="member-main">
            <MemberTopbar activePath={activePath} />
            <div className="member-content">{children}</div>
          </main>
        </div>
      </div>
    </MemberSearchContext.Provider>
  );
}
