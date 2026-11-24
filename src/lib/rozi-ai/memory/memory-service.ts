// ---------- Rozi memory (R10): notes the person controls (SERVER) ----------
//
// Only the person saves a note. The model can call propose_memory, which checks the note and returns a
// "Remember this?" card; nothing is stored until the person taps Save, which runs with their own sign-in through
// owner-checked database functions. Saved notes go into Rozi's instructions so advice respects them.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTool } from "../provider.ts";
import type { RoziContext, ToolOutcome } from "../tools.ts";
import { redactContactDetails } from "../privacy.ts";

export const MEMORY_KINDS = ["injury", "preference", "schedule", "other"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface RoziMemory { id: string; kind: MemoryKind; note: string; createdAt: string; updatedAt: string }

export const MEMORY_LIMITS = { minLength: 3, maxLength: 200, maxNotes: 30, promptNotes: 20, promptChars: 1500 } as const;

/** Memory is switched on per server (ROZI_MEMORY=on). Off: Rozi neither suggests nor reads notes. */
export function memoryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ROZI_MEMORY ?? "").trim().toLowerCase() === "on";
}

const isKind = (value: unknown): value is MemoryKind => typeof value === "string" && (MEMORY_KINDS as readonly string[]).includes(value);

export function parseMemory(value: unknown): RoziMemory | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !isKind(row.kind) || typeof row.note !== "string") return null;
  return { id: row.id, kind: row.kind, note: row.note, createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? "") };
}

/** Things the profile already holds; a note about them belongs in Settings, not in memory. */
const PROFILE_FACTS = /\b(my (goal|height|weight|equipment|training days)|i (weigh|am \d+ ?(cm|kg))|train(ing)? on (mon|tue|wed|thu|fri|sat|sun))/i;
const LINK = /\bhttps?:\/\/|\bwww\./i;

export type NoteCheck = { ok: true; note: string } | { ok: false; reason: string };

/** Checks a note before it's suggested or saved: length, no contact details or links, not a profile fact, not a duplicate. */
export function checkNote(raw: unknown, existing: Array<Pick<RoziMemory, "note">> = []): NoteCheck {
  const note = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (note.length < MEMORY_LIMITS.minLength || note.length > MEMORY_LIMITS.maxLength) return { ok: false, reason: `A note needs ${MEMORY_LIMITS.minLength}–${MEMORY_LIMITS.maxLength} characters.` };
  if (redactContactDetails(note) !== note || LINK.test(note)) return { ok: false, reason: "Notes can't hold contact details or links." };
  if (PROFILE_FACTS.test(note)) return { ok: false, reason: "That's already part of your profile; change it in Settings → Your plan instead." };
  if (existing.some((item) => item.note.toLowerCase() === note.toLowerCase())) return { ok: false, reason: "Rozi already remembers that." };
  if (existing.length >= MEMORY_LIMITS.maxNotes) return { ok: false, reason: `Rozi can remember up to ${MEMORY_LIMITS.maxNotes} notes. Delete one in Settings first.` };
  return { ok: true, note };
}

export const PROPOSE_MEMORY_TOOL: AiTool = {
  name: "propose_memory",
  description: "Suggest saving a short note about the user that will matter for future advice and isn't in their profile, e.g. an injury or pain ('Left knee hurts on lunges'), a preference ('Hates burpees'), or a schedule ('Trains before work'). Nothing is saved until the user taps Save on the card. Use only when the user tells you something lasting; never for one-off moods or for goal, days, equipment, height or weight (those are in Settings). Keep the note in their words, under 200 characters.",
  parameters: {
    type: "object",
    properties: { kind: { type: "string", enum: [...MEMORY_KINDS] }, note: { type: "string" } },
    required: ["kind", "note"],
  },
};

/** Runs propose_memory: checks the note and returns the "Remember this?" card. Stores nothing. */
export function proposeMemory(args: Record<string, unknown>, ctx: RoziContext): ToolOutcome {
  const kind = isKind(args.kind) ? args.kind : "other";
  const checked = checkNote(args.note, ctx.memories ?? []);
  if (!checked.ok) return { result: { suggested: false, reason: checked.reason } };
  return {
    result: { suggested: true, note: checked.note, howItWorks: "Nothing is saved yet. The card asks the user to tap Save; they can edit or delete notes in Settings. Don't say it's remembered." },
    card: { type: "memory", memory: { kind, note: checked.note } },
  };
}

/** The block added to Rozi's instructions: the person's notes, newest first, within a size budget. */
export function memoryPromptBlock(memories: Array<{ kind: string; note: string }> | undefined): string {
  if (!memories?.length) return "";
  const lines: string[] = [];
  let size = 0;
  for (const memory of memories.slice(0, MEMORY_LIMITS.promptNotes)) {
    const line = `- (${memory.kind}) ${memory.note}`;
    if (size + line.length > MEMORY_LIMITS.promptChars) break;
    lines.push(line);
    size += line.length;
  }
  return `\n\nNotes the user asked you to remember (respect them in every suggestion, e.g. avoid an exercise that hurts; don't list them back unless asked; you can't change them, the user edits them in Settings):\n${lines.join("\n")}`;
}

// ---------- Reading and writing, always AS the person (their own sign-in) ----------

export interface MemoryProblem { problem: string }
export const isMemoryProblem = (value: unknown): value is MemoryProblem => Boolean(value && typeof value === "object" && "problem" in value);

const problemFor = (code: string | undefined, fallback: string) =>
  code === "54000" ? `Rozi can remember up to ${MEMORY_LIMITS.maxNotes} notes. Delete one first.` : code === "42501" ? "That note isn't yours." : code === "23505" ? "Rozi already remembers that." : fallback;

export async function listMemories(userClient: SupabaseClient): Promise<RoziMemory[] | null> {
  const { data, error } = await userClient.rpc("rozi_my_memories");
  if (error || !Array.isArray(data)) return null;
  return data.map(parseMemory).filter((item): item is RoziMemory => item !== null);
}

export async function saveMemory(userClient: SupabaseClient, kind: unknown, note: unknown): Promise<RoziMemory | MemoryProblem> {
  const existing = (await listMemories(userClient)) ?? [];
  const checked = checkNote(note, existing);
  if (!checked.ok) return { problem: checked.reason };
  const { data, error } = await userClient.rpc("rozi_save_memory", { p_kind: isKind(kind) ? kind : "other", p_note: checked.note });
  if (error) return { problem: problemFor(error.code, "It couldn't be saved right now.") };
  return parseMemory(data) ?? { problem: "It couldn't be saved right now." };
}

export async function updateMemory(userClient: SupabaseClient, id: string, note: unknown): Promise<RoziMemory | MemoryProblem> {
  const existing = ((await listMemories(userClient)) ?? []).filter((item) => item.id !== id);
  const checked = checkNote(note, existing);
  if (!checked.ok) return { problem: checked.reason };
  const { data, error } = await userClient.rpc("rozi_update_memory", { p_memory: id, p_note: checked.note });
  if (error) return { problem: problemFor(error.code, "It couldn't be changed right now.") };
  return parseMemory(data) ?? { problem: "It couldn't be changed right now." };
}

export async function deleteMemory(userClient: SupabaseClient, id: string): Promise<{ deleted: true } | MemoryProblem> {
  const { error } = await userClient.rpc("rozi_delete_memory", { p_memory: id });
  return error ? { problem: problemFor(error.code, "It couldn't be deleted right now.") } : { deleted: true };
}
