'use client';

import Link from 'next/link';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { AccountAmount, DataRegion, Panel } from '@/components/member-portal/portal-ui';
import { formatCurrency } from '@/lib/format-currency';
import { IconArrowDown, IconArrowUp, IconCreditCard, IconPigMoney, IconWallet } from '@/lib/tabler-icons';

export function MemberAccountsPage() {
  const { dashboard, dats, state, error, reload } = useMemberPortalData();
  if (!dashboard && state === 'loading') return <div className="member-detail-page"><p className="portal-empty-state">Chargement des comptes…</p></div>;
  if (!dashboard) return <div className="member-detail-page"><div className="portal-error-state" role="alert"><span>{error || 'Impossible de charger vos comptes.'}</span><button onClick={reload}>Réessayer</button></div></div>;

  const savings = dashboard.balances.savings;
  const credits = dashboard.activeCreditsDetails;
  return (
    <div className="member-detail-page">
      <div className="account-totals-row">
        <Panel title="Épargne disponible · USD" className="account-total-card account-total-hero" action={<span className="account-total-icon"><IconWallet size={19} aria-hidden="true" /></span>}>
          <AccountAmount amount={savings.USD} currency="USD" />
          <span className="account-total-meta">Compte principal · {dashboard.profile.numeroCompte}</span>
          <div className="account-total-actions"><Link href="/deposer"><IconArrowDown size={15} aria-hidden="true" />Faire un dépôt</Link><Link href="/retirer"><IconArrowUp size={15} aria-hidden="true" />Demander un retrait</Link></div>
        </Panel>
        <Panel title="Épargne disponible · FC" className="account-total-card account-total-fc" action={<span className="account-total-icon"><IconPigMoney size={19} aria-hidden="true" /></span>}>
          <AccountAmount amount={savings.FC} currency="FC" />
          <span className="account-total-meta">Compte principal · francs congolais</span>
        </Panel>
        <Panel title="Crédits restant dus" className="account-total-card credit-total-card" action={<span className="account-total-icon"><IconCreditCard size={19} aria-hidden="true" /></span>}>
          <AccountAmount amount={dashboard.balances.activeCredits.USD} currency="USD" />
          <span className="account-total-meta">USD · {formatCurrency(dashboard.balances.activeCredits.FC, 'FC')} en FC</span>
        </Panel>
      </div>
      <Panel title="Comptes et engagements réels" className="account-directory-panel">
        <div className="account-overview-strip" aria-label="Résumé des comptes">
          <div><span>Adhésion</span><strong>{dashboard.profile.typeCompte}</strong></div>
          <div><span>Crédits actifs</span><strong>{credits.length}</strong></div>
          <div><span>Dépôts à terme</span><strong>{dats.length}</strong></div>
        </div>
        <DataRegion state={state} emptyLabel="Aucun crédit en cours." onRetry={reload}>
          <div className="member-accounts-grid">
            <article className="member-account-card account-card-épargne"><div className="member-account-card-heading"><strong>Compte principal</strong><span className="account-type-label type-savings">Épargne libre</span></div><div className="member-account-balances"><div className="member-account-balance"><AccountAmount amount={savings.USD} currency="USD" /><span>Solde en dollars</span></div><div className="member-account-balance"><AccountAmount amount={savings.FC} currency="FC" /><span>Solde en francs</span></div></div><span className="account-total-meta">Numéro de compte · {dashboard.profile.numeroCompte}</span></article>
            {credits.map((credit) => <article className="member-account-card account-card-crédit" key={credit.id}><div className="member-account-card-heading"><strong>Crédit #{credit.id}</strong><span className="account-type-label type-credit">{credit.statut}</span></div><div className="member-account-balance"><AccountAmount amount={credit.restant} currency={credit.devise} /><span>Capital restant dû</span></div><div className="account-detail-progress"><div className="account-detail-progress-track" role="img" aria-label={`${Math.round(credit.progression)} % remboursé`}><span className="is-credit" style={{ width: `${Math.max(0, Math.min(100, credit.progression))}%` }} /></div><span>{Math.round(credit.progression)} % remboursé</span></div><span className="account-total-meta">Début : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(credit.dateDebut))}</span></article>)}
            {dats.map((dat) => <article className="member-account-card account-card-épargne" key={`dat-${dat.id}`}><div className="member-account-card-heading"><strong>Dépôt à terme · {dat.dureeMois} mois</strong><span className="account-type-label type-savings">{dat.statut}</span></div><div className="member-account-balance"><AccountAmount amount={dat.capital} currency={dat.devise} /><span>Capital bloqué</span></div><div className="account-total-meta">Échéance : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(dat.dateEcheance))} · Gain prévu {formatCurrency(dat.gain, dat.devise)}</div></article>)}
          </div>
        </DataRegion>
      </Panel>
    </div>
  );
}
