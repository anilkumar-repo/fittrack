import type { Metadata } from "next";
import { Suspense } from "react";
import { TodayScreen } from "@/components/screens/today-screen";

export const metadata: Metadata = { title: "Today’s workout · FitTrack" };

export default function Page() {
  // The workout date comes from the address (?date=YYYY-MM-DD), which is only known in the browser.
  return <Suspense fallback={<div className="empty-inline" role="status">Loading your workout…</div>}><TodayScreen /></Suspense>;
}
