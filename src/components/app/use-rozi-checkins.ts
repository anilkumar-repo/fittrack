"use client";

import { useCallback } from "react";
import type { CheckinSettings } from "@/lib/rozi-ai/checkins/checkin-service";
import { useFitTrack } from "./fit-track-provider";

export type CheckinResult = { ok: true; settings: CheckinSettings } | { ok: false; message: string; off?: boolean };

type Failure = { ok: false; message: string; off?: boolean };
type Body = { ok?: boolean; message?: string; settings?: CheckinSettings } | null;

const OFF = "Weekly check-ins aren't switched on.";

/** The person's weekly check-in choice (R11). The server checks every value. */
export function useRoziCheckins() {
  const { browserClient } = useFitTrack();

  const call = useCallback(async (init?: { body: unknown }): Promise<CheckinResult> => {
    if (!browserClient) return { ok: false, message: "Sign in to use weekly check-ins." };
    const accessToken = (await browserClient.auth.getSession()).data.session?.access_token ?? null;
    if (!accessToken) return { ok: false, message: "Your sign-in has expired. Please sign in again." };
    try {
      const response = await fetch("/api/rozi/checkins", {
        method: init ? "PUT" : "GET",
        headers: { ...(init ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${accessToken}` },
        ...(init ? { body: JSON.stringify(init.body) } : {}),
      });
      if (response.status === 404) return { ok: false, message: OFF, off: true } satisfies Failure;
      const body = await response.json().catch(() => null) as Body;
      if (!response.ok || !body?.ok) return { ok: false, message: body?.message ?? "That didn't work. Try again." };
      return body.settings ? { ok: true, settings: body.settings } : { ok: false, message: "That didn't work. Try again." };
    } catch {
      return { ok: false, message: "No connection. Try again." };
    }
  }, [browserClient]);

  const load = useCallback(() => call(), [call]);
  const save = useCallback((settings: { enabled: boolean; weekday: number; hour: number }) => call({ body: settings }), [call]);

  return { load, save };
}
