'use client';

import {
  IconAlertTriangle,
  IconArrowDown,
  IconCheck,
  IconClock,
  IconCoins,
  IconSearch,
  IconUserPlus,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState, type FormEvent } from "react";

import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
import {
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
  addCreditRecord,
  approveCreditRecord,
  calculateLoanSummary,
  findCreditMember,
  getCreditGuarantors,
  getCreditRecords,
  getUpcomingInstallment,
  rejectCreditRecord,
  updateCreditRecord,
  type CooperativeCredit,
  type CreditPurpose,
  type CreditStatus,
} from "@/mocks/credit-data";
import {
  mockMembers,
  type CooperativeMember,
} from "@/mocks/cooperative-data";

const pageSize = 10;
const statuses: (CreditStatus | "Tous")[] = [
  "En attente", "Actif", "En retard", "Soldé", "Rejeté", "Tous",
];
const purposes: CreditPurpose[] = ["Commerce", "Scolarité", "Santé", "Logement", "Autre"];
const periods = ["Toutes les périodes", "Ce mois", "30 derniers jours"] as const;

export function meta() {
  return [{ title: "Crédits — Mwangaza Wetu" }];
}

export default function CreditsRoute() {
  const dark = useCooperativeDarkTheme();
  const [records, setRecords] = useState(getCreditRecords());
  const [activeStatus, setActiveStatus] = useState<CreditStatus | "Tous">("En attente");
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState<CreditPurpose | "">("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[0]);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<CooperativeCredit | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [memberId, setMemberId] = useState(mockMembers[0].id);
  const [principal, setPrincipal] = useState(500);
  const [termMonths, setTermMonths] = useState(12);
  const [annualRate, setAnnualRate] = useState(12);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCredit = records.find((credit) => credit.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    return records
      .filter((credit) => activeStatus === "Tous" || credit.status === activeStatus)
      .filter((credit) => `${findCreditMember(credit).name} ${credit.reference}`.toLocaleLowerCase("fr-FR").includes(search))
      .filter((credit) => !purpose || credit.purpose === purpose)
      .filter((credit) => period === periods[0] || (period === periods[1] ? credit.requestedAt.startsWith("2025-06") : credit.requestedAt >= "2025-05-26"));
  }, [activeStatus, period, purpose, query, records]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCredits = records.filter((credit) => ["Actif", "En retard"].includes(credit.status));
  const outstanding = activeCredits.reduce((sum, credit) => sum + credit.remainingBalance, 0);
  const lateCredits = records.filter((credit) => credit.status === "En retard");
  const lateAmount = lateCredits.reduce((sum, credit) => sum + credit.remainingBalance, 0);
  const totalScheduled = records.flatMap((credit) => credit.installments).reduce((sum, item) => sum + item.totalDue, 0);
  const totalPaid = records.flatMap((credit) => credit.installments).reduce((sum, item) => sum + item.amountPaid, 0);
  const repaymentRate = totalScheduled ? Math.round((totalPaid / totalScheduled) * 100) : 0;
  const currentMember = mockMembers.find((member) => member.id === memberId)!;
  const maxEligible = currentMember.savingsTotal * 3;
  const simulator = calculateLoanSummary(principal, annualRate, termMonths, "2025-06-25");
  const exceedsEligibility = principal > maxEligible;

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  function refreshCredits() {
    setRecords(getCreditRecords());
  }

  function approve(credit: CooperativeCredit) {
    updateCreditRecord(credit.id, (current) => approveCreditRecord(current, "2025-06-25"));
    refreshCredits();
    setSuccess(`Crédit ${credit.reference} approuvé; l’échéancier est activé.`);
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectTarget || rejectReason.trim().length < 5) return;
    updateCreditRecord(rejectTarget.id, (current) => rejectCreditRecord(current, rejectReason.trim(), "2025-06-25"));
    refreshCredits();
    setSuccess(`Demande ${rejectTarget.reference} rejetée.`);
    setRejectTarget(null);
    setRejectReason("");
  }

  function createCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const guarantorId = String(form.get("guarantorId"));
    const selectedPurpose = String(form.get("purpose")) as CreditPurpose;
    if (!(principal > 0) || !(termMonths > 0) || !(annualRate >= 0) || !guarantorId || !purposes.includes(selectedPurpose)) {
      setFormError("Vérifiez le montant, la durée, le taux, l’objet et le garant.");
      return;
    }
    if (exceedsEligibility) {
      setFormError(`Le montant dépasse le plafond d’éligibilité de ${formatCurrency(maxEligible)} (3 × l’épargne).`);
      return;
    }
    const credit = addCreditRecord({
      memberId,
      guarantorIds: [guarantorId],
      principal,
      annualRate,
      termMonths,
      purpose: selectedPurpose,
      requestedAt: "2025-06-25",
    });
    refreshCredits();
    setActiveStatus("En attente");
    setPage(1);
    setCreateOpen(false);
    setFormError("");
    setSuccess(`Demande ${credit.reference} créée pour ${findCreditMember(credit).name}.`);
  }

  return (
    <div className="coop-operations-page coop-credit-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Crédits" />
          <h1>Crédits</h1>
          <p>Demandes de crédit et suivi des remboursements accordés aux membres.</p>
        </div>
        <div className="coop-page-actions"><button className="mw-primary" type="button" onClick={() => { setCreateOpen(true); setFormError(""); }}><IconUserPlus aria-hidden="true" />Nouvelle demande de crédit</button></div>
      </div>
      {success && <div className="coop-inline-success" role="status"><IconCheck aria-hidden="true" />{success}<button type="button" aria-label="Fermer le message" onClick={() => setSuccess("")}><IconX aria-hidden="true" /></button></div>}

      <CooperativeDataState loading={false} error={false} empty={records.length === 0}>
        <section className="coop-stat-grid" aria-label="Indicateurs des crédits">
          <CooperativeStatCard label="Encours total" value={formatCurrency(outstanding)} detail="Capital restant à rembourser" icon={IconWallet} />
          <CooperativeStatCard label="Crédits actifs" value={activeCredits.length} detail="Contrats en cours" icon={IconCoins} />
          <CooperativeStatCard label="Taux de remboursement" value={`${repaymentRate} %`} detail="Montant reçu / prévu" icon={IconArrowDown} />
          <CooperativeStatCard label="Crédits en retard" value={lateCredits.length} detail={`${formatCurrency(lateAmount)} d’encours`} icon={IconAlertTriangle} accent="#c95151" />
        </section>
      </CooperativeDataState>

      <section className="mw-panel coop-operations-panel" aria-label="Suivi des crédits">
        <div className="coop-withdrawal-tabs" role="tablist" aria-label="Filtrer les crédits par statut">{statuses.map((status) => { const count = status === "Tous" ? records.length : records.filter((credit) => credit.status === status).length; return <button type="button" role="tab" aria-selected={activeStatus === status} className={activeStatus === status ? "is-active" : ""} key={status} onClick={() => changeFilter(() => setActiveStatus(status))}>{status === "Tous" ? "Tous" : status === "En attente" ? "Demandes" : status}<span>{count}</span></button>; })}</div>
        <div className="coop-filter-bar">
          <label className="coop-filter-search"><IconSearch aria-hidden="true" /><input type="search" value={query} aria-label="Rechercher un membre ou une référence de crédit" placeholder="Membre ou référence…" onChange={(event) => changeFilter(() => setQuery(event.target.value))} /></label>
          <label className="coop-filter-select"><span className="sr-only">Objet du crédit</span><select value={purpose} onChange={(event) => changeFilter(() => setPurpose(event.target.value as CreditPurpose | ""))}><option value="">Tous les objets</option>{purposes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="coop-filter-select"><span className="sr-only">Période de demande</span><select value={period} onChange={(event) => changeFilter(() => setPeriod(event.target.value as (typeof periods)[number]))}>{periods.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <CooperativeDataState loading={false} error={false} empty={visible.length === 0} emptyMessage="Aucun crédit ne correspond à ces filtres.">
          <div className="coop-table-scroll"><table className="mw-table coop-credit-table"><thead><tr><th>Référence</th><th>Membre</th><th>Montant accordé</th><th>Taux</th><th>Durée</th><th>Objet</th><th>Solde restant</th><th>Remboursé</th><th>Prochaine échéance</th><th>Statut</th></tr></thead><tbody>{visible.map((credit) => <CreditRow key={credit.id} credit={credit} onSelect={() => setSelectedId(credit.id)} />)}</tbody></table></div>
        </CooperativeDataState>
        <div className="coop-pagination"><span>{filtered.length} crédits</span><div><button className="mw-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page} sur {pages}</span><button className="mw-secondary" type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></div>
      </section>

      <Sheet open={selectedCredit !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent data-theme={dark ? "dark" : "light"} className="coop-member-drawer coop-credit-drawer" side="right"><SheetTitle className="coop-drawer-title">Détail du crédit</SheetTitle>{selectedCredit && <CreditDetails credit={selectedCredit} onApprove={() => approve(selectedCredit)} onReject={() => { setRejectTarget(selectedCredit); setRejectReason(""); }} />}</SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-theme={dark ? "dark" : "light"} className="mw-dialog-content coop-action-dialog coop-operation-dialog coop-credit-form-dialog">
          <DialogHeader><DialogTitle>Nouvelle demande de crédit</DialogTitle><DialogDescription>Le dossier de démonstration sera ajouté aux demandes en attente.</DialogDescription></DialogHeader>
          <form className="coop-operation-form" onSubmit={createCredit}>
            <label className="coop-form-field">Membre<select value={memberId} onChange={(event) => setMemberId(event.target.value)} required>{mockMembers.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.memberNumber}</option>)}</select></label>
            <div className="coop-credit-eligibility"><span>Épargne du membre</span><strong>{formatCurrency(currentMember.savingsTotal)}</strong><span>Montant maximum (3 × épargne)</span><strong>{formatCurrency(maxEligible)}</strong></div>
            <div className="coop-form-grid"><label className="coop-form-field">Montant demandé (USD)<input value={principal} onChange={(event) => setPrincipal(Number(event.target.value))} name="principal" type="number" min="1" step="50" required /></label><label className="coop-form-field">Durée (mois)<input value={termMonths} onChange={(event) => setTermMonths(Number(event.target.value))} name="term" type="number" min="1" max="60" required /></label></div>
            <div className="coop-form-grid"><label className="coop-form-field">Taux annuel (%)<input value={annualRate} onChange={(event) => setAnnualRate(Number(event.target.value))} name="rate" type="number" min="0" max="100" step="0.5" required /></label><label className="coop-form-field">Objet<select name="purpose" required>{purposes.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            <label className="coop-form-field">Garant<select name="guarantorId" required>{mockMembers.filter((member) => member.id !== memberId).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.memberNumber}</option>)}</select></label>
            <section className="coop-simulator" aria-live="polite"><h3>Simulation de l’échéancier</h3><div><span>Mensualité estimée</span><strong>{formatCurrency(simulator.monthlyPayment)}</strong></div><div><span>Total à rembourser</span><strong>{formatCurrency(simulator.totalToRepay)}</strong></div><div><span>Coût du crédit</span><strong>{formatCurrency(simulator.creditCost)}</strong></div></section>
            {exceedsEligibility && <p className="coop-form-error" role="alert">Montant supérieur au plafond autorisé de {formatCurrency(maxEligible)} pour l’épargne de ce membre.</p>}
            {formError && <p className="coop-form-error" role="alert">{formError}</p>}
            <div className="coop-form-actions"><button className="mw-secondary" type="button" onClick={() => setCreateOpen(false)}>Annuler</button><button className="mw-primary" type="submit" disabled={exceedsEligibility}>Soumettre la demande</button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent data-theme={dark ? "dark" : "light"} className="mw-dialog-content coop-action-dialog coop-operation-dialog"><DialogHeader><DialogTitle>Rejeter la demande de crédit</DialogTitle><DialogDescription>Indiquez le motif communiqué au membre.</DialogDescription></DialogHeader><form className="coop-operation-form" onSubmit={reject}><label className="coop-form-field">Motif du rejet<textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} minLength={5} rows={3} required /></label><div className="coop-form-actions"><button className="mw-secondary" type="button" onClick={() => setRejectTarget(null)}>Annuler</button><button className="mw-danger" type="submit" disabled={rejectReason.trim().length < 5}>Confirmer le rejet</button></div></form></DialogContent>
      </Dialog>
    </div>
  );
}

function CreditRow({ credit, onSelect }: { credit: CooperativeCredit; onSelect: () => void }) {
  const member = findCreditMember(credit);
  const paid = credit.installments.reduce((sum, item) => sum + item.amountPaid, 0);
  const total = credit.installments.reduce((sum, item) => sum + item.totalDue, 0);
  const progress = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const next = getUpcomingInstallment(credit);
  const status = credit.status === "Actif" || credit.status === "Soldé" ? "Validé" : credit.status === "En retard" ? "En retard" : credit.status === "Rejeté" ? "Rejeté" : "En attente";
  return <tr tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}><td><strong>{credit.reference}</strong></td><td><span className="mw-member"><span className="mw-member-avatar">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span>{member.name}</span></span></td><td className="coop-amount-cell">{formatCurrency(credit.principal)}</td><td>{credit.annualRate} %</td><td>{credit.termMonths} mois</td><td>{credit.purpose}</td><td className="coop-amount-cell">{formatCurrency(credit.remainingBalance)}</td><td><span className="coop-progress-cell"><span className="coop-progress-track"><span style={{ width: `${progress}%` }} /></span><small>{progress} %</small></span></td><td>{next ? formatDate(next.dueDate) : "—"}</td><td><CooperativeStatus status={status} /></td></tr>;
}

function CreditDetails({ credit, onApprove, onReject }: { credit: CooperativeCredit; onApprove: () => void; onReject: () => void }) {
  const member = findCreditMember(credit);
  const guarantors = getCreditGuarantors(credit);
  return <div className="coop-drawer-content coop-credit-detail">
    <div className="coop-drawer-member"><span className="mw-member-avatar">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{member.name}</strong><span>{member.memberNumber} · {member.phone}</span></div><CooperativeStatus status={credit.status === "Actif" || credit.status === "Soldé" ? "Validé" : credit.status === "En retard" ? "En retard" : credit.status === "Rejeté" ? "Rejeté" : "En attente"} /></div>
    <section className="coop-drawer-section"><h3>Conditions du crédit</h3><dl className="coop-detail-list"><div><dt>Référence</dt><dd>{credit.reference}</dd></div><div><dt>Montant</dt><dd>{formatCurrency(credit.principal)}</dd></div><div><dt>Taux annuel</dt><dd>{credit.annualRate} %</dd></div><div><dt>Durée</dt><dd>{credit.termMonths} mois</dd></div><div><dt>Objet</dt><dd>{credit.purpose}</dd></div><div><dt>Début du contrat</dt><dd>{credit.startDate ? formatDate(credit.startDate) : "Après approbation"}</dd></div><div><dt>Solde restant</dt><dd>{formatCurrency(credit.remainingBalance)}</dd></div></dl></section>
    <section className="coop-drawer-section"><h3>Garant(s)</h3>{guarantors.map((guarantor) => <p className="coop-muted-copy" key={guarantor.id}>{guarantor.name} · {guarantor.phone}</p>)}</section>
    <section className="coop-drawer-section"><h3>Échéancier complet</h3>{credit.installments.length ? <div className="coop-table-scroll coop-schedule-scroll"><table className="mw-table coop-schedule-table"><thead><tr><th>N°</th><th>Échéance</th><th>Capital</th><th>Intérêt</th><th>Total</th><th>Payé</th><th>Statut</th></tr></thead><tbody>{credit.installments.map((item) => <tr key={item.number}><td>{item.number}</td><td>{formatDate(item.dueDate)}</td><td>{formatCurrency(item.principal)}</td><td>{formatCurrency(item.interest)}</td><td>{formatCurrency(item.totalDue)}</td><td>{formatCurrency(item.amountPaid)}</td><td><InstallmentBadge status={item.status} /></td></tr>)}</tbody></table></div> : <p className="coop-muted-copy">L’échéancier sera généré après approbation.</p>}</section>
    <section className="coop-drawer-section"><h3>Historique</h3><ol className="coop-timeline">{credit.history.map((entry, index) => <li key={`${entry.date}-${entry.label}-${index}`}><span className={`coop-timeline-dot ${index === 0 ? "is-done" : ""}`} /><div><strong>{entry.label}</strong><small>{formatDate(entry.date)} · {entry.detail}</small></div></li>)}</ol></section>
    {credit.status === "En attente" && <div className="coop-withdrawal-actions"><button className="mw-danger" type="button" onClick={onReject}><IconX aria-hidden="true" />Rejeter</button><button className="mw-primary" type="button" onClick={onApprove}><IconCheck aria-hidden="true" />Approuver</button></div>}
  </div>;
}

function InstallmentBadge({ status }: { status: string }) {
  const className = status === "Payé" ? "coop-installment--paid" : status === "En retard" ? "coop-installment--late" : status === "Partiel" ? "coop-installment--partial" : "coop-installment--upcoming";
  return <span className={`coop-installment-badge ${className}`}>{status}</span>;
}
