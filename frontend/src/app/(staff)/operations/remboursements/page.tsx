'use client';

import {
  IconAlertTriangle,
  IconBellRinging,
  IconCheck,
  IconClock,
  IconCoins,
  IconSearch,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
import { CooperativePagination } from "@/components/cooperative/CooperativePagination";
import {
  CooperativeBreadcrumb,
  CooperativeStatCard,
  formatCurrency,
  formatDate,
} from "@/components/cooperative/CooperativePrimitives";
import { useCooperativeDarkTheme } from "@/components/cooperative/CooperativeThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { apiClient, getAuthUser } from "@/lib/auth";
import { formatMixedCurrency } from "@/lib/format-currency";

type Currency = "USD" | "FC";
type BadgeTone = "valid" | "pending" | "rejected";

/** Ligne de GET /api/remboursements (mapToResponse). */
type RepaymentItem = {
  id: number;
  creditId: number;
  montant: number;
  devise: Currency;
  dateRemboursement: string;
  ventilation: { principal: number; interets: number };
  description: string | null;
  memberName: string;
  memberInitials: string;
  accountId: string;
  totalDue: number;
  paidAmount: number;
  remainingAmount: number;
  progressPercent: number;
  status: "active" | "completed" | "overdue";
};

type RepaymentsResponse = {
  data: RepaymentItem[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
};

/** Ligne de GET /api/credits/echeances. */
type DueCredit = {
  id: number;
  memberId: number;
  memberName: string;
  telephone: string | null;
  dueDate: string;
  amountRemaining: number;
  currency: Currency;
  status: string;
  diffDays: number;
  isOverdue: boolean;
};

type CreditStats = {
  overdueAmount: { usd: number; fc: number };
  overdueCount: number;
};

/** Crédit brut renvoyé par GET /api/credits/membre/:numero. */
type MemberCredit = {
  id: number;
  montant: string | number;
  montantRembourse: string | number;
  tauxInteret: string | number;
  devise: string;
  statut: string;
  duree: number;
  dateDebut: string;
  dateEcheance: string | null;
};

/** Mouvement de caisse d'agent — GET /api/withdrawals/caisse/moi/mouvements. */
type CashMovement = {
  id: number;
  type: string;
  devise: Currency;
  montant: number;
  soldeApres: number;
  motif: string | null;
  createdAt: string;
};

const tabs = ["À venir", "En retard", "Historique"] as const;
const periods = ["Toutes les périodes", "Ce mois", "30 derniers jours"] as const;
type RepaymentTab = (typeof tabs)[number];

const repaymentStatus: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Crédit actif", tone: "valid" },
  completed: { label: "Crédit soldé", tone: "valid" },
  overdue: { label: "En retard", tone: "pending" },
};

export function meta() {
  return [{ title: "Remboursements — Mwangaza Wetu" }];
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join(" ");
  if (typeof message === "string" && message) return message;
  return fallback;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKeyOf(iso: string) {
  return iso.slice(0, 10);
}

/** Total dû (capital + intérêts) d'un crédit renvoyé par GET /credits/membre/:numero. */
function creditTotalDue(credit: MemberCredit) {
  return Number(credit.montant) * (1 + Number(credit.tauxInteret || 0) / 100);
}

function creditReste(credit: MemberCredit) {
  return Math.max(0, creditTotalDue(credit) - Number(credit.montantRembourse || 0));
}

function delayLabel(echeance: DueCredit) {
  if (echeance.diffDays < 0) return `${Math.abs(echeance.diffDays)} j de retard`;
  if (echeance.diffDays === 0) return "Aujourd’hui";
  return `Dans ${echeance.diffDays} j`;
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return <span className={`coop-status coop-status--${tone}`}>{label}</span>;
}

export default function RepaymentsRoute() {
  const dark = useCooperativeDarkTheme();
  const [role, setRole] = useState<string | null>(null);
  const [history, setHistory] = useState<RepaymentItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [echeances, setEcheances] = useState<DueCredit[]>([]);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<RepaymentTab>("À venir");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Encaissement (admin + agent) — POST /remboursements/add
  const [payOpen, setPayOpen] = useState(false);
  const [compteInput, setCompteInput] = useState("");
  const [memberCheck, setMemberCheck] = useState<{
    compte: string;
    nomComplet: string;
  } | null>(null);
  const [memberCredits, setMemberCredits] = useState<MemberCredit[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState("");
  const [montant, setMontant] = useState(0);
  const [payDate, setPayDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");

  const isDirection = role === "admin" || role === "superadmin";
  const isAgent = role === "agent";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isAgent) {
        // L'historique global est réservé à la direction : l'agent voit les
        // encaissements crédités à sa propre caisse.
        const response = await apiClient.get<CashMovement[]>(
          "/withdrawals/caisse/moi/mouvements",
          { params: { limit: 100 } },
        );
        setMovements(
          response.data.filter(
            (movement) => movement.type === "REMBOURSEMENT_CREDIT",
          ),
        );
        setHistory([]);
        setHistoryTotal(0);
        setEcheances([]);
        setStats(null);
      } else {
        const all: RepaymentItem[] = [];
        let current = 1;
        let totalPages = 1;
        let total = 0;
        do {
          const pageResponse = await apiClient.get<RepaymentsResponse>(
            "/remboursements",
            { params: { page: current, pageSize: 100 } },
          );
          all.push(...pageResponse.data.data);
          totalPages = pageResponse.data.meta.totalPages || 1;
          total = pageResponse.data.meta.total;
          current += 1;
        } while (current <= totalPages && current <= 30);
        const [echeancesResponse, statsResponse] = await Promise.all([
          apiClient.get<{ data: DueCredit[] }>("/credits/echeances", {
            params: { limit: 20, days: 30 },
          }),
          apiClient.get<CreditStats>("/credits/stats"),
        ]);
        setHistory(all);
        setHistoryTotal(total);
        setEcheances(echeancesResponse.data.data);
        setStats(statsResponse.data);
        setMovements([]);
      }
    } catch (error) {
      setHistory([]);
      setHistoryTotal(0);
      setEcheances([]);
      setStats(null);
      setMovements([]);
      setLoadError(
        apiErrorMessage(
          error,
          "Impossible de charger les remboursements depuis le backend.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [isAgent]);

  useEffect(() => {
    setRole(getAuthUser()?.role ?? "admin");
  }, []);

  useEffect(() => {
    if (role && (isDirection || isAgent)) void load();
  }, [role, isDirection, isAgent, load]);

  const upcoming = useMemo(() => echeances.filter((item) => !item.isOverdue), [echeances]);
  const overdue = useMemo(() => echeances.filter((item) => item.isOverdue), [echeances]);

  const filteredHistory = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    const now = new Date();
    const monthKey = monthKeyOf(now);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const thirtyDaysKey = dayKey(thirtyDaysAgo);
    const todayKey = dayKey(now);
    return history
      .filter((item) =>
        `${item.memberName} ${item.accountId} CRD-${item.creditId} ${item.description ?? ""}`
          .toLocaleLowerCase("fr-FR")
          .includes(search),
      )
      .filter((item) => {
        if (period === periods[0]) return true;
        const key = dateKeyOf(item.dateRemboursement);
        if (period === periods[1]) return key.startsWith(monthKey);
        return key >= thirtyDaysKey && key <= todayKey;
      });
  }, [history, period, query]);

  const filteredEcheances = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    const source = activeTab === "En retard" ? overdue : upcoming;
    return source.filter((item) =>
      `${item.memberName} ${item.telephone ?? ""} CRD-${item.id}`
        .toLocaleLowerCase("fr-FR")
        .includes(search),
    );
  }, [activeTab, overdue, query, upcoming]);

  const filteredMovements = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    const now = new Date();
    const monthKey = monthKeyOf(now);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const thirtyDaysKey = dayKey(thirtyDaysAgo);
    const todayKey = dayKey(now);
    return movements
      .filter((movement) =>
        `${movement.motif ?? ""} ${movement.devise}`
          .toLocaleLowerCase("fr-FR")
          .includes(search),
      )
      .filter((movement) => {
        if (period === periods[0]) return true;
        const key = dateKeyOf(movement.createdAt);
        if (period === periods[1]) return key.startsWith(monthKey);
        return key >= thirtyDaysKey && key <= todayKey;
      });
  }, [movements, period, query]);

  const rowCount = isAgent
    ? filteredMovements.length
    : activeTab === "Historique"
      ? filteredHistory.length
      : filteredEcheances.length;
  const pageStart = (page - 1) * pageSize;

  const selected = history.find((item) => item.id === selectedId) ?? null;
  const selectedCredit =
    memberCredits.find((credit) => String(credit.id) === selectedCreditId) ?? null;
  const reste = selectedCredit ? creditReste(selectedCredit) : 0;

  const counts: Record<RepaymentTab, number> = {
    "À venir": upcoming.length,
    "En retard": overdue.length,
    Historique: history.length,
  };

  const now = new Date();
  const monthKey = monthKeyOf(now);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);
  const thirtyDaysKey = dayKey(thirtyDaysAgo);
  const todayKey = dayKey(now);

  const historyThisMonth = history.filter((item) =>
    dateKeyOf(item.dateRemboursement).startsWith(monthKey),
  );
  const movementsThisMonth = movements.filter((movement) =>
    dateKeyOf(movement.createdAt).startsWith(monthKey),
  );
  const movements30Days = movements.filter((movement) => {
    const key = dateKeyOf(movement.createdAt);
    return key >= thirtyDaysKey && key <= todayKey;
  });

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  /** POST /credits/:id/relancer — notification interne au membre. */
  async function remind(creditId: number) {
    setRemindingId(creditId);
    setActionError("");
    try {
      const response = await apiClient.post<{ message?: string }>(
        `/credits/${creditId}/relancer`,
      );
      setSuccess(
        response.data.message ||
          `Rappel envoyé pour le crédit CRD-${creditId}.`,
      );
    } catch (error) {
      setActionError(
        apiErrorMessage(
          error,
          `Le rappel du crédit CRD-${creditId} n’a pas pu être envoyé.`,
        ),
      );
    } finally {
      setRemindingId(null);
    }
  }

  function applyCreditSelection(credit: MemberCredit) {
    setSelectedCreditId(String(credit.id));
    setMontant(Math.round(creditReste(credit) * 100) / 100);
    setPayError("");
  }

  async function loadMemberCredits(numero: string, preselectId?: number) {
    setCreditsLoading(true);
    try {
      const response = await apiClient.get<MemberCredit[]>(
        `/credits/membre/${encodeURIComponent(numero)}`,
      );
      const open = response.data.filter((credit) => credit.statut !== "rembourse");
      setMemberCredits(open);
      const preselect =
        preselectId !== undefined
          ? open.find((credit) => credit.id === preselectId)
          : undefined;
      if (preselect) {
        applyCreditSelection(preselect);
      } else if (open.length === 1) {
        applyCreditSelection(open[0]);
      } else {
        setSelectedCreditId("");
        setMontant(0);
      }
      if (open.length === 0) {
        setPayError("Aucun crédit en cours pour ce membre (crédit soldé).");
      }
    } catch (error) {
      setMemberCredits([]);
      setSelectedCreditId("");
      setMontant(0);
      setPayError(
        apiErrorMessage(error, "Impossible de charger les crédits du membre."),
      );
    } finally {
      setCreditsLoading(false);
    }
  }

  async function verifyMember() {
    const compte = compteInput.trim();
    if (!compte) {
      setPayError("Saisissez le numéro de compte du membre.");
      return;
    }
    setVerifying(true);
    setMemberCheck(null);
    setMemberCredits([]);
    setSelectedCreditId("");
    setMontant(0);
    setPayError("");
    try {
      const response = await apiClient.get<{
        exists: boolean;
        membre?: { numeroCompte: string; nomComplet: string };
      }>(`/membres/by-numero/${encodeURIComponent(compte)}`);
      if (!response.data.exists || !response.data.membre) {
        setPayError("Aucun membre trouvé pour ce numéro de compte.");
        return;
      }
      setMemberCheck({
        compte: response.data.membre.numeroCompte,
        nomComplet: response.data.membre.nomComplet,
      });
      await loadMemberCredits(response.data.membre.numeroCompte);
    } catch (error) {
      setPayError(apiErrorMessage(error, "Impossible de vérifier ce compte."));
    } finally {
      setVerifying(false);
    }
  }

  /** Action « Encaisser » d'une échéance : résout le numéro de compte puis charge les crédits. */
  async function bootstrapPayment(memberId: number, creditId: number) {
    setVerifying(true);
    try {
      const member = await apiClient.get<{
        numeroCompte: string;
        nomComplet: string;
      }>(`/membres/${memberId}`);
      setCompteInput(member.data.numeroCompte);
      setMemberCheck({
        compte: member.data.numeroCompte,
        nomComplet: member.data.nomComplet,
      });
      await loadMemberCredits(member.data.numeroCompte, creditId);
    } catch (error) {
      setPayError(
        apiErrorMessage(error, "Impossible de préparer l’encaissement."),
      );
    } finally {
      setVerifying(false);
    }
  }

  function openPayment(memberId?: number, creditId?: number) {
    setPayError("");
    setCompteInput("");
    setMemberCheck(null);
    setMemberCredits([]);
    setSelectedCreditId("");
    setMontant(0);
    setPayDate(todayIso());
    setDescription("");
    setPayOpen(true);
    if (memberId !== undefined && creditId !== undefined) {
      void bootstrapPayment(memberId, creditId);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberCheck) {
      setPayError("Vérifiez d’abord le compte du membre.");
      return;
    }
    if (!selectedCredit) {
      setPayError("Choisissez le crédit à rembourser.");
      return;
    }
    if (!(montant > 0)) {
      setPayError("Indiquez un montant supérieur à zéro.");
      return;
    }
    if (montant > reste + 0.01) {
      setPayError(
        `Le montant dépasse le reste à payer (${formatCurrency(reste, selectedCredit.devise)}).`,
      );
      return;
    }
    setPayBusy(true);
    setPayError("");
    try {
      const response = await apiClient.post<RepaymentItem>(
        "/remboursements/add",
        {
          creditId: selectedCredit.id,
          montant,
          devise: selectedCredit.devise,
          dateRemboursement: payDate,
          description: description.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setPayOpen(false);
      setSuccess(
        `Remboursement enregistré pour ${response.data.memberName || memberCheck.nomComplet} : ${formatCurrency(response.data.montant, response.data.devise)}. Solde restant CRD-${response.data.creditId} : ${formatCurrency(response.data.remainingAmount, response.data.devise)}.`,
      );
      await load();
    } catch (error) {
      setPayError(
        apiErrorMessage(
          error,
          "Le remboursement n’a pas pu être enregistré.",
        ),
      );
    } finally {
      setPayBusy(false);
    }
  }

  if (role === null) {
    return (
      <div className="coop-operations-page coop-repayment-page">
        <CooperativeDataState loading error={false} empty={false}>
          <span />
        </CooperativeDataState>
      </div>
    );
  }

  if (!isDirection && !isAgent) {
    return (
      <div className="coop-operations-page coop-repayment-page">
        <div className="coop-page-heading">
          <div>
            <CooperativeBreadcrumb section="Opérations" current="Remboursements" />
            <h1>Remboursements</h1>
            <p>Suivi des échéances et des paiements de crédit.</p>
          </div>
        </div>
        <section className="mw-panel coop-operations-panel">
          <div className="coop-empty-state" role="status">
            <IconWallet aria-hidden="true" />
            <span>
              Cette section est réservée au personnel (direction / guichet).
            </span>
          </div>
        </section>
      </div>
    );
  }

  const listEmptyMessage = isAgent
    ? movements.length === 0
      ? "Aucun encaissement de remboursement sur les 100 derniers mouvements de caisse."
      : "Aucun encaissement ne correspond à ces filtres."
    : activeTab === "Historique"
      ? history.length === 0
        ? "Aucun remboursement enregistré pour le moment."
        : "Aucun paiement ne correspond à ces filtres."
      : activeTab === "En retard"
        ? overdue.length === 0
          ? "Aucun crédit en retard sur les 30 jours analysés."
          : "Aucune échéance en retard ne correspond à cette recherche."
        : upcoming.length === 0
          ? "Aucune échéance dans les 30 prochains jours."
          : "Aucune échéance ne correspond à cette recherche.";

  return (
    <div className="coop-operations-page coop-repayment-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Remboursements" />
          <h1>Remboursements</h1>
          <p>
            {isAgent
              ? "Encaissement des remboursements de crédit au guichet."
              : "Suivi des échéances et des paiements de crédit."}
          </p>
        </div>
        <div className="coop-page-actions">
          <button
            className="mw-primary"
            type="button"
            onClick={() => openPayment()}
          >
            <IconWallet aria-hidden="true" />
            Enregistrer un remboursement
          </button>
        </div>
      </div>

      {success && (
        <div className="coop-inline-success" role="status">
          <IconCheck aria-hidden="true" />
          {success}
          <button
            type="button"
            aria-label="Fermer le message"
            onClick={() => setSuccess("")}
          >
            <IconX aria-hidden="true" />
          </button>
        </div>
      )}

      {loadError && (
        <p className="coop-form-error" role="alert">
          {loadError}{" "}
          <button type="button" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      )}

      {actionError && (
        <p className="coop-form-error" role="alert">
          {actionError}
        </p>
      )}

      {!loading && !loadError && isDirection && stats && (
        <section className="coop-stat-grid" aria-label="Indicateurs des remboursements">
          <CooperativeStatCard
            label="Reçus ce mois"
            value={formatMixedCurrency(
              historyThisMonth.map((item) => ({
                amount: item.montant,
                currency: item.devise,
              })),
            )}
            detail={`${historyThisMonth.length} paiement${historyThisMonth.length > 1 ? "s" : ""} enregistré${historyThisMonth.length > 1 ? "s" : ""}`}
            icon={IconWallet}
          />
          <CooperativeStatCard
            label="Cumul encaissé"
            value={formatMixedCurrency(
              history.map((item) => ({
                amount: item.montant,
                currency: item.devise,
              })),
            )}
            detail={`${historyTotal} paiements enregistrés`}
            icon={IconCoins}
            accent="#4384b5"
          />
          <CooperativeStatCard
            label="Échéances sous 30 jours"
            value={upcoming.length}
            detail={`${formatMixedCurrency(
              upcoming.map((item) => ({
                amount: item.amountRemaining,
                currency: item.currency,
              })),
            )} à recouvrer`}
            icon={IconClock}
            accent="#c18c2d"
          />
          <CooperativeStatCard
            label="Crédits en retard"
            value={stats.overdueCount}
            detail={formatMixedCurrency([
              { amount: stats.overdueAmount.usd, currency: "USD" },
              { amount: stats.overdueAmount.fc, currency: "FC" },
            ])}
            icon={IconAlertTriangle}
            accent="#c95151"
          />
        </section>
      )}

      {!loading && !loadError && isAgent && (
        <section className="coop-stat-grid" aria-label="Indicateurs de caisse">
          <CooperativeStatCard
            label="Encaissé ce mois"
            value={formatMixedCurrency(
              movementsThisMonth.map((movement) => ({
                amount: movement.montant,
                currency: movement.devise,
              })),
            )}
            detail={`${movementsThisMonth.length} encaissement${movementsThisMonth.length > 1 ? "s" : ""}`}
            icon={IconWallet}
          />
          <CooperativeStatCard
            label="Encaissé (30 jours)"
            value={formatMixedCurrency(
              movements30Days.map((movement) => ({
                amount: movement.montant,
                currency: movement.devise,
              })),
            )}
            detail="Sur les 100 derniers mouvements"
            icon={IconClock}
            accent="#c18c2d"
          />
          <CooperativeStatCard
            label="Cumul encaissé"
            value={formatMixedCurrency(
              movements.map((movement) => ({
                amount: movement.montant,
                currency: movement.devise,
              })),
            )}
            detail={`${movements.length} mouvements de caisse`}
            icon={IconCoins}
            accent="#4384b5"
          />
        </section>
      )}

      <section className="mw-panel coop-operations-panel" aria-label="Remboursements">
        {isDirection ? (
          <div
            className="coop-withdrawal-tabs"
            role="tablist"
            aria-label="Filtrer les remboursements"
          >
            {tabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "is-active" : ""}
                key={tab}
                onClick={() => changeFilter(() => setActiveTab(tab))}
              >
                {tab}
                <span>{counts[tab]}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="coop-muted-copy">
            Vous voyez ici les remboursements encaissés par votre caisse.
            L’historique complet est réservé à la direction.
          </p>
        )}

        <div className="coop-filter-bar">
          <label className="coop-filter-search">
            <IconSearch aria-hidden="true" />
            <input
              type="search"
              value={query}
              aria-label="Rechercher un membre ou une référence de crédit"
              placeholder="Membre, téléphone ou référence (CRD-…)…"
              onChange={(event) => changeFilter(() => setQuery(event.target.value))}
            />
          </label>
          {(isAgent || activeTab === "Historique") && (
            <label className="coop-filter-select">
              <span className="sr-only">Période</span>
              <select
                value={period}
                onChange={(event) =>
                  changeFilter(() =>
                    setPeriod(event.target.value as (typeof periods)[number]),
                  )
                }
              >
                {periods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {isDirection && activeTab !== "Historique" && echeances.length > 0 && (
          <p className="coop-muted-copy">
            {echeances.length} échéance{echeances.length > 1 ? "s" : ""} les
            plus urgentes affichées (limite serveur : 20, fenêtre de 30 jours).
          </p>
        )}

        <CooperativeDataState
          loading={loading}
          error={Boolean(loadError)}
          empty={rowCount === 0}
          emptyMessage={listEmptyMessage}
        >
          {isAgent ? (
            <div className="coop-table-scroll">
              <table className="mw-table coop-repayment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Montant</th>
                    <th>Solde après opération</th>
                    <th>Opération</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements
                    .slice(pageStart, pageStart + pageSize)
                    .map((movement) => (
                      <tr key={movement.id}>
                        <td>{formatDate(movement.createdAt)}</td>
                        <td className="coop-amount-cell">
                          {formatCurrency(movement.montant, movement.devise)}
                        </td>
                        <td className="coop-amount-cell">
                          {formatCurrency(movement.soldeApres, movement.devise)}
                        </td>
                        <td>{movement.motif || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === "Historique" ? (
            <div className="coop-table-scroll">
              <table className="mw-table coop-repayment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Membre</th>
                    <th>Crédit</th>
                    <th>Montant</th>
                    <th>Principal</th>
                    <th>Intérêts</th>
                    <th>Solde restant</th>
                    <th>Statut du crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory
                    .slice(pageStart, pageStart + pageSize)
                    .map((item) => {
                      const status = repaymentStatus[item.status] ?? {
                        label: item.status,
                        tone: "pending" as BadgeTone,
                      };
                      return (
                        <tr
                          key={item.id}
                          tabIndex={0}
                          onClick={() => setSelectedId(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(item.id);
                            }
                          }}
                        >
                          <td>{formatDate(item.dateRemboursement)}</td>
                          <td>
                            <span className="mw-member">
                              <span className="mw-member-avatar">
                                {item.memberInitials || "?"}
                              </span>
                              <span>{item.memberName || "Membre"}</span>
                            </span>
                          </td>
                          <td>
                            <strong>CRD-{item.creditId}</strong>
                          </td>
                          <td className="coop-amount-cell">
                            {formatCurrency(item.montant, item.devise)}
                          </td>
                          <td>
                            {formatCurrency(item.ventilation.principal, item.devise)}
                          </td>
                          <td>
                            {formatCurrency(item.ventilation.interets, item.devise)}
                          </td>
                          <td className="coop-amount-cell">
                            {formatCurrency(item.remainingAmount, item.devise)}
                          </td>
                          <td>
                            <StatusBadge label={status.label} tone={status.tone} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="coop-table-scroll">
              <table className="mw-table coop-repayment-table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Crédit</th>
                    <th>Téléphone</th>
                    <th>Échéance finale</th>
                    <th>Délai</th>
                    <th>Solde restant</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEcheances
                    .slice(pageStart, pageStart + pageSize)
                    .map((echeance) => (
                      <tr key={echeance.id}>
                        <td>
                          <span className="mw-member">
                            <span className="mw-member-avatar">
                              {echeance.memberName
                                .split(" ")
                                .map((part) => part[0])
                                .filter(Boolean)
                                .slice(0, 2)
                                .join("")
                                .toUpperCase() || "?"}
                            </span>
                            <span>{echeance.memberName}</span>
                          </span>
                        </td>
                        <td>
                          <strong>CRD-{echeance.id}</strong>
                        </td>
                        <td>{echeance.telephone || "—"}</td>
                        <td>{formatDate(echeance.dueDate)}</td>
                        <td>
                          <span>{delayLabel(echeance)}</span>
                        </td>
                        <td className="coop-amount-cell">
                          {formatCurrency(
                            echeance.amountRemaining,
                            echeance.currency,
                          )}
                        </td>
                        <td>
                          {echeance.isOverdue ? (
                            <StatusBadge label="En retard" tone="pending" />
                          ) : (
                            <StatusBadge label="À venir" tone="valid" />
                          )}
                        </td>
                        <td>
                          <div className="coop-repayment-row-actions">
                            <button
                              className="mw-secondary"
                              type="button"
                              onClick={() =>
                                openPayment(echeance.memberId, echeance.id)
                              }
                            >
                              Encaisser
                            </button>
                            <button
                              className="mw-secondary"
                              type="button"
                              title="Envoyer une notification interne au membre"
                              disabled={remindingId === echeance.id}
                              onClick={() => void remind(echeance.id)}
                            >
                              <IconBellRinging aria-hidden="true" />
                              {remindingId === echeance.id
                                ? "Envoi…"
                                : "Rappeler"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CooperativeDataState>

        <CooperativePagination
          totalItems={rowCount}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          itemLabel={activeTab === "Historique" ? "paiements" : "échéances"}
        />
      </section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent
          data-theme={dark ? "dark" : "light"}
          className="coop-member-drawer coop-repayment-drawer"
          side="right"
        >
          <SheetTitle className="coop-drawer-title">
            Détail du remboursement
          </SheetTitle>
          {selected && <RepaymentDetails item={selected} />}
        </SheetContent>
      </Sheet>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog coop-payment-dialog"
        >
          <DialogHeader>
            <DialogTitle>Enregistrer un remboursement</DialogTitle>
            <DialogDescription>
              Le paiement est encaissé au guichet et met immédiatement à jour le
              solde du crédit.
              {isAgent && " Le montant est crédité à votre caisse d’agent."}
            </DialogDescription>
          </DialogHeader>
          <form className="coop-operation-form" onSubmit={submitPayment}>
            <div className="coop-form-field">
              <label htmlFor="remboursement-compte">Compte du membre</label>
              <span className="coop-form-grid">
                <input
                  id="remboursement-compte"
                  value={compteInput}
                  onChange={(event) => {
                    setCompteInput(event.target.value);
                    setMemberCheck(null);
                    setMemberCredits([]);
                    setSelectedCreditId("");
                    setMontant(0);
                  }}
                  placeholder="Ex. MW-2025-0001"
                  disabled={verifying && memberCheck !== null}
                  required
                />
                <button
                  className="mw-secondary"
                  type="button"
                  onClick={() => void verifyMember()}
                  disabled={verifying || creditsLoading}
                >
                  {verifying || creditsLoading ? "Chargement…" : "Vérifier"}
                </button>
              </span>
            </div>

            {memberCheck && (
              <div className="coop-credit-eligibility">
                <span>Membre</span>
                <strong>{memberCheck.nomComplet}</strong>
                <span>Compte</span>
                <strong>{memberCheck.compte}</strong>
              </div>
            )}

            {memberCheck && (
              <label className="coop-form-field">
                Crédit en cours
                <select
                  value={selectedCreditId}
                  onChange={(event) => {
                    const credit = memberCredits.find(
                      (item) => String(item.id) === event.target.value,
                    );
                    if (credit) applyCreditSelection(credit);
                  }}
                  required
                  disabled={creditsLoading || memberCredits.length === 0}
                >
                  <option value="" disabled>
                    {creditsLoading
                      ? "Chargement des crédits…"
                      : memberCredits.length === 0
                        ? "Aucun crédit en cours"
                        : "Choisir un crédit"}
                  </option>
                  {memberCredits.map((credit) => (
                    <option key={credit.id} value={String(credit.id)}>
                      CRD-{credit.id} · {formatCurrency(Number(credit.montant), credit.devise)}{" "}
                      · reste {formatCurrency(creditReste(credit), credit.devise)}
                      {credit.statut === "en_retard" ? " · en retard" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedCredit && (
              <div className="coop-credit-eligibility">
                <span>Total dû (capital + intérêts)</span>
                <strong>{formatCurrency(creditTotalDue(selectedCredit), selectedCredit.devise)}</strong>
                <span>Reste à payer</span>
                <strong>{formatCurrency(reste, selectedCredit.devise)}</strong>
              </div>
            )}

            <div className="coop-form-grid">
              <label className="coop-form-field">
                {selectedCredit ? `Montant (${selectedCredit.devise})` : "Montant"}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montant || ""}
                  onChange={(event) => setMontant(Number(event.target.value))}
                  required
                />
              </label>
              <label className="coop-form-field">
                Date
                <input
                  type="date"
                  value={payDate}
                  onChange={(event) => setPayDate(event.target.value)}
                  disabled={isAgent}
                  required
                />
              </label>
            </div>

            <label className="coop-form-field">
              Note (optionnelle)
              <textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Référence du reçu, précision du guichet…"
              />
            </label>

            {isAgent && (
              <p className="coop-muted-copy">
                Au guichet, la date d’encaissement est toujours celle du jour.
              </p>
            )}
            {selectedCredit && montant > reste && (
              <p className="coop-muted-copy">
                Le reste à payer est de {formatCurrency(reste, selectedCredit.devise)}.
              </p>
            )}

            {payError && (
              <p className="coop-form-error" role="alert">
                {payError}
              </p>
            )}

            <div className="coop-form-actions">
              <button
                className="mw-secondary"
                type="button"
                onClick={() => setPayOpen(false)}
              >
                Annuler
              </button>
              <button
                className="mw-primary"
                type="submit"
                disabled={
                  payBusy || verifying || creditsLoading || !selectedCredit
                }
              >
                {payBusy ? "Enregistrement…" : "Valider le paiement"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepaymentDetails({ item }: { item: RepaymentItem }) {
  const status = repaymentStatus[item.status] ?? {
    label: item.status,
    tone: "pending" as BadgeTone,
  };

  return (
    <div className="coop-drawer-content coop-repayment-detail">
      <div className="coop-drawer-member">
        <span className="mw-member-avatar">{item.memberInitials || "?"}</span>
        <div>
          <strong>{item.memberName || "Membre"}</strong>
          <span>{item.accountId || "—"}</span>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      <section className="coop-drawer-section">
        <h3>Paiement</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Date</dt>
            <dd>{formatDate(item.dateRemboursement)}</dd>
          </div>
          <div>
            <dt>Montant encaissé</dt>
            <dd>{formatCurrency(item.montant, item.devise)}</dd>
          </div>
          <div>
            <dt>Part principal</dt>
            <dd>{formatCurrency(item.ventilation.principal, item.devise)}</dd>
          </div>
          <div>
            <dt>Part intérêts</dt>
            <dd>{formatCurrency(item.ventilation.interets, item.devise)}</dd>
          </div>
          <div>
            <dt>Crédit</dt>
            <dd>CRD-{item.creditId}</dd>
          </div>
          <div>
            <dt>Note</dt>
            <dd>{item.description || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="coop-drawer-section">
        <h3>Solde du crédit</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Total dû</dt>
            <dd>{formatCurrency(item.totalDue, item.devise)}</dd>
          </div>
          <div>
            <dt>Déjà remboursé</dt>
            <dd>{formatCurrency(item.paidAmount, item.devise)}</dd>
          </div>
          <div>
            <dt>Solde restant</dt>
            <dd>{formatCurrency(item.remainingAmount, item.devise)}</dd>
          </div>
        </dl>
        <span className="coop-progress-cell">
          <span className="coop-progress-track">
            <span style={{ width: `${item.progressPercent}%` }} />
          </span>
          <small>{item.progressPercent} %</small>
        </span>
      </section>
    </div>
  );
}
