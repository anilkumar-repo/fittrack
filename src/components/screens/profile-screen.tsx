"use client";

import Link from "next/link";
import { Activity, BookOpen, CalendarRange, ListPlus, ChartColumn, ChevronRight, Download, Flame, Menu, MessageCircle, StretchHorizontal, Users } from "lucide-react";
import { AvatarPicker } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { calculateStreak } from "@/lib/rozi";
import { levelTitle } from "@/lib/levels";
import { bmi } from "@/lib/body";
import { CountUp } from "@/components/ui/count-up";

const LINKS = [
  { href: "/streak", label: "Streak calendar", note: "Every day, done or rested", icon: Flame },
  { href: "/progress", label: "Progress", note: "Charts, records and BMI", icon: ChartColumn },
  { href: "/recovery", label: "Recovery map", note: "Which muscles are ready", icon: Activity },
  { href: "/report", label: "Your week with Rozi", note: "This week's summary", icon: CalendarRange },
  { href: "/library", label: "Exercise library", note: "Every move with pictures", icon: BookOpen },
  { href: "/routines", label: "My routines", note: "Build your own workouts", icon: ListPlus },
  { href: "/mobility", label: "Stretch & mobility", note: "Short guided routines", icon: StretchHorizontal },
  { href: "/friends", label: "Friends & trainers", note: "Codes, challenges, nudges", icon: Users },
  { href: "/rozi", label: "Ask Rozi", note: "Quick answers about your training", icon: MessageCircle },
  { href: "/install", label: "Install the app", note: "Add RozFit to your Home Screen", icon: Download },
];

/** Profile: who you are at a glance. The ☰ button opens Settings. */
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
        <Link href="/settings" className="icon-button profile-menu" aria-label="Open settings"><Menu aria-hidden="true" /></Link>
        <AvatarPicker />
        <h2>{profile.displayName}</h2>
        <p>{isDemo ? "Saved on this device" : state.userEmail ?? "Signed in"} · {levelTitle(profile.experience)}</p>
        <div className="profile-stats">
          <div><strong><CountUp value={workouts} /></strong><small>workouts</small></div>
          <div><strong><CountUp value={streak.current} /></strong><small>in a row</small></div>
          <div><strong>{bodyMass ? <CountUp value={bodyMass} decimals={1} /> : "—"}</strong><small>BMI</small></div>
        </div>
      </article>
      <nav className="profile-links panel" aria-label="Your pages">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            <span className="profile-link-icon"><item.icon aria-hidden="true" /></span>
            <span><strong>{item.label}</strong><small>{item.note}</small></span>
            <ChevronRight aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
}
