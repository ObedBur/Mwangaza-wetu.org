'use client';

import Link from 'next/link';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowsExchange,
  IconArrowUp,
  IconBuildingBank,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconCreditCard,
  IconCurrencyDollar,
  IconPigMoney,
  IconSearch,
  IconSend,
  IconTrendingUp,
  IconUserPlus,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { CooperativePagination } from "@/components/cooperative/CooperativePagination";
import { getAuthUser } from "@/lib/auth";
import { apiClient } from "@/lib/auth";

const activityPalette = ["#286e4d", "#ebaF39", "#91a673", "#b4c4b3", "#65869a", "#e56a1e"];

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

type DashboardResponse = {
  overview: {
    totalMembers: number;
    activeMembersCount: number;
    totalEpargne: { usd: number; fc: number };
    totalCaisse: { usd: number; fc: number };
    totalRetrait?: { usd: number; fc: number };
    activeCreditBalance: { usd: number; fc: number };
    activeCreditsCount: number;
    overdueCreditsCount?: number;
    overdueCreditBalance?: { usd: number; fc: number };
    repaymentRate: number;
    activeProjectsCount: number;
    datStats?: {
      activeCount: number;
      totalCapitalUSD: number;
      totalCapitalFC: number;
    };
  };
  savingsByType?: {
    typeCompte: string;
    totalUSD: number;
    totalFC: number;
    totalAccounts: number;
  }[];
  agentsCaisses?: {
    id: number;
    nom: string;
    guichetAssigne: string;
    actif: boolean;
    soldes: { usd: number; fc: number };
  }[];
  history: {
    month: string;
    depotsUSD: number;
    retraitsUSD?: number;
    creditsUSD: number;
    depotsFC: number;
    retraitsFC?: number;
    creditsFC: number;
  }[];
  dailyHistory: {
    date: string;
    epargneUSD: number;
    retraitUSD?: number;
    creditUSD: number;
    epargneFC: number;
    retraitFC?: number;
    creditFC: number;
  }[];
  activityDistribution: { activite: string; total: number }[];
};

type Reminder = {
  id: number;
  memberId?: number;
  name: string;
  telephone?: string;
  dueDate?: string;
  detail: string;
  amount: string;
  isOverdue?: boolean;
  diffDays?: number;
};

const copy = {
  FR: {
    overview: "Vue d’ensemble",
    adminSpace: "ESPACE ADMINISTRATEUR",
    adminTools: "GESTION DE LA COOPÉRATIVE",
    search: "Rechercher un membre, une transaction...",
    addContribution: "Nouvelle Epargne",
    dashboard: "Bonjour, Aline",
    date: "Mardi 24 juin 2025",
    members: "Total des membres",
    savings: "Capital total / Épargne",
    loans: "Crédits en cours",
    projects: "Projets actifs",
    thisMonth: "ce mois-ci",
    repayment: "de remboursement",
    community: "Agricoles & communautaires",
    chart: "Epargnes & crédits",
    annual: "Annuel",
    monthly: "Mensuel",
    weekly: "Hebdomadaire",
    contributions: "Epargnes",
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
    refreshAccountNumber: "Régénérer",
    accountNumberLoading: "Génération du numéro…",
    accountNumberUnavailable: "Aperçu indisponible",
    fieldRequiredError: "Ce champ est obligatoire.",
    nameFieldError: "Saisissez au moins 2 caractères.",
    phoneFieldError: "Saisissez un numéro valide (au moins 7 chiffres).",
    emailFieldError: "Saisissez une adresse e-mail valide.",
    selectFieldError: "Sélectionnez une option.",
    dateFieldError: "Saisissez une date valide.",
    nationalIdFieldError: "Saisissez au moins 4 caractères pour la pièce d’identité.",
    formInvalidNotice: "Complétez les champs en rouge pour activer la création.",
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
    datPreview: "Barème DAT (aperçu)",
    datMonths: "mois",
    datMinimum: "Minimum DAT pour",
    datPreviewHint: "Choix définitif après le premier dépôt, à l’ouverture du DAT.",
    datBaremeLoading: "Chargement du barème…",
    datBaremeError: "Barème DAT indisponible. Réessayez plus tard.",
    feeNote:
      "Frais d’adhésion comptabilisés au compte collectif. Le DAT se choisit séparément après un premier dépôt.",
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
    memberFingerprintHint: "Les dépôts sont possibles sans lecteur. L’empreinte devra être enregistrée au bureau avant tout retrait.",
    memberActivity: "Activité principale",
    memberActivityPlaceholder: "Ex. Agriculture, commerce, élevage",
    createFailed: "La création du membre a échoué. Vérifiez les informations et réessayez.",
    creatingMember: "Création en cours…",
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
    refreshAccountNumber: "Regenerate",
    accountNumberLoading: "Generating account number…",
    accountNumberUnavailable: "Preview unavailable",
    fieldRequiredError: "This field is required.",
    nameFieldError: "Enter at least 2 characters.",
    phoneFieldError: "Enter a valid phone number (at least 7 digits).",
    emailFieldError: "Enter a valid email address.",
    selectFieldError: "Select an option.",
    dateFieldError: "Enter a valid date.",
    nationalIdFieldError: "Enter at least 4 characters for the ID document.",
    formInvalidNotice: "Complete the fields marked in red to enable creation.",
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
    datPreview: "Term deposit rates (preview)",
    datMonths: "months",
    datMinimum: "Term deposit minimum for",
    datPreviewHint: "Final choice after the first deposit, when opening the term deposit.",
    datBaremeLoading: "Loading rates…",
    datBaremeError: "Term deposit rates unavailable. Try again later.",
    feeNote:
      "Membership fees are recorded in the collective account. A term deposit is opened separately after the first deposit.",
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
    memberFingerprintHint: "Deposits are allowed without a reader. The fingerprint must be registered at the office before withdrawals.",
    memberActivity: "Main activity",
    memberActivityPlaceholder: "e.g. Agriculture, trade, livestock",
    createFailed: "Member creation failed. Check the details and try again.",
    creatingMember: "Creating member…",
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

export function meta() {
  return [
    { title: "Mwangaza Wetu — Tableau de bord" },
    {
      name: "description",
      content: "Tableau de bord de la coopérative Mwangaza Wetu",
    },
  ];
}



export default function HomeRoute() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Annuel");
  const [currency, setCurrency] = useState<"USD" | "FC">("USD");
  const [chartMetric, setChartMetric] = useState<"contributions" | "cashflow">("contributions");
  const [distributionTab, setDistributionTab] = useState<"accounts" | "activities">("accounts");
  const [txTypeFilter, setTxTypeFilter] = useState<string>("ALL");
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(10);

  function formatMoney(usd: number, fc: number) {
    return {
      primary: money(currency === "USD" ? usd : fc, currency),
      secondary: money(currency === "USD" ? fc : usd, currency === "USD" ? "FC" : "USD"),
    };
  }

  const language: "FR" | "EN" = "FR";
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
const [toast, setToast] = useState("");
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [remindedIds, setRemindedIds] = useState<Record<number, boolean>>({});

  const t = copy[language];

  const authUser = getAuthUser();
  const isAdmin = authUser?.role === "admin" || authUser?.role === "superadmin";
  const isAgent = authUser?.role === "agent";
  const greetingName = authUser?.firstName || authUser?.fullName?.split(" ")[0] || "Aline";
  const greeting = language === "FR" ? `Bonjour, ${greetingName}` : `Welcome back, ${greetingName}`;

  const myCaisse = useMemo(() => {
    if (!dashboard?.agentsCaisses || dashboard.agentsCaisses.length === 0) return null;
    return (
      dashboard.agentsCaisses.find(
        (ag) =>
          ag.id === authUser?.id ||
          ag.nom.toLowerCase() === authUser?.fullName?.toLowerCase() ||
          (authUser?.guichet && ag.guichetAssigne.toLowerCase() === authUser.guichet.toLowerCase())
      ) || dashboard.agentsCaisses[0]
    );
  }, [dashboard, authUser]);

useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get<DashboardResponse>("/solde/dashboard"),
      apiClient.get<{ data: { id: string; memberName: string; type: string; amount: number; currency: "USD" | "FC"; date: string; status: string }[] }>("/solde/dashboard/transactions?limit=25"),
      apiClient.get<{ data: { id: number; memberId?: number; memberName: string; dueDate: string; amountRemaining: number; currency: "USD" | "FC"; isOverdue?: boolean; diffDays?: number; telephone?: string }[] }>("/credits/echeances?limit=6&days=30"),
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
      setReminders(dueResponse.data.data.map((item) => {
        const isLate = Boolean(item.isOverdue);
        const diff = item.diffDays ?? 0;
        const detail = isLate
          ? `En retard (${Math.abs(diff)} j) · Échéance ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(item.dueDate))}`
          : diff === 0
            ? `Échéance aujourd'hui`
            : `Dans ${diff} j · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(item.dueDate))}`;

        return {
          id: item.id,
          memberId: item.memberId,
          name: item.memberName,
          telephone: item.telephone,
          dueDate: item.dueDate,
          detail,
          amount: money(item.amountRemaining, item.currency),
          isOverdue: isLate,
          diffDays: diff,
        };
      }));
      setLoadError("");
    }).catch(() => {
      if (active) setLoadError("Impossible de charger les données du tableau de bord. Vérifiez la connexion au backend et votre session.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleSendReminder = async (reminder: Reminder) => {
    if (remindingId || remindedIds[reminder.id]) return;
    setRemindingId(reminder.id);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(`/credits/${reminder.id}/relancer`);
      setRemindedIds((prev) => ({ ...prev, [reminder.id]: true }));
      setToast(res.data.message || `Rappel envoyé avec succès à ${reminder.name}`);
      window.setTimeout(() => setToast(""), 4000);
    } catch {
      setToast(`Échec de l'envoi du rappel pour ${reminder.name}.`);
      window.setTimeout(() => setToast(""), 4000);
    } finally {
      setRemindingId(null);
    }
  };

  const memberCount = dashboard?.overview.totalMembers ?? 0;
  const chartData = useMemo(() => {
    if (!dashboard) return [];
    if (period === "Annuel") {
      return dashboard.history.map((item) => {
        const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(`${item.month}-01T12:00:00`));
        if (chartMetric === "cashflow") {
          return {
            label: monthLabel,
            savings: currency === "USD" ? item.depotsUSD : item.depotsFC,
            loans: currency === "USD" ? (item.retraitsUSD || 0) : (item.retraitsFC || 0),
          };
        }
        return {
          label: monthLabel,
          savings: currency === "USD" ? item.depotsUSD : item.depotsFC,
          loans: currency === "USD" ? item.creditsUSD : item.creditsFC,
        };
      });
    }
    const days = period === "Hebdomadaire" ? 7 : 30;
    return dashboard.dailyHistory.slice(-days).map((item) => {
      const dayLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${item.date}T12:00:00`));
      if (chartMetric === "cashflow") {
        return {
          label: dayLabel,
          savings: currency === "USD" ? item.epargneUSD : item.epargneFC,
          loans: currency === "USD" ? (item.retraitUSD || 0) : (item.retraitFC || 0),
        };
      }
      return {
        label: dayLabel,
        savings: currency === "USD" ? item.epargneUSD : item.epargneFC,
        loans: currency === "USD" ? item.creditUSD : item.creditFC,
      };
    });
  }, [dashboard, period, currency, chartMetric]);

  const chartTotal = chartData.reduce((sum, point) => sum + point.savings, 0);

  // Distribution
  const activityTotal = dashboard?.activityDistribution.reduce((sum, item) => sum + item.total, 0) || 0;
  const distributionGradient = useMemo(() => {
    const segments = (dashboard?.activityDistribution || []).reduce<{ parts: string[]; cursor: number }>(
      (state, item, index) => {
        const end = state.cursor + (activityTotal ? (item.total / activityTotal) * 100 : 0);
        state.parts.push(`${activityPalette[index % activityPalette.length]} ${state.cursor}% ${end}%`);
        return { parts: state.parts, cursor: end };
      },
      { parts: [], cursor: 0 },
    ).parts;
    return segments.length ? `conic-gradient(${segments.join(",")})` : "#e5e7eb";
  }, [dashboard, activityTotal]);

  // Breakdown 6 accounts
  const savingsAccountsList = useMemo(() => {
    const list = dashboard?.savingsByType || [];
    const totalSum = list.reduce(
      (sum, acc) => sum + (currency === "USD" ? acc.totalUSD : acc.totalFC),
      0,
    );
    return list.map((acc) => {
      const val = currency === "USD" ? acc.totalUSD : acc.totalFC;
      const pct = totalSum > 0 ? Math.round((val / totalSum) * 100) : 0;
      return {
        ...acc,
        val,
        pct,
      };
    });
  }, [dashboard, currency]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesQuery =
        !query ||
        `${transaction.name} ${transaction.type} ${transaction.status}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesType =
        txTypeFilter === "ALL" ||
        transaction.type.toLowerCase().includes(txTypeFilter.toLowerCase());
      return matchesQuery && matchesType;
    });
  }, [query, transactions, txTypeFilter]);
  const paginatedTransactions = useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / transactionPageSize));
    const safePage = Math.min(transactionPage, pageCount);
    const start = (safePage - 1) * transactionPageSize;
    return filteredTransactions.slice(start, start + transactionPageSize);
  }, [filteredTransactions, transactionPage, transactionPageSize]);

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
        <div className="coop-page-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {isAdmin ? (
            <a href="#mw-guichets-section" className="mw-dialog-cancel" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
              <IconBuildingBank size={15} />
              <span>Guichets ({dashboard?.agentsCaisses?.length || 0})</span>
            </a>
          ) : (
            <div className="mw-dialog-cancel" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconBuildingBank size={15} />
              <span>{authUser?.guichet || myCaisse?.guichetAssigne || "Guichet Opérations"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────── */}
      {isAdmin ? (
        <section className="mw-kpis mw-kpis-5" aria-label={t.overview}>
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
              <div className="mw-kpi-sub" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span className="mw-kpi-badge-secondary">
                  {formatMoney(dashboard?.overview.totalEpargne.usd || 0, dashboard?.overview.totalEpargne.fc || 0).secondary}
                </span>
                {(dashboard?.overview.datStats?.activeCount ?? 0) > 0 && (
                  <span className="mw-kpi-badge-gold" title="Capital bloqué sous Dépôt à terme">
                    DAT: {money(currency === "USD" ? (dashboard?.overview.datStats?.totalCapitalUSD || 0) : (dashboard?.overview.datStats?.totalCapitalFC || 0), currency)}
                  </span>
                )}
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
              <div className="mw-kpi-sub" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span className="mw-kpi-badge-secondary">
                  {formatMoney(dashboard?.overview.activeCreditBalance.usd || 0, dashboard?.overview.activeCreditBalance.fc || 0).secondary}
                </span>
                <span className="mw-kpi-badge positive" title="Taux de remboursement global">
                  <IconTrendingUp size={12} />
                  {dashboard?.overview.repaymentRate ?? 0}% remboursé
                </span>
              </div>
            </div>
          </article>

          {/* Carte 4 : Portefeuille à Risque (PAR / Impayés) */}
          <article className="mw-kpi mw-kpi-bento">
            <div className="mw-kpi-top">
              <span className="mw-kpi-title">Crédits en Souffrance (PAR)</span>
              <span className={`mw-kpi-icon ${(dashboard?.overview.overdueCreditsCount ?? 0) > 0 ? "red" : "green"}`}>
                {(dashboard?.overview.overdueCreditsCount ?? 0) > 0 ? <IconAlertTriangle /> : <IconCheck />}
              </span>
            </div>
            <div className="mw-kpi-main">
              <div className="mw-kpi-value" style={{ color: (dashboard?.overview.overdueCreditsCount ?? 0) > 0 ? "var(--mw-red)" : "inherit" }}>
                {loading ? "…" : `${dashboard?.overview.overdueCreditsCount ?? 0} impayé${(dashboard?.overview.overdueCreditsCount ?? 0) > 1 ? "s" : ""}`}
              </div>
              <div className="mw-kpi-sub">
                {(dashboard?.overview.overdueCreditsCount ?? 0) > 0 ? (
                  <span className="mw-kpi-badge-danger">
                    Restant dû : {formatMoney(dashboard?.overview.overdueCreditBalance?.usd || 0, dashboard?.overview.overdueCreditBalance?.fc || 0).primary}
                  </span>
                ) : (
                  <span className="mw-kpi-subtext" style={{ color: "var(--mw-green)" }}>
                    Aucun retard constaté
                  </span>
                )}
              </div>
            </div>
          </article>

          {/* Carte 5 : Disponibilités Caisse */}
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
      ) : (
        /* Agent Bento Cards : Adaptées aux opérations et à la caisse du guichetier */
        <section className="mw-kpis mw-kpis-4" aria-label="Aperçu du guichet" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {/* Caisse USD */}
          <article className="mw-kpi mw-kpi-bento">
            <div className="mw-kpi-top">
              <span className="mw-kpi-title">Ma Caisse Guichet (USD)</span>
              <span className="mw-kpi-icon green">
                <IconWallet />
              </span>
            </div>
            <div className="mw-kpi-main">
              <div className="mw-kpi-value">
                {loading ? "…" : money(myCaisse?.soldes.usd || 0, "USD")}
              </div>
              <div className="mw-kpi-sub">
                <span className="mw-kpi-subtext">Liquidités disponibles USD</span>
              </div>
            </div>
          </article>

          {/* Caisse FC */}
          <article className="mw-kpi mw-kpi-bento">
            <div className="mw-kpi-top">
              <span className="mw-kpi-title">Ma Caisse Guichet (FC)</span>
              <span className="mw-kpi-icon blue">
                <IconBuildingBank />
              </span>
            </div>
            <div className="mw-kpi-main">
              <div className="mw-kpi-value">
                {loading ? "…" : money(myCaisse?.soldes.fc || 0, "FC")}
              </div>
              <div className="mw-kpi-sub">
                <span className="mw-kpi-subtext">Liquidités disponibles FC</span>
              </div>
            </div>
          </article>

          {/* Membres Actifs */}
          <article className="mw-kpi mw-kpi-bento">
            <div className="mw-kpi-top">
              <span className="mw-kpi-title">Membres Coopérative</span>
              <span className="mw-kpi-icon gold">
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

          {/* Guichet & Session */}
          <article className="mw-kpi mw-kpi-bento">
            <div className="mw-kpi-top">
              <span className="mw-kpi-title">Poste & Guichet</span>
              <span className="mw-kpi-icon green">
                <IconCheck />
              </span>
            </div>
            <div className="mw-kpi-main">
              <div className="mw-kpi-value" style={{ fontSize: "16px", fontWeight: 700 }}>
                {authUser?.guichet || myCaisse?.guichetAssigne || "Guichet Actif"}
              </div>
              <div className="mw-kpi-sub">
                <span className="mw-kpi-badge positive">
                  <IconCheck size={12} />
                  Session ouverte & opérationnelle
                </span>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* ── Dashboard Grid ──────────────────────────────────────── */}
      <div className="mw-dashboard-grid">
        <div className="mw-main-column">
          {/* Chart pour Admin ou Actions Rapides pour Agent */}
          {isAdmin ? (
            <section className="mw-panel mw-overview-panel" aria-labelledby="mw-chart-title">
            <div className="mw-panel-header" style={{ flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 id="mw-chart-title" style={{ margin: 0 }}>
                  {chartMetric === "contributions" ? "Epargnes & Crédits" : "Flux de Trésorerie (Dépôts vs Retraits)"}
                </h2>
                <div className="mw-periods" role="group" aria-label="Métrique">
                  <button
                    type="button"
                    className={`mw-period${chartMetric === "contributions" ? " is-active" : ""}`}
                    onClick={() => setChartMetric("contributions")}
                  >
                    Epargnes & Crédits
                  </button>
                  <button
                    type="button"
                    className={`mw-period${chartMetric === "cashflow" ? " is-active" : ""}`}
                    onClick={() => setChartMetric("cashflow")}
                  >
                    Dépôts vs Retraits
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div className="mw-periods" role="group" aria-label="Devise">
                  {(["USD", "FC"] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={`mw-period${currency === value ? " is-active" : ""}`}
                      aria-pressed={currency === value}
                      onClick={() => setCurrency(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="mw-periods" role="group" aria-label={t.chart}>
                  {[["Annuel", t.annual], ["Mensuel", t.monthly], ["Hebdomadaire", t.weekly]].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={`mw-period${period === value ? " is-active" : ""}`}
                      aria-pressed={period === value}
                      onClick={() => setPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mw-chart-summary">
              <strong className="mw-chart-total">{money(chartTotal, currency)}</strong>
              <span style={{ fontSize: "11px", color: "var(--mw-muted)", marginLeft: "8px" }}>
                {chartMetric === "contributions" ? "Total cotisé sur la période" : "Total dépôts sur la période"}
              </span>
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
                    <text x="1" y={y + 3} className="mw-chart-axis">
                      {Math.round((180 - y) * (Math.max(1, ...chartData.map((point) => point.savings), ...chartData.map((point) => point.loans)) / 150))}
                    </text>
                  </g>
                ))}
                {(() => {
                  const max = Math.max(1, ...chartData.flatMap((point) => [point.savings, point.loans]));
                  const coords = (key: "savings" | "loans") =>
                    chartData.map((point, index) => `${48 + (chartData.length < 2 ? 319 : (index * 638) / (chartData.length - 1))},${158 - (point[key] / max) * 132}`).join(" ");
                  const savingsPoints = coords("savings");
                  return (
                    <>
                      <polyline className="mw-line-contribution" points={savingsPoints} fill="none" />
                      <polyline className={chartMetric === "cashflow" ? "mw-line-loan" : "mw-line-loan"} points={coords("loans")} fill="none" />
                      {chartData.map((point, index) => (
                        <text
                          key={`${point.label}-${index}`}
                          x={48 + (chartData.length < 2 ? 319 : (index * 638) / (chartData.length - 1))}
                          y="184"
                          textAnchor="middle"
                          className={`mw-chart-axis mw-chart-month-label${index % 2 === 1 ? " is-hidden-on-mobile" : ""}`}
                        >
                          {point.label}
                        </text>
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div className="mw-chart-legend">
                <span className="mw-legend-item">
                  <i className="mw-legend-dot" />
                  {chartMetric === "contributions" ? t.contributions : "Dépôts (Entrées)"}
                </span>
                <span className="mw-legend-item">
                  <i className="mw-legend-dot gold" />
                  {chartMetric === "contributions" ? t.credit : "Retraits (Sorties)"}
                </span>
              </div>
            </div>
          </section>
          ) : (
            <section className="mw-panel mw-overview-panel" aria-labelledby="mw-agent-ops-title">
              <div className="mw-panel-header" style={{ flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="mw-kpi-icon blue">
                    <IconBuildingBank size={18} />
                  </span>
                  <div>
                    <h2 id="mw-agent-ops-title" style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                      Opérations de Guichet & Services Rapides
                    </h2>
                    <span style={{ fontSize: "11px", color: "var(--mw-muted)" }}>
                      Accès direct aux modules d&apos;encaissement, décaissement et gestion
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "14px" }}>
                <Link
                  href="/operations/depots-cotisations"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--mw-line)",
                    background: "var(--mw-paper)",
                    textDecoration: "none",
                    color: "inherit",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <span className="mw-kpi-icon green" style={{ width: "36px", height: "36px" }}>
                    <IconArrowDown size={18} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block", fontSize: "12.5px", color: "var(--mw-ink)" }}>Nouveau Dépôt</strong>
                    <span style={{ fontSize: "11px", color: "var(--mw-muted)" }}>Alimenter un compte épargne</span>
                  </div>
                  <IconChevronRight size={15} color="var(--mw-muted)" />
                </Link>

                <Link
                  href="/operations/retraits"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--mw-line)",
                    background: "var(--mw-paper)",
                    textDecoration: "none",
                    color: "inherit",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <span className="mw-kpi-icon orange" style={{ width: "36px", height: "36px" }}>
                    <IconArrowUp size={18} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block", fontSize: "12.5px", color: "var(--mw-ink)" }}>Nouveau Retrait</strong>
                    <span style={{ fontSize: "11px", color: "var(--mw-muted)" }}>Décaisser des fonds</span>
                  </div>
                  <IconChevronRight size={15} color="var(--mw-muted)" />
                </Link>

                <Link
                  href="/operations/remboursements"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--mw-line)",
                    background: "var(--mw-paper)",
                    textDecoration: "none",
                    color: "inherit",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <span className="mw-kpi-icon blue" style={{ width: "36px", height: "36px" }}>
                    <IconArrowsExchange size={18} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block", fontSize: "12.5px", color: "var(--mw-ink)" }}>Remboursement</strong>
                    <span style={{ fontSize: "11px", color: "var(--mw-muted)" }}>Paiement d&apos;échéance crédit</span>
                  </div>
                  <IconChevronRight size={15} color="var(--mw-muted)" />
                </Link>

                <Link
                  href="/membres"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--mw-line)",
                    background: "var(--mw-paper)",
                    textDecoration: "none",
                    color: "inherit",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <span className="mw-kpi-icon gold" style={{ width: "36px", height: "36px" }}>
                    <IconUserPlus size={18} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block", fontSize: "12.5px", color: "var(--mw-ink)" }}>Inscrire un Membre</strong>
                    <span style={{ fontSize: "11px", color: "var(--mw-muted)" }}>Créer une adhésion</span>
                  </div>
                  <IconChevronRight size={15} color="var(--mw-muted)" />
                </Link>
              </div>
            </section>
          )}

          {/* Transactions */}
          <section className="mw-panel" aria-labelledby="mw-transactions-title">
            <div className="mw-panel-header mw-transaction-head" style={{ flexWrap: "wrap", gap: "10px" }}>
              <h2 id="mw-transactions-title">{t.transactions}</h2>
              <div className="mw-transaction-actions" style={{ flexWrap: "wrap", gap: "8px" }}>
                <div className="mw-tx-filter-bar">
                  {[
                    ["ALL", "Toutes"],
                    ["Epargne", "Epargnes"],
                    ["Retrait", "Retraits"],
                    ["Crédit", "Crédits"],
                    ["Remboursement", "Remboursements"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`mw-tx-filter-btn${txTypeFilter === val ? " is-active" : ""}`}
                      onClick={() => {
                        setTxTypeFilter(val);
                        setTransactionPage(1);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="mw-table-search">
                  <IconSearch size={14} />
                  <input
                    placeholder={t.search}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setTransactionPage(1);
                    }}
                  />
                </label>
                {(query || txTypeFilter !== "ALL") && (
                  <button
                    type="button"
                    className="mw-link-button"
                    onClick={() => {
                      setQuery("");
                      setTxTypeFilter("ALL");
                      setTransactionPage(1);
                    }}
                  >
                    {t.viewAll}
                  </button>
                )}
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
                    paginatedTransactions.map((transaction) => (
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
                        <td>
                          <span className={`mw-status ${transaction.status}`}>
                            {t[transaction.status]}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="mw-empty">
                        {t.noResults}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {(query || txTypeFilter !== "ALL") && (
              <div className="mw-search-results">
                {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? "s" : ""} trouvée{filteredTransactions.length > 1 ? "s" : ""}
              </div>
            )}
            {filteredTransactions.length > 0 && (
              <CooperativePagination
                totalItems={filteredTransactions.length}
                page={transactionPage}
                pageSize={transactionPageSize}
                onPageChange={setTransactionPage}
                onPageSizeChange={(pageSize) => {
                  setTransactionPageSize(pageSize);
                  setTransactionPage(1);
                }}
                itemLabel="transactions"
              />
            )}
          </section>
        </div>

        {/* Right column */}
        <aside className="mw-right-column">
          {isAdmin ? (
            <>
              {/* Distribution Section (Comptes vs Activités) */}
              <section className="mw-panel mw-overview-panel" aria-labelledby="mw-distribution-title">
            <div className="mw-panel-header" style={{ flexWrap: "wrap", gap: "8px" }}>
              <h2 id="mw-distribution-title" style={{ margin: 0, fontSize: "13px" }}>
                {distributionTab === "accounts" ? "Comptes d'Épargne (6)" : t.distribution}
              </h2>
              <div className="mw-periods" role="group">
                <button
                  type="button"
                  className={`mw-period${distributionTab === "accounts" ? " is-active" : ""}`}
                  onClick={() => setDistributionTab("accounts")}
                >
                  Comptes
                </button>
                <button
                  type="button"
                  className={`mw-period${distributionTab === "activities" ? " is-active" : ""}`}
                  onClick={() => setDistributionTab("activities")}
                >
                  Secteurs
                </button>
              </div>
            </div>

            {distributionTab === "accounts" ? (
              <div className="mw-accounts-breakdown">
                {savingsAccountsList.map((acc) => {
                  return (
                    <div key={acc.typeCompte} className="mw-account-row">
                      <div className="mw-account-tag">
                        <span className="mw-account-tag-badge">
                          {acc.typeCompte[0]}
                        </span>
                        <div>
                          <strong>{acc.typeCompte}</strong>
                          <span style={{ display: "block", fontSize: "10px", color: "var(--mw-muted)" }}>
                            {acc.totalAccounts} compte{acc.totalAccounts > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="mw-account-vals">
                        <strong>{money(acc.val, currency)}</strong>
                            <span>{acc.pct}% de l&apos;épargne</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mw-donut-row">
                <div
                  className="mw-donut"
                  role="img"
                  aria-label={`${t.total}: ${memberCount.toLocaleString("fr-FR")}`}
                  style={{ background: distributionGradient }}
                >
                  <div className="mw-donut-center">
                    <strong>{memberCount.toLocaleString("fr-FR")}</strong>
                    <span>{t.total}</span>
                  </div>
                </div>
                <div className="mw-categories">
                  {(dashboard?.activityDistribution || []).map((item, index) => (
                    <span className="mw-category" key={item.activite}>
                      <i style={{ background: activityPalette[index % activityPalette.length] }} />
                      {item.activite}
                      <strong>{activityTotal ? Math.round((item.total / activityTotal) * 100) : 0}%</strong>
                    </span>
                  ))}
                  {!loading && dashboard?.activityDistribution.length === 0 && (
                    <span className="mw-empty">Aucune activité renseignée</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Reminders / Échéances et Alertes */}
          <section className="mw-panel" aria-labelledby="mw-reminders-title">
            <div className="mw-panel-header">
              <h2 id="mw-reminders-title">{t.reminders}</h2>
              <span className="mw-kpi-icon gold">
                <IconClock />
              </span>
            </div>
            <div className="mw-reminder-list">
              {reminders.length > 0 ? (
                reminders.map((reminder) => (
                  <div className="mw-reminder" key={reminder.id} style={{ alignItems: "center" }}>
                    <span className={`mw-reminder-mark ${reminder.isOverdue ? "red" : ""}`}>
                      {reminder.isOverdue ? <IconAlertTriangle size={15} color="var(--mw-red)" /> : <IconCalendar size={15} />}
                    </span>
                    <div className="mw-reminder-info" style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {reminder.name}
                      </strong>
                      <span style={{ display: "block" }}>
                        {reminder.detail} · <strong>{reminder.amount}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`mw-reminder-btn${remindedIds[reminder.id] ? " is-sent" : ""}`}
                      onClick={() => handleSendReminder(reminder)}
                      disabled={remindingId === reminder.id || Boolean(remindedIds[reminder.id])}
                      title="Envoyer un rappel de paiement"
                    >
                      {remindedIds[reminder.id] ? (
                        <>
                          <IconCheck size={12} />
                          <span>Envoyé</span>
                        </>
                      ) : remindingId === reminder.id ? (
                        <span>Envoi…</span>
                      ) : (
                        <>
                          <IconSend size={12} />
                          <span>Rappeler</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <p className="mw-empty" style={{ margin: "10px 0" }}>
                  Aucune échéance urgente dans les 30 prochains jours.
                </p>
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Situation de ma Caisse Guichet */}
          <section className="mw-panel mw-overview-panel">
            <div className="mw-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="mw-kpi-icon green" style={{ width: "26px", height: "26px" }}>
                  <IconWallet size={15} />
                </span>
                <h2 style={{ margin: 0, fontSize: "13px" }}>Situation de ma Caisse</h2>
              </div>
              <span className="mw-dot-green" title="Guichet ouvert" />
            </div>
            <div style={{ padding: "10px 0", display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--mw-canvas)", borderRadius: "8px", border: "1px solid var(--mw-line)" }}>
                <span style={{ fontSize: "11.5px", color: "var(--mw-muted)" }}>Guichet assigné</span>
                <strong style={{ fontSize: "12px" }}>{authUser?.guichet || myCaisse?.guichetAssigne || "Guichet 1"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--mw-canvas)", borderRadius: "8px", border: "1px solid var(--mw-line)" }}>
                <span style={{ fontSize: "11.5px", color: "var(--mw-muted)" }}>Liquidités USD</span>
                <strong style={{ fontSize: "13px", color: "var(--mw-green)" }}>{money(myCaisse?.soldes.usd || 0, "USD")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--mw-canvas)", borderRadius: "8px", border: "1px solid var(--mw-line)" }}>
                <span style={{ fontSize: "11.5px", color: "var(--mw-muted)" }}>Liquidités FC</span>
                <strong style={{ fontSize: "13px", color: "var(--mw-primary)" }}>{money(myCaisse?.soldes.fc || 0, "FC")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--mw-canvas)", borderRadius: "8px", border: "1px solid var(--mw-line)" }}>
                <span style={{ fontSize: "11.5px", color: "var(--mw-muted)" }}>Agent connecté</span>
                <strong style={{ fontSize: "12px" }}>{authUser?.fullName || "Agent"}</strong>
              </div>
            </div>
          </section>

          {/* Assistance & Raccourcis */}
          <section className="mw-panel mw-overview-panel">
            <div className="mw-panel-header">
              <h2 style={{ margin: 0, fontSize: "13px" }}>Centre d&apos;Assistance</h2>
              <Link href="/support" className="mw-link-button" style={{ textDecoration: "none" }}>
                Ouvrir
              </Link>
            </div>
            <p style={{ fontSize: "12px", color: "var(--mw-muted)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Besoin d&apos;aide sur une transaction ou une régularisation de caisse ? Consultez le support ou contactez la direction.
            </p>
          </section>
        </>
      )}
    </aside>
  </div>

  {/* ── Section Guichets & Caisses Agents (Visible uniquement pour Admin / SuperAdmin) ── */}
  {isAdmin && (
    <section id="mw-guichets-section" className="mw-panel mw-guichets-panel" aria-labelledby="mw-guichets-title">
        <div className="mw-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="mw-kpi-icon blue">
              <IconBuildingBank size={18} />
            </span>
            <div>
              <h2 id="mw-guichets-title" style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                Situation des Caisses & Guichets (En direct)
              </h2>
              <span style={{ fontSize: "11px", color: "var(--mw-muted)" }}>
                Suivi des liquidités disponibles par guichet et agent assigné
              </span>
            </div>
          </div>
          <Link href="/agents" className="mw-link-button" style={{ textDecoration: "none" }}>
            Gérer les agents
          </Link>
        </div>
        <div className="mw-guichets-grid" role="list" aria-label="Agents et soldes des caisses">
          {dashboard?.agentsCaisses && dashboard.agentsCaisses.length > 0 ? (
            dashboard.agentsCaisses.map((ag) => (
              <article key={ag.id} className="mw-guichet-card" role="listitem">
                <div className="mw-guichet-identity">
                  <div className="mw-guichet-name">
                    <span className="mw-dot-green" aria-hidden="true" />
                    <strong>{ag.nom}</strong>
                  </div>
                  <span className="mw-guichet-desk">{ag.guichetAssigne}</span>
                </div>
                <div className="mw-guichet-balances">
                  <div className="mw-guichet-currency-item">
                    <span className="mw-guichet-currency-label">Caisse USD</span>
                    <strong className="mw-guichet-currency-value">{money(ag.soldes.usd, "USD")}</strong>
                  </div>
                  <div className="mw-guichet-currency-item" style={{ textAlign: "right" }}>
                    <span className="mw-guichet-currency-label">Caisse FC</span>
                    <strong className="mw-guichet-currency-value">{money(ag.soldes.fc, "FC")}</strong>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div style={{ padding: "16px", color: "var(--mw-muted)", textAlign: "center", gridColumn: "1 / -1" }}>
              Aucun agent ou guichet configuré pour le moment. Accédez à l&apos;onglet{" "}
              <Link href="/agents" style={{ color: "var(--mw-primary)", fontWeight: 600 }}>
                Agents
              </Link>{" "}
              pour ouvrir des caisses.
            </div>
          )}
        </div>
      </section>
      )}

      {loading && <p className="mw-empty" role="status">Chargement des données du dashboard…</p>}
      {loadError && <p className="mw-empty" role="alert">{loadError}</p>}

      {toast && (<div className="mw-toast" role="status">{toast}</div>)}
    </div>
  );
}
