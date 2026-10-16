'use client';

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsExchange,
  IconBuildingCommunity,
  IconCalculator,
  IconChartPie,
  IconChevronDown,
  IconClock,
  IconCreditCard,
  IconDashboard,
  IconFileText,
  IconLogout,
  IconMessageCircle,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconSettings,
  IconSun,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import { accountConfigs, accountSlugs } from "@/lib/account-config";
import { getAuthUser, logout } from "@/lib/auth";

type NavigationItem = {
  label: string;
  href: string;
  icon: any;
  count?: string;
  color?: string;
  tooltip?: string;
};

type NavigationGroup = {
  title: string;
  collapsible?: boolean;
  items: NavigationItem[];
};

type SidebarCopy = {
  adminSpace: string;
  adminTools: string;
  cooperative: string;
  role: string;
  signOut: string;
};

const navigationGroups: NavigationGroup[] = [
  {
    title: "Principal",
    items: [{ label: "Dashboard", href: "/dashboard", icon: IconDashboard }],
  },
  {
    title: "Membres",
    items: [
      { label: "Membres", href: "/membres", icon: IconUsers, count: "1 248" },
    ],
  },
  {
    title: "Comptes d’épargne",
    collapsible: true,
    items: accountSlugs.map((slug) => {
      const account = accountConfigs[slug];
      return {
        label: account.shortLabel,
        href: `/comptes-epargne/${slug}`,
        icon: account.icon,
        color: slug,
        tooltip: account.subtitle,
      };
    }),
  },
  {
    title: "Opérations",
    items: [
      {
        label: "Dépôts & cotisations",
        href: "/operations/depots-cotisations",
        icon: IconArrowDown,
      },
      { label: "Retraits", href: "/operations/retraits", icon: IconArrowUp },
      { label: "Crédits", href: "/operations/credits", icon: IconCreditCard },
      {
        label: "Remboursements",
        href: "/operations/remboursements",
        icon: IconArrowsExchange,
      },
    ],
  },
  {
    title: "Comptabilité",
    items: [
      {
        label: "Caisse & comptabilité",
        href: "/comptabilite",
        icon: IconCalculator,
      },
    ],
  },
  {
    title: "Outils",
    items: [
      { label: "Rapports", href: "/rapports", icon: IconChartPie },
      { label: "Paramètres", href: "/parametres", icon: IconSettings },
    ],
  },
];

export function CooperativeSidebar({
  active,
  onNavigate,
  close,
  membersCount,
  t,
  isCollapsed = false,
  onToggleCollapse,
}: {
  active: string;
  onNavigate?: (label: string, href: string) => void;
  close?: () => void;
  membersCount?: number;
  t: SidebarCopy;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [savingsOpen, setSavingsOpen] = useState(true);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const pathname = usePathname();
  const authUser = getAuthUser();
  const initials = authUser?.fullName
    ? authUser.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p[0].toUpperCase())
        .join("")
    : "SA";
  const userName = authUser?.fullName || "Super Admin";
  const userRole = authUser?.role
    ? authUser.role === "superadmin"
      ? "Direction Générale"
      : authUser.role === "admin"
        ? "Administration"
        : authUser.role
    : t.role;

  return (
    <aside
      className={`mw-sidebar${isCollapsed ? " is-collapsed" : ""}${close ? " mw-mobile-sidebar" : ""}`}
    >
      <div className={`mw-sidebar-header${isCollapsed ? " is-collapsed-header" : ""}`}>
        {isCollapsed ? (
          <button
            type="button"
            className={`mw-sidebar-reopen-btn ${isLogoHovered ? "is-hovered" : ""}`}
            onClick={onToggleCollapse}
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            onFocus={() => setIsLogoHovered(true)}
            onBlur={() => setIsLogoHovered(false)}
            aria-label="Agrandir la barre latérale"
            title="Agrandir la barre latérale"
          >
            <div className="mw-brand-logo-wrap mw-reopen-logo">
              <Image
                src="/logo.png"
                alt="Mwangaza Wetu"
                width={38}
                height={38}
                className="mw-brand-logo"
                priority
              />
            </div>
            <span className="mw-reopen-icon-wrap" aria-hidden="true">
              <IconX size={20} className="mw-reopen-icon" />
            </span>
          </button>
        ) : (
          <>
            <Link className="mw-brand" href="/dashboard" onClick={close}>
              <div className="mw-brand-logo-wrap">
                <Image
                  src="/logo.png"
                  alt="Mwangaza Wetu"
                  width={38}
                  height={38}
                  className="mw-brand-logo"
                  priority
                />
              </div>
              <div className="mw-brand-text">
                <span className="mw-brand-name">Mwangaza Wetu</span>
                <span className="mw-brand-caption">{t.adminSpace}</span>
              </div>
            </Link>
            {onToggleCollapse && (
              <button
                type="button"
                className="mw-sidebar-collapse-btn"
                onClick={onToggleCollapse}
                aria-label="Réduire la barre latérale"
                title="Fermer la barre latérale"
              >
                <IconPanelLeftClose size={19} className="mw-collapse-default-icon" aria-hidden="true" />
                <IconX size={18} className="mw-collapse-hover-icon" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>
      <nav className="mw-nav" aria-label={t.adminTools}>
        {navigationGroups.map((group) => (
          <section className="mw-nav-group" key={group.title}>
            {group.collapsible ? (
              <button
                type="button"
                className="mw-nav-group-title mw-nav-group-toggle"
                aria-expanded={savingsOpen}
                aria-controls="mw-savings-links"
                onClick={() => setSavingsOpen((open) => !open)}
              >
                <span>{group.title}</span>
                <IconChevronDown
                  aria-hidden="true"
                  className={savingsOpen ? "" : "is-collapsed"}
                />
              </button>
            ) : (
              <h2 className="mw-nav-group-title">{group.title}</h2>
            )}
            <div
              className="mw-nav-group-links"
              id={group.collapsible ? "mw-savings-links" : undefined}
              hidden={!isCollapsed && group.collapsible && !savingsOpen}
            >
              {group.items.map(
                ({ label, href, icon: Icon, count, color, tooltip }) => {
                  const isActive =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href));
                  const itemTooltip = isCollapsed
                    ? (tooltip ? `${label} — ${tooltip}` : label)
                    : tooltip;

                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`mw-nav-item mw-nav-link${isActive ? " is-active" : ""}${color ? ` mw-account-${color}` : ""}`}
                      title={itemTooltip}
                      aria-label={label}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        close?.();
                        onNavigate?.(label, href);
                      }}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                      {count && (
                        <small className="mw-nav-count">
                          {label === "Membres" && membersCount !== undefined
                            ? membersCount.toLocaleString("fr-FR")
                            : count}
                        </small>
                      )}
                    </Link>
                  );
                },
              )}
            </div>
          </section>
        ))}
      </nav>
      <div className="mw-side-bottom">
        <div className="mw-profile">
          <div
            className="mw-avatar-wrap"
            title={isCollapsed ? `${userName} — ${userRole}` : undefined}
          >
            <span className="mw-avatar">{initials}</span>
            <span className="mw-status-dot" title="En ligne" />
          </div>
          <span className="mw-profile-copy">
            <strong>{userName}</strong>
            <span>{userRole}</span>
          </span>
          <button
            className="mw-icon-button"
            type="button"
            title={t.signOut}
            aria-label={t.signOut}
            onClick={() => {
              logout();
            }}
          >
            <IconLogout size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
