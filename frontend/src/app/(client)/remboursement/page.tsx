import { MemberRepaymentsPage } from "@/components/member-portal/MemberCreditsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remboursements | Mwangaza Wetu",
};

export default function RepaymentsRoute() {
  return <MemberRepaymentsPage />;
}
