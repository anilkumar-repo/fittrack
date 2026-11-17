"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, SendHorizontal } from "lucide-react";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, hourIn, nextTrainingDate, weekDates } from "@/lib/dates";
import { calculatePersonalRecords } from "@/lib/progress";
import { calculateStreak } from "@/lib/rozi";
import { suggestionForDay } from "@/lib/mobility";
import { BMI_BAND_LABEL, bmi, bmiBand } from "@/lib/body";
import { muscleRecovery, readyCount, recoveryLine, weeklyReport } from "@/lib/recovery";
import { detectIntent, MAX_MESSAGE_LENGTH, SUGGESTED_QUESTIONS, type RoziIntent } from "@/lib/rozi-chat";

interface Message { from: "me" | "rozi"; text: string; link?: { href: string; label: string }; tip?: boolean }

/**
 * Ask Rozi (version 0): questions answered from the person's own saved workouts on this device.
 * Nothing is sent anywhere and nothing is made up: with no data, Rozi says so.
 */
export function RoziChatScreen() {
  const { state, recordedSessions, currentDate } = useFitTrack();
  const { plan, session: today } = useWorkoutDay(currentDate, DEFAULT_CHECK_IN);
  const name = state.profile.displayName;
  const [messages, setMessages] = useState<Message[]>([{ from: "rozi", text: `Hey ${name}! I’m Rozi. Ask me about your workouts, streak, progress or stretches — I answer from what you’ve logged.` }]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, thinking]);

  const completed = recordedSessions.filter((item) => item.status === "completed" && item.date <= currentDate).sort((a, b) => a.date.localeCompare(b.date));

  function answer(intent: RoziIntent): Message {
    switch (intent) {
      case "HELLO": return { from: "rozi", text: `Hi ${name}! Try one of the questions below.` };
      case "TODAY_WORKOUT":
        if (today?.status === "completed") return { from: "rozi", text: `You already finished today’s ${today.plan.title}. Nice work!`, link: { href: "/today", label: "View session" } };
        if (!plan) return { from: "rozi", text: "Today is a rest day. You can still train if you feel like it.", link: { href: "/today?extra=1", label: "Train today anyway" } };
        return { from: "rozi", text: `Today is ${plan.title}: ${plan.exercises.length} moves, about ${plan.durationMinutes} minutes. Starts with ${plan.exercises.slice(0, 3).map((item) => item.name).join(", ")}.`, link: { href: "/today", label: today?.status === "in_progress" ? "Continue workout" : "Start workout" } };
      case "NEXT_WORKOUT": {
        const next = nextTrainingDate(state.profile, currentDate);
        return next ? { from: "rozi", text: `Your next planned session is ${dateLabel(next)}.`, link: { href: `/today?date=${next}`, label: "Have a look" } } : { from: "rozi", text: "No training days are set yet.", link: { href: "/settings", label: "Choose days" } };
      }
      case "LAST_WORKOUT": {
        const last = completed.at(-1);
        if (!last) return { from: "rozi", text: "You haven’t finished a workout yet. Your first one starts your streak!", link: { href: "/today", label: "Go to Train" } };
        const sets = last.exerciseLogs.reduce((sum, log) => sum + log.sets.filter((set) => set.completed).length, 0);
        return { from: "rozi", text: `Your last workout was ${last.plan.title} on ${dateLabel(last.date)}: ${sets} sets done across ${last.exerciseLogs.length} moves.`, link: { href: `/today?date=${last.date}`, label: "Open it" } };
      }
      case "WEEKLY_WORKOUT_COUNT": {
        const week = weekDates(currentDate);
        const done = completed.filter((item) => week.includes(item.date)).length;
        return { from: "rozi", text: `${done} of ${state.profile.sessionsPerWeek} workouts done this week.${done >= state.profile.sessionsPerWeek ? " Goal reached!" : ""}` };
      }
      case "STREAK_STATUS": {
        const streak = calculateStreak(state.profile, recordedSessions, currentDate);
        if (streak.repair) return { from: "rozi", text: `Your ${streak.repair.lostStreak}-workout streak is on hold. One workout before ${dateLabel(streak.repair.deadline)} wins it back.`, link: { href: "/streak", label: "See calendar" } };
        return { from: "rozi", text: streak.current > 0 ? `${streak.current} in a row — your best is ${streak.best}. Keep going!` : "No streak yet. Your next workout starts one.", link: { href: "/streak", label: "See calendar" } };
      }
      case "PROGRESS_CHECK": {
        const records = calculatePersonalRecords(completed);
        if (!records.length) return { from: "rozi", text: `You’ve finished ${completed.length} ${completed.length === 1 ? "workout" : "workouts"}. Log weights with your sets and I can show your best lifts.` };
        const top = records.slice(0, 3).map((item) => `${item.exerciseName} ${item.loadKg} kg × ${item.reps}`).join("; ");
        return { from: "rozi", text: `${completed.length} workouts so far. Your best lifts: ${top}.`, link: { href: "/progress", label: "See progress" } };
      }
      case "MOBILITY_RECOMMENDATION": {
        const pick = suggestionForDay({ hour: hourIn(state.profile.timeZone), restDay: !plan, discomfort: false }) ?? suggestionForDay({ hour: 9, restDay: true });
        return pick ? { from: "rozi", tip: true, text: `Try “${pick.routine.title}”. ${pick.reason}`, link: { href: `/mobility?routine=${pick.routine.id}`, label: "Open routine" } } : { from: "rozi", text: "Have a look at the stretch routines.", link: { href: "/mobility", label: "Stretch & mobility" } };
      }
      case "WEEKLY_REPORT": {
        const report = weeklyReport(state.profile, recordedSessions, weekDates(currentDate)[0], currentDate);
        return { from: "rozi", text: `This week: ${report.completed} of ${report.planned} planned workouts, ${report.sets} sets${report.newRecords.length ? `, ${report.newRecords.length} new ${report.newRecords.length === 1 ? "record" : "records"}` : ""}. ${report.rozi}`, link: { href: "/report", label: "Open your week" } };
      }
      case "MUSCLE_RECOVERY": {
        const recovery = muscleRecovery(recordedSessions, currentDate);
        return { from: "rozi", text: `${readyCount(recovery)} of 6 muscle groups are ready. ${recoveryLine(recovery)}`, link: { href: "/recovery", label: "Open recovery map" } };
      }
      case "WATER": return { from: "rozi", tip: true, text: "Your water card on Home shows today’s target and how much you’ve had. Little sips through the day work best.", link: { href: "/", label: "Go to Home" } };
      case "BODY_GOAL_PROGRESS": {
        const entries = state.bodyWeightEntries;
        const latest = entries.at(-1);
        if (!latest) return { from: "rozi", text: "No weight logged yet. Add one on the Progress page and I’ll track it.", link: { href: "/progress", label: "Add weight" } };
        const first = entries[0];
        const change = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
        const value = state.profile.heightCm ? bmi(state.profile.heightCm, latest.weightKg) : null;
        const band = value ? bmiBand(value) : null;
        return { from: "rozi", text: `Latest weight ${latest.weightKg} kg (${dateLabel(latest.measuredOn)})${entries.length > 1 ? `, ${change > 0 ? "+" : ""}${change} kg since ${dateLabel(first.measuredOn)}` : ""}${value ? `. BMI ${value.toFixed(1)}${band ? ` (${BMI_BAND_LABEL[band].toLowerCase()})` : ""}` : ""}.`, link: { href: "/progress", label: "See Body & BMI" } };
      }
      default: return { from: "rozi", text: "I’m still learning that one. I can answer about today’s workout, your last workout, this week, your streak, progress, stretches and weight." };
    }
  }

  function ask(text: string) {
    const question = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!question || thinking) return;
    setMessages((current) => [...current, { from: "me", text: question }]);
    setDraft("");
    // A short "thinking" moment with Rozi, so the answer feels like a reply (the answer itself is instant).
    setThinking(true);
    const reply = answer(detectIntent(question));
    window.setTimeout(() => { setMessages((current) => [...current, reply]); setThinking(false); }, 650);
  }

  return (
    <section className="rozi-chat">
      <div className="chat-hero" aria-hidden="true"><Image src="/rozi/chat-hello.webp" alt="" width={480} height={480} sizes="150px" priority data-motion="wave" /></div>
      <div className="chat-log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`chat-row ${message.from}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small static Rozi face */}
            {message.from === "rozi" && <img src={message.tip ? "/rozi/chat-idea.webp" : "/rozi/faces/v1/happy.webp"} alt="" width={34} height={34} className={`chat-face ${message.tip ? "tip" : ""}`} />}
            <div className="chat-bubble">
              <p>{message.text}</p>
              {message.link && <Link href={message.link.href} className="chat-link">{message.link.label} <ArrowRight aria-hidden="true" /></Link>}
            </div>
          </div>
        ))}
        {thinking && <div className="chat-row rozi chat-thinking" role="status" aria-label="Rozi is thinking">
          <Image src="/rozi/chat-thinking.webp" alt="" width={480} height={480} sizes="46px" className="chat-face tip" />
          <div className="chat-bubble"><span className="typing-dots"><i /><i /><i /></span></div>
        </div>}
        <div ref={end} />
      </div>
      <div className="chat-suggestions">{SUGGESTED_QUESTIONS.map((question) => <button key={question} type="button" className="chip" onClick={() => ask(question)}>{question}</button>)}</div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
        <input value={draft} maxLength={MAX_MESSAGE_LENGTH} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Rozi…" aria-label="Ask Rozi" />
        <button type="submit" className="icon-button" aria-label="Send" disabled={!draft.trim()}><SendHorizontal aria-hidden="true" /></button>
      </form>
    </section>
  );
}
