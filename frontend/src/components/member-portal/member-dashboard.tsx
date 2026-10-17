'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMemberPortalData, type MemberPortalDashboard, type MemberPortalTransaction } from '@/components/member-portal/member-data';
import { AccountAmount, DataRegion, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { formatCurrency, formatSignedCurrency } from '@/lib/format-currency';
import { IconArrowDown, IconDatabaseOff, IconWallet } from '@/lib/tabler-icons';
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

function SummaryCard({ title, amount, currency, caption, featured = false }: { title: string; amount: number; currency: string; caption: string; featured?: boolean }) {
  return (
    <article className={`summary-card summary-deposit${featured ? ' is-savings-hero' : ''}`}>
      <div className="summary-card-top"><h2>{title}</h2>{featured ? <IconWallet size={19} stroke={1.7} aria-hidden="true" /> : null}</div>
      <AccountAmount amount={amount} currency={currency} />
      <div className="summary-card-bottom"><span>{caption}</span></div>
    </article>
  );
}

function DashboardEmptyState({ kind }: { kind: 'chart' | 'activity' }) {
  const isChart = kind === 'chart';
  return (
    <div className="dashboard-empty-state">
      <span className="dashboard-empty-icon" aria-hidden="true">{isChart ? <IconArrowDown size={18} /> : <IconDatabaseOff size={18} />}</span>
      <div>
        <strong>{isChart ? 'Aucun mouvement sur les six derniers mois' : 'Aucune opération récente'}</strong>
        <p>{isChart ? 'Vos dépôts et retraits apparaîtront ici.' : 'Vos opérations enregistrées s’afficheront dans cet historique.'}</p>
      </div>
      {isChart ? <Link href="/deposer" className="dashboard-empty-action">Faire un dépôt</Link> : <Link href="/transactions" className="dashboard-empty-action">Voir l’historique</Link>}
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
  return (
    <Panel title="Dépôts & retraits" className="chart-panel" action={<div className="chart-panel-actions"><div className="chart-currency-toggle" role="group" aria-label="Devise du graphique"><button type="button" aria-pressed={currency === 'USD'} className={currency === 'USD' ? 'is-selected' : ''} onClick={() => onCurrencyChange('USD')}>USD</button><button type="button" aria-pressed={currency === 'FC'} className={currency === 'FC' ? 'is-selected' : ''} onClick={() => onCurrencyChange('FC')}>FC</button></div><span className="chart-period-label">6 derniers mois</span></div>}>
      {!hasActivity ? <DashboardEmptyState kind="chart" /> : (
        <>
          <div className="member-chart-legend" aria-label="Légende du graphique">
            <span><i className="legend-deposit" />Dépôts</span>
            <span><i className="legend-withdrawal" />Retraits</span>
          </div>
          <div className="member-chart-plot">
            <div className="member-chart-gridlines" aria-hidden="true"><span /><span /><span /><span /></div>
            <div className="chart-columns">
              {activityRows.map((item) => (
                <div className="chart-column" key={item.key}>
                  <div className="chart-bars">
                    <span className="chart-bar deposit-bar" style={{ height: `${item.deposits ? Math.max(4, (item.deposits / maximum) * 100) : 0}%` }} title={`Dépôts ${item.month} : ${formatCurrency(item.deposits, currency)}`} />
                    <span className="chart-bar withdrawal-bar" style={{ height: `${item.withdrawals ? Math.max(4, (item.withdrawals / maximum) * 100) : 0}%` }} title={`Retraits ${item.month} : ${formatCurrency(item.withdrawals, currency)}`} />
                  </div>
                  <span className="chart-month">{item.month}</span>
                </div>
              ))}
              </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function ActivityList({ transactions, state, error, reload }: { transactions: MemberPortalTransaction[]; state: PortalDataState; error: string; reload: () => void }) {
  const recent = transactions.slice(0, 8);
  return (
    <Panel title="Activité récente" className="activity-panel" action={<Link href="/transactions" className="panel-text-link">Historique complet</Link>}>
      {state === 'error' ? <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div> : state === 'loading' ? <p className="portal-empty-state">{stateLabel(state)}</p> : recent.length === 0 ? <DashboardEmptyState kind="activity" /> : (
        <>
        <div className="activity-table-wrap">
          <table className="activity-table"><thead><tr><th>Date</th><th>Description</th><th>Compte</th><th>Montant</th><th>Statut</th></tr></thead>
            <tbody>{recent.map((row) => {
              const positive = row.type === 'depot';
              const account = row.compteType === 'DAT' ? 'Dépôt à terme' : row.compteType === 'CREDIT' ? 'Crédit' : 'Compte principal';
              return <tr key={row.id}><td>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(row.date))}</td><td className="transaction-description"><span>{row.description}</span><small>{transactionKind(row.type)}</small></td><td className="table-account">{account}</td><td className={positive ? 'amount-positive' : 'amount-negative'}>{formatSignedCurrency(row.montant, positive ? '+' : '−', row.devise)}</td><td><StatusBadge status={transactionStatus(row.statut)} /></td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="dashboard-activity-mobile">
          {recent.map((row) => {
            const positive = row.type === 'depot';
            const account = row.compteType === 'DAT' ? 'Dépôt à terme' : row.compteType === 'CREDIT' ? 'Crédit' : 'Compte principal';
            return <article className="dashboard-activity-card" key={row.id}>
              <div className="dashboard-activity-card-main"><div><strong>{row.description || transactionKind(row.type)}</strong><span>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(row.date))} · {account}</span></div><span className={positive ? 'amount-positive' : 'amount-negative'}>{formatSignedCurrency(row.montant, positive ? '+' : '−', row.devise)}</span></div>
              <div className="dashboard-activity-card-footer"><span>{transactionKind(row.type)}</span><StatusBadge status={transactionStatus(row.statut)} /></div>
            </article>;
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

  return (
    <div className="dashboard-layout">
      <div className="dashboard-top">
        <div className="monthly-summary-region">
          <div className="monthly-summary">
            <SummaryCard title="Épargne disponible" amount={savings.USD} currency="USD" caption="Solde du compte principal · USD" featured />
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
            <div className="account-row member-dashboard-profile-row"><div><strong>{dashboard.profile.nomComplet}</strong><p>{dashboard.profile.numeroCompte}</p></div><span className="membership-account-type">{dashboard.profile.typeCompte}</span><span className="membership-status">{dashboard.profile.statut}</span></div>
            <div className="account-row member-dashboard-credit-row"><span>Capital dû en crédits</span><strong>{formatCurrency(credits.USD, 'USD')} · {formatCurrency(credits.FC, 'FC')}</strong><Link href="/credits">Voir mes crédits</Link></div>
          </DataRegion>
        </Panel></div>
        <div className="chart-region"><ActivityChart activity={dashboard.monthlyActivity} currency={currency} onCurrencyChange={setCurrency} /></div>
      </div>
      <ActivityList transactions={transactions} state={states.activity ?? state} error={error} reload={reload} />
    </div>
  );
}
