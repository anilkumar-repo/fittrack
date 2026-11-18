"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { buildDataExport, isCompleteInviteCode, normalizeInviteCode } from "@/lib/account-data";
import { dateLabel } from "@/lib/dates";
import { sharesLifts } from "@/lib/friends";
import { isAdult } from "@/lib/discover";
import { readRoziAiChoice, ROZI_AI_CHOICE_EVENT, saveRoziAiChoice, type RoziAiChoice } from "@/lib/rozi-ai/client";
import { deleteAllConversations } from "@/lib/rozi-ai/history";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { acceptTrainerInvite, createClientShareCode, createTrainerInvite, deleteMyWorkoutData, loadMyTrainers, removeMyTrainer, removeMyTrainers, trainerAddClientByCode, type MyTrainer } from "@/lib/supabase-repository";
import { BIO_MAX, cleanSpecialties, MAX_CLIENTS, MAX_SPECIALTIES, REPORT_REASONS, SHARE_OPTIONS, SPECIALTY_SUGGESTIONS, type ShareKey } from "@/lib/trainers";
import { loadMyTrainerProfile, reportTrainer, setTrainerMode, setTrainerShares, trainerInviteInfo, type ReportReason, type TrainerProfile } from "@/lib/trainers-repository";
import { Avatar } from "./avatar";
import { MessageButton } from "./message-button";
import { useFitTrack } from "./fit-track-provider";
import { SignInForm } from "./sign-in-form";

const ORIGIN_LABEL: Record<string, string> = { friend: "Your trainer · from Friends", qr: "Your trainer · gym QR", code: "Your trainer", invite: "Your trainer" };

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
 * Settings → Trainers: anyone can switch on Trainer mode (self-serve). Clients still choose to add a trainer and
 * what to share; a trainer can have up to 25 clients. Paused trainers (after reports) see why.
 */
export function TrainerModeCard() {
  const { state, isDemo, browserClient, refreshTrainerClients, setNotice } = useFitTrack();
  const userId = state.profile.id;
  const [profile, setProfile] = useState<TrainerProfile | null | undefined>(undefined);
  const [bio, setBio] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isDemo || !browserClient) return;
    let live = true;
    loadMyTrainerProfile(browserClient, userId)
      .then((row) => { if (!live) return; setProfile(row); setBio(row?.bio ?? ""); setPicked(row?.specialties ?? []); })
      .catch(() => { if (live) setProfile(null); });
    return () => { live = false; };
  }, [isDemo, browserClient, userId]);

  if (isDemo || !browserClient) return null;
  const on = Boolean(profile?.active) && !profile?.suspended;

  async function save(next: boolean) {
    if (!browserClient || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await setTrainerMode(browserClient, next, bio, cleanSpecialties(picked));
      setProfile(saved);
      await refreshTrainerClients().catch(() => undefined);
      setNotice(next ? (on ? "Trainer profile saved." : "You’re a trainer now. Share your gym QR from My clients.") : "Trainer mode is off. Your clients keep their plans; you won’t see their training until you turn it back on.");
    } catch (cause) { setError(messageOf(cause, "That didn’t save. Please try again.")); }
    finally { setBusy(false); }
  }
  function toggle(item: string) {
    setPicked((list) => list.some((value) => value.toLowerCase() === item.toLowerCase()) ? list.filter((value) => value.toLowerCase() !== item.toLowerCase()) : cleanSpecialties([...list, item]));
  }

  return (
    <article className="panel trainer-mode">
      <div className="settings-toggle-row">
        <span><strong>Trainer mode</strong><small>{profile?.suspended ? "Paused while we look into a report." : on ? `You’re a trainer · up to ${MAX_CLIENTS} clients` : "Coach friends and gym members in RozFit"}</small></span>
        <button type="button" role="switch" aria-checked={on} aria-label="Trainer mode" className={`toggle ${on ? "on" : ""}`} disabled={busy || profile === undefined || profile?.suspended} onClick={() => void save(!on)}><span /></button>
      </div>
      {profile?.suspended && <p className="card-note">Your trainer profile was paused after reports from several people. Clients can’t add you meanwhile. Contact RozFit support to have it reviewed.</p>}
      {!on && !profile?.suspended && <p className="card-note">Turn it on to get a gym QR, see the clients who add you, adjust their plans and message them all. Clients always choose whether to add you and what you can see.</p>}
      {on && <>
        <label className="field-label">About you <small className="field-hint">{bio.trim().length}/{BIO_MAX}</small>
          <textarea className="trainer-bio" rows={3} maxLength={BIO_MAX} value={bio} placeholder="e.g. Certified strength coach at FitHub Indiranagar. Beginners welcome." onChange={(event) => setBio(event.target.value)} />
        </label>
        <div className="field-label">Specialities <small className="field-hint">up to {MAX_SPECIALTIES}</small></div>
        <div className="chip-row specialty-chips">
          {[...new Set([...SPECIALTY_SUGGESTIONS, ...picked])].map((item) => {
            const chosen = picked.some((value) => value.toLowerCase() === item.toLowerCase());
            return <button key={item} type="button" className={`chip ${chosen ? "chip-on" : ""}`} aria-pressed={chosen} disabled={!chosen && picked.length >= MAX_SPECIALTIES} onClick={() => toggle(item)}>{item}</button>;
          })}
        </div>
        <form className="specialty-add" onSubmit={(event) => { event.preventDefault(); if (custom.trim()) { setPicked((list) => cleanSpecialties([...list, custom])); setCustom(""); } }}>
          <input type="text" maxLength={30} value={custom} placeholder="Add your own (e.g. Kettlebells)" onChange={(event) => setCustom(event.target.value)} disabled={picked.length >= MAX_SPECIALTIES} />
          <button type="submit" className="button button-subtle small" disabled={!custom.trim() || picked.length >= MAX_SPECIALTIES}>Add</button>
        </form>
        <div className="account-card-actions">
          <button type="button" className="button button-primary" disabled={busy} onClick={() => void save(true)}>{busy ? "Saving…" : "Save profile"}</button>
          <Link href="/clients" className="button button-subtle">My clients</Link>
        </div>
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </article>
  );
}

/**
 * A client's trainers. The client creates a code and sends it to any trainer they choose; the trainer enters it.
 * People can have more than one trainer and remove each one separately. (Codes from a trainer still work too.)
 */
export function TrainerLinkCard() {
  const { state, getState, updateState, isDemo, browserClient, setNotice } = useFitTrack();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [share, setShare] = useState<{ code: string; expiresAt: string } | null>(null);
  const [trainers, setTrainers] = useState<MyTrainer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTrainerCode, setShowTrainerCode] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportNote, setReportNote] = useState("");

  const refresh = useCallback(async () => {
    if (!browserClient) return;
    try {
      const list = await loadMyTrainers(browserClient);
      setTrainers(list);
      updateState({ ...getState(), trainerLinked: list.some((item) => item.status === "active") });
    } catch { setTrainers(null); }
  }, [browserClient, getState, updateState]);
  useEffect(() => { if (!isDemo && browserClient) { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); } }, [isDemo, browserClient, refresh]);
  if (isDemo || !browserClient) return null;

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
      // A "Train together" code also joins the trainer's group: the join page explains that first.
      const info = await trainerInviteInfo(browserClient, code).catch(() => null);
      if (info?.together) { router.push(`/join/${code}`); return; }
      await acceptTrainerInvite(browserClient, code);
      setCode("");
      setNotice("Your trainer is now linked to your account.");
      await refresh();
    } catch (linkError) {
      setError(messageOf(linkError, "The code could not be used. Please try again."));
    } finally { setBusy(false); }
  }

  async function sendReport(trainer: MyTrainer) {
    if (!browserClient || busy || !reportReason) return;
    setBusy(true); setError("");
    try {
      await reportTrainer(browserClient, trainer.id, reportReason, reportNote);
      setReporting(null);
      setNotice(`Thanks — your report about ${trainer.name} was sent. You can also remove them above.`);
    } catch (cause) { setError(messageOf(cause, "The report couldn’t be sent. Please try again.")); }
    finally { setBusy(false); }
  }

  async function changeSharing(trainer: MyTrainer, key: ShareKey, on: boolean) {
    if (!browserClient || busy) return;
    setBusy(true); setError("");
    // Show the change straight away; put it back if saving fails.
    setTrainers((list) => list?.map((item) => item.id === trainer.id ? { ...item, shares: { ...item.shares, [key]: on } } : item) ?? null);
    try { await setTrainerShares(browserClient, trainer.id, { [key]: on }); }
    catch (cause) {
      setTrainers((list) => list?.map((item) => item.id === trainer.id ? { ...item, shares: trainer.shares } : item) ?? null);
      setError(messageOf(cause, "That change couldn’t be saved. Please try again."));
    } finally { setBusy(false); }
  }

  async function remove(trainer: MyTrainer) {
    if (!browserClient || busy) return;
    if (!window.confirm(trainer.status === "requested" ? `Withdraw your request to ${trainer.name}?` : `Remove ${trainer.name}? They will no longer see your workouts or adjust your plan.`)) return;
    setBusy(true); setError("");
    try {
      await removeMyTrainer(browserClient, trainer.id);
      setNotice(trainer.status === "requested" ? `Request to ${trainer.name} withdrawn.` : `${trainer.name} was removed.`);
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
      <div className="side-card-title"><span className="side-card-icon purple-icon">✦</span><div><h3>Your trainers</h3><p>{trainers === null ? (state.trainerLinked ? "A trainer is linked." : "No trainer yet.") : trainers.length ? `${trainers.filter((item) => item.status === "active").length} linked${trainers.some((item) => item.status === "requested") ? ` · ${trainers.filter((item) => item.status === "requested").length} waiting` : ""}` : "No trainer yet."}</p></div></div>
      {trainers && trainers.length > 0 && <ul className="my-trainers">{trainers.map((trainer) => (
        <li key={trainer.id} className="my-trainer">
          <div className="my-trainer-head">
            <Avatar value={trainer.avatar} name={trainer.name} size={40} />
            <span><strong>{trainer.name}</strong><small>{trainer.status === "requested" ? "Waiting for their answer" : ORIGIN_LABEL[trainer.origin] ?? "Your trainer"}</small></span>
            <button type="button" className="text-button" disabled={busy} onClick={() => void remove(trainer)}>{trainer.status === "requested" ? "Withdraw" : "Remove"}</button>
          </div>
          {trainer.status !== "requested" && <MessageButton userId={trainer.id} label={`Message ${trainer.name.split(" ")[0]}`} className="button button-subtle small my-trainer-message" />}
          {reporting === trainer.id ? <form className="report-form" onSubmit={(event) => { event.preventDefault(); void sendReport(trainer); }}>
            <strong>Report {trainer.name}</strong>
            <div className="chip-row">{REPORT_REASONS.map((option) => <button key={option.id} type="button" className={`chip ${reportReason === option.id ? "chip-on" : ""}`} aria-pressed={reportReason === option.id} onClick={() => setReportReason(option.id)}>{option.label}</button>)}</div>
            <textarea rows={2} maxLength={500} value={reportNote} placeholder="What happened? (optional)" onChange={(event) => setReportNote(event.target.value)} />
            <div className="account-card-actions"><button className="button button-danger small" disabled={busy || !reportReason}>Send report</button><button type="button" className="text-button" onClick={() => setReporting(null)}>Cancel</button></div>
          </form> : <button type="button" className="text-button report-link" onClick={() => { setReporting(trainer.id); setReportReason(null); setReportNote(""); }}>Report</button>}
          <div className="share-switches" role="group" aria-label={`What ${trainer.name} can see`}>
            <small>{trainer.status === "requested" ? "They’ll see, once they accept:" : "What they can see:"}</small>
            {SHARE_OPTIONS.map((option) => {
              const on = trainer.shares[option.key];
              return (
                <div key={option.key} className="settings-toggle-row share-row">
                  <span><strong>{option.label}</strong><small>{option.note}</small></span>
                  <button type="button" role="switch" aria-checked={on} aria-label={`${option.label} for ${trainer.name}`} className={`toggle ${on ? "on" : ""}`} disabled={busy} onClick={() => void changeSharing(trainer, option.key, !on)}><span /></button>
                </div>
              );
            })}
          </div>
        </li>
      ))}</ul>}
      <p className="card-note">You can have more than one trainer, and each sees only what you switch on. To add one: ask a friend who’s a trainer from the Friends page, scan your trainer’s QR at the gym with your phone camera, or create a code below and send it to them.</p>
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
/** Settings → Your data: whether friends see your best set of each exercise (the exercise "Friends" tab). */
export function LiftSharingCard() {
  const { state, updateProfile, currentDate, isDemo } = useFitTrack();
  const on = sharesLifts(state.profile, currentDate);
  return (
    <article className="panel">
      <div className="settings-toggle-row">
        <span><strong>Share best lifts with friends</strong><small>{on ? "Friends see your best set of each exercise and can compare on the exercise’s Friends tab." : "Off: friends don’t see your lifts. Your streak and workouts this week are still shared."}</small></span>
        <button type="button" role="switch" aria-checked={on} aria-label="Share best lifts with friends" className={`toggle ${on ? "on" : ""}`} onClick={() => updateProfile({ shareLifts: !on })}><span /></button>
      </div>
      {isDemo && <p className="card-note">Sign in to share with friends.</p>}
    </article>
  );
}

/** Settings → Your data: switch Rozi AI on or off (kept on this device). Adults only, signed in. */
export function RoziAiCard() {
  const { state, isDemo, browserClient, currentDate, setNotice } = useFitTrack();
  const [choice, setChoice] = useState<RoziAiChoice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function deleteChats() {
    if (!browserClient) return;
    setDeleting(true);
    const count = await deleteAllConversations(browserClient);
    setDeleting(false);
    setConfirmDelete(false);
    setNotice(count === null ? "Chat history couldn’t be deleted right now." : count ? `Deleted ${count} saved ${count === 1 ? "chat" : "chats"} with Rozi.` : "No saved chats with Rozi.");
  }
  useEffect(() => {
    const sync = () => setChoice(readRoziAiChoice());
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(ROZI_AI_CHOICE_EVENT, sync);
    return () => { window.clearTimeout(timer); window.removeEventListener(ROZI_AI_CHOICE_EVENT, sync); };
  }, []);
  const adult = isAdult(state.profile.birthYear, Number(currentDate.slice(0, 4)));
  const available = !isDemo && Boolean(browserClient) && adult;
  const on = available && choice === "on";
  return (
    <article className="panel rozi-ai-setting">
      <div className="settings-toggle-row">
        <span><strong>Rozi AI answers</strong><small>{on ? "On: Rozi uses an AI model to understand your questions and explain your training." : "Off: Rozi answers the common questions on this phone, without AI."}</small></span>
        <button type="button" role="switch" aria-checked={on} aria-label="Rozi AI answers" disabled={!available} className={`toggle ${on ? "on" : ""}`} onClick={() => saveRoziAiChoice(on ? "off" : "on")}><span /></button>
      </div>
      <p>When on, each question goes to an AI model (Groq or Google Gemini) with only the workout details needed to answer — like sets, weights, height and body weight. Never your name, email or phone. AI providers may keep questions for a while to run and improve their service. This choice is saved on this device; your chats with Rozi AI are saved to your account for 180 days (History in Ask Rozi).</p>
      {!isDemo && browserClient && (confirmDelete
        ? <div className="rozi-history-confirm"><span>Delete all your saved chats with Rozi? This can’t be undone.</span>
          <button type="button" className="button button-subtle small danger-text" disabled={deleting} onClick={() => void deleteChats()}>{deleting ? "Deleting…" : "Delete all"}</button>
          <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Cancel</button></div>
        : <button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" className="inline-icon" /> Delete all Rozi chats</button>)}
      {isDemo && <p className="card-note">Sign in to use Rozi AI.</p>}
      {!isDemo && !adult && <p className="card-note">Rozi AI is for adults (18+). {typeof state.profile.birthYear === "number" ? "" : "Add your birth year in Settings → Your plan."}</p>}
    </article>
  );
}

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
