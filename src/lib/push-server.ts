// Server only: used by the /api/push routes. Never import this into a page or component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { PushMessage } from "./notifications";

/** Server settings for notifications. Missing values mean notifications are not set up yet. */
export function pushConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "https://rozfit-a.vercel.app";
  if (!url || !serviceKey || !publicKey || !privateKey) return null;
  return { url, serviceKey, publicKey, privateKey, subject };
}

let configured = false;

/** A database client with the service key. Server only: it bypasses row-level security. */
export function adminClient(): SupabaseClient | null {
  const config = pushConfig();
  if (!config) return null;
  if (!configured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configured = true;
  }
  return createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface StoredSubscription { id: string; endpoint: string; p256dh: string; auth: string }

/** Sends one message. Returns "gone" when the phone has withdrawn permission, so the row can be removed. */
export async function sendPush(subscription: StoredSubscription, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: message.tag ?? message.kind }),
      { TTL: 60 * 60 * 6, urgency: message.kind === "nudge" || message.kind === "chat" ? "high" : "normal" },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

/** Constant-time check of the shared secret sent by the database schedule. */
export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || header.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index++) diff |= header.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}
