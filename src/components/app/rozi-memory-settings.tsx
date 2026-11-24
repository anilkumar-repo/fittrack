"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Bookmark } from "lucide-react";
import { MEMORY_LIMITS, type RoziMemory } from "@/lib/rozi-ai/memory/memory-service";
import { MEMORY_KIND_LABEL } from "./rozi-memory-card";
import { useRoziMemory } from "./use-rozi-memory";

/** Settings → "What Rozi remembers" (R10). Hidden completely when memory is switched off on the server. */
export function RoziMemorySettings() {
  const { list, update, remove } = useRoziMemory();
  const [memories, setMemories] = useState<RoziMemory[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fieldId = useId();

  const load = useCallback(async () => {
    const result = await list();
    if (result.ok) { setMemories(result.memories); setLoadProblem(null); }
    else if (result.off) setHidden(true);
    else setLoadProblem(result.message);
  }, [list]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (hidden) return null;

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const result = await update(id, draft);
    setBusy(false);
    if (result.ok) { setMemories((items) => items?.map((item) => item.id === id ? result.memory : item) ?? items); setEditing(null); }
    else setProblem(result.message);
  }

  async function onDelete(id: string) {
    if (busy || !window.confirm("Delete this note? Rozi will forget it.")) return;
    setBusy(true);
    setProblem(null);
    const result = await remove(id);
    setBusy(false);
    if (result.ok) setMemories((items) => items?.filter((item) => item.id !== id) ?? items);
    else setProblem(result.message);
  }

  return (
    <article className="panel settings-group rozi-memory" aria-busy={busy}>
      <h3><Bookmark aria-hidden="true" /> What Rozi remembers</h3>
      <p className="card-note">Notes you chose to save. Rozi uses them in its advice. Only you can add, change or delete them.</p>
      {loadProblem && <p className="rozi-action-problem" role="alert">{loadProblem} <button type="button" className="text-button" onClick={() => void load()}>Try again</button></p>}
      {!loadProblem && memories === null && <p className="card-note" role="status">Loading…</p>}
      {memories?.length === 0 && <p className="card-note">Nothing yet. When you tell Rozi about an injury or a preference, it will ask before remembering it.</p>}
      {memories && memories.length > 0 && <>
        <ul className="rozi-memory-list">{memories.map((memory) => (
          <li key={memory.id}>
            {editing === memory.id ? <div className="rozi-memory-edit">
              <label htmlFor={`${fieldId}-${memory.id}`}><small>{MEMORY_KIND_LABEL[memory.kind]}</small></label>
              <textarea id={`${fieldId}-${memory.id}`} rows={3} maxLength={MEMORY_LIMITS.maxLength} value={draft} onChange={(event) => setDraft(event.target.value)} />
              <div className="rozi-action-buttons">
                <button type="button" className="button button-primary small" disabled={busy} onClick={() => void saveEdit(memory.id)}>{busy ? "Saving…" : "Save"}</button>
                <button type="button" className="button button-subtle small" disabled={busy} onClick={() => { setEditing(null); setProblem(null); }}>Cancel</button>
              </div>
            </div> : <>
              <span><small>{MEMORY_KIND_LABEL[memory.kind]}</small><strong>{memory.note}</strong></span>
              <span className="rozi-action-buttons">
                <button type="button" className="button button-subtle small" disabled={busy} aria-label={`Edit note: ${memory.note}`} onClick={() => { setEditing(memory.id); setDraft(memory.note); setProblem(null); }}>Edit</button>
                <button type="button" className="button button-subtle small danger-text" disabled={busy} aria-label={`Delete note: ${memory.note}`} onClick={() => void onDelete(memory.id)}>Delete</button>
              </span>
            </>}
          </li>
        ))}</ul>
        <small className="rozi-action-note">{memories.length} of {MEMORY_LIMITS.maxNotes} notes</small>
      </>}
      {problem && <p className="rozi-action-problem" role="alert">{problem}</p>}
    </article>
  );
}
