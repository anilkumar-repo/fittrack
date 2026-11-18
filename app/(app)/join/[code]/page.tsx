import type { Metadata } from "next";
import { JoinScreen } from "@/components/screens/join-screen";

export const metadata: Metadata = { title: "Add your trainer · RozFit" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinScreen code={code} />;
}
