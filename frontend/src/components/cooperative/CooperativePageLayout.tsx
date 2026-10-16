'use client';

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconMenu2,
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
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeOverride, setActiveOverride] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
                  : activeOverride;

  return (
    <CooperativeThemeContext.Provider value={dark}>
      <div className="mw-app" data-theme={dark ? "dark" : "light"}>
        <CooperativeSidebar
          active={pageActive}
          membersCount={1248}
          t={sidebarCopy}
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
                <IconMenu2 />
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
              <label className="mw-search">
                <IconSearch aria-hidden="true" />
                <input
                  aria-label={t.searchCooperative}
                  placeholder={t.searchCooperative}
                />
              </label>
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
                <span className="mw-notice-dot" />
              </button>
              <span className="mw-language" aria-label={t.selectedLanguage}>
                FR
              </span>
              <button
                type="button"
                className="mw-icon-button"
                aria-label={dark ? t.activateLightTheme : t.activateDarkTheme}
                onClick={() => setDark((value) => !value)}
              >
                {dark ? <IconSun /> : <IconMoon />}
              </button>
            </div>
            {notificationsOpen && (
              <div className="mw-notification-pop" role="status">
                <strong>Notifications</strong>
                <p>
                  <b>Échéances à venir.</b> 3 remboursements arrivent à échéance cette semaine.
                </p>
                <p>
                  <b>Projets.</b> Un nouveau projet agricole a été soumis.
                </p>
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
