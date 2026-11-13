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
  return { morning: row.morning === true, morningHour: Number(row.morning_hour), evening: row.evening === true, eveningHour: Number(row.evening_hour), nudges: row.nudges === true };
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
  const json = subscription.toJSON();
  const { error } = await client.from("push_subscriptions").upsert({
    endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", time_zone: timeZone,
    morning: prefs.morning, morning_hour: prefs.morningHour, evening: prefs.evening, evening_hour: prefs.eveningHour, nudges: prefs.nudges,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
  return prefs;
}

export async function savePushPrefs(client: SupabaseClient, timeZone: string, prefs: PushPrefs): Promise<void> {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) throw new Error("Turn notifications on first.");
  const { error } = await client.from("push_subscriptions").update({
    time_zone: timeZone, morning: prefs.morning, morning_hour: prefs.morningHour, evening: prefs.evening, evening_hour: prefs.eveningHour, nudges: prefs.nudges,
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
