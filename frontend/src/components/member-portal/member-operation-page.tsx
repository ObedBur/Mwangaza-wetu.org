'use client';

import Link from 'next/link';
import { IconArrowDown, IconArrowUp, IconBuildingBank } from '@/lib/tabler-icons';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { AccountAmount, Panel } from '@/components/member-portal/portal-ui';

type OperationKind = 'depot' | 'retrait';

export function MemberOperationPage({ kind }: { kind: OperationKind }) {
  const { dashboard, state, error, reload } = useMemberPortalData();
  const isDeposit = kind === 'depot';
  const Icon = isDeposit ? IconArrowDown : IconArrowUp;
  return <div className="member-detail-page operation-page">
    <div className="operation-intro"><span className="operation-intro-icon" aria-hidden="true"><Icon size={22} /></span><div><p className="operation-eyebrow">Opération au guichet</p><p className="operation-description">{isDeposit ? 'Un agent doit enregistrer le dépôt et remettre le reçu.' : 'Un agent doit traiter le retrait et vérifier votre identité biométrique au guichet.'}</p></div></div>
    <div className="operation-grid"><Panel title={isDeposit ? 'Effectuer un dépôt' : 'Effectuer un retrait'} className="operation-form-panel">
      <div className="operation-unavailable-state" role="note">
        <span className="operation-unavailable-icon" aria-hidden="true"><IconBuildingBank size={20} /></span>
        <div>
          <strong>{isDeposit ? 'Dépôt effectué au guichet' : 'Retrait effectué au guichet'}</strong>
          <p>{isDeposit ? 'Un agent reçoit les fonds, puis enregistre le dépôt dans la caisse de la coopérative.' : 'Un agent vérifie votre identité biométrique et enregistre le retrait dans la caisse de la coopérative.'}</p>
          <span>Cette opération ne peut pas être soumise depuis votre espace membre.</span>
        </div>
      </div>
      <Link href="/aide" className="button-primary operation-support-link">Contacter l’assistance</Link>
    </Panel>
      <aside className="operation-aside"><Panel title="Soldes actuels" className="operation-summary-panel">{state === 'error' ? <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div> : !dashboard ? <p className="portal-empty-state">Chargement…</p> : <div className="operation-summary-list"><div><dt>USD disponible</dt><dd><AccountAmount amount={dashboard.balances.savings.USD} currency="USD" /></dd></div><div><dt>FC disponible</dt><dd><AccountAmount amount={dashboard.balances.savings.FC} currency="FC" /></dd></div></div>}<p className="operation-demo-note"><IconBuildingBank size={16} />Les mouvements seront visibles dans votre historique après enregistrement par la coopérative.</p></Panel></aside>
    </div>
  </div>;
}
