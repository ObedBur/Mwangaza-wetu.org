'use client';

import { useMemberPortalData } from '@/components/member-portal/member-data';
import { AccountAmount, DataRegion, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { formatCurrency, formatSignedCurrency } from '@/lib/format-currency';

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

function dateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function repaymentStatus(value: string) {
  if (value === 'CANCELLED' || value === 'FAILED') return 'Rejeté' as const;
  if (value === 'PENDING') return 'En attente' as const;
  return 'Validé' as const;
}

export function MemberRepaymentsPage() {
  const { transactions, state, error, reload, transactionMeta, loadMoreTransactions, loadingMore } = useMemberPortalData();
  const repayments = transactions.filter((row) => row.type === 'remboursement');
  return <div className="member-detail-page credits-page">
    <Panel title="Historique des remboursements" className="credit-history-panel">
      <DataRegion state={state} onRetry={reload}>
        {state === 'error' ? <p className="portal-error-state" role="alert">{error}</p> : <>
          {repayments.length > 0 ? <p className="repayment-count">{repayments.length} remboursement{repayments.length > 1 ? 's' : ''} affiché{repayments.length > 1 ? 's' : ''}</p> : null}
          <div className="repayment-table-wrap">
            <table className="repayment-table">
              <caption className="sr-only">Historique des remboursements enregistrés par la coopérative</caption>
              <thead><tr><th scope="col">Date et heure</th><th scope="col">Détail de l’opération</th><th scope="col">Montant remboursé</th><th scope="col">Statut</th></tr></thead>
              <tbody>{repayments.length === 0 ? <tr><td className="repayment-empty-cell" colSpan={4}>Aucun remboursement enregistré pour le moment.</td></tr> : repayments.map((row) => {
                const time = dateTimeLabel(row.date);
                return <tr key={row.id}>
                  <td><time className="repayment-date" dateTime={row.date}>{dateLabel(row.date)}</time>{time ? <span className="repayment-time">{time}</span> : null}</td>
                  <td className="repayment-description">{row.description}</td>
                  <td className="repayment-amount">{formatSignedCurrency(row.montant, '−', row.devise)}</td>
                  <td><StatusBadge status={repaymentStatus(row.statut)} /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="repayment-mobile-list" aria-label="Historique des remboursements">
            {repayments.length === 0 ? <p className="repayment-mobile-empty">Aucun remboursement enregistré pour le moment.</p> : repayments.map((row) => {
              const time = dateTimeLabel(row.date);
              return <article className="repayment-mobile-card" key={row.id}>
                <div className="repayment-mobile-card-heading"><strong>{row.description}</strong><StatusBadge status={repaymentStatus(row.statut)} /></div>
                <div className="repayment-mobile-card-footer"><span>{dateLabel(row.date)}{time ? ` · ${time}` : ''}</span><strong className="repayment-amount">{formatSignedCurrency(row.montant, '−', row.devise)}</strong></div>
              </article>;
            })}
          </div>
          {transactionMeta && transactionMeta.page < transactionMeta.totalPages ? <button type="button" className="document-download repayment-load-more" disabled={loadingMore} onClick={() => void loadMoreTransactions()}>{loadingMore ? 'Chargement…' : 'Charger les opérations plus anciennes'}</button> : null}
        </>}
      </DataRegion>
    </Panel>
  </div>;
}

export function MemberCreditsPage() {
  const { dashboard, state, error, reload } = useMemberPortalData();
  const credits = dashboard?.activeCreditsDetails ?? [];
  const totalUsd = credits.filter((credit) => credit.devise === 'USD').reduce((sum, credit) => sum + credit.restant, 0);
  const totalFc = credits.filter((credit) => credit.devise === 'FC').reduce((sum, credit) => sum + credit.restant, 0);
  const upcoming = credits.filter((credit) => credit.dateEcheance).sort((a, b) => (a.dateEcheance ?? '').localeCompare(b.dateEcheance ?? ''))[0];
  return <div className="member-detail-page credits-page">
    <div className="credit-stat-grid">
      <Panel title="Capital restant dû" className="credit-stat-card"><div><AccountAmount amount={totalUsd} currency="USD" /></div><span className="credit-stat-caption">{formatCurrency(totalFc, 'FC')}</span></Panel>
      <Panel title="Crédits actifs" className="credit-stat-card"><span className="credit-stat-number">{credits.length}</span><span className="credit-stat-caption">Crédits ouverts ou en retard</span></Panel>
      <Panel title="Prochaine échéance" className="credit-stat-card credit-next-stat"><span className="credit-stat-number">{upcoming?.dateEcheance ? dateLabel(upcoming.dateEcheance) : 'Aucune échéance connue'}</span><span className="credit-stat-caption">{upcoming ? `Crédit #${upcoming.id} · reste ${formatCurrency(upcoming.restant, upcoming.devise)}` : 'Aucune échéance à venir enregistrée'}</span></Panel>
    </div>
    <div className="credit-page-grid"><Panel title="Mes crédits" className="credit-list-panel"><DataRegion state={state === 'ready' && credits.length === 0 ? 'empty' : state} emptyLabel="Aucun crédit n’est associé à ce compte." onRetry={reload}>{state === 'error' ? <p>{error}</p> : <div className="credit-list">{credits.map((credit) => <article className="credit-card" key={credit.id}><div className="credit-card-top"><strong>Crédit #{credit.id}</strong><span className="credit-active-badge">{credit.statut}</span></div><div className="credit-card-amounts"><div><span>Montant initial</span><strong>{formatCurrency(credit.montantInitial, credit.devise)}</strong></div><div><span>Reste à rembourser</span><strong>{formatCurrency(credit.restant, credit.devise)}</strong></div></div><div className="credit-progress-copy"><span>Remboursé</span><strong>{Math.round(credit.progression)} %</strong></div><div className="account-detail-progress-track" role="img" aria-label={`${Math.round(credit.progression)}% du crédit remboursé`}><span className="is-credit" style={{ width: `${Math.max(0, Math.min(100, credit.progression))}%` }} /></div><div className="credit-card-footer"><span>Taux : <strong>{credit.tauxInteret}%</strong></span><span>Depuis le {dateLabel(credit.dateDebut)}</span></div>{credit.dateEcheance ? <span className="account-total-meta">Échéance : {dateLabel(credit.dateEcheance)}</span> : null}</article>)}</div>}</DataRegion></Panel>
      <div className="credit-aside"><Panel title="Remboursements récents" className="repayment-schedule-panel"><p>Consultez les opérations déjà enregistrées par la coopérative dans l’historique.</p><a href="/remboursement" className="credit-history-link">Voir l’historique des remboursements</a></Panel></div></div>
  </div>;
}
