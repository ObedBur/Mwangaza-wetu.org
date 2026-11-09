'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useMemberPortalData, type MemberPortalDashboard, type MemberPortalTransaction } from '@/components/member-portal/member-data';
import { DataRegion, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { formatCurrency, formatSignedCurrency } from '@/lib/format-currency';
import {
  IconArrowDown,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCalendar,
  IconChevronRight,
  IconCoins,
  IconCreditCard,
  IconDatabaseOff,
  IconFileText,
  IconReceipt,
  IconTrendingUp,
  IconWallet,
} from '@/lib/tabler-icons';
import type { PortalDataState } from '@/components/member-portal/portal-ui';

function transactionKind(type: string) {
  if (type === 'remboursement') return 'Remboursement';
  if (type === 'retrait') return 'Retrait';
  return 'Dépôt';
}

function transactionStatus(status: string): 'Validé' | 'En attente' | 'Rejeté' {
  if (status === 'CANCELLED' || status === 'FAILED') return 'Rejeté';
  if (status === 'PENDING') return 'En attente';
  return 'Validé';
}

function stateLabel(state: PortalDataState) {
  return state === 'loading' ? 'Chargement des données…' : 'Données indisponibles';
}

/** Bento KPI Card — Design harmonisé avec le Dashboard Admin */
function BentoKPICard({
  title,
  amount,
  currency,
  caption,
  badge,
  badgeVariant = 'neutral',
  icon: Icon,
  iconColor = 'blue',
}: {
  title: string;
  amount: number;
  currency: string;
  caption?: string;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'neutral';
  icon: typeof IconWallet;
  iconColor?: 'blue' | 'gold' | 'green' | 'orange';
}) {
  return (
    <article className="kpi-card-bento">
      <div className="kpi-card-top">
        <span className="kpi-card-title">{title}</span>
        <span className={`kpi-card-icon-wrap ${iconColor}`}>
          <Icon size={18} stroke={1.7} aria-hidden="true" />
        </span>
      </div>
      <div className="kpi-card-main-val tabular-nums">
        {formatCurrency(amount, currency)}
      </div>
      <div className="kpi-card-sub-info">
        {caption ? <span>{caption}</span> : null}
        {badge ? (
          <span
            className={`kpi-card-badge is-${badgeVariant}`}
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '10.5px',
              fontWeight: 600,
              background: badgeVariant === 'success' ? '#dcfce7' : badgeVariant === 'warning' ? '#fef3c7' : '#f1f5f9',
              color: badgeVariant === 'success' ? '#15803d' : badgeVariant === 'warning' ? '#b45309' : '#475569',
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Flux du mois Bento Card avec sélecteur de devise */
function BentoMonthlyFlowCard({
  deposits,
  withdrawals,
  currency,
  onCurrencyChange,
}: {
  deposits: number;
  withdrawals: number;
  currency: 'USD' | 'FC';
  onCurrencyChange: (c: 'USD' | 'FC') => void;
}) {
  const net = deposits - withdrawals;
  const isPositive = net >= 0;
  return (
    <article className="kpi-card-bento">
      <div className="kpi-card-top">
        <span className="kpi-card-title">Flux du mois</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className="kpi-currency-toggle" role="group" aria-label="Devise du flux">
            <button
              type="button"
              className={currency === 'USD' ? 'is-selected' : ''}
              onClick={() => onCurrencyChange('USD')}
            >
              USD
            </button>
            <button
              type="button"
              className={currency === 'FC' ? 'is-selected' : ''}
              onClick={() => onCurrencyChange('FC')}
            >
              FC
            </button>
          </div>
          <span className="kpi-card-icon-wrap green">
            <IconTrendingUp size={18} stroke={1.7} aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="kpi-card-main-val tabular-nums" style={{ color: isPositive ? '#16A34A' : '#DC2626' }}>
        {formatSignedCurrency(net, isPositive ? '+' : '−', currency)}
      </div>
      <div className="kpi-card-sub-info">
        <span>+{formatCurrency(deposits, currency)} dépôts · {formatCurrency(withdrawals, currency)} retraits</span>
      </div>
    </article>
  );
}
function DashboardEmptyState({ kind }: { kind: 'chart' | 'activity' }) {
  const isChart = kind === 'chart';
  return (
    <div className="dashboard-empty-state">
      <span className="dashboard-empty-icon" aria-hidden="true">
        {isChart ? <IconTrendingUp size={22} /> : <IconReceipt size={22} />}
      </span>
      <div className="dashboard-empty-content">
        <strong>{isChart ? 'Aucun mouvement sur les six derniers mois' : 'Aucune opération récente'}</strong>
        <p>{isChart ? 'Vos dépôts et retraits apparaîtront ici dès vos premières opérations.' : 'Vos opérations enregistrées s’afficheront dans cet historique.'}</p>
      </div>
      <Link href="/transactions" className="dashboard-empty-action">
        Voir l’historique →
      </Link>
    </div>
  );
}

function monthKey(date: string) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function ActivityChart({ activity, currency, onCurrencyChange }: { activity: MemberPortalDashboard['monthlyActivity']; currency: 'USD' | 'FC'; onCurrencyChange: (currency: 'USD' | 'FC') => void }) {
  const months = activity.map((item) => ({ key: item.monthKey, month: item.month, deposits: item[currency as 'USD' | 'FC'].deposits, withdrawals: item[currency as 'USD' | 'FC'].withdrawals }));
  const activityRows = months;
  const maximum = Math.max(1, ...activityRows.flatMap((item) => [item.deposits, item.withdrawals]));
  const hasActivity = activityRows.some((item) => item.deposits || item.withdrawals);
  const totalDeposits = activityRows.reduce((sum, item) => sum + item.deposits, 0);
  const chartX = (index: number) =>
    48 + (activityRows.length < 2 ? 319 : (index * 638) / (activityRows.length - 1));
  const chartY = (value: number) => 158 - (value / maximum) * 132;
  const depositPoints = activityRows
    .map((item, index) => `${chartX(index)},${chartY(item.deposits)}`)
    .join(" ");
  const withdrawalPoints = activityRows
    .map((item, index) => `${chartX(index)},${chartY(item.withdrawals)}`)
    .join(" ");

  return (
    <Panel
      title="Dépôts & retraits"
      className="chart-panel"
      action={
        <div className="chart-panel-actions">
          <div className="chart-currency-toggle" role="group" aria-label="Devise du graphique">
            <button type="button" aria-pressed={currency === 'USD'} className={currency === 'USD' ? 'is-selected' : ''} onClick={() => onCurrencyChange('USD')}>USD</button>
            <button type="button" aria-pressed={currency === 'FC'} className={currency === 'FC' ? 'is-selected' : ''} onClick={() => onCurrencyChange('FC')}>FC</button>
          </div>
          <span className="chart-period-label">6 derniers mois</span>
        </div>
      }
    >
      {!hasActivity ? <DashboardEmptyState kind="chart" /> : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <strong style={{ fontSize: '22px', fontWeight: 700, color: 'var(--mw-ink, #0f172a)', letterSpacing: '-0.03em' }}>
              {formatCurrency(totalDeposits, currency)}
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--mw-muted, #64748B)' }}>
              Total versé sur la période
            </span>
          </div>
          <div className="member-chart-legend" aria-label="Légende du graphique">
            <span><i className="legend-deposit" />Dépôts</span>
            <span><i className="legend-withdrawal" />Retraits</span>
          </div>
          <div className="member-chart-plot">
            <svg
              className="member-chart-svg"
              viewBox="0 0 700 190"
              role="img"
              aria-label={`Dépôts et retraits des six derniers mois en ${currency}`}
              preserveAspectRatio="none"
            >
              {[26, 67, 108, 149].map((y, index) => (
                <g key={y}>
                  <line x1="46" x2="687" y1={y} y2={y} className="member-chart-grid" />
                  <text x="1" y={y + 3} className="member-chart-axis">
                    {Math.round((maximum * (4 - index)) / 4).toLocaleString("fr-FR")}
                  </text>
                </g>
              ))}
              <polyline className="member-chart-line-deposits" points={depositPoints} />
              <polyline className="member-chart-line-withdrawals" points={withdrawalPoints} />
              {activityRows.map((item, index) => (
                <text
                  key={item.key}
                  x={chartX(index)}
                  y="184"
                  textAnchor="middle"
                  className={`member-chart-axis${index % 2 === 1 ? " is-hidden-on-mobile" : ""}`}
                >
                  {item.month}
                </text>
              ))}
            </svg>
          </div>
        </>
      )}
    </Panel>
  );
}

function ActivityList({ transactions, state, error, reload }: { transactions: MemberPortalTransaction[]; state: PortalDataState; error: string; reload: () => void }) {
  const [filter, setFilter] = useState<string>('ALL');
  const filtered = useMemo(() => {
    if (filter === 'ALL') return transactions;
    if (filter === 'depot') return transactions.filter((t) => t.type === 'depot');
    if (filter === 'retrait') return transactions.filter((t) => t.type === 'retrait');
    if (filter === 'remboursement') return transactions.filter((t) => t.type === 'remboursement');
    return transactions;
  }, [transactions, filter]);
  const recent = filtered.slice(0, 8);

  return (
    <Panel
      title="Activité récente"
      className="activity-panel"
      action={<Link href="/transactions" className="panel-text-link">Historique complet →</Link>}
    >
      {/* Filtres de transactions — style pills comme le dashboard Admin */}
      <div className="activity-filter-pills" role="group" aria-label="Filtrer les opérations">
        {[
          ['ALL', 'Toutes'],
          ['depot', 'Dépôts'],
          ['retrait', 'Retraits'],
          ['remboursement', 'Remboursements'],
        ].map(([val, label]) => (
          <button
            key={val}
            type="button"
            className={`activity-filter-pill ${filter === val ? 'is-active' : ''}`}
            onClick={() => setFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {state === 'error' ? (
        <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div>
      ) : state === 'loading' ? (
        <p className="portal-empty-state">{stateLabel(state)}</p>
      ) : recent.length === 0 ? (
        <DashboardEmptyState kind="activity" />
      ) : (
        <>
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Compte</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => {
                  const positive = row.type === 'depot';
                  const account = row.compteType === 'DAT' ? 'Dépôt à terme' : row.compteType === 'CREDIT' ? 'Crédit' : 'Compte principal';
                  return (
                    <tr key={row.id}>
                      <td>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(row.date))}</td>
                      <td className="transaction-description">
                        <span>{row.description || transactionKind(row.type)}</span>
                        <small>{transactionKind(row.type)}</small>
                      </td>
                      <td className="table-account"><span>{account}</span></td>
                      <td className={positive ? 'amount-positive' : 'amount-negative'}>
                        {formatSignedCurrency(row.montant, positive ? '+' : '−', row.devise)}
                      </td>
                      <td><StatusBadge status={transactionStatus(row.statut)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="dashboard-activity-mobile">
            {recent.map((row) => {
              const positive = row.type === 'depot';
              const account = row.compteType === 'DAT' ? 'Dépôt à terme' : row.compteType === 'CREDIT' ? 'Crédit' : 'Compte principal';
              return (
                <article className="dashboard-activity-card" key={row.id}>
                  <div className="dashboard-activity-card-main">
                    <div>
                      <strong>{row.description || transactionKind(row.type)}</strong>
                      <span>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(row.date))} · {account}</span>
                    </div>
                    <span className={positive ? 'amount-positive' : 'amount-negative'}>
                      {formatSignedCurrency(row.montant, positive ? '+' : '−', row.devise)}
                    </span>
                  </div>
                  <div className="dashboard-activity-card-footer">
                    <span>{transactionKind(row.type)}</span>
                    <StatusBadge status={transactionStatus(row.statut)} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

export type DashboardBlock = 'summary' | 'credits' | 'accounts' | 'chart' | 'activity';

export function MemberDashboard({ states = {} }: { states?: Partial<Record<DashboardBlock, PortalDataState>> }) {
  const { dashboard, transactions, state, error, reload } = useMemberPortalData();
  const [currency, setCurrency] = useState<'USD' | 'FC'>('USD');
  if (!dashboard && state === 'loading') return <div className="dashboard-layout"><p className="portal-empty-state">Chargement de vos données…</p></div>;
  if (!dashboard && state === 'error') return <div className="dashboard-layout"><div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div></div>;
  if (!dashboard) return null;

  const savings = dashboard.balances.savings;
  const credits = dashboard.balances.activeCredits;
  const currentMonth = dashboard.monthlyActivity.find((item) => item.monthKey === monthKey(new Date().toISOString()));
  const deposits = currentMonth?.[currency].deposits ?? 0;
  const withdrawals = currentMonth?.[currency].withdrawals ?? 0;
  const activeCreditTotal = credits[currency];
  const initials = dashboard.profile.nomComplet
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="dashboard-layout">
      {/* Top Section: 4 Bento KPI Cards (Harmonisées avec le Dashboard Admin) */}
      <div className="dashboard-kpi-grid-4">
        <BentoKPICard
          title="Épargne disponible (USD)"
          amount={savings.USD}
          currency="USD"
          caption="Solde du compte principal"
          badge="USD"
          icon={IconWallet}
          iconColor="blue"
        />
        <BentoKPICard
          title="Épargne disponible (FC)"
          amount={savings.FC}
          currency="FC"
          caption="Solde du compte membre"
          badge="FC"
          icon={IconCoins}
          iconColor="gold"
        />
        <BentoMonthlyFlowCard
          deposits={deposits}
          withdrawals={withdrawals}
          currency={currency}
          onCurrencyChange={setCurrency}
        />
        <BentoKPICard
          title="Crédits restant dus"
          amount={activeCreditTotal}
          currency={currency}
          caption={credits.FC > 0 ? `USD · ${formatCurrency(credits.FC, 'FC')} en FC` : `Devise sélectionnée (${currency})`}
          badge={activeCreditTotal > 0 ? 'En cours' : 'À jour'}
          badgeVariant={activeCreditTotal > 0 ? 'warning' : 'success'}
          icon={IconReceipt}
          iconColor="orange"
        />
      </div>

      {/* Middle Section: Chart (Balanced Left) + Member Hub & Quick Actions (Balanced Right) */}
      <div className="dashboard-middle">
        <div className="chart-region">
          <ActivityChart activity={dashboard.monthlyActivity} currency={currency} onCurrencyChange={setCurrency} />
        </div>
        <div className="accounts-region">
          <Panel title="Mon adhésion & Raccourcis" className="member-hub-panel">
            <DataRegion state={states.accounts ?? (state === 'ready' ? 'ready' : state)}>
              <div className="member-hub-content">
                <div className="member-hub-profile">
                  <div className="member-hub-profile-main">
                    <span className="member-hub-avatar">{initials}</span>
                    <div className="member-hub-profile-text">
                      <strong>{dashboard.profile.nomComplet}</strong>
                      <p>{dashboard.profile.numeroCompte}</p>
                    </div>
                  </div>
                  <div className="member-hub-profile-badges">
                    <span className="membership-account-type">{dashboard.profile.typeCompte}</span>
                    <span className="membership-status">{dashboard.profile.statut}</span>
                  </div>
                </div>

                <div className="member-hub-credit-banner">
                  <div className="member-hub-credit-info">
                    <span className="member-hub-credit-label">Capital dû en crédits</span>
                    <strong>{formatCurrency(credits.USD, 'USD')} · {formatCurrency(credits.FC, 'FC')}</strong>
                  </div>
                  <Link href="/credits" className="member-hub-credit-link">
                    Voir mes crédits →
                  </Link>
                </div>

                <div className="member-hub-shortcuts">
                  <span className="member-hub-shortcuts-title">Consultations & Raccourcis</span>
                  <div className="member-hub-shortcuts-list">
                    <Link href="/transactions" className="member-hub-shortcut-item">
                      <span className="shortcut-icon is-history">
                        <IconFileText size={16} aria-hidden="true" />
                      </span>
                      <div className="shortcut-info">
                        <strong>Historique des mouvements</strong>
                        <small>Consulter tous vos relevés d'opérations</small>
                      </div>
                      <IconChevronRight size={14} className="shortcut-arrow" aria-hidden="true" />
                    </Link>
                    <Link href="/comptes" className="member-hub-shortcut-item">
                      <span className="shortcut-icon is-deposit">
                        <IconWallet size={16} aria-hidden="true" />
                      </span>
                      <div className="shortcut-info">
                        <strong>Mes comptes d'épargne</strong>
                        <small>Détail des 6 comptes et soldes</small>
                      </div>
                      <IconChevronRight size={14} className="shortcut-arrow" aria-hidden="true" />
                    </Link>
                    <Link href="/credits" className="member-hub-shortcut-item">
                      <span className="shortcut-icon is-withdraw">
                        <IconCreditCard size={16} aria-hidden="true" />
                      </span>
                      <div className="shortcut-info">
                        <strong>Mes crédits & échéances</strong>
                        <small>Suivi des remboursements et échéances</small>
                      </div>
                      <IconChevronRight size={14} className="shortcut-arrow" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </DataRegion>
          </Panel>
        </div>
      </div>

      {/* Bottom Section: Activity List */}
      <ActivityList transactions={transactions} state={states.activity ?? state} error={error} reload={reload} />
    </div>
  );
}
