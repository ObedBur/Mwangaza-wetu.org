'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconCamera, IconFingerprint, IconPlus, IconUserCircle, IconUsers } from '@tabler/icons-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/auth';
import { parseApiError } from '@/lib/api-error';

type DelegateDraft = {
  name: string;
  phone: string;
  relation: string;
  nationalId: string;
  userId?: string;
};

const accountTypes = [
  { value: 'PRINCIPAL', code: 'P', label: 'principal' },
  { value: 'KELASI', code: 'K', label: 'kelasi' },
  { value: 'NYUMBA', code: 'N', label: 'nyumba' },
  { value: 'HOPITAL', code: 'H', label: 'hopital' },
  { value: 'MUTOTO', code: 'M', label: 'mutoto' },
  { value: 'BIASHARA', code: 'B', label: 'biashara' },
] as const;

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type CreatedMemberCredentials = {
  numeroCompte: string;
  nomComplet: string;
  email: string;
  motDePasseTemporaire: string;
  credentialsSent: boolean;
};

export function MemberCredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: CreatedMemberCredentials | null;
  onClose: () => void;
}) {
  const [copiedCredentials, setCopiedCredentials] = useState<CreatedMemberCredentials | null>(null);
  const copied = Boolean(credentials && copiedCredentials === credentials);
  return (
    <Dialog open={Boolean(credentials)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="coop-agent-credentials-dialog">
        <DialogHeader>
          <span className="coop-agent-credentials-icon"><IconUsers size={22} /></span>
          <DialogTitle>Membre créé avec succès</DialogTitle>
          <DialogDescription>Remettez ces identifiants à {credentials?.nomComplet}. Le mot de passe ne sera plus affiché après la fermeture.</DialogDescription>
        </DialogHeader>
        <div className="coop-agent-credentials-box">
          <span>Numéro de compte</span><strong>{credentials?.numeroCompte}</strong>
          <span>Adresse e-mail</span><strong>{credentials?.email}</strong>
          <span>Mot de passe temporaire</span><code>{credentials?.motDePasseTemporaire}</code>
        </div>
        <p className="coop-agent-credentials-warning">
          {credentials?.credentialsSent
            ? 'Un e-mail contenant les identifiants a été envoyé au membre. Il devra changer son mot de passe après sa première connexion.'
            : 'L’e-mail n’a pas pu être envoyé. Remettez ces identifiants au membre de façon sécurisée ; il devra changer son mot de passe après sa première connexion.'}
        </p>
        <div className="coop-agent-dialog-actions">
          <button type="button" className="mw-dialog-cancel" onClick={onClose}>Fermer</button>
          <button type="button" className="mw-primary" onClick={async () => {
            if (!credentials) return;
            try {
              await navigator.clipboard.writeText(`Numéro de compte : ${credentials.numeroCompte}\nE-mail : ${credentials.email}\nMot de passe temporaire : ${credentials.motDePasseTemporaire}`);
              setCopiedCredentials(credentials);
            } catch {
              setCopiedCredentials(null);
            }
          }}>{copied ? 'Identifiants copiés' : 'Copier les identifiants'}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const memberEnrollmentFrenchCopy: Record<string, string> = {
  cancel: 'Annuler', save: 'Enregistrer', newMemberHeading: 'Nouveau Membre', requiredFields: 'Complétez tous les champs requis',
  accountTypeTitle: 'Type de Compte', chooseAccountType: 'Sélectionnez le type de compte', principal: 'PRINCIPAL', kelasi: 'KELASI', nyumba: 'NYUMBA', hopital: 'HOPITAL', mutoto: 'MUTOTO', biashara: 'BIASHARA',
  assignedAccount: 'Numéro de compte attribué', accountNumberHelp: 'Ce numéro est généré automatiquement avec un code de section et un identifiant aléatoire.', refreshAccountNumber: 'Régénérer', accountNumberLoading: 'Génération du numéro…', accountNumberUnavailable: 'Aperçu indisponible',
  fieldRequiredError: 'Ce champ est obligatoire.', nameFieldError: 'Saisissez au moins 2 caractères.', phoneFieldError: 'Saisissez un numéro valide (au moins 7 chiffres).', emailFieldError: 'Saisissez une adresse e-mail valide.', selectFieldError: 'Sélectionnez une option.', dateFieldError: 'Saisissez une date valide.', nationalIdFieldError: 'Saisissez au moins 4 caractères pour la pièce d’identité.', formInvalidNotice: 'Complétez les champs en rouge pour activer la création.',
  memberIdentity: 'Identité du Membre', photoMember: 'Photo Membre', changePhoto: 'Clic pour changer', fullName: 'Nom complet', requiredPhone: 'Téléphone', emailAddress: 'Adresse e-mail', emailCredentialNotice: 'Un mot de passe temporaire sera envoyé à cette adresse.', sex: 'Sexe', selectSex: 'Sélectionner', male: 'Masculin', female: 'Féminin', sexOther: 'Autre', joinDate: 'Date d’adhésion', contactsMore: 'Coordonnées & Plus', address: 'Adresse physique', addressPlaceholder: 'Bâtiment, Rue, Quartier, Ville', nationalId: 'ID Nationale / Pièce ID', moreOptions: '+ Plus d’options (Naissance)', birthDate: 'Date de naissance', bioFees: 'Biométrie & Frais', membershipFee: 'Frais d’Adhésion', adhesionDuration: 'Durée de couverture', paymentCurrency: 'Devise de paiement', datPreview: 'Barème DAT (aperçu)', datMonths: 'mois', datMinimum: 'Minimum DAT pour', datPreviewHint: 'Choix définitif après le premier dépôt, à l’ouverture du DAT.', datBaremeLoading: 'Chargement du barème…', datBaremeError: 'Barème DAT indisponible. Réessayez plus tard.', feeNote: 'Choisissez la période couverte et la devise encaissée. Taux de référence : 2 500 FC pour 1 USD.',
  delegateOptional: 'Délégué (Optionnel)', addDelegate: 'Ajouter un délégué autorisé', editDelegate: 'Modifier le délégué', delegateName: 'Nom complet du délégué', delegatePhone: 'Téléphone du délégué', delegateRelation: 'Lien avec le membre', delegateNationalId: 'ID Nationale / Pièce ID', delegateFingerprint: 'Empreinte du délégué', captureFingerprint: 'Capturer l’empreinte', recaptureFingerprint: 'Capturer à nouveau', fingerprintReady: 'Empreinte capturée', fingerprintChecking: 'Vérification de l’identifiant…', fingerprintAvailable: 'Empreinte disponible pour ce membre.', fingerprintAlreadyUsed: 'Cet identifiant biométrique est déjà utilisé.', fingerprintReadStarted: 'Placez le doigt sur le lecteur. La capture peut prendre quelques secondes.', fingerprintApiUnavailable: 'Le serveur backend ne répond pas. Vérifiez qu’il est démarré, NEXT_PUBLIC_API_URL pointe vers son adresse /api et CORS autorise cette page.', fingerprintHint: 'Capture facultative via le lecteur biométrique connecté.', fingerprintWaiting: 'En attente du doigt sur le lecteur…', fingerprintUnavailable: 'Capture impossible. Vérifiez que le lecteur est connecté, puis réessayez.', memberFingerprint: 'Empreinte du membre', memberFingerprintHint: 'Les dépôts sont possibles sans lecteur. L’empreinte devra être enregistrée au bureau avant tout retrait.', memberActivity: 'Activité principale', memberActivityPlaceholder: 'Ex. Agriculture, commerce, élevage', createFailed: 'La création du membre a échoué. Vérifiez les informations et réessayez.', creatingMember: 'Création en cours…', createMember: 'Créer le membre',
};
export function MemberEnrollmentDialog({
  open,
  onOpenChange,
  dark,
  t,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  t: Record<string, string>;
  onCreated: (credentials: { numeroCompte: string; nomComplet: string; email: string; motDePasseTemporaire: string; credentialsSent: boolean }) => void;
}) {
  const [accountType, setAccountType] = useState("PRINCIPAL");
  const [adhesionMonths, setAdhesionMonths] = useState(1);
  const [savingsMonths, setSavingsMonths] = useState(1);
  const [adhesionCurrency, setAdhesionCurrency] = useState<'FC' | 'USD'>('FC');
  const [generatedAccountNumber, setGeneratedAccountNumber] = useState("");
  const [generatingAccountNumber, setGeneratingAccountNumber] = useState(false);
  const [accountNumberError, setAccountNumberError] = useState("");
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegate, setDelegate] = useState<DelegateDraft | null>(null);
  const [capturedDelegateUserId, setCapturedDelegateUserId] = useState("");
  const [capturingDelegateFingerprint, setCapturingDelegateFingerprint] = useState(false);
  const [delegateFingerprintError, setDelegateFingerprintError] = useState("");
  const [memberPhoto, setMemberPhoto] = useState<string | null>(null);
  const [memberPhotoData, setMemberPhotoData] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [capturingMemberFingerprint, setCapturingMemberFingerprint] = useState(false);
  const [memberFingerprintError, setMemberFingerprintError] = useState("");
  const [creatingMember, setCreatingMember] = useState(false);
  const [createError, setCreateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [memberFormValid, setMemberFormValid] = useState(false);
  const memberFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (memberPhoto) return () => URL.revokeObjectURL(memberPhoto);
  }, [memberPhoto]);

  // Réinitialisation du formulaire quand la modale se ferme — ajustement
  // d'état pendant le rendu (pattern React, pas d'effet setState)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setAccountType("PRINCIPAL");
      setGeneratedAccountNumber("");
      setGeneratingAccountNumber(false);
      setAccountNumberError("");
      setDelegate(null);
      setCapturedDelegateUserId("");
      setDelegateFingerprintError("");
      setMemberPhoto(null);
      setMemberPhotoData("");
      setMemberUserId("");
      setMemberFingerprintError("");
      setCreateError("");
      setFieldErrors({});
      setTouchedFields({});
      setMemberFormValid(false);
    }
  }

  const refreshAccountNumber = useCallback(async () => {
    setGeneratingAccountNumber(true);
    setAccountNumberError("");
    setGeneratedAccountNumber("");
    try {
      const response = await apiClient.get<{ numero: string }>("/membres/generate-numero", {
        params: { section: accountType },
      });
      setGeneratedAccountNumber(response.data.numero);
    } catch (error: unknown) {
      const { userMessage } = parseApiError(error, t.accountNumberUnavailable);
      setAccountNumberError(userMessage);
    } finally {
      setGeneratingAccountNumber(false);
    }
  }, [accountType, t.accountNumberUnavailable]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refreshAccountNumber();
    });
    return () => { active = false; };
  }, [open, refreshAccountNumber]);

  function validateMemberForm(form: HTMLFormElement, touchAll = false, touchedName?: string) {
    const nextErrors: Record<string, string> = {};
    const nextTouched = { ...touchedFields };
    const requiredNames = ["memberName", "memberPhone", "memberEmail", "memberSex", "joinDate"];
    const fields = Array.from(form.elements).filter(
      (element): element is HTMLInputElement | HTMLSelectElement =>
        (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
        element.name !== "" && element.type !== "file",
    );

    for (const field of fields) {
      const value = field.value.trim();
      const required = requiredNames.includes(field.name);
      if (touchAll || field.name === touchedName || field === form.ownerDocument.activeElement) nextTouched[field.name] = true;
      if (!value && !required) continue;

      let error = "";
      if (!value && required) error = t.fieldRequiredError;
      else if (field.name === "memberName" && value.length < 2) error = t.nameFieldError;
      else if (field.name === "memberPhone" && (value.replace(/\D/g, "").length < 7 || !/^[+\d\s().-]+$/.test(value))) error = t.phoneFieldError;
      else if (field.name === "memberEmail" && !(field as HTMLInputElement).validity.valid) error = t.emailFieldError;
      else if (field.name === "memberSex" && !value) error = t.selectFieldError;
      else if ((field.name === "joinDate" || field.name === "birthDate") && value && Number.isNaN(Date.parse(value))) error = t.dateFieldError;
      else if (field.name === "nationalId" && value.length < 4) error = t.nationalIdFieldError;
      if (error) nextErrors[field.name] = error;
    }

    setFieldErrors(nextErrors);
    setTouchedFields(nextTouched);
    const requiredValid = requiredNames.every((name) => {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      return Boolean(field?.value.trim()) && !nextErrors[name];
    });
    setMemberFormValid(
      requiredValid &&
      !Object.keys(nextErrors).length &&
      Boolean(generatedAccountNumber) &&
      !creatingMember,
    );
    return requiredValid && !Object.keys(nextErrors).length;
  }

  function fieldState(name: string) {
    if (!touchedFields[name]) return "";
    return fieldErrors[name] ? " has-error" : " is-valid";
  }

  function fieldFeedback(name: string) {
    if (!touchedFields[name]) return null;
    return fieldErrors[name]
      ? <small className="mw-field-feedback is-error" role="alert">{fieldErrors[name]}</small>
      : <small className="mw-field-feedback is-valid">✓ Correct</small>;
  }

  function saveDelegate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDelegate({
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      relation: String(data.get("relation") || "").trim(),
      nationalId: String(data.get("nationalId") || "").trim(),
      userId: capturedDelegateUserId || undefined,
    });
    setDelegateOpen(false);
  }

  async function captureDelegateFingerprint() {
    setCapturingDelegateFingerprint(true);
    setDelegateFingerprintError("");
    setCapturedDelegateUserId("");
    try {
      const response = await apiClient.post<{ userId: string }>("/zkteco/capture-fingerprint");
      setCapturedDelegateUserId(response.data.userId);
    } catch (error: unknown) {
      const { userMessage } = parseApiError(error, t.fingerprintUnavailable);
      setDelegateFingerprintError(userMessage);
    } finally {
      setCapturingDelegateFingerprint(false);
    }
  }

  async function captureMemberFingerprint() {
    setCapturingMemberFingerprint(true);
    setMemberFingerprintError("");
    setMemberUserId("");
    try {
      const response = await apiClient.post<{ userId: string }>("/zkteco/capture-fingerprint");
      const userId = String(response.data.userId || "").trim();
      if (!userId) throw new Error(t.fingerprintUnavailable);
      const check = await apiClient.get<{ exists: boolean; where: string | null }>(
        `/membres/check-userid/${encodeURIComponent(userId)}`,
      );
      if (check.data.exists) {
        setMemberFingerprintError(`${t.fingerprintAlreadyUsed} ID ${userId} (${check.data.where || "autre profil"}).`);
        return;
      }
      setMemberUserId(userId);
    } catch (error: unknown) {
      const { userMessage, networkError } = parseApiError(error, t.fingerprintUnavailable);
      const readableMessage = networkError
        ? `${t.fingerprintApiUnavailable} (${apiClient.defaults.baseURL || "API URL non définie"})`
        : userMessage;
      setMemberFingerprintError(readableMessage);
    } finally {
      setCapturingMemberFingerprint(false);
    }
  }

  async function createMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateMemberForm(event.currentTarget, true)) {
      event.currentTarget.querySelector<HTMLElement>(".has-error input, .has-error select")?.focus();
      return;
    }
    setCreatingMember(true);
    setCreateError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      numeroCompte: generatedAccountNumber || undefined,
      nomComplet: String(data.get("memberName") || "").trim(),
      telephone: String(data.get("memberPhone") || "").trim(),
      email: String(data.get("memberEmail") || "").trim(),
      sexe: String(data.get("memberSex") || ""),
      dateAdhesion: String(data.get("joinDate") || ""),
      dureeAdhesionMois: adhesionMonths,
      dureeEpargneMois: savingsMonths,
      deviseAdhesion: adhesionCurrency,
      typeCompte: accountType,
      statut: "actif",
      adresse: String(data.get("address") || "").trim() || undefined,
      activite: String(data.get("activity") || "").trim() || undefined,
      idNationale: String(data.get("nationalId") || "").trim() || undefined,
      dateNaissance: String(data.get("birthDate") || "") || undefined,
      photoProfil: memberPhotoData || undefined,
      userId: memberUserId || undefined,
      delegue: delegate
        ? {
          nom: delegate.name,
          telephone: delegate.phone,
          relation: delegate.relation,
          pieceIdentite: delegate.nationalId || undefined,
          userId: delegate.userId,
        }
        : undefined,
    };

    try {
      const response = await apiClient.post<{
        numeroCompte: string;
        nomComplet: string;
        email: string;
        motDePasseTemporaire: string;
        credentialsSent: boolean;
      }>("/membres", payload);
      onCreated(response.data);
      onOpenChange(false);
    } catch (error: unknown) {
      const { userMessage, technicalDetails } = parseApiError(error, t.createFailed);
      setCreateError(userMessage);
      if (technicalDetails) {
        console.error("[MemberEnrollmentDialog] Échec création membre:", technicalDetails);
      }
    } finally {
      setCreatingMember(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content mw-member-dialog-content !gap-0 !rounded-[8px] !border-[var(--mw-line)] !bg-[var(--mw-paper)] !p-0 !text-[var(--mw-ink)] sm:!max-w-[920px]"
        >
          <DialogHeader className="mw-member-dialog-header !space-y-0 !text-left">
            <div>
              <DialogTitle className="mw-member-dialog-title">
                {t.newMemberHeading}
              </DialogTitle>
              <DialogDescription className="mw-member-dialog-description">
                {t.requiredFields}
              </DialogDescription>
            </div>
          </DialogHeader>

          <form
            ref={memberFormRef}
            className="mw-member-form"
            onInput={(event) => validateMemberForm(event.currentTarget)}
            onChange={(event) => validateMemberForm(event.currentTarget)}
            onBlur={(event) => validateMemberForm(event.currentTarget, false, (event.target as HTMLElement).getAttribute("name") || undefined)}
            onSubmit={createMember}
          >
            <section
              className="mw-form-section"
              aria-labelledby="mw-account-title"
            >
              <div className="mw-form-section-heading">
                <span className="mw-form-number">01</span>
                <div>
                  <h3 id="mw-account-title">{t.accountTypeTitle}</h3>
                  <p>{t.chooseAccountType}</p>
                </div>
              </div>
              <div
                className="mw-account-types"
                role="group"
                aria-label={t.chooseAccountType}
              >
                {accountTypes.map((type) => (
                  <button
                    type="button"
                    key={type.value}
                    className={`mw-account-option${accountType === type.value ? " is-selected" : ""}`}
                    aria-pressed={accountType === type.value}
                    onClick={() => setAccountType(type.value)}
                  >
                    {t[type.label]}
                  </button>
                ))}
              </div>
              <div className="mw-generated-account">
                <div>
                  <span>{t.assignedAccount}</span>
                  <strong aria-live="polite">
                    {generatingAccountNumber ? t.accountNumberLoading : generatedAccountNumber || t.accountNumberUnavailable}
                  </strong>
                </div>
                <button
                  type="button"
                  className="mw-account-refresh"
                  onClick={() => void refreshAccountNumber()}
                  disabled={generatingAccountNumber}
                >
                  {t.refreshAccountNumber}
                </button>
                <p className={accountNumberError ? "is-error" : undefined}>
                  {accountNumberError || t.accountNumberHelp}
                </p>
              </div>
            </section>

            <section
              className="mw-form-section"
              aria-labelledby="mw-identity-title"
            >
              <div className="mw-form-section-heading">
                <span className="mw-form-number">02</span>
                <div>
                  <h3 id="mw-identity-title">{t.memberIdentity}</h3>
                </div>
              </div>
              <div className="mw-identity-layout">
                <div className="mw-photo-field">
                  <span className="mw-form-label">{t.photoMember}</span>
                  <label className="mw-photo-picker" htmlFor="mw-member-photo">
                    {memberPhoto ? (
                      <img src={memberPhoto} alt={t.photoMember} />
                    ) : (
                      <IconUserCircle />
                    )}
                    <span>
                      <IconCamera />
                      {t.changePhoto}
                    </span>
                  </label>
                  <input
                    id="mw-member-photo"
                    className="mw-visually-hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      setMemberPhoto(file ? URL.createObjectURL(file) : null);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setMemberPhotoData(String(reader.result || ""));
                        reader.onerror = () => setCreateError(t.createFailed);
                        reader.readAsDataURL(file);
                      } else {
                        setMemberPhotoData("");
                      }
                    }}
                  />
                </div>
                <div className="mw-form-grid">
                  <label
                    className={`mw-field mw-field-wide${fieldState("memberName")}`}
                    htmlFor="mw-member-full-name"
                  >
                    <span>
                      {t.fullName} <b>*</b>
                    </span>
                    <input
                      id="mw-member-full-name"
                      name="memberName"
                      autoComplete="name"
                      required
                      placeholder="e.g. Jean Kabila"
                    />
                    {fieldFeedback("memberName")}
                  </label>
                  <label className={`mw-field${fieldState("memberPhone")}`} htmlFor="mw-member-phone">
                    <span>
                      {t.requiredPhone} <b>*</b>
                    </span>
                    <input
                      id="mw-member-phone"
                      name="memberPhone"
                      type="tel"
                      autoComplete="tel"
                      required
                      placeholder="0812345678"
                    />
                    {fieldFeedback("memberPhone")}
                  </label>
                  <label className={`mw-field${fieldState("memberEmail")}`} htmlFor="mw-member-email">
                    <span>
                      {t.emailAddress} <b>*</b>
                    </span>
                    <input
                      id="mw-member-email"
                      name="memberEmail"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="membre@example.com"
                    />
                    {fieldFeedback("memberEmail")}
                  </label>
                  <label className={`mw-field${fieldState("memberSex")}`} htmlFor="mw-member-sex">
                    <span>
                      {t.sex} <b>*</b>
                    </span>
                    <select
                      id="mw-member-sex"
                      name="memberSex"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {t.selectSex}
                      </option>
                      <option value="F">{t.female}</option>
                      <option value="M">{t.male}</option>
                      <option value="AUTRE">{t.sexOther}</option>
                    </select>
                    {fieldFeedback("memberSex")}
                  </label>
                  <label className={`mw-field${fieldState("joinDate")}`} htmlFor="mw-member-join-date">
                    <span>
                      {t.joinDate} <b>*</b>
                    </span>
                    <input
                      id="mw-member-join-date"
                      name="joinDate"
                      type="date"
                      required
                      defaultValue={localDateInputValue()}
                    />
                    {fieldFeedback("joinDate")}
                  </label>
                </div>
              </div>
            </section>

            <section
              className="mw-form-section"
              aria-labelledby="mw-contact-title"
            >
              <div className="mw-form-section-heading">
                <span className="mw-form-number">03</span>
                <div>
                  <h3 id="mw-contact-title">{t.contactsMore}</h3>
                </div>
              </div>
              <div className="mw-form-grid">
                <label className={`mw-field${fieldState("activity")}`} htmlFor="mw-member-activity">
                  <span>{t.memberActivity}</span>
                  <input
                    id="mw-member-activity"
                    name="activity"
                    placeholder={t.memberActivityPlaceholder}
                  />
                  {fieldFeedback("activity")}
                </label>
                <label
                  className={`mw-field mw-field-wide${fieldState("address")}`}
                  htmlFor="mw-member-address"
                >
                  <span>{t.address}</span>
                  <input
                    id="mw-member-address"
                    name="address"
                    autoComplete="street-address"
                    placeholder={t.addressPlaceholder}
                  />
                  {fieldFeedback("address")}
                </label>
                <label className={`mw-field${fieldState("nationalId")}`} htmlFor="mw-member-national-id">
                  <span>{t.nationalId}</span>
                  <input
                    id="mw-member-national-id"
                    name="nationalId"
                    placeholder="00000000000"
                  />
                  {fieldFeedback("nationalId")}
                </label>
                <p className="mw-password-notice">{t.emailCredentialNotice}</p>
              </div>
              <details className="mw-extra-options">
                <summary>{t.moreOptions}</summary>
                <div className="mw-extra-grid">
                  <label className={`mw-field${fieldState("birthDate")}`} htmlFor="mw-member-birth-date">
                    <span>{t.birthDate}</span>
                    <input
                      id="mw-member-birth-date"
                      name="birthDate"
                      type="date"
                    />
                    {fieldFeedback("birthDate")}
                  </label>
                </div>
              </details>
            </section>

            <section className="mw-form-section" aria-labelledby="mw-bio-title">
              <div className="mw-form-section-heading">
                <span className="mw-form-number">04</span>
                <div>
                  <h3 id="mw-bio-title">{t.bioFees}</h3>
                </div>
              </div>
              <div className="mw-bio-fee-grid">
                <div className="mw-bio-card mw-member-fingerprint-card">
                  <span className="mw-form-label">{t.memberFingerprint}</span>
                  <button
                    type="button"
                    className={`mw-delegate-capture${memberUserId ? " is-captured" : ""}`}
                    onClick={captureMemberFingerprint}
                    disabled={capturingMemberFingerprint}
                    aria-describedby="mw-member-fingerprint-status"
                    aria-live="polite"
                  >
                    <IconFingerprint />
                    {capturingMemberFingerprint ? t.fingerprintWaiting : memberUserId ? t.recaptureFingerprint : t.captureFingerprint}
                  </button>
                  <div id="mw-member-fingerprint-status" aria-live="polite">
                    {capturingMemberFingerprint ? (
                      <p className="mw-fingerprint-progress" role="status">{t.fingerprintReadStarted} {t.fingerprintChecking}</p>
                    ) : memberUserId ? (
                      <p className="mw-delegate-fingerprint-success" role="status">✓ {t.fingerprintReady} · ID {memberUserId}<br />{t.fingerprintAvailable}</p>
                    ) : memberFingerprintError ? (
                      <p className="mw-delegate-fingerprint-error" role="alert">✕ {memberFingerprintError}</p>
                    ) : (
                      <p role="status">{t.memberFingerprintHint}</p>
                    )}
                  </div>
                </div>
                <div className="mw-fee-card">
                  <span className="mw-form-label">Durée du placement d’épargne</span>
                  <div className="mw-dat-duration-options" role="group" aria-label="Durée du placement d’épargne">
                    {[1, 3, 6, 12].map((months) => <button
                      key={`savings-${months}`}
                      type="button"
                      className={savingsMonths === months ? 'is-selected' : undefined}
                      aria-pressed={savingsMonths === months}
                      onClick={() => setSavingsMonths(months)}
                    >{months} mois</button>)}
                  </div>
                  <p>Durée prévue à l’inscription. Chaque placement et renouvellement reste confirmé au guichet avec un nouveau versement.</p>
                  <span className="mw-form-label">{t.membershipFee}</span>
                  <span className="mw-form-label">{t.adhesionDuration}</span>
                  <div className="mw-dat-duration-options" role="group" aria-label={t.adhesionDuration}>
                    {[1, 3, 6, 12].map((months) => <button
                      key={months}
                      type="button"
                      className={adhesionMonths === months ? 'is-selected' : undefined}
                      aria-pressed={adhesionMonths === months}
                      onClick={() => setAdhesionMonths(months)}
                    >{months} {t.datMonths}</button>)}
                  </div>
                  <span className="mw-form-label">{t.paymentCurrency}</span>
                  <div className="mw-dat-duration-options" role="group" aria-label={t.paymentCurrency}>
                    {(['FC', 'USD'] as const).map((currency) => <button
                      key={currency}
                      type="button"
                      className={adhesionCurrency === currency ? 'is-selected' : undefined}
                      aria-pressed={adhesionCurrency === currency}
                      onClick={() => setAdhesionCurrency(currency)}
                    >{currency}</button>)}
                  </div>
                  <strong>{(({ 1: 1, 3: 2, 6: 3, 12: 4 } as Record<number, number>)[adhesionMonths] * (adhesionCurrency === 'FC' ? 2500 : 1)).toLocaleString('fr-FR')} {adhesionCurrency}</strong>
                  <p>{t.feeNote}</p>
                </div>
              </div>
            </section>

            <section
              className="mw-form-section"
              aria-labelledby="mw-delegate-title"
            >
              <div className="mw-form-section-heading">
                <span className="mw-form-number">05</span>
                <div>
                  <h3 id="mw-delegate-title">{t.delegateOptional}</h3>
                  {delegate && (
                    <p>
                      {delegate.name} · {delegate.phone}
                    </p>
                  )}
                </div>
                {delegate && (
                  <button
                    type="button"
                    className="mw-link-button"
                    onClick={() => {
                      setCapturedDelegateUserId(delegate.userId || "");
                      setDelegateFingerprintError("");
                      setDelegateOpen(true);
                    }}
                  >
                    {t.editDelegate}
                  </button>
                )}
              </div>
              {!delegate && (
                <button
                  type="button"
                  className="mw-add-delegate"
                  onClick={() => {
                    setCapturedDelegateUserId("");
                    setDelegateFingerprintError("");
                    setDelegateOpen(true);
                  }}
                >
                  <IconPlus />
                  {t.addDelegate}
                </button>
              )}
            </section>

            <div className="mw-member-form-footer">
              {createError && <p className="mw-delegate-fingerprint-error" role="alert">{createError}</p>}
              <button
                type="button"
                className="mw-dialog-cancel"
                onClick={() => onOpenChange(false)}
                disabled={creatingMember}
              >
                {t.cancel}
              </button>
              <button type="submit" className="mw-primary" disabled={creatingMember || !memberFormValid}>
                {creatingMember ? t.creatingMember : t.createMember}
              </button>
              {!memberFormValid && !creatingMember && (
                <p className="mw-form-validation-hint" role="status">{t.formInvalidNotice}</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content mw-delegate-dialog !gap-0 !rounded-[8px] !border-[var(--mw-line)] !bg-[var(--mw-paper)] !p-[22px] !text-[var(--mw-ink)] sm:!max-w-[460px]"
        >
          <DialogHeader className="!mb-5 !space-y-1 !text-left">
            <DialogTitle>{t.addDelegate}</DialogTitle>
            <DialogDescription>{t.delegateOptional}</DialogDescription>
          </DialogHeader>
          <form className="mw-delegate-form" onSubmit={saveDelegate}>
            <label className="mw-field" htmlFor="mw-delegate-name">
              <span>{t.delegateName} *</span>
              <input
                id="mw-delegate-name"
                name="name"
                required
                defaultValue={delegate?.name}
              />
            </label>
            <label className="mw-field" htmlFor="mw-delegate-phone">
              <span>{t.delegatePhone} *</span>
              <input
                id="mw-delegate-phone"
                name="phone"
                type="tel"
                required
                defaultValue={delegate?.phone}
              />
            </label>
            <label className="mw-field" htmlFor="mw-delegate-relation">
              <span>{t.delegateRelation} *</span>
              <input
                id="mw-delegate-relation"
                name="relation"
                required
                defaultValue={delegate?.relation}
              />
            </label>
            <label className="mw-field" htmlFor="mw-delegate-id">
              <span>{t.delegateNationalId}</span>
              <input
                id="mw-delegate-id"
                name="nationalId"
                defaultValue={delegate?.nationalId}
                placeholder="00000000000"
              />
            </label>
            <section className="mw-delegate-fingerprint" aria-labelledby="mw-delegate-fingerprint-title">
              <div className="mw-delegate-fingerprint-copy">
                <span id="mw-delegate-fingerprint-title">{t.delegateFingerprint}</span>
                <p>{t.fingerprintHint}</p>
              </div>
              <button
                type="button"
                className="mw-delegate-capture"
                onClick={captureDelegateFingerprint}
                disabled={capturingDelegateFingerprint}
              >
                <IconFingerprint aria-hidden="true" />
                {capturingDelegateFingerprint ? t.fingerprintWaiting : capturedDelegateUserId ? t.recaptureFingerprint : t.captureFingerprint}
              </button>
              {capturedDelegateUserId && <p className="mw-delegate-fingerprint-success" role="status">{t.fingerprintReady} · ID {capturedDelegateUserId}</p>}
              {delegateFingerprintError && <p className="mw-delegate-fingerprint-error" role="alert">{delegateFingerprintError}</p>}
            </section>
            <div className="mw-dialog-actions">
              <button
                type="button"
                className="mw-dialog-cancel"
                onClick={() => setDelegateOpen(false)}
              >
                {t.cancel}
              </button>
              <button type="submit" className="mw-primary">
                {t.save}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

