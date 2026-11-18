// ---------- Discover + profiles (Phase 7 step C) ----------

export const BIO_LIMIT = 160;

/** How two people relate, as the database reports it. */
export type Relation = "self" | "friend" | "requested" | "incoming" | "none";

/** A username as it's saved: lower case, no "@" or spaces. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

/** Why a username can't be used (null when it's fine). 3–20 letters, numbers, dots or underscores. */
export function usernameProblem(value: string): string | null {
  const name = normalizeUsername(value);
  if (!name) return null; // no username is allowed
  if (name.length < 3) return "At least 3 characters.";
  if (name.length > 20) return "At most 20 characters.";
  if (!/^[a-z0-9_.]+$/.test(name)) return "Only letters, numbers, dots and underscores.";
  return null;
}

/** A starting suggestion from the display name: "Anil Kumar" → "anil.kumar". */
export function suggestUsername(displayName: string): string {
  const base = displayName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 20);
  return base.length >= 3 ? base : "";
}

/** Whether a birth year makes someone an adult this year (unknown counts as not adult — same rule as the database). */
export function isAdult(birthYear: number | undefined, year: number): boolean {
  return typeof birthYear === "number" && year - birthYear >= 18;
}

export interface ChecklistItem { id: string; label: string; done: boolean; href?: string }

/** "Complete your profile": what makes your profile feel like you, and findable by friends. */
export function profileChecklist(input: { avatar?: string; username?: string; bio?: string; birthYear?: number; workouts: number; posts: number }): ChecklistItem[] {
  return [
    { id: "picture", label: "Add a profile picture", done: Boolean(input.avatar) },
    { id: "username", label: "Choose a @username", done: Boolean(input.username) },
    { id: "bio", label: "Write a short bio", done: Boolean(input.bio?.trim()) },
    { id: "birth-year", label: "Add your birth year (needed to be findable)", done: typeof input.birthYear === "number", href: "/settings?section=plan" },
    { id: "workout", label: "Finish your first workout", done: input.workouts > 0, href: "/today" },
    { id: "post", label: "Post a workout to the feed", done: input.posts > 0, href: "/today" },
  ];
}

/** What the friend button on a person says and does. */
export function relationAction(relation: Relation): { label: string; action: "add" | "cancel" | "accept" | "none" } {
  switch (relation) {
    case "friend": return { label: "Friends", action: "none" };
    case "requested": return { label: "Requested", action: "cancel" };
    case "incoming": return { label: "Accept", action: "accept" };
    case "self": return { label: "You", action: "none" };
    default: return { label: "Add friend", action: "add" };
  }
}
