import type { Metadata } from "next";
import { BuddiesScreen } from "@/components/screens/buddies-screen";

export const metadata: Metadata = { title: "Train together · RozFit" };

export default function Page() {
  return <BuddiesScreen />;
}
