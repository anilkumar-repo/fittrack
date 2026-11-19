"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hourIn, shiftDate, weekdayOf } from "@/lib/dates";
import { coolDownFor, quickVersion, routineMinutes, stretchPicture, suggestionForDay, warmUpFor, type MobilityRoutine } from "@/lib/mobility";
import { sessionForDate, useFitTrack } from "./fit-track-provider";

/** One routine card: picture, title, minutes and why it's suggested. */
export function RoutineSuggestionCard({ routine, label, reason, then, quick = false }: { routine: MobilityRoutine; label: string; reason: string; then?: string; quick?: boolean }) {
  const href = `/mobility?routine=${routine.id}&play=1${quick ? "&quick=1" : ""}${then ? `&then=${encodeURIComponent(then)}` : ""}`;
  const shown = quick ? quickVersion(routine) : routine;
  return (
    <Link href={href} className="suggest-card">
      <span className="suggest-art"><Image src={stretchPicture(routine.moves[0])} alt="" width={420} height={210} sizes="140px" /></span>
      <span className="suggest-copy"><small>{label}</small><strong>{shown.title} · {routineMinutes(shown)} min</strong><em>{reason}</em></span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

/**
 * "Mobility of the day" for Home and the Mobility page: knee care after discomfort, travel stretches after a
 * travel day, breathing when sore or unwell, a rest-day routine, or a wind-down in the evening.
 */
export function MobilitySuggestion() {
  const { state, currentDate } = useFitTrack();
  const recent = [0, 1, 2].map((back) => sessionForDate(state, shiftDate(currentDate, -back)));
  const missed = recent.find((session) => session?.missedReason)?.missedReason?.reason ?? null;
  const lastDone = [...state.sessions].filter((session) => session.status === "completed" && session.date <= currentDate).sort((a, b) => b.date.localeCompare(a.date))[0];
  const discomfort = Boolean(lastDone && (lastDone.review?.discomfort || lastDone.checkIn?.pain) && lastDone.date >= shiftDate(currentDate, -3));
  const restDay = !state.profile.trainingDays.includes(weekdayOf(currentDate));
  const pick = suggestionForDay({ hour: hourIn(state.profile.timeZone), restDay, recentMissedReason: missed, discomfort, seatedDay: state.profile.dailyActivity === "seated" });
  if (!pick) return null;
  return <RoutineSuggestionCard routine={pick.routine} label="Mobility for today" reason={pick.reason} />;
}

/** Train: a warm-up before starting, matched to the workout. */
export function WarmUpCard({ focus, date }: { focus: string; date: string }) {
  return <RoutineSuggestionCard routine={warmUpFor(focus)} quick label="Warm up first (optional)" reason="Loosen up for today’s moves — Rozi brings you back here after." then={`/today?date=${date}`} />;
}

/** Train: a cool-down after finishing. */
export function CoolDownCard({ focus }: { focus: string }) {
  return <RoutineSuggestionCard routine={coolDownFor(focus)} label="Cool down" reason="A few minutes of stretching helps you recover." />;
}
