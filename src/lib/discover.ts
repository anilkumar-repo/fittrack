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

/** A valid YYYY-MM-DD date of birth, or null. */
export function validBirthDate(value: string | undefined | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" ? value : null;
}

/** The date 18 years before `today` (YYYY-MM-DD). A 29 February birthday becomes an adult on 1 March in other years. */
function eighteenYearsBefore(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year - 18, month - 1, day));
  // 29 Feb → 1 Mar when the earlier year isn't a leap year (Date rolls over).
  return date.toISOString().slice(0, 10);
}

/**
 * Whether someone is 18 or older on `today` (YYYY-MM-DD, in their time zone). Same rule as the database
 * (private.is_adult): a full date of birth decides exactly; with only a birth year, only when it's certain whatever the
 * birthday (19+ years ago). Unknown counts as not adult. (A birth year alone can't prove it: someone born in December
 * 2008 is still 17 in November 2026 — and RozFit stores the year as "this year − age", which is approximate.)
 */
export function isAdultOn(profile: { birthYear?: number; birthDate?: string }, today: string): boolean {
  const birthDate = validBirthDate(profile.birthDate);
  if (birthDate) return birthDate <= eighteenYearsBefore(today) && birthDate <= today;
  return typeof profile.birthYear === "number" && Number(today.slice(0, 4)) - profile.birthYear >= 19;
}

/** True when a full date of birth would settle it: only the birth year is known, and it could go either way. */
export function needsBirthDate(profile: { birthYear?: number; birthDate?: string }, today: string): boolean {
  return !validBirthDate(profile.birthDate) && typeof profile.birthYear === "number" && Number(today.slice(0, 4)) - profile.birthYear === 18;
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
