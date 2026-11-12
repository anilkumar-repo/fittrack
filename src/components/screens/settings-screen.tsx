"use client";

import { AccountCard, DataCard, TrainerInviteCard, TrainerLinkCard } from "@/components/app/account-cards";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { TrainerControls } from "@/components/trainer-controls";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { EQUIPMENT_OPTIONS, RULE_VERSION, TEMPLATE_VERSION } from "@/lib/templates";
import type { Profile } from "@/lib/types";

function adjustTrainingDays(days: number[], count: number): number[] {
  const order = [2, 4, 6, 1, 3, 5, 0];
  const selected = [...days];
  for (const day of order) {
    if (selected.length >= count) break;
    if (!selected.includes(day)) selected.push(day);
  }
  return selected.slice(0, count);
}

export function SettingsScreen() {
  const { state, updateState, isDemo, browserClient, updateProfile, refreshTrainerClients, setNotice, weightUnit, setWeightUnit } = useFitTrack();
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
      ? "Enable the demo-only hinge variation? This does not change trainer approval in Supabase."
      : "Lock the hinge variation in this demo?")) return;
    const nextProfile = { ...state.profile, deadliftEnabled: enabled };
    updateState({ ...state, profile: nextProfile });
    setNotice(enabled ? "Demo-only hinge setting changed. A signed-in trainer must approve this for a client." : "Deadlift variations are locked in this demo.");
  }

  return (
    <section className="trainer-page">
      <div className="page-intro"><div><span className="eyebrow">The plan behind your plan</span><h2>Keep the rules simple and clear.</h2><p>Update the weekly rhythm and see what is currently guiding the workouts.</p></div></div>
      <div className="trainer-grid">
        <article className="panel settings-panel"><div className="section-heading"><div><h3>Your profile</h3><p>Basic training preferences</p></div><span className="pill pill-outline">{isDemo ? "DEMO" : "SAVED"}</span></div><label className="field-label">Your name<input type="text" value={state.profile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} /></label><label className="field-label">Sessions per week<select value={state.profile.sessionsPerWeek} onChange={(event) => { const count = Number(event.target.value); void updateProfile({ sessionsPerWeek: count, trainingDays: adjustTrainingDays(state.profile.trainingDays, count) }); }}><option value={2}>2 days</option><option value={3}>3 days</option><option value={4}>4 days</option></select></label><div className="field-label"><span>Training days</span><div className="training-days">{WEEKDAY_LABELS.map((label, day) => <button key={label} className={state.profile.trainingDays.includes(day) ? "selected" : ""} onClick={() => {
          const next = state.profile.trainingDays.includes(day) ? state.profile.trainingDays.filter((value) => value !== day) : [...state.profile.trainingDays, day];
          if (next.length >= 2 && next.length <= 4) void updateProfile({ trainingDays: next, sessionsPerWeek: next.length });
        }}>{label}</button>)}</div><small className="field-hint">Choose 2–4 days. Missed sessions are not carried forward or crammed into the next day.</small></div><label className="field-label">Preferred session length<select value={state.profile.preferredSessionMinutes} onChange={(event) => updateProfile({ preferredSessionMinutes: Number(event.target.value) })}><option value={30}>About 30 minutes</option><option value={40}>About 40 minutes</option><option value={50}>About 50 minutes</option></select></label><label className="field-label">Weight unit<select value={weightUnit} onChange={(event) => setWeightUnit(event.target.value === "lb" ? "lb" : "kg")}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select><small className="field-hint">Used for loads and body weight on this device.</small></label><div className="field-label"><span>Available equipment</span><div className="availability-buttons"><button type="button" className={state.profile.equipmentAvailability === "unknown" ? "selected" : ""} aria-pressed={state.profile.equipmentAvailability === "unknown"} onClick={() => setEquipmentAvailability("unknown")}>Not confirmed</button><button type="button" className={state.profile.equipmentAvailability === "verified" ? "selected" : ""} aria-pressed={state.profile.equipmentAvailability === "verified"} onClick={() => setEquipmentAvailability("verified")}>Confirm what is available</button></div><small className="field-hint">Unknown equipment uses safe alternatives. Confirmed equipment is used only when checked below.</small></div>{state.profile.equipmentAvailability === "verified" && <div className="equipment-options">{EQUIPMENT_OPTIONS.map((item) => <label className="checkbox-row" key={item.id}><input type="checkbox" checked={state.profile.availableEquipment.includes(item.id)} onChange={() => toggleAvailableEquipment(item.id)} /><span><strong>{item.label}</strong></span></label>)}{state.profile.availableEquipment.length === 0 && <small className="field-hint">No gym equipment selected. The plan will use bodyweight alternatives.</small>}</div>}</article>

        <div className="trainer-side-stack">{state.profile.trainerRole && !isDemo ? <TrainerControls client={browserClient} trainerId={state.profile.id} trainerRole={state.profile.trainerRole} clients={state.trainerClients ?? []} refresh={refreshTrainerClients} /> : <article className="panel trainer-rule-panel"><div className="side-card-title"><span className="side-card-icon peach-icon">⌁</span><div><h3>Deadlift variations</h3><p>Beginner ramp-up guardrail</p></div></div><div className="rule-setting"><div><strong>{state.profile.deadliftEnabled ? "Explicitly trainer-approved" : "Restricted by default"}</strong><small>{isDemo ? "Demo-only setting; no cloud trainer rule is changed." : "This rule never unlocks automatically by date or training phase."}</small></div>{isDemo && <button type="button" className={`toggle ${state.profile.deadliftEnabled ? "on" : ""}`} role="switch" aria-checked={state.profile.deadliftEnabled} onClick={() => void toggleDeadlift(!state.profile.deadliftEnabled)} aria-label={`${state.profile.deadliftEnabled ? "Lock" : "Approve demo"} deadlift variations`}><span /></button>}</div>{!isDemo && <div className="permission-note">Only an authenticated assigned trainer can change this restriction.</div>}<p className="rule-foot">The rule applies to future plans only. Existing workout snapshots keep their original rules.</p></article>}

          <article className="panel template-panel"><div className="section-heading"><div><h3>Active rules & templates</h3><p>Deterministic plan generation</p></div></div><div className="version-row"><span><strong>Beginner foundation</strong><small>Approved schedule · conservative rotation</small></span><span>{TEMPLATE_VERSION}</span></div><div className="version-row"><span><strong>Planning rules</strong><small>Progression, recovery, missed days, equipment</small></span><span>{RULE_VERSION}</span></div><div className="no-ai-chip"><span>✦</span> No paid AI API used</div></article>

          <TrainerInviteCard onLinked={refreshTrainerClients} /><TrainerLinkCard /><AccountCard /><DataCard /></div>
      </div>
    </section>
  );
}
