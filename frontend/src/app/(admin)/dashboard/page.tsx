'use client';

import {
  IconCalendar,
  IconCamera,
  IconClock,
  IconCurrencyDollar,
  IconFingerprint,
  IconLeaf,
  IconPigMoney,
  IconPlus,
  IconSearch,
  IconUserCircle,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { useCooperativeDarkTheme } from "@/components/cooperative/CooperativeThemeContext";
import { getAuthUser } from "@/lib/auth";
import { apiClient } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format-currency";

type Transaction = {
  id: string;
  name: string;
  initials: string;
  type: string;
  amount: number;
  currency: "USD" | "FC";
  date: string;
  status: "valid" | "pending" | "rejected";
};

type DelegateDraft = {
  name: string;
  phone: string;
  relation: string;
  nationalId: string;
  userId?: string;
};

type DashboardResponse = {
  overview: {
    totalMembers: number;
    activeMembersCount: number;
    totalEpargne: { usd: number; fc: number };
    totalCaisse: { usd: number; fc: number };
    activeCreditBalance: { usd: number; fc: number };
    activeCreditsCount: number;
    repaymentRate: number;
    activeProjectsCount: number;
  };
  history: { month: string; depotsUSD: number; creditsUSD: number; depotsFC: number; creditsFC: number }[];
  dailyHistory: { date: string; epargneUSD: number; creditUSD: number; epargneFC: number; creditFC: number }[];
  activityDistribution: { activite: string; total: number }[];
};

type Reminder = { id: number; name: string; detail: string; amount: string };

const accountTypes = [
  { value: "PRINCIPAL", code: "P", label: "principal" },
  { value: "KELASI", code: "K", label: "kelasi" },
  { value: "NYUMBA", code: "N", label: "nyumba" },
  { value: "HOPITAL", code: "H", label: "hopital" },
  { value: "MUTOTO", code: "M", label: "mutoto" },
  { value: "BIASHARA", code: "B", label: "biashara" },
] as const;

const copy = {
  FR: {
    overview: "Vue d’ensemble",
    adminSpace: "ESPACE ADMINISTRATEUR",
    adminTools: "GESTION DE LA COOPÉRATIVE",
    search: "Rechercher un membre, une transaction...",
    addMember: "Nouveau membre",
    addContribution: "Nouvelle cotisation",
    dashboard: "Bonjour, Aline",
    date: "Mardi 24 juin 2025",
    members: "Total des membres",
    savings: "Capital total / Épargne",
    loans: "Crédits en cours",
    projects: "Projets actifs",
    thisMonth: "ce mois-ci",
    repayment: "de remboursement",
    community: "Agricoles & communautaires",
    chart: "Cotisations & crédits",
    annual: "Annuel",
    monthly: "Mensuel",
    weekly: "Hebdomadaire",
    contributions: "Cotisations",
    credit: "Crédits",
    transactions: "Transactions récentes",
    viewAll: "Voir tout",
    member: "Membre",
    type: "Type",
    amount: "Montant",
    when: "Date",
    status: "Statut",
    valid: "Validé",
    pending: "En attente",
    rejected: "Rejeté",
    distribution: "Distribution des membres",
    farmers: "Agriculteurs",
    merchants: "Commerçants",
    livestock: "Éleveurs",
    other: "Autres",
    total: "Membres",
    reminders: "Échéances à venir",
    send: "Rappeler",
    sent: "Envoyé",
    notifications: "Notifications",
    notice1: "3 remboursements arrivent à échéance cette semaine.",
    notice2: "Un nouveau projet agricole a été soumis.",
    role: "Administratrice",
    cooperative: "Coopérative d'épargne et de crédit",
    section: "Cette section arrive bientôt",
    continue:
      "Dites-nous ce que vous souhaitez y gérer et nous la construirons ensemble.",
    cancel: "Annuler",
    save: "Enregistrer",
    newMemberHeading: "Nouveau Membre",
    requiredFields: "Complétez tous les champs requis",
    accountTypeTitle: "Type de Compte",
    chooseAccountType: "Sélectionnez le type de compte",
    principal: "PRINCIPAL",
    kelasi: "KELASI",
    nyumba: "NYUMBA",
    hopital: "HOPITAL",
    mutoto: "MUTOTO",
    biashara: "BIASHARA",
    assignedAccount: "Numéro de compte attribué",
    accountNumberHelp:
      "Ce numéro est généré automatiquement avec un code de section et un identifiant aléatoire.",
    memberIdentity: "Identité du Membre",
    photoMember: "Photo Membre",
    changePhoto: "Clic pour changer",
    fullName: "Nom complet",
    requiredPhone: "Téléphone",
    emailAddress: "Adresse e-mail",
    emailCredentialNotice: "Un mot de passe temporaire sera envoyé à cette adresse.",
    sex: "Sexe",
    selectSex: "Sélectionner",
    male: "Masculin",
    female: "Féminin",
    sexOther: "Autre",
    joinDate: "Date d’adhésion",
    contactsMore: "Coordonnées & Plus",
    address: "Adresse physique",
    addressPlaceholder: "Bâtiment, Rue, Quartier, Ville",
    nationalId: "ID Nationale / Pièce ID",
    moreOptions: "+ Plus d'options (Naissance)",
    birthDate: "Date de naissance",
    bioFees: "Biométrie & Frais",
    captureHolder: "Capture : Membre Titulaire",
    scanHolder: "Scanner Membre Titulaire",
    scannerPending:
      "Interface de scanner uniquement — aucune donnée biométrique capturée.",
    membershipFee: "Frais d’Adhésion",
    feeNote:
      "Une cotisation de 2 000 FC sera déduite pour le compte collectif.",
    delegateOptional: "Délégué (Optionnel)",
    addDelegate: "Ajouter un délégué autorisé",
    editDelegate: "Modifier le délégué",
    delegateName: "Nom complet du délégué",
    delegatePhone: "Téléphone du délégué",
    delegateRelation: "Lien avec le membre",
    delegateNationalId: "ID Nationale / Pièce ID",
    delegateFingerprint: "Empreinte du délégué",
    captureFingerprint: "Capturer l’empreinte",
    recaptureFingerprint: "Capturer à nouveau",
    fingerprintReady: "Empreinte capturée",
    fingerprintChecking: "Vérification de l’identifiant…",
    fingerprintAvailable: "Empreinte disponible pour ce membre.",
    fingerprintAlreadyUsed: "Cet identifiant biométrique est déjà utilisé.",
    fingerprintReadStarted: "Placez le doigt sur le lecteur. La capture peut prendre quelques secondes.",
    fingerprintApiUnavailable: "Le serveur backend ne répond pas. Vérifiez qu’il est démarré, que NEXT_PUBLIC_API_URL pointe vers son adresse /api et que CORS autorise cette page.",
    fingerprintHint: "Capture facultative via le lecteur biométrique connecté.",
    fingerprintWaiting: "En attente du doigt sur le lecteur…",
    fingerprintUnavailable: "Capture impossible. Vérifiez que le lecteur est connecté, puis réessayez.",
    memberFingerprint: "Empreinte du membre",
    memberFingerprintHint: "Facultative. Le lecteur enregistre l’identifiant biométrique du membre.",
    memberActivity: "Activité principale",
    memberActivityPlaceholder: "Ex. Agriculture, commerce, élevage",
    createFailed: "La création du membre a échoué. Vérifiez les informations et réessayez.",
    creatingMember: "Création en cours…",
    createdMember: "Membre créé",
    accountAssignedOnSave: "Attribué automatiquement après création",
    createMember: "Créer le membre",
    demoOnly: "Aperçu uniquement — aucune donnée n’a été enregistrée.",
    memberName: "Nom complet",
    memberPhone: "Téléphone",
    contributionAmount: "Montant ($)",
    contributionMember: "Membre",
    addSuccess: "Enregistré avec succès",
    noResults: "Aucune transaction trouvée",
    signOut: "Déconnexion",
    searchShortcut: "⌘ K",
  },
  EN: {
    overview: "Overview",
    adminSpace: "ADMINISTRATOR WORKSPACE",
    adminTools: "COOPERATIVE MANAGEMENT",
    search: "Search members, transactions...",
    addMember: "New member",
    addContribution: "New contribution",
    dashboard: "Good morning, Aline",
    date: "Tuesday, June 24, 2025",
    members: "Total members",
    savings: "Total capital / Savings",
    loans: "Active loans",
    projects: "Active projects",
    thisMonth: "this month",
    repayment: "repayment rate",
    community: "Agricultural & community",
    chart: "Contributions & loans",
    annual: "Yearly",
    monthly: "Monthly",
    weekly: "Weekly",
    contributions: "Contributions",
    credit: "Loans",
    transactions: "Recent transactions",
    viewAll: "View all",
    member: "Member",
    type: "Type",
    amount: "Amount",
    when: "Date",
    status: "Status",
    valid: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    distribution: "Member distribution",
    farmers: "Farmers",
    merchants: "Merchants",
    livestock: "Livestock",
    other: "Other",
    total: "Members",
    reminders: "Upcoming due dates",
    send: "Remind",
    sent: "Sent",
    notifications: "Notifications",
    notice1: "3 repayments are due this week.",
    notice2: "A new agricultural project was submitted.",
    role: "Administrator",
    cooperative: "Savings and credit cooperative",
    section: "This section is coming soon",
    continue:
      "Tell us what you’d like to manage here and we’ll build it together.",
    cancel: "Cancel",
    save: "Save",
    newMemberHeading: "New Member",
    requiredFields: "Complete all required fields",
    accountTypeTitle: "Account Type",
    chooseAccountType: "Select an account type",
    principal: "PRINCIPAL",
    kelasi: "KELASI",
    nyumba: "NYUMBA",
    hopital: "HOPITAL",
    mutoto: "MUTOTO",
    biashara: "BIASHARA",
    assignedAccount: "Assigned account number",
    accountNumberHelp:
      "This number is generated automatically using a section code and a random identifier.",
    memberIdentity: "Member Identity",
    photoMember: "Member Photo",
    changePhoto: "Click to change",
    fullName: "Full name",
    requiredPhone: "Phone",
    emailAddress: "Email address",
    emailCredentialNotice: "A temporary password will be sent to this address.",
    sex: "Sex",
    selectSex: "Select",
    male: "Male",
    female: "Female",
    sexOther: "Other",
    joinDate: "Join date",
    contactsMore: "Contact Details & More",
    address: "Physical address",
    addressPlaceholder: "Building, Street, District, City",
    nationalId: "National ID / ID card",
    moreOptions: "+ More options (Birth)",
    birthDate: "Date of birth",
    bioFees: "Biometrics & Fees",
    captureHolder: "Capture: Primary Member",
    scanHolder: "Scan Primary Member",
    scannerPending: "Scanner interface only — no biometric data is captured.",
    membershipFee: "Membership fee",
    feeNote:
      "A contribution of 2,000 FC will be deducted for the collective account.",
    delegateOptional: "Delegate (Optional)",
    addDelegate: "Add authorized delegate",
    editDelegate: "Edit delegate",
    delegateName: "Delegate full name",
    delegatePhone: "Delegate phone",
    delegateRelation: "Relationship to member",
    delegateNationalId: "National ID / ID card",
    delegateFingerprint: "Delegate fingerprint",
    captureFingerprint: "Capture fingerprint",
    recaptureFingerprint: "Capture again",
    fingerprintReady: "Fingerprint captured",
    fingerprintChecking: "Checking identifier…",
    fingerprintAvailable: "Fingerprint is available for this member.",
    fingerprintAlreadyUsed: "This biometric identifier is already in use.",
    fingerprintReadStarted: "Place a finger on the reader. Capture may take a few seconds.",
    fingerprintApiUnavailable: "The backend server is unreachable. Check that it is running, NEXT_PUBLIC_API_URL points to its /api address, and CORS allows this page.",
    fingerprintHint: "Optional capture using the connected biometric reader.",
    fingerprintWaiting: "Waiting for a finger on the reader…",
    fingerprintUnavailable: "Capture failed. Check the reader connection and try again.",
    memberFingerprint: "Member fingerprint",
    memberFingerprintHint: "Optional. The reader stores the member’s biometric identifier.",
    memberActivity: "Main activity",
    memberActivityPlaceholder: "e.g. Agriculture, trade, livestock",
    createFailed: "Member creation failed. Check the details and try again.",
    creatingMember: "Creating member…",
    createdMember: "Member created",
    accountAssignedOnSave: "Automatically assigned after creation",
    createMember: "Create member",
    demoOnly: "Preview only — no data was saved.",
    memberName: "Full name",
    memberPhone: "Phone",
    contributionAmount: "Amount ($)",
    contributionMember: "Member",
    addSuccess: "Saved successfully",
    noResults: "No transactions found",
    signOut: "Sign out",
    searchShortcut: "⌘ K",
  },
};

function money(value: number, currency: "USD" | "FC" = "USD") {
  const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value || 0);
  return currency === "USD" ? `$${amount}` : `${amount} FC`;
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function meta() {
  return [
    { title: "Mwangaza Wetu — Tableau de bord" },
    {
      name: "description",
      content: "Tableau de bord de la coopérative Mwangaza Wetu",
    },
  ];
}



function MemberEnrollmentDialog({
  open,
  onOpenChange,
  dark,
  t,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  t: (typeof copy)["FR"];
  onCreated: (numeroCompte: string) => void;
}) {
  const [accountType, setAccountType] = useState("PRINCIPAL");
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
      setDelegate(null);
      setCapturedDelegateUserId("");
      setDelegateFingerprintError("");
      setMemberPhoto(null);
      setMemberPhotoData("");
      setMemberUserId("");
      setMemberFingerprintError("");
      setCreateError("");
    }
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
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setDelegateFingerprintError(Array.isArray(message) ? message.join(" ") : message || t.fingerprintUnavailable);
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
    } catch (error: any) {
      const message = error?.response?.data?.message;
      const details = error?.response?.data?.details;
      const networkError = !error?.response && error?.message === "Network Error";
      const readableMessage = networkError
        ? `${t.fingerprintApiUnavailable} (${apiClient.defaults.baseURL || "API URL non définie"})`
        : Array.isArray(message)
          ? message.join(" ")
          : [message || t.fingerprintUnavailable, details].filter(Boolean).join(" ");
      setMemberFingerprintError(readableMessage);
    } finally {
      setCapturingMemberFingerprint(false);
    }
  }

  async function createMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingMember(true);
    setCreateError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      nomComplet: String(data.get("memberName") || "").trim(),
      telephone: String(data.get("memberPhone") || "").trim(),
      email: String(data.get("memberEmail") || "").trim(),
      sexe: String(data.get("memberSex") || ""),
      dateAdhesion: String(data.get("joinDate") || ""),
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
      const response = await apiClient.post<{ numeroCompte: string }>("/membres", payload);
      onCreated(response.data.numeroCompte);
      onOpenChange(false);
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setCreateError(Array.isArray(message) ? message.join(" ") : message || t.createFailed);
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
            className="mw-member-form"
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
                  <strong>{t.accountAssignedOnSave}</strong>
                </div>
                <p>{t.accountAssignedOnSave}</p>
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
                    className="mw-field mw-field-wide"
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
                  </label>
                  <label className="mw-field" htmlFor="mw-member-phone">
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
                  </label>
                  <label className="mw-field" htmlFor="mw-member-email">
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
                  </label>
                  <label className="mw-field" htmlFor="mw-member-sex">
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
                  </label>
                  <label className="mw-field" htmlFor="mw-member-join-date">
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
                <label className="mw-field" htmlFor="mw-member-activity">
                  <span>{t.memberActivity}</span>
                  <input
                    id="mw-member-activity"
                    name="activity"
                    placeholder={t.memberActivityPlaceholder}
                  />
                </label>
                <label
                  className="mw-field mw-field-wide"
                  htmlFor="mw-member-address"
                >
                  <span>{t.address}</span>
                  <input
                    id="mw-member-address"
                    name="address"
                    autoComplete="street-address"
                    placeholder={t.addressPlaceholder}
                  />
                </label>
                <label className="mw-field" htmlFor="mw-member-national-id">
                  <span>{t.nationalId}</span>
                  <input
                    id="mw-member-national-id"
                    name="nationalId"
                    placeholder="00000000000"
                  />
                </label>
                <p className="mw-password-notice">{t.emailCredentialNotice}</p>
              </div>
              <details className="mw-extra-options">
                <summary>{t.moreOptions}</summary>
                <div className="mw-extra-grid">
                  <label className="mw-field" htmlFor="mw-member-birth-date">
                    <span>{t.birthDate}</span>
                    <input
                      id="mw-member-birth-date"
                      name="birthDate"
                      type="date"
                    />
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
                      <p>{t.memberFingerprintHint}</p>
                    )}
                  </div>
                </div>
                <div className="mw-fee-card">
                  <span className="mw-form-label">{t.membershipFee}</span>
                  <strong>2 000 FC</strong>
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
              <button type="submit" className="mw-primary" disabled={creatingMember}>
                {creatingMember ? t.creatingMember : t.createMember}
              </button>
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

export default function HomeRoute() {
  const dark = useCooperativeDarkTheme();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Annuel");
  const [currency, setCurrency] = useState<"USD" | "FC">("USD");

  function formatMoney(usd: number, fc: number) {
    return {
      primary: money(currency === "USD" ? usd : fc, currency),
      secondary: money(currency === "USD" ? fc : usd, currency === "USD" ? "FC" : "USD"),
    };
  }

  const [language, setLanguage] = useState<"FR" | "EN">("FR");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [dialog, setDialog] = useState<"member" | null>(null);
  const [toast, setToast] = useState("");
  const t = copy[language];

  const authUser = getAuthUser();
  const greetingName = authUser?.firstName || authUser?.fullName?.split(" ")[0] || "Aline";
  const greeting = language === "FR" ? `Bonjour, ${greetingName}` : `Welcome back, ${greetingName}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiClient.get<DashboardResponse>("/solde/dashboard"),
      apiClient.get<{ data: { id: string; memberName: string; type: string; amount: number; currency: "USD" | "FC"; date: string; status: string }[] }>("/solde/dashboard/transactions?limit=10"),
      apiClient.get<{ data: { id: number; memberName: string; dueDate: string; amountRemaining: number; currency: "USD" | "FC" }[] }>("/credits/echeances?limit=3&days=30"),
    ]).then(([summary, transactionResponse, dueResponse]) => {
      if (!active) return;
      setDashboard(summary.data);
      setTransactions(transactionResponse.data.data.map((item) => ({
        id: item.id,
        name: item.memberName,
        initials: item.memberName.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase(),
        type: item.type,
        amount: item.amount,
        currency: item.currency,
        date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(item.date)),
        status: item.status === "valid" ? "valid" : item.status === "pending" ? "pending" : "rejected",
      })));
      setReminders(dueResponse.data.data.map((item) => ({
        id: item.id,
        name: item.memberName,
        detail: `Échéance · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(item.dueDate))}`,
        amount: money(item.amountRemaining, item.currency),
      })));
      setLoadError("");
    }).catch(() => {
      if (active) setLoadError("Impossible de charger les données du tableau de bord. Vérifiez la connexion au backend et votre session.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dashboardRefresh]);

  const memberCount = dashboard?.overview.totalMembers ?? 0;
  const chartData = useMemo(() => {
    if (!dashboard) return [];
    if (period === "Annuel") return dashboard.history.map((item) => ({ label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(`${item.month}-01T12:00:00`)), savings: currency === "USD" ? item.depotsUSD : item.depotsFC, loans: currency === "USD" ? item.creditsUSD : item.creditsFC }));
    const days = period === "Hebdomadaire" ? 7 : 30;
    return dashboard.dailyHistory.slice(-days).map((item) => ({ label: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${item.date}T12:00:00`)), savings: currency === "USD" ? item.epargneUSD : item.epargneFC, loans: currency === "USD" ? item.creditUSD : item.creditFC }));
  }, [dashboard, period, currency]);
  const chartTotal = chartData.reduce((sum, point) => sum + point.savings, 0);
  const activityPalette = ["#286e4d", "#ebaF39", "#91a673", "#b4c4b3", "#65869a"];
  const activityTotal = dashboard?.activityDistribution.reduce((sum, item) => sum + item.total, 0) || 0;
  const distributionGradient = useMemo(() => {
    let cursor = 0;
    const segments = (dashboard?.activityDistribution || []).map((item, index) => {
      const start = cursor;
      cursor += activityTotal ? (item.total / activityTotal) * 100 : 0;
      return `${activityPalette[index % activityPalette.length]} ${start}% ${cursor}%`;
    });
    return segments.length ? `conic-gradient(${segments.join(",")})` : "#e5e7eb";
  }, [dashboard, activityTotal]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        `${transaction.name} ${transaction.type} ${transaction.status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, transactions],
  );

  return (
    <div className="mw-dashboard-page">
      {/* ── Heading ─────────────────────────────────────────────── */}
      <div className="mw-heading-row">
        <div>
          <h1>{greeting}</h1>
          <div className="mw-date">
            <IconCalendar size={14} />
            {new Intl.DateTimeFormat(language === "FR" ? "fr-FR" : "en-US", { dateStyle: "full" }).format(new Date())}
          </div>
        </div>
        <div className="coop-page-actions">
          <button type="button" className="mw-primary" title={t.addMember} aria-label={t.addMember} onClick={() => setDialog("member")}>
            <IconPlus size={16} />
            {t.addMember}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <section className="mw-kpis" aria-label={t.overview}>
        {/* Carte 1 : Membres */}
        <article className="mw-kpi mw-kpi-bento">
          <div className="mw-kpi-top">
            <span className="mw-kpi-title">{t.members}</span>
            <span className="mw-kpi-icon blue">
              <IconUsers />
            </span>
          </div>
          <div className="mw-kpi-main">
            <div className="mw-kpi-value">{loading ? "…" : memberCount.toLocaleString("fr-FR")}</div>
            <div className="mw-kpi-sub">
              <span className="mw-kpi-subtext">{dashboard?.overview.activeMembersCount ?? 0} adhérents actifs</span>
            </div>
          </div>
        </article>

        {/* Carte 2 : Total Épargne */}
        <article className="mw-kpi mw-kpi-bento">
          <div className="mw-kpi-top">
            <span className="mw-kpi-title">{t.savings}</span>
            <span className="mw-kpi-icon gold">
              <IconPigMoney />
            </span>
          </div>
          <div className="mw-kpi-main">
            <div className="mw-kpi-value">
              {loading ? "…" : formatMoney(dashboard?.overview.totalEpargne.usd || 0, dashboard?.overview.totalEpargne.fc || 0).primary}
            </div>
            <div className="mw-kpi-sub">
              <span className="mw-kpi-badge-secondary">
                {formatMoney(dashboard?.overview.totalEpargne.usd || 0, dashboard?.overview.totalEpargne.fc || 0).secondary}
              </span>
            </div>
          </div>
        </article>

        {/* Carte 3 : Crédits & Recouvrement */}
        <article className="mw-kpi mw-kpi-bento">
          <div className="mw-kpi-top">
            <span className="mw-kpi-title">{t.loans}</span>
            <span className="mw-kpi-icon orange">
              <IconCurrencyDollar />
            </span>
          </div>
          <div className="mw-kpi-main">
            <div className="mw-kpi-value">
              {loading ? "…" : formatMoney(dashboard?.overview.activeCreditBalance.usd || 0, dashboard?.overview.activeCreditBalance.fc || 0).primary}
            </div>
            <div className="mw-kpi-sub">
              <span className="mw-kpi-badge-secondary">
                {formatMoney(dashboard?.overview.activeCreditBalance.usd || 0, dashboard?.overview.activeCreditBalance.fc || 0).secondary}
              </span>
            </div>
          </div>
        </article>

        {/* Carte 4 : Disponibilités Caisse */}
        <article className="mw-kpi mw-kpi-bento">
          <div className="mw-kpi-top">
            <span className="mw-kpi-title">Disponibilités Caisse</span>
            <span className="mw-kpi-icon green">
              <IconWallet />
            </span>
          </div>
          <div className="mw-kpi-main">
            <div className="mw-kpi-value">
              {loading ? "…" : formatMoney(dashboard?.overview.totalCaisse.usd || 0, dashboard?.overview.totalCaisse.fc || 0).primary}
            </div>
            <div className="mw-kpi-sub">
              <span className="mw-kpi-badge-secondary">
                {formatMoney(dashboard?.overview.totalCaisse.usd || 0, dashboard?.overview.totalCaisse.fc || 0).secondary}
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* ── Dashboard Grid ──────────────────────────────────────── */}
      <div className="mw-dashboard-grid">
        <div className="mw-main-column">
          {/* Chart */}
          <section className="mw-panel mw-overview-panel" aria-labelledby="mw-chart-title">
            <div className="mw-panel-header">
              <h2 id="mw-chart-title">{t.chart}</h2>
              <div className="mw-periods" role="group" aria-label="Devise">
                {(["USD", "FC"] as const).map((value) => <button type="button" key={value} className={`mw-period${currency === value ? " is-active" : ""}`} aria-pressed={currency === value} onClick={() => setCurrency(value)}>{value}</button>)}
              </div>
              <div className="mw-periods" role="group" aria-label={t.chart}>
                {[["Annuel", t.annual], ["Mensuel", t.monthly], ["Hebdomadaire", t.weekly]].map(([value, label]) => (
                  <button type="button" key={value} className={`mw-period${period === value ? " is-active" : ""}`} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="mw-chart-summary">
              <strong className="mw-chart-total">{money(chartTotal, currency)}</strong>
            </div>
            <div className="mw-chart">
              <svg viewBox="0 0 700 190" role="img" aria-label={`${t.chart} · ${t[period === "Annuel" ? "annual" : period === "Mensuel" ? "monthly" : "weekly"]}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mw-area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#286e4d" stopOpacity=".14" />
                    <stop offset="100%" stopColor="#286e4d" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[26, 67, 108, 149].map((y) => (
                  <g key={y}>
                    <line x1="46" x2="687" y1={y} y2={y} className="mw-chart-grid" />
                    <text x="1" y={y + 3} className="mw-chart-axis">{Math.round((180 - y) * (Math.max(1, ...chartData.map((point) => point.savings), ...chartData.map((point) => point.loans)) / 150))}</text>
                  </g>
                ))}
                {(() => {
                  const max = Math.max(1, ...chartData.flatMap((point) => [point.savings, point.loans]));
                  const coords = (key: "savings" | "loans") => chartData.map((point, index) => `${48 + (chartData.length < 2 ? 319 : index * 638 / (chartData.length - 1))},${158 - (point[key] / max) * 132}`).join(" ");
                  const savingsPoints = coords("savings");
                  return <><polyline className="mw-line-contribution" points={savingsPoints} fill="none" /><polyline className="mw-line-loan" points={coords("loans")} fill="none" />{chartData.map((point, index) => <text key={`${point.label}-${index}`} x={48 + (chartData.length < 2 ? 319 : index * 638 / (chartData.length - 1))} y="184" textAnchor="middle" className="mw-chart-axis">{point.label}</text>)}</>;
                })()}
              </svg>
              <div className="mw-chart-legend">
                <span className="mw-legend-item"><i className="mw-legend-dot" />{t.contributions}</span>
                <span className="mw-legend-item"><i className="mw-legend-dot gold" />{t.credit}</span>
              </div>
            </div>
          </section>

          {/* Transactions */}
          <section className="mw-panel" aria-labelledby="mw-transactions-title">
            <div className="mw-panel-header mw-transaction-head">
              <h2 id="mw-transactions-title">{t.transactions}</h2>
              <div className="mw-transaction-actions">
                <label className="mw-table-search">
                  <IconSearch size={14} />
                  <input placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
                {query && (<button type="button" className="mw-link-button" onClick={() => setQuery("")}>{t.viewAll}</button>)}
              </div>
            </div>
            <div className="mw-table-wrap">
              <table className="mw-table">
                <thead>
                  <tr>
                    <th>{t.member}</th>
                    <th>{t.type}</th>
                    <th>{t.amount}</th>
                    <th>{t.when}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length ? (
                    filteredTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          <span className="mw-member">
                            <span className="mw-member-avatar">{transaction.initials}</span>
                            <strong>{transaction.name}</strong>
                          </span>
                        </td>
                        <td className="mw-type">{transaction.type}</td>
                        <td className="mw-amount">{money(transaction.amount, transaction.currency)}</td>
                        <td className="mw-type">{transaction.date}</td>
                        <td><span className={`mw-status ${transaction.status}`}>{t[transaction.status]}</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="mw-empty">{t.noResults}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {query && (<div className="mw-search-results">{filteredTransactions.length} · {t.transactions}</div>)}
          </section>
        </div>

        {/* Right column */}
        <aside className="mw-right-column">
          {/* Distribution */}
          <section className="mw-panel mw-overview-panel" aria-labelledby="mw-distribution-title">
            <div className="mw-panel-header">
              <h2 id="mw-distribution-title">{t.distribution}</h2>
            </div>
            <div className="mw-donut-row">
              <div className="mw-donut" role="img" aria-label={`${t.total}: ${memberCount.toLocaleString("fr-FR")}`} style={{ background: distributionGradient }}>
                <div className="mw-donut-center">
                  <strong>{memberCount.toLocaleString("fr-FR")}</strong>
                  <span>{t.total}</span>
                </div>
              </div>
              <div className="mw-categories">
                {(dashboard?.activityDistribution || []).map((item, index) => <span className="mw-category" key={item.activite}><i style={{ background: activityPalette[index % activityPalette.length] }} />{item.activite}<strong>{activityTotal ? Math.round(item.total / activityTotal * 100) : 0}%</strong></span>)}
                {!loading && dashboard?.activityDistribution.length === 0 && <span className="mw-empty">Aucune activité renseignée</span>}
              </div>
            </div>
          </section>

          {/* Reminders */}
          <section className="mw-panel" aria-labelledby="mw-reminders-title">
            <div className="mw-panel-header">
              <h2 id="mw-reminders-title">{t.reminders}</h2>
              <span className="mw-kpi-icon gold"><IconClock /></span>
            </div>
            <div className="mw-reminder-list">
              {reminders.map((reminder) => (
                <div className="mw-reminder" key={reminder.id}>
                  <span className="mw-reminder-mark"><IconCalendar /></span>
                  <span className="mw-reminder-info">
                    <strong>{reminder.name}</strong>
                    <span>{reminder.detail} · {reminder.amount}</span>
                  </span>
                  <span className="mw-reminder-action" aria-label="Rappel non disponible">{t.send}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {loading && <p className="mw-empty" role="status">Chargement des données du dashboard…</p>}
      {loadError && <p className="mw-empty" role="alert">{loadError}</p>}

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <MemberEnrollmentDialog
        open={dialog === "member"}
        onOpenChange={(open) => !open && setDialog(null)}
        dark={dark}
        t={t}
        onCreated={(numeroCompte) => {
          setDashboardRefresh((current) => current + 1);
          setToast(`${t.createdMember} · ${numeroCompte}`);
          window.setTimeout(() => setToast(""), 4000);
        }}
      />
      {toast && (<div className="mw-toast" role="status">{toast}</div>)}
    </div>
  );
}
