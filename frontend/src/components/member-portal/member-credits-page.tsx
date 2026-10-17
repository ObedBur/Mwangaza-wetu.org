'use client';

import { useMemberPortalData } from '@/components/member-portal/member-data';
import { AccountAmount, DataRegion, Panel, StatusBadge } from '@/components/member-portal/portal-ui';
import { formatCurrency, formatSignedCurrency } from '@/lib/format-currency';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

export function MemberRepaymentsPage() {
  const { transactions, state, error, reload } = useMemberPortalData();
  const repayments = transactions.filter((row) => row.type === 'remboursement');
  return <div className="member-detail-page credits-page"><Panel title="Historique des remboursements" className="credit-history-panel"><DataRegion state={state === 'ready' && repayments.length === 0 ? 'empty' : state} emptyLabel="Aucun remboursement enregistré." onRetry={reload}>{state === 'error' ? <p>{error}</p> : <div className="credit-history-list">{repayments.map((row) => <div className="credit-history-row" key={row.id}><span>{dateLabel(row.date)}</span><span className="credit-history-description">{row.description}</span><span className="amount-negative">{formatSignedCurrency(row.montant, '−', row.devise)}</span><StatusBadge status={row.statut === 'CANCELLED' ? 'Rejeté' : 'Validé'} /></div>)}</div>}</DataRegion></Panel></div>;
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
