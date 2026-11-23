"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Check, CircleAlert, Clock, Loader2, Sparkles, X } from "lucide-react";
import type { RoziCard } from "@/lib/rozi-ai/cards";
import type { ActionStatus, RoziAction } from "@/lib/rozi-ai/actions/action-types";
import { ACTION_TYPE_LABEL, actionView } from "@/lib/rozi-ai/actions/action-view";
import { useRoziAction } from "./use-rozi-action";

/**
 * The latest known state of each action (from the server), shared by every card on the Rozi screen, so a card
 * reopened from an old chat shows what really happened rather than the state it was proposed in.
 */
export const RoziActionsContext = createContext<{ byId: Map<string, RoziAction>; remember: (action: RoziAction) => void } | null>(null);

type CardAction = Extract<RoziCard, { type: "action" }>["action"];

/**
 * A change Rozi proposed (Level 3): what will change and why, with Approve / Reject. Status always comes from the
 * server: "Done" only after the server checked the change. Buttons lock while a tap is being handled, so a double tap
 * does nothing (the server refuses a second start anyway).
 */
export function RoziActionCard({ action }: { action: CardAction }) {
  const shared = useContext(RoziActionsContext);
  const { approve, reject } = useRoziAction();
  const latest = shared?.byId.get(action.id);
  const [status, setStatus] = useState<ActionStatus | "working">(latest?.status ?? action.status);
  const [problem, setProblem] = useState<string | null>(latest?.error ?? null);
  const [now, setNow] = useState(() => Date.now());

  // A newer state from the server (e.g. the history list loaded) wins, unless a tap is in progress.
  useEffect(() => {
    if (!latest || status === "working") return;
    const timer = window.setTimeout(() => { setStatus(latest.status); setProblem(latest.error); }, 0);
    return () => window.clearTimeout(timer);
  }, [latest, status]);

  // The expiry line counts down while the card waits.
  useEffect(() => {
    if (status !== "awaiting_approval") return;
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [status]);

  const view = actionView(status, action.expiresAt, now);

  async function decide(kind: "approve" | "reject") {
    if (status !== "awaiting_approval") return;
    setStatus("working");
    setProblem(null);
    const result = kind === "approve" ? await approve(action.id, action.payloadHash) : await reject(action.id);
    if (result.ok) {
      shared?.remember(result.action);
      setStatus(result.action.status);
      setProblem(result.action.error);
    } else {
      // The request didn't go through: nothing changed, the card can be tapped again.
      setStatus("awaiting_approval");
      setProblem(result.message);
    }
  }

  const Icon = view.tone === "done" ? Check : view.tone === "problem" ? CircleAlert : view.tone === "working" ? Loader2 : view.tone === "closed" ? X : Clock;
  return (
    <section className={`rozi-card rozi-action tone-${view.tone}`} aria-label={`Proposed change: ${action.summary.title}`} aria-busy={view.tone === "working"}>
      <header>
        <span className="rozi-action-kind"><Sparkles aria-hidden="true" className="inline-icon" /> {ACTION_TYPE_LABEL[action.type] ?? "Change"}</span>
        <span className={`rozi-chip rozi-action-status tone-${view.tone}`} role="status"><Icon aria-hidden="true" className={view.tone === "working" ? "spin" : ""} /> {view.label}</span>
      </header>
      <strong className="rozi-action-title">{action.summary.title}</strong>
      {action.summary.why && <p className="rozi-action-why">{action.summary.why}</p>}
      {action.summary.changes.length > 0 && <ul className="rozi-action-changes">{action.summary.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>}
      {problem && <p className="rozi-action-problem" role="alert">{problem}</p>}
      {view.canDecide
        ? <div className="rozi-action-buttons">
          <button type="button" className="button button-primary small" onClick={() => void decide("approve")}><Check aria-hidden="true" /> Approve</button>
          <button type="button" className="button button-subtle small" onClick={() => void decide("reject")}>Not now</button>
        </div>
        : null}
      <small className="rozi-action-note">{view.note}</small>
    </section>
  );
}
