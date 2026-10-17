'use client';

import { useMemo, useState } from 'react';
import { useMemberSearch } from '@/components/member-portal/member-shell';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { DataRegion, ExportMenu, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { exportTransactionsCsv } from '@/lib/export-transactions';
import { formatSignedCurrency } from '@/lib/format-currency';
import type { MemberTransaction, TransactionStatus } from '@/mocks/member-dashboard';

function displayStatus(value: string): TransactionStatus {
  if (value === 'CANCELLED' || value === 'FAILED') return 'Rejeté';
  if (value === 'PENDING') return 'En attente';
  return 'Validé';
}

function displayKind(value: string): MemberTransaction['kind'] {
  if (value === 'remboursement') return 'Remboursement';
  if (value === 'retrait') return 'Retrait';
  return 'Dépôt';
}

function formatDate(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date),
  };
}

export function MemberTransactionsPage() {
  const [month, setMonth] = useState('tous');
  const [currency, setCurrency] = useState('tous');
  const [status, setStatus] = useState<'Tous' | TransactionStatus>('Tous');
  const { query, onlyPending } = useMemberSearch();
  const { transactions, state, error, reload, transactionMeta, loadMoreTransactions, loadingMore } = useMemberPortalData();
  const mapped = transactions.map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    accountId: 'principal' as const,
    kind: displayKind(row.type),
    amount: row.montant,
    status: displayStatus(row.statut),
    currency: row.devise,
    accountLabel: row.compteType === 'DAT' ? 'Dépôt à terme' : row.compteType === 'CREDIT' ? 'Crédit' : 'Compte principal',
  }));
  const filtered = useMemo(() => mapped.filter((row) =>
    (month === 'tous' || row.date.startsWith(month)) &&
    (currency === 'tous' || row.currency === currency) &&
    (status === 'Tous' || row.status === status) &&
    (!onlyPending || row.status === 'En attente') &&
    `${row.description} ${row.kind} ${row.status}`.toLocaleLowerCase('fr-FR').includes(query.toLocaleLowerCase('fr-FR'))
  ), [mapped, month, currency, status, onlyPending, query]);

  return (
    <div className="member-detail-page">
      <Panel title="Historique des mouvements" className="transactions-directory-panel" action={<ExportMenu onCsv={() => exportTransactionsCsv(filtered)} onPrint={() => window.print()} />}>
        <p className="activity-subtitle">Historique transmis par la coopérative · USD et FC restent distincts.</p>
        <div className="account-filter-row" role="group" aria-label="Filtres des mouvements">
          <label>Mois <select value={month} onChange={(event) => setMonth(event.target.value)}><option value="tous">Tous</option>{Array.from(new Set(mapped.map((row) => row.date.slice(0, 7)))).sort().reverse().map((key) => <option key={key} value={key}>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`))}</option>)}</select></label>
          <label>Devise <select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="tous">Toutes</option><option>USD</option><option>FC</option></select></label>
          <label>Statut <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{['Tous', 'Validé', 'En attente', 'Rejeté'].map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <DataRegion state={state === 'ready' && filtered.length === 0 ? 'empty' : state} emptyLabel="Aucune opération ne correspond aux filtres." onRetry={reload}>
          {state === 'error' ? <p>{error}</p> : <div className="activity-table-wrap"><table className="activity-table"><thead><tr><th>Date et heure</th><th>Description</th><th>Compte membre</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{filtered.map((row) => {
            const date = formatDate(row.date);
            const incoming = row.kind === 'Dépôt';
            return <tr key={row.id}><td><span className="transaction-date">{date.date}</span><span className="transaction-time">{date.time}</span></td><td className="transaction-description">{row.description}</td><td>{row.accountLabel}</td><td>{row.kind}</td><td className={incoming ? 'amount-positive' : 'amount-negative'}>{formatSignedCurrency(row.amount, incoming ? '+' : '−', row.currency)}</td><td><StatusBadge status={row.status} /></td></tr>;
          })}</tbody></table></div>}
        </DataRegion>
        {state === 'ready' && error ? <p className="portal-error-state" role="alert">{error}</p> : null}
        {transactionMeta && transactionMeta.page < transactionMeta.totalPages ? <button type="button" className="document-download" disabled={loadingMore} onClick={() => void loadMoreTransactions()}>{loadingMore ? 'Chargement…' : 'Charger les opérations plus anciennes'}</button> : null}
      </Panel>
    </div>
  );
}
