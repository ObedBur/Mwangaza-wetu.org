'use client';

import {
  IconAlertTriangle,
  IconArrowDown,
  IconCheck,
  IconCoins,
  IconSearch,
  IconUserPlus,
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

type BadgeTone = "valid" | "pending" | "rejected";

/** Ligne de GET /api/credits (mapCreditToResponse). */
type CreditListItem = {
  id: string;
  memberName: string;
  memberRole: string;
  initials: string;
  amount: number;
  remainingAmount: number;
  currency: string;
  startDate: string;
  interestRate: number;
  durationMonths: number;
  status: "active" | "overdue" | "repaid";
};

type CreditsResponse = {
  data: CreditListItem[];
  meta: { total: number; totalPages: number };
};

type CreditStats = {
  totalAmount: { usd: number; fc: number };
  activeAmount: { usd: number; fc: number };
  overdueAmount: { usd: number; fc: number };
  availableBalance: { usd: number; fc: number };
  totalCount: number;
  activeCount: number;
  overdueCount: number;
};

/** GET /api/credits/:id — crédit brut Prisma + membre + remboursements. */
type CreditDetail = {
  id: number;
  numeroCompte: string;
  montant: string | number;
  montantRembourse: string | number;
  devise: string;
  tauxInteret: string | number;
  duree: number;
  dateDebut: string;
  dateEcheance: string | null;
  statut: string;
  description: string | null;
  createdAt: string;
  derniereOperation: string | null;
  membre: {
    nomComplet: string;
    numeroCompte: string;
    telephone?: string | null;
    email?: string | null;
    typeCompte?: string;
  };
  remboursements: Array<{
    id: number;
    montant: string | number;
    devise: string;
    dateRemboursement: string;
    partPrincipal: string | number;
    partInteret: string | number;
    description: string | null;
  }>;
};

type MemberOption = { id: number; numero_compte: string; nom_complet: string };

const creditStatus: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Actif", tone: "valid" },
  overdue: { label: "En retard", tone: "pending" },
  repaid: { label: "Soldé", tone: "valid" },
};

const statutLabel: Record<string, string> = {
  actif: "Actif",
  rembourse: "Soldé",
  en_retard: "En retard",
};

const tabs = ["Actif", "En retard", "Soldé", "Tous"] as const;
const purposes = ["Commerce", "Scolarité", "Santé", "Logement", "Autre"];
const periods = ["Toutes les périodes", "Ce mois", "30 derniers jours"] as const;

export function meta() {
  return [{ title: "Crédits — Mwangaza Wetu" }];
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

/** Échéance finale = date de début + durée en mois (calcul identique au serveur). */
function dueDateOf(credit: CreditListItem) {
  const [year, month, day] = credit.startDate.split("-").map(Number);
  if (!year || !month || !day) return credit.startDate;
  const due = new Date(year, month - 1 + credit.durationMonths, day);
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
}

function creditProgress(credit: CreditListItem) {
  const totalDue = credit.amount * (1 + credit.interestRate / 100);
  const paid = Math.max(0, totalDue - credit.remainingAmount);
  const progress =
    totalDue > 0 ? Math.min(100, Math.round((paid / totalDue) * 100)) : 0;
  return { totalDue, paid, progress };
}

/** Simulation d'échéancier (mathématiques pures, sans donnée en dur). */
function simulateLoan(principal: number, annualRate: number, termMonths: number) {
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    termMonths <= 0
      ? 0
      : monthlyRate === 0
        ? principal / termMonths
        : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -termMonths);
  const monthlyPayment = Math.round(payment * 100) / 100;
  const totalToRepay = Math.round(monthlyPayment * termMonths * 100) / 100;
  return {
    monthlyPayment,
    totalToRepay,
    creditCost: Math.round((totalToRepay - principal) * 100) / 100,
  };
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return <span className={`coop-status coop-status--${tone}`}>{label}</span>;
}

export default function CreditsRoute() {
  const dark = useCooperativeDarkTheme();
  const [role, setRole] = useState<string | null>(null);
  const [records, setRecords] = useState<CreditListItem[]>([]);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("Tous");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CreditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [success, setSuccess] = useState("");

  // Création
  const [createOpen, setCreateOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [memberNumero, setMemberNumero] = useState("");
  const [savings, setSavings] = useState<{ usd: number; fc: number } | null>(
    null,
  );
  const [principal, setPrincipal] = useState(500);
  const [devise, setDevise] = useState<"USD" | "FC">("USD");
  const [termMonths, setTermMonths] = useState(12);
  const [annualRate, setAnnualRate] = useState(15);
  const [startDate, setStartDate] = useState(todayIso());
  const [formError, setFormError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const isDirection = role === "admin" || role === "superadmin";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const all: CreditListItem[] = [];
      let current = 1;
      let totalPages = 1;
      do {
        const response = await apiClient.get<CreditsResponse>("/credits", {
          params: { page: current, pageSize: 100 },
        });
        all.push(...response.data.data);
        totalPages = response.data.meta.totalPages || 1;
        current += 1;
      } while (current <= totalPages);
      const statsResponse = await apiClient.get<CreditStats>("/credits/stats");
      setRecords(all);
      setStats(statsResponse.data);
    } catch (error) {
      setRecords([]);
      setStats(null);
      setLoadError(
        apiErrorMessage(error, "Impossible de charger les crédits depuis le backend."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRole(getAuthUser()?.role ?? "admin");
  }, []);

  useEffect(() => {
    if (isDirection) void load();
  }, [isDirection, load]);

  // Détail du crédit sélectionné
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    apiClient
      .get<CreditDetail>(`/credits/${selectedId}`)
      .then((response) => {
        if (!cancelled) setDetail(response.data);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailError(
            apiErrorMessage(error, "Impossible de charger le détail du crédit."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Liste des membres pour le formulaire de création
  async function ensureMembers() {
    if (membersLoaded) return;
    try {
      const response = await apiClient.get<MemberOption[]>("/membres/numeros");
      setMembers(response.data);
      setMembersLoaded(true);
      setMemberNumero((current) => current || response.data[0]?.numero_compte || "");
    } catch (error) {
      setFormError(
        apiErrorMessage(error, "Impossible de charger la liste des membres."),
      );
    }
  }

  // Épargne du membre sélectionné (affichage indicatif)
  useEffect(() => {
    if (!createOpen || !memberNumero) {
      setSavings(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<{ soldeUSD: number; soldeFC: number }>(
        `/epargnes/soldes/${encodeURIComponent(memberNumero)}`,
      )
      .then((response) => {
        if (!cancelled) {
          setSavings({
            usd: Number(response.data.soldeUSD || 0),
            fc: Number(response.data.soldeFC || 0),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSavings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [createOpen, memberNumero]);

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const thirtyDaysKey = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;
    return records
      .filter(
        (credit) =>
          activeTab === "Tous" ||
          creditStatus[credit.status]?.label === activeTab,
      )
      .filter((credit) =>
        `${credit.memberName} CRD-${credit.id} ${credit.memberRole}`
          .toLocaleLowerCase("fr-FR")
          .includes(search),
      )
      .filter((credit) => {
        if (period === periods[0]) return true;
        if (period === periods[1]) return credit.startDate.startsWith(monthKey);
        return credit.startDate >= thirtyDaysKey;
      });
  }, [activeTab, period, query, records]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = records.find((credit) => credit.id === selectedId) ?? null;

  const totals = records.reduce(
    (acc, credit) => {
      const { totalDue, paid } = creditProgress(credit);
      acc.totalDue += totalDue;
      acc.paid += paid;
      return acc;
    },
    { totalDue: 0, paid: 0 },
  );
  const repaymentRate =
    totals.totalDue > 0 ? Math.round((totals.paid / totals.totalDue) * 100) : 0;

  const simulator = simulateLoan(principal, annualRate, termMonths);

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  function openCreate() {
    setFormError("");
    setStartDate(todayIso());
    setCreateOpen(true);
    void ensureMembers();
  }

  async function createCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numeroCompte = memberNumero;
    const montant = Number(form.get("montant"));
    const tauxInteret = Number(form.get("rate"));
    const duree = Number(form.get("term"));
    const dateDebut = String(form.get("dateDebut"));
    const description = String(form.get("purpose"));
    if (!numeroCompte) {
      setFormError("Choisissez le membre bénéficiaire.");
      return;
    }
    if (!(montant > 0) || !(duree > 0) || !(tauxInteret >= 0) || !dateDebut) {
      setFormError("Vérifiez le montant, la durée, le taux et la date de début.");
      return;
    }
    setCreateBusy(true);
    setFormError("");
    try {
      const response = await apiClient.post<{ id: number }>("/credits", {
        numeroCompte,
        montant,
        devise,
        tauxInteret,
        duree,
        dateDebut,
        description,
      });
      const member = members.find((item) => item.numero_compte === numeroCompte);
      setCreateOpen(false);
      setSuccess(
        `Crédit CRD-${response.data.id} enregistré et décaissé${member ? ` pour ${member.nom_complet}` : ""}.`,
      );
      await load();
    } catch (error) {
      setFormError(apiErrorMessage(error, "Le crédit n’a pas pu être enregistré."));
    } finally {
      setCreateBusy(false);
    }
  }

  if (role === null) {
    return (
      <div className="coop-operations-page coop-credit-page">
        <CooperativeDataState loading error={false} empty={false}>
          <span />
        </CooperativeDataState>
      </div>
    );
  }

  if (!isDirection) {
    return (
      <div className="coop-operations-page coop-credit-page">
        <div className="coop-page-heading">
          <div>
            <CooperativeBreadcrumb section="Opérations" current="Crédits" />
            <h1>Crédits</h1>
            <p>Demandes de crédit et suivi des remboursements accordés aux membres.</p>
          </div>
        </div>
        <section className="mw-panel coop-operations-panel">
          <div className="coop-empty-state" role="status">
            <IconWallet aria-hidden="true" />
            <span>
              Cette section est réservée à la direction (administrateur /
              superadministrateur).
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="coop-operations-page coop-credit-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Crédits" />
          <h1>Crédits</h1>
          <p>Demandes de crédit et suivi des remboursements accordés aux membres.</p>
        </div>
        <div className="coop-page-actions">
          <button className="mw-primary" type="button" onClick={openCreate}>
            <IconUserPlus aria-hidden="true" />
            Nouveau crédit
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

      {!loading && !loadError && stats && (
        <section className="coop-stat-grid" aria-label="Indicateurs des crédits">
          <CooperativeStatCard
            label="Encours total USD"
            value={formatCurrency(stats.totalAmount.usd, "USD")}
            detail="Capital prêté (tous statuts)"
            icon={IconWallet}
          />
          <CooperativeStatCard
            label="Encours total FC"
            value={formatCurrency(stats.totalAmount.fc, "FC")}
            detail="Capital prêté (tous statuts)"
            icon={IconCoins}
            accent="#4384b5"
          />
          <CooperativeStatCard
            label="Taux de remboursement"
            value={`${repaymentRate} %`}
            detail="Montant reçu / prévu"
            icon={IconArrowDown}
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

      <section className="mw-panel coop-operations-panel" aria-label="Suivi des crédits">
        <div
          className="coop-withdrawal-tabs"
          role="tablist"
          aria-label="Filtrer les crédits par statut"
        >
          {tabs.map((tab) => {
            const count =
              tab === "Tous"
                ? records.length
                : records.filter(
                    (credit) => creditStatus[credit.status]?.label === tab,
                  ).length;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "is-active" : ""}
                key={tab}
                onClick={() => changeFilter(() => setActiveTab(tab))}
              >
                {tab}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="coop-filter-bar">
          <label className="coop-filter-search">
            <IconSearch aria-hidden="true" />
            <input
              type="search"
              value={query}
              aria-label="Rechercher un membre ou une référence de crédit"
              placeholder="Membre ou référence (CRD-…)…"
              onChange={(event) => changeFilter(() => setQuery(event.target.value))}
            />
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Période de début</span>
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
        </div>

        <CooperativeDataState
          loading={loading}
          error={Boolean(loadError)}
          empty={filtered.length === 0}
          emptyMessage={
            records.length === 0
              ? "Aucun crédit enregistré pour le moment."
              : "Aucun crédit ne correspond à ces filtres."
          }
        >
          <div className="coop-table-scroll">
            <table className="mw-table coop-credit-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Membre</th>
                  <th>Montant</th>
                  <th>Taux</th>
                  <th>Durée</th>
                  <th>Début</th>
                  <th>Échéance</th>
                  <th>Solde restant</th>
                  <th>Remboursé</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((credit) => {
                  const { progress } = creditProgress(credit);
                  const status = creditStatus[credit.status] ?? {
                    label: credit.status,
                    tone: "pending" as BadgeTone,
                  };
                  return (
                    <tr
                      key={credit.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(credit.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(credit.id);
                        }
                      }}
                    >
                      <td>
                        <strong>CRD-{credit.id}</strong>
                      </td>
                      <td>
                        <span className="mw-member">
                          <span className="mw-member-avatar">
                            {credit.initials}
                          </span>
                          <span>{credit.memberName}</span>
                        </span>
                      </td>
                      <td className="coop-amount-cell">
                        {formatCurrency(credit.amount, credit.currency)}
                      </td>
                      <td>{credit.interestRate} %</td>
                      <td>{credit.durationMonths} mois</td>
                      <td>{formatDate(credit.startDate)}</td>
                      <td>{formatDate(dueDateOf(credit))}</td>
                      <td className="coop-amount-cell">
                        {formatCurrency(credit.remainingAmount, credit.currency)}
                      </td>
                      <td>
                        <span className="coop-progress-cell">
                          <span className="coop-progress-track">
                            <span style={{ width: `${progress}%` }} />
                          </span>
                          <small>{progress} %</small>
                        </span>
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
        </CooperativeDataState>

        <CooperativePagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          itemLabel="crédits"
        />
      </section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent
          data-theme={dark ? "dark" : "light"}
          className="coop-member-drawer coop-credit-drawer"
          side="right"
        >
          <SheetTitle className="coop-drawer-title">Détail du crédit</SheetTitle>
          {detailLoading && (
            <CooperativeDataState loading error={false} empty={false}>
              <span />
            </CooperativeDataState>
          )}
          {!detailLoading && detailError && (
            <p className="coop-form-error" role="alert">
              {detailError}
            </p>
          )}
          {!detailLoading && !detailError && detail && (
            <CreditDetails credit={detail} />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog coop-credit-form-dialog"
        >
          <DialogHeader>
            <DialogTitle>Nouveau crédit</DialogTitle>
            <DialogDescription>
              Le crédit est décaissé immédiatement : il devient actif et
              apparaît dans le tableau. Les fonds sont vérifiés dans la
              trésorerie avant validation.
            </DialogDescription>
          </DialogHeader>
          <form className="coop-operation-form" onSubmit={createCredit}>
            <label className="coop-form-field">
              Membre bénéficiaire
              <select
                value={memberNumero}
                onChange={(event) => setMemberNumero(event.target.value)}
                required
              >
                {members.length === 0 && (
                  <option value="">Chargement des membres…</option>
                )}
                {members.map((member) => (
                  <option key={member.id} value={member.numero_compte}>
                    {member.nom_complet} · {member.numero_compte}
                  </option>
                ))}
              </select>
            </label>

            <div className="coop-credit-eligibility">
              <span>Épargne principale du membre</span>
              <strong>
                {savings
                  ? `${formatCurrency(savings.usd, "USD")} · ${formatCurrency(savings.fc, "FC")}`
                  : "—"}
              </strong>
              <span>Plafond indicatif (3 × épargne USD)</span>
              <strong>
                {savings ? formatCurrency(savings.usd * 3, "USD") : "—"}
              </strong>
            </div>

            <div className="coop-form-grid">
              <label className="coop-form-field">
                Montant
                <input
                  name="montant"
                  type="number"
                  min="1"
                  step="50"
                  value={principal}
                  onChange={(event) => setPrincipal(Number(event.target.value))}
                  required
                />
              </label>
              <label className="coop-form-field">
                Devise
                <select
                  value={devise}
                  onChange={(event) =>
                    setDevise(event.target.value as "USD" | "FC")
                  }
                  required
                >
                  <option value="USD">USD</option>
                  <option value="FC">FC</option>
                </select>
              </label>
            </div>
            <div className="coop-form-grid">
              <label className="coop-form-field">
                Durée (mois)
                <input
                  name="term"
                  type="number"
                  min="1"
                  max="60"
                  value={termMonths}
                  onChange={(event) => setTermMonths(Number(event.target.value))}
                  required
                />
              </label>
              <label className="coop-form-field">
                Taux annuel (%)
                <input
                  name="rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={annualRate}
                  onChange={(event) => setAnnualRate(Number(event.target.value))}
                  required
                />
              </label>
            </div>
            <div className="coop-form-grid">
              <label className="coop-form-field">
                Date de début
                <input
                  name="dateDebut"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label className="coop-form-field">
                Objet
                <select name="purpose" required>
                  {purposes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <section className="coop-simulator" aria-live="polite">
              <h3>Simulation de l’échéancier</h3>
              <div>
                <span>Mensualité estimée</span>
                <strong>{formatCurrency(simulator.monthlyPayment, devise)}</strong>
              </div>
              <div>
                <span>Total à rembourser</span>
                <strong>{formatCurrency(simulator.totalToRepay, devise)}</strong>
              </div>
              <div>
                <span>Coût du crédit</span>
                <strong>{formatCurrency(simulator.creditCost, devise)}</strong>
              </div>
            </section>

            {formError && (
              <p className="coop-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="coop-form-actions">
              <button
                className="mw-secondary"
                type="button"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </button>
              <button
                className="mw-primary"
                type="submit"
                disabled={createBusy || members.length === 0}
              >
                {createBusy ? "Enregistrement…" : "Octroyer le crédit"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditDetails({ credit }: { credit: CreditDetail }) {
  const montant = Number(credit.montant);
  const taux = Number(credit.tauxInteret) || 0;
  const rembourse = Number(credit.montantRembourse) || 0;
  const totalDue = montant * (1 + taux / 100);
  const restant = Math.max(0, totalDue - rembourse);
  const status = statutLabel[credit.statut] ?? credit.statut;
  const tone: BadgeTone =
    credit.statut === "en_retard"
      ? "pending"
      : credit.statut === "rembourse"
        ? "valid"
        : "valid";

  return (
    <div className="coop-drawer-content coop-credit-detail">
      <div className="coop-drawer-member">
        <span className="mw-member-avatar">
          {credit.membre.nomComplet
            .split(" ")
            .map((part) => part[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div>
          <strong>{credit.membre.nomComplet}</strong>
          <span>
            {credit.membre.numeroCompte}
            {credit.membre.telephone ? ` · ${credit.membre.telephone}` : ""}
          </span>
        </div>
        <StatusBadge label={status} tone={tone} />
      </div>

      <section className="coop-drawer-section">
        <h3>Conditions du crédit</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Référence</dt>
            <dd>CRD-{credit.id}</dd>
          </div>
          <div>
            <dt>Montant</dt>
            <dd>{formatCurrency(montant, credit.devise)}</dd>
          </div>
          <div>
            <dt>Taux annuel</dt>
            <dd>{taux} %</dd>
          </div>
          <div>
            <dt>Durée</dt>
            <dd>{credit.duree} mois</dd>
          </div>
          <div>
            <dt>Objet</dt>
            <dd>{credit.description || "—"}</dd>
          </div>
          <div>
            <dt>Début du contrat</dt>
            <dd>{formatDate(credit.dateDebut)}</dd>
          </div>
          <div>
            <dt>Échéance finale</dt>
            <dd>{credit.dateEcheance ? formatDate(credit.dateEcheance) : "—"}</dd>
          </div>
          <div>
            <dt>Total dû</dt>
            <dd>{formatCurrency(totalDue, credit.devise)}</dd>
          </div>
          <div>
            <dt>Déjà remboursé</dt>
            <dd>{formatCurrency(rembourse, credit.devise)}</dd>
          </div>
          <div>
            <dt>Solde restant</dt>
            <dd>{formatCurrency(restant, credit.devise)}</dd>
          </div>
        </dl>
      </section>

      <section className="coop-drawer-section">
        <h3>Remboursements enregistrés</h3>
        {credit.remboursements.length ? (
          <div className="coop-table-scroll coop-schedule-scroll">
            <table className="mw-table coop-schedule-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Principal</th>
                  <th>Intérêts</th>
                </tr>
              </thead>
              <tbody>
                {credit.remboursements.map((remboursement) => (
                  <tr key={remboursement.id}>
                    <td>{formatDate(remboursement.dateRemboursement)}</td>
                    <td className="coop-amount-cell">
                      {formatCurrency(
                        Number(remboursement.montant),
                        remboursement.devise,
                      )}
                    </td>
                    <td>
                      {formatCurrency(
                        Number(remboursement.partPrincipal),
                        remboursement.devise,
                      )}
                    </td>
                    <td>
                      {formatCurrency(
                        Number(remboursement.partInteret),
                        remboursement.devise,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="coop-muted-copy">
            Aucun remboursement enregistré pour ce crédit.
          </p>
        )}
      </section>

      <section className="coop-drawer-section">
        <h3>Historique</h3>
        <ol className="coop-timeline">
          <li>
            <span className="coop-timeline-dot is-done" />
            <div>
              <strong>Crédit créé et décaissé</strong>
              <small>{formatDate(credit.createdAt)}</small>
            </div>
          </li>
          {credit.derniereOperation && (
            <li>
              <span className="coop-timeline-dot is-done" />
              <div>
                <strong>Dernière opération</strong>
                <small>{formatDate(credit.derniereOperation)}</small>
              </div>
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}
