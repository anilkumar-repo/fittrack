"use client";

import { useState } from "react";
import { Bookmark, Check, X } from "lucide-react";
import type { RoziCard } from "@/lib/rozi-ai/cards";
import { useRoziMemory } from "./use-rozi-memory";

type CardMemory = Extract<RoziCard, { type: "memory" }>["memory"];

export const MEMORY_KIND_LABEL: Record<CardMemory["kind"], string> = {
  injury: "Injury or pain", preference: "Preference", schedule: "Schedule", other: "Note",
};

/**
 * "Remember this?" (R10): Rozi suggests a note; nothing is stored until the person taps Save. Buttons lock while
 * saving, and a failed save keeps them so the person can try again.
 */
export function RoziMemoryCard({ memory }: { memory: CardMemory }) {
  const { save } = useRoziMemory();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "declined">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const saving = state === "saving";

  async function onSave() {
    if (saving) return;
    setState("saving");
    setProblem(null);
    const result = await save(memory.kind, memory.note);
    if (result.ok) setState("saved");
    else { setState("idle"); setProblem(result.message); }
  }

  const done = state === "saved" || state === "declined";
  return (
    <section className={`rozi-card rozi-action tone-${state === "saved" ? "done" : done ? "closed" : "waiting"}`} aria-label="Remember this?" aria-busy={saving}>
      <header>
        <span className="rozi-action-kind"><Bookmark aria-hidden="true" className="inline-icon" /> Remember this?</span>
        <span role="status" className={`rozi-chip rozi-action-status ${done ? "" : "rozi-memory-hidden"}`}>
          {state === "saved" && <><Check aria-hidden="true" /> Saved</>}
          {state === "declined" && <><X aria-hidden="true" /> Not saved</>}
        </span>
      </header>
      <p className="rozi-memory-note">“{memory.note}”</p>
      <small className="rozi-action-note">{MEMORY_KIND_LABEL[memory.kind]}</small>
      {problem && <p className="rozi-action-problem" role="alert">{problem}</p>}
      {!done && <div className="rozi-action-buttons">
        <button type="button" disabled={saving} className="button button-primary small" onClick={() => void onSave()}><Check aria-hidden="true" /> {saving ? "Saving…" : "Save"}</button>
        <button type="button" disabled={saving} className="button button-subtle small" onClick={() => setState("declined")}>Not now</button>
      </div>}
      {state === "saved" && <small className="rozi-action-note">You can edit or delete it in Settings → What Rozi remembers.</small>}
    </section>
  );
}
