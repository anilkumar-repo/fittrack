import type { FitTrackState } from "./types";

export const INVITE_CODE_LENGTH = 8;

/** Tidies a typed or pasted trainer code: capitals only, no spaces or dashes. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, INVITE_CODE_LENGTH);
}

export function isCompleteInviteCode(code: string): boolean {
  return /^[A-Z2-9]{8}$/.test(code);
}

/** Everything FitTrack holds for this person, in a readable file they can keep. */
export function buildDataExport(state: FitTrackState, exportedAt: string) {
  const { id: _id, trainerRole: _trainerRole, ...profile } = state.profile;
  void _id; void _trainerRole;
  return {
    app: "FitTrack",
    exportedAt,
    storedIn: state.mode === "supabase" ? "FitTrack account" : "this device only",
    profile,
    workouts: state.sessions.filter((session) => !session.sampleData).map((session) => ({
      date: session.date,
      status: session.status,
      completedAt: session.completedAt ?? null,
      plan: session.plan,
      checkIn: session.checkIn ?? null,
      exerciseLogs: session.exerciseLogs,
      review: session.review ?? null,
    })),
    bodyWeight: state.bodyWeightEntries.map(({ measuredOn, weightKg }) => ({ measuredOn, weightKg })),
  };
}
