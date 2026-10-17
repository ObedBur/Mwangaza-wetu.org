'use client';

import { IconCalendar, IconCheck, IconSpeakerphone } from '@/lib/tabler-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/auth';
import { Panel } from '@/components/member-portal/portal-ui';

interface Notice {
  id: number;
  titre: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function MemberAnnouncementsPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get<{ data: Notice[] }>('/notifications/moi', { params: { page: 1, pageSize: 100 } });
      setNotices(response.data.data);
    } catch {
      setError('Impossible de charger les annonces et notifications.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const visible = useMemo(() => notices.filter((item) => !unreadOnly || !item.isRead), [notices, unreadOnly]);

  async function markAsRead(id: number) {
    try {
      await apiClient.patch(`/notifications/moi/${id}/lire`);
      setNotices((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item));
    } catch {
      setError('La confirmation de lecture n’a pas pu être enregistrée. Réessayez.');
    }
  }

  return <div className="member-detail-page announcements-page">
    <div className="announcements-welcome"><span className="announcements-welcome-icon" aria-hidden="true"><IconSpeakerphone size={22} /></span><div><p className="announcements-eyebrow">La vie de votre coopérative</p><h2>Informations et rendez-vous des membres</h2><p>Annonces et notifications publiées par la coopérative.</p></div></div>
    <Panel title="Annonces et notifications" className="announcements-panel" action={<span className="announcement-unread-count">{notices.filter((item) => !item.isRead).length} non lue(s)</span>}>
      <div className="announcements-toolbar"><label className="unread-toggle"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Non lues seulement</label><button type="button" className="announcement-read-button" onClick={async () => { try { await apiClient.patch('/notifications/moi/tout-lire'); setNotices((items) => items.map((item) => ({ ...item, isRead: true }))); } catch { setError('Impossible de marquer les notifications comme lues.'); } }}>Tout marquer comme lu</button></div>
      {error ? <div className="portal-error-state" role="alert"><span>{error}</span><button onClick={() => void reload()}>Réessayer</button></div> : null}
      {loading ? <p className="portal-empty-state">Chargement des annonces…</p> : visible.length ? <div className="announcements-list">{visible.map((notice) => <article className={`announcement-card${notice.isRead ? '' : ' is-pinned'}`} key={notice.id}><div className="announcement-card-top"><span className="announcement-category">{notice.type}</span>{!notice.isRead ? <span className="announcement-new">Non lue</span> : null}</div><h3>{notice.titre}</h3><span className="announcement-date"><IconCalendar size={15} aria-hidden="true" />{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(notice.createdAt))}</span><p className="announcement-summary">{notice.message}</p>{!notice.isRead ? <button type="button" className="announcement-read-button" onClick={() => void markAsRead(notice.id)}><IconCheck size={15} aria-hidden="true" />Marquer comme lue</button> : null}</article>)}</div> : <p className="portal-empty-state">Aucune notification à afficher.</p>}
    </Panel>
  </div>;
}
