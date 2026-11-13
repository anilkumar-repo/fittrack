import type { Metadata } from "next";
import { ProgressScreen } from "@/components/screens/progress-screen";

export const metadata: Metadata = { title: "Progress · RozFit" };

export default function Page() {
  return <ProgressScreen />;
}
