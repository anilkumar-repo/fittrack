import { Suspense } from "react";
import type { Metadata } from "next";
import { TogetherTabs } from "@/components/app/together-tabs";
import { FeedScreen } from "@/components/screens/feed-screen";

export const metadata: Metadata = { title: "Feed · RozFit" };

export default function Page() {
  return <><TogetherTabs /><Suspense><FeedScreen /></Suspense></>;
}
