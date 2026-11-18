import type { Metadata } from "next";
import { DiscoverScreen } from "@/components/screens/discover-screen";

export const metadata: Metadata = { title: "Find friends · RozFit" };

export default function Page() {
  return <DiscoverScreen />;
}
