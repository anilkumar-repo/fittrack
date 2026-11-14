"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { buildDataExport, isCompleteInviteCode, normalizeInviteCode } from "@/lib/account-data";
import { dateLabel } from "@/lib/dates";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { acceptTrainerInvite, createClientShareCode, createTrainerInvite, deleteMyWorkoutData, loadMyTrainers, removeMyTrainer, removeMyTrainers, trainerAddClientByCode, type MyTrainer } from "@/lib/supabase-repository";
import { useFitTrack } from "./fit-track-provider";
import { SignInForm } from "./sign-in-form";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Sign in, or see who is signed in and sign out. */
export function AccountCard() {
  const { state, isDemo, signOut } = useFitTrack();
  return (
    <article className="panel account-panel">
      <div className="side-card-title"><span className="side-card-icon green-icon">◎</span><div><h3>Account & sync</h3><p>{isDemo ? "Your workouts are saved on this device only." : `Signed in as ${state.userEmail ?? "your account"}.`}</p></div></div>
      {!hasSupabaseConfig()
        ? <div className="setup-note">Add your Supabase URL and publishable key to <code>.env.local</code> to turn on account sync.</div>
        : isDemo
          ? <><p className="card-note">Sign in to keep your workouts safe and see them on any phone or computer. Workouts already logged here come with you.</p><SignInForm /></>
          : <button className="button button-subtle" onClick={() => void signOut()}>Sign out</button>}
    </article>
  );
}

/**
 * A client's trainers. The client creates a code and sends it to any trainer they choose; the trainer enters it.
 * People can have more than one trainer and remove each one separately. (Codes from a trainer still work too.)
 */
export function TrainerLinkCard() {
  const { state, getState, updateState, isDemo, browserClient, setNotice } = useFitTrack();
  const [code, setCode] = useState("");
  const [share, setShare] = useState<{ code: string; expiresAt: string } | null>(null);
  const [trainers, setTrainers] = useState<MyTrainer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTrainerCode, setShowTrainerCode] = useState(false);

  const refresh = useCallback(async () => {
    if (!browserClient) return;
    try {
      const list = await loadMyTrainers(browserClient);
      setTrainers(list);
      updateState({ ...getState(), trainerLinked: list.length > 0 });
    } catch { setTrainers(null); }
  }, [browserClient, getState, updateState]);
  useEffect(() => { if (!isDemo && browserClient && !state.profile.trainerRole) { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); } }, [isDemo, browserClient, state.profile.trainerRole, refresh]);
  if (isDemo || !browserClient || state.profile.trainerRole) return null;

  async function createShare() {
    if (!browserClient || busy) return;
    setBusy(true); setError(""); setCopied(false);
    try { setShare(await createClientShareCode(browserClient)); }
    catch (cause) { setError(messageOf(cause, "The code could not be created. Please try again.")); }
    finally { setBusy(false); }
  }

  async function sendShare() {
    if (!share) return;
    const text = `Add me as your client on RozFit: open Settings → Trainer controls → “Add a client” and enter ${share.code}`;
    if (navigator.share) { await navigator.share({ title: "RozFit trainer code", text }).catch(() => undefined); return; }
    try { await navigator.clipboard.writeText(share.code); setCopied(true); } catch { setCopied(false); }
  }

  async function link(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!browserClient || busy) return;
    if (!isCompleteInviteCode(code)) { setError("Enter the 8-character code from your trainer."); return; }
    setBusy(true); setError("");
    try {
      await acceptTrainerInvite(browserClient, code);
      setCode("");
      setNotice("Your trainer is now linked to your account.");
      await refresh();
    } catch (linkError) {
      setError(messageOf(linkError, "The code could not be used. Please try again."));
    } finally { setBusy(false); }
  }

  async function remove(trainer: MyTrainer) {
    if (!browserClient || busy) return;
    if (!window.confirm(`Remove ${trainer.name}? They will no longer see your workouts or adjust your plan.`)) return;
    setBusy(true); setError("");
    try {
      await removeMyTrainer(browserClient, trainer.id);
      setNotice(`${trainer.name} was removed.`);
      await refresh();
    } catch (cause) {
      // Before the database update: fall back to removing all trainers.
      try { await removeMyTrainers(browserClient); updateState({ ...getState(), trainerLinked: false }); setNotice("Trainer access removed."); }
      catch { setError(messageOf(cause, "Trainer access could not be changed. Please try again.")); }
    } finally { setBusy(false); }
  }

  const expires = share && /^\d{4}-\d{2}-\d{2}/.test(share.expiresAt) ? dateLabel(share.expiresAt.slice(0, 10), { month: "long", day: "numeric" }) : null;
  return (
    <article className="panel">
      <div className="side-card-title"><span className="side-card-icon purple-icon">✦</span><div><h3>Your trainers</h3><p>{trainers === null ? (state.trainerLinked ? "A trainer is linked." : "No trainer yet.") : trainers.length ? `${trainers.length} linked` : "No trainer yet."}</p></div></div>
      {trainers && trainers.length > 0 && <ul className="trainer-list">{trainers.map((trainer) => <li key={trainer.id}><span>{trainer.name}</span><button type="button" className="text-button" disabled={busy} onClick={() => void remove(trainer)}>Remove</button></li>)}</ul>}
      <p className="card-note">Add any trainer you work with: create a code and send it to them. They enter it in RozFit to add you. Trainers see your workouts and can adjust your plan — never your body weight.</p>
      {share && <div className="account-card-actions"><span className="invite-code" aria-label="Your code">{share.code}</span><button type="button" className="button button-subtle" onClick={() => void sendShare()}>{copied ? "Copied" : "Send to trainer"}</button></div>}
      {share && <p className="card-note">{expires ? `Valid until ${expires}.` : "Valid for 7 days."} Each code works once.</p>}
      <div className="account-card-actions"><button className="button button-primary" disabled={busy} onClick={() => void createShare()}>{busy ? "Creating…" : share ? "Create another code" : "Create a code for my trainer"}</button></div>
      <button type="button" className="text-button" onClick={() => setShowTrainerCode((value) => !value)}>{showTrainerCode ? "Hide" : "Got a code from your trainer instead?"}</button>
      {showTrainerCode && <form onSubmit={link} className="sign-in-form">
        <label className="field-label">Trainer’s code<input type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={(event) => setCode(normalizeInviteCode(event.target.value))} placeholder="8 characters" /></label>
        <button className="button button-primary" disabled={busy || !code}>{busy ? "Linking…" : "Link this trainer"}</button>
      </form>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </article>
  );
}

/** A trainer creates a one-time code to give to a client. */
export function TrainerInviteCard({ onLinked }: { onLinked: () => Promise<void> }) {
  const { state, isDemo, browserClient, setNotice } = useFitTrack();
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [clientCode, setClientCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  if (isDemo || !browserClient || !state.profile.trainerRole) return null;

  async function create() {
    if (!browserClient || busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try { setInvite(await createTrainerInvite(browserClient)); }
    catch (createError) { setError(messageOf(createError, "The invite code could not be created. Please try again.")); }
    finally { setBusy(false); }
  }

  async function addClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!browserClient || busy) return;
    if (!isCompleteInviteCode(clientCode)) { setError("Enter the 8-character code from your client."); return; }
    setBusy(true);
    setError("");
    try {
      await trainerAddClientByCode(browserClient, clientCode);
      setClientCode("");
      setNotice("Client added. Their plan is now in your trainer controls.");
      await onLinked();
    } catch (addError) {
      setError(messageOf(addError, "The code could not be used. Please try again."));
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite.code); setCopied(true); } catch { setCopied(false); }
  }

  const expires = invite && /^\d{4}-\d{2}-\d{2}/.test(invite.expiresAt) ? dateLabel(invite.expiresAt.slice(0, 10), { month: "long", day: "numeric" }) : null;
  return (
    <article className="panel">
      <div className="side-card-title"><span className="side-card-icon purple-icon">✦</span><div><h3>Add a client</h3><p>{(state.trainerClients ?? []).length} linked {(state.trainerClients ?? []).length === 1 ? "client" : "clients"}</p></div></div>
      <form onSubmit={addClient} className="sign-in-form">
        <p className="card-note">Your client creates a code in Settings → “Your trainers” and sends it to you. Enter it here.</p>
        <label className="field-label">Client’s code<input type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={clientCode} onChange={(event) => setClientCode(normalizeInviteCode(event.target.value))} placeholder="8 characters" /></label>
        <button className="button button-primary" disabled={busy || !clientCode}>{busy ? "Adding…" : "Add client"}</button>
      </form>
      <p className="card-note">Or create a code yourself and send it to the client — they enter it under “Got a code from your trainer?”. Each code works once.</p>
      {invite && <div className="account-card-actions"><span className="invite-code" aria-label="Invite code">{invite.code}</span><button type="button" className="button button-subtle" onClick={() => void copy()}>{copied ? "Copied" : "Copy code"}</button></div>}
      {invite && <p className="card-note">{expires ? `Valid until ${expires}.` : "Valid for 7 days."} After your client uses it, refresh to see them below.</p>}
      <div className="account-card-actions"><button className="button button-subtle" disabled={busy} onClick={() => void create()}>{busy ? "Creating…" : invite ? "Create another code" : "Create invite code"}</button><button className="text-button" onClick={() => void onLinked().catch(() => undefined)}>Refresh client list</button></div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </article>
  );
}

/** Download everything RozFit holds, or delete the workout history. */
export function DataCard() {
  const { state, getState, updateState, isDemo, browserClient, currentDate, setNotice } = useFitTrack();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const savedCount = state.sessions.filter((session) => !session.sampleData && session.status !== "planned").length;

  function download() {
    const file = new Blob([JSON.stringify(buildDataExport(getState(), new Date().toISOString()), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rozfit-data-${currentDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteData(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirmText.trim().toUpperCase() !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      if (!isDemo) {
        if (!browserClient) throw new Error("Supabase is unavailable. Refresh the page and try again.");
        await deleteMyWorkoutData(browserClient);
      }
      updateState({ ...getState(), sessions: [], bodyWeightEntries: [] });
      setConfirming(false);
      setConfirmText("");
      setNotice("Your workout history and body-weight entries were deleted.");
    } catch (deleteError) {
      setError(messageOf(deleteError, "Your data could not be deleted. Please try again."));
    } finally { setBusy(false); }
  }

  return (
    <article className="panel">
      <div className="side-card-title"><span className="side-card-icon peach-icon">▦</span><div><h3>Your data</h3><p>{savedCount} saved {savedCount === 1 ? "workout" : "workouts"} · {state.bodyWeightEntries.length} body-weight {state.bodyWeightEntries.length === 1 ? "entry" : "entries"}</p></div></div>
      <div className="data-actions"><button className="button button-subtle small" onClick={download}><Download aria-hidden="true" /> Download</button>{!confirming && <button className="button button-danger small" onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" /> Delete history</button>}</div>
      {confirming && <form onSubmit={deleteData} className="sign-in-form">
        <p className="card-note">This permanently deletes every saved workout, check-in, review, and body-weight entry{isDemo ? " on this device" : " in your account"}. It cannot be undone. Your profile and settings stay. Download your data first if you want a copy.</p>
        <label className="field-label">Type DELETE to confirm<input type="text" autoComplete="off" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} /></label>
        <div className="account-card-actions"><button className="button button-danger" disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"}>{busy ? "Deleting…" : "Delete permanently"}</button><button type="button" className="text-button" onClick={() => { setConfirming(false); setConfirmText(""); setError(""); }}>Cancel</button></div>
      </form>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </article>
  );
}
