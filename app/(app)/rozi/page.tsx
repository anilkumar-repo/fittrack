import type { Metadata } from "next";
import { RoziChatScreen } from "@/components/screens/rozi-chat-screen";

export const metadata: Metadata = { title: "Ask Rozi · RozFit" };

export default function Page() {
  return <RoziChatScreen />;
}
