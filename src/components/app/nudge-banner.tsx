"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markNudgesSeen } from "@/lib/friends-repository";
import type { Nudge } from "@/lib/friends";
import { useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

/** Shows nudges friends sent, newest first, until you tap "Thanks". Signed-in accounts only. */
export function NudgeBanner() {
  const { state, isDemo, browserClient } = useFitTrack();
  const [nudges, setNudges] = useState<Array<Nudge & { name: string }>>([]);
  const userId = state.profile.id;

  useEffect(() => {
    if (isDemo || !browserClient || !userId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await browserClient.from("nudges").select("*").eq("to_user", userId).is("seen_at", null).order("created_at", { ascending: false }).limit(5);
      if (error || !data?.length || cancelled) return;
      const senders = [...new Set(data.map((row) => String(row.from_user)))];
      const { data: names } = await browserClient.from("friend_stats").select("user_id, display_name").in("user_id", senders);
      const nameOf = new Map((names ?? []).map((row) => [String(row.user_id), String(row.display_name)]));
      if (!cancelled) setNudges(data.map((row) => ({
        id: String(row.id), fromUser: String(row.from_user), toUser: String(row.to_user), message: String(row.message ?? ""),
        sentOn: String(row.sent_on), seenAt: null, name: nameOf.get(String(row.from_user)) ?? "A friend",
      })));
    })();
    return () => { cancelled = true; };
  }, [isDemo, browserClient, userId]);

  if (!nudges.length) return null;
  const names = [...new Set(nudges.map((nudge) => nudge.name))];
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return (
    <aside className="nudge-banner" role="status">
      <Rozi mood="cheer" size={56} />
      <div><strong>{who} nudged you!</strong><span>{nudges[0].message || "Time to train!"}</span></div>
      <Link className="button button-primary small" href="/today">Let’s go</Link>
      <button type="button" className="text-button" onClick={() => {
        const ids = nudges.map((nudge) => nudge.id);
        setNudges([]);
        if (browserClient) void markNudgesSeen(browserClient, ids).catch(() => undefined);
      }}>Thanks</button>
    </aside>
  );
}
