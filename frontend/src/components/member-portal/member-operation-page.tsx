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
    <div className="operation-grid"><Panel title={isDeposit ? 'Effectuer un dépôt' : 'Effectuer un retrait'} className="operation-form-panel"><p className="portal-empty-state">Cette opération n’est pas exécutable depuis l’espace membre. Présentez-vous au guichet afin qu’un agent l’enregistre dans la caisse et le grand livre de la coopérative.</p><Link href="/aide" className="button-primary">Contacter l’assistance</Link></Panel>
      <aside className="operation-aside"><Panel title="Soldes actuels" className="operation-summary-panel">{state === 'error' ? <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div> : !dashboard ? <p className="portal-empty-state">Chargement…</p> : <div className="operation-summary-list"><div><dt>USD disponible</dt><dd><AccountAmount amount={dashboard.balances.savings.USD} currency="USD" /></dd></div><div><dt>FC disponible</dt><dd><AccountAmount amount={dashboard.balances.savings.FC} currency="FC" /></dd></div></div>}<p className="operation-demo-note"><IconBuildingBank size={16} />Les mouvements seront visibles dans votre historique après enregistrement par la coopérative.</p></Panel></aside>
    </div>
  </div>;
}
