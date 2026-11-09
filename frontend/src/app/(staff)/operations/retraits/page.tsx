'use client';

import {
  IconAlertTriangle,
  IconArrowUp,
  IconCheck,
  IconClock,
  IconFileSpreadsheet,
  IconFileText,
  IconPrinter,
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
import {
  downloadReportCsv,
  downloadReportPdf,
} from "@/lib/cooperative-report-export";
import { formatMixedCurrency } from "@/lib/format-currency";
import { parseApiError } from "@/lib/api-error";
import { MWANGAZA_BRAND } from "@/lib/theme-constants";

type Currency = "USD" | "FC";
type BadgeTone = "valid" | "pending" | "rejected";

/** Ligne renvoyée par GET /api/withdrawals (mapRetraitToResponse). */
type BackendWithdrawal = {
  id: number;
  reference: string;
  dateISO: string;
  time: string;
  accountNumber: string;
  memberName: string;
  amount: number;
  currency: Currency;
  reason: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  frais: number;
  soldeAvant: number;
  soldeApres: number;
  executedBy: { id: number; role: string } | null;
  cancelledAt: string | null;
  cancelledBy: { id: number; role: string } | null;
  cancellationReason: string | null;
};

type WithdrawalsResponse = {
  data: BackendWithdrawal[];
  meta: { total: number; totalPages: number };
};

/** Mouvement de caisse d'agent — GET /api/withdrawals/caisse/moi/mouvements. */
type CashMovement = {
  id: number;
  type: string;
  devise: Currency;
  montant: number;
  soldeAvant: number;
  soldeApres: number;
  motif: string | null;
  referenceRetrait: string | null;
  acteur: { id: number; role: string } | null;
  createdAt: string;
};

type Cashbox = {
  agentId: number;
  agentName: string;
  guichet: string | null;
  balances: { devise: Currency; solde: number }[];
};

type Row = {
  key: string;
  reference: string;
  memberName: string | null;
  accountNumber: string | null;
  amount: number;
  currency: Currency;
  balanceBefore: number | null;
  reason: string;
  date: string;
  dateKey: string;
  badge: string;
  tone: BadgeTone;
  tab: string;
  withdrawal?: BackendWithdrawal;
  movement?: CashMovement;
};

const withdrawalStatus: Record<
  string,
  { label: string; tone: BadgeTone; tab: string }
> = {
  pending: { label: "En attente", tone: "pending", tab: "En attente" },
  completed: { label: "Payé", tone: "valid", tab: "Payé" },
  cancelled: { label: "Annulé", tone: "rejected", tab: "Annulé" },
  failed: { label: "Échoué", tone: "rejected", tab: "Échoué" },
};

const movementMeta: Record<
  string,
  { label: string; tone: BadgeTone; tab: string }
> = {
  RETRAIT: { label: "Retrait", tone: "valid", tab: "Retraits" },
  REMBOURSEMENT_CREDIT: {
    label: "Remboursement",
    tone: "valid",
    tab: "Remboursements",
  },
  ANNULATION: { label: "Annulation", tone: "rejected", tab: "Annulations" },
  APPROVISIONNEMENT: {
    label: "Approvisionnement",
    tone: "pending",
    tab: "Approvisionnements",
  },
};

const adminTabs = ["Tous", "En attente", "Payé", "Annulé", "Échoué"] as const;
const agentTabs = [
  "Tous",
  "Retraits",
  "Remboursements",
  "Annulations",
  "Approvisionnements",
] as const;
const periods = ["Toutes les périodes", "Ce mois", "30 derniers jours"] as const;

const withdrawalExportHeaders = [
  "Référence",
  "Date",
  "Heure",
  "Numéro Compte",
  "Nom Membre",
  "Montant",
  "Devise",
  "Frais",
  "Solde Avant",
  "Solde Après",
  "Statut",
  "Motif",
  "Exécuté Par",
];

export function meta() {
  return [{ title: "Retraits — Mwangaza Wetu" }];
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join(" ");
  if (typeof message === "string" && message) return message;
  return fallback;
}

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return <span className={`coop-status coop-status--${tone}`}>{label}</span>;
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function WithdrawalsRoute() {
  const dark = useCooperativeDarkTheme();
  const [role, setRole] = useState<string | null>(null);
  const [records, setRecords] = useState<BackendWithdrawal[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [cashbox, setCashbox] = useState<Cashbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("Tous");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(
    periods[0],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [bannerError, setBannerError] = useState("");

  // Reçu de caisse à imprimer
  const [receiptTarget, setReceiptTarget] = useState<BackendWithdrawal | null>(null);

  // Création (agent uniquement — POST /withdrawals est réservé au guichet)
  const [createOpen, setCreateOpen] = useState(false);
  const [compteInput, setCompteInput] = useState("");
  const [memberCheck, setMemberCheck] = useState<{
    compte: string;
    nomComplet: string;
    soldeUSD: number;
    soldeFC: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Annulation (admin — POST /withdrawals/:id/annuler)
  const [cancelTarget, setCancelTarget] = useState<BackendWithdrawal | null>(
    null,
  );
  const [cancelMotif, setCancelMotif] = useState("");
  const [cancelCash, setCancelCash] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const isAgent = role === "agent";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isAgent) {
        const [caisse, mouvements] = await Promise.all([
          apiClient.get<Cashbox>("/withdrawals/caisse/moi"),
          apiClient.get<CashMovement[]>(
            "/withdrawals/caisse/moi/mouvements",
            { params: { limit: 100 } },
          ),
        ]);
        setCashbox(caisse.data);
        setMovements(mouvements.data);
        setRecords([]);
      } else {
        const all: BackendWithdrawal[] = [];
        let current = 1;
        let totalPages = 1;
        do {
          const response = await apiClient.get<WithdrawalsResponse>(
            "/withdrawals",
            { params: { page: current, pageSize: 100 } },
          );
          all.push(...response.data.data);
          totalPages = response.data.meta.totalPages || 1;
          current += 1;
        } while (current <= totalPages);
        setRecords(all);
        setMovements([]);
        setCashbox(null);
      }
    } catch (error) {
      setRecords([]);
      setMovements([]);
      setCashbox(null);
      setLoadError(
        apiErrorMessage(
          error,
          "Impossible de charger les retraits depuis le backend.",
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
    if (role) void load();
  }, [role, load]);

  const rows: Row[] = useMemo(() => {
    if (isAgent) {
      return movements.map((movement) => {
        const meta =
          movementMeta[movement.type] ?? {
            label: movement.type,
            tone: "pending" as BadgeTone,
            tab: "Tous",
          };
        return {
          key: `m-${movement.id}`,
          reference:
            movement.referenceRetrait ||
            `${movement.type}-${String(movement.id).padStart(4, "0")}`,
          memberName: null,
          accountNumber: null,
          amount: movement.montant,
          currency: movement.devise,
          balanceBefore: movement.soldeAvant,
          reason: movement.motif || meta.label,
          date: movement.createdAt,
          dateKey: movement.createdAt.slice(0, 10),
          badge: meta.label,
          tone: meta.tone,
          tab: meta.tab,
          movement,
        };
      });
    }
    return records.map((withdrawal) => {
      const meta = withdrawalStatus[withdrawal.status] ?? {
        label: withdrawal.status,
        tone: "pending" as BadgeTone,
        tab: "Tous",
      };
      return {
        key: `w-${withdrawal.id}`,
        reference: withdrawal.reference,
        memberName: withdrawal.memberName,
        accountNumber: withdrawal.accountNumber,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        balanceBefore: withdrawal.soldeAvant,
        reason: withdrawal.reason,
        date: `${withdrawal.dateISO}T${withdrawal.time || "00:00"}`,
        dateKey: withdrawal.dateISO,
        badge: meta.label,
        tone: meta.tone,
        tab: meta.tab,
        withdrawal,
      };
    });
  }, [isAgent, movements, records]);

  const tabs = isAgent ? [...agentTabs] : [...adminTabs];

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    const now = new Date();
    const monthKey = monthKeyOf(now);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const thirtyDaysKey = todayKeyOf(thirtyDaysAgo);
    const todayKey = todayKeyOf(now);
    return rows
      .filter((row) => activeTab === "Tous" || row.tab === activeTab)
      .filter((row) =>
        `${row.reference} ${row.memberName ?? ""} ${row.accountNumber ?? ""} ${row.reason}`
          .toLocaleLowerCase("fr-FR")
          .includes(search),
      )
      .filter((row) => {
        if (period === periods[0]) return true;
        if (period === periods[1]) return row.dateKey.startsWith(monthKey);
        return row.dateKey >= thirtyDaysKey && row.dateKey <= todayKey;
      });
  }, [activeTab, period, query, rows]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = rows.find((row) => row.key === selectedId) ?? null;

  const now = new Date();
  const monthKey = monthKeyOf(now);
  const pendingRows = rows.filter((row) => row.tab === "En attente");
  const paidThisMonth = rows.filter(
    (row) => row.tab === "Payé" && row.dateKey.startsWith(monthKey),
  );
  const cancelledThisMonth = rows.filter(
    (row) => row.tab === "Annulé" && row.dateKey.startsWith(monthKey),
  );
  const retraitMovements = rows.filter((row) => row.badge === "Retrait");
  const remboursementMovements = rows.filter(
    (row) => row.badge === "Remboursement",
  );

  // Données prêtes pour l'export comptable (PDF / CSV)
  const withdrawalExportRows = useMemo(() => {
    return filtered
      .map((row) => {
        if (row.withdrawal) {
          const w = row.withdrawal;
          return [
            w.reference,
            w.dateISO,
            w.time || "—",
            w.accountNumber,
            w.memberName || "—",
            w.amount,
            w.currency,
            w.frais,
            w.soldeAvant,
            w.soldeApres,
            withdrawalStatus[w.status]?.label || w.status,
            w.reason || "—",
            w.executedBy ? `${w.executedBy.role} #${w.executedBy.id}` : "—",
          ];
        }
        if (row.movement) {
          const m = row.movement;
          return [
            row.reference,
            m.createdAt.slice(0, 10),
            m.createdAt.slice(11, 16) || "—",
            "—",
            "Mouvement Caisse",
            m.montant,
            m.devise,
            0,
            m.soldeAvant,
            m.soldeApres,
            movementMeta[m.type]?.label || m.type,
            m.motif || "—",
            m.acteur ? `${m.acteur.role} #${m.acteur.id}` : "—",
          ];
        }
        return null;
      })
      .filter(Boolean) as (string | number)[][];
  }, [filtered]);

  function exportWithdrawalsCsv() {
    downloadReportCsv(
      "journal-retraits",
      withdrawalExportHeaders,
      withdrawalExportRows,
    );
  }

  async function exportWithdrawalsPdf() {
    await downloadReportPdf(
      "Journal des retraits & décaissements — Mwangaza Wetu",
      "journal-retraits",
      withdrawalExportHeaders,
      withdrawalExportRows,
    );
  }

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  async function verifyMember() {
    const compte = compteInput.trim();
    if (!compte) {
      setFormError("Saisissez le numéro de compte du membre.");
      return;
    }
    setChecking(true);
    setMemberCheck(null);
    setFormError("");
    try {
      const response = await apiClient.get<{
        exists: boolean;
        membre?: { numeroCompte: string; nomComplet: string; statut: string };
      }>(`/membres/by-numero/${encodeURIComponent(compte)}`);
      const membre = response.data.exists ? response.data.membre : null;
      if (!membre) {
        setFormError("Aucun membre trouvé pour ce numéro de compte.");
        return;
      }
      if (membre.statut !== "actif") {
        setFormError("Ce membre est inactif : opération refusée.");
        return;
      }
      const soldes = await apiClient.get<{ soldeUSD: number; soldeFC: number }>(
        `/epargnes/soldes/${encodeURIComponent(membre.numeroCompte)}`,
      );
      setMemberCheck({
        compte: membre.numeroCompte,
        nomComplet: membre.nomComplet,
        soldeUSD: Number(soldes.data.soldeUSD || 0),
        soldeFC: Number(soldes.data.soldeFC || 0),
      });
    } catch (error) {
      setFormError(apiErrorMessage(error, "Impossible de vérifier ce compte."));
    } finally {
      setChecking(false);
    }
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const devise = String(form.get("devise")) as Currency;
    const montant = Number(form.get("montant"));
    const description = String(form.get("description") || "").trim();
    const compte = compteInput.trim();
    if (!memberCheck || memberCheck.compte !== compte) {
      setFormError("Vérifiez d’abord le compte du membre.");
      return;
    }
    if (!(montant > 0)) {
      setFormError("Indiquez un montant supérieur à zéro.");
      return;
    }
    setCreateBusy(true);
    setFormError("");
    try {
      const response = await apiClient.post<BackendWithdrawal>(
        "/withdrawals",
        {
          compte,
          devise,
          montant,
          description: description || undefined,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setCreateOpen(false);
      setCompteInput("");
      setMemberCheck(null);
      setSuccess(
        `Retrait ${response.data.reference} enregistré pour ${response.data.memberName}.`,
      );
      // Ouvre immédiatement le reçu de caisse prêt pour impression
      setReceiptTarget(response.data);
      await load();
    } catch (error) {
      setFormError(
        apiErrorMessage(error, "Le retrait n’a pas pu être enregistré."),
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelTarget || cancelMotif.trim().length < 5 || !cancelCash) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      await apiClient.post(`/withdrawals/${cancelTarget.id}/annuler`, {
        motif: cancelMotif.trim(),
        cashRecupere: true,
      });
      setSuccess(`Retrait ${cancelTarget.reference} annulé et contrepassé.`);
      setCancelTarget(null);
      setCancelMotif("");
      setCancelCash(false);
      setSelectedId(null);
      await load();
    } catch (error) {
      setCancelError(apiErrorMessage(error, "L’annulation a échoué."));
    } finally {
      setCancelBusy(false);
    }
  }

  const isAdmin = role === "admin" || role === "superadmin";

  return (
    <div className="coop-operations-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Retraits" />
          <h1>Retraits</h1>
          <p>
            {isAgent
              ? "Mouvements de votre caisse d’agent et décaissements au guichet."
              : "Suivi des décaissements enregistrés par les agents et des annulations."}
          </p>
        </div>
        <div className="coop-page-actions coop-export-actions">
          {/* Boutons d'export comptable (PDF et CSV) */}
          <button
            className="mw-secondary"
            type="button"
            onClick={exportWithdrawalsPdf}
            disabled={loading || Boolean(loadError) || filtered.length === 0}
            title="Exporter le journal des retraits en PDF"
          >
            <IconFileText aria-hidden="true" />
            Exporter PDF
          </button>
          <button
            className="mw-secondary"
            type="button"
            onClick={exportWithdrawalsCsv}
            disabled={loading || Boolean(loadError) || filtered.length === 0}
            title="Exporter le journal des retraits en format CSV / Excel"
          >
            <IconFileSpreadsheet aria-hidden="true" />
            Exporter CSV
          </button>

          {isAgent && (
            <button
              className="mw-primary"
              type="button"
              onClick={() => {
                setCreateOpen(true);
                setFormError("");
              }}
            >
              <IconArrowUp aria-hidden="true" />
              Nouveau retrait
            </button>
          )}
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
      {bannerError && (
        <p className="coop-form-error" role="alert">
          {bannerError}
          <button
            type="button"
            aria-label="Fermer le message"
            onClick={() => setBannerError("")}
          >
            <IconX aria-hidden="true" />
          </button>
        </p>
      )}

      {loadError && (
        <p className="coop-form-error" role="alert">
          {loadError}{" "}
          <button type="button" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      )}

      {!loading && !loadError && (
        <section className="coop-stat-grid" aria-label="Indicateurs des retraits">
          {isAgent ? (
            <>
              <CooperativeStatCard
                label="Ma caisse"
                value={formatMixedCurrency(
                  cashbox?.balances.map((balance) => ({
                    amount: balance.solde,
                    currency: balance.devise,
                  })) ?? [],
                )}
                detail={`Guichet ${cashbox?.guichet ?? "—"}`}
                icon={IconWallet}
              />
              <CooperativeStatCard
                label="Retraits décaissés"
                value={retraitMovements.length}
                detail={formatMixedCurrency(
                  retraitMovements.map((row) => ({
                    amount: row.amount,
                    currency: row.currency,
                  })),
                )}
                icon={IconArrowUp}
              />
              <CooperativeStatCard
                label="Remboursements reçus"
                value={remboursementMovements.length}
                detail={formatMixedCurrency(
                  remboursementMovements.map((row) => ({
                    amount: row.amount,
                    currency: row.currency,
                  })),
                )}
                icon={IconCheck}
                accent="#4384b5"
              />
              <CooperativeStatCard
                label="Mouvements enregistrés"
                value={movements.length}
                detail="100 derniers mouvements"
                icon={IconClock}
              />
            </>
          ) : (
            <>
              <CooperativeStatCard
                label="Demandes en attente"
                value={pendingRows.length}
                detail={formatMixedCurrency(
                  pendingRows.map((row) => ({
                    amount: row.amount,
                    currency: row.currency,
                  })),
                )}
                icon={IconClock}
                accent="#c18c2d"
              />
              <CooperativeStatCard
                label="Payés ce mois"
                value={paidThisMonth.length}
                detail={formatMixedCurrency(
                  paidThisMonth.map((row) => ({
                    amount: row.amount,
                    currency: row.currency,
                  })),
                )}
                icon={IconWallet}
                accent="#4384b5"
              />
              <CooperativeStatCard
                label="Annulés ce mois"
                value={cancelledThisMonth.length}
                detail={formatMixedCurrency(
                  cancelledThisMonth.map((row) => ({
                    amount: row.amount,
                    currency: row.currency,
                  })),
                )}
                icon={IconX}
                accent="#c95151"
              />
              <CooperativeStatCard
                label="Retraits enregistrés"
                value={records.length}
                detail="Toutes périodes"
                icon={IconCheck}
              />
            </>
          )}
        </section>
      )}

      <section
        className="mw-panel coop-operations-panel"
        aria-label="Demandes de retrait"
      >
        <div
          className="coop-withdrawal-tabs"
          role="tablist"
          aria-label="Filtrer les retraits"
        >
          {tabs.map((tab) => {
            const count =
              tab === "Tous"
                ? rows.length
                : rows.filter((row) => row.tab === tab).length;
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
              aria-label="Rechercher un membre ou une référence"
              placeholder="Membre, compte ou référence…"
              onChange={(event) =>
                changeFilter(() => setQuery(event.target.value))
              }
            />
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Période</span>
            <select
              value={period}
              onChange={(event) =>
                changeFilter(() =>
                  setPeriod(
                    event.target.value as (typeof periods)[number],
                  ),
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
            rows.length === 0
              ? isAgent
                ? "Aucun mouvement de caisse enregistré pour le moment."
                : "Aucun retrait enregistré pour le moment."
              : "Aucune demande ne correspond à ces filtres."
          }
        >
          <div className="coop-table-scroll">
            <table className="mw-table coop-operation-table coop-withdrawal-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Membre</th>
                  <th>Montant</th>
                  <th>Solde avant</th>
                  <th>Motif</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.reference}</strong>
                    </td>
                    <td>
                      {row.memberName ? (
                        <span className="mw-member">
                          <span className="mw-member-avatar">
                            {initialsOf(row.memberName)}
                          </span>
                          <span>
                            {row.memberName}
                            <small>{row.accountNumber}</small>
                          </span>
                        </span>
                      ) : (
                        <span className="coop-no-goal">—</span>
                      )}
                    </td>
                    <td className="coop-amount-cell">
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                    <td>
                      {row.balanceBefore !== null
                        ? formatCurrency(row.balanceBefore, row.currency)
                        : "—"}
                    </td>
                    <td className="coop-reason-cell">{row.reason}</td>
                    <td>{formatDate(row.dateKey)}</td>
                    <td>
                      <StatusBadge label={row.badge} tone={row.tone} />
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="mw-secondary coop-examine-button"
                          type="button"
                          onClick={() => setSelectedId(row.key)}
                        >
                          Examiner
                        </button>
                        {row.withdrawal && (
                          <button
                            className="mw-ghost coop-icon-btn"
                            type="button"
                            title="Imprimer le reçu de caisse"
                            aria-label={`Imprimer le reçu de retrait ${row.reference}`}
                            onClick={() => setReceiptTarget(row.withdrawal!)}
                          >
                            <IconPrinter aria-hidden="true" size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
          itemLabel="demandes"
        />
      </section>

      {/* Volet latéral d'examen détaillé */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent
          data-theme={dark ? "dark" : "light"}
          className="coop-member-drawer coop-withdrawal-drawer"
          side="right"
        >
          <SheetTitle className="coop-drawer-title">
            {selected?.withdrawal
              ? "Détail du retrait"
              : "Détail du mouvement"}
          </SheetTitle>
          {selected?.withdrawal && (
            <WithdrawalDetails
              withdrawal={selected.withdrawal}
              canCancel={
                isAdmin && selected.withdrawal.status === "completed"
              }
              onCancel={() => {
                if (!selected?.withdrawal) return;
                setCancelTarget(selected.withdrawal);
                setCancelMotif("");
                setCancelCash(false);
                setCancelError("");
              }}
              onPrintReceipt={(w) => setReceiptTarget(w)}
            />
          )}
          {selected?.movement && (
            <MovementDetails movement={selected.movement} />
          )}
        </SheetContent>
      </Sheet>

      {/* Modal Reçu de Caisse Officiel (Impression) */}
      <Dialog
        open={receiptTarget !== null}
        onOpenChange={(open) => !open && setReceiptTarget(null)}
      >
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="coop-receipt-dialog"
        >
          <DialogHeader>
            <DialogTitle>Bordereau de retrait de caisse</DialogTitle>
            <DialogDescription>
              Reçu officiel de décaissement pour le membre et les archives de caisse.
            </DialogDescription>
          </DialogHeader>

          {receiptTarget && (
            <div className="coop-print-receipt">
              <div className="coop-receipt-brand">
                <div className="coop-receipt-mark">MW</div>
                <div>
                  <strong>{MWANGAZA_BRAND.name.toUpperCase()}</strong>
                  <small>{MWANGAZA_BRAND.subtitle}</small>
                  <small>{MWANGAZA_BRAND.pillars}</small>
                </div>
              </div>

              <div className="coop-receipt-rule" />

              <h3>BORDEREAU DE DÉCAISSEMENT D’ESPÈCES</h3>

              <div className="coop-receipt-total">
                - {formatCurrency(receiptTarget.amount, receiptTarget.currency)}
              </div>

              <dl>
                <div>
                  <dt>Réf. opération</dt>
                  <dd><strong>{receiptTarget.reference}</strong></dd>
                </div>
                <div>
                  <dt>Date & Heure</dt>
                  <dd>
                    {formatDate(receiptTarget.dateISO)} {receiptTarget.time ? `à ${receiptTarget.time}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Compte membre</dt>
                  <dd><strong>{receiptTarget.accountNumber}</strong></dd>
                </div>
                <div>
                  <dt>Titulaire</dt>
                  <dd>{receiptTarget.memberName}</dd>
                </div>
                <div>
                  <dt>Montant décaissé</dt>
                  <dd>
                    <strong>{formatCurrency(receiptTarget.amount, receiptTarget.currency)}</strong>
                  </dd>
                </div>
                {receiptTarget.frais > 0 && (
                  <div>
                    <dt>Frais de retrait</dt>
                    <dd>{formatCurrency(receiptTarget.frais, receiptTarget.currency)}</dd>
                  </div>
                )}
                <div>
                  <dt>Nouveau solde</dt>
                  <dd>{formatCurrency(receiptTarget.soldeApres, receiptTarget.currency)}</dd>
                </div>
                <div>
                  <dt>Motif</dt>
                  <dd>{receiptTarget.reason || "Retrait au guichet"}</dd>
                </div>
                <div>
                  <dt>Exécuté par</dt>
                  <dd>
                    {receiptTarget.executedBy
                      ? `${receiptTarget.executedBy.role.toUpperCase()} #${receiptTarget.executedBy.id}`
                      : "Guichetier"}
                  </dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>
                    <span style={{ textTransform: "uppercase", fontWeight: 700 }}>
                      {receiptTarget.status === "completed" ? "Payé / Décaissé" : receiptTarget.status}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="coop-receipt-rule" />

              {/* Cadre de double émargement */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  marginTop: "12px",
                  fontSize: "10px",
                }}
              >
                <div style={{ textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: "8px", padding: "8px" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 24px 0", color: "#334155" }}>
                    Signature du Membre
                  </p>
                  <small style={{ color: "#64748b", fontSize: "9px" }}>
                    Bon pour décharge
                  </small>
                </div>
                <div style={{ textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: "8px", padding: "8px" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 24px 0", color: "#334155" }}>
                    Visa du Guichetier
                  </p>
                  <small style={{ color: "#64748b", fontSize: "9px" }}>
                    Cachet de la caisse
                  </small>
                </div>
              </div>

              <p style={{ marginTop: "10px", fontSize: "9px", color: "#64748b" }}>
                Conservez ce reçu. Document certifié conforme émis par {MWANGAZA_BRAND.name}.
              </p>
            </div>
          )}

          <div className="coop-form-actions">
            <button
              className="mw-secondary"
              type="button"
              onClick={() => setReceiptTarget(null)}
            >
              Fermer
            </button>
            <button
              className="mw-primary"
              type="button"
              onClick={() => window.print()}
            >
              <IconPrinter aria-hidden="true" />
              Imprimer le reçu
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Nouveau Retrait (Agent) */}
      {isAgent && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent
            data-theme={dark ? "dark" : "light"}
            className="mw-dialog-content coop-action-dialog coop-operation-dialog"
          >
            <DialogHeader>
              <DialogTitle>Nouveau retrait</DialogTitle>
              <DialogDescription>
                Le décaissement est enregistré au guichet : les limites, les
                frais et le solde sont vérifiés par le serveur, puis le
                lecteur biométrique du membre est déclenché.
              </DialogDescription>
            </DialogHeader>
            <form className="coop-operation-form" onSubmit={createRequest}>
              <div className="coop-form-field">
                <label htmlFor="retrait-compte">Compte du membre</label>
                <span className="coop-form-grid">
                  <input
                    id="retrait-compte"
                    value={compteInput}
                    onChange={(event) => {
                      setCompteInput(event.target.value);
                      setMemberCheck(null);
                    }}
                    placeholder="Ex. MW-2025-0001"
                    required
                  />
                  <button
                    className="mw-secondary"
                    type="button"
                    onClick={() => void verifyMember()}
                    disabled={checking}
                  >
                    {checking ? "Vérification…" : "Vérifier"}
                  </button>
                </span>
              </div>
              {memberCheck && (
                <div className="coop-credit-eligibility">
                  <span>Membre</span>
                  <strong>{memberCheck.nomComplet}</strong>
                  <span>Solde principal</span>
                  <strong>
                    {formatCurrency(memberCheck.soldeUSD, "USD")} ·{" "}
                    {formatCurrency(memberCheck.soldeFC, "FC")}
                  </strong>
                </div>
              )}
              <div className="coop-form-grid">
                <label className="coop-form-field">
                  Montant
                  <input
                    name="montant"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label className="coop-form-field">
                  Devise
                  <select name="devise" defaultValue="USD" required>
                    <option value="USD">USD</option>
                    <option value="FC">FC</option>
                  </select>
                </label>
              </div>
              <label className="coop-form-field">
                Motif
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Précisez la raison du retrait"
                />
              </label>
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
                  disabled={createBusy || !memberCheck}
                >
                  {createBusy ? "Enregistrement…" : "Décaisser le retrait"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Annulation (Admin) */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog"
        >
          <DialogHeader>
            <DialogTitle>Annuler le retrait {cancelTarget?.reference}</DialogTitle>
            <DialogDescription>
              L’annulation contrepasse l’opération et restitue les fonds à la
              caisse de l’agent. Elle est définitive.
            </DialogDescription>
          </DialogHeader>
          <form className="coop-operation-form" onSubmit={submitCancel}>
            <label className="coop-form-field">
              Motif de l’annulation
              <textarea
                required
                minLength={5}
                rows={3}
                value={cancelMotif}
                onChange={(event) => setCancelMotif(event.target.value)}
                placeholder="Expliquez la décision"
              />
            </label>
            <label className="coop-check-field">
              <input
                type="checkbox"
                checked={cancelCash}
                onChange={(event) => setCancelCash(event.target.checked)}
              />
              Je confirme que le montant payé a été rendu physiquement à la
              caisse.
            </label>
            {cancelError && (
              <p className="coop-form-error" role="alert">
                {cancelError}
              </p>
            )}
            <div className="coop-form-actions">
              <button
                className="mw-secondary"
                type="button"
                onClick={() => setCancelTarget(null)}
              >
                Annuler
              </button>
              <button
                className="mw-danger"
                type="submit"
                disabled={
                  cancelBusy ||
                  cancelMotif.trim().length < 5 ||
                  !cancelCash
                }
              >
                {cancelBusy ? "Annulation…" : "Confirmer l’annulation"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WithdrawalDetails({
  withdrawal,
  canCancel,
  onCancel,
  onPrintReceipt,
}: {
  withdrawal: BackendWithdrawal;
  canCancel: boolean;
  onCancel: () => void;
  onPrintReceipt: (w: BackendWithdrawal) => void;
}) {
  const status = withdrawalStatus[withdrawal.status] ?? {
    label: withdrawal.status,
    tone: "pending" as BadgeTone,
    tab: "Tous",
  };
  return (
    <div className="coop-drawer-content coop-withdrawal-detail">
      <div className="coop-drawer-member">
        <span className="mw-member-avatar">
          {initialsOf(withdrawal.memberName || "?")}
        </span>
        <div>
          <strong>{withdrawal.memberName}</strong>
          <span>{withdrawal.accountNumber}</span>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      <section className="coop-drawer-section">
        <h3>Retrait {withdrawal.reference}</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Montant</dt>
            <dd className="coop-amount-cell">
              {formatCurrency(withdrawal.amount, withdrawal.currency)}
            </dd>
          </div>
          <div>
            <dt>Frais</dt>
            <dd>{formatCurrency(withdrawal.frais, withdrawal.currency)}</dd>
          </div>
          <div>
            <dt>Solde avant</dt>
            <dd>
              {formatCurrency(withdrawal.soldeAvant, withdrawal.currency)}
            </dd>
          </div>
          <div>
            <dt>Solde après</dt>
            <dd>
              {formatCurrency(withdrawal.soldeApres, withdrawal.currency)}
            </dd>
          </div>
          <div>
            <dt>Motif</dt>
            <dd>{withdrawal.reason}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>
              {formatDate(withdrawal.dateISO)} {withdrawal.time}
            </dd>
          </div>
          <div>
            <dt>Exécuté par</dt>
            <dd>
              {withdrawal.executedBy
                ? `${withdrawal.executedBy.role} #${withdrawal.executedBy.id}`
                : "—"}
            </dd>
          </div>
          {withdrawal.cancelledAt && (
            <div>
              <dt>Annulé le</dt>
              <dd>
                {formatDate(withdrawal.cancelledAt)}
                {withdrawal.cancellationReason
                  ? ` · ${withdrawal.cancellationReason}`
                  : ""}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="coop-drawer-section">
        <h3>Historique</h3>
        <ol className="coop-timeline">
          <li>
            <span className="coop-timeline-dot is-done" />
            <div>
              <strong>Retrait décaissé</strong>
              <small>
                {formatDate(withdrawal.dateISO)} · {withdrawal.time}
              </small>
            </div>
          </li>
          {withdrawal.cancelledAt && (
            <li>
              <span className="coop-timeline-dot is-rejected" />
              <div>
                <strong>Annulation</strong>
                <small>
                  {formatDate(withdrawal.cancelledAt)} ·{" "}
                  {withdrawal.cancellationReason || "Motif non renseigné"}
                </small>
              </div>
            </li>
          )}
        </ol>
      </section>

      <div className="coop-withdrawal-actions" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Bouton d'impression directe du reçu de caisse */}
        <button
          className="mw-secondary"
          type="button"
          onClick={() => onPrintReceipt(withdrawal)}
        >
          <IconPrinter aria-hidden="true" />
          Imprimer le reçu de caisse
        </button>

        {canCancel && (
          <button className="mw-danger" type="button" onClick={onCancel}>
            <IconAlertTriangle aria-hidden="true" />
            Annuler ce retrait
          </button>
        )}
        {withdrawal.status === "cancelled" && (
          <span className="coop-inline-note">
            Motif : {withdrawal.cancellationReason || "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function MovementDetails({ movement }: { movement: CashMovement }) {
  const meta = movementMeta[movement.type] ?? {
    label: movement.type,
    tone: "pending" as BadgeTone,
    tab: "Tous",
  };
  return (
    <div className="coop-drawer-content coop-withdrawal-detail">
      <div className="coop-drawer-member">
        <span className="mw-member-avatar">
          {initialsOf(movement.acteur?.role || "CA")}
        </span>
        <div>
          <strong>{meta.label}</strong>
          <span>Caisse d’agent</span>
        </div>
        <StatusBadge label={meta.label} tone={meta.tone} />
      </div>

      <section className="coop-drawer-section">
        <h3>Mouvement n° {movement.id}</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Type</dt>
            <dd>{meta.label}</dd>
          </div>
          <div>
            <dt>Montant</dt>
            <dd className="coop-amount-cell">
              {formatCurrency(movement.montant, movement.devise)}
            </dd>
          </div>
          <div>
            <dt>Solde caisse avant</dt>
            <dd>{formatCurrency(movement.soldeAvant, movement.devise)}</dd>
          </div>
          <div>
            <dt>Solde caisse après</dt>
            <dd>{formatCurrency(movement.soldeApres, movement.devise)}</dd>
          </div>
          <div>
            <dt>Motif</dt>
            <dd>{movement.motif || "—"}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(movement.createdAt)}</dd>
          </div>
          {movement.referenceRetrait && (
            <div>
              <dt>Retrait lié</dt>
              <dd>{movement.referenceRetrait}</dd>
            </div>
          )}
          <div>
            <dt>Effectué par</dt>
            <dd>
              {movement.acteur
                ? `${movement.acteur.role} #${movement.acteur.id}`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
