'use client';

import { IconDownload, IconFileText } from '@/lib/tabler-icons';
import { useMemo, useState } from 'react';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { Panel } from '@/components/member-portal/portal-ui';
import { exportTransactionsCsv } from '@/lib/export-transactions';

export function MemberDocumentsPage() {
  const { dashboard, transactions, state, error, reload, transactionMeta, loadMoreTransactions, loadingMore } = useMemberPortalData();
  const [month, setMonth] = useState('tous');
  const options = useMemo(() => Array.from(new Set(transactions.map((row) => row.date.slice(0, 7)))).sort().reverse(), [transactions]);
  const filtered = transactions.filter((row) => month === 'tous' || row.date.startsWith(month)).map((row) => ({ id: row.id, date: row.date, description: row.description, accountId: 'principal' as const, accountLabel: row.compteType === 'DAT' ? 'Dépôt à terme' : row.compteType === 'CREDIT' ? 'Crédit' : 'Compte principal', kind: row.type === 'remboursement' ? 'Remboursement' as const : row.type === 'retrait' ? 'Retrait' as const : 'Dépôt' as const, amount: row.montant, status: row.statut === 'CANCELLED' || row.statut === 'FAILED' ? 'Rejeté' as const : row.statut === 'PENDING' ? 'En attente' as const : 'Validé' as const, currency: row.devise }));
  return <div className="member-detail-page documents-page">
    <div className="documents-intro"><span className="documents-intro-icon" aria-hidden="true"><IconFileText size={21} /></span><div><h2>Relevés de vos opérations</h2><p>Le fichier exporté contient les opérations réelles retournées par votre espace membre.</p></div></div>
    <Panel title="Documents disponibles" className="documents-panel" action={<span className="documents-count">{transactionMeta?.total ?? 0} opérations</span>}>
      <div className="documents-toolbar"><label className="documents-search">Période <select value={month} onChange={(event) => setMonth(event.target.value)}><option value="tous">Toutes les périodes chargées</option>{options.map((key) => <option key={key} value={key}>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`))}</option>)}</select></label><button type="button" className="document-download" disabled={state !== 'ready' || filtered.length === 0 || Boolean(transactionMeta && transactionMeta.page < transactionMeta.totalPages)} onClick={() => exportTransactionsCsv(filtered, `releve-${dashboard?.profile.numeroCompte ?? 'membre'}.csv`)}><IconDownload size={17} aria-hidden="true" /><span>Télécharger le relevé CSV</span></button></div>
      {state === 'loading' ? <p className="portal-empty-state">Chargement du relevé…</p> : state === 'error' ? <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={reload}>Réessayer</button></div> : <><p className="account-total-meta">{filtered.length} lignes chargées sur {transactionMeta?.total ?? 0} opérations.</p>{error ? <p className="portal-error-state" role="alert">{error}</p> : null}{filtered.length === 0 ? <p className="portal-empty-state">Aucune opération pour cette période.</p> : <div className="documents-list">{filtered.slice(0, 12).map((item) => <article className="document-row" key={item.id}><span className="document-icon" aria-hidden="true"><IconFileText size={19} /></span><div className="document-copy"><h3>{item.description}</h3><p>{item.kind} · {item.currency} · {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(item.date))}</p></div></article>)}</div>}{transactionMeta && transactionMeta.page < transactionMeta.totalPages ? <button type="button" className="document-download" disabled={loadingMore} onClick={() => void loadMoreTransactions()}>{loadingMore ? 'Chargement…' : 'Charger les opérations plus anciennes avant export'}</button> : null}</>}
    </Panel>
  </div>;
}
