import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/screens/settings-screen";

export const metadata: Metadata = { title: "Settings · RozFit" };

export default function Page() {
  return <Suspense><SettingsScreen /></Suspense>;
}
