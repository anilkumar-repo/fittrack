/**
 * The "workout in progress" notification shown on the phone while a session is running.
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
