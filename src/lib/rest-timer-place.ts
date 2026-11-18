// ---------- Where the floating rest timer sits ----------

export type TimerSize = "compact" | "full";

/** The remembered place: which side it rests against, and how far down the screen (px from the top). */
export interface TimerPlace {
  side: "left" | "right";
  top: number;
}

/** The side a dropped timer settles on: whichever is nearer to its middle. */
export function snapSide(left: number, width: number, viewportWidth: number): "left" | "right" {
  return left + width / 2 < viewportWidth / 2 ? "left" : "right";
}

/** Keeps the timer fully on screen (below the status bar area, above the bottom edge). */
export function clampTimerTop(top: number, height: number, viewportHeight: number, edge = 12): number {
  const min = edge + 44;
  const max = viewportHeight - height - edge;
  return Math.round(Math.max(min, Math.min(max, top)));
}

/** Reads a remembered place, ignoring anything malformed. */
export function readTimerPlace(raw: string | null): TimerPlace | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TimerPlace>;
    if ((value.side === "left" || value.side === "right") && typeof value.top === "number" && Number.isFinite(value.top)) {
      return { side: value.side, top: value.top };
    }
  } catch { /* fall through */ }
  return null;
}
