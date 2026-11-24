import type { Metadata } from "next";
import { TogetherTabs } from "@/components/app/together-tabs";
import { Suspense } from "react";
import { FriendsScreen } from "@/components/screens/friends-screen";

export const metadata: Metadata = { title: "Friends · RozFit" };

export default function Page() {
  return <><TogetherTabs /><Suspense><FriendsScreen /></Suspense></>;
}
