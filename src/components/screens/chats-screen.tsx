"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { BellOff, Dumbbell, MessageCirclePlus, Send, Trophy, Users } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { EmptyState } from "@/components/ui/empty-state";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { messagePreview, workoutCard, type WorkoutCard } from "@/lib/chats";
import {
  loadChats, loadContacts, openBuddyChat, openDirectChat, sendMessage, subscribeToMessages, unreadTotal,
  type ChatSummary, type Contact,
} from "@/lib/chats-repository";
import { formatWeight } from "@/lib/logging";
import type { WorkoutSession } from "@/lib/types";

/** Fired after reading a chat, so every unread badge updates at once. */
export const CHATS_CHANGED = "rozfit-chats-changed";

const ROLE_LABEL: Record<Contact["role"], string> = { friend: "Friend", trainer: "Your trainer", client: "Your client" };

/** "10:24" today, "Mon" this week, otherwise "Nov 3". */
export function chatTime(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  const now = new Date();
  if (at.toDateString() === now.toDateString()) return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (now.getTime() - at.getTime() < 6 * 86_400_000) return at.toLocaleDateString([], { weekday: "short" });
  return at.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Your chats, kept fresh: reloads when any of your chats gets a message, and when the app comes back to the front. */
export function useChats() {
  const { isDemo, browserClient } = useFitTrack();
  const [chats, setChats] = useState<ChatSummary[] | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (isDemo || !browserClient) { setChats(null); return; }
    try { setChats(await loadChats(browserClient)); } catch { setChats(null); }
  }, [isDemo, browserClient]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    if (isDemo || !browserClient) return () => window.clearTimeout(timer);
    let pending = 0;
    const soon = () => { window.clearTimeout(pending); pending = window.setTimeout(() => void refresh(), 400); };
    const stop = subscribeToMessages(browserClient, soon);
    const onShow = () => { if (document.visibilityState === "visible") soon(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener(CHATS_CHANGED, soon);
    return () => { window.clearTimeout(timer); window.clearTimeout(pending); stop(); document.removeEventListener("visibilitychange", onShow); window.removeEventListener(CHATS_CHANGED, soon); };
  }, [isDemo, browserClient, refresh]);
  return { chats, refresh, unread: unreadTotal(chats ?? null) };
}

/** A group chat's picture: two of the other members' faces, overlapping. */
function GroupFaces({ chat, size = 48, me }: { chat: ChatSummary; size?: number; me?: string }) {
  const others = chat.members.filter((member) => member.id !== me);
  const faces = (others.length ? others : chat.members).slice(0, 2);
  if (!faces.length) return <span className="chat-group-icon" style={{ width: size, height: size }}><Users aria-hidden="true" /></span>;
  return <span className="chat-faces" style={{ width: size, height: size }}>{faces.map((member) => <Avatar key={member.id} value={member.avatar} name={member.name} size={Math.round(size * 0.62)} />)}</span>;
}

export function ChatAvatar({ chat, size = 48, me }: { chat: ChatSummary; size?: number; me?: string }) {
  return chat.kind === "buddy" ? <GroupFaces chat={chat} size={size} me={me} /> : <Avatar value={chat.avatar} name={chat.title} size={size} />;
}

/**
 * Chats: your Train together group chat and your 1:1 chats with friends, your trainer and your clients, newest first,
 * with unread counts. "New chat" starts one with anyone you can message.
 */
export function ChatsScreen() {
  const { state, isDemo, browserClient, setNotice } = useFitTrack();
  const router = useRouter();
  const { chats } = useChats();
  const [picking, setPicking] = useState(false);
  const me = state.profile.id;
  const hasGroupChat = (chats ?? []).some((chat) => chat.kind === "buddy");

  async function openGroup() {
    if (!browserClient) return;
    try { router.push(`/chats/${await openBuddyChat(browserClient)}`); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t work. Try again."); }
  }

  if (isDemo || !browserClient) return <section className="chats-page"><EmptyState mood="chat-hello" title="Sign in to chat" text="Message your friends, your Train together group and your trainer — with Rozi stickers and workout cards." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (chats === undefined) return <section className="chats-page"><p className="card-note" role="status">Loading your chats…</p></section>;
  if (chats === null) return <section className="chats-page"><EmptyState mood="chat-thinking" title="Almost ready" text="Chats need the latest update. Please check back soon." /></section>;

  return (
    <section className="chats-page">
      <div className="chats-head">
        <p>{chats.length ? `${chats.length} ${chats.length === 1 ? "chat" : "chats"}` : "No chats yet"}</p>
        <button type="button" className="button button-primary small" onClick={() => setPicking(true)}><MessageCirclePlus aria-hidden="true" /> New chat</button>
      </div>
      {state.profile.buddyAnchor && !hasGroupChat && <button type="button" className="panel chat-row chat-start-group" onClick={() => void openGroup()}>
        <span className="chat-group-icon"><Users aria-hidden="true" /></span>
        <span className="chat-row-text"><strong>Train together</strong><small>Start your group chat</small></span>
      </button>}
      {chats.length ? <ul className="panel chat-list">{chats.map((chat) => {
        const sender = chat.kind === "buddy" ? chat.members.find((member) => member.id === chat.last?.senderId)?.name : undefined;
        return (
          <li key={chat.id}>
            <Link href={`/chats/${chat.id}`} className={`chat-row ${chat.unread && !chat.muted ? "unread" : ""}`}>
              <ChatAvatar chat={chat} me={me} />
              <span className="chat-row-text">
                <strong>{chat.title}{chat.muted && <BellOff className="chat-muted" aria-label="Muted" />}</strong>
                <small>{chat.blocked ? "Blocked" : messagePreview(chat.last, me, sender)}</small>
              </span>
              <span className="chat-row-meta">
                <time>{chatTime(chat.last?.at ?? chat.lastAt)}</time>
                {chat.unread > 0 && <span className={`chat-badge ${chat.muted ? "muted" : ""}`} aria-label={`${chat.unread} unread`}>{chat.unread > 99 ? "99+" : chat.unread}</span>}
              </span>
            </Link>
          </li>
        );
      })}</ul> : !state.profile.buddyAnchor && <div className="panel"><EmptyState mood="chat-hello" title="Say hi to someone" text="Start a chat with a friend, your trainer or a client. Train together groups get their own chat." action={{ label: "New chat", onClick: () => setPicking(true) }} /></div>}
      {picking && <NewChatSheet onClose={() => setPicking(false)} />}
    </section>
  );
}

/** Pick a friend, trainer or client to message. */
function NewChatSheet({ onClose }: { onClose: () => void }) {
  const { browserClient } = useFitTrack();
  const router = useRouter();
  useScrollLock();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!browserClient) return;
    loadContacts(browserClient).then(setContacts).catch((cause) => { setContacts([]); setError(cause instanceof Error ? cause.message : "Couldn’t load your contacts."); });
  }, [browserClient]);

  async function open(contact: Contact) {
    if (!browserClient || busy) return;
    setBusy(contact.id);
    try { const id = await openDirectChat(browserClient, contact.id); onClose(); router.push(`/chats/${id}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work. Try again."); setBusy(""); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New chat" onClick={onClose}>
      <section className="modal chat-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>New chat</h2>
        {contacts === null ? <p role="status" className="card-note">Loading…</p> : contacts.length ? <ul className="chat-contacts">{contacts.map((contact) => (
          <li key={contact.id}><button type="button" className="chat-row" disabled={Boolean(busy)} onClick={() => void open(contact)}>
            <Avatar value={contact.avatar} name={contact.name} size={44} />
            <span className="chat-row-text"><strong>{contact.name}</strong><small>{ROLE_LABEL[contact.role]}</small></span>
          </button></li>
        ))}</ul> : <p className="card-note">You can message friends, your trainer and your clients. Add friends from the <Link href="/friends" onClick={onClose}>Friends</Link> page.</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}

/** A "share my workout" card, in a chat or in the share sheet. */
export function WorkoutCardView({ card, note, unit }: { card: WorkoutCard; note?: string; unit: "kg" | "lb" }) {
  return (
    <div className="workout-card">
      <div className="workout-card-head"><Dumbbell aria-hidden="true" /><span><strong>{card.title}</strong><small>{card.totalSets} sets{card.durationMinutes ? ` · ${card.durationMinutes} min` : ""}</small></span></div>
      <ul>{card.exercises.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`}><span>{exercise.name}{card.prs.includes(exercise.name) && <Trophy className="workout-card-pr" aria-label="New personal best" />}</span>
          <small>{exercise.sets} × {exercise.reps || "—"}{exercise.topKg ? ` · ${formatWeight(exercise.topKg, unit)}` : ""}</small></li>
      ))}</ul>
      {card.prs.length > 0 && <p className="workout-card-prs"><Trophy aria-hidden="true" /> New best: {card.prs.join(", ")}</p>}
      {note && <p className="workout-card-note">{note}</p>}
    </div>
  );
}

/** From a finished workout: pick a chat and send the workout card (with an optional note). */
export function ShareWorkoutSheet({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const { state, browserClient, setNotice, weightUnit } = useFitTrack();
  const { chats } = useChats();
  useScrollLock();
  const card = useMemo(() => workoutCard(session, state.sessions), [session, state.sessions]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const usable = (chats ?? []).filter((chat) => chat.canSend);

  async function send(chat: ChatSummary) {
    if (!browserClient || !card || busy) return;
    setBusy(true); setError("");
    try { await sendMessage(browserClient, chat.id, "workout", note.trim(), card); setNotice(`Shared with ${chat.title}.`); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t send. Try again."); setBusy(false); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Share your workout" onClick={onClose}>
      <section className="modal chat-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Share your workout</h2>
        {!card ? <p className="card-note">Finish at least one set to share this workout.</p> : <>
          <WorkoutCardView card={card} unit={weightUnit} />
          <label className="field-label">Add a note <small className="field-hint">optional</small><input type="text" maxLength={500} value={note} placeholder="e.g. New bench PR 💪" onChange={(event) => setNote(event.target.value)} /></label>
          {chats === undefined ? <p role="status" className="card-note">Loading your chats…</p> : usable.length ? <ul className="chat-contacts">{usable.map((chat) => (
            <li key={chat.id}><button type="button" className="chat-row" disabled={busy} onClick={() => void send(chat)}>
              <ChatAvatar chat={chat} size={44} me={state.profile.id} />
              <span className="chat-row-text"><strong>{chat.title}</strong><small>{chat.kind === "buddy" ? "Your Train together group" : "Send to this chat"}</small></span>
              <Send aria-hidden="true" className="chat-send-icon" />
            </button></li>
          ))}</ul> : <p className="card-note">No chats yet. Start one from <Link href="/chats" onClick={onClose}>Chats</Link> first.</p>}
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}
