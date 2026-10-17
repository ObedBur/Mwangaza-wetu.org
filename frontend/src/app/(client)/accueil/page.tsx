import { MemberDashboard } from "@/components/member-portal/member-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accueil | Mwangaza Wetu" };

export default function MemberHomePage() {
  return <MemberDashboard />;
}
