"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { AlertTriangle, Check, Feather, Flame, Lock, QrCode, Send, SlidersHorizontal, Trash2, UserPlus, Users, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { MessageButton } from "@/components/app/message-button";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { EmptyState } from "@/components/ui/empty-state";
import { dateLabel, shiftDate, shortDate } from "@/lib/dates";
import { lastWorkoutLabel } from "@/lib/friends";
import { formatWeight } from "@/lib/logging";
import { createTrainerInvite } from "@/lib/supabase-repository";
import { BROADCAST_MAX, broadcastProblem, clientSummary, FLAG_LABELS, joinLink, SHARE_OPTIONS, sortForAttention, type ClientDay } from "@/lib/trainers";
import {
  deleteBroadcast, loadClientDays, loadLightWeeks, loadMyBroadcasts, loadTrainerRequests, respondTrainerRequest, sendBroadcast, trainerRemoveClient, trainerSetLightWeek,
  type SentBroadcast, type TrainerRequest,
} from "@/lib/trainers-repository";

/**
 * A trainer's home for their clients: requests to answer, a card per client (streak, this week, last workout and
 * flags, most urgent first), a message to all clients, and the gym QR. Only shows what each client shares.
 */
export function ClientsScreen() {
  const { state, isDemo, browserClient, currentDate, refreshTrainerClients, setNotice, weightUnit } = useFitTrack();
  const trainerId = state.profile.id;
  const [requests, setRequests] = useState<TrainerRequest[]>([]);
  const [days, setDays] = useState<Map<string, ClientDay[]> | null>(null);
  const [sent, setSent] = useState<SentBroadcast[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [light, setLight] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!browserClient) return;
    const [requestList, dayMap, broadcasts, lightWeeks] = await Promise.all([
      loadTrainerRequests(browserClient).catch(() => []),
      loadClientDays(browserClient, shiftDate(currentDate, -60)).catch(() => new Map<string, ClientDay[]>()),
      loadMyBroadcasts(browserClient, trainerId),
      loadLightWeeks(browserClient),
    ]);
    setLight(lightWeeks);
    setRequests(requestList);
    setDays(dayMap);
    setSent(broadcasts);
  }, [browserClient, currentDate, trainerId]);

  useEffect(() => {
    if (isDemo || !browserClient || !state.profile.trainerRole) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [isDemo, browserClient, state.profile.trainerRole, load]);

  const clients = useMemo(() => sortForAttention((state.trainerClients ?? []).map((client) => ({
    ...client,
    name: client.displayName,
    // Without shared workouts there's nothing to judge: no streak, no flags (never "no workout for a week").
    summary: client.shares?.workouts === false
      ? { streak: 0, lastWorkout: null, weekDone: 0, weekGoal: client.profile.sessionsPerWeek, flags: [] }
      : clientSummary(
        { trainingDays: client.profile.trainingDays, trainingStartDate: client.profile.trainingStartDate, sessionsPerWeek: client.profile.sessionsPerWeek },
        days?.get(client.id) ?? [], currentDate,
      ),
  }))), [state.trainerClients, days, currentDate]);

  async function run(label: string, action: () => Promise<string | void>) {
    if (busy) return;
    setBusy(label); setError("");
    try { const done = await action(); if (done) setNotice(done); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again."); }
    finally { setBusy(""); }
  }

  if (isDemo || !browserClient) return <section className="clients-page"><EmptyState mood="hello" title="Sign in to see your clients" text="Your clients and their training live in your trainer account." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (!state.profile.trainerRole) return <section className="clients-page"><EmptyState mood="chat-thinking" title="This is for trainers" text="Trainer accounts see their clients here. To get a trainer, ask a friend who’s a trainer on the Friends page, or open Settings → Trainers." action={{ label: "Settings → Trainers", href: "/settings?section=trainers" }} /></section>;

  const attention = clients.filter((client) => client.summary.flags.length).length;
  const problem = broadcastProblem(message);

  return (
    <section className="clients-page">
      <article className="panel clients-hero">
        <div>
          <h2>{clients.length} {clients.length === 1 ? "client" : "clients"}</h2>
          <p>{attention ? `${attention} ${attention === 1 ? "needs" : "need"} a look today` : clients.length ? "Everyone’s on track" : "Add your first client with your gym QR or a code."}</p>
        </div>
        <div className="clients-hero-actions">
          <button type="button" className="button button-primary small" onClick={() => setShowQr(true)}><QrCode aria-hidden="true" /> Gym QR</button>
          <Link href="/settings?section=trainers" className="button button-subtle small"><UserPlus aria-hidden="true" /> Add by code</Link>
        </div>
      </article>

      {requests.length > 0 && <article className="panel">
        <div className="panel-title"><h3>Requests</h3><span className="panel-count">{requests.length}</span></div>
        <ul className="client-requests">{requests.map((request) => (
          <li key={request.clientId}>
            <Avatar value={request.avatar} name={request.name} size={40} />
            <span><strong>{request.name}</strong><small>wants you as their trainer · {shortDate(request.at.slice(0, 10))}</small></span>
            <button type="button" className="button button-primary small" disabled={Boolean(busy)} onClick={() => void run(`accept-${request.clientId}`, async () => {
              await respondTrainerRequest(browserClient, request.clientId, true);
              await Promise.all([refreshTrainerClients(), load()]);
              return `${request.name} is now your client.`;
            })}><Check aria-hidden="true" /> Accept</button>
            <button type="button" className="icon-button" aria-label={`Decline ${request.name}`} disabled={Boolean(busy)} onClick={() => void run(`decline-${request.clientId}`, async () => {
              await respondTrainerRequest(browserClient, request.clientId, false);
              await load();
              return `You declined ${request.name}’s request.`;
            })}><X aria-hidden="true" /></button>
          </li>
        ))}</ul>
      </article>}

      <article className="panel">
        <div className="panel-title"><h3>Your clients</h3></div>
        {!clients.length ? <EmptyState mood="hello" title="No clients yet" text="Show your gym QR to a client: they scan it with their phone camera and tap “Add”. Friends can also ask you from the Friends page." /> :
          <ul className="client-cards">{clients.map((client) => {
            const shares = client.shares;
            const seesWorkouts = shares?.workouts !== false;
            return (
              <li key={client.id} className={`client-card ${client.summary.flags.length ? "flagged" : ""}`}>
                <div className="client-card-head">
                  <Avatar value={client.avatar} name={client.displayName} size={44} />
                  <span><strong>{client.displayName}</strong><small>{seesWorkouts ? lastWorkoutLabel(client.summary.lastWorkout, currentDate) : "Doesn’t share workouts"}</small></span>
                  {seesWorkouts && <span className="client-streak" aria-label={`${client.summary.streak} day streak`}><Flame aria-hidden="true" /> {client.summary.streak}</span>}
                </div>
                {seesWorkouts && <>
                  <div className="friend-week" aria-label={`${client.summary.weekDone} of ${client.summary.weekGoal} workouts this week`}><span style={{ width: `${Math.min(100, (client.summary.weekDone / client.summary.weekGoal) * 100)}%` }} /></div>
                  <small className="client-week">{client.summary.weekDone} / {client.summary.weekGoal} this week{client.weightKg ? ` · ${formatWeight(client.weightKg, weightUnit)}` : ""}</small>
                </>}
                {client.summary.flags.length > 0 && <div className="client-flags">{client.summary.flags.map((flag) => <span key={flag} className={`client-flag flag-${flag}`}><AlertTriangle aria-hidden="true" /> {FLAG_LABELS[flag]}</span>)}</div>}
                <div className="client-shares" aria-label="What this client shares with you">
                  {SHARE_OPTIONS.map((option) => <span key={option.key} className={shares?.[option.key] ? "on" : ""}>{shares?.[option.key] ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}{option.label}</span>)}
                </div>
                {light.has(client.id) ? <div className="client-light on">
                  <Feather aria-hidden="true" /><span><strong>Lighter week on</strong><small>Same sessions, about a third fewer sets until Sunday</small></span>
                  <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => void run(`light-${client.id}`, async () => {
                    await trainerSetLightWeek(browserClient, client.id, false);
                    setLight(await loadLightWeeks(browserClient));
                    return `${client.displayName} is back to normal sets.`;
                  })}>Back to normal</button>
                </div> : seesWorkouts && client.summary.flags.includes("missed") && <div className="client-light">
                  <Feather aria-hidden="true" /><span><strong>Missed a few sessions?</strong><small>A lighter week — same sessions, fewer sets — helps them get back on track</small></span>
                  <button type="button" className="button button-primary small" disabled={Boolean(busy)} onClick={() => void run(`light-${client.id}`, async () => {
                    await trainerSetLightWeek(browserClient, client.id, true);
                    setLight(await loadLightWeeks(browserClient));
                    return `This week is lighter for ${client.displayName} (and their whole group if you coach it). Plans update on the next session.`;
                  })}>Make this week lighter</button>
                </div>}
                <div className="client-card-actions">
                  <MessageButton userId={client.id} />
                  <Link href="/settings?section=safety" className="button button-subtle small"><SlidersHorizontal aria-hidden="true" /> Plan & rules</Link>
                  <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => {
                    if (window.confirm(`Remove ${client.displayName} as your client? You’ll stop seeing their training.`)) void run(`remove-${client.id}`, async () => {
                      await trainerRemoveClient(browserClient, client.id);
                      await refreshTrainerClients();
                      return `${client.displayName} was removed.`;
                    });
                  }}>Remove</button>
                </div>
              </li>
            );
          })}</ul>}
      </article>

      <article className="panel">
        <div className="panel-title"><h3>Message all clients</h3></div>
        <p className="card-note">Shows on their Home and as a notification (if they have notifications on). Up to 5 a day.</p>
        <label className="field-label broadcast-field">
          <span className="sr-only">Message</span>
          <textarea value={message} maxLength={BROADCAST_MAX + 50} rows={3} placeholder="e.g. Gym’s closed Sunday — do the home workout in the app 💪" onChange={(event) => setMessage(event.target.value)} />
          <small className={message.trim().length > BROADCAST_MAX ? "over" : ""}>{message.trim().length}/{BROADCAST_MAX}</small>
        </label>
        <button type="button" className="button button-primary" disabled={Boolean(problem) || Boolean(busy) || !clients.length} onClick={() => void run("send", async () => {
          await sendBroadcast(browserClient, message.trim());
          setMessage("");
          setSent(await loadMyBroadcasts(browserClient, trainerId));
          return `Sent to ${clients.length} ${clients.length === 1 ? "client" : "clients"}.`;
        })}><Send aria-hidden="true" /> {busy === "send" ? "Sending…" : "Send to everyone"}</button>
        {sent.length > 0 && <ul className="sent-broadcasts">{sent.map((item) => (
          <li key={item.id}><p>{item.body}</p><small>{dateLabel(item.at.slice(0, 10), { month: "short", day: "numeric" })}</small>
            <button type="button" className="icon-button" aria-label="Delete this message" disabled={Boolean(busy)} onClick={() => void run(`delete-${item.id}`, async () => {
              await deleteBroadcast(browserClient, item.id);
              setSent((list) => list.filter((entry) => entry.id !== item.id));
              return "Message deleted.";
            })}><Trash2 aria-hidden="true" /></button></li>
        ))}</ul>}
      </article>

      {error && <p role="alert" className="form-error">{error}</p>}
      {showQr && <GymQrSheet onClose={() => setShowQr(false)} />}
    </section>
  );
}

/** A one-time QR the trainer shows on their phone; the client scans it with their camera and lands on /join/<code>. */
function GymQrSheet({ onClose }: { onClose: () => void }) {
  const { browserClient } = useFitTrack();
  useScrollLock();
  const [invite, setInvite] = useState<{ code: string; expiresAt: string; svg: string } | null>(null);
  const [error, setError] = useState("");
  // "Train together": the client also joins your buddy group (your plan, the same session each day).
  const [together, setTogether] = useState(false);

  const make = useCallback(async () => {
    if (!browserClient) return;
    setError(""); setInvite(null);
    try {
      const created = await createTrainerInvite(browserClient, together);
      const svg = await QRCode.toString(joinLink(window.location.origin, created.code), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b2424", light: "#ffffff" } });
      setInvite({ ...created, svg });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The QR couldn’t be made. Please try again."); }
  }, [browserClient, together]);

  useEffect(() => { const timer = window.setTimeout(() => void make(), 0); return () => window.clearTimeout(timer); }, [make]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Your gym QR" onClick={onClose}>
      <section className="modal gym-qr-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <span className="onb-kicker">Gym QR</span>
        <h2>{together ? "Scan to train with me" : "Scan to add me as your trainer"}</h2>
        <div className="segmented gym-qr-mode" role="radiogroup" aria-label="What the QR does">
          <button type="button" role="radio" aria-checked={!together} className={!together ? "selected" : ""} onClick={() => setTogether(false)}><UserPlus aria-hidden="true" /> Add as client</button>
          <button type="button" role="radio" aria-checked={together} className={together ? "selected" : ""} onClick={() => setTogether(true)}><Users aria-hidden="true" /> Train together</button>
        </div>
        {together && <p className="card-note">They add you as their trainer and join your Train together group: your plan, the same session each day, their own weights. Up to 3 people.</p>}
        {invite ? <>
          <div className="qr-box gym-qr" role="img" aria-label={`QR code with trainer code ${invite.code}`} dangerouslySetInnerHTML={{ __html: invite.svg }} />
          <p className="gym-qr-code">Or type <strong>{invite.code}</strong> in Settings → Trainers</p>
          <p className="card-note">Works for one client, until {/^\d{4}-\d{2}-\d{2}/.test(invite.expiresAt) ? dateLabel(invite.expiresAt.slice(0, 10), { month: "long", day: "numeric" }) : "7 days from now"}. Make a new one for the next client.</p>
          <button type="button" className="button button-subtle full-width" onClick={() => void make()}><QrCode aria-hidden="true" /> New QR for the next client</button>
        </> : error ? <p role="alert" className="form-error">{error}</p> : <p role="status">Making your QR…</p>}
      </section>
    </div>,
    document.body,
  );
}
