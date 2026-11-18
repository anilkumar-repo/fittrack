import type { Metadata } from "next";
import { PersonScreen } from "@/components/screens/discover-screen";

export const metadata: Metadata = { title: "Profile · RozFit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PersonScreen userId={id} />;
}
