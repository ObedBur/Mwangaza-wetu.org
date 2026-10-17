import { MemberAccountsPage } from "@/components/member-portal/member-accounts-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Épargne & Comptes | Mwangaza Wetu",
};

export default function AccountsRoute() {
  return <MemberAccountsPage />;
}
