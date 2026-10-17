import { MemberOperationPage } from "@/components/member-portal/member-operation-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Retrait | Mwangaza Wetu",
};

export default function WithdrawRoute() {
  return <MemberOperationPage kind="retrait" />;
}
