import type { Metadata } from "next";
import { Suspense } from "react";
import { MobilityScreen } from "@/components/screens/mobility-screen";

export const metadata: Metadata = { title: "Stretch & mobility · RozFit" };

export default function Page() {
  return <Suspense><MobilityScreen /></Suspense>;
}
