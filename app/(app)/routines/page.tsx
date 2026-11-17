import type { Metadata } from "next";
import { RoutinesScreen } from "@/components/screens/routines-screen";

export const metadata: Metadata = { title: "My routines · RozFit" };

export default function Page() {
  return <RoutinesScreen />;
}
