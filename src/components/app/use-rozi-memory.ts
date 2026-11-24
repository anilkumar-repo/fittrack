"use client";

import { useCallback } from "react";
import type { MemoryKind, RoziMemory } from "@/lib/rozi-ai/memory/memory-service";
import { useFitTrack } from "./fit-track-provider";

export type MemoryListResult = { ok: true; memories: RoziMemory[] } | { ok: false; message: string; off?: boolean };
export type MemoryOneResult = { ok: true; memory: RoziMemory } | { ok: false; message: string };
export type MemoryDeleteResult = { ok: true } | { ok: false; message: string };

type Failure = { ok: false; message: string; off?: boolean };
type Body = { ok?: boolean; message?: string; memories?: RoziMemory[]; memory?: RoziMemory } | null;

const OFF = "Rozi memory isn't switched on.";

/** Notes Rozi remembers (R10). The person is the only one who saves, edits or deletes; the server checks every note. */
export function useRoziMemory() {
  const { browserClient } = useFitTrack();

  const call = useCallback(async (path: string, init?: { body: unknown }): Promise<{ body: Body } | Failure> => {
    if (!browserClient) return { ok: false, message: "Sign in to use Rozi memory." };
    const accessToken = (await browserClient.auth.getSession()).data.session?.access_token ?? null;
    if (!accessToken) return { ok: false, message: "Your sign-in has expired. Please sign in again." };
    try {
      const response = await fetch(path, {
        method: init ? "POST" : "GET",
        headers: { ...(init ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${accessToken}` },
        ...(init ? { body: JSON.stringify(init.body) } : {}),
      });
      if (response.status === 404) return { ok: false, message: OFF, off: true };
      const body = await response.json().catch(() => null) as Body;
      if (!response.ok || !body?.ok) return { ok: false, message: body?.message ?? "That didn't work. Try again." };
      return { body };
    } catch {
      return { ok: false, message: "No connection. Try again." };
    }
  }, [browserClient]);

  const list = useCallback(async (): Promise<MemoryListResult> => {
    const result = await call("/api/rozi/memories");
    if (!("body" in result)) return result;
    return Array.isArray(result.body?.memories) ? { ok: true, memories: result.body.memories } : { ok: false, message: "That didn't work. Try again." };
  }, [call]);

  const one = useCallback(async (path: string, body: unknown): Promise<MemoryOneResult> => {
    const result = await call(path, { body });
    if (!("body" in result)) return { ok: false, message: result.message };
    return result.body?.memory ? { ok: true, memory: result.body.memory } : { ok: false, message: "That didn't work. Try again." };
  }, [call]);

  const save = useCallback((kind: MemoryKind, note: string) => one("/api/rozi/memories", { kind, note }), [one]);
  const update = useCallback((id: string, note: string) => one(`/api/rozi/memories/${encodeURIComponent(id)}`, { op: "update", note }), [one]);
  const remove = useCallback(async (id: string): Promise<MemoryDeleteResult> => {
    const result = await call(`/api/rozi/memories/${encodeURIComponent(id)}`, { body: { op: "delete" } });
    return "body" in result ? { ok: true } : { ok: false, message: result.message };
  }, [call]);

  return { list, save, update, remove };
}
