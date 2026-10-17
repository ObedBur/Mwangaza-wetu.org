'use client';

import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsExchange,
  IconBell,
  IconBuildingBank,
  IconChartBar,
  IconCreditCard,
  IconLayoutDashboard,
  IconMenu2,
  IconSearch,
  IconSettings,
  IconUsers,
  IconWallet,
} from "@/lib/tabler-icons";
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getAuthUser, logout } from "@/lib/auth";

const agentNavGroups = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Tableau de bord", href: "/agent", icon: IconLayoutDashboard },
    ],
  },
  {
    label: "MEMBRES",
    items: [{ label: "Membres", href: "/agent/membres", icon: IconUsers }],
  },
  {
    label: "COMPTES D’ÉPARGNE",
    items: [{ label: "Comptes", href: "/agent/comptes", icon: IconWallet }],
  },
  {
    label: "OPÉRATIONS",
    items: [
      {
        label: "Dépôts & cotisations",
        href: "/agent/depots",
        icon: IconArrowDown,
      },
      { label: "Retraits", href: "/agent/retraits", icon: IconArrowUp },
      { label: "Crédits", href: "/agent/credits", icon: IconCreditCard },
      {
        label: "Remboursements",
        href: "/agent/remboursements",
        icon: IconArrowsExchange,
      },
    ],
  },
  {
    label: "COMPTABILITÉ",
    items: [
      {
        label: "Caisse & comptabilité",
        href: "/agent/comptabilite",
        icon: IconBuildingBank,
      },
    ],
  },
  {
    label: "OUTILS",
    items: [
      { label: "Rapports", href: "/agent/rapports", icon: IconChartBar },
      { label: "Paramètres", href: "/agent/parametres", icon: IconSettings },
    ],
  },
];

const agentSections = agentNavGroups.flatMap((group) => group.items);

function AgentBrand({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/agent" className="agent-brand" onClick={onClick}>
      <span className="agent-brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="agent-brand-copy">
        Mwangaza <strong>Wetu</strong>
        <small>Espace agent</small>
      </span>
    </Link>
  );
}

function AgentSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const authUser = getAuthUser();
  const displayName = authUser?.fullName || "Agent";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "A";

  return (
    <aside className="agent-sidebar">
      <div className="agent-sidebar-brand">
        <AgentBrand onClick={onNavigate} />
      </div>
      <nav className="agent-sidebar-navigation" aria-label="Navigation agent">
        {agentNavGroups.map((group) => (
          <section className="agent-nav-group" key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`agent-nav-link${active ? " is-active" : ""}`}
                  onClick={onNavigate}
                >
                  <Icon size={16} stroke={1.8} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="agent-sidebar-user">
        <span className="agent-user-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="agent-user-copy">
          <strong>{displayName}</strong>
          <span>Agent</span>
        </span>
        <button
          type="button"
          onClick={() => logout()}
          className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-medium"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

export function AgentPortalShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
      <div className="agent-portal-shell">
        <div className="agent-desktop-sidebar">
          <AgentSidebar />
        </div>
        <div className="agent-workspace">
          <header className="agent-topbar">
            <div className="agent-mobile-nav">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    className="agent-icon-button"
                    type="button"
                    aria-label="Ouvrir la navigation agent"
                  >
                    <IconMenu2 size={19} aria-hidden="true" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="agent-mobile-sidebar-sheet"
                >
                  <SheetTitle className="sr-only">Navigation agent</SheetTitle>
                  <AgentSidebar onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
              <AgentBrand />
            </div>
            <label className="agent-global-search">
              <IconSearch size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Recherche disponible après connexion des données"
                placeholder="Recherche bientôt disponible"
                disabled
              />
            </label>
            <div className="agent-topbar-actions">
              <button
                className="agent-icon-button agent-notification-button"
                type="button"
                aria-label="Notifications bientôt disponibles"
                disabled
              >
                <IconBell size={17} aria-hidden="true" />
              </button>
              <span className="agent-locale">FR</span>
            </div>
          </header>
          <main className="agent-page-main">{children}</main>
        </div>
      </div>
  );
}

const summaryCards = [
  {
    title: "Total des membres",
    value: "—",
    note: "En attente des données backend",
    icon: IconUsers,
    tone: "blue",
  },
  {
    title: "Capital total d’épargne",
    value: "—",
    note: "En attente des données backend",
    icon: IconWallet,
    tone: "gold",
  },
  {
    title: "Crédits en cours",
    value: "—",
    note: "En attente des données backend",
    icon: IconCreditCard,
    tone: "orange",
  },
  {
    title: "Disponibilité caisse",
    value: "—",
    note: "En attente des données backend",
    icon: IconBuildingBank,
    tone: "green",
  },
] as const;

function DashboardMetric({
  title,
  value,
  note,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof IconUsers;
  tone: string;
}) {
  return (
    <article className="agent-metric-card">
      <div className="agent-metric-heading">
        <h2>{title}</h2>
        <span className={`agent-metric-icon is-${tone}`}>
          <Icon size={17} stroke={1.8} aria-hidden="true" />
        </span>
      </div>
      <p className="agent-metric-value">{value}</p>
      <span className="agent-metric-note">{note}</span>
    </article>
  );
}

function PendingDataPanel({ title }: { title: string }) {
  return (
    <section className="agent-panel agent-pending-panel">
      <div className="agent-panel-heading">
        <h2>{title}</h2>
      </div>
      <p role="status">Les données apparaîtront lorsque ce panneau sera relié au backend.</p>
    </section>
  );
}

export function AgentDashboard() {
  const displayName = getAuthUser()?.fullName || "Agent";
  const firstName = displayName.split(" ")[0] || "Agent";
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="agent-dashboard">
      <div className="agent-dashboard-heading">
        <div>
          <h1>Bonjour, {firstName}</h1>
          <p>{dateLabel}</p>
        </div>
        <Link href="/agent/membres" className="agent-primary-action">
          <span aria-hidden="true">+</span> Nouveau membre
        </Link>
      </div>
      <div className="agent-metrics-grid">
        {summaryCards.map((item) => (
          <DashboardMetric
            key={item.title}
            title={item.title}
            value={item.value}
            note={item.note}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>
      <div className="agent-dashboard-middle">
        <PendingDataPanel title="Cotisations & crédits" />
        <PendingDataPanel title="Répartition des membres" />
      </div>
      <div className="agent-dashboard-bottom">
        <PendingDataPanel title="Transactions récentes" />
        <PendingDataPanel title="Échéances à venir" />
      </div>
    </div>
  );
}

export function AgentSectionPage() {
  const params = useParams();
  const section = params?.section as string;
  const item = agentSections.find(
    (entry) => entry.href === `/agent/${section}`,
  );

  if (!item) {
    return (
      <div className="agent-section-page">
        <div className="agent-dashboard-heading">
          <h1>Section introuvable</h1>
        </div>
        <section className="agent-section-placeholder">
          <Link href="/agent" className="agent-panel-link">
            Retour au tableau de bord
          </Link>
        </section>
      </div>
    );
  }

  const Icon = item.icon;
  return (
    <div className="agent-section-page">
      <div className="agent-dashboard-heading">
        <div>
          <h1>{item.label}</h1>
        </div>
      </div>
      <section className="agent-section-placeholder">
        <span className="agent-placeholder-icon">
          <Icon size={22} aria-hidden="true" />
        </span>
        <h2>Section en préparation</h2>
        <p>Cette section sera disponible dans une prochaine étape.</p>
        <Link href="/agent" className="agent-panel-link">
          Retour au tableau de bord
        </Link>
      </section>
    </div>
  );
}
