import { MemberAnnouncementsPage } from "@/components/member-portal/member-announcements-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Annonces & Assemblées | Mwangaza Wetu",
};

export default function AnnouncementsRoute() {
  return <MemberAnnouncementsPage />;
}
