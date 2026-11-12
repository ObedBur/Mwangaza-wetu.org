import { MemberSupportPage } from "@/components/member-portal/MemberSupportPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aide & Support | Mwangaza Wetu",
};

export default function SupportRoute() {
  return <MemberSupportPage />;
}
