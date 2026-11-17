import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportScreen } from "@/components/screens/report-screen";

export const metadata: Metadata = { title: "Your week · RozFit" };

export default function Page() {
  return <Suspense><ReportScreen /></Suspense>;
}
