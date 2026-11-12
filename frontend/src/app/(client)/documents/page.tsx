import { MemberDocumentsPage } from "@/components/member-portal/MemberDocumentsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documents & Relevés | Mwangaza Wetu",
};

export default function DocumentsRoute() {
  return <MemberDocumentsPage />;
}
