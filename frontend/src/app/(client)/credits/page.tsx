import { MemberCreditsPage } from "@/components/member-portal/MemberCreditsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crédits | Mwangaza Wetu",
};

export default function CreditsRoute() {
  return <MemberCreditsPage />;
}
