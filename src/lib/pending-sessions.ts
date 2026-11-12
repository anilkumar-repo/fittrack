import type { WorkoutSession } from "./types";
import { normalizeWorkoutSession } from "./workout-tracking";

/** Device drafts of signed-in sessions that have not reached the cloud yet. */
function pendingKey(userId: string) { return `fittrack-pending-sessions-v2-${userId}`; }

export function readPendingSessions(userId: string): WorkoutSession[] {
  try {
    const raw = window.localStorage.getItem(pendingKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.map((session) => normalizeWorkoutSession(session as Record<string, unknown>)).filter((session): session is WorkoutSession => session !== null);
  } catch { return []; }
}

export function writePendingSession(userId: string, session: WorkoutSession) {
  const remaining = readPendingSessions(userId).filter((item) => item.date !== session.date);
  try { window.localStorage.setItem(pendingKey(userId), JSON.stringify([...remaining, session])); } catch { /* Keep the in-memory draft available. */ }
}

export function clearPendingSession(userId: string, date: string) {
  const remaining = readPendingSessions(userId).filter((item) => item.date !== date);
  try {
    if (remaining.length) window.localStorage.setItem(pendingKey(userId), JSON.stringify(remaining));
    else window.localStorage.removeItem(pendingKey(userId));
  } catch { /* A synced session is already safe in Supabase. */ }
}
