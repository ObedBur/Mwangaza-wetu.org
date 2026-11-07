'use client';

import {
  IconBell,
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconFilter,
  IconMoon,
  IconLogout,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconPlus,
  IconSearch,
  IconSun,
} from "@/lib/tabler-icons";
import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  onExpand,
}: {
  compact?: boolean;
  onClick?: () => void;
  onExpand?: () => void;
}) {
  if (compact) {
    return (
      <button
        type="button"
        className="member-logo member-logo-expand"
        aria-label="Développer la barre latérale"
        title="Développer la barre latérale"
        onClick={onExpand}
      >
        <Image src="/logo.png" alt="" width={38} height={38} className="member-logo-image" priority />
      </button>
    );
  }

  return (
    <Link
      href="/accueil"
      className="member-logo"
      aria-label="Mwangaza Wetu, accueil"
      onClick={onClick}
    >
      <Image src="/logo.png" alt="" width={38} height={38} className="member-logo-image" priority />
      <span className="member-brand-copy">
        <span>Mwangaza <strong>Wetu</strong></span>
        <small>ESPACE MEMBRE</small>
      </span>
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
        <MemberLogo
          compact={collapsed}
          onClick={onNavigate}
          onExpand={() => setCollapsed(false)}
        />
        {!isMobile && !collapsed && (
          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Développer la barre latérale" : "Réduire la barre latérale"}
            title={collapsed ? "Développer la barre latérale" : "Réduire la barre latérale"}
          >
            <IconPanelLeftClose size={17} />
          </button>
        )}
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
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <IconLogout size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MemberPageToolbar({ activePath }: { activePath: string }) {
  const { onlyPending, setOnlyPending } = useMemberSearch();
  const activeItem = memberNavigation.find((item) => item.href === activePath);
  const activeTitle = activeItem?.label ?? "Accueil";
  const authUser = getAuthUser();
  const displayName = authUser?.fullName || member.name;
  const firstName = authUser?.firstName || displayName.split(" ")[0];

  return (
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
            <h1>Bonjour, {firstName}</h1>
            <div className="member-greeting-date">
              <IconCalendar size={13} aria-hidden="true" />
              <span>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date())}</span>
            </div>
          </>
        ) : <h1>{activeTitle}</h1>}
      </div>
      {activePath === "/transactions" ? (
        <div className="toolbar-controls">
          <button
            type="button"
            className={`filter-button${onlyPending ? " is-selected" : ""}`}
            aria-label={onlyPending ? "Afficher toutes les opérations" : "Filtrer les opérations en attente"}
            aria-pressed={onlyPending}
            onClick={() => setOnlyPending(!onlyPending)}
          >
            <IconFilter size={15} aria-hidden="true" />
            <span>{onlyPending ? "En attente" : "Filtrer"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MemberTopbar({ activePath }: { activePath: string }) {
  const [isDark, setIsDark] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { query, setQuery } = useMemberSearch();
  const activeItem = memberNavigation.find((item) => item.href === activePath);
  const activeTitle = activeItem?.label ?? "Accueil";
  const authUser = getAuthUser();
  const displayName = authUser?.fullName || member.name;
  const displayNumber = authUser?.accountNumber || member.number;
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || member.initials;

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

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setMobileSearchOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationOpen(false);
        setMobileSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  function toggleTheme() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    document.documentElement.classList.toggle("light", !nextIsDark);
    document.documentElement.setAttribute("data-theme", nextIsDark ? "dark" : "light");
    document.documentElement.style.colorScheme = nextIsDark ? "dark" : "light";
    window.localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  return (
    <header className="mw-topbar">
      <div className="mw-top-left">
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="mw-icon-button mw-mobile-menu"
              aria-label="Ouvrir le menu de navigation"
            >
              <IconPanelLeftOpen size={19} />
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
        <button
          type="button"
          className="mw-icon-button mw-mobile-search-trigger"
          aria-label="Ouvrir la recherche"
          aria-expanded={mobileSearchOpen}
          onClick={() => {
            if (mobileSearchOpen) {
              setMobileSearchOpen(false);
              searchInputRef.current?.blur();
            } else {
              setMobileSearchOpen(true);
              window.requestAnimationFrame(() => searchInputRef.current?.focus());
            }
          }}
        >
          <IconSearch aria-hidden="true" />
        </button>
        <label className={`mw-search${mobileSearchOpen ? " is-open" : ""}`}>
          <IconSearch aria-hidden="true" />
          <input
            ref={searchInputRef}
            aria-label="Rechercher dans la coopérative..."
            placeholder="Rechercher dans la coopérative..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="mw-search-shortcut">Ctrl K</kbd>
        </label>
      </div>
      <div className="mw-top-context" aria-label="Emplacement actuel">
        <span>Espace membre</span>
        {activeTitle && (
          <>
            <i aria-hidden="true">/</i>
            <strong>{activeTitle}</strong>
          </>
        )}
      </div>
      <div className="mw-top-right">
        <button
          type="button"
          className="mw-icon-button"
          aria-label={`Notifications, ${unreadCount} non lue(s)`}
          title="Notifications"
          aria-expanded={notificationOpen}
          onClick={() => {
            setNotificationOpen((open) => !open);
            setProfileOpen(false);
          }}
        >
          <IconBell />
          {unreadCount > 0 && <span className="mw-notice-dot" />}
        </button>
        <span
          className="mw-language"
          aria-label="Langue sélectionnée : français"
          title="Langue actuellement utilisée : français"
        >
          FR
        </span>
        <button
          type="button"
          className="mw-icon-button"
          aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
          title={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
          onClick={toggleTheme}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
        <div className="mw-profile-menu">
          <button
            type="button"
            className="mw-profile-trigger"
            aria-label={`Profil de ${displayName}`}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationOpen(false);
            }}
          >
            <span className="mw-profile-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="mw-profile-trigger-copy">
              <strong>{displayName}</strong>
              <small>Membre</small>
            </span>
            <IconChevronDown size={15} aria-hidden="true" />
          </button>
          {profileOpen && (
            <div className="mw-profile-pop" role="menu" aria-label="Menu du profil">
              <div className="mw-profile-pop-heading">
                <strong>{displayName}</strong>
                <span>{displayNumber || authUser?.email || "Membre"}</span>
              </div>
              <Link href="/profil" role="menuitem" onClick={() => setProfileOpen(false)}>
                Gérer mon profil
              </Link>
              <button type="button" role="menuitem" onClick={logout}>
                <IconLogout size={16} aria-hidden="true" /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
      {notificationOpen && (
        <div className="mw-notification-pop" role="status">
          <strong>Notifications</strong>
          <p>
            {unreadCount
              ? `${unreadCount} notification(s) non lue(s).`
              : "Aucune nouvelle notification."}
          </p>
          <Link
            className="mw-notification-link"
            href="/annonces"
            onClick={() => setNotificationOpen(false)}
          >
            Voir les annonces
          </Link>
        </div>
      )}
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
            <div className="member-content">
              <MemberPageToolbar activePath={activePath} />
              {children}
            </div>
          </main>
        </div>
      </div>
    </MemberSearchContext.Provider>
  );
}
