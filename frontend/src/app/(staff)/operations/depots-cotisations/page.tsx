'use client';

import {
  IconArrowDown,
  IconBellRinging,
  IconCheck,
  IconDownload,
  IconReceipt,
  IconSearch,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState, type FormEvent } from "react";

import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
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
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import { mockMembers } from "@/mocks/cooperative-data";
import {
  getMemberForOperation,
  mockDeposits,
  mockLateContributions,
  paymentMethods,
  type DepositKind,
  type DepositRecord,
  type PaymentMethod,
} from "@/mocks/operations-data";

const pageSize = 10;
const periods = [
  "Toutes les périodes",
  "Ce mois",
  "30 derniers jours",
] as const;

export function meta() {
  return [{ title: "Dépôts & cotisations — Mwangaza Wetu" }];
}

export default function DepositsContributionsRoute() {
  const dark = useCooperativeDarkTheme();
  const [records, setRecords] = useState(mockDeposits);
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<AccountSlug | "">("");
  const [kind, setKind] = useState<DepositKind | "">("");
  const [status, setStatus] = useState<DepositRecord["status"] | "">("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[1]);
  const [page, setPage] = useState(1);
  const [formKind, setFormKind] = useState<DepositKind | null>(null);
  const [receipt, setReceipt] = useState<DepositRecord | null>(null);
  const [lateMessage, setLateMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    return records
      .filter((record) => {
        const member = getMemberForOperation(record.memberId);
        return `${member.name} ${record.reference}`
          .toLocaleLowerCase("fr-FR")
          .includes(search);
      })
      .filter((record) => !account || record.account === account)
      .filter((record) => !kind || record.kind === kind)
      .filter((record) => !status || record.status === status)
      .filter((record) => !method || record.method === method)
      .filter(
        (record) =>
          period === periods[0] ||
          (period === periods[1]
            ? record.date.startsWith("2025-06")
            : record.date >= "2025-05-26"),
      );
  }, [account, kind, method, period, query, records, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const monthRecords = records.filter((record) =>
    record.date.startsWith("2025-06"),
  );
  const collected = monthRecords
    .filter((record) => record.status === "Validé")
    .reduce((sum, record) => sum + record.amount, 0);
  const pendingCount = records.filter(
    (record) => record.status === "En attente",
  ).length;
  const lateTotal = mockLateContributions.reduce(
    (sum, item) => sum + item.amountDue,
    0,
  );

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  function updateStatus(record: DepositRecord, next: DepositRecord["status"]) {
    setRecords((current) =>
      current.map((item) =>
        item.id === record.id ? { ...item, status: next } : item,
      ),
    );
  }

  function createDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = String(form.get("memberId"));
    const slug = String(form.get("account")) as AccountSlug;
    const amount = Number(form.get("amount"));
    const date = String(form.get("date"));
    if (!memberId || !accountSlugs.includes(slug) || !(amount > 0) || !date) {
      setFormError(
        "Choisissez un membre, un compte, une date et un montant supérieur à zéro.",
      );
      return;
    }
    const member = getMemberForOperation(memberId);
    const newRecord: DepositRecord = {
      id: `deposit-local-${Date.now()}`,
      reference: `DEP-2025-${String(records.length + 1).padStart(4, "0")}`,
      memberId,
      account: slug,
      kind: formKind ?? "Dépôt",
      amount,
      method: String(form.get("method")) as PaymentMethod,
      date,
      status: "Validé",
      transactionReference: String(form.get("transactionReference") || "—"),
      note: String(form.get("note") || "Versement enregistré en démonstration"),
    };
    setRecords((current) => [newRecord, ...current]);
    setSuccess(
      `${newRecord.kind} simulé pour ${member.name} — ${formatCurrency(amount)}.`,
    );
    setFormError("");
    setFormKind(null);
  }

  return (
    <div className="coop-operations-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb
            section="Opérations"
            current="Dépôts & cotisations"
          />
          <h1>Dépôts & cotisations</h1>
          <p>Suivi des versements et des cotisations des membres.</p>
        </div>
        <div className="coop-page-actions">
          <button
            className="mw-secondary"
            type="button"
            onClick={() => {
              setFormKind("Cotisation");
              setFormError("");
            }}
          >
            <IconWallet aria-hidden="true" /> Nouvelle cotisation
          </button>
          <button
            className="mw-primary"
            type="button"
            onClick={() => {
              setFormKind("Dépôt");
              setFormError("");
            }}
          >
            <IconArrowDown aria-hidden="true" /> Nouveau dépôt
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
          aria-label="Indicateurs des dépôts et cotisations"
        >
          <CooperativeStatCard
            label="Total encaissé ce mois"
            value={formatCurrency(collected)}
            detail="Versements validés en juin"
            icon={IconWallet}
          />
          <CooperativeStatCard
            label="Nombre d’opérations"
            value={records.length}
            detail="Dépôts et cotisations"
            icon={IconReceipt}
          />
          <CooperativeStatCard
            label="En attente de validation"
            value={pendingCount}
            detail="À examiner"
            icon={IconBellRinging}
            accent="#c18c2d"
          />
          <CooperativeStatCard
            label="Cotisations en retard"
            value={mockLateContributions.length}
            detail={`${formatCurrency(lateTotal)} à recouvrer`}
            icon={IconX}
            accent="#c95151"
          />
        </section>
      </CooperativeDataState>

      <section
        className="mw-panel coop-operations-panel"
        aria-label="Liste des dépôts et cotisations"
      >
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
            <span className="sr-only">Type d’opération</span>
            <select
              value={kind}
              onChange={(event) =>
                changeFilter(() =>
                  setKind(event.target.value as DepositKind | ""),
                )
              }
            >
              <option value="">Dépôts et cotisations</option>
              <option>Dépôt</option>
              <option>Cotisation</option>
            </select>
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Statut</span>
            <select
              value={status}
              onChange={(event) =>
                changeFilter(() =>
                  setStatus(event.target.value as DepositRecord["status"] | ""),
                )
              }
            >
              <option value="">Tous les statuts</option>
              <option>Validé</option>
              <option>En attente</option>
              <option>Rejeté</option>
            </select>
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Mode de paiement</span>
            <select
              value={method}
              onChange={(event) =>
                changeFilter(() =>
                  setMethod(event.target.value as PaymentMethod | ""),
                )
              }
            >
              <option value="">Tous les modes</option>
              {paymentMethods.map((item) => (
                <option key={item}>{item}</option>
              ))}
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
          emptyMessage="Aucune opération ne correspond à ces filtres."
        >
          <div className="coop-table-scroll">
            <table className="mw-table coop-operation-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Membre</th>
                  <th>Compte</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => {
                  const member = getMemberForOperation(record.memberId);
                  return (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.reference}</strong>
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
                                accountConfigs[record.account].color,
                            } as React.CSSProperties
                          }
                        >
                          <AccountPills accounts={[record.account]} />
                          {accountConfigs[record.account].shortLabel}
                        </span>
                      </td>
                      <td>{record.kind}</td>
                      <td className="coop-amount-cell">
                        {formatCurrency(record.amount)}
                      </td>
                      <td>{record.method}</td>
                      <td>{formatDate(record.date)}</td>
                      <td>
                        <CooperativeStatus status={record.status} />
                      </td>
                      <td>
                        <div className="coop-row-actions">
                          {record.status === "En attente" && (
                            <>
                              <button
                                type="button"
                                aria-label={`Valider ${record.reference}`}
                                title="Valider"
                                onClick={() => updateStatus(record, "Validé")}
                              >
                                <IconCheck aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Rejeter ${record.reference}`}
                                title="Rejeter"
                                onClick={() => updateStatus(record, "Rejeté")}
                              >
                                <IconX aria-hidden="true" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            aria-label={`Voir le reçu ${record.reference}`}
                            title="Voir le reçu"
                            onClick={() => setReceipt(record)}
                          >
                            <IconReceipt aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CooperativeDataState>
        <div className="coop-pagination">
          <span>{filtered.length} opérations</span>
          <div>
            <button
              className="mw-secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {t.previous}
            </button>
            <span>
              {t.pageOf} {page} {t.of} {pages}
            </span>
            <button
              className="mw-secondary"
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              {t.next}
            </button>
          </div>
        </div>
      </section>

      <section
        className="mw-panel coop-late-panel"
        aria-labelledby="coop-late-title"
      >
        <div className="mw-panel-header">
          <div>
            <h2 id="coop-late-title">Cotisations en retard</h2>
            <p>Rappels de cotisation à effectuer auprès des membres.</p>
          </div>
          <span className="coop-panel-count">
            {mockLateContributions.length}
          </span>
        </div>
        <CooperativeDataState
          loading={false}
          error={false}
          empty={mockLateContributions.length === 0}
          emptyMessage="Aucune cotisation en retard."
        >
          <div className="coop-table-scroll">
            <table className="mw-table coop-late-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Compte</th>
                  <th>Période</th>
                  <th>Montant dû</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mockLateContributions.map(({ member, amountDue, month }) => {
                  const memberAccount = accountSlugs.find(
                    (slug) => member.balances[slug] > 0,
                  )!;
                  return (
                    <tr key={member.id}>
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
                                accountConfigs[memberAccount].color,
                            } as React.CSSProperties
                          }
                        >
                          <AccountPills accounts={[memberAccount]} />
                          {accountConfigs[memberAccount].shortLabel}
                        </span>
                      </td>
                      <td>{month}</td>
                      <td className="coop-amount-cell">
                        {formatCurrency(amountDue)}
                      </td>
                      <td>
                        <button
                          className="mw-secondary coop-remind-button"
                          type="button"
                          onClick={() =>
                            setLateMessage(`Rappel simulé pour ${member.name}.`)
                          }
                        >
                          <IconBellRinging aria-hidden="true" />
                          Rappeler
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CooperativeDataState>
        {lateMessage && (
          <p className="coop-inline-note" role="status">
            {lateMessage}
            <button type="button" onClick={() => setLateMessage("")}>
              Fermer
            </button>
          </p>
        )}
      </section>

      <Dialog
        open={formKind !== null}
        onOpenChange={(open) => !open && setFormKind(null)}
      >
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {formKind === "Cotisation"
                ? "Nouvelle cotisation"
                : "Nouveau dépôt"}
            </DialogTitle>
            <DialogDescription>
              Les données sont simulées et ne sont pas enregistrées.
            </DialogDescription>
          </DialogHeader>
          <form className="coop-operation-form" onSubmit={createDeposit}>
            <label className="coop-form-field">
              Membre
              <select name="memberId" required defaultValue="">
                <option value="" disabled>
                  Choisir un membre
                </option>
                {mockMembers.map((member) => (
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
            <div className="coop-form-grid">
              <label className="coop-form-field">
                Montant (USD)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label className="coop-form-field">
                Mode de paiement
                <select name="method" required>
                  {paymentMethods.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="coop-form-field">
              Référence de transaction
              <input
                name="transactionReference"
                placeholder="Ex. MPesa-12345"
              />
            </label>
            <div className="coop-form-grid">
              <label className="coop-form-field">
                Date
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue="2025-06-25"
                />
              </label>
              <label className="coop-form-field">
                Type
                <select
                  value={formKind ?? "Dépôt"}
                  onChange={(event) =>
                    setFormKind(event.target.value as DepositKind)
                  }
                >
                  <option>Dépôt</option>
                  <option>Cotisation</option>
                </select>
              </label>
            </div>
            <label className="coop-form-field">
              Note
              <textarea
                name="note"
                rows={2}
                placeholder="Ajouter une note (facultatif)"
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
                onClick={() => setFormKind(null)}
              >
                Annuler
              </button>
              <button className="mw-primary" type="submit">
                Simuler l’enregistrement
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receipt !== null}
        onOpenChange={(open) => !open && setReceipt(null)}
      >
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-receipt-dialog"
        >
          <DialogHeader>
            <DialogTitle>Aperçu du reçu</DialogTitle>
            <DialogDescription>
              Reçu de démonstration — seuls les versements validés sont
              imprimables.
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="coop-print-receipt">
              <div className="coop-receipt-brand">
                <span className="coop-receipt-mark">MW</span>
                <div>
                  <strong>Mwangaza Wetu</strong>
                  <small>Coopérative d’épargne et de crédit · Goma</small>
                </div>
              </div>
              <div className="coop-receipt-rule" />
              <h3>REÇU DE {receipt.kind.toLocaleUpperCase("fr-FR")}</h3>
              <dl>
                <div>
                  <dt>Référence</dt>
                  <dd>{receipt.reference}</dd>
                </div>
                <div>
                  <dt>Membre</dt>
                  <dd>{getMemberForOperation(receipt.memberId).name}</dd>
                </div>
                <div>
                  <dt>Compte</dt>
                  <dd>{accountConfigs[receipt.account].shortLabel}</dd>
                </div>
                <div>
                  <dt>Mode de paiement</dt>
                  <dd>{receipt.method}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{formatDate(receipt.date)}</dd>
                </div>
                <div>
                  <dt>Transaction</dt>
                  <dd>{receipt.transactionReference}</dd>
                </div>
              </dl>
              <strong className="coop-receipt-total">
                {formatCurrency(receipt.amount)}
              </strong>
              <p>
                {receipt.status === "Validé"
                  ? "Paiement reçu et validé."
                  : `Statut : ${receipt.status}. Aperçu non valable comme reçu acquitté.`}
              </p>
            </div>
          )}
          <div className="coop-form-actions">
            <button
              className="mw-secondary"
              type="button"
              onClick={() => setReceipt(null)}
            >
              Fermer
            </button>
            <button
              className="mw-primary"
              type="button"
              disabled={receipt?.status !== "Validé"}
              onClick={() => window.print()}
            >
              <IconDownload aria-hidden="true" />
              Imprimer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
