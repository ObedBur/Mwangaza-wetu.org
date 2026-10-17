import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsExchange,
  IconBabyCarriage,
  IconBuildingBank,
  IconCreditCard,
  IconFileText,
  IconHeartHandshake,
  IconHome,
  IconLifebuoy,
  IconSchool,
  IconShield,
  IconSpeakerphone,
  IconWallet,
  type TablerIcon,
} from "@/lib/tabler-icons";

export type PortalIcon = TablerIcon;
export type NavigationGroupId = "principal" | "services" | "autres";
export type MemberAccountType = "épargne" | "crédit" | "couverture";
export type MemberAccountId =
  | "principal"
  | "mutoto"
  | "kelasi"
  | "nyumba"
  | "biashara"
  | "hopital";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  group: NavigationGroupId;
  icon: PortalIcon;
  showInNavigation?: boolean;
}

export const memberNavigation: NavigationItem[] = [
  {
    id: "membre",
    label: "Accueil",
    href: "/accueil",
    group: "principal",
    icon: IconHome,
  },
  {
    id: "transactions",
    label: "Mes transactions",
    href: "/transactions",
    group: "principal",
    icon: IconArrowsExchange,
  },
  {
    id: "comptes",
    label: "Épargne",
    href: "/comptes",
    group: "services",
    icon: IconWallet,
  },
  {
    id: "deposer",
    label: "Déposer",
    href: "/deposer",
    group: "services",
    icon: IconArrowDown,
    showInNavigation: false,
  },
  {
    id: "retirer",
    label: "Retrait",
    href: "/retirer",
    group: "services",
    icon: IconArrowUp,
  },
  {
    id: "credits",
    label: "Crédit",
    href: "/credits",
    group: "services",
    icon: IconCreditCard,
  },
  {
    id: "remboursement",
    label: "Remboursement",
    href: "/remboursement",
    group: "services",
    icon: IconArrowsExchange,
  },
  {
    id: "documents",
    label: "Documents & relevés",
    href: "/documents",
    group: "autres",
    icon: IconFileText,
  },
  {
    id: "annonces",
    label: "Annonces & assemblées",
    href: "/annonces",
    group: "autres",
    icon: IconSpeakerphone,
  },
  {
    id: "profil",
    label: "Profil & sécurité",
    href: "/profil",
    group: "autres",
    icon: IconShield,
  },
  {
    id: "aide",
    label: "Aide & support",
    href: "/aide",
    group: "autres",
    icon: IconLifebuoy,
  },
];

export const navigationGroups: { id: NavigationGroupId; label: string }[] = [
  { id: "principal", label: "Principal" },
  { id: "services", label: "Services" },
  { id: "autres", label: "Autres" },
];

export interface MemberAccountConfig {
  id: MemberAccountId;
  name: string;
  shortName: string;
  subtitle: string;
  icon: PortalIcon;
  colorClass: string;
  type: MemberAccountType;
}

export const memberAccounts: MemberAccountConfig[] = [
  {
    id: "principal",
    name: "Compte Principal",
    shortName: "Principal",
    subtitle: "Épargne libre",
    icon: IconBuildingBank,
    colorClass: "text-brand-blue",
    type: "épargne",
  },
  {
    id: "mutoto",
    name: "MUTOTO",
    shortName: "MUTOTO",
    subtitle: "Avenir Enfants",
    icon: IconBabyCarriage,
    colorClass: "text-brand-blue-mid",
    type: "épargne",
  },
  {
    id: "kelasi",
    name: "KELASI",
    shortName: "KELASI",
    subtitle: "Écoles / Études",
    icon: IconSchool,
    colorClass: "text-brand-amber",
    type: "crédit",
  },
  {
    id: "nyumba",
    name: "NYUMBA",
    shortName: "NYUMBA",
    subtitle: "Logement / Construction",
    icon: IconHome,
    colorClass: "text-brand-orange",
    type: "crédit",
  },
  {
    id: "biashara",
    name: "BIASHARA",
    shortName: "BIASHARA",
    subtitle: "Commerce / Business",
    icon: IconWallet,
    colorClass: "text-brand-anthracite",
    type: "crédit",
  },
  {
    id: "hopital",
    name: "HOPITAL",
    shortName: "HOPITAL",
    subtitle: "Santé / Urgence",
    icon: IconHeartHandshake,
    colorClass: "text-brand-green",
    type: "couverture",
  },
];

export const member = {
  name: "Amina Niyonzima",
  number: "MW-0001",
  get firstName() {
    return this.name.split(" ")[0];
  },
  initials: "AN",
} as const;
