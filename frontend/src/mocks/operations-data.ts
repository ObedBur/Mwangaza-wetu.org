import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { mockAccounts, mockMembers } from "@/mocks/cooperative-data";

export type PaymentMethod =
  | "Espèces"
  | "M-Pesa"
  | "Airtel Money"
  | "Orange Money"
  | "Virement";
export type DepositKind = "Dépôt" | "Cotisation";
export type WithdrawalStatus = "En attente" | "Approuvé" | "Payé" | "Rejeté";
export type DepositRecord = {
  id: string;
  reference: string;
  memberId: string;
  account: AccountSlug;
  kind: DepositKind;
  amount: number;
  method: PaymentMethod;
  date: string;
  status: "Validé" | "En attente" | "Rejeté";
  transactionReference: string;
  note: string;
};
export type WithdrawalRecord = {
  id: string;
  reference: string;
  memberId: string;
  account: AccountSlug;
  amount: number;
  reason: string;
  requestedAt: string;
  status: WithdrawalStatus;
  urgent: boolean;
  proofProvided: boolean;
  method: PaymentMethod;
  rejectionReason?: string;
};

export const paymentMethods: PaymentMethod[] = [
  "Espèces",
  "M-Pesa",
  "Airtel Money",
  "Orange Money",
  "Virement",
];

const depositAccounts: AccountSlug[] = [
  "principal",
  "kelasi",
  "hopital",
  "nyumba",
  "mutoto",
  "biashara",
  "principal",
  "hopital",
  "kelasi",
  "biashara",
  "nyumba",
  "mutoto",
  "principal",
  "kelasi",
  "hopital",
  "nyumba",
  "biashara",
  "mutoto",
  "principal",
  "kelasi",
  "hopital",
  "biashara",
  "nyumba",
  "mutoto",
  "principal",
  "kelasi",
  "hopital",
  "nyumba",
];
const depositKinds: DepositKind[] = [
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Cotisation",
  "Dépôt",
  "Dépôt",
];
const depositAmounts = [
  120, 25, 85, 210, 30, 75, 20, 160, 40, 275, 190, 35, 95, 25, 145, 310, 30, 80,
  20, 125, 65, 25, 230, 35, 110, 20, 175, 90,
];
const operationDates = [
  "2025-06-24",
  "2025-06-23",
  "2025-06-22",
  "2025-06-21",
  "2025-06-20",
  "2025-06-19",
  "2025-06-18",
  "2025-06-17",
  "2025-06-16",
  "2025-06-15",
  "2025-06-14",
  "2025-06-13",
  "2025-06-12",
  "2025-06-11",
  "2025-06-10",
  "2025-06-09",
  "2025-06-08",
  "2025-06-07",
  "2025-06-06",
  "2025-06-05",
  "2025-06-04",
  "2025-06-03",
  "2025-06-02",
  "2025-06-01",
  "2025-05-30",
  "2025-05-28",
  "2025-05-26",
  "2025-05-24",
];
const depositStatuses: DepositRecord["status"][] = [
  "Validé",
  "Validé",
  "En attente",
  "Validé",
  "Validé",
  "Validé",
  "En attente",
  "Validé",
  "Validé",
  "Rejeté",
  "Validé",
  "Validé",
  "En attente",
  "Validé",
  "Validé",
  "Validé",
  "En attente",
  "Validé",
  "Rejeté",
  "Validé",
  "Validé",
  "Validé",
  "En attente",
  "Validé",
  "Validé",
  "Validé",
  "Validé",
  "Rejeté",
];
const methods: PaymentMethod[] = [
  "M-Pesa",
  "Espèces",
  "Airtel Money",
  "Orange Money",
  "Virement",
];

export const mockDeposits: DepositRecord[] = depositAccounts.map(
  (account, index) => {
    const holders = mockAccounts[account].holders;
    const member = holders[(index * 3 + 1) % holders.length].member;
    return {
      id: `deposit-${index + 1}`,
      reference: `DEP-2025-${String(index + 1).padStart(4, "0")}`,
      memberId: member.id,
      account,
      kind: depositKinds[index],
      amount: depositAmounts[index],
      method: methods[index % methods.length],
      date: operationDates[index],
      status: depositStatuses[index],
      transactionReference: `TRX-${String(73620 + index * 37)}`,
      note:
        depositKinds[index] === "Cotisation"
          ? "Cotisation mensuelle"
          : "Versement au guichet",
    };
  },
);

const withdrawalAccounts: AccountSlug[] = [
  "principal",
  "hopital",
  "kelasi",
  "biashara",
  "hopital",
  "nyumba",
  "principal",
  "hopital",
  "mutoto",
  "kelasi",
  "biashara",
  "hopital",
  "nyumba",
  "principal",
  "hopital",
  "mutoto",
  "kelasi",
  "biashara",
  "hopital",
  "principal",
  "nyumba",
  "hopital",
  "kelasi",
  "biashara",
];
const withdrawalStatuses: WithdrawalStatus[] = [
  "En attente",
  "En attente",
  "En attente",
  "En attente",
  "En attente",
  "En attente",
  "En attente",
  "En attente",
  "Approuvé",
  "Approuvé",
  "Approuvé",
  "Approuvé",
  "Approuvé",
  "Approuvé",
  "Payé",
  "Payé",
  "Payé",
  "Payé",
  "Payé",
  "Payé",
  "Rejeté",
  "Rejeté",
  "Rejeté",
  "Rejeté",
];
const withdrawalReasons = [
  "Dépense familiale urgente",
  "Soins médicaux",
  "Frais scolaires",
  "Renouvellement du stock",
  "Achat de médicaments",
  "Travaux de toiture",
  "Frais de transport",
  "Consultation médicale",
  "Fournitures scolaires",
  "Capital de roulement",
  "Achat de médicaments",
  "Urgence hospitalière",
  "Achat de matériaux",
  "Dépense imprévue",
  "Frais de soins",
  "Soutien scolaire",
  "Frais d’inscription",
  "Réapprovisionnement boutique",
  "Hospitalisation d’un enfant",
  "Frais de déplacement",
  "Objectif non atteint",
  "Justificatif incomplet",
  "Demande en double",
  "Motif non conforme",
];
const withdrawalDates = [
  "2025-06-24",
  "2025-06-24",
  "2025-06-23",
  "2025-06-23",
  "2025-06-22",
  "2025-06-22",
  "2025-06-21",
  "2025-06-20",
  "2025-06-19",
  "2025-06-18",
  "2025-06-17",
  "2025-06-16",
  "2025-06-15",
  "2025-06-14",
  "2025-06-13",
  "2025-06-12",
  "2025-06-11",
  "2025-06-10",
  "2025-06-09",
  "2025-06-08",
  "2025-06-07",
  "2025-06-06",
  "2025-06-05",
  "2025-06-04",
];
const withdrawalAmounts = [
  90, 140, 180, 260, 75, 320, 60, 115, 210, 160, 340, 95, 450, 125, 240, 180,
  220, 390, 85, 110, 200, 120, 190, 300,
];

export const mockWithdrawals: WithdrawalRecord[] = withdrawalAccounts.map(
  (account, index) => {
    const holders = mockAccounts[account].holders;
    const member = holders[(index * 2 + 2) % holders.length].member;
    const urgent = account === "hopital" && [1, 4, 11].includes(index);
    return {
      id: `withdrawal-${index + 1}`,
      reference: `RET-2025-${String(index + 1).padStart(4, "0")}`,
      memberId: member.id,
      account,
      amount: Math.min(
        withdrawalAmounts[index],
        Math.max(25, member.balances[account] - 15),
      ),
      reason: withdrawalReasons[index],
      requestedAt: withdrawalDates[index],
      status: withdrawalStatuses[index],
      urgent,
      proofProvided:
        account === "hopital" || account === "kelasi" || account === "mutoto"
          ? index % 4 !== 0
          : index % 5 !== 0,
      method: methods[(index + 2) % methods.length],
      rejectionReason:
        withdrawalStatuses[index] === "Rejeté"
          ? withdrawalReasons[index]
          : undefined,
    };
  },
);

export const mockLateContributions = mockMembers
  .filter(
    (member) =>
      member.status === "En retard" &&
      accountSlugs.some((slug) => member.balances[slug] > 0),
  )
  .slice(0, 6)
  .map((member, index) => ({
    member,
    amountDue: [25, 30, 20, 35, 25, 40][index],
    month: [
      "Mai 2025",
      "Mai 2025",
      "Avril 2025",
      "Mai 2025",
      "Avril 2025",
      "Mai 2025",
    ][index],
  }));

export const getMemberForOperation = (memberId: string) =>
  mockMembers.find((member) => member.id === memberId)!;

export const getAccountBalance = (memberId: string, account: AccountSlug) =>
  getMemberForOperation(memberId).balances[account];

export const getWithdrawalChecks = (request: WithdrawalRecord) => {
  const member = getMemberForOperation(request.memberId);
  const rules = mockAccounts[request.account].rules;
  const balance = member.balances[request.account];
  const enoughBalance = balance >= request.amount;
  const blocked =
    request.account === "nyumba" &&
    rules.targetAmount !== null &&
    balance < rules.targetAmount;
  const minimumRemainingApplies = !["principal", "hopital"].includes(
    request.account,
  );
  const minimumRemainingOk =
    !minimumRemainingApplies ||
    balance - request.amount >= rules.minimumDeposit;
  const justificationNeeded = ["kelasi", "mutoto"].includes(request.account);
  const justificationOk = !justificationNeeded || request.proofProvided;
  return [
    {
      label: "Solde suffisant",
      ok: enoughBalance,
      detail: `Disponible : ${balance} USD`,
    },
    {
      label: "Compte non bloqué",
      ok: !blocked,
      detail: blocked
        ? `Objectif requis : ${rules.targetAmount} USD`
        : "Conditions de retrait satisfaites",
    },
    {
      label: "Minimum restant respecté",
      ok: minimumRemainingOk,
      detail: minimumRemainingApplies
        ? `Solde restant requis : ${rules.minimumDeposit} USD`
        : "Aucun minimum restant imposé",
    },
    {
      label: "Justificatif fourni",
      ok: justificationOk,
      detail: justificationOk
        ? "Pièce présente dans le dossier"
        : "Une pièce justificative est requise",
    },
  ];
};

export const accountLabel = (slug: AccountSlug) =>
  accountConfigs[slug].shortLabel;
