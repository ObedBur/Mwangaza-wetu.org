'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconPencil,
  IconPlus,
  IconSearch,
  IconX,
  IconUsers,
  IconFingerprint,
} from '@tabler/icons-react';
import { CooperativeBreadcrumb } from '@/components/cooperative/CooperativePrimitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient, getAuthUser } from '@/lib/auth';

type Agent = {
  id: number;
  nom: string;
  email: string;
  telephone: string;
  guichetAssigne: string;
  soldeInitial: number | string;
  devise: 'USD' | 'FC';
  actif: boolean;
  userId: string | null;
  dateNaissance: string | null;
  numeroCarteElecteur: string | null;
  imageCarteElecteur: string | null;
  createdAt: string;
};

type AgentsResponse = { data: Agent[]; meta: { total: number } };
type AgentDraft = {
  nom: string;
  email: string;
  telephone: string;
  guichetAssigne: string;
  soldeInitial: string;
  devise: 'USD' | 'FC';
  actif: boolean;
  dateNaissance: string;
  numeroCarteElecteur: string;
};

const emptyDraft: AgentDraft = {
  nom: '', email: '', telephone: '', guichetAssigne: '',
  soldeInitial: '0', devise: 'USD', actif: true, dateNaissance: '', numeroCarteElecteur: '',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [fingerprintId, setFingerprintId] = useState('');
  const [capturingFingerprint, setCapturingFingerprint] = useState(false);
  const [fingerprintError, setFingerprintError] = useState('');
  const [newAgentCredentials, setNewAgentCredentials] = useState<{ nom: string; email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [cardImage, setCardImage] = useState('');
  const user = getAuthUser();
  const canDelete = user?.role === 'superadmin';

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<AgentsResponse>('/agents', {
        params: { page: 1, pageSize: 100 },
      });
      setAgents(response.data.data);
      setLoadError('');
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || 'Impossible de charger les agents. Vérifiez votre session et la connexion au backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const visibleAgents = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr-FR');
    if (!term) return agents;
    return agents.filter((agent) =>
      `${agent.nom} ${agent.email} ${agent.telephone} ${agent.guichetAssigne}`
        .toLocaleLowerCase('fr-FR').includes(term),
    );
  }, [agents, query]);

  const activeCount = agents.filter((agent) => agent.actif).length;

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setFormError('');
    setFingerprintId('');
    setFingerprintError('');
    setCardImage('');
    setDialogOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setDraft({
      nom: agent.nom,
      email: agent.email,
      telephone: agent.telephone,
      guichetAssigne: agent.guichetAssigne,
      soldeInitial: String(agent.soldeInitial),
      devise: agent.devise,
      actif: agent.actif,
      dateNaissance: agent.dateNaissance ? agent.dateNaissance.slice(0, 10) : '',
      numeroCarteElecteur: agent.numeroCarteElecteur || '',
    });
    setFormError('');
    setFingerprintId(agent.userId || '');
    setFingerprintError('');
    setCardImage(agent.imageCarteElecteur || '');
    setDialogOpen(true);
  }

  async function captureAgentFingerprint() {
    setCapturingFingerprint(true);
    setFingerprintError('');
    setFingerprintId('');
    try {
      const capture = await apiClient.post<{ userId: string }>('/zkteco/capture-fingerprint');
      const userId = String(capture.data.userId || '').trim();
      if (!userId) throw new Error('Le lecteur n’a renvoyé aucun identifiant.');
      const check = await apiClient.get<{ exists: boolean; where: string | null }>(
        `/agents/check-userid/${encodeURIComponent(userId)}`,
      );
      if (check.data.exists && userId !== editing?.userId) {
        setFingerprintError(`Empreinte déjà utilisée par ${check.data.where || 'un autre compte'} (ID ${userId}).`);
        return;
      }
      setFingerprintId(userId);
    } catch (error: any) {
      const message = error?.response?.data?.message;
      const details = error?.response?.data?.details;
      setFingerprintError([Array.isArray(message) ? message.join(' ') : message, details].filter(Boolean).join(' ') || 'Capture impossible. Vérifiez la connexion au lecteur et au backend.');
    } finally {
      setCapturingFingerprint(false);
    }
  }

  async function saveAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload: Record<string, unknown> = {
      nom: draft.nom.trim(),
      email: draft.email.trim().toLowerCase(),
      telephone: draft.telephone.trim(),
      guichetAssigne: draft.guichetAssigne.trim(),
      soldeInitial: Number(draft.soldeInitial),
      devise: draft.devise,
      actif: draft.actif,
      userId: fingerprintId || null,
      dateNaissance: draft.dateNaissance || null,
      numeroCarteElecteur: draft.numeroCarteElecteur.trim() || null,
      ...(cardImage.startsWith('data:image/')
        ? { imageCarteElecteur: cardImage }
        : editing?.imageCarteElecteur && !cardImage
          ? { imageCarteElecteur: '' }
          : {}),
    };
    try {
      if (editing) {
        await apiClient.patch(`/agents/${editing.id}`, payload);
        setNotice('Agent modifié avec succès.');
      } else {
        const response = await apiClient.post<Agent & { motDePasseTemporaire: string }>('/agents', payload);
        setNewAgentCredentials({ nom: draft.nom.trim(), email: draft.email.trim(), password: response.data.motDePasseTemporaire });
        setCopiedPassword(false);
      }
      setDialogOpen(false);
      await loadAgents();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setFormError(Array.isArray(message) ? message.join(' ') : message || 'Enregistrement impossible. Vérifiez les informations.');
    } finally {
      setSaving(false);
    }
  }

  function readVoterCardImage(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('Choisissez une image JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('L’image de la carte ne doit pas dépasser 5 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCardImage(String(reader.result || ''));
      setFormError('');
    };
    reader.onerror = () => setFormError('Impossible de lire ce fichier image.');
    reader.readAsDataURL(file);
  }

  async function removeAgent(agent: Agent) {
    if (!window.confirm(`Supprimer définitivement l’agent ${agent.nom} ?`)) return;
    setNotice('');
    try {
      await apiClient.delete(`/agents/${agent.id}`);
      setNotice(`Agent ${agent.nom} supprimé.`);
      await loadAgents();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setLoadError(Array.isArray(message) ? message.join(' ') : message || 'Suppression impossible.');
    }
  }

  async function toggleAgent(agent: Agent) {
    try {
      await apiClient.patch(`/agents/${agent.id}`, { actif: !agent.actif });
      setNotice(agent.actif ? 'Agent désactivé.' : 'Agent activé.');
      await loadAgents();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setLoadError(Array.isArray(message) ? message.join(' ') : message || 'Modification du statut impossible.');
    }
  }

  return (
    <div className="coop-agents-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Administration" current="Agents" />
          <h1>Gestion des agents</h1>
          <p>Ajoutez les agents de guichet, mettez à jour leurs accès et suivez leur statut.</p>
        </div>
        <div className="coop-page-actions">
          <button type="button" className="mw-primary" onClick={openCreate}><IconPlus /> Nouvel agent</button>
        </div>
      </div>

      {notice && <p className="coop-agents-notice" role="status">{notice}</p>}
      {loadError && <p className="coop-page-error" role="alert">{loadError}</p>}

      <div className="coop-stat-grid coop-agents-stats">
        <article className="coop-stat-card"><div className="coop-stat-card-top"><span>Total agents</span><span className="coop-stat-icon"><IconUsers /></span></div><strong>{agents.length}</strong><div className="coop-stat-detail">Comptes enregistrés</div></article>
        <article className="coop-stat-card"><div className="coop-stat-card-top"><span>Agents actifs</span><span className="coop-stat-icon">✓</span></div><strong>{activeCount}</strong><div className="coop-stat-detail">Accès autorisé</div></article>
        <article className="coop-stat-card"><div className="coop-stat-card-top"><span>Agents désactivés</span><span className="coop-stat-icon">–</span></div><strong>{agents.length - activeCount}</strong><div className="coop-stat-detail">Accès suspendu</div></article>
      </div>

      <section className="coop-panel coop-agents-panel">
        <div className="coop-filter-bar">
          <label className="coop-filter-search"><IconSearch aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par nom, e-mail, téléphone ou guichet" aria-label="Rechercher un agent" /></label>
          <span className="coop-panel-count">{visibleAgents.length} agent{visibleAgents.length === 1 ? '' : 's'}</span>
        </div>
        <div className="coop-table-scroll">
          <table className="mw-table coop-agents-table">
            <thead><tr><th>Agent</th><th>Contact</th><th>Guichet assigné</th><th>Solde initial</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="coop-agents-empty">Chargement des agents…</td></tr> : visibleAgents.length === 0 ? <tr><td colSpan={6} className="coop-agents-empty">Aucun agent trouvé.</td></tr> : visibleAgents.map((agent) => (
                <tr key={agent.id}>
                  <td><strong>{agent.nom}</strong><small>{agent.email}</small></td>
                  <td>{agent.telephone}</td>
                  <td>{agent.guichetAssigne}</td>
                  <td>{Number(agent.soldeInitial).toLocaleString('fr-FR')} {agent.devise}</td>
                  <td><button type="button" className={`coop-status ${agent.actif ? 'coop-status--valid' : 'coop-status--rejected'} coop-agent-status-button`} onClick={() => void toggleAgent(agent)} title="Cliquer pour changer le statut">{agent.actif ? 'Actif' : 'Désactivé'}</button></td>
                  <td><div className="coop-agent-actions"><button type="button" className="mw-icon-button" aria-label={`Modifier ${agent.nom}`} title="Modifier" onClick={() => openEdit(agent)}><IconPencil size={16} /></button>{canDelete && <button type="button" className="mw-icon-button coop-agent-delete" aria-label={`Supprimer ${agent.nom}`} title="Supprimer" onClick={() => void removeAgent(agent)}><IconX size={16} /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="coop-agent-dialog">
          <DialogHeader className="coop-agent-dialog-header">
            <span className="coop-agent-dialog-icon"><IconUsers size={21} /></span>
            <div className="coop-agent-dialog-title-wrap">
              <span className="coop-agent-eyebrow">ADMINISTRATION · ÉQUIPE</span>
              <DialogTitle>{editing ? 'Modifier l’agent' : 'Nouvel agent'}</DialogTitle>
              <DialogDescription>{editing ? 'Mettez à jour ses coordonnées et ses droits d’accès.' : 'Créez un accès sécurisé pour un agent de guichet.'}</DialogDescription>
            </div>
          </DialogHeader>
          <form className="coop-agent-form" onSubmit={saveAgent}>
            <section className="coop-agent-form-section">
              <div className="coop-agent-section-title"><span>01</span><div><strong>Informations personnelles</strong><small>Identité et coordonnées professionnelles</small></div></div>
              <div className="coop-agent-field-grid">
                <label>Nom complet <b>*</b><input required minLength={2} autoComplete="name" placeholder="Ex. Aline Mukendi" value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} /></label>
                <label>E-mail professionnel <b>*</b><input required type="email" autoComplete="email" placeholder="nom@exemple.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
                <label>Téléphone <b>*</b><input required type="tel" autoComplete="tel" placeholder="+243 …" value={draft.telephone} onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} /></label>
                <label>Guichet assigné <b>*</b><input required placeholder="Ex. Guichet 1" value={draft.guichetAssigne} onChange={(e) => setDraft({ ...draft, guichetAssigne: e.target.value })} /></label>
                <label>Date de naissance<input type="date" max={new Date().toISOString().slice(0, 10)} value={draft.dateNaissance} onChange={(e) => setDraft({ ...draft, dateNaissance: e.target.value })} />{draft.dateNaissance && <small>Âge : {Math.max(0, Math.floor((Date.now() - new Date(`${draft.dateNaissance}T00:00:00`).getTime()) / 31_557_600_000))} ans</small>}</label>
                <label>Numéro de carte d’électeur<input autoComplete="off" placeholder="Numéro inscrit sur la carte" value={draft.numeroCarteElecteur} onChange={(e) => setDraft({ ...draft, numeroCarteElecteur: e.target.value })} /></label>
                <label className="coop-agent-card-upload">Image de la carte d’électeur
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => readVoterCardImage(e.target.files?.[0])} />
                  <small>JPG, PNG ou WebP · 5 Mo maximum. L’image est facultative.</small>
                  {cardImage && <span className="coop-agent-card-preview"><img src={cardImage} alt="Aperçu de la carte d’électeur" /><button type="button" onClick={() => setCardImage('')}>Retirer l’image</button></span>}
                </label>
              </div>
            </section>

            <section className="coop-agent-form-section coop-agent-funds-section">
              <div className="coop-agent-section-title"><span>02</span><div><strong>Paramètres de caisse</strong><small>Solde de départ et devise du guichet</small></div></div>
              <div className="coop-agent-field-grid coop-agent-field-grid--funds">
                <label>Solde initial<input required type="number" min="0" step="0.01" value={draft.soldeInitial} onChange={(e) => setDraft({ ...draft, soldeInitial: e.target.value })} /></label>
                <label>Devise<select value={draft.devise} onChange={(e) => setDraft({ ...draft, devise: e.target.value as 'USD' | 'FC' })}><option value="USD">USD — Dollar américain</option><option value="FC">FC — Franc congolais</option></select></label>
              </div>
            </section>

            <section className="coop-agent-form-section coop-agent-access-section">
              <div className="coop-agent-section-title"><span>03</span><div><strong>Accès au compte</strong><small>{editing ? 'Vérifiez l’identifiant biométrique et l’état du compte.' : 'Un mot de passe temporaire sera généré automatiquement et affiché après la création.'}</small></div></div>
              {!editing && <p className="coop-agent-auto-password-note">Le mot de passe sera affiché une seule fois après la création. L’agent pourra ensuite le modifier depuis son espace.</p>}
              <div className="coop-agent-fingerprint-field">
                <span>Empreinte digitale <small>(facultative)</small></span>
                <button type="button" className={`coop-agent-capture-button${fingerprintId ? ' is-captured' : ''}`} onClick={() => void captureAgentFingerprint()} disabled={capturingFingerprint}>
                  <IconFingerprint size={17} />{capturingFingerprint ? 'Placez le doigt sur le lecteur…' : fingerprintId ? 'Capturer à nouveau' : 'Capturer l’empreinte'}
                </button>
                {fingerprintId ? <p className="coop-agent-fingerprint-success" role="status">✓ Empreinte capturée · ID {fingerprintId}</p> : fingerprintError ? <p className="coop-agent-fingerprint-error" role="alert">✕ {fingerprintError}</p> : <p>L’identifiant biométrique sera associé à cet agent.</p>}
              </div>
            </section>
            {editing && <section className="coop-agent-form-section coop-agent-access-section"><div className="coop-agent-section-title"><span>03</span><div><strong>Accès au compte</strong><small>L’agent pourra changer son mot de passe depuis son compte.</small></div></div><label className="coop-agent-checkbox"><input type="checkbox" checked={draft.actif} onChange={(e) => setDraft({ ...draft, actif: e.target.checked })} /> <span><strong>Compte actif</strong><small>L’agent peut se connecter et utiliser son guichet.</small></span></label></section>}
            {formError && <p className="coop-agents-form-error" role="alert">{formError}</p>}
            <div className="coop-agent-dialog-actions"><span className="coop-agent-required-note"><b>*</b> Champs obligatoires</span><button type="button" className="mw-dialog-cancel" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</button><button type="submit" className="mw-primary" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les changements' : 'Créer l’agent'}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(newAgentCredentials)} onOpenChange={(open) => { if (!open) setNewAgentCredentials(null); }}>
        <DialogContent className="coop-agent-credentials-dialog">
          <DialogHeader>
            <span className="coop-agent-credentials-icon"><IconUsers size={22} /></span>
            <DialogTitle>Agent créé avec succès</DialogTitle>
            <DialogDescription>Remettez ces identifiants à {newAgentCredentials?.nom}. Le mot de passe ne sera plus affiché après la fermeture.</DialogDescription>
          </DialogHeader>
          <div className="coop-agent-credentials-box">
            <span>Adresse e-mail</span><strong>{newAgentCredentials?.email}</strong>
            <span>Mot de passe temporaire</span><code>{newAgentCredentials?.password}</code>
          </div>
          <p className="coop-agent-credentials-warning">Conservez-le de façon sécurisée. L’agent pourra le remplacer depuis « Sécurité du compte » après sa connexion.</p>
          <div className="coop-agent-dialog-actions"><button type="button" className="mw-dialog-cancel" onClick={() => setNewAgentCredentials(null)}>Fermer</button><button type="button" className="mw-primary" onClick={async () => { if (!newAgentCredentials) return; await navigator.clipboard.writeText(`E-mail : ${newAgentCredentials.email}\nMot de passe temporaire : ${newAgentCredentials.password}`); setCopiedPassword(true); }}>{copiedPassword ? 'Copié' : 'Copier les identifiants'}</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
