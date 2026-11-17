import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PUSH_PREFS, type PushPrefs } from "./notifications";

export type PushSupport =
  | { state: "unsupported" }
  | { state: "install-first" }
  | { state: "not-configured" }
  | { state: "blocked" }
  | { state: "ready" };

const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isIosBrowserTab(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Whether this phone or browser can receive RozFit notifications right now. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { state: "unsupported" };
  if (isIosBrowserTab()) return { state: "install-first" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { state: "unsupported" };
  if (!vapidKey) return { state: "not-configured" };
  if (Notification.permission === "denied") return { state: "blocked" };
  return { state: "ready" };
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register("/sw.js");
}

function rowToPrefs(row: Record<string, unknown>): PushPrefs {
  return {
    morning: row.morning === true, morningHour: Number(row.morning_hour), evening: row.evening === true, eveningHour: Number(row.evening_hour), nudges: row.nudges === true,
    // Older databases may not have the new switches yet: treat them as on.
    hydration: row.hydration !== false, comeback: row.comeback !== false, weighIn: row.weigh_in !== false,
  };
}

/** This device's saved choices, or null when notifications are off here. */
export async function currentPush(client: SupabaseClient): Promise<PushPrefs | null> {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) return null;
  const { data } = await client.from("push_subscriptions").select("*").eq("endpoint", subscription.endpoint).maybeSingle();
  return data ? rowToPrefs(data) : null;
}

/** Asks permission (must follow a tap), subscribes this device and saves it. */
export async function enablePush(client: SupabaseClient, timeZone: string, prefs: PushPrefs = DEFAULT_PUSH_PREFS): Promise<PushPrefs> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked. Allow them for this site in your phone or browser settings." : "Notifications were not turned on.");
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) });
  return claimSubscription(client, subscription, timeZone, prefs);
}

/** Links this phone's subscription to whoever is signed in now (taking it over from another account if needed). */
async function claimSubscription(client: SupabaseClient, subscription: PushSubscription, timeZone: string, prefs: PushPrefs): Promise<PushPrefs> {
  const json = subscription.toJSON();
  // The phone may still be registered to another account that signed in here before. The database
  // function hands this device over to whoever is signed in now (a plain upsert is blocked by row security).
  const { error: claimError } = await client.rpc("claim_push_subscription", {
    p_endpoint: subscription.endpoint, p_p256dh: json.keys?.p256dh ?? "", p_auth: json.keys?.auth ?? "", p_time_zone: timeZone,
    p_morning: prefs.morning, p_morning_hour: prefs.morningHour, p_evening: prefs.evening, p_evening_hour: prefs.eveningHour, p_nudges: prefs.nudges,
    p_hydration: prefs.hydration, p_comeback: prefs.comeback, p_weigh_in: prefs.weighIn,
  });
  if (!claimError) return prefs;
  // Before the function exists (PGRST202), fall back to the old save.
  if (claimError.code !== "PGRST202") throw new Error(claimError.message);
  const { error } = await client.from("push_subscriptions").upsert({
    endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", time_zone: timeZone,
    morning: prefs.morning, morning_hour: prefs.morningHour, evening: prefs.evening, evening_hour: prefs.eveningHour, nudges: prefs.nudges,
    hydration: prefs.hydration, comeback: prefs.comeback, weigh_in: prefs.weighIn,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error?.message.includes("row-level security")) throw new Error("This phone gets notifications for another RozFit account. Sign in to that account and turn them off there, then try again.");
  if (error) throw new Error(error.message);
  return prefs;
}

/**
 * Called when the app opens signed in. If this phone already allows notifications but its subscription is
 * still linked to a different account (someone else signed in here before), the reminders would be about
 * that account's workouts. Re-link it to the signed-in account, with the default reminder choices.
 * Returns true when it re-linked. Never asks for permission; a phone that turned notifications off stays off.
 */
const savedPrefsKey = (userId: string) => `rozfit-push-prefs-${userId}`;

export async function syncPushOwner(client: SupabaseClient, timeZone: string, userId: string): Promise<boolean> {
  if (pushSupport().state !== "ready" || Notification.permission !== "granted") return false;
  const existing = await navigator.serviceWorker.getRegistration();
  const subscription = await existing?.pushManager.getSubscription();
  if (!subscription) return false;
  // Row security only shows this account's own rows: no row means it belongs to another account (or none).
  const { data, error } = await client.from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
  if (error || data) return false;
  // Same account coming back after signing out: keep the reminder times it had chosen.
  let prefs = DEFAULT_PUSH_PREFS;
  try {
    const saved = window.localStorage.getItem(savedPrefsKey(userId));
    if (saved) prefs = { ...DEFAULT_PUSH_PREFS, ...(JSON.parse(saved) as Partial<PushPrefs>) };
  } catch { /* storage blocked or unreadable: defaults */ }
  await claimSubscription(client, subscription, timeZone, prefs);
  return true;
}

/**
 * Before signing out: unlink this phone so the signed-out account stops sending it reminders. The browser
 * keeps its subscription, so the next account to sign in is linked again automatically (syncPushOwner).
 */
export async function releasePush(client: SupabaseClient, userId: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const existing = await navigator.serviceWorker.getRegistration();
  const subscription = await existing?.pushManager.getSubscription();
  if (!subscription) return;
  const { data } = await client.from("push_subscriptions").select("*").eq("endpoint", subscription.endpoint).maybeSingle();
  if (data) {
    try { window.localStorage.setItem(savedPrefsKey(userId), JSON.stringify(rowToPrefs(data))); } catch { /* not remembered */ }
  }
  await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
}

export async function savePushPrefs(client: SupabaseClient, timeZone: string, prefs: PushPrefs): Promise<void> {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) throw new Error("Turn notifications on first.");
  const { error } = await client.from("push_subscriptions").update({
    time_zone: timeZone, morning: prefs.morning, morning_hour: prefs.morningHour, evening: prefs.evening, evening_hour: prefs.eveningHour, nudges: prefs.nudges,
    hydration: prefs.hydration, comeback: prefs.comeback, weigh_in: prefs.weighIn,
    updated_at: new Date().toISOString(),
  }).eq("endpoint", subscription.endpoint);
  if (error) throw new Error(error.message);
}

export async function disablePush(client: SupabaseClient): Promise<void> {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) return;
  await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

/** Asks the server to push a just-sent nudge to the friend's phone. Best effort: the in-app banner still shows it. */
export async function pushNudge(client: SupabaseClient, nudgeId: string): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/push/nudge", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ nudgeId }) }).catch(() => undefined);
}
