import type { Metadata } from "next";
import { ChatThread } from "@/components/screens/chat-thread";

export const metadata: Metadata = { title: "Chat · RozFit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatThread chatId={id} />;
}
