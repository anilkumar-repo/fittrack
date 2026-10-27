"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWorkout } from "@/lib/planner";
import { EQUIPMENT_OPTIONS, getTemplateExercises, TEMPLATE_VERSION } from "@/lib/templates";
import { loadCloudSessions, saveCloudDeadliftRule, saveCloudTrainerRuleSettings } from "@/lib/supabase-repository";
import { canManageTrainerClientRules, DEFAULT_TRAINER_RULE_SETTINGS, isTrainerEditableTemplateExercise, normalizeTrainerRuleSettings, trainerRuleChangesNeedConfirmation, validateTrainerRuleSettings } from "@/lib/trainer-rules";
import { todayInTimeZone } from "@/lib/demo-data";
import type { TrainerClient, TrainerRuleSettings, WorkoutPlan, WorkoutSession } from "@/lib/types";

interface TrainerControlsProps {
  client: SupabaseClient | null;
  trainerId: string;
  trainerRole: boolean;
  clients: TrainerClient[];
  refresh: () => Promise<void>;
}

const TEMPLATE_EXERCISES = ["Foundation A", "Foundation B", "Foundation C"]
  .flatMap((focus) => getTemplateExercises(focus as "Foundation A" | "Foundation B" | "Foundation C"))
  .filter((exercise, index, all) => isTrainerEditableTemplateExercise(exercise.id) && all.findIndex((item) => item.id === exercise.id) === index);
const EMPTY_SESSIONS: WorkoutSession[] = [];

function nextPreviewDate(client: TrainerClient): string {
  const today = todayInTimeZone(client.profile.timeZone);
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const value = date.toISOString().slice(0, 10);
    if (client.profile.trainingDays.includes(date.getUTCDay())) return value;
  }
  return today;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function planDiff(before: WorkoutPlan | null, after: WorkoutPlan | null): string[] {
  if (!after) return ["No workout is scheduled on the next available training date."];
  if (!before) return ["The saved rules do not produce a plan for this date; the proposed rules do."];
  const beforeItems = new Map(before.exercises.map((item) => [item.id, item]));
  const afterItems = new Map(after.exercises.map((item) => [item.id, item]));
  const changes: string[] = [];
  for (const [id, current] of beforeItems) {
    const next = afterItems.get(id);
    if (!next) changes.push(`${current.name} is removed from the preview.`);
    else if (current.sets !== next.sets || current.reps !== next.reps || current.restSeconds !== next.restSeconds) {
      changes.push(`${next.name}: ${current.sets} × ${current.reps}, ${current.restSeconds}s rest → ${next.sets} × ${next.reps}, ${next.restSeconds}s rest.`);
    }
  }
  for (const [id, next] of afterItems) if (!beforeItems.has(id)) changes.push(`${next.name} is added to the preview.`);
  if (before.sessionType !== after.sessionType) changes.push(`Session type changes from ${before.sessionType} to ${after.sessionType}.`);
  return changes.length ? changes : ["The proposed settings do not change this date’s exercise list or targets."];
}

function planFor(client: TrainerClient, sessions: WorkoutSession[], date: string, settings: TrainerRuleSettings, revision: number): WorkoutPlan | null {
  return generateWorkout({ date, profile: client.profile, sessions, trainerRuleSettings: settings, trainerRuleRevision: revision });
}

export function TrainerControls({ client, trainerId, trainerRole, clients, refresh }: TrainerControlsProps) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [draftState, setDraftState] = useState<{ clientId: string; settings: TrainerRuleSettings } | null>(null);
  const [historyState, setHistoryState] = useState<{ clientId: string; status: "loading" | "ready" | "error"; sessions: WorkoutSession[]; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyDeadliftId, setBusyDeadliftId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exerciseId, setExerciseId] = useState(TEMPLATE_EXERCISES[0]?.id ?? "");

  const selectedClient = clients.find((item) => item.id === selectedClientId) ?? clients[0];
  const draft = draftState?.clientId === selectedClient?.id ? draftState.settings : selectedClient?.ruleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS;
  const clientIdToLoad = selectedClient?.id;
  const historyForSelected = historyState?.clientId === clientIdToLoad ? historyState : null;
  const sessions = historyForSelected?.sessions ?? EMPTY_SESSIONS;
  const historyLoading = !historyForSelected || historyForSelected.status === "loading";
  const historyError = historyForSelected?.status === "error" ? historyForSelected.error ?? "Client workout history could not be loaded." : "";
  const canEdit = Boolean(client && trainerRole && selectedClient && canManageTrainerClientRules(
    { id: trainerId, trustedRole: trainerRole ? "trainer" : undefined }, trainerId, selectedClient.id, clients.map((item) => item.id),
  ));

  useEffect(() => {
    if (!clientIdToLoad || !client || !trainerRole) return;
    let cancelled = false;
    loadCloudSessions(client, trainerId, clientIdToLoad).then((records) => {
      if (!cancelled) setHistoryState({ clientId: clientIdToLoad, status: "ready", sessions: records });
    }).catch((cause: unknown) => {
      if (!cancelled) setHistoryState({ clientId: clientIdToLoad, status: "error", sessions: [], error: cause instanceof Error ? cause.message : "Client workout history could not be loaded." });
    });
    return () => { cancelled = true; };
  }, [clientIdToLoad, client, trainerId, trainerRole]);

  const previewDate = selectedClient ? nextPreviewDate(selectedClient) : "";
  const currentPreview = useMemo(() => selectedClient && previewDate
    ? planFor(selectedClient, sessions, previewDate, selectedClient.ruleSettings, selectedClient.ruleRevision)
    : null, [selectedClient, sessions, previewDate]);
  const proposedPreview = useMemo(() => selectedClient && previewDate
    ? planFor(selectedClient, sessions, previewDate, draft, selectedClient.ruleRevision + 1)
    : null, [selectedClient, sessions, previewDate, draft]);
  const differences = planDiff(currentPreview, proposedPreview);
  const settingsErrors = validateTrainerRuleSettings(draft);
  const savedSettings = selectedClient?.ruleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS;
  const dirty = Boolean(selectedClient && JSON.stringify(draft) !== JSON.stringify(savedSettings));
  const templateExercise = TEMPLATE_EXERCISES.find((item) => item.id === exerciseId);
  const templateOverride = draft.exerciseTemplates.find((item) => item.exerciseId === exerciseId);
  const defaultReps = templateExercise ? [...templateExercise.reps.matchAll(/\d+/g)].map((match) => Number(match[0])) : [];
  const templateValues = templateOverride ?? (templateExercise ? {
    exerciseId,
    sets: Math.min(3, templateExercise.sets),
    minReps: defaultReps[0] ?? 8,
    maxReps: defaultReps[1] ?? defaultReps[0] ?? 8,
    restSeconds: templateExercise.restSeconds,
  } : null);

  function setTemplateValue(patch: Partial<NonNullable<typeof templateValues>>) {
    if (!templateValues || !exerciseId) return;
    const next = { ...templateValues, ...patch, exerciseId };
    updateDraft((current) => ({ ...current, exerciseTemplates: [...current.exerciseTemplates.filter((item) => item.exerciseId !== exerciseId), next] }));
    setError("");
    setMessage("");
  }

  function updateProgression(patch: Partial<TrainerRuleSettings["progression"]>) {
    updateDraft((current) => ({ ...current, progression: { ...current.progression, ...patch } }));
    setError("");
    setMessage("");
  }

  function updateRecovery(patch: Partial<TrainerRuleSettings["recovery"]>) {
    updateDraft((current) => ({ ...current, recovery: { ...current.recovery, ...patch } }));
    setError("");
    setMessage("");
  }

  function updateEquipment(mode: TrainerRuleSettings["equipment"]["mode"]) {
    updateDraft((current) => ({ ...current, equipment: { mode, availableEquipment: mode === "verified" ? current.equipment.availableEquipment : [] } }));
    setError("");
    setMessage("");
  }

  function toggleEquipment(value: TrainerRuleSettings["equipment"]["availableEquipment"][number]) {
    updateDraft((current) => {
      const selected = current.equipment.availableEquipment.includes(value)
        ? current.equipment.availableEquipment.filter((item) => item !== value)
        : [...current.equipment.availableEquipment, value];
      return { ...current, equipment: { mode: "verified", availableEquipment: selected } };
    });
    setError("");
    setMessage("");
  }

  function updateDraft(update: (current: TrainerRuleSettings) => TrainerRuleSettings) {
    if (!selectedClient) return;
    setDraftState((current) => {
      const base = current?.clientId === selectedClient.id ? current.settings : selectedClient.ruleSettings;
      return { clientId: selectedClient.id, settings: update(normalizeTrainerRuleSettings(base)) };
    });
  }

  async function saveSettings() {
    if (!selectedClient || !client || !canEdit) return;
    if (historyLoading || historyError) { setError("Wait for this client’s workout history to load before applying a previewed rule change."); return; }
    if (settingsErrors.length) { setError(settingsErrors.join(" ")); return; }
    if (trainerRuleChangesNeedConfirmation(savedSettings, draft) && !window.confirm("These settings are less conservative or raise the planned training demand. Review the preview, then confirm you want to save this change.")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveCloudTrainerRuleSettings(client, trainerId, selectedClient, draft);
      setDraftState({ clientId: selectedClient.id, settings: normalizeTrainerRuleSettings(draft) });
      setMessage(`Trainer rule revision ${selectedClient.ruleRevision + 1} saved. New plans will use it; saved workouts keep their original snapshots.`);
      try { await refresh(); } catch (cause) {
        setError(cause instanceof Error ? `Rules were saved, but the audit list did not refresh: ${cause.message}` : "Rules were saved, but the audit list did not refresh.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Trainer settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function changeDeadliftRule(target: TrainerClient, enabled: boolean) {
    if (!client || !trainerRole || !clients.some((item) => item.id === target.id)) return;
    const action = enabled ? "explicitly approve deadlift variations" : "lock deadlift variations again";
    const detail = enabled
      ? "This will allow future plans to include the approved hinge variation for this client. Time in training will not remove or restore this setting automatically."
      : "Future plans will keep deadlift variations restricted. Saved workout history will not change.";
    if (!window.confirm(`Do you want to ${action} for ${target.displayName}? ${detail}`)) return;
    setBusyDeadliftId(target.id);
    setError("");
    setMessage("");
    try {
      await saveCloudDeadliftRule(client, trainerId, target.id, enabled);
      setMessage(enabled ? `Explicit trainer approval saved for ${target.displayName}.` : `Deadlift variations are locked for ${target.displayName}.`);
      try { await refresh(); } catch (cause) {
        setError(cause instanceof Error ? `The restriction was saved, but the audit list did not refresh: ${cause.message}` : "The restriction was saved, but the audit list did not refresh.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This restriction could not be changed.");
    } finally {
      setBusyDeadliftId("");
    }
  }

  if (!trainerRole) {
    return <article className="panel trainer-rule-panel">
      <div className="side-card-title"><span className="side-card-icon peach-icon">⌁</span><div><h3>Trainer-managed rules</h3><p>Only an assigned trainer can change your workout rules</p></div></div>
      <div className="permission-note">Your restrictions stay active until your authenticated trainer explicitly updates them. No rule changes automatically with time.</div>
    </article>;
  }

  return <>
    <article className="panel trainer-rule-panel trainer-controls-panel">
      <div className="side-card-title"><span className="side-card-icon peach-icon">⌁</span><div><h3>Trainer controls</h3><p>Preview bounded changes for an active linked client</p></div></div>
      {!clients.length ? <div className="empty-inline">No active clients are linked to this trainer account yet. A verified relationship must be provisioned in Supabase before rules can be changed.</div> : <>
        <label className="field-label">Client<select value={selectedClient?.id ?? ""} onChange={(event) => { setSelectedClientId(event.target.value); setError(""); setMessage(""); }} aria-label="Select linked client">{clients.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        {selectedClient && <>
          <div className="rule-setting trainer-deadlift-row"><div><strong>Deadlift variations</strong><small>{selectedClient.deadliftEnabled ? "Explicitly approved for future generated plans" : "Restricted until a trainer explicitly approves"}</small></div><button type="button" className={`button ${selectedClient.deadliftEnabled ? "button-subtle" : "button-primary"}`} disabled={!canEdit || busyDeadliftId === selectedClient.id} onClick={() => void changeDeadliftRule(selectedClient, !selectedClient.deadliftEnabled)}>{busyDeadliftId === selectedClient.id ? "Saving…" : selectedClient.deadliftEnabled ? "Lock restriction" : "Review and approve"}</button></div>
          <div className="trainer-rule-editor">
            <h4>Exercise template</h4>
            <label className="field-label">Exercise<select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}>{TEMPLATE_EXERCISES.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
            {templateValues && <div className="trainer-number-grid">
              <label>Sets<input type="number" min="1" max="3" value={templateValues.sets} disabled={!canEdit} onChange={(event) => setTemplateValue({ sets: Number(event.target.value) })} /></label>
              <label>Minimum reps<input type="number" min="4" max="20" value={templateValues.minReps} disabled={!canEdit} onChange={(event) => setTemplateValue({ minReps: Number(event.target.value) })} /></label>
              <label>Maximum reps<input type="number" min="4" max="20" value={templateValues.maxReps} disabled={!canEdit} onChange={(event) => setTemplateValue({ maxReps: Number(event.target.value) })} /></label>
              <label>Rest seconds<input type="number" min="30" max="180" step="15" value={templateValues.restSeconds} disabled={!canEdit} onChange={(event) => setTemplateValue({ restSeconds: Number(event.target.value) })} /></label>
            </div>}
            <button type="button" className="text-button" disabled={!canEdit || !templateOverride} onClick={() => updateDraft((current) => ({ ...current, exerciseTemplates: current.exerciseTemplates.filter((item) => item.exerciseId !== exerciseId) }))}>Use the library template defaults</button>
          </div>

          <div className="trainer-rule-editor">
            <h4>Progression</h4>
            <div className="trainer-number-grid">
              <label>Rep increase<select value={draft.progression.repIncrement} disabled={!canEdit} onChange={(event) => updateProgression({ repIncrement: Number(event.target.value) })}><option value={1}>1 rep</option><option value={2}>2 reps</option></select></label>
              <label>Maximum small load step<select value={draft.progression.smallLoadStepKg} disabled={!canEdit} onChange={(event) => updateProgression({ smallLoadStepKg: Number(event.target.value) })}>{[0.5, 1, 1.25, 1.5, 2, 2.5].map((step) => <option key={step} value={step}>{step} kg</option>)}</select></label>
            </div>
            <p className="field-hint">Reps still progress first. A load step is only mentioned after completed top-range sets, sound form, no pain, and a recorded load.</p>
          </div>

          <div className="trainer-rule-editor">
            <h4>Recovery</h4>
            <div className="trainer-number-grid">
              <label>Recovery session at energy<select value={draft.recovery.stopEnergyThreshold} disabled={!canEdit} onChange={(event) => updateRecovery({ stopEnergyThreshold: Number(event.target.value) })}><option value={1}>1 or lower</option><option value={2}>2 or lower</option></select></label>
              <label>Recovery session at recovery<select value={draft.recovery.stopRecoveryThreshold} disabled={!canEdit} onChange={(event) => updateRecovery({ stopRecoveryThreshold: Number(event.target.value) })}><option value={1}>1 or lower</option><option value={2}>2 or lower</option></select></label>
              <label>Recovery session at soreness<select value={draft.recovery.stopSorenessThreshold} disabled={!canEdit} onChange={(event) => updateRecovery({ stopSorenessThreshold: Number(event.target.value) })}><option value={4}>4 or higher</option><option value={5}>5 only</option></select></label>
              <label>Reduce volume at energy<select value={draft.recovery.lowEnergyVolumeThreshold} disabled={!canEdit} onChange={(event) => updateRecovery({ lowEnergyVolumeThreshold: Number(event.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} or lower</option>)}</select></label>
              <label>Reduce volume at soreness<select value={draft.recovery.highSorenessVolumeThreshold} disabled={!canEdit} onChange={(event) => updateRecovery({ highSorenessVolumeThreshold: Number(event.target.value) })}>{[3, 4, 5].map((n) => <option key={n} value={n}>{n} or higher</option>)}</select></label>
              <label>Repeated soreness check-ins<select value={draft.recovery.repeatedHighSorenessSessions} disabled={!canEdit} onChange={(event) => updateRecovery({ repeatedHighSorenessSessions: Number(event.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} in the recent week</option>)}</select></label>
              <label>Sets reduced<select value={draft.recovery.volumeReductionSets} disabled={!canEdit} onChange={(event) => updateRecovery({ volumeReductionSets: Number(event.target.value) })}><option value={1}>1 set</option><option value={2}>2 sets</option></select></label>
            </div>
            <p className="field-hint">Pain always stops the relevant loaded session and cannot be weakened by trainer settings.</p>
          </div>

          <div className="trainer-rule-editor">
            <h4>Equipment availability</h4>
            <label className="field-label">Equipment source<select value={draft.equipment.mode} disabled={!canEdit} onChange={(event) => updateEquipment(event.target.value as TrainerRuleSettings["equipment"]["mode"])}><option value="inherit">Use the client’s confirmed equipment</option><option value="unknown">Treat equipment as unconfirmed</option><option value="verified">Use this verified equipment list</option></select></label>
            {draft.equipment.mode === "verified" && <div className="equipment-options trainer-equipment-options">{EQUIPMENT_OPTIONS.map((item) => <label className="checkbox-row" key={item.id}><input type="checkbox" checked={draft.equipment.availableEquipment.includes(item.id)} disabled={!canEdit} onChange={() => toggleEquipment(item.id)} /><span><strong>{item.label}</strong></span></label>)}</div>}
          </div>

          <section className="trainer-preview" aria-labelledby="trainer-preview-title">
            <div className="section-heading"><div><h4 id="trainer-preview-title">Preview before applying</h4><p>{dateLabel(previewDate)} · template {TEMPLATE_VERSION} · proposed rule revision {selectedClient.ruleRevision + 1}</p></div><span className="pill pill-outline">PREVIEW</span></div>
            {historyLoading ? <p className="loading-inline" role="status">Loading this client’s recent workout history…</p> : historyError ? <p className="error-inline" role="alert">{historyError}</p> : sessions.length === 0 ? <p className="field-hint">No workout history is saved for this client yet. The preview uses the current schedule and conservative defaults.</p> : <p className="field-hint">Preview uses {sessions.length} saved workouts and this client’s recovery and equipment history.</p>}
            <strong>{proposedPreview?.title ?? "No scheduled workout"}</strong>
            {proposedPreview && <ul className="trainer-preview-list">{proposedPreview.exercises.map((exercise) => <li key={exercise.id}><span>{exercise.name}</span><small>{exercise.sets} × {exercise.reps} · {exercise.restSeconds}s</small></li>)}</ul>}
            <h5>What changes from the saved rules?</h5>
            <ul className="trainer-preview-reasons">{differences.map((item) => <li key={item}>{item}</li>)}</ul>
            {proposedPreview?.generationReasons.slice(0, 3).map((reason) => <p className="field-hint" key={reason}>{reason}</p>)}
          </section>

          {error && <p className="error-inline" role="alert">{error}</p>}
          {message && <p className="success-inline" role="status">{message}</p>}
          {settingsErrors.length > 0 && <p className="field-hint">Correct the rule values before saving: {settingsErrors.join(" ")}</p>}
          <button type="button" className="button button-primary full-width" disabled={!canEdit || !dirty || saving || historyLoading || Boolean(historyError) || settingsErrors.length > 0} onClick={() => void saveSettings()}>{saving ? "Saving trainer rules…" : historyLoading ? "Loading client history…" : dirty ? "Save previewed rule changes" : "Rules match the saved version"}</button>

          <div className="trainer-audit">
            <h4>Recent audit history</h4>
            {selectedClient.audit.length ? <ul>{selectedClient.audit.slice(0, 8).map((entry) => <li key={entry.id}><span>{new Date(entry.changedAt).toLocaleString()}</span><small>{entry.trainerId === trainerId ? "You" : "Another linked trainer"} changed {entry.oldDeadliftEnabled !== entry.newDeadliftEnabled ? `deadlift approval (${entry.newDeadliftEnabled ? "approved" : "restricted"})` : "workout rules"}.</small></li>)}</ul> : <p className="field-hint">No trainer rule changes are recorded yet.</p>}
          </div>
          <p className="rule-foot">Changes apply to future generated workouts only. Saved workout plans keep the exact rule snapshot used when they were created.</p>
        </>}
      </>}
    </article>

    <article className="panel trainer-rule-panel">
      <div className="side-card-title"><span className="side-card-icon peach-icon">⌁</span><div><h3>Linked client restrictions</h3><p>Each approval requires an authenticated trainer confirmation</p></div></div>
      {clients.length ? clients.map((target) => <div className="client-rule-row" key={target.id}><div className="rule-setting"><div><strong>{target.displayName}</strong><small>{target.deadliftEnabled ? "Explicitly approved for future plans" : "Deadlift variations remain restricted"}</small></div><button type="button" className={`button ${target.deadliftEnabled ? "button-subtle" : "button-primary"}`} disabled={!canEdit || busyDeadliftId === target.id} onClick={() => void changeDeadliftRule(target, !target.deadliftEnabled)}>{busyDeadliftId === target.id ? "Saving…" : target.deadliftEnabled ? "Lock restriction" : "Review and approve"}</button></div></div>) : <div className="empty-inline">No linked clients are available yet.</div>}
      <p className="rule-foot">The rule never expires automatically. This decision is written to the same append-only audit trail as other trainer changes.</p>
    </article>
  </>;
}
