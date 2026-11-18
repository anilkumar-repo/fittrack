import type { Metadata } from "next";
import { ClientsScreen } from "@/components/screens/clients-screen";

export const metadata: Metadata = { title: "My clients · RozFit" };

export default function Page() {
  return <ClientsScreen />;
}
