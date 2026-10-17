import type { MemberAccountId } from "@/lib/member-portal-config";

export interface MemberCredit {
  accountId: Exclude<MemberAccountId, "principal" | "mutoto" | "hopital">;
  initialAmount: number;
  outstanding: number;
  repaidPercent: number;
  monthlyPayment: number;
  startDate: string;
  nextDueDate: string;
  nextDueAmount: number;
}

export type MemberDocumentCategory =
  | "Relevé"
  | "Reçu"
  | "Attestation"
  | "Assemblée";

export interface MemberDocument {
  id: string;
  title: string;
  category: MemberDocumentCategory;
  date: string;
  format: "CSV" | "Aperçu";
  accountId?: MemberAccountId;
  description: string;
}

export type AnnouncementCategory = "Assemblée" | "Information" | "Service";

export interface MemberAnnouncement {
  id: string;
  category: AnnouncementCategory;
  title: string;
  date: string;
  summary: string;
  details: string;
  isNew: boolean;
  pinned: boolean;
}

export const memberCredits: MemberCredit[] = [
  {
    accountId: "kelasi",
    initialAmount: 400,
    outstanding: 240,
    repaidPercent: 40,
    monthlyPayment: 30,
    startDate: "2026-05-12",
    nextDueDate: "2026-10-15",
    nextDueAmount: 30,
  },
  {
    accountId: "nyumba",
    initialAmount: 850,
    outstanding: 640,
    repaidPercent: 25,
    monthlyPayment: 75,
    startDate: "2026-06-03",
    nextDueDate: "2026-10-20",
    nextDueAmount: 75,
  },
  {
    accountId: "biashara",
    initialAmount: 400,
    outstanding: 180,
    repaidPercent: 55,
    monthlyPayment: 45,
    startDate: "2026-03-18",
    nextDueDate: "2026-10-10",
    nextDueAmount: 45,
  },
];

export const memberDocuments: MemberDocument[] = [
  {
    id: "statement-october-2026",
    title: "Relevé de compte · Octobre 2026",
    category: "Relevé",
    date: "2026-10-02",
    format: "CSV",
    accountId: "principal",
    description:
      "Historique des opérations du compte principal pour le mois d’octobre.",
  },
  {
    id: "deposit-receipt-october-2026",
    title: "Reçu de dépôt au guichet",
    category: "Reçu",
    date: "2026-10-01",
    format: "Aperçu",
    accountId: "principal",
    description:
      "Confirmation du dépôt de 240,00 $ effectué au guichet le 1 octobre 2026.",
  },
  {
    id: "membership-certificate-2026",
    title: "Attestation d’adhésion",
    category: "Attestation",
    date: "2026-09-12",
    format: "Aperçu",
    description:
      "Attestation de membre actif au nom d’Amina Niyonzima, numéro MW-0001.",
  },
  {
    id: "general-assembly-minutes-2026",
    title: "Procès-verbal de l’assemblée générale",
    category: "Assemblée",
    date: "2026-09-05",
    format: "Aperçu",
    description:
      "Compte rendu de l’assemblée générale ordinaire et décisions de la coopérative.",
  },
];

export const memberProfile = {
  phone: "+243 970 000 001",
  email: "amina.niyonzima@example.com",
  city: "Goma",
  preferredContact: "SMS" as "SMS" | "E-mail",
};

export const supportQuestions = [
  {
    question: "Comment effectuer un dépôt sur mon compte ?",
    answer:
      "Depuis l’espace membre, ouvrez Déposer, choisissez votre compte, puis le mode de dépôt. Pour cette démonstration, aucune opération réelle n’est transmise.",
  },
  {
    question: "Où retrouver mes relevés ?",
    answer:
      "Vos relevés et justificatifs disponibles se trouvent dans Documents & relevés. Vous pouvez les filtrer par catégorie et télécharger les exports proposés.",
  },
  {
    question: "Comment suivre mes remboursements ?",
    answer:
      "La page Crédits & remboursements présente le capital restant dû, les échéances prévues et les opérations déjà enregistrées.",
  },
  {
    question: "Comment contacter mon agence ?",
    answer:
      "Envoyez une demande depuis le formulaire de cette page en indiquant le sujet et les détails utiles. L’équipe pourra vous répondre via le canal de contact associé à votre profil.",
  },
];

export const memberAnnouncements: MemberAnnouncement[] = [
  {
    id: "general-assembly-november-2026",
    category: "Assemblée",
    title: "Assemblée générale ordinaire",
    date: "2026-10-02",
    summary:
      "Rendez-vous le 15 novembre pour le point annuel sur la vie de la coopérative.",
    details:
      "La rencontre aura lieu à Goma le dimanche 15 novembre 2026 à 10 h. Les membres pourront consulter l’ordre du jour et confirmer leur présence auprès de leur agence.",
    isNew: true,
    pinned: true,
  },
  {
    id: "mobile-money-maintenance-october-2026",
    category: "Service",
    title: "Maintenance Mobile Money",
    date: "2026-09-29",
    summary:
      "Les opérations Mobile Money seront momentanément indisponibles le 8 octobre.",
    details:
      "Une intervention technique est prévue le jeudi 8 octobre 2026, de 22 h à minuit. Les opérations au guichet restent disponibles pendant cette période.",
    isNew: true,
    pinned: false,
  },
  {
    id: "opening-hours-october-2026",
    category: "Information",
    title: "Horaires de l’agence de Goma",
    date: "2026-09-22",
    summary:
      "Retrouvez les horaires d’accueil des membres du lundi au vendredi.",
    details:
      "L’agence accueille les membres du lundi au vendredi, de 8 h à 16 h 30, et le samedi de 8 h à 12 h. Pensez à apporter votre numéro de membre pour toute demande.",
    isNew: false,
    pinned: false,
  },
];
