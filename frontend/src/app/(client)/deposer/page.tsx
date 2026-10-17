import { MemberOperationPage } from "@/components/member-portal/member-operation-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Déposer | Mwangaza Wetu",
};

export default function DepositRoute() {
  return <MemberOperationPage kind="depot" />;
}
