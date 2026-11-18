"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { openBuddyChat, openDirectChat } from "@/lib/chats-repository";

/** "Message": opens the 1:1 chat with a friend, trainer or client (or, with `group`, your Train together chat). */
export function MessageButton({ userId, group = false, label = "Message", className = "button button-subtle small" }: { userId?: string; group?: boolean; label?: string; className?: string }) {
  const { isDemo, browserClient, setNotice } = useFitTrack();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (isDemo || !browserClient || (!userId && !group)) return null;
  return (
    <button type="button" className={`${className} message-button`} disabled={busy} onClick={async () => {
      setBusy(true);
      try { router.push(`/chats/${group ? await openBuddyChat(browserClient) : await openDirectChat(browserClient, userId!)}`); }
      catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t work. Try again."); setBusy(false); }
    }}><MessageCircle aria-hidden="true" /> {label}</button>
  );
}
