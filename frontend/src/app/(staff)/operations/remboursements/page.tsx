'use client';

import {
  IconAlertTriangle,
  IconBellRinging,
  IconCheck,
  IconClock,
  IconDownload,
  IconReceipt,
  IconSearch,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";


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
import { findCreditMember, getCreditRecords, getUpcomingInstallment, updateCreditRecord, applyCreditPayment, type CooperativeCredit, type CreditInstallment } from "@/mocks/credit-data";
import { paymentMethods, type PaymentMethod } from "@/mocks/operations-data";

const today = "2025-06-25";
const tabs = ["À venir", "En retard", "Payés", "Tous"] as const;
const periods = ["Toutes les périodes", "Ce mois", "30 derniers jours"] as const;
type RepaymentTab = (typeof tabs)[number];
type RepaymentRow = { credit: CooperativeCredit; installment: CreditInstallment };
type RemittanceChannel = "SMS" | "WhatsApp";

export function meta() {
  return [{ title: "Remboursements — Mwangaza Wetu" }];
}

function getInstallmentStatus(installment: CreditInstallment) {
  if (installment.status === "Payé") return "Payé";
  if (installment.amountPaid > 0 && installment.dueDate >= today) return "Partiel";
  if (installment.dueDate < today) return "En retard";
  return "À venir";
}

function getInstallmentRows(credits: CooperativeCredit[]): RepaymentRow[] {
  return credits.flatMap((credit) => credit.installments.map((installment) => ({ credit, installment })));
}

function amountRemaining(installment: CreditInstallment) {
  return Math.max(0, installment.totalDue + installment.penalty - installment.amountPaid);
}

export default function RepaymentsRoute() {
  const dark = useCooperativeDarkTheme();
  const [credits, setCredits] = useState(getCreditRecords());
  const [activeTab, setActiveTab] = useState<RepaymentTab>("À venir");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[0]);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState("");
  const [selectedInstallmentNumber, setSelectedInstallmentNumber] = useState(0);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("M-Pesa");
  const [paymentDate, setPaymentDate] = useState(today);
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [channel, setChannel] = useState<RemittanceChannel>("SMS");
  const [receipt, setReceipt] = useState<{ credit: CooperativeCredit; installment: CreditInstallment; amount: number; reference: string; method: PaymentMethod; date: string } | null>(null);

  const rows = useMemo(() => getInstallmentRows(credits), [credits]);
  const currentRows = useMemo(() => rows.filter(({ installment }) => installment.dueDate.startsWith("2025-06")), [rows]);
  const receivedThisMonth = currentRows.reduce((sum, { installment }) => sum + (installment.paidAt?.startsWith("2025-06") ? installment.amountPaid : 0), 0);
  const expectedThisMonth = currentRows.reduce((sum, { installment }) => sum + (installment.status === "Payé" ? 0 : amountRemaining(installment)), 0);
  const overdueRows = rows.filter(({ installment }) => getInstallmentStatus(installment) === "En retard");
  const overdueTotal = overdueRows.reduce((sum, { installment }) => sum + amountRemaining(installment), 0);
  const collectionRate = receivedThisMonth + expectedThisMonth > 0 ? Math.round(receivedThisMonth / (receivedThisMonth + expectedThisMonth) * 100) : 0;
  const counts: Record<RepaymentTab, number> = {
    "À venir": rows.filter(({ installment }) => ["À venir", "Partiel"].includes(getInstallmentStatus(installment))).length,
    "En retard": overdueRows.length,
    Payés: rows.filter(({ installment }) => getInstallmentStatus(installment) === "Payé").length,
    Tous: rows.length,
  };
  const selectedCredit = credits.find((credit) => credit.id === selectedCreditId);
  const selectedInstallment = selectedCredit?.installments.find((item) => item.number === selectedInstallmentNumber);
  const selectedDue = selectedInstallment ? amountRemaining(selectedInstallment) : 0;
  const filteredRows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    return rows
      .filter(({ installment }) => activeTab === "Tous" || (activeTab === "À venir" ? ["À venir", "Partiel"].includes(getInstallmentStatus(installment)) : activeTab === "Payés" ? getInstallmentStatus(installment) === "Payé" : getInstallmentStatus(installment) === "En retard"))
      .filter(({ credit }) => `${findCreditMember(credit).name} ${credit.reference}`.toLocaleLowerCase("fr-FR").includes(search))
      .filter(({ installment }) => period === periods[0] || (period === periods[1] ? installment.dueDate.startsWith("2025-06") : installment.dueDate >= "2025-05-26"))
      .filter(({ installment }) => !methodFilter || installment.paymentMethod === methodFilter)
      .sort((left, right) => activeTab === "En retard" ? left.installment.dueDate.localeCompare(right.installment.dueDate) : right.installment.dueDate.localeCompare(left.installment.dueDate));
  }, [activeTab, methodFilter, period, query, rows]);
  const visible = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  function refreshCredits() {
    setCredits(getCreditRecords());
  }

  function startPayment(credit: CooperativeCredit, installment: CreditInstallment) {
    setSelectedCreditId(credit.id);
    setSelectedInstallmentNumber(installment.number);
    setAmount(amountRemaining(installment));
    setPaymentDate(today);
    setReference(`PAY-${credit.reference}-${String(installment.number).padStart(2, "0")}`);
    setFormError("");
    setPaymentOpen(true);
  }

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCredit || !selectedInstallment || !(amount > 0) || amount > selectedDue || !paymentDate || !reference.trim()) {
      setFormError(`Montant invalide. Le solde de cette échéance est ${formatCurrency(selectedDue)}.`);
      return;
    }
    let updatedCredit: CooperativeCredit | undefined;
    updateCreditRecord(selectedCredit.id, (credit) => {
      updatedCredit = applyCreditPayment(credit, selectedInstallment.number, amount, paymentDate, paymentMethod, reference.trim());
      return updatedCredit;
    });
    refreshCredits();
    const updatedInstallment = updatedCredit?.installments.find((item) => item.number === selectedInstallment.number);
    if (updatedCredit && updatedInstallment) {
      setReceipt({ credit: updatedCredit, installment: updatedInstallment, amount, reference: reference.trim(), method: paymentMethod, date: paymentDate });
    }
    setPaymentOpen(false);
    setSuccess(`Remboursement ${reference.trim()} enregistré; le solde du crédit a été actualisé.`);
  }

  function remind(row?: RepaymentRow) {
    const count = row ? 1 : overdueRows.length;
    setSuccess(count ? `${count} rappel${count > 1 ? "s" : ""} simulé${count > 1 ? "s" : ""} par ${channel}.` : "Aucun retard à rappeler.");
  }

  return (
    <div className="coop-operations-page coop-repayment-page">
      <div className="coop-page-heading">
        <div><CooperativeBreadcrumb section="Opérations" current="Remboursements" /><h1>Remboursements</h1><p>Suivi des échéances et des paiements de crédit.</p></div>
        <div className="coop-page-actions"><button className="mw-primary" type="button" onClick={() => { setSelectedCreditId(credits.find((credit) => ["Actif", "En retard"].includes(credit.status) && getUpcomingInstallment(credit))?.id ?? ""); setPaymentOpen(true); setFormError(""); }}><IconWallet aria-hidden="true" />Enregistrer un remboursement</button></div>
      </div>
      {success && <div className="coop-inline-success" role="status"><IconCheck aria-hidden="true" />{success}<button type="button" aria-label="Fermer le message" onClick={() => setSuccess("")}><IconX aria-hidden="true" /></button></div>}

      <CooperativeDataState loading={false} error={false} empty={rows.length === 0}>
        <section className="coop-stat-grid" aria-label="Indicateurs des remboursements">
          <CooperativeStatCard label="Reçus ce mois" value={formatCurrency(receivedThisMonth)} detail="Paiements enregistrés" icon={IconWallet} />
          <CooperativeStatCard label="Attendus ce mois" value={formatCurrency(expectedThisMonth)} detail="Échéances de juin" icon={IconClock} accent="#c18c2d" />
          <CooperativeStatCard label="Échéances en retard" value={overdueRows.length} detail={`${formatCurrency(overdueTotal)} à recouvrer`} icon={IconAlertTriangle} accent="#c95151" />
          <CooperativeStatCard label="Taux de recouvrement" value={`${collectionRate} %`} detail="Sur la période courante" icon={IconCheck} />
        </section>
      </CooperativeDataState>

      <section className="mw-panel coop-operations-panel" aria-label="Échéances de remboursement">
        <div className="coop-repayment-toolbar"><div className="coop-withdrawal-tabs" role="tablist" aria-label="Filtrer les échéances">{tabs.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "is-active" : ""} key={tab} onClick={() => changeFilter(() => setActiveTab(tab))}>{tab}<span>{counts[tab]}</span></button>)}</div><div className="coop-reminder-actions"><label className="coop-filter-select"><span className="sr-only">Canal des rappels</span><select value={channel} onChange={(event) => setChannel(event.target.value as RemittanceChannel)}><option>SMS</option><option>WhatsApp</option></select></label><button className="mw-secondary" type="button" disabled={!overdueRows.length} onClick={() => remind()}><IconBellRinging aria-hidden="true" />Rappeler tous les retards</button></div></div>
        <div className="coop-filter-bar"><label className="coop-filter-search"><IconSearch aria-hidden="true" /><input type="search" value={query} aria-label="Rechercher un membre ou une référence de crédit" placeholder="Membre ou référence du crédit…" onChange={(event) => changeFilter(() => setQuery(event.target.value))} /></label><label className="coop-filter-select"><span className="sr-only">Période</span><select value={period} onChange={(event) => changeFilter(() => setPeriod(event.target.value as (typeof periods)[number]))}>{periods.map((item) => <option key={item}>{item}</option>)}</select></label><label className="coop-filter-select"><span className="sr-only">Mode de paiement</span><select value={methodFilter} onChange={(event) => changeFilter(() => setMethodFilter(event.target.value as PaymentMethod | ""))}><option value="">Tous les modes</option>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label></div>
        <CooperativeDataState loading={false} error={false} empty={visible.length === 0} emptyMessage="Aucune échéance ne correspond à ces filtres."><div className="coop-table-scroll"><table className="mw-table coop-repayment-table"><thead><tr><th>Membre</th><th>Crédit</th><th>Échéance</th><th>Date d’échéance</th><th>Montant dû</th><th>Pénalité</th><th>Montant payé</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{visible.map(({ credit, installment }) => { const member = findCreditMember(credit); const status = getInstallmentStatus(installment); const lateDays = status === "En retard" ? Math.max(1, Math.floor((new Date(`${today}T12:00:00`).getTime() - new Date(`${installment.dueDate}T12:00:00`).getTime()) / 86400000)) : 0; return <tr key={`${credit.id}-${installment.number}`}><td><span className="mw-member"><span className="mw-member-avatar">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span>{member.name}</span></span></td><td><Link className="coop-credit-reference" href="/operations/credits">{credit.reference}</Link></td><td>{installment.number}/{credit.termMonths}</td><td><span>{formatDate(installment.dueDate)}</span>{lateDays > 0 && <small className="coop-late-days">{lateDays} j de retard</small>}</td><td className="coop-amount-cell">{formatCurrency(installment.totalDue)}</td><td>{installment.penalty ? formatCurrency(installment.penalty) : "—"}</td><td>{formatCurrency(installment.amountPaid)}</td><td><InstallmentStatusBadge status={status} /></td><td><div className="coop-repayment-row-actions">{status !== "Payé" && <button className="mw-secondary" type="button" onClick={() => startPayment(credit, installment)}>Enregistrer le paiement</button>}{status === "En retard" && <button className="coop-icon-action" type="button" aria-label={`Rappeler ${member.name}`} title="Rappeler" onClick={() => remind({ credit, installment })}><IconBellRinging aria-hidden="true" /></button>}</div></td></tr>; })}</tbody></table></div></CooperativeDataState>
        <CooperativePagination totalItems={filteredRows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} itemLabel="échéances" />
      </section>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent data-theme={dark ? "dark" : "light"} className="mw-dialog-content coop-action-dialog coop-operation-dialog coop-payment-dialog"><DialogHeader><DialogTitle>Enregistrer un remboursement</DialogTitle><DialogDescription>Le paiement actualise l’échéancier partagé avec la page Crédits.</DialogDescription></DialogHeader>
          <form className="coop-operation-form" onSubmit={submitPayment}>
            <label className="coop-form-field">Crédit / membre<select value={selectedCreditId} onChange={(event) => { setSelectedCreditId(event.target.value); const credit = credits.find((item) => item.id === event.target.value); const installment = credit && getUpcomingInstallment(credit); setSelectedInstallmentNumber(installment?.number ?? 0); setAmount(installment ? amountRemaining(installment) : 0); }} required><option value="" disabled>Choisir un crédit actif</option>{credits.filter((credit) => ["Actif", "En retard"].includes(credit.status) && getUpcomingInstallment(credit)).map((credit) => <option key={credit.id} value={credit.id}>{credit.reference} · {findCreditMember(credit).name}</option>)}</select></label>
            <label className="coop-form-field">Échéance concernée<select value={selectedInstallmentNumber || ""} onChange={(event) => { const number = Number(event.target.value); setSelectedInstallmentNumber(number); const installment = selectedCredit?.installments.find((item) => item.number === number); setAmount(installment ? amountRemaining(installment) : 0); }} required>{selectedCredit?.installments.filter((item) => item.status !== "Payé").map((item) => <option key={item.number} value={item.number}>N° {item.number} · {formatDate(item.dueDate)} · {formatCurrency(amountRemaining(item))} restant</option>)}</select></label>
            <div className="coop-form-grid"><label className="coop-form-field">Montant payé (USD)<input value={amount} onChange={(event) => setAmount(Number(event.target.value))} type="number" min="0.01" max={selectedDue} step="0.01" required /></label><label className="coop-form-field">Mode de paiement<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label></div>
            <div className="coop-form-grid"><label className="coop-form-field">Date<input value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} type="date" required /></label><label className="coop-form-field">Référence<input value={reference} onChange={(event) => setReference(event.target.value)} required /></label></div>
            {selectedInstallment && <p className="coop-muted-copy">Reste à payer sur l’échéance : {formatCurrency(selectedDue)}.</p>}
            {formError && <p className="coop-form-error" role="alert">{formError}</p>}
            <div className="coop-form-actions"><button className="mw-secondary" type="button" onClick={() => setPaymentOpen(false)}>Annuler</button><button className="mw-primary" type="submit" disabled={!selectedCredit || !selectedInstallment || selectedDue <= 0}>Valider le paiement</button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={receipt !== null} onOpenChange={(open) => !open && setReceipt(null)}><DialogContent data-theme={dark ? "dark" : "light"} className="mw-dialog-content coop-action-dialog coop-receipt-dialog"><DialogHeader><DialogTitle>Aperçu du reçu de remboursement</DialogTitle><DialogDescription>Paiement enregistré dans la démonstration.</DialogDescription></DialogHeader>{receipt && <div className="coop-print-receipt"><div className="coop-receipt-brand"><span className="coop-receipt-mark">MW</span><div><strong>Mwangaza Wetu</strong><small>Remboursement de crédit · Goma</small></div></div><div className="coop-receipt-rule" /><h3>REÇU DE REMBOURSEMENT</h3><dl><div><dt>Référence</dt><dd>{receipt.reference}</dd></div><div><dt>Crédit</dt><dd>{receipt.credit.reference}</dd></div><div><dt>Membre</dt><dd>{findCreditMember(receipt.credit).name}</dd></div><div><dt>Échéance</dt><dd>{receipt.installment.number}/{receipt.credit.termMonths}</dd></div><div><dt>Date</dt><dd>{formatDate(receipt.date)}</dd></div><div><dt>Mode</dt><dd>{receipt.method}</dd></div><div><dt>Solde échéance</dt><dd>{formatCurrency(amountRemaining(receipt.installment))}</dd></div></dl><strong className="coop-receipt-total">{formatCurrency(receipt.amount)}</strong><p>Merci pour votre remboursement.</p></div>}<div className="coop-form-actions"><button className="mw-secondary" type="button" onClick={() => setReceipt(null)}>Fermer</button><button className="mw-primary" type="button" onClick={() => window.print()}><IconDownload aria-hidden="true" />Imprimer</button></div></DialogContent></Dialog>
    </div>
  );
}

function InstallmentStatusBadge({ status }: { status: string }) {
  const className = status === "Payé" ? "coop-installment--paid" : status === "En retard" ? "coop-installment--late" : status === "Partiel" ? "coop-installment--partial" : "coop-installment--upcoming";
  return <span className={`coop-installment-badge ${className}`}>{status}</span>;
}
