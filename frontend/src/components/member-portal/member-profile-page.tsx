'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiClient, getAuthToken, getAuthUser, logout, setAuthSession } from '@/lib/auth';
import { useMemberPortalData } from '@/components/member-portal/member-data';
import { Panel } from '@/components/member-portal/portal-ui';

export function MemberProfilePage() {
  const { dashboard, state, error, reload } = useMemberPortalData();
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!dashboard) return;
    setTelephone(dashboard.profile.telephone ?? '');
    setEmail(dashboard.profile.email ?? '');
    setAdresse(dashboard.profile.adresse ?? '');
  }, [dashboard]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(''); setFormError('');
    try {
      const response = await apiClient.patch('/membres/me/profil', { telephone, email: email || null, adresse: adresse || null });
      const token = getAuthToken(); const user = getAuthUser();
      if (token && user && response.data.email !== undefined) setAuthSession(token, { ...user, email: response.data.email });
      setFeedback('Vos coordonnées ont été mises à jour.'); reload();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'La mise à jour a échoué. Vérifiez les informations et réessayez.');
    } finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(''); setFormError('');
    if (newPassword.length < 8) { setFormError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); setBusy(false); return; }
    if (newPassword !== confirmation) { setFormError('La confirmation ne correspond pas au nouveau mot de passe.'); setBusy(false); return; }
    try {
      await apiClient.post('/auth/me/mot-de-passe', { currentPassword, newPassword });
      setFeedback('Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.');
      window.setTimeout(() => logout(), 1200);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Impossible de modifier le mot de passe. Vérifiez le mot de passe actuel.');
      setBusy(false);
    }
  }

  if (!dashboard && state === 'loading') return <div className="member-detail-page"><p className="portal-empty-state">Chargement du profil…</p></div>;
  if (!dashboard) return <div className="member-detail-page"><div className="portal-error-state" role="alert"><span>{error || 'Impossible de charger le profil.'}</span><button onClick={reload}>Réessayer</button></div></div>;
  const profile = dashboard.profile;
  const initials = profile.nomComplet.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <div className="member-detail-page profile-page">
    <div className="profile-identity-banner"><span className="profile-avatar" aria-hidden="true">{initials}</span><div><h2>{profile.nomComplet}</h2><p>Membre · {profile.numeroCompte}</p></div><span className="profile-status">{profile.statut}</span></div>
    <div className="profile-page-grid">
      <Panel title="Coordonnées personnelles" className="profile-form-panel">
        <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-fields-grid">
            <label className="profile-field"><span>Nom complet</span><input value={profile.nomComplet} readOnly /></label>
            <label className="profile-field"><span>Numéro de membre</span><input value={profile.numeroCompte} readOnly /></label>
            <label className="profile-field"><span>Téléphone</span><input type="tel" autoComplete="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} required minLength={8} maxLength={20} /></label>
            <label className="profile-field"><span>Adresse e-mail</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="profile-field profile-field-wide"><span>Adresse</span><input autoComplete="street-address" value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={200} /></label>
            <label className="profile-field"><span>Section</span><input value={profile.typeCompte} readOnly /></label>
            <label className="profile-field"><span>Date d’adhésion</span><input value={new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(profile.dateAdhesion))} readOnly /></label>
          </div>
          <p className="account-total-meta">Le nom et le numéro de membre sont gérés par la coopérative. Pour les corriger, contactez votre agence.</p>
          {formError && <p className="profile-error" role="alert">{formError}</p>}{feedback && <p className="profile-feedback" role="status">{feedback}</p>}
          <button className="profile-primary-button" disabled={busy} type="submit">{busy ? 'Enregistrement…' : 'Enregistrer les coordonnées'}</button>
        </form>
      </Panel>
      <Panel title="Changer le mot de passe" className="security-panel">
        <form className="profile-form" onSubmit={changePassword}>
          <p className="account-total-meta">Choisissez un mot de passe d’au moins 8 caractères. Après modification, votre session sera fermée sur vos appareils.</p>
          <label className="profile-field"><span>Mot de passe actuel</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label>
          <label className="profile-field"><span>Nouveau mot de passe</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></label>
          <label className="profile-field"><span>Confirmer le nouveau mot de passe</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} minLength={8} required /></label>
          <button className="profile-primary-button" disabled={busy} type="submit">{busy ? 'Modification…' : 'Modifier le mot de passe'}</button>
        </form>
      </Panel>
    </div>
  </div>;
}
