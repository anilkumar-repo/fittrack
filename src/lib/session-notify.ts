/**
 * The "workout in progress" notification shown on the phone while a session is running — RozFit's version of the
 * workout timer on the lock screen. A web app can't run a ticking lock-screen timer (that needs the native app's
 * Live Activity), so the notification carries clock times instead: when you started, and when your rest ends.
 * It is refreshed whenever you leave the app (locking the phone or switching apps).
 * It is shown by the app itself (no server), so it works for device-only accounts too.
 * Android shows Rozi as the big picture; iPhone (Home Screen app, iOS 16.4+) shows the text and app icon.
 */
const TAG = "rozfit-session";
const ASKED_KEY = "rozfit-session-notify-asked";
const STARTED_PREFIX = "rozfit-started-";

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}

/** Asks for permission once (on the first workout start), then shows the notification. */
export async function notifyWorkoutStarted(title: string, date: string): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try { window.localStorage.setItem(`${STARTED_PREFIX}${date}`, String(Date.now())); } catch { /* the timer just starts now */ }
  if (Notification.permission === "default") {
    let asked = false;
    try { asked = window.localStorage.getItem(ASKED_KEY) === "1"; window.localStorage.setItem(ASKED_KEY, "1"); } catch { /* ask anyway */ }
    if (!asked) await Notification.requestPermission().catch(() => "denied");
  }
  if (Notification.permission !== "granted") return;
  const reg = await registration();
  await reg?.showNotification("Workout in progress 💪", {
    body: `${title} — Rozi is cheering you on. Tap to get back to your sets.`,
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    // Large picture on Android; ignored where not supported.
    ...({ image: "/rozi/workout.webp", requireInteraction: true, renotify: false } as Record<string, unknown>),
    tag: TAG,
    silent: true,
    data: { url: "/today" },
  }).catch(() => undefined);
}

/** Removes the notification when the workout is finished or ended. */
export async function clearWorkoutNotification(date?: string): Promise<void> {
  if (date) { try { window.localStorage.removeItem(`${STARTED_PREFIX}${date}`); } catch { /* nothing to clear */ } }
  const reg = await registration();
  const open = await reg?.getNotifications({ tag: TAG }).catch(() => []) ?? [];
  for (const notification of open) notification.close();
}

/** When this device started the workout (ms), if it did. */
export function workoutStartedAt(date: string): number | null {
  try { const value = Number(window.localStorage.getItem(`${STARTED_PREFIX}${date}`)); return value > 0 ? value : null; } catch { return null; }
}

export interface WorkoutNotificationInput {
  title: string;
  startedAt: number | null;
  setsDone: number;
  setsTotal: number;
  /** The rest in progress, if any. */
  rest: { endsAt: number; exerciseName: string } | null;
  now: number;
  /** Formats a time of day ("10:15", or "10:15:30" with seconds). */
  clock: (ms: number, withSeconds?: boolean) => string;
}

/** The notification's title and text for where the workout is now. */
export function workoutNotificationText(input: WorkoutNotificationInput): { title: string; body: string } {
  const progress = input.setsTotal > 0 ? ` · ${input.setsDone}/${input.setsTotal} sets` : "";
  const started = input.startedAt ? `Started ${input.clock(input.startedAt)}` : "In progress";
  const resting = input.rest && input.rest.endsAt > input.now;
  return {
    title: resting ? `⏱ Rest until ${input.clock(input.rest!.endsAt, true)}` : `💪 ${input.title}${progress}`,
    body: resting
      ? `${input.rest!.exerciseName} — next set when the rest ends.\n${started}${progress}. Tap to get back to your sets.`
      : `${started}. Tap to get back to your sets.`,
  };
}

function clockTime(ms: number, withSeconds = false): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) });
}

/**
 * Refreshes the workout notification (same tag, so it replaces the old one silently). Does nothing unless
 * notifications are allowed. Android also shows how long ago the workout started, from `timestamp`.
 */
export async function updateWorkoutNotification(input: Omit<WorkoutNotificationInput, "now" | "clock">): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await registration();
  const text = workoutNotificationText({ ...input, now: Date.now(), clock: clockTime });
  await reg?.showNotification(text.title, {
    body: text.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    ...({ image: "/rozi/workout.webp", requireInteraction: true, renotify: false, timestamp: input.startedAt ?? Date.now() } as Record<string, unknown>),
    tag: TAG,
    silent: true,
    data: { url: "/today" },
  }).catch(() => undefined);
}
