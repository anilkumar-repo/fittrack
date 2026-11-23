"use client";

import { createPortal } from "react-dom";
import { ListChecks } from "lucide-react";
import type { RoziAction } from "@/lib/rozi-ai/actions/action-types";
import { ACTION_TYPE_LABEL, actionView } from "@/lib/rozi-ai/actions/action-view";
import { shortDate } from "@/lib/dates";
import { useScrollLock } from "./use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";

/** "What Rozi changed": every proposal with its outcome, newest first. Read-only; waiting ones are approved in the chat. */
export function RoziActionsSheet({ actions, onClose }: { actions: RoziAction[] | null; onClose: () => void }) {
  useScrollLock();
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="What Rozi changed" onClick={onClose}>
      <section className="modal rozi-actions-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <span className="onb-kicker"><ListChecks aria-hidden="true" /> Changes</span>
        <h2>What Rozi changed</h2>
        <p className="card-note">Rozi only changes something after you approve it. Here&apos;s everything it proposed and what happened.</p>
        {actions === null ? <p className="card-note">Loading…</p>
          : actions.length === 0 ? <p className="card-note">Nothing yet. Ask Rozi to swap an exercise, plan today&apos;s workout or log water — you&apos;ll approve it on a card.</p>
            : <ul className="rozi-actions-list">{actions.map((action) => {
              const view = actionView(action.status, action.expiresAt);
              return (
                <li key={action.id}>
                  <div className="rozi-actions-row-top">
                    <span className="rozi-action-kind">{ACTION_TYPE_LABEL[action.type] ?? "Change"} · {shortDate(action.createdAt.slice(0, 10))}</span>
                    <span className={`rozi-chip rozi-action-status tone-${view.tone}`}>{view.label}</span>
                  </div>
                  <strong>{action.summary.title}</strong>
                  {action.summary.changes.length > 0 && <small>{action.summary.changes.join(" · ")}</small>}
                  {action.error && view.tone === "problem" && <small className="rozi-action-problem">{action.error}</small>}
                </li>
              );
            })}</ul>}
      </section>
    </div>,
    document.body,
  );
}
