import type { MemberAccountId } from "@/lib/member-portal-config";

export type TransactionKind =
  | "Dépôt"
  | "Retrait"
  | "Remboursement"
  | "Cotisation";
export type TransactionStatus = "Validé" | "En attente" | "Rejeté";

export interface MemberAccountData {
  accountId: MemberAccountId;
  balance?: number;
  remaining?: number;
  repaidPercent?: number;
  coverageActive?: boolean;
}

export interface MemberTransaction {
  id: string;
  date: string;
  description: string;
  accountId: MemberAccountId;
  kind: TransactionKind;
  amount: number;
  status: TransactionStatus;
  currency?: string;
  accountLabel?: string;
}

export const dashboardData = {
  currentMonth: "2026-10",
  monthlySummary: {
    deposits: 420,
    depositChange: 8.5,
    withdrawals: 150,
    withdrawalChange: -4.2,
    net: 270,
    savingsTotal: 1560,
    savingsAccounts: 2,
    creditsRemaining: 1060,
  },
  nextRepayment: {
    accountId: "biashara" as const,
    amount: 45,
    dueDate: "2026-10-10",
  },
  accounts: [
    { accountId: "principal", balance: 1250 },
    { accountId: "mutoto", balance: 310 },
    { accountId: "kelasi", remaining: 240, repaidPercent: 40 },
    { accountId: "nyumba", remaining: 640, repaidPercent: 25 },
    { accountId: "biashara", remaining: 180, repaidPercent: 55 },
    { accountId: "hopital", coverageActive: true },
  ] satisfies MemberAccountData[],
  monthlyActivity: [
    { month: "Mai", deposits: 290, withdrawals: 180 },
    { month: "Juin", deposits: 340, withdrawals: 210 },
    { month: "Juil.", deposits: 315, withdrawals: 170 },
    { month: "Août", deposits: 385, withdrawals: 195 },
    { month: "Sept.", deposits: 387, withdrawals: 157 },
    { month: "Oct.", deposits: 420, withdrawals: 150 },
  ],
  transactions: [
    {
      id: "tx-20261002-01",
      date: "2026-10-02T12:30:00",
      description: "Cotisation mensuelle",
      accountId: "principal",
      kind: "Cotisation",
      amount: 180,
      status: "Validé",
    },
    {
      id: "tx-20261002-02",
      date: "2026-10-02T10:00:00",
      description: "Retrait au guichet",
      accountId: "principal",
      kind: "Retrait",
      amount: 115,
      status: "Validé",
    },
    {
      id: "tx-20261001-01",
      date: "2026-10-01T14:25:00",
      description: "Dépôt au guichet",
      accountId: "principal",
      kind: "Dépôt",
      amount: 240,
      status: "Validé",
    },
    {
      id: "tx-20261001-02",
      date: "2026-10-01T10:30:00",
      description: "Retrait mobile",
      accountId: "principal",
      kind: "Retrait",
      amount: 35,
      status: "En attente",
    },
    {
      id: "tx-20260929-01",
      date: "2026-09-29T15:15:00",
      description: "Dépôt épargne enfants",
      accountId: "mutoto",
      kind: "Dépôt",
      amount: 120,
      status: "Validé",
    },
    {
      id: "tx-20260927-01",
      date: "2026-09-27T09:45:00",
      description: "Remboursement crédit",
      accountId: "kelasi",
      kind: "Remboursement",
      amount: 60,
      status: "Validé",
    },
    {
      id: "tx-20260924-01",
      date: "2026-09-24T11:10:00",
      description: "Cotisation coopérative",
      accountId: "principal",
      kind: "Cotisation",
      amount: 80,
      status: "En attente",
    },
    {
      id: "tx-20260923-01",
      date: "2026-09-23T16:20:00",
      description: "Remboursement BIASHARA",
      accountId: "biashara",
      kind: "Remboursement",
      amount: 45,
      status: "Rejeté",
    },
    {
      id: "tx-20260922-01",
      date: "2026-09-22T08:55:00",
      description: "Dépôt épargne libre",
      accountId: "principal",
      kind: "Dépôt",
      amount: 100,
      status: "Validé",
    },
  ] satisfies MemberTransaction[],
} as const;
