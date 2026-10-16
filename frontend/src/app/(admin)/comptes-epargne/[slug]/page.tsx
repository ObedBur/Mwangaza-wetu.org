'use client';

import {
  IconArrowDown,
  IconPencil,
  IconArrowUp,
  IconCalendar,
  IconChartLine,
  IconClock,
  IconCoins,
  IconDownload,
  IconTargetArrow,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useState } from "react";


import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
import {
  CooperativeBreadcrumb,
  CooperativeStatCard,
  CooperativeStatus,
  formatCurrency,
  formatDate,
} from "@/components/cooperative/CooperativePrimitives";
import { useCooperativeDarkTheme } from "@/components/cooperative/CooperativeThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import {
  mockAccounts,
  mockAccountSummary,
  type AccountHolder,
} from "@/mocks/cooperative-data";



export default function SavingsAccountRoute({
  params,
}: {
  params: { slug: string };
}) {
  const dark = useCooperativeDarkTheme();
  const { slug } = params;
  const [period, setPeriod] = useState<"annual" | "monthly" | "weekly">(
    "annual",
  );
  const [action, setAction] = useState<"deposit" | "withdrawal" | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<import("@/mocks/cooperative-data").AccountRules | null>(null);
  const accountSlug = accountSlugs.find((item) => item === slug);

  if (!accountSlug) {
    return (
      <div className="coop-page-error" role="alert">
        {t.accountTitleFallback}
      </div>
    );
  }

  const config = accountConfigs[accountSlug];
  const data = mockAccounts[accountSlug];
  const summary = mockAccountSummary(accountSlug);
  const rules = rulesDraft ?? data.rules;
  const AccountIcon = config.icon;
  const chartValues = data.balanceHistory[period];
  const points = chartValues.map((value, index) => {
    const min = Math.min(...chartValues);
    const max = Math.max(...chartValues);
    const x = 42 + (index * 650) / (chartValues.length - 1);
    const y = 142 - ((value - min) / Math.max(1, max - min)) * 110;
    return `${x},${y}`;
  });

  return (
    <div
      className="coop-account-page"
      style={{ "--coop-accent": config.color } as React.CSSProperties}
    >
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb
            section={t.breadcrumbSavings}
            current={config.shortLabel}
          />
          <div className="coop-account-title-row">
            <span className="coop-account-title-icon">
              <AccountIcon aria-hidden="true" />
            </span>
            <div>
              <h1>{config.label}</h1>
              <p>{config.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="coop-page-actions">
          <button
            className="mw-secondary"
            type="button"
            onClick={() => setAction("withdrawal")}
          >
            <IconArrowUp aria-hidden="true" />
            {t.newWithdrawal}
          </button>
          <button
            className="mw-primary"
            type="button"
            onClick={() => setAction("deposit")}
          >
            <IconArrowDown aria-hidden="true" />
            {t.newDeposit}
          </button>
        </div>
      </div>

      <CooperativeDataState empty={data.holders.length === 0}>
        <section className="coop-stat-grid" aria-label={config.shortLabel}>
          <CooperativeStatCard
            label={t.accountBalance}
            value={formatCurrency(summary.totalBalance)}
            icon={IconWallet}
            accent={config.color}
          />
          <CooperativeStatCard
            label={t.accountHolders}
            value={summary.holderCount}
            icon={IconUsers}
            accent={config.color}
          />
          <CooperativeStatCard
            label={t.depositsMonth}
            value={formatCurrency(summary.depositsThisMonth)}
            icon={IconArrowDown}
            accent={config.color}
          />
          <CooperativeStatCard
            label={t.withdrawalsMonth}
            value={formatCurrency(summary.withdrawalsThisMonth)}
            icon={IconArrowUp}
            accent={config.color}
          />
        </section>
      </CooperativeDataState>

      <div className="coop-account-top-grid">
        <section
          className="mw-panel coop-chart-panel"
          aria-labelledby="coop-chart-title"
        >
          <div className="mw-panel-header">
            <h2 id="coop-chart-title">{t.balanceEvolution}</h2>
            <div
              className="coop-chart-tabs"
              role="group"
              aria-label={t.balanceEvolution}
            >
              {(
                [
                  ["annual", t.annual],
                  ["monthly", t.monthly],
                  ["weekly", t.weekly],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={period === value}
                  className={period === value ? "is-active" : ""}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <CooperativeDataState
            empty={chartValues.length === 0}
            skeletonRows={4}
          >
            <div className="coop-account-chart">
              <strong>{formatCurrency(summary.totalBalance)}</strong>
              <svg
                viewBox="0 0 700 180"
                role="img"
                aria-label={t.balanceEvolution}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id={`account-chart-${accountSlug}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--coop-accent)"
                      stopOpacity=".2"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--coop-accent)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                {[30, 70, 110, 150].map((y) => (
                  <line
                    key={y}
                    x1="40"
                    x2="690"
                    y1={y}
                    y2={y}
                    className="mw-chart-grid"
                  />
                ))}
                <polygon
                  points={`42,160 ${points.join(" ")} 692,160`}
                  fill={`url(#account-chart-${accountSlug})`}
                />
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke="var(--coop-accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {t.chartMonths.map((label, index) => (
                  <text
                    key={label}
                    x={42 + (index * 650) / 11}
                    y="176"
                    textAnchor="middle"
                    className="mw-chart-axis"
                  >
                    {label}
                  </text>
                ))}
              </svg>
            </div>
          </CooperativeDataState>
        </section>

        <section
          className="mw-panel coop-rules-panel"
          aria-labelledby="coop-rules-title"
        >
          <div className="mw-panel-header">
            <h2 id="coop-rules-title">{t.accountRules}</h2>
            <button
              className="coop-edit-rules"
              type="button"
              aria-label={t.editRules}
              title={t.editRules}
              onClick={() => setRulesOpen(true)}
            >
              <IconPencil aria-hidden="true" />
            </button>
          </div>
          <CooperativeDataState empty={!rules.objective}>
            <dl className="coop-rules-list">
              <div><dt>{t.objective}</dt><dd>{rules.objective}</dd></div>
              {rules.targetAmount !== null && (
                <div><dt>{t.targetAmount}</dt><dd>{formatCurrency(rules.targetAmount)}</dd></div>
              )}
              <div><dt>{t.minimumDeposit}</dt><dd>{formatCurrency(rules.minimumDeposit)}</dd></div>
              <div><dt>{t.withdrawalConditions}</dt><dd>{rules.withdrawalConditions}</dd></div>
              <div><dt>{t.blockingPeriod}</dt><dd>{rules.blockingPeriod}</dd></div>
            </dl>
          </CooperativeDataState>
        </section>
      </div>

      <div className="coop-account-bottom-grid">
        <section
          className="mw-panel coop-holder-panel"
          aria-labelledby="coop-holders-title"
        >
          <div className="mw-panel-header">
            <h2 id="coop-holders-title">{t.holderTable}</h2>
            <span className="coop-panel-count">{data.holders.length}</span>
          </div>
          <CooperativeDataState
            empty={data.holders.length === 0}
            emptyMessage={t.empty}
            skeletonRows={6}
          >
            <div className="coop-table-scroll">
              <table className="mw-table coop-holder-table">
                <thead>
                  <tr>
                    <th>{t.membersTitle}</th>
                    <th>{t.savings}</th>
                    <th>{t.lastDeposit}</th>
                    <th>{t.progress}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holders.map((holder) => (
                    <HolderRow
                      key={holder.member.id}
                      holder={holder}
                      accent={config.color}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CooperativeDataState>
        </section>

        <section
          className="mw-panel coop-operations-panel"
          aria-labelledby="coop-operations-title"
        >
          <div className="mw-panel-header">
            <h2 id="coop-operations-title">{t.operations}</h2>
            <IconCalendar aria-hidden="true" />
          </div>
          <CooperativeDataState
            empty={data.operations.length === 0}
            emptyMessage={t.noOperations}
            skeletonRows={5}
          >
            <div className="coop-operation-list">
              {data.operations.map((operation) => {
                const OperationIcon =
                  operation.type === "Dépôt"
                    ? IconArrowDown
                    : operation.type === "Retrait"
                      ? IconArrowUp
                      : IconCoins;
                return (
                  <div className="coop-operation-row" key={operation.id}>
                    <span className="coop-operation-icon">
                      <OperationIcon aria-hidden="true" />
                    </span>
                    <span className="coop-operation-main">
                      <strong>{operation.type}</strong>
                      <small>
                        {operation.memberName} · {formatDate(operation.date)}
                      </small>
                    </span>
                    <span className="coop-operation-amount">
                      <strong>{formatCurrency(operation.amount)}</strong>
                      <CooperativeStatus status={operation.status} />
                    </span>
                  </div>
                );
              })}
            </div>
          </CooperativeDataState>
        </section>
      </div>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t.editRules}</DialogTitle>
            <DialogDescription>{config.shortLabel}</DialogDescription>
          </DialogHeader>
          <form
            className="coop-rules-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              setRulesDraft({
                objective: String(formData.get("objective")),
                minimumDeposit: Number(formData.get("minimumDeposit")),
                withdrawalConditions: String(formData.get("withdrawalConditions")),
                blockingPeriod: String(formData.get("blockingPeriod")),
                targetAmount: formData.get("targetAmount")
                  ? Number(formData.get("targetAmount"))
                  : null,
              });
              setRulesOpen(false);
            }}
          >
            <label className="coop-rule-field">{t.objective}<input name="objective" defaultValue={rules.objective} required /></label>
            {rules.targetAmount !== null && <label className="coop-rule-field">{t.targetAmount}<input name="targetAmount" type="number" min="1" defaultValue={rules.targetAmount} required /></label>}
            <label className="coop-rule-field">{t.minimumDeposit}<input name="minimumDeposit" type="number" min="1" defaultValue={rules.minimumDeposit} required /></label>
            <label className="coop-rule-field">{t.withdrawalConditions}<textarea name="withdrawalConditions" defaultValue={rules.withdrawalConditions} required /></label>
            <label className="coop-rule-field">{t.blockingPeriod}<textarea name="blockingPeriod" defaultValue={rules.blockingPeriod} required /></label>
            <div className="mw-dialog-actions">
              <button type="button" className="mw-dialog-cancel" onClick={() => setRulesOpen(false)}>{t.cancel}</button>
              <button type="submit" className="mw-primary">{t.save}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
      >
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {action === "deposit" ? t.depositAction : t.withdrawalAction}
            </DialogTitle>
            <DialogDescription>{t.actionPreview}</DialogDescription>
          </DialogHeader>
          <button
            className="mw-primary"
            type="button"
            onClick={() => setAction(null)}
          >
            {t.close}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HolderRow({
  holder,
  accent,
}: {
  holder: AccountHolder;
  accent: string;
}) {
  const goal = holder.goalAmount;
  const progress = goal
    ? Math.min(100, Math.round((holder.balance / goal) * 100))
    : null;
  return (
    <tr>
      <td>
        <a
          className="coop-holder-link"
          href={`/membres?membre=${holder.member.id}`}
        >
          <span className="mw-member-avatar">
            {holder.member.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <strong>{holder.member.name}</strong>
        </a>
      </td>
      <td className="coop-amount-cell">{formatCurrency(holder.balance)}</td>
      <td>{formatDate(holder.lastDeposit)}</td>
      <td>
        {progress === null ? (
          <span className="coop-no-goal">—</span>
        ) : (
          <span className="coop-progress-cell">
            <span className="coop-progress-track">
              <span
                style={
                  {
                    width: `${progress}%`,
                    "--coop-accent": accent,
                  } as React.CSSProperties
                }
              />
            </span>
            <small>{progress}%</small>
          </span>
        )}
      </td>
      <td>
        <CooperativeStatus status={holder.status} />
      </td>
    </tr>
  );
}
