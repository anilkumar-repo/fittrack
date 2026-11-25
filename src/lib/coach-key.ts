// R14: a short fingerprint of the coach changes a plan was built with. A saved workout that hasn't started is planned
// again when the person's coach changes no longer match it (src/components/app/use-workout-day.ts). Kept free of
// imports so the exercise library can use it without an import cycle. No changes → "" (matches every older plan).

import type { Profile } from "./types";

export function coachKeyOf(profile: Pick<Profile, "planAdjustments" | "buddyAnchor">): string {
  const adjustments = profile.planAdjustments;
  if (!adjustments || profile.buddyAnchor) return "";
  const swaps = Object.entries(adjustments.swaps ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([from, to]) => `${from}>${to}`).join(",");
  const delta = adjustments.setDelta ?? 0;
  const light = adjustments.lightWeekStart ?? "";
  return swaps || delta || light ? `${swaps}|${delta}|${light}` : "";
}
