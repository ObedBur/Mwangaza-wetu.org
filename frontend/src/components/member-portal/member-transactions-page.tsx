'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMemberSearch } from '@/components/member-portal/member-shell';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { DataRegion, ExportMenu, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { exportTransactionsCsv } from '@/lib/export-transactions';
import { formatSignedCurrency } from '@/lib/format-currency';
import { IconDatabaseOff, IconFilter, IconSearch } from '@/lib/tabler-icons';
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
  const { query, setQuery, onlyPending, setOnlyPending } = useMemberSearch();
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
  const resetFilters = () => {
    setMonth('tous');
    setCurrency('tous');
    setStatus('Tous');
    setOnlyPending(false);
    setQuery('');
  };

  return (
    <div className="member-detail-page">
      <Panel title="Historique des mouvements" className="transactions-directory-panel" action={<ExportMenu onCsv={() => exportTransactionsCsv(filtered)} onPrint={() => window.print()} />}>
        <div className="transaction-directory-intro">
          <p className="activity-subtitle">Historique transmis par la coopérative. Les soldes USD et FC restent distincts.</p>
          <span className="transaction-total-pill">{transactionMeta?.total ?? mapped.length} opération(s)</span>
        </div>
        <div className="transactions-filter-panel">
          <div className="transactions-filter-heading"><span className="transactions-filter-icon"><IconFilter size={16} aria-hidden="true" /></span><div><strong>Filtrer les mouvements</strong><span>Affinez l’historique par période, devise ou statut.</span></div></div>
          <div className="transactions-filter-grid" role="group" aria-label="Filtres des mouvements">
            <label><span>Mois</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="tous">Tous les mois</option>{Array.from(new Set(mapped.map((row) => row.date.slice(0, 7)))).sort().reverse().map((key) => <option key={key} value={key}>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`))}</option>)}</select></label>
            <label><span>Devise</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="tous">Toutes les devises</option><option>USD</option><option>FC</option></select></label>
            <label><span>Statut</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{['Tous', 'Validé', 'En attente', 'Rejeté'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <button type="button" className="transaction-reset-button" onClick={resetFilters}>Réinitialiser</button>
          </div>
        </div>
        <DataRegion state={state === 'error' ? 'ready' : state} onRetry={reload}>
          {state === 'error' ? <div className="portal-error-state" role="alert"><span>{error}</span><button type="button" onClick={reload}>Réessayer</button></div> : filtered.length === 0 ? (
            <div className="transactions-empty-state">
              <span className="transactions-empty-icon">{mapped.length === 0 ? <IconDatabaseOff size={20} aria-hidden="true" /> : <IconSearch size={20} aria-hidden="true" />}</span>
              <strong>{mapped.length === 0 ? 'Aucune opération enregistrée' : 'Aucun mouvement ne correspond à ces filtres'}</strong>
              <p>{mapped.length === 0 ? 'Vos dépôts et retraits apparaîtront ici après leur enregistrement.' : 'Modifiez vos critères ou réinitialisez les filtres pour revoir les opérations.'}</p>
              {mapped.length === 0 ? <Link href="/deposer">Faire un dépôt</Link> : <button type="button" onClick={resetFilters}>Réinitialiser les filtres</button>}
            </div>
          ) : <>
          <div className="activity-table-wrap"><table className="activity-table"><thead><tr><th>Date et heure</th><th>Description</th><th>Compte membre</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{filtered.map((row) => {
            const date = formatDate(row.date);
            const incoming = row.kind === 'Dépôt';
            return <tr key={row.id}><td><span className="transaction-date">{date.date}</span><span className="transaction-time">{date.time}</span></td><td className="transaction-description">{row.description}</td><td>{row.accountLabel}</td><td>{row.kind}</td><td className={incoming ? 'amount-positive' : 'amount-negative'}>{formatSignedCurrency(row.amount, incoming ? '+' : '−', row.currency)}</td><td><StatusBadge status={row.status} /></td></tr>;
          })}</tbody></table></div>
          <div className="transactions-mobile-list">
            {filtered.map((row) => {
              const date = formatDate(row.date);
              const incoming = row.kind === 'Dépôt';
              return <article className="transactions-mobile-card" key={row.id}>
                <div className="transactions-mobile-card-top"><span className={`transactions-mobile-kind${incoming ? ' is-incoming' : ''}`}>{row.kind}</span><StatusBadge status={row.status} /></div>
                <div className="transactions-mobile-card-body"><strong>{row.description}</strong><span>{row.accountLabel} · {date.date} à {date.time}</span></div>
                <strong className={incoming ? 'amount-positive' : 'amount-negative'}>{formatSignedCurrency(row.amount, incoming ? '+' : '−', row.currency)}</strong>
              </article>;
            })}
          </div>
          </>}
        </DataRegion>
        {state === 'ready' && error ? <p className="portal-error-state" role="alert">{error}</p> : null}
        {transactionMeta && transactionMeta.page < transactionMeta.totalPages ? <button type="button" className="document-download" disabled={loadingMore} onClick={() => void loadMoreTransactions()}>{loadingMore ? 'Chargement…' : 'Charger les opérations plus anciennes'}</button> : null}
      </Panel>
    </div>
  );
}
