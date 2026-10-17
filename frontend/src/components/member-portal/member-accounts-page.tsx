'use client';

import { useMemberPortalData } from '@/components/member-portal/member-data';
import { AccountAmount, DataRegion, Panel } from '@/components/member-portal/portal-ui';
import { formatCurrency } from '@/lib/format-currency';
import type { MemberAccountType } from '@/lib/member-portal-config';

export function MemberAccountsPage() {
  const { dashboard, dats, state, error, reload } = useMemberPortalData();
  if (!dashboard && state === 'loading') return <div className="member-detail-page"><p className="portal-empty-state">Chargement des comptes…</p></div>;
  if (!dashboard) return <div className="member-detail-page"><div className="portal-error-state" role="alert"><span>{error || 'Impossible de charger vos comptes.'}</span><button onClick={reload}>Réessayer</button></div></div>;

  const savings = dashboard.balances.savings;
  const credits = dashboard.activeCreditsDetails;
  const filters: Array<'Tous' | MemberAccountType> = ['Tous', 'épargne', 'crédit'];
  return (
    <div className="member-detail-page">
      <div className="account-totals-row">
        <Panel title="Épargne · USD" className="account-total-card"><AccountAmount amount={savings.USD} currency="USD" /><span className="account-total-meta">Compte {dashboard.profile.numeroCompte}</span></Panel>
        <Panel title="Épargne · FC" className="account-total-card"><AccountAmount amount={savings.FC} currency="FC" /><span className="account-total-meta">Compte {dashboard.profile.numeroCompte}</span></Panel>
        <Panel title="Crédits restant dus" className="account-total-card credit-total-card"><AccountAmount amount={dashboard.balances.activeCredits.USD} currency="USD" /><span className="account-total-meta">USD · {formatCurrency(dashboard.balances.activeCredits.FC, 'FC')}</span></Panel>
      </div>
      <Panel title="Comptes et engagements réels" className="account-directory-panel">
        <div className="account-filter-row" aria-label="Résumé par type"><span>Épargne</span><span>Crédits en cours : {credits.length}</span><span>Adhésion : {dashboard.profile.typeCompte}</span></div>
        <DataRegion state={state} emptyLabel="Aucun crédit en cours." onRetry={reload}>
          <div className="member-accounts-grid">
            <article className="member-account-card account-card-épargne"><div className="member-account-card-heading"><strong>Compte d’épargne du membre</strong><span className="account-type-label type-savings">Épargne</span></div><div className="member-account-balance"><AccountAmount amount={savings.USD} currency="USD" /><span>Solde USD</span></div><div className="member-account-balance"><AccountAmount amount={savings.FC} currency="FC" /><span>Solde FC</span></div></article>
            {credits.map((credit) => <article className="member-account-card account-card-crédit" key={credit.id}><div className="member-account-card-heading"><strong>Crédit #{credit.id}</strong><span className="account-type-label type-credit">{credit.statut}</span></div><div className="member-account-balance"><AccountAmount amount={credit.restant} currency={credit.devise} /><span>Capital restant dû</span></div><div className="account-detail-progress"><div className="account-detail-progress-track" role="img" aria-label={`${Math.round(credit.progression)} % remboursé`}><span className="is-credit" style={{ width: `${Math.max(0, Math.min(100, credit.progression))}%` }} /></div><span>{Math.round(credit.progression)} % remboursé</span></div><span className="account-total-meta">Début : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(credit.dateDebut))}</span></article>)}
            {dats.map((dat) => <article className="member-account-card account-card-épargne" key={`dat-${dat.id}`}><div className="member-account-card-heading"><strong>Dépôt à terme · {dat.dureeMois} mois</strong><span className="account-type-label type-savings">{dat.statut}</span></div><div className="member-account-balance"><AccountAmount amount={dat.capital} currency={dat.devise} /><span>Capital bloqué</span></div><div className="account-total-meta">Échéance : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(dat.dateEcheance))} · Gain prévu {formatCurrency(dat.gain, dat.devise)}</div></article>)}
          </div>
        </DataRegion>
      </Panel>
    </div>
  );
}
