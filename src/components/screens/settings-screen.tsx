"use client";

import { AccountCard, DataCard, TrainerInviteCard, TrainerLinkCard } from "@/components/app/account-cards";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { NotificationsCard } from "@/components/app/notifications-card";
import { AvatarPicker } from "@/components/app/avatar";
import { replayTour } from "@/components/app/tour-guide";
import { TrainerControls } from "@/components/trainer-controls";
import { CalendarDays, Palette, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { GOAL_OPTIONS, goalOf } from "@/lib/program";
import { MAX_TRAINING_DAYS, MIN_TRAINING_DAYS, shortDate, trainingDaysValid, WEEKDAY_LABELS } from "@/lib/dates";
import { FIGURE_OPTIONS } from "@/lib/figure";
import { EQUIPMENT_OPTIONS, RULE_VERSION, TEMPLATE_VERSION } from "@/lib/templates";
import type { Profile } from "@/lib/types";

export function SettingsScreen() {
  const { state, recordedSessions, updateState, isDemo, browserClient, updateProfile, refreshTrainerClients, setNotice, weightUnit, setWeightUnit, theme, setTheme, figure, setFigure, saveError, savingSession } = useFitTrack();
  function setEquipmentAvailability(availability: Profile["equipmentAvailability"]) {
    void updateProfile(availability === "unknown"
      ? { equipmentAvailability: "unknown", availableEquipment: [] }
      : { equipmentAvailability: "verified" });
  }

  function toggleAvailableEquipment(equipment: Profile["availableEquipment"][number]) {
    const availableEquipment = state.profile.availableEquipment.includes(equipment)
      ? state.profile.availableEquipment.filter((item) => item !== equipment)
      : [...state.profile.availableEquipment, equipment];
    void updateProfile({ equipmentAvailability: "verified", availableEquipment });
  }

  async function toggleDeadlift(enabled: boolean) {
    if (state.mode !== "demo") return;
    if (!window.confirm(enabled
      ? "Allow the hinge (deadlift) variation on this device? A trainer must still approve it for a signed-in account."
      : "Lock the hinge variation on this device?")) return;
    const nextProfile = { ...state.profile, deadliftEnabled: enabled };
    updateState({ ...state, profile: nextProfile });
    setNotice(enabled ? "Hinge variation allowed on this device. A trainer must approve it for a signed-in account." : "Deadlift variations are locked on this device.");
  }

  const profile = state.profile;
  const workouts = recordedSessions.filter((session) => session.status === "completed").length;

  return (
    <section className="settings">
      <article className="panel profile-card">
        <AvatarPicker />
        <div className="profile-id"><h2>{profile.displayName}</h2><p>{isDemo ? "Saved on this device only" : state.userEmail ?? "Signed in"}{profile.trainerRole && !isDemo ? " · Trainer" : ""}</p>
          <span className={`sync-pill ${isDemo ? "local" : saveError ? "error" : "ok"}`}><span className="save-dot" />{isDemo ? "Not synced — sign in to keep your data safe" : saveError ? "Sync needs attention" : savingSession ? "Saving…" : "Synced to your account"}</span></div>
        <dl className="profile-stats">
          <div><dd>{workouts}</dd><dt>workouts</dt></div>
          <div><dd>{profile.trainingDays.length}</dd><dt>days a week</dt></div>
          <div><dd>{shortDate(profile.trainingStartDate)}</dd><dt>started</dt></div>
        </dl>
      </article>

      <div className="settings-columns">
        <div className="settings-column">
          <article className="panel settings-group">
            <h3><CalendarDays aria-hidden="true" /> Your plan</h3>
            <label className="settings-field">Your name<input type="text" maxLength={80} autoComplete="given-name" value={profile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} /></label>
            <div className="settings-field"><span>Goal</span>
              <div className="goal-options">{GOAL_OPTIONS.map((option) => <button key={option.id} type="button" className={goalOf(profile) === option.id ? "selected" : ""} aria-pressed={goalOf(profile) === option.id} onClick={() => updateProfile({ goal: option.id })}><strong>{option.title}</strong><small>{option.note}</small></button>)}</div>
              <small>Changing your goal starts its plan from the first workout. Your history and records stay.</small>
            </div>
            <div className="settings-field"><span>Training days</span>
              <div className="onb-days">{WEEKDAY_LABELS.map((label, day) => <button key={label} type="button" className={profile.trainingDays.includes(day) ? "selected" : ""} aria-pressed={profile.trainingDays.includes(day)} onClick={() => {
                const next = profile.trainingDays.includes(day) ? profile.trainingDays.filter((value) => value !== day) : [...profile.trainingDays, day];
                if (trainingDaysValid(next)) void updateProfile({ trainingDays: next.sort((a, b) => a - b), sessionsPerWeek: next.length });
              }}>{label}</button>)}</div>
              <small>Between {MIN_TRAINING_DAYS} and {MAX_TRAINING_DAYS} days{profile.trainingDays.length >= 5 ? "; keep back-to-back days easy" : ""}. Missed sessions are never crammed into the next day.</small>
            </div>
            <div className="settings-field"><span>Session length</span>
              <div className="segmented">{[30, 40, 50].map((minutes) => <button key={minutes} type="button" className={profile.preferredSessionMinutes === minutes ? "selected" : ""} aria-pressed={profile.preferredSessionMinutes === minutes} onClick={() => updateProfile({ preferredSessionMinutes: minutes })}>{minutes} min</button>)}</div>
            </div>
            <div className="settings-field"><span>Equipment</span>
              <div className="segmented"><button type="button" className={profile.equipmentAvailability === "unknown" ? "selected" : ""} aria-pressed={profile.equipmentAvailability === "unknown"} onClick={() => setEquipmentAvailability("unknown")}>None / not sure</button><button type="button" className={profile.equipmentAvailability === "verified" ? "selected" : ""} aria-pressed={profile.equipmentAvailability === "verified"} onClick={() => setEquipmentAvailability("verified")}>I’ll tick what I have</button></div>
              {profile.equipmentAvailability === "verified" && <div className="onb-chips">{EQUIPMENT_OPTIONS.map((item) => <button key={item.id} type="button" className={profile.availableEquipment.includes(item.id) ? "selected" : ""} aria-pressed={profile.availableEquipment.includes(item.id)} onClick={() => toggleAvailableEquipment(item.id)}>{item.label}</button>)}</div>}
              <small>{profile.equipmentAvailability === "verified" ? (profile.availableEquipment.length ? "Your plan uses only what is ticked." : "Nothing ticked yet, so your plan uses bodyweight movements.") : "Your plan uses bodyweight movements only."}</small>
            </div>
          </article>

          <NotificationsCard />

          <article className="panel settings-group">
            <h3><Palette aria-hidden="true" /> Appearance</h3>
            <div className="settings-field"><span>Theme</span>
              <div className="theme-switch"><button type="button" className={theme === "pastel" ? "selected" : ""} aria-pressed={theme === "pastel"} onClick={() => setTheme("pastel")}><Sun aria-hidden="true" /> Soft pastel</button><button type="button" className={theme === "light" ? "selected" : ""} aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sparkles aria-hidden="true" /> Liquid glass</button></div>
            </div>
            <div className="settings-field"><span>Figure</span>
              <div className="segmented">{FIGURE_OPTIONS.map((option) => <button key={option.id} type="button" className={figure === option.id ? "selected" : ""} aria-pressed={figure === option.id} onClick={() => setFigure(option.id)}>{option.label}</button>)}</div>
              <small>The body drawing in pictures and muscle maps. It does not change your plan.</small>
            </div>
            <div className="settings-field"><span>Weight unit</span>
              <div className="segmented"><button type="button" className={weightUnit === "kg" ? "selected" : ""} aria-pressed={weightUnit === "kg"} onClick={() => setWeightUnit("kg")}>Kilograms</button><button type="button" className={weightUnit === "lb" ? "selected" : ""} aria-pressed={weightUnit === "lb"} onClick={() => setWeightUnit("lb")}>Pounds</button></div>
            </div>
          </article>
        </div>

        <div className="settings-column">
          {profile.trainerRole && !isDemo
            ? <TrainerControls client={browserClient} trainerId={profile.id} trainerRole={profile.trainerRole} clients={state.trainerClients ?? []} refresh={refreshTrainerClients} />
            : <article className="panel settings-group">
                <h3><ShieldCheck aria-hidden="true" /> Safety rules</h3>
                <div className="settings-row">
                  <div><strong>Deadlift movements</strong><small>{profile.deadliftEnabled ? "Approved by your trainer." : "Locked until your trainer approves them. Time in training never unlocks them."}</small></div>
                  {isDemo
                    ? <button type="button" className={`toggle ${profile.deadliftEnabled ? "on" : ""}`} role="switch" aria-checked={profile.deadliftEnabled} onClick={() => void toggleDeadlift(!profile.deadliftEnabled)} aria-label="Allow deadlift movements on this device"><span /></button>
                    : <span className={`settings-status ${profile.deadliftEnabled ? "ok" : ""}`}>{profile.deadliftEnabled ? "Approved" : "Locked"}</span>}
                </div>
                <div className="settings-row"><div><strong>Pain always means recovery</strong><small>If you tick pain in a check-in, that day switches to gentle recovery. This cannot be turned off.</small></div><span className="settings-status ok">On</span></div>
              </article>}
          <TrainerInviteCard onLinked={refreshTrainerClients} />
          <TrainerLinkCard />
          <AccountCard />
          <DataCard />
          <button type="button" className="button button-subtle replay-tour" onClick={replayTour}>Show the app tour again</button>
          <details className="why-plan">
            <summary>About this plan</summary>
            <p>Workouts are built by fixed, written rules from your schedule, equipment, check-ins and logged results. No AI service is involved.</p>
            <small>Exercise templates {TEMPLATE_VERSION} · Planning rules {RULE_VERSION}</small>
          </details>
        </div>
      </div>
    </section>
  );
}
