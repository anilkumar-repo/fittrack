import { Bandage, Check, Flame, Pause, X } from "lucide-react";
import type { StreakDay } from "@/lib/streak";

export const STREAK_LABELS: Record<StreakDay, string> = {
  done: "Workout done",
  rest: "Rest day",
  paused: "Paused (unwell, sore or travelling)",
  repaired: "Missed, then repaired",
  missed: "Missed",
  today: "Today",
  upcoming: "Coming up",
  before: "Before you started",
};

/** One day's streak mark: flame, dot, pause, bandage, cross, or the day number. */
export function StreakDayMark({ status, label, size = "md" }: { status: StreakDay; label?: string; size?: "md" | "sm" }) {
  const icon = status === "done" ? <Flame aria-hidden="true" />
    : status === "repaired" ? <Bandage aria-hidden="true" />
      : status === "paused" ? <Pause aria-hidden="true" />
        : status === "missed" ? <X aria-hidden="true" />
          : status === "rest" ? <span className="streak-dot" aria-hidden="true" />
            : <span className="streak-num">{label}</span>;
  return <span className={`streak-mark ${status} ${size}`} title={STREAK_LABELS[status]}>{icon}</span>;
}

/** A small week row for celebrations: a check on workout days, today highlighted. */
export function WeekCheck({ status, today }: { status: StreakDay; today: boolean }) {
  return <span className={`week-check ${status} ${today ? "is-today" : ""}`}>{status === "done" ? <Check aria-hidden="true" /> : status === "repaired" ? <Bandage aria-hidden="true" /> : status === "paused" ? <Pause aria-hidden="true" /> : null}</span>;
}
