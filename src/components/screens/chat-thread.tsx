"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, Bell, BellOff, Ban, Dumbbell, Flag, Send, Smile, Trash2 } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { Rozi } from "@/components/app/rozi";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { EmptyState } from "@/components/ui/empty-state";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { dayLabel, isSticker, localDay, MESSAGE_MAX, readWorkoutCard, startsGroup, STICKERS, textProblem, workoutCard } from "@/lib/chats";
import {
  deleteMessage, loadChatPeople, loadChats, loadMessages, markChatRead, reportMessage, sendMessage, setChatBlock, setChatMuted, subscribeToMessages,
  type ChatMessage, type ChatPerson, type ChatReportReason, type ChatSummary,
} from "@/lib/chats-repository";
import { CHATS_CHANGED, ChatAvatar, WorkoutCardView } from "./chats-screen";

const PAGE = 50;
/** Marks the chat read, then lets the unread badges update. */
const readNow = (client: Parameters<typeof markChatRead>[0], chatId: string) => markChatRead(client, chatId).then(() => window.dispatchEvent(new Event(CHATS_CHANGED))).catch(() => undefined);
/** The time on a bubble (the day is in the divider above). */
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const REPORT_REASONS: Array<{ id: ChatReportReason; label: string }> = [
  { id: "harassment", label: "Harassment or bullying" }, { id: "inappropriate", label: "Inappropriate" }, { id: "spam", label: "Spam" },
  { id: "unsafe", label: "Unsafe advice" }, { id: "other", label: "Something else" },
];

/** One chat: messages (live), stickers, workout cards; delete your own, report others'; mute and block. */
export function ChatThread({ chatId }: { chatId: string }) {
  const { state, isDemo, browserClient, currentDate, setNotice, weightUnit } = useFitTrack();
  const me = state.profile.id;
  const [chat, setChat] = useState<ChatSummary | null | undefined>(undefined);
  const [people, setPeople] = useState<Map<string, ChatPerson>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"" | "stickers" | "workouts" | "menu">("");
  const [acting, setActing] = useState<ChatMessage | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const load = useCallback(async () => {
    if (!browserClient) return;
    try {
      const [list, found, who] = await Promise.all([loadChats(browserClient), loadMessages(browserClient, chatId, undefined, PAGE), loadChatPeople(browserClient, chatId)]);
      setChat(list?.find((item) => item.id === chatId) ?? null);
      setMessages(found); setMore(found.length === PAGE); setPeople(who);
      void readNow(browserClient, chatId);
    } catch { setChat(null); }
  }, [browserClient, chatId]);

  useEffect(() => {
    if (isDemo || !browserClient) return;
    const timer = window.setTimeout(() => void load(), 0);
    // Live: new messages appear, deleted ones change; reading while open keeps the chat marked read.
    const stop = subscribeToMessages(browserClient, (message, event) => {
      setMessages((list) => event === "INSERT"
        ? (list.some((item) => item.id === message.id) ? list : [...list, message])
        : list.map((item) => item.id === message.id ? message : item));
      if (event === "INSERT" && message.senderId !== me && document.visibilityState === "visible") void readNow(browserClient, chatId);
      if (event === "INSERT" && !people.has(message.senderId)) void loadChatPeople(browserClient, chatId).then(setPeople).catch(() => undefined);
    }, chatId);
    return () => { window.clearTimeout(timer); stop(); };
  }, [isDemo, browserClient, chatId, load, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the newest message in view unless you've scrolled up to read older ones.
  useEffect(() => {
    if (stickToBottom.current) listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    const onScroll = () => { stickToBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function older() {
    if (!browserClient || !messages.length) return;
    stickToBottom.current = false;
    const page = await loadMessages(browserClient, chatId, messages[0].at, PAGE).catch(() => []);
    setMessages((list) => [...page.filter((item) => !list.some((existing) => existing.id === item.id)), ...list]);
    setMore(page.length === PAGE);
  }

  async function send(kind: ChatMessage["kind"], body: string, payload?: Parameters<typeof sendMessage>[4]) {
    if (!browserClient || busy) return false;
    setBusy(true); setError("");
    try {
      const sent = await sendMessage(browserClient, chatId, kind, body, payload);
      stickToBottom.current = true;
      setMessages((list) => list.some((item) => item.id === sent.id) ? list : [...list, sent]);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t send. Try again."); return false; }
    finally { setBusy(false); }
  }

  async function sendText() {
    const problem = textProblem(text);
    if (problem) { setError(problem); return; }
    if (await send("text", text)) setText("");
  }

  async function toggleMute() {
    if (!browserClient || !chat) return;
    try { await setChatMuted(browserClient, chatId, !chat.muted); setChat({ ...chat, muted: !chat.muted }); setNotice(chat.muted ? "Notifications on for this chat." : "Chat muted. You won’t get notifications for it."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t work."); }
    setPanel("");
  }

  async function toggleBlock() {
    if (!browserClient || !chat?.otherId) return;
    if (!chat.blocked && !window.confirm(`Block ${chat.title}? Neither of you can message the other, and their messages in group chats are hidden for you. You can unblock any time.`)) return;
    try { await setChatBlock(browserClient, chat.otherId, !chat.blocked); setNotice(chat.blocked ? `${chat.title} is unblocked.` : `${chat.title} is blocked.`); await load(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t work."); }
    setPanel("");
  }

  const recent = useMemo(() => state.sessions.filter((session) => session.status === "completed").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [state.sessions]);

  if (isDemo || !browserClient) return <section className="chat-page"><EmptyState mood="chat-hello" title="Sign in to chat" text="Chats live in your account." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (chat === undefined) return <section className="chat-page"><p className="card-note" role="status">Loading the chat…</p></section>;
  if (chat === null) return <section className="chat-page"><EmptyState mood="grumpy" title="Chat not found" text="It may have ended (for example, the Train together group closed)." action={{ label: "All chats", href: "/chats" }} /></section>;

  const today = currentDate;
  return (
    <section className="chat-page">
      <header className="chat-head">
        <Link href="/chats" className="icon-button" aria-label="All chats"><ArrowLeft aria-hidden="true" /></Link>
        <ChatAvatar chat={chat} size={40} me={me} />
        <span className="chat-head-text"><strong>{chat.title}</strong><small>{chat.kind === "buddy" ? chat.members.map((member) => member.id === me ? "You" : member.name.split(" ")[0]).join(", ") : chat.blocked ? "Blocked" : chat.muted ? "Muted" : ""}</small></span>
        <button type="button" className="icon-button" aria-label="Chat options" aria-expanded={panel === "menu"} onClick={() => setPanel(panel === "menu" ? "" : "menu")}>···</button>
        {panel === "menu" && <div className="chat-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => void toggleMute()}>{chat.muted ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />} {chat.muted ? "Unmute" : "Mute notifications"}</button>
          {chat.kind === "direct" && chat.otherId && <button type="button" role="menuitem" className="danger-text" onClick={() => void toggleBlock()}><Ban aria-hidden="true" /> {chat.blocked ? "Unblock" : "Block"} {chat.title.split(" ")[0]}</button>}
        </div>}
      </header>

      <div className="chat-messages" aria-live="polite">
        {more && <button type="button" className="text-button chat-older" onClick={() => void older()}>Show earlier messages</button>}
        {!messages.length && <div className="chat-empty"><Rozi mood="chat-hello" size={110} eager /><p>Say hi to {chat.kind === "buddy" ? "your training group" : chat.title.split(" ")[0]} 👋</p></div>}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const day = localDay(message.at);
          const newDay = !previous || localDay(previous.at) !== day;
          const mine = message.senderId === me;
          const first = newDay || startsGroup(previous && { senderId: previous.senderId, at: previous.at }, { senderId: message.senderId, at: message.at });
          const who = people.get(message.senderId);
          const card = message.kind === "workout" ? readWorkoutCard(message.payload) : null;
          const sticker = message.kind === "sticker" && isSticker(message.payload?.mood) ? message.payload?.mood as (typeof STICKERS)[number]["mood"] : null;
          return (
            <div key={message.id}>
              {newDay && <p className="chat-day">{dayLabel(day, today)}</p>}
              <div className={`chat-line ${mine ? "mine" : "theirs"} ${first ? "first" : ""}`}>
                {!mine && chat.kind === "buddy" && <span className="chat-line-face">{first && <Avatar value={who?.avatar} name={who?.name ?? "?"} size={30} />}</span>}
                <button type="button" className={`msg-bubble kind-${message.deleted ? "deleted" : message.kind}`} disabled={message.deleted} onClick={() => setActing(message)} aria-label={`${mine ? "Your" : `${who?.name ?? "Their"}`} message, ${clock(message.at)}. Options`}>
                  {!mine && chat.kind === "buddy" && first && <span className="chat-sender">{who?.name.split(" ")[0] ?? "Someone"}</span>}
                  {message.deleted ? <em>Message deleted</em>
                    : sticker ? <Rozi mood={sticker} size={110} motion={false} />
                    : card ? <WorkoutCardView card={card} note={message.body} unit={weightUnit} />
                    : <span className="chat-text">{message.body}</span>}
                  <time>{clock(message.at)}</time>
                </button>
              </div>
            </div>
          );
        })}
        <div ref={listEnd} className="chat-end" />
      </div>

      {chat.canSend ? <div className="chat-composer">
        {panel === "stickers" && <div className="chat-stickers" role="listbox" aria-label="Rozi stickers">{STICKERS.map((item) => (
          <button key={item.mood} type="button" role="option" aria-selected={false} aria-label={item.label} disabled={busy} onClick={async () => { if (await send("sticker", "", { mood: item.mood })) setPanel(""); }}><Rozi mood={item.mood} size={64} motion={false} /></button>
        ))}</div>}
        {panel === "workouts" && <div className="chat-workouts">{recent.length ? recent.map((session) => {
          const card = workoutCard(session, state.sessions);
          return card ? <button key={session.id} type="button" className="convo-row" disabled={busy} onClick={async () => { if (await send("workout", "", card)) setPanel(""); }}>
            <Dumbbell aria-hidden="true" /><span className="convo-row-text"><strong>{card.title}</strong><small>{dayLabel(session.date, today)} · {card.totalSets} sets{card.prs.length ? ` · ${card.prs.length} new best` : ""}</small></span><Send aria-hidden="true" className="chat-send-icon" />
          </button> : null;
        }) : <p className="card-note">Finish a workout to share it here.</p>}</div>}
        <div className="chat-compose-row">
          <button type="button" className={`icon-button ${panel === "stickers" ? "on" : ""}`} aria-label="Rozi stickers" aria-expanded={panel === "stickers"} onClick={() => setPanel(panel === "stickers" ? "" : "stickers")}><Smile aria-hidden="true" /></button>
          <button type="button" className={`icon-button ${panel === "workouts" ? "on" : ""}`} aria-label="Share a workout" aria-expanded={panel === "workouts"} onClick={() => setPanel(panel === "workouts" ? "" : "workouts")}><Dumbbell aria-hidden="true" /></button>
          <label className="msg-input"><span className="sr-only">Message</span>
            <textarea rows={1} value={text} maxLength={MESSAGE_MAX + 100} placeholder="Message" onChange={(event) => { setText(event.target.value); setError(""); }}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendText(); } }} />
          </label>
          <button type="button" className="button button-primary chat-send" aria-label="Send" disabled={busy || !text.trim()} onClick={() => void sendText()}><Send aria-hidden="true" /></button>
        </div>
        {error && <p role="alert" className="form-error">{error}</p>}
      </div> : <p className="chat-cant-send">{chat.blocked ? `You blocked ${chat.title}. Unblock them from the ··· menu to message again.` : `You can’t message ${chat.title} right now — you’re no longer friends or linked as trainer and client.`}</p>}

      {acting && <MessageSheet message={acting} mine={acting.senderId === me} onClose={() => setActing(null)} onDeleted={(id) => setMessages((list) => list.map((item) => item.id === id ? { ...item, deleted: true, body: "", payload: null } : item))} />}
    </section>
  );
}

/** Tap a message: delete it (yours) or report it (someone else's). */
function MessageSheet({ message, mine, onClose, onDeleted }: { message: ChatMessage; mine: boolean; onClose: () => void; onDeleted: (id: string) => void }) {
  const { browserClient, setNotice } = useFitTrack();
  useScrollLock();
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!browserClient || busy) return;
    setBusy(true);
    try { if (await deleteMessage(browserClient, message.id)) onDeleted(message.id); setNotice("Message deleted."); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work."); setBusy(false); }
  }
  async function report() {
    if (!browserClient || busy || !reason) return;
    setBusy(true);
    try { await reportMessage(browserClient, message.id, reason, note); setNotice("Thanks — the message was reported. You can also block this person from the ··· menu."); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work."); setBusy(false); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Message options" onClick={onClose}>
      <section className="modal chat-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        {mine ? <>
          <h2>Your message</h2>
          <p className="card-note">Delete it for everyone in the chat? It shows as “Message deleted”.</p>
          <button type="button" className="button button-subtle full-width danger-text" disabled={busy} onClick={() => void remove()}><Trash2 aria-hidden="true" /> Delete message</button>
        </> : <>
          <h2>Report this message</h2>
          <div className="chip-row">{REPORT_REASONS.map((item) => <button key={item.id} type="button" className={`chip ${reason === item.id ? "chip-on" : ""}`} aria-pressed={reason === item.id} onClick={() => setReason(item.id)}>{item.label}</button>)}</div>
          <label className="field-label">More details <small className="field-hint">optional</small><textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button type="button" className="button button-primary full-width" disabled={busy || !reason} onClick={() => void report()}><Flag aria-hidden="true" /> Report</button>
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}
