"use client";

import { useRouter } from "next/navigation";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, describeNextDay, nextTrainingDate, shiftDate, todayHref, weekdayOf, WEEKDAY_LABELS } from "@/lib/dates";

export function OverviewScreen() {
  const router = useRouter();
  const { state, currentDate, recordedSessions } = useFitTrack();
  const { session: todaySession, generatedPlan } = useWorkoutDay(currentDate, DEFAULT_CHECK_IN);
  const dueToday = Boolean(generatedPlan || todaySession);
  const completedSessions = recordedSessions.filter((session) => session.status === "completed");
  const completedThisWeek = completedSessions.filter((session) => {
    const daysAgo = (Date.parse(`${currentDate}T12:00:00Z`) - Date.parse(`${session.date}T12:00:00Z`)) / 86_400_000;
    return daysAgo >= 0 && daysAgo < 7;
  }).length;

  function openNextWorkout() {
    const next = nextTrainingDate(state.profile, currentDate);
    if (next) router.push(todayHref(next, currentDate));
  }

  return (
    <section className="overview-page">
      <div className="welcome-row"><div><p className="welcome-kicker">You’re building a rhythm</p><h2>Good to see you, {state.profile.displayName} <span>✦</span></h2><p className="muted">A little consistency goes a long way. Let’s take today one step at a time.</p></div><div className="streak-pill"><span className="streak-icon">✧</span><div><strong>{completedThisWeek} / {state.profile.sessionsPerWeek}</strong><small>sessions this week</small></div></div></div>

      <div className="dashboard-grid">
        <div className="primary-column">
          <article className="today-card">
            <div className="today-card-top"><div><span className="pill pill-light">{dueToday ? "YOUR NEXT SESSION" : "REST & RECOVER"}</span><p className="card-date">{dateLabel(currentDate)}</p></div><span className="session-number">{todaySession?.status === "completed" ? "✓" : "01"}</span></div>
            <div className="today-card-content">
              <div className="today-card-copy"><h3>{dueToday ? (todaySession?.plan.title ?? generatedPlan?.title) : "A rest day is part of the plan"}</h3><p>{dueToday ? (todaySession?.plan.description ?? generatedPlan?.description) : `Your next planned session is ${describeNextDay(state.profile, currentDate)}.`}</p><div className="today-meta"><span><b>◷</b> {todaySession?.plan.durationMinutes ?? generatedPlan?.durationMinutes ?? state.profile.preferredSessionMinutes} min</span><span><b>▦</b> {todaySession?.plan.exercises.length ?? generatedPlan?.exercises.length ?? 0} movements</span><span><b>⌁</b> Beginner friendly</span></div>
                {dueToday ? <button className="button button-white" onClick={() => router.push("/today")}>{todaySession?.status === "completed" ? "View session" : todaySession?.status === "in_progress" ? "Continue workout" : "Start today’s workout"}<span>→</span></button> : <button className="button button-white" onClick={openNextWorkout}>View next session <span>→</span></button>}
              </div>
              <div className="workout-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-disc"><span>✦</span></div><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">·</div><div className="art-spark spark-three">✧</div></div>
            </div>
            <div className="today-card-footer"><span><span className="footer-check">✓</span> Your plan follows your weekly rhythm</span><span>Template {todaySession?.plan.templateVersion ?? generatedPlan?.templateVersion ?? "1.0.0"}</span></div>
          </article>

          <div className="section-heading"><div><h3>This week</h3><p>A rhythm that fits your week</p></div><button className="text-button" onClick={() => router.push("/progress")}>See progress <span>→</span></button></div>
          <div className="week-card">
            {Array.from({ length: 7 }, (_, index) => {
              const weekday = (weekdayOf(currentDate) + index) % 7;
              const itemDate = shiftDate(currentDate, index);
              const session = sessionForDate(state, itemDate);
              const scheduled = state.profile.trainingDays.includes(weekday);
              const isToday = itemDate === currentDate;
              return <button key={itemDate} className={`week-day ${isToday ? "today" : ""} ${scheduled ? "scheduled" : ""}`} onClick={() => router.push(todayHref(itemDate, currentDate))} aria-label={`${dateLabel(itemDate)}, ${session?.status ?? (scheduled ? "planned workout" : "rest day")}`}>
                <small>{WEEKDAY_LABELS[weekday]}</small><strong>{Number(itemDate.slice(-2))}</strong><span className={`week-marker ${session?.status === "completed" ? "done" : scheduled ? "planned" : "rest"}`}>{session?.status === "completed" ? "✓" : scheduled ? "·" : ""}</span>
              </button>;
            })}
          </div>

          <div className="section-heading section-heading-spaced"><div><h3>Pick up where you left off</h3><p>Your recent training at a glance</p></div></div>
          <div className="recent-list">
            {completedSessions.slice(-2).reverse().map((session) => <button className="recent-row" key={session.id} onClick={() => router.push(todayHref(session.date, currentDate))}>
              <span className="recent-icon">✦</span><span className="recent-label"><strong>{session.plan.title}</strong><small>{dateLabel(session.date)} · {session.plan.exercises.length} movements</small></span><span className="status-complete">Completed</span><span className="row-arrow">→</span>
            </button>)}
            {completedSessions.length === 0 && <div className="empty-inline">Your first completed workout will show up here.</div>}
          </div>
        </div>

        <aside className="secondary-column">
          <article className="readiness-card"><div className="side-card-title"><span className="side-card-icon purple-icon">☼</span><div><h3>Today’s check-in</h3><p>A quick pause before you begin</p></div></div><div className="readiness-meter"><div className="meter-label"><span>Ready for training</span><strong>{todaySession?.checkIn ? `${Math.round(todaySession.checkIn.energy / 5 * 100)}%` : "—"}</strong></div><div className="meter-track"><span style={{ width: `${todaySession?.checkIn ? todaySession.checkIn.energy / 5 * 100 : 0}%` }} /></div><p>{todaySession?.checkIn ? `Energy ${todaySession.checkIn.energy}/5 · Soreness ${todaySession.checkIn.soreness}/5` : "Your plan will adjust to how you feel."}</p></div><button className="button button-subtle full-width" onClick={() => router.push("/today")}>{todaySession?.checkIn ? "Review check-in" : "Do your check-in"}<span>→</span></button></article>

          <article className="goal-card"><div className="goal-head"><span className="side-card-icon green-icon">✧</span><span className="goal-caption">YOUR WEEKLY GOAL</span></div><strong className="goal-number">{Math.min(completedThisWeek, state.profile.sessionsPerWeek)}<span> / {state.profile.sessionsPerWeek}</span></strong><p>sessions completed</p><div className="goal-progress"><span style={{ width: `${Math.min(100, completedThisWeek / Math.max(1, state.profile.sessionsPerWeek) * 100)}%` }} /></div><div className="goal-footer"><span>{Math.max(0, state.profile.sessionsPerWeek - completedThisWeek)} to go this week</span><span>✦</span></div></article>

          <article className="tip-card"><span className="tip-spark">✦</span><span className="pill pill-tip">A GENTLE REMINDER</span><p>Leave a little energy in the tank. You can always do a bit more next time.</p><small>FITTRACK PRINCIPLE 01</small></article>

          <div className="rule-note"><span>⌁</span><p><strong>Made for steady progress</strong><br />No AI API or daily prompt needed. Your plan uses transparent rules and saved templates.</p></div>
        </aside>
      </div>
    </section>
  );
}
