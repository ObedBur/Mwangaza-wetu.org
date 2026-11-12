'use client';

import {
  IconAlertCircle,
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconDots,
} from "@/lib/tabler-icons";
import type { ReactNode } from "react";

import { formatCurrency } from "@/lib/format-currency";
import { memberAccounts } from "@/lib/member-portal-config";
import type { MemberAccountId, PortalIcon } from "@/lib/member-portal-config";

import type { TransactionStatus } from "@/mocks/member-dashboard";

export function Panel({
  title,
  children,
  className = "",
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`portal-panel ${className}`}>
      <div className="portal-panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export type PortalDataState = "ready" | "loading" | "empty" | "error";

export function DataRegion({
  children,
  state = "ready",
  skeleton = "h-48",
  emptyLabel = "Aucune donnée à afficher.",
  onRetry,
}: {
  children: ReactNode;
  state?: PortalDataState;
  skeleton?: string;
  emptyLabel?: string;
  onRetry?: () => void;
}) {
  if (state === "loading") {
    return (
      <div
        className={`animate-pulse rounded-xl bg-muted ${skeleton}`}
        aria-label="Chargement"
      />
    );
  }

  if (state === "empty") {
    return <p className="portal-empty-state">{emptyLabel}</p>;
  }

  if (state === "error") {
    return (
      <div className="portal-error-state" role="alert">
        <IconAlertCircle size={18} aria-hidden="true" />
        <span>Les données n’ont pas pu être chargées.</span>
        {onRetry ? <button onClick={onRetry}>Réessayer</button> : null}
      </div>
    );
  }

  return children;
}

export function AccountIdentity({
  accountId,
  compact = false,
}: {
  accountId: MemberAccountId;
  compact?: boolean;
}) {
  const account = memberAccounts.find((item) => item.id === accountId)!;
  const AccountIcon = account.icon as PortalIcon;
  return (
    <span className="account-identity">
      <span className={`account-icon ${account.colorClass}`} aria-hidden="true">
        <AccountIcon size={compact ? 15 : 17} stroke={1.7} />
      </span>
      <span className="account-identity-copy">
        <span className="font-medium text-foreground">
          {compact ? account.shortName : account.name}
        </span>
        {!compact ? (
          <span className="text-muted-foreground">{account.subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}

const statusPresentation: Record<
  TransactionStatus,
  { icon: PortalIcon; className: string }
> = {
  Validé: { icon: IconCircleCheck, className: "status-success" },
  "En attente": { icon: IconClock, className: "status-warning" },
  Rejeté: { icon: IconCircleX, className: "status-error" },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { icon: StatusIcon, className } = statusPresentation[status];
  return (
    <span className={`status-badge ${className}`}>
      <StatusIcon size={15} stroke={1.8} aria-hidden="true" />
      {status}
    </span>
  );
}

export function AccountAmount({
  amount,
  sign,
  currency = "USD",
}: {
  amount: number;
  sign?: "+" | "−";
  currency?: string;
}) {
  return (
    <span className="font-semibold tabular-nums">
      {sign ? `${sign} ` : ""}
      {formatCurrency(amount, currency)}
    </span>
  );
}

export function Avatar({
  name,
  initials,
  small = false,
}: {
  name: string;
  initials: string;
  small?: boolean;
}) {
  return (
    <span
      className={`member-avatar${small ? " member-avatar-small" : ""}`}
      aria-label={name}
    >
      {initials}
    </span>
  );
}

export function ExportMenu({
  onCsv,
  onPrint,
}: {
  onCsv: () => void;
  onPrint: () => void;
}) {
  return (
    <details className="export-menu">
      <summary aria-label="Exporter les transactions">
        <IconDownload size={16} aria-hidden="true" />
        <span>Exporter</span>
        <IconDots size={15} aria-hidden="true" />
      </summary>
      <div className="export-menu-items">
        <button onClick={onCsv}>Télécharger en CSV</button>
        <button onClick={onPrint}>Imprimer en PDF</button>
      </div>
    </details>
  );
}
