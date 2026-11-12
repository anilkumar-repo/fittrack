import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/settings-screen";

export const metadata: Metadata = { title: "Settings · FitTrack" };

export default function Page() {
  return <SettingsScreen />;
}
