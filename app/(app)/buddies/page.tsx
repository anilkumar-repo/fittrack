import type { Metadata } from "next";
import { TogetherTabs } from "@/components/app/together-tabs";
import { BuddiesScreen } from "@/components/screens/buddies-screen";

export const metadata: Metadata = { title: "Train together · RozFit" };

export default function Page() {
  return <><TogetherTabs /><BuddiesScreen /></>;
}
