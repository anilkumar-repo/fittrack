import type { Metadata } from "next";
import { ChatsScreen } from "@/components/screens/chats-screen";

export const metadata: Metadata = { title: "Chats · RozFit" };

export default function Page() {
  return <ChatsScreen />;
}
