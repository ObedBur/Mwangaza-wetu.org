import {
  IconBabyCarriage,
  IconBuildingStore,
  IconHeartPlus,
  IconHome,
  IconSchool,
  IconWallet,
  type TablerIcon,
} from "@tabler/icons-react";

export type AccountSlug =
  | "principal"
  | "kelasi"
  | "hopital"
  | "nyumba"
  | "mutoto"
  | "biashara";

export type AccountConfig = {
  slug: AccountSlug;
  label: string;
  shortLabel: string;
  subtitle: string;
  color: string;
  icon: TablerIcon;
};

export const accountConfigs: Record<AccountSlug, AccountConfig> = {
  principal: {
    slug: "principal",
    label: "Compte Principal",
    shortLabel: "Compte Principal",
    subtitle: "Épargne libre",
    color: "#25825c",
    icon: IconWallet,
  },
  kelasi: {
    slug: "kelasi",
    label: "Épargne Kelasi",
    shortLabel: "Kelasi",
    subtitle: "Écoles / Études",
    color: "#c18c2d",
    icon: IconSchool,
  },
  hopital: {
    slug: "hopital",
    label: "Épargne Hôpital",
    shortLabel: "Hôpital",
    subtitle: "Santé / Urgence",
    color: "#d16c68",
    icon: IconHeartPlus,
  },
  nyumba: {
    slug: "nyumba",
    label: "Épargne Nyumba",
    shortLabel: "Nyumba",
    subtitle: "Logement / Construction",
    color: "#99724f",
    icon: IconHome,
  },
  mutoto: {
    slug: "mutoto",
    label: "Épargne Mutoto",
    shortLabel: "Mutoto",
    subtitle: "Avenir des enfants",
    color: "#9a75c1",
    icon: IconBabyCarriage,
  },
  biashara: {
    slug: "biashara",
    label: "Épargne Biashara",
    shortLabel: "Biashara",
    subtitle: "Commerce / Business",
    color: "#4384b5",
    icon: IconBuildingStore,
  },
};

export const accountSlugs = Object.keys(accountConfigs) as AccountSlug[];
