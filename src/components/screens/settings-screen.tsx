"use client";

import { AccountCard, DataCard, LiftSharingCard, RoziAiCard, TrainerInviteCard, TrainerLinkCard, TrainerModeCard } from "@/components/app/account-cards";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { NotificationsCard } from "@/components/app/notifications-card";
import { RoziMemorySettings } from "@/components/app/rozi-memory-settings";
import { RoziCheckinSettings } from "@/components/app/rozi-checkin-settings";
import { replayTour } from "@/components/app/tour-guide";
import { TrainerControls } from "@/components/trainer-controls";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Database, Dumbbell, Info, KeyRound, Moon, Palette, QrCode, ShieldCheck, Smartphone, Sparkles, Sun, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SettingsMenu, type MenuItem } from "@/components/app/settings-menu";
import { GOAL_OPTIONS, goalOf } from "@/lib/program";
import { equipmentPicture, FOCUS_OPTIONS, GYM_OPTIONS, gymPreset, ACTIVITY_OPTIONS } from "@/lib/onboarding";
import Image from "next/image";
import { LEVEL_OPTIONS, levelOf } from "@/lib/levels";
import { MAX_TRAINING_DAYS, MIN_TRAINING_DAYS, trainingDaysValid, WEEKDAY_LABELS } from "@/lib/dates";
import { FIGURE_OPTIONS } from "@/lib/figure";
import { EQUIPMENT_OPTIONS, RULE_VERSION, TEMPLATE_VERSION } from "@/lib/templates";
import type { Profile } from "@/lib/types";
import { useState } from "react";
import { SaveBar, useUnsavedGuard } from "@/components/app/save-bar";
import { BirthDateSetting, BodySettings } from "@/components/app/body-panel";
import type { Theme } from "@/components/app/fit-track-provider";

const THEME_OPTIONS: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "auto", label: "Auto", icon: Smartphone },
];

/** Drops draft fields that match what is saved, so undoing a change hides the Save bar again. */
function withoutUnchanged(draft: Partial<Profile>, saved: Profile): Partial<Profile> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    const before = (saved as unknown as Record<string, unknown>)[key];
    const same = Array.isArray(value) && Array.isArray(before) ? [...value].sort().join() === [...before].sort().join() : value === before;
    if (!same) next[key] = value;
  }
  // A level start date only matters with a changed level, and the day count only with changed days.
  if (next.experience === undefined) delete next.levelSince;
  if (next.trainingDays === undefined) delete next.sessionsPerWeek;
  return next as Partial<Profile>;
}

export function SettingsScreen() {
  const { state, currentDate, recordedSessions, updateState, isDemo, browserClient, updateProfile, refreshTrainerClients, setNotice, weightUnit, setWeightUnit, theme, setTheme, figure, setFigure, saveError, savingSession } = useFitTrack();
  // "Your plan" changes are held as a draft until Save; Discard drops them.
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const params = useSearchParams();
  const saved = state.profile;
  const profile: Profile = { ...saved, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const nameMissing = !profile.displayName.trim();
  function edit(patch: Partial<Profile>) {
    setDraft((current) => withoutUnchanged({ ...current, ...patch }, saved));
  }
  function saveDraft() {
    if (!dirty || nameMissing) return;
    updateProfile({ ...draft, ...(draft.displayName !== undefined ? { displayName: draft.displayName.trim() } : {}) });
    setDraft({});
  }
  useUnsavedGuard(dirty);

  function setEquipmentAvailability(availability: Profile["equipmentAvailability"]) {
    edit(availability === "unknown"
      ? { equipmentAvailability: "unknown", availableEquipment: [] }
      : { equipmentAvailability: "verified" });
  }

  function toggleAvailableEquipment(equipment: Profile["availableEquipment"][number]) {
    const availableEquipment = profile.availableEquipment.includes(equipment)
      ? profile.availableEquipment.filter((item) => item !== equipment)
      : [...profile.availableEquipment, equipment];
    edit({ equipmentAvailability: "verified", availableEquipment });
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

  const workouts = recordedSessions.filter((session) => session.status === "completed").length;

  const section = params.get("section");
  // In a buddy group the goal and days are shared: they change through Train together, not here.
  const synced = Boolean(saved.buddyAnchor) && !isDemo;
  const themeLabel = THEME_OPTIONS.find((option) => option.id === theme)?.label ?? "Auto";
  const items: MenuItem[] = [
    { group: "Account", id: "account", icon: KeyRound, color: "#5b9bd5", label: "Account", note: isDemo ? "Not signed in" : state.userEmail ?? "Signed in", keywords: "sign in sign out email login delete" },
    { group: "Account", id: "data", icon: Database, color: "#7a8a99", label: "Your data", note: "Rozi AI, sharing, export or delete", keywords: "export download delete backup ai rozi gemini groq privacy sharing memory remember check-in checkin weekly" },
    { group: "Preferences", id: "plan", icon: CalendarDays, color: "#3fae8c", label: "Your plan", note: "Goal, level, days, equipment", value: `${saved.trainingDays.length} days · ${saved.preferredSessionMinutes} min`, keywords: "goal level days session length equipment body height weight bmi why name age birthday date of birth dob 18 adult activity active typical day seated" },
    { group: "Preferences", id: "notifications", icon: Bell, color: "#e5a33b", label: "Notifications", note: "Reminders, water, nudges", keywords: "push reminder morning evening water comeback nudge weigh" },
    { group: "Preferences", id: "appearance", icon: Palette, color: "#9b7be0", label: "Appearance", note: "Theme, figure, units", value: themeLabel, keywords: "dark light theme figure male female units kg lb pounds" },
    { group: "Trainers & safety", id: "safety", icon: ShieldCheck, color: "#3fae8c", label: profile.trainerRole && !isDemo ? "Your clients" : "Safety rules", note: profile.trainerRole && !isDemo ? "Rules for each client" : "Deadlifts, pain = recovery", keywords: "deadlift pain trainer clients rules" },
    ...(profile.trainerRole && !isDemo ? [{ group: "Trainers & safety", id: "clients", href: "/clients", icon: Dumbbell, color: "#ef7d5c", label: "My clients", note: "Requests, client cards, gym QR, message all", keywords: "clients dashboard qr broadcast message requests" } as MenuItem] : []),
    { group: "Trainers & safety", id: "trainers", icon: Users, color: "#5b9bd5", label: "Trainers", note: profile.trainerRole && !isDemo ? "Trainer mode, add clients, your own trainers" : "Your trainers · become a trainer", keywords: "trainer code coach link qr share" },
    { group: "Help", id: "tour", icon: Sparkles, color: "#ef7d5c", label: "Show the app tour", note: "A quick walk through", onClick: replayTour, keywords: "help tour guide" },
    { group: "Help", id: "install", href: "/install", icon: QrCode, color: "#16181a", label: "Install / share", note: "Home Screen app and QR code", keywords: "install qr share phone" },
    { group: "Help", id: "about", icon: Info, color: "#7a8a99", label: "About this plan", note: `Rules ${RULE_VERSION}`, keywords: "about version rules templates" },
  ];

  if (!section || !items.some((item) => item.id === section && !item.href && !item.onClick)) {
    return <SettingsMenu items={items} profileCard={(
      // Your picture and name live on Profile (one tap back); Settings keeps only where your data is saved.
      <Link href={isDemo ? "/sign-in" : "/settings?section=account"} className="settings-me settings-sync" aria-label={isDemo ? "Sign in to sync your data" : "Account and sync"}>
        <span><small>{isDemo ? "Saved on this device only" : state.userEmail ?? "Signed in"}{profile.trainerRole && !isDemo ? " · Trainer" : ""} · {workouts} workouts</small>
          <span className={`sync-pill ${isDemo ? "local" : saveError ? "error" : "ok"}`}><span className="save-dot" />{isDemo ? "Not synced — sign in to keep your data safe" : saveError ? "Sync needs attention" : savingSession ? "Saving…" : "Synced to your account"}</span></span>
        <ChevronRight aria-hidden="true" />
      </Link>
    )} />;
  }

  const current = items.find((item) => item.id === section)!;
  return (
    <section className="settings settings-detail">
      <Link href="/settings" className="settings-back"><ChevronLeft aria-hidden="true" /> Settings</Link>
      <h2>{current.label}</h2>
      {dirty && <SaveBar onSave={saveDraft} onDiscard={() => setDraft({})} disabled={nameMissing} note={nameMissing ? "Add your name to save" : undefined} />}
      {section === "plan" && <>
          <article className="panel settings-group">
            <h3><CalendarDays aria-hidden="true" /> Your plan</h3>
            <label className="settings-field">Your name<input type="text" maxLength={80} autoComplete="given-name" value={profile.displayName} onChange={(event) => edit({ displayName: event.target.value })} /></label>
            <div className="settings-field"><span>Goal</span>
              <div className="goal-options">{GOAL_OPTIONS.map((option) => <button key={option.id} type="button" disabled={synced} className={goalOf(profile) === option.id ? "selected" : ""} aria-pressed={goalOf(profile) === option.id} onClick={() => edit({ goal: option.id })}><strong>{option.title}</strong><small>{option.note}</small></button>)}</div>
              <small>{synced ? <>Shared with your training buddies. <Link href="/buddies">Propose a change in Train together</Link>.</> : "Changing your goal starts its plan from the first workout. Your history and records stay."}</small>
            </div>
            <BodySettings />
            <BirthDateSetting />
            <div className="settings-field"><span>Level</span>
              <div className="segmented level-switch">{LEVEL_OPTIONS.map((option) => <button key={option.id} type="button" className={levelOf(profile) === option.id ? "selected" : ""} aria-pressed={levelOf(profile) === option.id} onClick={() => edit({ experience: option.id, levelSince: currentDate })}>{option.title}</button>)}</div>
              <small>{LEVEL_OPTIONS.find((option) => option.id === levelOf(profile))?.note}. RozFit moves you up by itself as you train; see Progress → Your level.</small>
            </div>
            <div className="settings-field"><span>Focus muscle</span>
              <div className="onb-chips">{FOCUS_OPTIONS.map((option) => <button key={option.id} type="button" className={(profile.focusArea ?? "balanced") === option.id ? "selected" : ""} aria-pressed={(profile.focusArea ?? "balanced") === option.id} onClick={() => edit({ focusArea: option.id })}>{option.label}</button>)}</div>
              <small>A focus muscle gets one extra set when it’s trained. Balanced keeps everything even.</small>
            </div>
            <div className="settings-field"><span>Your typical day</span>
              <div className="onb-chips">{ACTIVITY_OPTIONS.map((option) => <button key={option.id} type="button" className={profile.dailyActivity === option.id ? "selected" : ""} aria-pressed={profile.dailyActivity === option.id} onClick={() => edit({ dailyActivity: option.id })}>{option.label}</button>)}</div>
              <small>Outside your workouts. Tunes your water target and stretch suggestions.</small>
            </div>
            <div className="settings-field"><span>Where you train</span>
              <div className="onb-chips">{GYM_OPTIONS.map((option) => <button key={option.id} type="button" className={profile.gymType === option.id ? "selected" : ""} aria-pressed={profile.gymType === option.id} onClick={() => edit({ gymType: option.id, equipmentAvailability: option.id === "bodyweight" ? "unknown" : "verified", availableEquipment: gymPreset(option.id) })}>{option.label}</button>)}</div>
              <small>Choosing a place fills in its usual equipment below; adjust it if yours is different.</small>
            </div>
            <div className="settings-field"><span>Training days</span>
              <div className="onb-days">{WEEKDAY_LABELS.map((label, day) => <button key={label} type="button" disabled={synced} className={profile.trainingDays.includes(day) ? "selected" : ""} aria-pressed={profile.trainingDays.includes(day)} onClick={() => {
                const next = profile.trainingDays.includes(day) ? profile.trainingDays.filter((value) => value !== day) : [...profile.trainingDays, day];
                if (trainingDaysValid(next)) edit({ trainingDays: next.sort((a, b) => a - b), sessionsPerWeek: next.length });
              }}>{label}</button>)}</div>
              {synced && <small className="synced-note">Same days as your training buddies — change them together in <Link href="/buddies">Train together</Link>.</small>}
              <small>Between {MIN_TRAINING_DAYS} and {MAX_TRAINING_DAYS} days{profile.trainingDays.length >= 5 ? "; keep back-to-back days easy" : ""}. Missed sessions are never crammed into the next day.</small>
            </div>
            <div className="settings-field"><span>Session length</span>
              <div className="segmented">{[30, 40, 50].map((minutes) => <button key={minutes} type="button" className={profile.preferredSessionMinutes === minutes ? "selected" : ""} aria-pressed={profile.preferredSessionMinutes === minutes} onClick={() => edit({ preferredSessionMinutes: minutes })}>{minutes} min</button>)}</div>
            </div>
            <div className="settings-field"><span>Equipment</span>
              <div className="segmented"><button type="button" className={profile.equipmentAvailability === "unknown" ? "selected" : ""} aria-pressed={profile.equipmentAvailability === "unknown"} onClick={() => setEquipmentAvailability("unknown")}>None / not sure</button><button type="button" className={profile.equipmentAvailability === "verified" ? "selected" : ""} aria-pressed={profile.equipmentAvailability === "verified"} onClick={() => setEquipmentAvailability("verified")}>I’ll tick what I have</button></div>
              {profile.equipmentAvailability === "verified" && <div className="equip-tiles">{EQUIPMENT_OPTIONS.map((item) => {
                const on = profile.availableEquipment.includes(item.id);
                return <button key={item.id} type="button" className={`equip-tile ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => toggleAvailableEquipment(item.id)}>
                  <Image src={equipmentPicture(item.id)} unoptimized={equipmentPicture(item.id).endsWith(".svg")} alt="" width={96} height={96} sizes="72px" /><span>{item.label}</span>{on && <i className="equip-tile-check"><Check aria-hidden="true" /></i>}
                </button>;
              })}</div>}
              <small>{profile.equipmentAvailability === "verified" ? (profile.availableEquipment.length ? "Your plan uses only what is ticked." : "Nothing ticked yet, so your plan uses bodyweight movements.") : "Your plan uses bodyweight movements only."}</small>
            </div>
          </article>

      </>}
      {section === "notifications" && <NotificationsCard />}
      {section === "appearance" && <>
          <article className="panel settings-group">
            <h3><Palette aria-hidden="true" /> Appearance</h3>
            <div className="settings-field"><span>Theme</span>
              <div className="segmented theme-switch">{THEME_OPTIONS.map((option) => <button key={option.id} type="button" className={theme === option.id ? "selected" : ""} aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}><option.icon aria-hidden="true" /> {option.label}</button>)}</div>
            </div>
            <div className="settings-field"><span>Figure</span>
              <div className="segmented">{FIGURE_OPTIONS.map((option) => <button key={option.id} type="button" className={figure === option.id ? "selected" : ""} aria-pressed={figure === option.id} onClick={() => setFigure(option.id)}>{option.label}</button>)}</div>
              <small>The body drawing in pictures and muscle maps. It does not change your plan.</small>
            </div>
            <div className="settings-field"><span>Weight unit</span>
              <div className="segmented"><button type="button" className={weightUnit === "kg" ? "selected" : ""} aria-pressed={weightUnit === "kg"} onClick={() => setWeightUnit("kg")}>Kilograms</button><button type="button" className={weightUnit === "lb" ? "selected" : ""} aria-pressed={weightUnit === "lb"} onClick={() => setWeightUnit("lb")}>Pounds</button></div>
            </div>
          </article>
      </>}
      {section === "safety" && <>
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
      </>}
      {section === "trainers" && <><TrainerModeCard /><TrainerInviteCard onLinked={refreshTrainerClients} /><TrainerLinkCard /></>}
      {section === "account" && <AccountCard />}
      {section === "data" && <><RoziAiCard /><RoziMemorySettings /><RoziCheckinSettings /><LiftSharingCard /><DataCard /></>}
      {section === "about" && <>
          <details className="why-plan" open>
            <summary>About this plan</summary>
            <p>Workouts are built by fixed, written rules from your schedule, equipment, check-ins and logged results. No AI service is involved.</p>
            <small>Exercise templates {TEMPLATE_VERSION} · Planning rules {RULE_VERSION}</small>
          </details>
      </>}
    </section>
  );
}
