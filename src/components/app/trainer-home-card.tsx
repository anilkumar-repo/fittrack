"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Dumbbell, X } from "lucide-react";
import { Avatar } from "./avatar";
import { useFitTrack } from "./fit-track-provider";
import { shiftDate, shortDate } from "@/lib/dates";
import { loadMyTrainers } from "@/lib/supabase-repository";
import { loadTrainerMessages, loadTrainerRequests, type TrainerMessage } from "@/lib/trainers-repository";

const DISMISSED_KEY = "rozfit-dismissed-trainer-messages";

function readDismissed(): Set<string> {
  try { return new Set(JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}

/**
 * Home, for clients: messages from their trainers in the last 14 days (tap × to hide one on this phone).
 * Home, for trainers: a shortcut to My clients, with how many requests are waiting.
 */
export function TrainerHomeCard() {
  const { state, isDemo, browserClient, currentDate } = useFitTrack();
  const trainer = state.profile.trainerRole;
  const [messages, setMessages] = useState<Array<TrainerMessage & { name: string; avatar?: string }>>([]);
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    if (isDemo || !browserClient) return;
    let live = true;
    if (trainer) {
      loadTrainerRequests(browserClient).then((list) => { if (live) setRequests(list.length); }).catch(() => undefined);
    } else if (state.trainerLinked) {
      Promise.all([loadTrainerMessages(browserClient, `${shiftDate(currentDate, -14)}T00:00:00Z`), loadMyTrainers(browserClient).catch(() => [])]).then(([list, trainers]) => {
        if (!live) return;
        const dismissed = readDismissed();
        const byId = new Map(trainers.map((item) => [item.id, item]));
        setMessages(list.filter((item) => !dismissed.has(item.id)).slice(0, 3).map((item) => ({ ...item, name: byId.get(item.trainerId)?.name ?? "Your trainer", ...(byId.get(item.trainerId)?.avatar ? { avatar: byId.get(item.trainerId)!.avatar } : {}) })));
      });
    }
    return () => { live = false; };
  }, [isDemo, browserClient, trainer, state.trainerLinked, currentDate]);

  function dismiss(id: string) {
    const dismissed = readDismissed();
    dismissed.add(id);
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed].slice(-60))); } catch { /* hidden for this visit only */ }
    setMessages((list) => list.filter((item) => item.id !== id));
  }

  if (isDemo || !browserClient) return null;
  if (trainer) {
    const clients = state.trainerClients?.length ?? 0;
    return (
      <Link href="/clients" className="panel trainer-home-link">
        <span className="trainer-home-icon"><Dumbbell aria-hidden="true" /></span>
        <span><strong>My clients</strong><small>{clients} {clients === 1 ? "client" : "clients"}{requests ? ` · ${requests} ${requests === 1 ? "request" : "requests"} waiting` : ""}</small></span>
        {requests > 0 && <span className="trainer-home-badge">{requests}</span>}
        <ArrowRight aria-hidden="true" />
      </Link>
    );
  }
  if (!messages.length) return null;
  return (
    <article className="panel trainer-messages" id="trainer-messages" aria-label="Messages from your trainer">
      {messages.map((item) => (
        <div key={item.id} className="trainer-message">
          <Avatar value={item.avatar} name={item.name} size={38} />
          <div><strong>{item.name}</strong><small>{shortDate(item.at.slice(0, 10))}</small><p>{item.body}</p></div>
          <button type="button" className="icon-button" aria-label="Hide this message" onClick={() => dismiss(item.id)}><X aria-hidden="true" /></button>
        </div>
      ))}
    </article>
  );
}
