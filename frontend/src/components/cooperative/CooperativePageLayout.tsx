'use client';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconMoon,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconSearch,
  IconSun,
} from "@tabler/icons-react";

import { CooperativeSidebar } from "@/components/cooperative/CooperativeSidebar";
import { CooperativeThemeContext } from "@/components/cooperative/CooperativeThemeContext";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { accountConfigs, type AccountSlug } from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import { mockMembers } from "@/mocks/cooperative-data";
import { apiClient, getAuthUser, logout } from "@/lib/auth";

type DepositNoticeSummary = {
  count: number;
  cursor: string;
  cursorId: number;
  recent: { id: number; accountNumber: string; memberName: string; amount: number; currency: "USD" | "FC"; createdAt: string }[];
};

import "@/app/home.css";
import "./cooperative-pages.css";

const sidebarCopy = {
  adminSpace: "ESPACE ADMINISTRATEUR",
  adminTools: "GESTION DE LA COOPÉRATIVE",
  cooperative: "Coopérative d'épargne et de crédit",
  role: "Direction Générale",
  signOut: "Déconnexion",
};

export function CooperativePageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const authUser = getAuthUser();
  const roleCopy = authUser?.role === "agent"
    ? { ...sidebarCopy, adminSpace: "ESPACE AGENT", adminTools: "OUTILS DE L’AGENT" }
    : sidebarCopy;
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeOverride, setActiveOverride] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [depositNotice, setDepositNotice] = useState<DepositNoticeSummary>({ count: 0, cursor: "", cursorId: 0, recent: [] });
  const isAdmin = authUser?.role === "admin" || authUser?.role === "superadmin";
  const profileName = authUser?.fullName || "Mon compte";
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase("fr-FR"))
    .join("") || "MW";
  const profileRole = authUser?.role === "agent"
    ? "Agent / Guichetier"
    : authUser?.role === "superadmin"
      ? "Super administrateur"
      : authUser?.role === "admin"
        ? "Administrateur"
        : "Utilisateur";
  const depositCursorKey = authUser ? `mwangaza_deposit_notice_cursor_${authUser.id}` : "";

  useEffect(() => {
    if (!isAdmin || !depositCursorKey) return;
    let active = true;
    let requestInFlight = false;
    const refreshDepositNotices = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const savedCursor = window.localStorage.getItem(depositCursorKey);
        let cursor: { createdAt: string; id: number };
        try {
          cursor = savedCursor ? JSON.parse(savedCursor) : { createdAt: "", id: 0 };
        } catch {
          cursor = { createdAt: "", id: 0 };
        }
        if (!cursor.createdAt || Number.isNaN(new Date(cursor.createdAt).getTime())) {
          cursor = { createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), id: 0 };
          window.localStorage.setItem(depositCursorKey, JSON.stringify(cursor));
        }
        const response = await apiClient.get<DepositNoticeSummary>("/epargnes/notifications/deposits", { params: { since: cursor.createdAt, afterId: cursor.id } });
        if (active) setDepositNotice(response.data);
      } catch {
        // La cloche reste utilisable même si le résumé ne peut pas être chargé.
      } finally {
        requestInFlight = false;
      }
    };
    void refreshDepositNotices();
    const interval = window.setInterval(() => void refreshDepositNotices(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [depositCursorKey, isAdmin]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setMobileSearchOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setMobileSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  function acknowledgeDepositNotices() {
    if (depositCursorKey && depositNotice.cursor) window.localStorage.setItem(depositCursorKey, JSON.stringify({ createdAt: depositNotice.cursor, id: depositNotice.cursorId }));
    setDepositNotice((current) => ({ ...current, count: 0 }));
  }

  const accountMatch = pathname?.match(/^\/comptes-epargne\/([^/]+)$/);
  const accountSlug = accountMatch?.[1] as AccountSlug | undefined;
  const pageActive =
    accountSlug && accountConfigs[accountSlug]
      ? accountConfigs[accountSlug].shortLabel
      : pathname === "/membres"
        ? "Membres"
        : pathname === "/operations/depots-cotisations"
          ? "Dépôts & cotisations"
          : pathname === "/operations/retraits"
            ? "Retraits"
            : pathname === "/operations/credits"
              ? "Crédits"
              : pathname === "/operations/remboursements"
                ? "Remboursements"
                : pathname === "/dashboard"
                  ? "Dashboard"
                  : pathname === "/agents"
                    ? "Agents"
                    : pathname === "/compte-agent"
                      ? "Sécurité du compte"
                  : activeOverride;

  return (
    <CooperativeThemeContext.Provider value={dark}>
      <div className="mw-app" data-theme={dark ? "dark" : "light"}>
        <CooperativeSidebar
          active={pageActive}
          membersCount={1248}
          t={roleCopy}
          onNavigate={(label) => setActiveOverride(label)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className={`mw-main${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
          <header className="mw-topbar">
            <div className="mw-top-left">
              <button
                type="button"
                className="mw-icon-button mw-mobile-menu"
                aria-label={t.openNavigation}
                onClick={() => setMobileOpen(true)}
              >
                <IconPanelLeftOpen size={19} />
              </button>
              {isSidebarCollapsed && (
                <button
                  type="button"
                  className="mw-icon-button mw-topbar-sidebar-toggle"
                  aria-label="Agrandir la barre latérale"
                  title="Agrandir la barre latérale"
                  onClick={() => setIsSidebarCollapsed(false)}
                >
                  <IconPanelLeftOpen size={19} />
                </button>
              )}
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
                  aria-label={t.searchCooperative}
                  placeholder={t.searchCooperative}
                />
                <kbd className="mw-search-shortcut">Ctrl K</kbd>
              </label>
            </div>
            <div className="mw-top-context" aria-label="Emplacement actuel">
              <span>{authUser?.role === "agent" ? "Espace agent" : "Administration"}</span>
              {pageActive && <><i aria-hidden="true">/</i><strong>{pageActive}</strong></>}
            </div>
            <div className="mw-top-right">
              <button
                type="button"
                className="mw-icon-button"
                aria-label={t.notifications}
                title={t.notifications}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <IconBell />
                {isAdmin
                  ? depositNotice.count > 0 && <span className="mw-notice-count" aria-label={`${depositNotice.count} nouveaux dépôts`}>{depositNotice.count > 99 ? "99+" : depositNotice.count}</span>
                  : <span className="mw-notice-dot" />}
              </button>
              <span className="mw-language" aria-label={t.selectedLanguage} title="Langue actuellement utilisée : français">
                FR
              </span>
              <button
                type="button"
                className="mw-icon-button"
                aria-label={dark ? t.activateLightTheme : t.activateDarkTheme}
                title={dark ? t.activateLightTheme : t.activateDarkTheme}
                onClick={() => setDark((value) => !value)}
              >
                {dark ? <IconSun /> : <IconMoon />}
              </button>
              <div className="mw-profile-menu">
                <button
                  type="button"
                  className="mw-profile-trigger"
                  aria-label={`Profil de ${profileName}`}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setProfileOpen((open) => !open);
                    setNotificationsOpen(false);
                  }}
                >
                  <span className="mw-profile-avatar" aria-hidden="true">{profileInitials}</span>
                  <span className="mw-profile-trigger-copy">
                    <strong>{profileName}</strong>
                    <small>{profileRole}</small>
                  </span>
                  <IconChevronDown size={15} aria-hidden="true" />
                </button>
                {profileOpen && (
                  <div className="mw-profile-pop" role="menu" aria-label="Menu du profil">
                    <div className="mw-profile-pop-heading">
                      <strong>{profileName}</strong>
                      <span>{authUser?.email || authUser?.accountNumber || profileRole}</span>
                    </div>
                    <Link href="/compte-agent" role="menuitem" onClick={() => setProfileOpen(false)}>
                      Gérer mon profil
                    </Link>
                    <button type="button" role="menuitem" onClick={logout}>
                      <IconLogout size={16} aria-hidden="true" /> Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
            {notificationsOpen && (
              <div className="mw-notification-pop" role="status">
                <strong>Notifications</strong>
                {isAdmin ? <>
                  <p><b>{depositNotice.count} nouveau{depositNotice.count > 1 ? "x" : ""} dépôt{depositNotice.count > 1 ? "s" : ""}</b> depuis votre dernière consultation.</p>
                  {depositNotice.recent.length > 0 && <ul className="mw-notification-deposits">
                    {depositNotice.recent.map((item) => <li key={item.id}>
                      <span><b>{item.memberName}</b><small>{item.accountNumber}</small></span>
                      <strong>{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(item.amount)} {item.currency}</strong>
                    </li>)}
                  </ul>}
                  <Link className="mw-notification-link" href="/operations/depots-cotisations" onClick={acknowledgeDepositNotices}>Voir les dépôts</Link>
                </> : <p><b>Notifications.</b> Consultez les annonces et informations de la coopérative.</p>}
              </div>
            )}
          </header>
          <div className="mw-content coop-page-content">{children}</div>
        </main>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="!w-[290px] !max-w-[84vw] !border-0 !bg-transparent !p-0 !shadow-none"
            showClose
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <CooperativeSidebar
              active={pageActive}
              membersCount={mockMembers.length}
              t={sidebarCopy}
              close={() => setMobileOpen(false)}
              onNavigate={(label) => setActiveOverride(label)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </CooperativeThemeContext.Provider>
  );
}
