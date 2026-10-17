'use client';

import React from "react";
import { IconArrowUpRight } from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";

import { accountConfigs, type AccountSlug } from "@/lib/account-config";
import { cooperativeCopy } from "@/lib/cooperative-copy";
import { formatCurrency } from "@/lib/format-currency";
import type { MemberStatus, OperationStatus } from "@/mocks/cooperative-data";

export function CooperativeBreadcrumb({
  section,
  current,
}: {
  section: string;
  current: string;
}) {
  return (
    <nav
      className="coop-breadcrumb"
      aria-label={cooperativeCopy.breadcrumbLabel}
    >
      <span>{cooperativeCopy.breadcrumbAdmin}</span>
      <span aria-hidden="true">/</span>
      <span>{section}</span>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function CooperativeStatCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  detail?: string;
  trend?: string;
  icon: TablerIcon;
  accent?: string;
}) {
  return (
    <article
      className="coop-stat-card"
      style={{ "--coop-accent": accent } as React.CSSProperties}
    >
      <div className="coop-stat-card-top">
        <span>{label}</span>
        <span className="coop-stat-icon">
          <Icon aria-hidden="true" />
        </span>
      </div>
      <strong>{value}</strong>
      <span className="coop-stat-detail">
        {trend && (
          <>
            <IconArrowUpRight aria-hidden="true" />
            {trend}
          </>
        )}
        {detail}
      </span>
    </article>
  );
}

const statusClass: Record<MemberStatus | OperationStatus, string> = {
  Actif: "valid",
  "En retard": "pending",
  Suspendu: "rejected",
  Validé: "valid",
  "En attente": "pending",
  Rejeté: "rejected",
};

export function CooperativeStatus({
  status,
}: {
  status: MemberStatus | OperationStatus;
}) {
  return (
    <span className={`coop-status coop-status--${statusClass[status]}`}>
      {status}
    </span>
  );
}

export function AccountPills({ accounts }: { accounts: AccountSlug[] }) {
  return (
    <span
      className="coop-account-pills"
      aria-label={accounts
        .map((slug) => accountConfigs[slug].shortLabel)
        .join(", ")}
    >
      {accounts.map((slug) => (
        <span
          className="coop-account-pill"
          key={slug}
          title={accountConfigs[slug].shortLabel}
          style={
            {
              "--coop-accent": accountConfigs[slug].color,
            } as React.CSSProperties
          }
        >
          <span aria-hidden="true" />
        </span>
      ))}
    </span>
  );
}

export function formatDate(date: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export { formatCurrency };
