import type { Metadata } from "next";
import { ProfileScreen } from "@/components/screens/profile-screen";

export const metadata: Metadata = { title: "Profile · RozFit" };

export default function Page() {
  return <ProfileScreen />;
}
