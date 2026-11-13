"use client";

import { useEffect } from "react";
import { Check, Undo2 } from "lucide-react";

/** Floating glass bar shown while there are unsaved changes: Discard or Save. */
export function SaveBar({ onSave, onDiscard, disabled = false, note }: { onSave: () => void; onDiscard: () => void; disabled?: boolean; note?: string }) {
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <span className="save-bar-text"><span className="save-bar-dot" aria-hidden="true" /><span><strong>Unsaved<span className="wide-only"> changes</span></strong>{note && <small>{note}</small>}</span></span>
      <button type="button" className="button button-subtle" onClick={onDiscard}><Undo2 aria-hidden="true" /> Discard</button>
      <button type="button" className="button button-primary" onClick={onSave} disabled={disabled}><Check aria-hidden="true" /> Save</button>
    </div>
  );
}

/**
 * While there are unsaved changes: closing or reloading the page asks first, and tapping a link
 * (menu, avatar) asks "Leave without saving?" before going.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
