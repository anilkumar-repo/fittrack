"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, Users } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { Rozi } from "@/components/app/rozi";
import { SignInForm } from "@/components/app/sign-in-form";
import { acceptTrainerInvite } from "@/lib/supabase-repository";
import { joinCode, PENDING_JOIN_KEY, SHARE_OPTIONS, DEFAULT_TRAINER_SHARES } from "@/lib/trainers";
import { joinTrainerGroup, loadTrainerProfiles, trainerInviteInfo, type TrainerInviteInfo, type TrainerProfile } from "@/lib/trainers-repository";

/**
 * The page a trainer's gym QR opens: "Add Asha as your trainer?" — or, for a "Train together" QR, "Train with Asha?"
 * (also joins Asha's buddy group). Signed-out people sign in first (the code is remembered); new people go through
 * Get started and come back here automatically (see AppShell).
 */
export function JoinScreen({ code: rawCode }: { code: string }) {
  const { isDemo, browserClient, state, setNotice } = useFitTrack();
  const router = useRouter();
  const code = joinCode(rawCode);
  const [trainer, setTrainer] = useState<TrainerInviteInfo | null | undefined>(undefined);
  const [about, setAbout] = useState<TrainerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code || isDemo || !browserClient) return;
    // Signed in and on this page: the remembered code has done its job (no redirecting here again later).
    try { window.localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* fine */ }
    let live = true;
    trainerInviteInfo(browserClient, code).then(async (info) => {
      if (!live) return;
      setTrainer(info);
      if (info) { const profiles = await loadTrainerProfiles(browserClient, [info.id]); if (live) setAbout(profiles.get(info.id) ?? null); }
    }).catch(() => { if (live) setTrainer(null); });
    return () => { live = false; };
  }, [code, isDemo, browserClient]);

  async function add(together: boolean) {
    if (!code || !browserClient || busy) return;
    setBusy(true); setError("");
    const name = trainer?.name ?? "Your trainer";
    try {
      await acceptTrainerInvite(browserClient, code, "qr");
      try { window.localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* fine */ }
      if (together) {
        try {
          await joinTrainerGroup(browserClient, code);
          setNotice(`You’re training with ${name} now: the same plan and the same session each day.`);
          router.replace("/buddies");
        } catch (cause) {
          // The trainer link worked; only joining the group didn't (for example, you're already in a group).
          setNotice(`${name} is now your trainer. ${cause instanceof Error ? cause.message : "Joining their group didn’t work."}`);
          router.replace("/settings?section=trainers");
        }
        return;
      }
      setNotice(`${name} is now your trainer.`);
      router.replace("/settings?section=trainers");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn’t work. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="join-page">
      <article className="panel join-card">
        {!code ? <>
          <Rozi mood="grumpy" size={110} eager />
          <h2>This link doesn’t look right</h2>
          <p>Ask your trainer to show their RozFit QR again, or type their code in Settings → Trainers.</p>
          <Link href="/" className="button button-primary">Go home</Link>
        </> : isDemo || !browserClient ? <>
          <Rozi mood="hello" size={110} eager />
          <h2>Sign in to add your trainer</h2>
          <p>Your trainer needs your account to see your workouts. Sign in with your email — we’ll come straight back here.</p>
          {browserClient ? <SignInForm /> : <p className="card-note">Accounts aren’t set up on this copy of RozFit.</p>}
        </> : trainer === undefined ? <>
          <Rozi mood="chat-thinking" size={110} eager />
          <p role="status">Checking the code…</p>
        </> : trainer === null ? <>
          <Rozi mood="grumpy" size={110} eager />
          <h2>This code has expired</h2>
          <p>Each QR works once and for 7 days. Ask your trainer to show a new one.</p>
          <Link href="/" className="button button-subtle">Go home</Link>
        </> : trainer.id === state.profile.id ? <>
          <Rozi mood="grumpy" size={110} eager />
          <h2>That’s your own QR</h2>
          <p>Show it to a client: they scan it with their phone camera.</p>
        </> : <>
          <Avatar value={trainer.avatar} name={trainer.name} size={84} className="join-avatar" />
          <span className="onb-kicker">{trainer.together ? <><Users aria-hidden="true" /> Trainer · Train together</> : <><Dumbbell aria-hidden="true" /> Trainer</>}</span>
          <h2>{trainer.together ? `Train with ${trainer.name}?` : `Add ${trainer.name} as your trainer?`}</h2>
          {about?.specialties.length ? <div className="chip-row join-specialties">{about.specialties.map((item) => <span key={item} className="chip">{item}</span>)}</div> : null}
          {about?.bio ? <p className="join-bio">“{about.bio}”</p> : null}
          {trainer.together
            ? <p>{trainer.name} becomes your trainer and you join their Train together group: their plan — the same days and the same session — with your own weights and level. You choose what they see, and you can leave or remove them any time.</p>
            : <p>They’ll be able to follow your training and adjust your plan. You choose what they see, and you can remove them any time.</p>}
          <ul className="join-shares">
            {SHARE_OPTIONS.map((option) => <li key={option.key} className={DEFAULT_TRAINER_SHARES[option.key] ? "on" : ""}>{DEFAULT_TRAINER_SHARES[option.key] ? <Check aria-hidden="true" /> : <span aria-hidden="true">–</span>}<span><strong>{option.label}</strong> <small>{DEFAULT_TRAINER_SHARES[option.key] ? "shared" : "not shared · you can turn it on later"}</small></span></li>)}
          </ul>
          <button type="button" className="button button-primary full-width" disabled={busy} onClick={() => void add(trainer.together)}>{busy ? "Adding…" : trainer.together ? `Add ${trainer.name} & train together` : `Add ${trainer.name}`}</button>
          {trainer.together && <button type="button" className="button button-subtle full-width" disabled={busy} onClick={() => void add(false)}>Only add as my trainer</button>}
          <Link href="/" className="text-button">Not now</Link>
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </article>
    </section>
  );
}
