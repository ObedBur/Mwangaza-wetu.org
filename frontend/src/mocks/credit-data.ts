import { mockMembers, type CooperativeMember } from "@/mocks/cooperative-data";
import { paymentMethods, type PaymentMethod } from "@/mocks/operations-data";

export type CreditPurpose =
  | "Commerce"
  | "Scolarité"
  | "Santé"
  | "Logement"
  | "Autre";
export type CreditStatus =
  | "En attente"
  | "Actif"
  | "En retard"
  | "Soldé"
  | "Rejeté";
export type InstallmentStatus = "Payé" | "Partiel" | "À venir" | "En retard";

export type CreditInstallment = {
  number: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalDue: number;
  amountPaid: number;
  penalty: number;
  status: InstallmentStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
};

export type CreditHistoryEntry = {
  date: string;
  label: string;
  detail: string;
};

export type CooperativeCredit = {
  id: string;
  reference: string;
  memberId: string;
  guarantorIds: string[];
  principal: number;
  annualRate: number;
  termMonths: number;
  purpose: CreditPurpose;
  requestedAt: string;
  startDate: string | null;
  status: CreditStatus;
  remainingBalance: number;
  installments: CreditInstallment[];
  history: CreditHistoryEntry[];
};

export type AmortizationLine = Pick<
  CreditInstallment,
  "number" | "dueDate" | "principal" | "interest" | "totalDue"
>;

export function calculateLoanSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: string,
): AmortizationLine[] {
  const monthlyRate = annualRate / 100 / 12;
  const payment = monthlyRate === 0
    ? principal / termMonths
    : principal * monthlyRate / (1 - (1 + monthlyRate) ** -termMonths);
  let remaining = principal;
  const start = new Date(`${startDate}T12:00:00`);

  return Array.from({ length: termMonths }, (_, index) => {
    const interest = Math.round(remaining * monthlyRate * 100) / 100;
    const scheduledPayment = index === termMonths - 1
      ? remaining + interest
      : payment;
    const principalPart = Math.min(
      remaining,
      Math.round((scheduledPayment - interest) * 100) / 100,
    );
    const totalDue = Math.round((principalPart + interest) * 100) / 100;
    remaining = Math.max(0, Math.round((remaining - principalPart) * 100) / 100);
    const dueDate = new Date(start.getFullYear(), start.getMonth() + index + 1, 1);
    const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
    dueDate.setDate(Math.min(start.getDate(), lastDay));

    return {
      number: index + 1,
      dueDate: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`,
      principal: principalPart,
      interest,
      totalDue,
    };
  });
}

export function calculateLoanSummary(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate = "2025-01-01",
) {
  const schedule = calculateLoanSchedule(principal, annualRate, termMonths, startDate);
  const totalToRepay = Math.round(schedule.reduce((sum, row) => sum + row.totalDue, 0) * 100) / 100;
  return {
    schedule,
    monthlyPayment: schedule[0]?.totalDue ?? 0,
    totalToRepay,
    creditCost: Math.round((totalToRepay - principal) * 100) / 100,
  };
}

const seedStatuses: CreditStatus[] = [
  "En attente", "En attente", "En attente", "En attente",
  "Actif", "Actif", "Actif", "Actif", "Actif", "Actif", "Actif", "Actif",
  "En retard", "En retard", "En retard", "En retard",
  "Soldé", "Soldé", "Soldé", "Soldé",
  "Rejeté", "Rejeté", "Rejeté", "Rejeté",
];
const purposes: CreditPurpose[] = [
  "Commerce", "Scolarité", "Santé", "Logement", "Autre", "Commerce",
  "Scolarité", "Santé", "Commerce", "Logement", "Autre", "Commerce",
  "Santé", "Scolarité", "Commerce", "Logement", "Commerce", "Santé",
  "Scolarité", "Autre", "Commerce", "Logement", "Scolarité", "Santé",
];
const principals = [800, 1200, 650, 1800, 950, 1500, 2400, 700, 1100, 2000, 850, 1350, 2200, 900, 1600, 2800, 750, 1250, 1900, 600, 1450, 2300, 1000, 1750];
const annualRates = [12, 15, 10, 14, 12, 18, 15, 10, 16, 12, 14, 18, 15, 12, 10, 16, 12, 14, 18, 10, 15, 12, 14, 16];
const terms = [6, 12, 6, 18, 12, 9, 18, 6, 12, 24, 9, 12, 18, 6, 12, 24, 6, 12, 18, 6, 12, 24, 9, 18];
const requestDates = [
  "2025-06-20", "2025-06-17", "2025-06-12", "2025-06-08", "2025-05-24", "2025-05-16",
  "2025-04-28", "2025-04-15", "2025-03-21", "2025-03-04", "2025-02-12", "2025-01-30",
  "2025-01-10", "2024-12-12", "2024-11-20", "2024-10-08", "2024-06-12", "2024-04-16",
  "2024-02-06", "2023-12-14", "2025-06-15", "2025-05-22", "2025-04-02", "2025-03-18",
];
const startDates = [
  null, null, null, null, "2025-05-24", "2025-05-16", "2025-04-28", "2025-04-15",
  "2025-03-21", "2025-03-04", "2025-02-12", "2025-01-30", "2025-01-10", "2024-12-12",
  "2024-11-20", "2024-10-08", "2024-06-12", "2024-04-16", "2024-02-06", "2023-12-14",
  null, null, null, null,
];
const paymentsMade = [0, 0, 0, 0, 1, 2, 3, 2, 5, 4, 5, 6, 4, 5, 6, 7, 6, 12, 6, 6, 0, 0, 0, 0];
const memberAt = (index: number) => mockMembers[index % mockMembers.length];
const guarantorAt = (index: number) => mockMembers[(index + 7) % mockMembers.length];

function createInstallments(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: string,
  status: CreditStatus,
  paidCount: number,
): CreditInstallment[] {
  const schedule = calculateLoanSchedule(principal, annualRate, termMonths, startDate);
  return schedule.map((line, index) => {
    const paid = status === "Soldé" || index < paidCount;
    const late = status === "En retard" && index === paidCount;
    const partial = status === "Actif" && index === paidCount && index > 0 && index % 2 === 0;
    const amountPaid = paid
      ? line.totalDue
      : partial
        ? Math.round(line.totalDue * 0.45 * 100) / 100
        : 0;
    const penalty = late
      ? Math.round(line.totalDue * 0.02 * 100) / 100
      : 0;
    return {
      ...line,
      amountPaid,
      penalty,
      status: paid ? "Payé" : late ? "En retard" : partial ? "Partiel" : "À venir",
      paidAt: amountPaid > 0 ? line.dueDate : null,
      paymentMethod: amountPaid > 0 ? paymentMethods[index % paymentMethods.length] : null,
      paymentReference: amountPaid > 0 ? `REM-2025-${String(index + 1).padStart(4, "0")}` : null,
    };
  });
}

function buildMockCredits(): CooperativeCredit[] {
  return seedStatuses.map((status, index) => {
    const member = memberAt(index + 1);
    const principal = principals[index];
    const annualRate = annualRates[index];
    const termMonths = terms[index];
    const startDate = startDates[index];
    const schedule = startDate
      ? createInstallments(principal, annualRate, termMonths, startDate, status, paymentsMade[index])
      : [];
    const remainingBalance = status === "Soldé"
      ? 0
      : Math.round(schedule.reduce((sum, row) => sum + row.principal - Math.min(row.principal, Math.max(0, row.amountPaid - row.interest)), 0) * 100) / 100;
    const applicationHistory: CreditHistoryEntry[] = [
      { date: requestDates[index], label: "Demande reçue", detail: "Dossier transmis par le membre." },
    ];
    if (status === "Actif" || status === "En retard" || status === "Soldé") {
      applicationHistory.push({ date: startDate!, label: "Crédit accordé", detail: "Contrat validé par la coopérative." });
    }
    if (status === "Rejeté") {
      applicationHistory.push({ date: requestDates[index], label: "Demande rejetée", detail: "Capacité de remboursement insuffisante." });
    }
    if (status === "Soldé") {
      applicationHistory.push({ date: "2025-05-10", label: "Crédit soldé", detail: "Toutes les échéances ont été réglées." });
    }
    return {
      id: `credit-${String(index + 1).padStart(3, "0")}`,
      reference: `CR-${String(2025 - (index > 16 ? 1 : 0))}-${String(index + 1).padStart(4, "0")}`,
      memberId: member.id,
      guarantorIds: [guarantorAt(index + 1).id],
      principal,
      annualRate,
      termMonths,
      purpose: purposes[index],
      requestedAt: requestDates[index],
      startDate,
      status,
      remainingBalance,
      installments: schedule,
      history: applicationHistory,
    };
  });
}

let creditRecords = buildMockCredits();

export function getCreditRecords() {
  return creditRecords;
}

export function addCreditRecord(input: {
  memberId: string;
  guarantorIds: string[];
  principal: number;
  annualRate: number;
  termMonths: number;
  purpose: CreditPurpose;
  requestedAt: string;
}): CooperativeCredit {
  const credit: CooperativeCredit = {
    id: `credit-local-${Date.now()}`,
    reference: `CR-2025-${String(creditRecords.length + 1).padStart(4, "0")}`,
    ...input,
    startDate: null,
    status: "En attente",
    remainingBalance: input.principal,
    installments: [],
    history: [{ date: input.requestedAt, label: "Demande reçue", detail: "Dossier transmis par le membre." }],
  };
  creditRecords = [credit, ...creditRecords];
  return credit;
}

export function updateCreditRecord(
  id: string,
  update: (credit: CooperativeCredit) => CooperativeCredit,
) {
  creditRecords = creditRecords.map((credit) => credit.id === id ? update(credit) : credit);
  return creditRecords;
}

export function approveCreditRecord(credit: CooperativeCredit, approvedAt: string) {
  const schedule = calculateLoanSchedule(credit.principal, credit.annualRate, credit.termMonths, approvedAt)
    .map((line): CreditInstallment => ({ ...line, amountPaid: 0, penalty: 0, status: "À venir", paidAt: null, paymentMethod: null, paymentReference: null }));
  return {
    ...credit,
    status: "Actif" as const,
    startDate: approvedAt,
    remainingBalance: credit.principal,
    installments: schedule,
    history: [...credit.history, { date: approvedAt, label: "Crédit accordé", detail: "Contrat validé par la coopérative." }],
  };
}

export function rejectCreditRecord(credit: CooperativeCredit, reason: string, rejectedAt: string) {
  return {
    ...credit,
    status: "Rejeté" as const,
    history: [...credit.history, { date: rejectedAt, label: "Demande rejetée", detail: reason }],
  };
}

export function applyCreditPayment(
  credit: CooperativeCredit,
  installmentNumber: number,
  amount: number,
  paymentDate: string,
  paymentMethod: PaymentMethod,
  paymentReference: string,
): CooperativeCredit {
  let remainingPayment = amount;
  let remainingPrincipal = credit.remainingBalance;
  const installments = credit.installments.map((installment) => {
    if (installment.number !== installmentNumber || remainingPayment <= 0) return installment;
    const amountOwed = Math.max(0, installment.totalDue + installment.penalty - installment.amountPaid);
    const applied = Math.min(amountOwed, remainingPayment);
    const penaltyPreviouslyPaid = Math.min(installment.penalty, installment.amountPaid);
    const penaltyOwed = Math.max(0, installment.penalty - penaltyPreviouslyPaid);
    const penaltyPaid = Math.min(applied, penaltyOwed);
    const afterPenalty = applied - penaltyPaid;
    const previouslyPaidAfterPenalty = Math.max(0, installment.amountPaid - installment.penalty);
    const interestPreviouslyPaid = Math.min(installment.interest, previouslyPaidAfterPenalty);
    const interestOwed = Math.max(0, installment.interest - interestPreviouslyPaid);
    const interestPaid = Math.min(afterPenalty, interestOwed);
    const principalPaid = Math.min(remainingPrincipal, Math.max(0, afterPenalty - interestPaid));
    remainingPrincipal = Math.max(0, Math.round((remainingPrincipal - principalPaid) * 100) / 100);
    remainingPayment -= applied;
    const amountPaid = Math.round((installment.amountPaid + applied) * 100) / 100;
    return {
      ...installment,
      amountPaid,
      status: (amountPaid >= installment.totalDue + installment.penalty
        ? "Payé"
        : installment.dueDate < paymentDate
          ? "En retard"
          : "Partiel") as InstallmentStatus,
      paidAt: paymentDate,
      paymentMethod,
      paymentReference,
    };
  });
  const status: CreditStatus = remainingPrincipal === 0
    ? "Soldé"
    : installments.some((item) => item.status === "En retard")
      ? "En retard"
      : "Actif";
  return {
    ...credit,
    status,
    remainingBalance: remainingPrincipal,
    installments,
    history: [...credit.history, { date: paymentDate, label: "Remboursement reçu", detail: `Paiement ${paymentReference} de ${amount.toFixed(2)} USD via ${paymentMethod}.` }],
  };
}

export function findCreditMember(credit: CooperativeCredit): CooperativeMember {
  return mockMembers.find((member) => member.id === credit.memberId)!;
}

export function getCreditGuarantors(credit: CooperativeCredit) {
  return credit.guarantorIds
    .map((id) => mockMembers.find((member) => member.id === id))
    .filter((member): member is CooperativeMember => Boolean(member));
}

export function getUpcomingInstallment(credit: CooperativeCredit) {
  return credit.installments.find((installment) => installment.status !== "Payé") ?? null;
}
