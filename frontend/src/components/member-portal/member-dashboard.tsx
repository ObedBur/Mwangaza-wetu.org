'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMemberPortalData, type MemberPortalDashboard, type MemberPortalTransaction } from '@/components/member-portal/member-data';
import { AccountAmount, DataRegion, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { formatCurrency, formatSignedCurrency } from '@/lib/format-currency';
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

function SummaryCard({ title, amount, currency, caption }: { title: string; amount: number; currency: string; caption: string }) {
  return (
    <article className="summary-card summary-deposit">
      <div className="summary-card-top"><h2>{title}</h2></div>
      <AccountAmount amount={amount} currency={currency} />
      <div className="summary-card-bottom"><span>{caption}</span></div>
    </article>
  );
}

function monthKey(date: string) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function ActivityChart({ activity, currency }: { activity: MemberPortalDashboard['monthlyActivity']; currency: string }) {
  const months = activity.map((item) => ({ key: item.monthKey, month: item.month, deposits: item[currency as 'USD' | 'FC'].deposits, withdrawals: item[currency as 'USD' | 'FC'].withdrawals }));
  const activityRows = months;
  const maximum = Math.max(1, ...activityRows.flatMap((item) => [item.deposits, item.withdrawals]));
  const hasActivity = activityRows.some((item) => item.deposits || item.withdrawals);
  return (
    <Panel title="Dépôts & retraits" className="chart-panel" action={<span className="chart-period-label">6 derniers mois · {currency}</span>}>
      {!hasActivity ? <p className="portal-empty-state">Aucune opération enregistrée sur ces six mois.</p> : (
        <div className="chart-columns">
          {activityRows.map((item) => (
            <div className="chart-column" key={item.key}>
              <div className="chart-bars">
                <span className="chart-bar deposit-bar" style={{ height: `${(item.deposits / maximum) * 100}%` }} title={`Dépôts ${item.month} : ${formatCurrency(item.deposits, currency)}`} />
                <span className="chart-bar withdrawal-bar" style={{ height: `${(item.withdrawals / maximum) * 100}%` }} title={`Retraits ${item.month} : ${formatCurrency(item.withdrawals, currency)}`} />
              </div>
              <span className="chart-month">{item.month}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ActivityList({ transactions, state, error, reload }: { transactions: MemberPortalTransaction[]; state: PortalDataState; error: string; reload: () => void }) {
  const recent = transactions.slice(0, 8);
  return (
    <Panel title="Activité récente" className="activity-panel" action={<Link href="/transactions" className="panel-text-link">Historique complet</Link>}>
      {state === 'error' ? <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div> : state === 'loading' ? <p className="portal-empty-state">{stateLabel(state)}</p> : recent.length === 0 ? <p className="portal-empty-state">Aucune opération enregistrée pour ce compte.</p> : (
        <div className="activity-table-wrap">
          <table className="activity-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead>
            <tbody>{recent.map((row) => {
              const positive = row.type === 'depot';
              return <tr key={row.id}><td>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(row.date))}</td><td className="transaction-description">{row.description}</td><td>{transactionKind(row.type)}</td><td className={positive ? 'amount-positive' : 'amount-negative'}>{formatSignedCurrency(row.montant, positive ? '+' : '−', row.devise)}</td><td><StatusBadge status={transactionStatus(row.statut)} /></td></tr>;
            })}</tbody>
          </table>
        </div>
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

  return (
    <div className="dashboard-layout">
      <div className="dashboard-top">
        <div className="monthly-summary-region">
          <div className="monthly-summary">
            <SummaryCard title="Épargne disponible" amount={savings.USD} currency="USD" caption="Compte membre · USD" />
            <SummaryCard title="Épargne disponible" amount={savings.FC} currency="FC" caption="Compte membre · FC" />
            <SummaryCard title="Crédits restant dus" amount={activeCreditTotal} currency={currency} caption={`Devise ${currency}`} />
          </div>
        </div>
        <div className="credits-region"><Panel title={`Activité du mois · ${currency}`} action={<select aria-label="Devise des indicateurs" value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'FC')}><option value="USD">USD</option><option value="FC">FC</option></select>}>
          <div className="monthly-summary"><SummaryCard title="Dépôts du mois" amount={deposits} currency={currency} caption="Opérations enregistrées" /><SummaryCard title="Retraits du mois" amount={withdrawals} currency={currency} caption="Opérations payées" /></div>
          <p className="account-total-meta">Net du mois : {formatCurrency(deposits - withdrawals, currency)}</p>
        </Panel></div>
      </div>
      <div className="dashboard-middle">
        <div className="accounts-region"><Panel title="Mon adhésion" className="accounts-panel">
          <DataRegion state={states.accounts ?? (state === 'ready' ? 'ready' : state)}>
            <div className="account-row member-dashboard-profile-row"><div><strong>{dashboard.profile.nomComplet}</strong><p>{dashboard.profile.numeroCompte}</p></div><span>{dashboard.profile.typeCompte}</span><span>{dashboard.profile.statut}</span></div>
            <div className="account-row member-dashboard-credit-row"><span>Capital dû en crédits</span><strong>{formatCurrency(credits.USD, 'USD')} · {formatCurrency(credits.FC, 'FC')}</strong><Link href="/credits">Voir mes crédits</Link></div>
          </DataRegion>
        </Panel></div>
        <div className="chart-region"><div className="toolbar-controls"><button type="button" className={`filter-button${currency === 'USD' ? ' is-selected' : ''}`} onClick={() => setCurrency('USD')}>USD</button><button type="button" className={`filter-button${currency === 'FC' ? ' is-selected' : ''}`} onClick={() => setCurrency('FC')}>FC</button></div><ActivityChart activity={dashboard.monthlyActivity} currency={currency} /></div>
      </div>
      <ActivityList transactions={transactions} state={states.activity ?? state} error={error} reload={reload} />
    </div>
  );
}
