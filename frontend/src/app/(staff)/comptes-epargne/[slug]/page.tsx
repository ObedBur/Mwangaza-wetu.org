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
import { use, useEffect, useMemo, useState } from "react";


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
import { apiClient } from "@/lib/auth";
import {
  mockAccounts,
  mockAccountSummary,
  type AccountHolder,
} from "@/mocks/cooperative-data";

type PrincipalDashboard = {
  overview: {
    balanceUSD: number;
    balanceFC: number;
    holderCount: number;
    depositsThisMonth: { USD: number; FC: number };
    withdrawalsThisMonth: { USD: number; FC: number };
  };
  holders: { memberId: number; accountNumber: string; name: string; phone: string; joinedAt: string; status: string; lastDeposit: string | null; balanceUSD: number; balanceFC: number }[];
  members: { id: number; accountNumber: string; name: string }[];
  operations: { id: string; type: "depot" | "retrait"; memberId: number; accountNumber: string; memberName: string; amount: number; currency: "USD" | "FC"; date: string; status: string; description: string | null }[];
  history: { monthly: { label: string; USD: number; FC: number }[]; daily: { label: string; USD: number; FC: number }[] };
};
type DatBaremeResponse = {
  durees: { dureeMois: number; tauxPeriode: number; minFc: number; minUsd: number; messageSeuil?: string }[];
};

function formatDualCurrency(usd: number, fc: number) {
  return `${formatCurrency(usd, "USD")} · ${formatCurrency(fc, "CDF")}`;
}

function principalToAccountMock(
  principal: PrincipalDashboard | null,
  fallback: (typeof mockAccounts)["principal"],
  chartCurrency: "USD" | "FC",
): (typeof mockAccounts)["principal"] {
  if (!principal) return { ...fallback, holders: [], operations: [], balanceHistory: { annual: [], monthly: [], weekly: [] } };
  return {
    ...fallback,
    holders: principal.holders.map((item) => {
      const balances = Object.fromEntries(accountSlugs.map((slug) => [slug, slug === "principal" ? item.balanceUSD + item.balanceFC : 0])) as AccountHolder["member"]["balances"];
      return {
        member: {
          id: String(item.memberId), memberNumber: item.accountNumber, name: item.name, phone: item.phone,
          joinedAt: item.joinedAt, status: item.status === "actif" ? "Actif" : "Suspendu", balances,
          savingsTotal: item.balanceUSD + item.balanceFC,
        },
        balance: item.balanceUSD,
        balanceUSD: item.balanceUSD,
        balanceFC: item.balanceFC,
        lastDeposit: item.lastDeposit || item.joinedAt,
        goalAmount: null,
        status: item.status === "actif" ? "Actif" : "Suspendu",
      };
    }),
    operations: principal.operations.map((item) => ({
      id: item.id, memberId: String(item.memberId), memberName: item.memberName,
      type: item.type === "depot" ? "Dépôt" : "Retrait", amount: item.amount, currency: item.currency,
      date: item.date, status: ["completed", "valid", "valide"].includes(item.status.toLowerCase()) ? "Validé" : item.status.toLowerCase().includes("reject") ? "Rejeté" : "En attente",
    })),
    balanceHistory: {
      annual: principal.history.monthly.map((item) => item[chartCurrency]),
      monthly: principal.history.daily.map((item) => item[chartCurrency]),
      weekly: principal.history.daily.slice(-7).map((item) => item[chartCurrency]),
    },
  };
}


export default function SavingsAccountRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const dark = useCooperativeDarkTheme();
  const { slug } = use(params);
  const [period, setPeriod] = useState<"annual" | "monthly" | "weekly">(
    "annual",
  );
  const [action, setAction] = useState<"deposit" | "withdrawal" | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<import("@/mocks/cooperative-data").AccountRules | null>(null);
  const [principal, setPrincipal] = useState<PrincipalDashboard | null>(null);
  const [principalError, setPrincipalError] = useState("");
  const [principalLoading, setPrincipalLoading] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<"USD" | "FC">("USD");
  const [operationDraft, setOperationDraft] = useState({ accountNumber: "", amount: "", currency: "USD" as "USD" | "FC", description: "" });
  const [operationSaving, setOperationSaving] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [datTarget, setDatTarget] = useState<AccountHolder | null>(null);
  const [datBareme, setDatBareme] = useState<DatBaremeResponse | null>(null);
  const [datDuration, setDatDuration] = useState(1);
  const [datCurrency, setDatCurrency] = useState<"USD" | "FC">("USD");
  const [datAmount, setDatAmount] = useState("");
  const [datLoading, setDatLoading] = useState(false);
  const [datError, setDatError] = useState("");
  const accountSlug = accountSlugs.find((item) => item === slug);

  async function loadPrincipal() {
    setPrincipalLoading(true);
    try {
      const response = await apiClient.get<PrincipalDashboard>("/epargnes/compte-principal/dashboard");
      setPrincipal(response.data);
      setPrincipalError("");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setPrincipalError(Array.isArray(message) ? message.join(" ") : message || "Impossible de charger le compte principal depuis le backend.");
    } finally {
      setPrincipalLoading(false);
    }
  }

  useEffect(() => {
    if (slug === "principal") void loadPrincipal();
  }, [slug]);

  if (!accountSlug) {
    return (
      <div className="coop-page-error" role="alert">
        {t.accountTitleFallback}
      </div>
    );
  }

  const config = accountConfigs[accountSlug];
  const isPrincipal = accountSlug === "principal";
  const mockData = mockAccounts[accountSlug];
  const data = isPrincipal ? principalToAccountMock(principal, mockData, chartCurrency) : mockData;
  const summary = isPrincipal
    ? { totalBalance: (principal?.overview.balanceUSD || 0) + (principal?.overview.balanceFC || 0), holderCount: principal?.overview.holderCount || 0, depositsThisMonth: 0, withdrawalsThisMonth: 0 }
    : mockAccountSummary(accountSlug);
  const rules = rulesDraft ?? data.rules;
  const AccountIcon = config.icon;
  const chartValues = data.balanceHistory[period];
  const chartLabels = isPrincipal && principal
    ? period === "annual"
      ? principal.history.monthly.map((item) => item.label)
      : (period === "weekly" ? principal.history.daily.slice(-7) : principal.history.daily).map((item) => item.label)
    : t.chartMonths;
  const points = chartValues.map((value, index) => {
    const min = Math.min(...chartValues);
    const max = Math.max(...chartValues);
    const x = 42 + (index * 650) / (chartValues.length - 1);
    const y = 142 - ((value - min) / Math.max(1, max - min)) * 110;
    return `${x},${y}`;
  });

  async function submitOperation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !operationDraft.accountNumber || Number(operationDraft.amount) <= 0) return;
    setOperationSaving(true);
    setOperationError("");
    const payload = {
      compte: operationDraft.accountNumber,
      devise: operationDraft.currency,
      montant: Number(operationDraft.amount),
      dateOperation: new Date().toISOString(),
      description: operationDraft.description.trim() || (action === "deposit" ? "Dépôt sur compte principal" : "Retrait du compte principal"),
    };
    try {
      if (action === "deposit") await apiClient.post("/epargnes", { ...payload, typeOperation: "depot", idempotencyKey: window.crypto.randomUUID() });
      else await apiClient.post("/withdrawals", payload);
      setAction(null);
      setOperationDraft({ accountNumber: "", amount: "", currency: "USD", description: "" });
      await loadPrincipal();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setOperationError(Array.isArray(message) ? message.join(" ") : message || "Opération impossible. Vérifiez le compte, le montant et le solde disponible.");
    } finally {
      setOperationSaving(false);
    }
  }

  async function prepareDat(holder: AccountHolder) {
    setDatTarget(holder);
    setDatError("");
    setDatLoading(true);
    try {
      const response = await apiClient.get<DatBaremeResponse>("/dat/bareme");
      setDatBareme(response.data);
      const defaultCurrency = (holder.balanceUSD || 0) > 0 ? "USD" : "FC";
      setDatCurrency(defaultCurrency);
      setDatDuration(1);
      const first = response.data.durees.find((item) => item.dureeMois === 1);
      setDatAmount(String(defaultCurrency === "USD" ? first?.minUsd || 1 : first?.minFc || 2000));
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setDatError(Array.isArray(message) ? message.join(" ") : message || "Impossible de charger le barème DAT.");
    } finally {
      setDatLoading(false);
    }
  }

  async function openDat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datTarget || !datBareme) return;
    setDatLoading(true);
    setDatError("");
    try {
      await apiClient.post("/dat", {
        numeroCompte: datTarget.member.memberNumber,
        dureeMois: datDuration,
        devise: datCurrency,
        montant: Number(datAmount),
      });
      setDatTarget(null);
      await loadPrincipal();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setDatError(Array.isArray(message) ? message.join(" ") : message || "Ouverture du DAT impossible. Vérifiez le montant disponible et les placements en cours.");
    } finally {
      setDatLoading(false);
    }
  }

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
            onClick={() => { setOperationError(""); setOperationDraft({ accountNumber: principal?.members[0]?.accountNumber || "", amount: "", currency: "USD", description: "" }); setAction("withdrawal"); }}
          >
            <IconArrowUp aria-hidden="true" />
            {t.newWithdrawal}
          </button>
          <button
            className="mw-primary"
            type="button"
            onClick={() => { setOperationError(""); setOperationDraft({ accountNumber: principal?.members[0]?.accountNumber || "", amount: "", currency: "USD", description: "" }); setAction("deposit"); }}
          >
            <IconArrowDown aria-hidden="true" />
            {t.newDeposit}
          </button>
        </div>
      </div>

      {isPrincipal && principalError && <p className="coop-page-error" role="alert">{principalError}</p>}

      <CooperativeDataState empty={data.holders.length === 0}>
        <section className="coop-stat-grid" aria-label={config.shortLabel}>
          <CooperativeStatCard
            label={t.accountBalance}
            value={isPrincipal ? formatDualCurrency(principal?.overview.balanceUSD || 0, principal?.overview.balanceFC || 0) : formatCurrency(summary.totalBalance)}
            icon={IconWallet}
            accent={config.color}
          />
          <CooperativeStatCard
            label={t.accountHolders}
            value={isPrincipal && principalLoading ? "…" : summary.holderCount}
            icon={IconUsers}
            accent={config.color}
          />
          <CooperativeStatCard
            label={t.depositsMonth}
            value={isPrincipal ? formatDualCurrency(principal?.overview.depositsThisMonth.USD || 0, principal?.overview.depositsThisMonth.FC || 0) : formatCurrency(summary.depositsThisMonth)}
            icon={IconArrowDown}
            accent={config.color}
          />
          <CooperativeStatCard
            label={t.withdrawalsMonth}
            value={isPrincipal ? formatDualCurrency(principal?.overview.withdrawalsThisMonth.USD || 0, principal?.overview.withdrawalsThisMonth.FC || 0) : formatCurrency(summary.withdrawalsThisMonth)}
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
              {isPrincipal && <div className="coop-chart-currency-tabs" role="group" aria-label="Devise du graphique"><button type="button" aria-pressed={chartCurrency === "USD"} onClick={() => setChartCurrency("USD")}>USD</button><button type="button" aria-pressed={chartCurrency === "FC"} onClick={() => setChartCurrency("FC")}>FC</button></div>}
            </div>
          </div>
          <CooperativeDataState
            loading={isPrincipal && principalLoading}
            empty={isPrincipal ? !principal : chartValues.length === 0}
            skeletonRows={4}
          >
            <div className="coop-account-chart">
              <strong>{isPrincipal ? formatCurrency(chartCurrency === "USD" ? principal?.overview.balanceUSD || 0 : principal?.overview.balanceFC || 0, chartCurrency === "USD" ? "USD" : "CDF") : formatCurrency(summary.totalBalance)}</strong>
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
                {chartLabels.map((label, index) => (
                  <text
                    key={label}
                    x={42 + (index * 650) / Math.max(1, chartLabels.length - 1)}
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
            <span className="coop-panel-count">{isPrincipal ? principal?.overview.holderCount || 0 : data.holders.length}</span>
          </div>
          <CooperativeDataState
            loading={isPrincipal && principalLoading}
            empty={isPrincipal ? !principal || data.holders.length === 0 : data.holders.length === 0}
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
                    {isPrincipal && <th>Dépôt à terme</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.holders.map((holder) => (
                    <HolderRow
                      key={holder.member.id}
                      holder={holder}
                      accent={config.color}
                      onOpenDat={isPrincipal ? () => void prepareDat(holder) : undefined}
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
            loading={isPrincipal && principalLoading}
            empty={isPrincipal ? !principal || data.operations.length === 0 : data.operations.length === 0}
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
                        <strong>{formatCurrency(operation.amount, operation.currency === "FC" ? "CDF" : "USD")}</strong>
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
            <DialogDescription>{isPrincipal ? "Enregistrez l’opération sur le compte principal. Le solde sera recalculé à partir du journal." : t.actionPreview}</DialogDescription>
          </DialogHeader>
          {isPrincipal ? <form className="coop-rules-form" onSubmit={submitOperation}>
            <label className="coop-rule-field">Membre<select required value={operationDraft.accountNumber} onChange={(event) => setOperationDraft({ ...operationDraft, accountNumber: event.target.value })}><option value="">Choisir un membre</option>{(principal?.members || []).map((member) => <option key={member.id} value={member.accountNumber}>{member.name} · {member.accountNumber}</option>)}</select></label>
            <label className="coop-rule-field">Montant<input required type="number" min="0.01" step="0.01" value={operationDraft.amount} onChange={(event) => setOperationDraft({ ...operationDraft, amount: event.target.value })} /></label>
            <label className="coop-rule-field">Devise<select value={operationDraft.currency} onChange={(event) => setOperationDraft({ ...operationDraft, currency: event.target.value as "USD" | "FC" })}><option value="USD">USD</option><option value="FC">FC</option></select></label>
            <label className="coop-rule-field">Description<input maxLength={250} value={operationDraft.description} onChange={(event) => setOperationDraft({ ...operationDraft, description: event.target.value })} placeholder="Facultatif" /></label>
            {operationError && <p className="coop-page-error" role="alert">{operationError}</p>}
            <div className="mw-dialog-actions"><button type="button" className="mw-dialog-cancel" onClick={() => setAction(null)} disabled={operationSaving}>{t.cancel}</button><button className="mw-primary" type="submit" disabled={operationSaving || !operationDraft.accountNumber}>{operationSaving ? "Enregistrement…" : "Confirmer l’opération"}</button></div>
          </form> : <button className="mw-primary" type="button" onClick={() => setAction(null)}>{t.close}</button>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(datTarget)} onOpenChange={(open) => { if (!open) setDatTarget(null); }}>
        <DialogContent data-theme={dark ? "dark" : "light"} className="mw-dialog-content coop-action-dialog">
          <DialogHeader>
            <DialogTitle>Ouvrir un dépôt à terme</DialogTitle>
            <DialogDescription>{datTarget?.member.name} · {datTarget?.member.memberNumber}. Le capital sera transféré du compte principal vers le DAT et bloqué jusqu’à l’échéance.</DialogDescription>
          </DialogHeader>
          {datLoading && !datBareme ? <p role="status">Chargement du barème…</p> : datBareme && <form className="coop-rules-form" onSubmit={openDat}>
            <label className="coop-rule-field">Durée<select value={datDuration} onChange={(event) => { const duration = Number(event.target.value); setDatDuration(duration); const option = datBareme.durees.find((item) => item.dureeMois === duration); setDatAmount(String(datCurrency === "USD" ? option?.minUsd || 1 : option?.minFc || 2000)); }}>
              {datBareme.durees.map((item) => <option key={item.dureeMois} value={item.dureeMois}>{item.dureeMois} mois · taux {item.tauxPeriode}%</option>)}
            </select></label>
            <label className="coop-rule-field">Devise<select value={datCurrency} onChange={(event) => { const currency = event.target.value as "USD" | "FC"; setDatCurrency(currency); const option = datBareme.durees.find((item) => item.dureeMois === datDuration); setDatAmount(String(currency === "USD" ? option?.minUsd || 1 : option?.minFc || 2000)); }}><option value="USD">USD</option><option value="FC">FC</option></select></label>
            <label className="coop-rule-field">Capital à placer<input required type="number" min={datCurrency === "USD" ? datBareme.durees.find((item) => item.dureeMois === datDuration)?.minUsd : datBareme.durees.find((item) => item.dureeMois === datDuration)?.minFc} step="0.01" value={datAmount} onChange={(event) => setDatAmount(event.target.value)} /></label>
            <p className="coop-agent-auto-password-note">Disponible sur le compte principal : {formatCurrency(datCurrency === "USD" ? datTarget?.balanceUSD || 0 : datTarget?.balanceFC || 0, datCurrency === "USD" ? "USD" : "CDF")}. Le backend vérifiera le minimum, le solde et l’absence d’un DAT déjà actif.</p>
            {datBareme.durees.find((item) => item.dureeMois === datDuration)?.messageSeuil && <p>{datBareme.durees.find((item) => item.dureeMois === datDuration)?.messageSeuil}</p>}
            {datError && <p className="coop-page-error" role="alert">{datError}</p>}
            <div className="mw-dialog-actions"><button type="button" className="mw-dialog-cancel" onClick={() => setDatTarget(null)} disabled={datLoading}>Annuler</button><button type="submit" className="mw-primary" disabled={datLoading}>{datLoading ? "Ouverture…" : "Ouvrir le DAT"}</button></div>
          </form>}
          {datError && !datBareme && <p className="coop-page-error" role="alert">{datError}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HolderRow({
  holder,
  accent,
  onOpenDat,
}: {
  holder: AccountHolder;
  accent: string;
  onOpenDat?: () => void;
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
      <td className="coop-amount-cell">{holder.balanceUSD !== undefined ? <span className="coop-dual-amount"><strong>{formatCurrency(holder.balanceUSD, "USD")}</strong><small>{formatCurrency(holder.balanceFC || 0, "CDF")}</small></span> : formatCurrency(holder.balance)}</td>
      <td>{holder.lastDeposit ? formatDate(holder.lastDeposit) : "—"}</td>
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
      {onOpenDat && <td><button type="button" className="mw-secondary coop-open-dat-button" onClick={onOpenDat}><IconClock size={15} /> Ouvrir un DAT</button></td>}
    </tr>
  );
}
