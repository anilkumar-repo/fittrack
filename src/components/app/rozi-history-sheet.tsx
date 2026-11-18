"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MessageCircle, Trash2 } from "lucide-react";
import { deleteAllConversations, deleteConversation, listConversations, type RoziConversationSummary } from "@/lib/rozi-ai/history";
import { shortDate } from "@/lib/dates";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";

/** "Today", "Yesterday" or a short date, in the person's time zone. */
function when(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  if (day === today) return "Today";
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return day === yesterday.toISOString().slice(0, 10) ? "Yesterday" : shortDate(day);
}

/** Past Rozi AI chats: open one, delete one, or delete them all. */
export function RoziHistorySheet({ client, today, currentId, onOpen, onDeleted, onClose }: {
  client: SupabaseClient;
  today: string;
  currentId: string | null;
  onOpen: (id: string) => void;
  /** A conversation (or, with null, all of them) was deleted. */
  onDeleted: (id: string | null) => void;
  onClose: () => void;
}) {
  useScrollLock();
  const [items, setItems] = useState<RoziConversationSummary[] | null | "loading">("loading");
  const [busy, setBusy] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listConversations(client).then((list) => { if (!cancelled) setItems(list); });
    return () => { cancelled = true; };
  }, [client]);

  async function remove(id: string) {
    setBusy(id);
    if (await deleteConversation(client, id)) {
      setItems((current) => (Array.isArray(current) ? current.filter((item) => item.id !== id) : current));
      onDeleted(id);
    }
    setBusy("");
  }

  async function removeAll() {
    setBusy("all");
    const count = await deleteAllConversations(client);
    if (count !== null) { setItems([]); onDeleted(null); }
    setBusy("");
    setConfirmAll(false);
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Rozi chat history" onClick={onClose}>
      <section className="modal chat-sheet rozi-history" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Your chats with Rozi</h2>
        <p className="card-note">Saved to your account for 180 days. Only you can see them.</p>
        {items === "loading" && <p className="loading-inline" role="status">Loading…</p>}
        {items === null && <p className="card-note">Chat history isn’t available yet.</p>}
        {Array.isArray(items) && items.length === 0 && <p className="card-note">No saved chats yet. Ask Rozi something to start one.</p>}
        {Array.isArray(items) && items.length > 0 && <ul className="rozi-history-list">
          {items.map((item) => (
            <li key={item.id} className={item.id === currentId ? "current" : ""}>
              <button type="button" className="rozi-history-open" onClick={() => onOpen(item.id)}>
                <MessageCircle aria-hidden="true" />
                <span><strong>{item.title}</strong><small>{when(item.updatedAt, today)} · {item.messages} {item.messages === 1 ? "message" : "messages"}{item.id === currentId ? " · open now" : ""}</small></span>
              </button>
              <button type="button" className="icon-button" aria-label={`Delete “${item.title}”`} disabled={busy === item.id} onClick={() => void remove(item.id)}><Trash2 aria-hidden="true" /></button>
            </li>
          ))}
        </ul>}
        {Array.isArray(items) && items.length > 0 && (confirmAll
          ? <div className="rozi-history-confirm"><span>Delete all {items.length} saved chats? This can’t be undone.</span>
            <button type="button" className="button button-subtle small danger-text" disabled={busy === "all"} onClick={() => void removeAll()}>{busy === "all" ? "Deleting…" : "Delete all"}</button>
            <button type="button" className="text-button" onClick={() => setConfirmAll(false)}>Cancel</button></div>
          : <button type="button" className="text-button danger-text" onClick={() => setConfirmAll(true)}><Trash2 aria-hidden="true" className="inline-icon" /> Delete all chats</button>)}
      </section>
    </div>,
    document.body,
  );
}
