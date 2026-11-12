import type { Metadata } from "next";
import { ProgressScreen } from "@/components/screens/progress-screen";

export const metadata: Metadata = { title: "Progress · FitTrack" };

export default function Page() {
  return <ProgressScreen />;
}
