'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/auth';
import { IconHelpCircle } from '@/lib/tabler-icons';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { Panel } from '@/components/member-portal/portal-ui';

type TicketMessage = { id: number; auteurRole: string; message: string; createdAt: string };
type Ticket = { id: number; reference: string; sujet: string; categorie: string; statut: string; updatedAt: string; messages: TicketMessage[] };
type TicketPage = { data: Ticket[]; meta: { total: number } };

const statusLabels: Record<string, string> = { OUVERT: 'Ouverte', EN_COURS: 'En cours', ATTENTE_MEMBRE: 'Votre réponse est attendue', RESOLU: 'Résolue', FERME: 'Fermée' };
const categoryLabels: Record<string, string> = { COMPTE: 'Compte', EPARGNE: 'Épargne', CREDIT: 'Crédit', TECHNIQUE: 'Problème technique', AUTRE: 'Autre' };

export function MemberSupportPage() {
  const { dashboard } = useMemberPortalData();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('AUTRE');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      const response = await apiClient.get<TicketPage>('/support/tickets/mine', { params: { page: 1, pageSize: 50 } });
      setTickets(response.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Impossible de charger vos demandes de support.');
    }
  }, []);
  useEffect(() => { void loadTickets(); }, [loadTickets]);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setFeedback('');
    try {
      const response = await apiClient.post<Ticket>('/support/tickets', { sujet: subject, categorie: category, message });
      setSubject(''); setMessage(''); setCategory('AUTRE');
      setFeedback(`Votre demande ${response.data.reference} a été envoyée.`);
      await loadTickets();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Votre demande n’a pas pu être envoyée. Réessayez.');
    } finally { setBusy(false); }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>, ticketId: number) {
    event.preventDefault(); const text = reply[ticketId]?.trim(); if (!text) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await apiClient.post(`/support/tickets/${ticketId}/messages`, { message: text });
      setReply((current) => ({ ...current, [ticketId]: '' }));
      setFeedback('Votre réponse a été ajoutée à la demande.'); await loadTickets();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Votre réponse n’a pas pu être envoyée.');
    } finally { setBusy(false); }
  }

  return <div className="member-detail-page support-page">
    <div className="support-intro"><span className="support-intro-icon" aria-hidden="true"><IconHelpCircle size={22} /></span><div><p className="support-eyebrow">Assistance coopérative</p><h2>Comment pouvons-nous vous aider ?</h2><p>Envoyez une demande et suivez les réponses depuis cet espace.</p></div></div>
    <div className="support-page-grid">
      <Panel title="Nouvelle demande" className="support-form-panel">
        <form className="support-request-form" onSubmit={submitTicket}>
          <label className="support-field"><span>Sujet</span><input value={subject} onChange={(e) => setSubject(e.target.value)} minLength={4} maxLength={120} required placeholder="Résumez votre demande" /></label>
          <label className="support-field"><span>Thème</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="support-field"><span>Votre message</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} minLength={12} maxLength={3000} required rows={5} placeholder="Décrivez votre question ou le problème rencontré…" /></label>
          {error && <p className="profile-error" role="alert">{error}</p>}{feedback && <p className="support-confirmation" role="status">{feedback}</p>}
          <button className="support-submit-button" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
        </form>
      </Panel>
      <Panel title="Votre dossier" className="support-faq-panel"><p>Votre numéro de membre</p><strong>{dashboard?.profile.numeroCompte ?? 'Chargement…'}</strong><p>Les réponses de l’équipe apparaîtront dans le fil de chaque demande.</p><Link href="/annonces">Consulter les annonces de la coopérative</Link></Panel>
    </div>
    <Panel title={`Mes demandes (${tickets.length})`} className="support-tickets-panel">
      {tickets.length === 0 ? <p className="portal-empty-state">Vous n’avez pas encore de demande. Utilisez le formulaire ci-dessus pour contacter l’équipe.</p> : <div className="support-ticket-list">{tickets.map((ticket) => <article className="support-ticket-card" key={ticket.id}>
        <header className="support-ticket-header"><div><span className="support-ticket-reference">{ticket.reference} · {categoryLabels[ticket.categorie] ?? ticket.categorie}</span><h3>{ticket.sujet}</h3></div><span className="support-ticket-status">{statusLabels[ticket.statut] ?? ticket.statut}</span></header>
        <div className="support-ticket-messages">{ticket.messages.map((item) => <div className={`support-ticket-message ${item.auteurRole === 'member' ? 'is-member' : ''}`} key={item.id}><strong>{item.auteurRole === 'member' ? 'Vous' : 'Équipe support'}</strong><p>{item.message}</p><time>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div>)}</div>
        {ticket.statut !== 'FERME' && ticket.statut !== 'RESOLU' && <form className="support-reply-form" onSubmit={(event) => sendReply(event, ticket.id)}><label className="support-field"><span>Répondre</span><textarea value={reply[ticket.id] ?? ''} onChange={(e) => setReply((current) => ({ ...current, [ticket.id]: e.target.value }))} minLength={2} maxLength={3000} rows={2} required placeholder="Ajouter une précision…" /></label><button className="profile-secondary-button" disabled={busy}>Envoyer</button></form>}
      </article>)}</div>}
    </Panel>
  </div>;
}
