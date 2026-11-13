import type { Metadata } from "next";
import { OverviewScreen } from "@/components/screens/overview-screen";

export const metadata: Metadata = { title: "Home · RozFit" };

export default function Page() {
  return <OverviewScreen />;
}
