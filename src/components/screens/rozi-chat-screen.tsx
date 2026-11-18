"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Bookmark, History, Play, Plus, SendHorizontal, Smartphone, Sparkles } from "lucide-react";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, hourIn, nextTrainingDate, weekDates } from "@/lib/dates";
import { calculatePersonalRecords } from "@/lib/progress";
import { calculateStreak } from "@/lib/rozi";
import { suggestionForDay } from "@/lib/mobility";
import { BMI_BAND_LABEL, bmi, bmiBand } from "@/lib/body";
import { muscleRecovery, readyCount, recoveryLine, weeklyReport } from "@/lib/recovery";
import { detectIntent, MAX_MESSAGE_LENGTH, SUGGESTED_QUESTIONS, type RoziIntent } from "@/lib/rozi-chat";
import { planWorkout, type RoziPlan } from "@/lib/rozi-plan";
import { routinePlan } from "@/lib/pro-tracking";
import { saveRoutine } from "@/lib/routines-store";
import { getExerciseDefinition } from "@/lib/templates";
import type { WorkoutSession } from "@/lib/types";
import { isAdult } from "@/lib/discover";
import type { RoziCard } from "@/lib/rozi-ai/cards";
import { askRoziAi, chatHistory, readRoziAiChoice, ROZI_AI_CHOICE_EVENT, saveRoziAiChoice, type RoziAiChoice } from "@/lib/rozi-ai/client";
import { RoziCards } from "@/components/app/rozi-cards";
import { RoziHistorySheet } from "@/components/app/rozi-history-sheet";
import { loadConversation, saveReply, type RoziStoredMessage } from "@/lib/rozi-ai/history";

interface Message {
  from: "me" | "rozi"; text: string; link?: { href: string; label: string }; tip?: boolean; plan?: RoziPlan;
  /** Cards from Rozi AI (built on the server from real data). */
  cards?: RoziCard[];
  /** "ai" = answered by Rozi AI · "phone" = Rozi AI was on but busy, so answered on this phone. */
  source?: "ai" | "phone";
}

/**
 * Ask Rozi: questions answered from the person's own saved workouts. With Rozi AI switched on (signed-in adults), the
 * question goes to /api/rozi/chat, which answers from the same data with an AI model and returns cards; otherwise —
 * and whenever the AI can't answer — Rozi answers on this phone. Nothing is made up: with no data, Rozi says so.
 */
export function RoziChatScreen() {
  const { state, recordedSessions, currentDate, planningProfile, upsertSession, isDemo, browserClient, setNotice } = useFitTrack();
  const router = useRouter();
  const { plan, session: today } = useWorkoutDay(currentDate, DEFAULT_CHECK_IN);
  const name = state.profile.displayName;
  const greeting: Message = { from: "rozi", text: `Hey ${name}! I’m Rozi. Ask me about your workouts, streak, progress or stretches — I answer from what you’ve logged.` };
  const [messages, setMessages] = useState<Message[]>([greeting]);
  // Rozi AI chat history (stage 6): the conversation this chat is saved to, and the history sheet.
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, thinking]);

  // Rozi AI: for signed-in adults who switched it on (Settings → Your data, or the card below). Otherwise — and
  // whenever the AI can't answer — Rozi answers on this phone, exactly as before.
  const [aiChoice, setAiChoice] = useState<RoziAiChoice>(null);
  const [choiceRead, setChoiceRead] = useState(false);
  useEffect(() => {
    const sync = () => { setAiChoice(readRoziAiChoice()); setChoiceRead(true); };
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(ROZI_AI_CHOICE_EVENT, sync);
    return () => { window.clearTimeout(timer); window.removeEventListener(ROZI_AI_CHOICE_EVENT, sync); };
  }, []);
  const canUseAi = !isDemo && Boolean(browserClient) && isAdult(state.profile.birthYear, Number(currentDate.slice(0, 4)));
  const aiOn = canUseAi && aiChoice === "on";
  const offerAi = canUseAi && choiceRead && aiChoice === null;

  const completed = recordedSessions.filter((item) => item.status === "completed" && item.date <= currentDate).sort((a, b) => a.date.localeCompare(b.date));

  function answer(intent: RoziIntent, question: string): Message {
    switch (intent) {
      case "PLAN_WORKOUT": {
        const made = planWorkout(question, planningProfile);
        if (!made) return { from: "rozi", text: "I couldn’t find moves for that with your equipment. Add equipment in Settings → Your plan, or try another body area.", link: { href: "/settings?section=plan", label: "Your plan" } };
        return { from: "rozi", plan: made, text: `Here’s a ${made.routine.name.replace(" · by Rozi", "").toLowerCase()} for you — ${made.routine.exercises.length} moves, about ${made.minutes} minutes. ${made.note}` };
      }
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
    const history = chatHistory(messages.slice(1));
    setMessages((current) => [...current, { from: "me", text: question }]);
    setDraft("");
    setThinking(true);
    if (!aiOn || !browserClient) {
      // A short "thinking" moment with Rozi, so the answer feels like a reply (the answer itself is instant).
      const reply = answer(detectIntent(question), question);
      window.setTimeout(() => { setMessages((current) => [...current, reply]); setThinking(false); }, 650);
      return;
    }
    const client = browserClient;
    void askRoziAi(client, question, history, fetch, conversationId).then((result) => {
      let reply: Message;
      if (result.conversationId) setConversationId(result.conversationId);
      if (result.ok) {
        const plan = result.cards.find((card) => card.type === "plan");
        reply = { from: "rozi", text: result.text, cards: result.cards, source: "ai", ...(plan?.type === "plan" ? { plan: plan.plan } : {}) };
      } else if (!result.fallback) {
        reply = { from: "rozi", text: result.message };
      } else {
        const intent = detectIntent(question);
        reply = { ...answer(intent, question), source: "phone" };
        // The question is already in history: save the on-phone answer next to it.
        if (result.conversationId) void saveReply(client, result.conversationId, { text: reply.text, intent, source: "phone" });
      }
      setMessages((current) => [...current, reply]);
      setThinking(false);
    });
  }

  /** Starts a fresh chat (the current one stays in history). */
  function newChat() {
    setConversationId(null);
    setMessages([greeting]);
    setDraft("");
  }

  /** Opens a saved conversation from history. */
  async function openConversation(id: string) {
    if (!browserClient) return;
    setShowHistory(false);
    const stored = await loadConversation(browserClient, id);
    if (!stored) { setNotice("That chat couldn't be opened."); return; }
    const restored = stored.messages.map((item: RoziStoredMessage): Message => {
      if (item.sender === "me") return { from: "me", text: item.message };
      const plan = item.cards?.find((card) => card.type === "plan");
      return { from: "rozi", text: item.message, ...(item.cards?.length ? { cards: item.cards } : {}), ...(item.source ? { source: item.source } : {}), ...(plan?.type === "plan" ? { plan: plan.plan } : {}) };
    });
    setConversationId(stored.id);
    setMessages([greeting, ...restored]);
  }

  /** Start Rozi's plan as today's workout (same rules as My routines). */
  function startPlan(plan: RoziPlan) {
    const today = sessionForDate(state, currentDate);
    if (today && today.status !== "planned") { setNotice(today.status === "completed" ? "You already trained today. Save it as a routine for another day." : "A workout is already in progress today."); router.push("/today"); return; }
    const session: WorkoutSession = { id: today?.id ?? (state.mode === "demo" ? `demo-${currentDate}-planned` : crypto.randomUUID()), date: currentDate, status: "planned", plan: routinePlan(plan.routine, currentDate), exerciseLogs: [] };
    void upsertSession(session);
    router.push("/today");
  }

  async function savePlan(plan: RoziPlan) {
    try {
      const saved = await saveRoutine(isDemo ? null : browserClient, { ...plan.routine, id: `local-${Date.now()}` });
      setNotice(`Saved “${saved.name}” to My routines.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "That couldn’t be saved."); }
  }

  return (
    <section className="rozi-chat">
      <div className="rozi-chat-top">
        <button type="button" className="text-button rozi-back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}><ArrowLeft aria-hidden="true" /> Back</button>
        {aiOn && <div className="rozi-chat-actions">
          <button type="button" className="text-button" onClick={() => setShowHistory(true)}><History aria-hidden="true" /> History</button>
          <button type="button" className="text-button" onClick={newChat} disabled={messages.length <= 1}><Plus aria-hidden="true" /> New chat</button>
        </div>}
      </div>
      <div className="chat-hero" aria-hidden="true"><Image src="/rozi/chat-hello.webp" alt="" width={480} height={480} sizes="150px" priority data-motion="wave" /></div>
      <div className="chat-log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`chat-row ${message.from}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small static Rozi face */}
            {message.from === "rozi" && <img src={message.tip ? "/rozi/chat-idea.webp" : "/rozi/faces/v1/happy.webp"} alt="" width={34} height={34} className={`chat-face ${message.tip ? "tip" : ""}`} />}
            <div className="chat-bubble">
              <p>{message.text}</p>
              {message.plan && <div className="rozi-plan">
                <ol>{message.plan.routine.exercises.map((item) => <li key={item.exerciseId}><span>{getExerciseDefinition(item.exerciseId)?.name ?? "Exercise"}</span><small>{item.sets} × {item.reps}</small></li>)}</ol>
                <div className="rozi-plan-actions">
                  <button type="button" className="button button-primary small" onClick={() => startPlan(message.plan!)}><Play aria-hidden="true" /> Start now</button>
                  <button type="button" className="button button-subtle small" onClick={() => void savePlan(message.plan!)}><Bookmark aria-hidden="true" /> Save as routine</button>
                </div>
              </div>}
              {message.cards && <RoziCards cards={message.cards} />}
              {message.link && <Link href={message.link.href} className="chat-link">{message.link.label} <ArrowRight aria-hidden="true" /></Link>}
              {message.source === "ai" && <span className="rozi-ai-tag"><Sparkles aria-hidden="true" /> Answered with AI</span>}
              {message.source === "phone" && <span className="rozi-ai-tag"><Smartphone aria-hidden="true" /> Answered on your phone — Rozi AI is busy</span>}
            </div>
          </div>
        ))}
        {offerAi && <section className="rozi-optin" aria-label="Rozi AI">
          <h3><Sparkles aria-hidden="true" /> Smarter answers from Rozi</h3>
          <p>Rozi can use an AI model (Groq or Google Gemini) to understand any question and explain your training. To answer, it sends your question and only the workout details it needs — like sets, weights, height and body weight. Never your name, email or phone.</p>
          <p>AI providers may keep questions for a while to run and improve their service. You can switch this off anytime in Settings → Your data.</p>
          <div className="rozi-optin-actions">
            <button type="button" className="button button-primary small" onClick={() => saveRoziAiChoice("on")}><Sparkles aria-hidden="true" /> Turn on Rozi AI</button>
            <button type="button" className="button button-subtle small" onClick={() => saveRoziAiChoice("off")}>Not now</button>
          </div>
        </section>}
        {thinking && <div className="chat-row rozi chat-thinking" role="status" aria-label="Rozi is thinking">
          <Image src="/rozi/chat-thinking.webp" alt="" width={480} height={480} sizes="46px" className="chat-face tip" />
          <div className="chat-bubble"><span className="typing-dots"><i /><i /><i /></span></div>
        </div>}
        <div ref={end} className="rozi-chat-end" />
      </div>
      <div className="chat-suggestions">{SUGGESTED_QUESTIONS.map((question) => <button key={question} type="button" className="chip" onClick={() => ask(question)}>{question}</button>)}</div>
      {showHistory && browserClient && <RoziHistorySheet client={browserClient} today={currentDate} currentId={conversationId}
        onOpen={(id) => void openConversation(id)} onDeleted={(id) => { if (id === null || id === conversationId) newChat(); }} onClose={() => setShowHistory(false)} />}
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
        <input value={draft} maxLength={MAX_MESSAGE_LENGTH} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Rozi…" aria-label="Ask Rozi" />
        <button type="submit" className="icon-button" aria-label="Send" disabled={!draft.trim()}><SendHorizontal aria-hidden="true" /></button>
      </form>
    </section>
  );
}
