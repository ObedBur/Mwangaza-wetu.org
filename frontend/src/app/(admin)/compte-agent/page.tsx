'use client';

import { useState } from 'react';
import { IconShieldCheck } from '@/lib/tabler-icons';
import { CooperativeBreadcrumb } from '@/components/cooperative/CooperativePrimitives';
import { apiClient } from '@/lib/auth';

export default function AgentAccountPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSaving(true);
    try {
      const response = await apiClient.post<{ message: string }>('/agents/me/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess(response.data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Changement du mot de passe impossible. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="coop-agent-account-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Mon compte" current="Sécurité du compte" />
          <h1>Sécurité du compte</h1>
          <p>Modifiez le mot de passe temporaire reçu lors de la création de votre compte.</p>
        </div>
      </div>
      <section className="coop-agent-password-panel">
        <div className="coop-agent-password-panel-header">
          <span><IconShieldCheck size={20} /></span>
          <div><h2>Changer mon mot de passe</h2><p>Utilisez un mot de passe personnel d’au moins 8 caractères.</p></div>
        </div>
        {success && <p className="coop-agent-password-success" role="status"><IconShieldCheck size={17} />{success}</p>}
        {error && <p className="coop-agent-password-error" role="alert">{error}</p>}
        <form className="coop-agent-password-form" onSubmit={changePassword}>
          <label>Mot de passe actuel<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
          <label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <label>Confirmer le nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
          <div className="coop-agent-password-actions"><button type="submit" className="mw-primary" disabled={saving}>{saving ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}</button></div>
        </form>
      </section>
    </div>
  );
}
