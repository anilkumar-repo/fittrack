import type { Metadata } from "next";
import { TogetherTabs } from "@/components/app/together-tabs";
import { ChatsScreen } from "@/components/screens/chats-screen";

export const metadata: Metadata = { title: "Chats · RozFit" };

export default function Page() {
  return <><TogetherTabs /><ChatsScreen /></>;
}
