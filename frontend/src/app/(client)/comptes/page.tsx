import { MemberAccountsPage } from "@/components/member-portal/MemberAccountsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Épargne & Comptes | Mwangaza Wetu",
};

export default function AccountsRoute() {
  return <MemberAccountsPage />;
}
