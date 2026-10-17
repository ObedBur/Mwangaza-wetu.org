import { MemberTransactionsPage } from "@/components/member-portal/member-transactions-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes transactions | Mwangaza Wetu",
};

export default function TransactionsRoute() {
  return <MemberTransactionsPage />;
}
