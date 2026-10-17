import { MemberProfilePage } from "@/components/member-portal/member-profile-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil & Sécurité | Mwangaza Wetu",
};

export default function ProfileRoute() {
  return <MemberProfilePage />;
}
