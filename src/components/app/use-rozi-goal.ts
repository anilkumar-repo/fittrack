"use client";

import { useCallback } from "react";
import { parseGoal, type RoziGoal } from "@/lib/rozi-ai/planning/goal-types";
import { useFitTrack } from "./fit-track-provider";

export type GoalOp = "approve" | "reject" | "pause" | "resume" | "cancel";
export type GoalCallResult = { ok: true; goal: RoziGoal } | { ok: false; message: string };

/**
 * Approve / reject / pause / resume / stop a Rozi goal from its card (Level 4). The server decides everything: this
 * only sends the person's tap (with the plan hash for approve) and returns the goal as the server now has it.
 */
export function useRoziGoal() {
  const { browserClient } = useFitTrack();

  const act = useCallback(async (goalId: string, op: GoalOp, hash?: string): Promise<GoalCallResult> => {
    if (!browserClient) return { ok: false, message: "Sign in to use Rozi goals." };
    const accessToken = (await browserClient.auth.getSession()).data.session?.access_token ?? null;
    if (!accessToken) return { ok: false, message: "Your sign-in has expired. Please sign in again." };
    try {
      const response = await fetch(`/api/rozi/goals/${goalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(op === "approve" ? { op, hash } : { op }),
      });
      if (response.status === 404) return { ok: false, message: "Goals aren't switched on right now." };
      const json = await response.json().catch(() => null) as { ok?: boolean; goal?: unknown; message?: string } | null;
      const goal = json?.ok && json.goal && typeof json.goal === "object" ? (json.goal as RoziGoal) : null;
      // The server returns the goal in its own shape; accept the parsed (snake_case) form too, so either works.
      const parsed = goal ?? null;
      if (parsed && typeof parsed.status === "string" && Array.isArray(parsed.steps)) return { ok: true, goal: parsed };
      const fromRow = json?.ok ? parseGoal(json.goal) : null;
      return fromRow ? { ok: true, goal: fromRow } : { ok: false, message: json?.message ?? "That didn't work. Try again." };
    } catch {
      return { ok: false, message: "No connection. Try again." };
    }
  }, [browserClient]);

  return { act };
}
