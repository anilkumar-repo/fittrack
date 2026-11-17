import type { Metadata } from "next";
import { RecoveryScreen } from "@/components/screens/recovery-screen";

export const metadata: Metadata = { title: "Recovery · RozFit" };

export default function Page() {
  return <RecoveryScreen />;
}
