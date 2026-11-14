import type { Metadata } from "next";
import { InstallScreen } from "@/components/screens/install-screen";

export const metadata: Metadata = { title: "Install the app · RozFit" };

export default function Page() {
  return <InstallScreen />;
}
