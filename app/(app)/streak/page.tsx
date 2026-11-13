import type { Metadata } from "next";
import { StreakScreen } from "@/components/screens/streak-screen";

export const metadata: Metadata = { title: "Streak · RozFit" };

export default function Page() {
  return <StreakScreen />;
}
