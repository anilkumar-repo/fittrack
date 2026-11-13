import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsScreen } from "@/components/screens/friends-screen";

export const metadata: Metadata = { title: "Friends · RozFit" };

export default function Page() {
  return <Suspense><FriendsScreen /></Suspense>;
}
