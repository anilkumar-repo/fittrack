"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { AvatarPicker } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { calculateStreak } from "@/lib/rozi";
import { levelTitle } from "@/lib/levels";
import { bmi } from "@/lib/body";
import { CountUp } from "@/components/ui/count-up";
import { PublicProfileCard } from "./discover-screen";


/** Profile: who you are at a glance (opened from your picture in the top bar). The ☰ button opens Settings and everything else. */
export function ProfileScreen() {
  const { state, isDemo, recordedSessions, currentDate } = useFitTrack();
  const profile = state.profile;
  const workouts = recordedSessions.filter((session) => session.status === "completed").length;
  const streak = calculateStreak(profile, recordedSessions, currentDate);
  const latestWeight = state.bodyWeightEntries.at(-1)?.weightKg;
  const bodyMass = profile.heightCm && latestWeight ? bmi(profile.heightCm, latestWeight) : null;
  return (
    <section className="profile-page">
      <article className="panel profile-card">
        <Link href="/settings" className="icon-button profile-menu" aria-label="Menu: plan, settings and more"><Menu aria-hidden="true" /></Link>
        <AvatarPicker />
        <h2>{profile.displayName}</h2>
        <p>{isDemo ? "Saved on this device" : state.userEmail ?? "Signed in"} · {levelTitle(profile.experience)}</p>
        <div className="profile-stats">
          <div><strong><CountUp value={workouts} /></strong><small>workouts</small></div>
          <div><strong><CountUp value={streak.current} /></strong><small>in a row</small></div>
          <div><strong>{bodyMass ? <CountUp value={bodyMass} decimals={1} /> : "—"}</strong><small>BMI</small></div>
        </div>
      </article>
      <PublicProfileCard />
    </section>
  );
}
