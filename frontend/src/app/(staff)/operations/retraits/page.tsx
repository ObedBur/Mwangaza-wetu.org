'use client';

import {
  IconAlertTriangle,
  IconArrowUp,
  IconCheck,
  IconClock,
  IconSearch,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState, type FormEvent } from "react";

import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
import { CooperativePagination } from "@/components/cooperative/CooperativePagination";
import {
  AccountPills,
  CooperativeBreadcrumb,
  CooperativeStatCard,
  CooperativeStatus,
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
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { mockAccounts } from "@/mocks/cooperative-data";
import {
  getMemberForOperation,
  getWithdrawalChecks,
  mockWithdrawals,
  paymentMethods,
  type PaymentMethod,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "@/mocks/operations-data";

const statuses: WithdrawalStatus[] = [
  "En attente",
  "Approuvé",
  "Payé",
  "Rejeté",
];
const statusOrder: (WithdrawalStatus | "Tous")[] = [
  "En attente",
  "Approuvé",
  "Payé",
  "Rejeté",
  "Tous",
];
const periods = [
  "Toutes les périodes",
  "Ce mois",
  "30 derniers jours",
] as const;

export function meta() {
  return [{ title: "Retraits — Mwangaza Wetu" }];
}

export default function WithdrawalsRoute() {
  const dark = useCooperativeDarkTheme();
  const [records, setRecords] = useState(mockWithdrawals);
  const [activeStatus, setActiveStatus] = useState<WithdrawalStatus | "Tous">(
    "En attente",
  );
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<AccountSlug | "">("");
  const [urgency, setUrgency] = useState(false);
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[1]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("M-Pesa");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const selected = records.find((request) => request.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    return records
      .filter(
        (request) => activeStatus === "Tous" || request.status === activeStatus,
      )
      .filter((request) => {
        const member = getMemberForOperation(request.memberId);
        return `${member.name} ${member.memberNumber} ${request.reference}`
          .toLocaleLowerCase("fr-FR")
          .includes(search);
      })
      .filter((request) => !account || request.account === account)
      .filter((request) => !urgency || request.urgent)
      .filter(
        (request) =>
          period === periods[0] ||
          (period === periods[1]
            ? request.requestedAt.startsWith("2025-06")
            : request.requestedAt >= "2025-05-26"),
      );
  }, [account, activeStatus, period, query, records, urgency]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pending = records.filter((request) => request.status === "En attente");
  const pendingAmount = pending.reduce(
    (sum, request) => sum + request.amount,
    0,
  );
  const month = records.filter((request) =>
    request.requestedAt.startsWith("2025-06"),
  );
  const approvedCount = month.filter(
    (request) => request.status === "Approuvé",
  ).length;
  const paidCount = month.filter((request) => request.status === "Payé").length;
  const rejectedCount = month.filter(
    (request) => request.status === "Rejeté",
  ).length;

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  function changeStatus(request: WithdrawalRecord, next: WithdrawalStatus) {
    setRecords((current) =>
      current.map((item) =>
        item.id === request.id ? { ...item, status: next } : item,
      ),
    );
  }

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = String(form.get("memberId"));
    const slug = String(form.get("account")) as AccountSlug;
    const amount = Number(form.get("amount"));
    const reason = String(form.get("reason")).trim();
    const proofProvided = form.get("proofProvided") === "on";
    const urgent = form.get("urgent") === "on";
    if (!memberId || !accountSlugs.includes(slug) || !(amount > 0) || !reason) {
      setFormError(
        "Renseignez le membre, le compte, un motif et un montant supérieur à zéro.",
      );
      return;
    }
    const member = getMemberForOperation(memberId);
    const balance = member.balances[slug];
    const rules = mockAccounts[slug].rules;
    const minRemainingApplies = !["principal", "hopital"].includes(slug);
    const remainingValid =
      !minRemainingApplies || balance - amount >= rules.minimumDeposit;
    const goalBlocked =
      slug === "nyumba" &&
      rules.targetAmount !== null &&
      balance < rules.targetAmount;
    const proofRequired = ["kelasi", "mutoto"].includes(slug);
    if (amount > balance) {
      setFormError(
        `Solde insuffisant : ${formatCurrency(balance)} disponibles sur ce compte.`,
      );
      return;
    }
    if (!remainingValid) {
      setFormError(
        `Le retrait doit laisser au moins ${formatCurrency(rules.minimumDeposit)} sur ce compte.`,
      );
      return;
    }
    if (goalBlocked) {
      setFormError(
        `Le compte NYUMBA reste bloqué jusqu’à l’objectif de ${formatCurrency(rules.targetAmount ?? 0)}.`,
      );
      return;
    }
    if (proofRequired && !proofProvided) {
      setFormError(
        `Un justificatif est requis pour le compte ${accountConfigs[slug].shortLabel}.`,
      );
      return;
    }
    const newRequest: WithdrawalRecord = {
      id: `withdrawal-local-${Date.now()}`,
      reference: `RET-2025-${String(records.length + 1).padStart(4, "0")}`,
      memberId,
      account: slug,
      amount,
      reason,
      requestedAt: "2025-06-25",
      status: "En attente",
      urgent: urgent && slug === "hopital",
      proofProvided,
      method: String(form.get("method")) as PaymentMethod,
    };
    setRecords((current) => [newRequest, ...current]);
    setActiveStatus("En attente");
    setPage(1);
    setCreateOpen(false);
    setFormError("");
    setSuccess(
      `Demande ${newRequest.reference} créée en attente de validation.`,
    );
  }

  function approveRequest() {
    if (!selected || getWithdrawalChecks(selected).some((check) => !check.ok))
      return;
    changeStatus(selected, "Approuvé");
    setSuccess(`Demande ${selected.reference} approuvée.`);
  }

  function rejectRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !rejectReason.trim()) return;
    const id = selected.id;
    setRecords((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: "Rejeté", rejectionReason: rejectReason.trim() }
          : item,
      ),
    );
    setRejectOpen(false);
    setRejectReason("");
    setSuccess(`Demande ${selected.reference} rejetée avec motif.`);
  }

  function markPaid() {
    if (!selected || selected.status !== "Approuvé") return;
    setRecords((current) =>
      current.map((item) =>
        item.id === selected.id
          ? { ...item, status: "Payé", method: paymentMethod }
          : item,
      ),
    );
    setSuccess(
      `Retrait ${selected.reference} marqué payé par ${paymentMethod}.`,
    );
  }

  return (
    <div className="coop-operations-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Retraits" />
          <h1>Retraits</h1>
          <p>Examen et approbation des demandes de retrait des membres.</p>
        </div>
        <div className="coop-page-actions">
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

      <CooperativeDataState
        loading={false}
        error={false}
        empty={records.length === 0}
      >
        <section
          className="coop-stat-grid"
          aria-label="Indicateurs des retraits"
        >
          <CooperativeStatCard
            label="Demandes en attente"
            value={pending.length}
            detail={formatCurrency(pendingAmount)}
            icon={IconClock}
            accent="#c18c2d"
          />
          <CooperativeStatCard
            label="Approuvées ce mois"
            value={approvedCount}
            detail="En juin 2025"
            icon={IconCheck}
          />
          <CooperativeStatCard
            label="Payées ce mois"
            value={paidCount}
            detail="En juin 2025"
            icon={IconWallet}
            accent="#4384b5"
          />
          <CooperativeStatCard
            label="Rejetées ce mois"
            value={rejectedCount}
            detail="En juin 2025"
            icon={IconX}
            accent="#c95151"
          />
        </section>
      </CooperativeDataState>

      <section
        className="mw-panel coop-operations-panel"
        aria-label="Demandes de retrait"
      >
        <div
          className="coop-withdrawal-tabs"
          role="tablist"
          aria-label="Filtrer les demandes par statut"
        >
          {statusOrder.map((tab) => {
            const count =
              tab === "Tous"
                ? records.length
                : records.filter((request) => request.status === tab).length;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={activeStatus === tab}
                className={activeStatus === tab ? "is-active" : ""}
                key={tab}
                onClick={() => changeFilter(() => setActiveStatus(tab))}
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
              placeholder="Membre ou référence…"
              onChange={(event) =>
                changeFilter(() => setQuery(event.target.value))
              }
            />
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Compte d’épargne</span>
            <select
              value={account}
              onChange={(event) =>
                changeFilter(() =>
                  setAccount(event.target.value as AccountSlug | ""),
                )
              }
            >
              <option value="">Tous les comptes</option>
              {accountSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {accountConfigs[slug].shortLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Urgence</span>
            <select
              value={urgency ? "urgent" : "all"}
              onChange={(event) =>
                changeFilter(() => setUrgency(event.target.value === "urgent"))
              }
            >
              <option value="all">Urgence : toutes</option>
              <option value="urgent">Urgentes uniquement</option>
            </select>
          </label>
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
        </div>
        <CooperativeDataState
          loading={false}
          error={false}
          empty={visible.length === 0}
          emptyMessage="Aucune demande ne correspond à ces filtres."
        >
          <div className="coop-table-scroll">
            <table className="mw-table coop-operation-table coop-withdrawal-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Membre</th>
                  <th>Compte</th>
                  <th>Montant demandé</th>
                  <th>Solde disponible</th>
                  <th>Motif</th>
                  <th>Demandé le</th>
                  <th>Urgence</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((request) => {
                  const member = getMemberForOperation(request.memberId);
                  return (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.reference}</strong>
                      </td>
                      <td>
                        <span className="mw-member">
                          <span className="mw-member-avatar">
                            {member.name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <span>{member.name}</span>
                        </span>
                      </td>
                      <td>
                        <span
                          className="coop-account-cell"
                          style={
                            {
                              "--coop-accent":
                                accountConfigs[request.account].color,
                            } as React.CSSProperties
                          }
                        >
                          <AccountPills accounts={[request.account]} />
                          {accountConfigs[request.account].shortLabel}
                        </span>
                      </td>
                      <td className="coop-amount-cell">
                        {formatCurrency(request.amount)}
                      </td>
                      <td>
                        {formatCurrency(member.balances[request.account])}
                      </td>
                      <td className="coop-reason-cell">{request.reason}</td>
                      <td>{formatDate(request.requestedAt)}</td>
                      <td>
                        {request.urgent ? (
                          <span className="coop-urgent-badge">
                            <IconAlertTriangle aria-hidden="true" />
                            Urgent
                          </span>
                        ) : (
                          <span className="coop-no-goal">—</span>
                        )}
                      </td>
                      <td>
                        <CooperativeStatus
                          status={
                            request.status === "Approuvé" ||
                            request.status === "Payé"
                              ? "Validé"
                              : request.status === "Rejeté"
                                ? "Rejeté"
                                : "En attente"
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="mw-secondary coop-examine-button"
                          type="button"
                          onClick={() => {
                            setSelectedId(request.id);
                            setRejectOpen(false);
                          }}
                        >
                          Examiner
                        </button>
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
          onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
          itemLabel="demandes"
        />
      </section>

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
            Détail de la demande
          </SheetTitle>
          {selected && (
            <WithdrawalDetails
              request={selected}
              onApprove={approveRequest}
              onReject={() => setRejectOpen(true)}
              onPaid={markPaid}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog"
        >
          <DialogHeader>
            <DialogTitle>Nouveau retrait</DialogTitle>
            <DialogDescription>
              La demande est ajoutée localement au workflow de démonstration.
            </DialogDescription>
          </DialogHeader>
          <form className="coop-operation-form" onSubmit={createRequest}>
            <label className="coop-form-field">
              Membre
              <select
                name="memberId"
                required
                defaultValue={mockAccounts.principal.holders[0].member.id}
              >
                {mockAccounts.principal.holders.map(({ member }) => (
                  <option value={member.id} key={member.id}>
                    {member.name} · {member.memberNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="coop-form-field">
              Compte d’épargne
              <select name="account" required defaultValue="principal">
                {accountSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {accountConfigs[slug].shortLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="coop-form-field">
              Montant demandé (USD)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label className="coop-form-field">
              Motif
              <textarea
                name="reason"
                rows={2}
                required
                placeholder="Précisez la raison du retrait"
              />
            </label>
            <label className="coop-form-field">
              Mode de paiement souhaité
              <select name="method" required>
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label className="coop-check-field">
              <input name="proofProvided" type="checkbox" />
              Justificatif joint (simulation)
            </label>
            <label className="coop-check-field">
              <input name="urgent" type="checkbox" />
              Marquer comme urgent (compte HOPITAL)
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
              <button className="mw-primary" type="submit">
                Créer la demande
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog"
        >
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
            <DialogDescription>
              Un motif de rejet est obligatoire et sera ajouté à l’historique.
            </DialogDescription>
          </DialogHeader>
          <form className="coop-operation-form" onSubmit={rejectRequest}>
            <label className="coop-form-field">
              Motif du rejet
              <textarea
                required
                minLength={5}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                placeholder="Expliquez la décision au membre"
              />
            </label>
            <div className="coop-form-actions">
              <button
                className="mw-secondary"
                type="button"
                onClick={() => setRejectOpen(false)}
              >
                Annuler
              </button>
              <button
                className="mw-danger"
                type="submit"
                disabled={rejectReason.trim().length < 5}
              >
                Confirmer le rejet
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WithdrawalDetails({
  request,
  onApprove,
  onReject,
  onPaid,
  paymentMethod,
  setPaymentMethod,
}: {
  request: WithdrawalRecord;
  onApprove: () => void;
  onReject: () => void;
  onPaid: () => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
}) {
  const member = getMemberForOperation(request.memberId);
  const account = accountConfigs[request.account];
  const rules = mockAccounts[request.account].rules;
  const balance = member.balances[request.account];
  const checks = getWithdrawalChecks(request);
  const canApprove =
    request.status === "En attente" && checks.every((check) => check.ok);
  return (
    <div className="coop-drawer-content coop-withdrawal-detail">
      <div className="coop-drawer-member">
        <span className="mw-member-avatar">
          {member.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <strong>{member.name}</strong>
          <span>
            {member.memberNumber} · {member.phone}
          </span>
        </div>
        <CooperativeStatus status={member.status} />
      </div>
      <section className="coop-drawer-section">
        <h3>Demande {request.reference}</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Compte</dt>
            <dd>
              <span
                className="coop-account-cell"
                style={
                  { "--coop-accent": account.color } as React.CSSProperties
                }
              >
                <AccountPills accounts={[request.account]} />
                {account.shortLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt>Montant demandé</dt>
            <dd className="coop-amount-cell">
              {formatCurrency(request.amount)}
            </dd>
          </div>
          <div>
            <dt>Solde disponible</dt>
            <dd>{formatCurrency(balance)}</dd>
          </div>
          <div>
            <dt>Motif</dt>
            <dd>{request.reason}</dd>
          </div>
          <div>
            <dt>Date de demande</dt>
            <dd>{formatDate(request.requestedAt)}</dd>
          </div>
          <div>
            <dt>Urgence</dt>
            <dd>{request.urgent ? "Urgente · HOPITAL" : "Standard"}</dd>
          </div>
        </dl>
      </section>
      <section className="coop-drawer-section">
        <h3>Règles applicables</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>Conditions</dt>
            <dd>{rules.withdrawalConditions}</dd>
          </div>
          <div>
            <dt>Blocage</dt>
            <dd>{rules.blockingPeriod}</dd>
          </div>
          <div>
            <dt>Minimum restant</dt>
            <dd>
              {["principal", "hopital"].includes(request.account)
                ? "Aucun minimum imposé"
                : formatCurrency(rules.minimumDeposit)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="coop-drawer-section">
        <h3>Vérifications automatiques</h3>
        <ul className="coop-check-list">
          {checks.map((check) => (
            <li key={check.label} className={check.ok ? "is-ok" : "is-alert"}>
              <span>
                {check.ok ? (
                  <IconCheck aria-hidden="true" />
                ) : (
                  <IconAlertTriangle aria-hidden="true" />
                )}
              </span>
              <div>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="coop-drawer-section">
        <h3>Historique de la demande</h3>
        <ol className="coop-timeline">
          <li>
            <span className="coop-timeline-dot is-done" />
            <div>
              <strong>Demande créée</strong>
              <small>{formatDate(request.requestedAt)} · par le membre</small>
            </div>
          </li>
          {request.status !== "En attente" && (
            <li>
              <span
                className={`coop-timeline-dot ${request.status === "Rejeté" ? "is-rejected" : "is-done"}`}
              />
              <div>
                <strong>
                  {request.status === "Rejeté"
                    ? "Demande rejetée"
                    : request.status === "Payé"
                      ? "Retrait payé"
                      : "Demande approuvée"}
                </strong>
                <small>
                  {formatDate(request.requestedAt)} ·{" "}
                  {request.status === "Rejeté"
                    ? request.rejectionReason
                    : "Validation administrateur"}
                </small>
              </div>
            </li>
          )}
        </ol>
      </section>
      {request.status === "Approuvé" && (
        <section className="coop-drawer-section">
          <label className="coop-form-field">
            Mode de paiement
            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentMethod)
              }
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
        </section>
      )}
      <div className="coop-withdrawal-actions">
        {request.status === "En attente" && (
          <>
            <button className="mw-danger" type="button" onClick={onReject}>
              Rejeter
            </button>
            <button
              className="mw-primary"
              type="button"
              disabled={!canApprove}
              title={
                !canApprove
                  ? "Corrigez les vérifications en alerte avant approbation."
                  : undefined
              }
              onClick={onApprove}
            >
              <IconCheck aria-hidden="true" />
              Approuver
            </button>
          </>
        )}
        {request.status === "Approuvé" && (
          <button className="mw-primary" type="button" onClick={onPaid}>
            <IconWallet aria-hidden="true" />
            Marquer comme payé
          </button>
        )}
        {request.status === "Payé" && (
          <span className="coop-inline-note">
            Retrait payé · {request.method}
          </span>
        )}
        {request.status === "Rejeté" && (
          <span className="coop-inline-note">
            Motif : {request.rejectionReason}
          </span>
        )}
      </div>
    </div>
  );
}
