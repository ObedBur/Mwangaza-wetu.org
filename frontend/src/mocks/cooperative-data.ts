import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";

export type MemberStatus = "Actif" | "En retard" | "Suspendu";
export type OperationStatus = "Validé" | "En attente" | "Rejeté";
export type OperationType = "Dépôt" | "Retrait" | "Intérêt";

export type CooperativeMember = {
  id: string;
  memberNumber: string;
  name: string;
  phone: string;
  joinedAt: string;
  status: MemberStatus;
  balances: Record<AccountSlug, number>;
  savingsTotal: number;
};

export type AccountOperation = {
  id: string;
  memberId: string;
  memberName: string;
  type: OperationType;
  amount: number;
  date: string;
  status: OperationStatus;
};

export type MemberCredit = {
  memberId: string;
  principal: number;
  balance: number;
  dueDate: string;
};

export type AccountRules = {
  objective: string;
  minimumDeposit: number;
  withdrawalConditions: string;
  blockingPeriod: string;
  targetAmount: number | null;
};

export type AccountHolder = {
  member: CooperativeMember;
  balance: number;
  lastDeposit: string;
  goalAmount: number | null;
  status: MemberStatus;
};

export type AccountMock = {
  rules: AccountRules;
  holders: AccountHolder[];
  operations: AccountOperation[];
  balanceHistory: {
    annual: number[];
    monthly: number[];
    weekly: number[];
  };
};

const memberSeeds = [
  ["Aline Mukamana", "0970 120 451", "2025-06-03"],
  ["Jean-Claude Niyonzima", "0970 120 452", "2024-11-18"],
  ["Chantal Uwase", "0970 120 453", "2025-02-11"],
  ["Patrick Ndayishimiye", "0970 120 454", "2024-08-22"],
  ["Beata Uwamahoro", "0970 120 455", "2025-06-08"],
  ["Mugisha Emmanuel", "0970 120 456", "2023-12-04"],
  ["Esperance Bahati", "0970 120 457", "2024-04-16"],
  ["Dieudonné Safari", "0970 120 458", "2025-01-27"],
  ["Clarisse Nyirabihogo", "0970 120 459", "2024-09-09"],
  ["Aimé Katembo", "0970 120 460", "2025-05-14"],
  ["Solange Irakoze", "0970 120 461", "2024-02-19"],
  ["Blaise Mupenzi", "0970 120 462", "2023-10-30"],
  ["Gisèle Nyiransabimana", "0970 120 463", "2025-03-06"],
  ["Fabrice Habimana", "0970 120 464", "2024-06-13"],
  ["Adeline Murekatete", "0970 120 465", "2024-12-02"],
  ["Cédric Mumbere", "0970 120 466", "2025-06-12"],
  ["Florence Kavira", "0970 120 467", "2023-11-21"],
  ["Dieu-Merci Bisimwa", "0970 120 468", "2024-07-08"],
  ["Jeannette Baraka", "0970 120 469", "2025-04-17"],
  ["Moïse Kambale", "0970 120 470", "2024-01-15"],
  ["Prisca Amani", "0970 120 471", "2025-05-02"],
  ["Héritier Masika", "0970 120 472", "2023-08-29"],
  ["Merveille Kalume", "0970 120 473", "2024-10-07"],
  ["Jonathan Mateso", "0970 120 474", "2025-02-24"],
  ["Véronique Luhindi", "0970 120 475", "2024-03-12"],
  ["Alain Cirimwami", "0970 120 476", "2025-06-18"],
  ["Rehema Muhindo", "0970 120 477", "2024-05-06"],
  ["Samuel Byamungu", "0970 120 478", "2023-09-14"],
  ["Diane Mushagalusa", "0970 120 479", "2025-01-08"],
  ["Olivier Bahati", "0970 120 480", "2024-11-25"],
] as const;

const accountMembers: Record<AccountSlug, number[]> = {
  principal: Array.from({ length: 15 }, (_, index) => index),
  kelasi: [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 14],
  hopital: [0, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 16],
  nyumba: [0, 1, 3, 4, 6, 8, 11, 12, 13, 15, 17, 18],
  mutoto: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 18, 19],
  biashara: [0, 1, 3, 5, 7, 8, 11, 13, 15, 17, 19, 20],
};

const accountBalance = (slug: AccountSlug, index: number) => {
  const seed = index + 1;
  const ranges: Record<AccountSlug, [number, number]> = {
    principal: [450, 2100],
    kelasi: [180, 980],
    hopital: [100, 720],
    nyumba: [900, 3700],
    mutoto: [250, 1450],
    biashara: [600, 2850],
  };
  const [base, range] = ranges[slug];
  return base + ((seed * 173 + slug.length * 41) % range);
};

const memberStatus = (index: number): MemberStatus =>
  index % 11 === 0 ? "Suspendu" : index % 5 === 0 ? "En retard" : "Actif";

export const mockMemberTrends = {
  total: "+8,2 % sur 30 jours",
  active: "+2,4 % sur 30 jours",
  overdue: "−1,1 % sur 30 jours",
  newThisMonth: "contre 3 le mois passé",
};

export const mockMembers: CooperativeMember[] = memberSeeds.map(
  ([name, phone, joinedAt], index) => {
    const balances = Object.fromEntries(
      accountSlugs.map((slug) => [
        slug,
        accountMembers[slug].includes(index) ? accountBalance(slug, index) : 0,
      ]),
    ) as Record<AccountSlug, number>;

    return {
      id: `member-${index + 1}`,
      memberNumber: `MW-2025-${String(index + 1).padStart(4, "0")}`,
      name,
      phone,
      joinedAt,
      status: memberStatus(index),
      balances,
      savingsTotal: Object.values(balances).reduce(
        (total, value) => total + value,
        0,
      ),
    };
  },
);

export const mockCredits: MemberCredit[] = [
  {
    memberId: "member-4",
    principal: 1800,
    balance: 920,
    dueDate: "2025-07-12",
  },
  {
    memberId: "member-8",
    principal: 950,
    balance: 415,
    dueDate: "2025-07-18",
  },
  {
    memberId: "member-13",
    principal: 2400,
    balance: 1560,
    dueDate: "2025-07-24",
  },
  {
    memberId: "member-22",
    principal: 1250,
    balance: 230,
    dueDate: "2025-08-02",
  },
];

const accountRules: Record<AccountSlug, AccountRules> = {
  principal: {
    objective: "Épargne libre pour les besoins du quotidien.",
    minimumDeposit: 5,
    withdrawalConditions: "Retrait libre sur demande du titulaire.",
    blockingPeriod: "Aucun délai de blocage.",
    targetAmount: null,
  },
  kelasi: {
    objective: "Préparer les frais scolaires et universitaires.",
    minimumDeposit: 10,
    withdrawalConditions:
      "Retrait destiné aux frais scolaires, sur justificatif.",
    blockingPeriod: "Déblocage pendant la période de rentrée scolaire.",
    targetAmount: 1200,
  },
  hopital: {
    objective: "Constituer une réserve pour les soins et urgences médicales.",
    minimumDeposit: 5,
    withdrawalConditions:
      "Retrait d’urgence rapide avec déclaration du titulaire.",
    blockingPeriod: "Aucun délai en cas d’urgence médicale.",
    targetAmount: 800,
  },
  nyumba: {
    objective: "Financer un logement, une construction ou des travaux.",
    minimumDeposit: 20,
    withdrawalConditions:
      "Retrait possible lorsque l’objectif convenu est atteint.",
    blockingPeriod: "Épargne bloquée jusqu’à l’atteinte de l’objectif.",
    targetAmount: 5000,
  },
  mutoto: {
    objective: "Préparer l’avenir et les études des enfants du foyer.",
    minimumDeposit: 10,
    withdrawalConditions:
      "Retrait selon l’âge cible ou un besoin éducatif documenté.",
    blockingPeriod: "Blocage jusqu’à l’âge cible défini à l’ouverture.",
    targetAmount: 2500,
  },
  biashara: {
    objective:
      "Constituer un capital de roulement pour les activités commerciales.",
    minimumDeposit: 15,
    withdrawalConditions:
      "Retrait du capital selon le cycle commercial du membre.",
    blockingPeriod: "Aucun délai fixe; planifier le retrait selon l’activité.",
    targetAmount: 3500,
  },
};

const operationTypes: OperationType[] = [
  "Dépôt",
  "Dépôt",
  "Retrait",
  "Dépôt",
  "Intérêt",
  "Dépôt",
  "Retrait",
  "Dépôt",
  "Dépôt",
  "Dépôt",
];
const operationStatuses: OperationStatus[] = [
  "Validé",
  "Validé",
  "En attente",
  "Validé",
  "Validé",
  "Validé",
  "Rejeté",
  "Validé",
  "Validé",
  "En attente",
];
const operationDates = [
  "2025-06-24",
  "2025-06-23",
  "2025-06-22",
  "2025-06-20",
  "2025-06-18",
  "2025-06-16",
  "2025-06-14",
  "2025-06-12",
  "2025-06-10",
  "2025-06-08",
];
const operationAmount = (slug: AccountSlug, index: number) => {
  const seed = index + 1;
  const ranges: Record<AccountSlug, [number, number]> = {
    principal: [35, 240],
    kelasi: [20, 140],
    hopital: [15, 120],
    nyumba: [80, 380],
    mutoto: [25, 160],
    biashara: [55, 310],
  };
  const [base, range] = ranges[slug];
  return base + ((seed * 47 + slug.length * 13) % range);
};

const history = (base: number, multiplier: number) =>
  Array.from({ length: 12 }, (_, index) =>
    Math.round(
      base * (0.54 + index * 0.045 + ((index * 19) % 7) / 100) * multiplier,
    ),
  );

export const mockAccounts: Record<AccountSlug, AccountMock> =
  Object.fromEntries(
    accountSlugs.map((slug, accountIndex) => {
      const holders = mockMembers
        .filter((member) => member.balances[slug] > 0)
        .map((member) => {
          const operationIndex = Number(member.id.split("-")[1]) % 10;
          return {
            member,
            balance: member.balances[slug],
            lastDeposit: operationDates[operationIndex],
            goalAmount: accountRules[slug].targetAmount
              ? accountRules[slug].targetAmount! +
                ((operationIndex % 4) - 1) * 250
              : null,
            status: member.status,
          };
        });
      const operations = Array.from({ length: 10 }, (_, index) => {
        const holder = holders[(index * 3 + accountIndex) % holders.length];
        return {
          id: `${slug}-operation-${index + 1}`,
          memberId: holder.member.id,
          memberName: holder.member.name,
          type: operationTypes[index],
          amount: operationAmount(slug, index),
          date: operationDates[index],
          status: operationStatuses[index],
        };
      });
      const totalBalance = holders.reduce(
        (total, holder) => total + holder.balance,
        0,
      );

      return [
        slug,
        {
          rules: accountRules[slug],
          holders,
          operations,
          balanceHistory: {
            annual: history(totalBalance, 1),
            monthly: history(totalBalance, 0.16),
            weekly: history(totalBalance, 0.035),
          },
        },
      ];
    }),
  ) as Record<AccountSlug, AccountMock>;

export const mockAccountSummary = (slug: AccountSlug) => {
  const account = mockAccounts[slug];
  return {
    totalBalance: account.holders.reduce(
      (total, holder) => total + holder.balance,
      0,
    ),
    holderCount: account.holders.length,
    depositsThisMonth: account.operations
      .filter(
        (operation) =>
          operation.type === "Dépôt" && operation.date.startsWith("2025-06"),
      )
      .reduce((total, operation) => total + operation.amount, 0),
    withdrawalsThisMonth: account.operations
      .filter(
        (operation) =>
          operation.type === "Retrait" && operation.date.startsWith("2025-06"),
      )
      .reduce((total, operation) => total + operation.amount, 0),
  };
};

export const memberRecentOperations = (memberId: string) =>
  accountSlugs
    .flatMap((slug) =>
      mockAccounts[slug].operations
        .filter((operation) => operation.memberId === memberId)
        .map((operation) => ({ ...operation, account: accountConfigs[slug] })),
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);

export const memberAccountBalances = (member: CooperativeMember) =>
  accountSlugs
    .filter((slug) => member.balances[slug] > 0)
    .map((slug) => ({
      account: accountConfigs[slug],
      balance: member.balances[slug],
    }));
