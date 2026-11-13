"use client";

import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { MissedDayPrompt } from "./missed-day-prompt";
import { TourGuide } from "./tour-guide";
import { LevelChangePopup } from "./level-change";
import { GlassGlider } from "./glass-glider";
import { Avatar } from "./avatar";
import { unexplainedMissedDays } from "@/lib/missed-days";
import { AlertCircle, BookOpen, ChartColumn, Check, CloudOff, Dumbbell, House, Settings, Users, X, type LucideIcon } from "lucide-react";
import { noticeDuration, noticeIsProblem } from "@/lib/notice";
import { usePathname } from "next/navigation";
import { dateLabel, weekdayOf } from "@/lib/dates";
import { RULE_VERSION } from "@/lib/templates";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { Welcome } from "./welcome";

const navItems: Array<{ href: string; label: string; shortLabel: string; icon: LucideIcon; title: string }> = [
  { href: "/", label: "Home", shortLabel: "Home", icon: House, title: "Home" },
  { href: "/today", label: "Train", shortLabel: "Train", icon: Dumbbell, title: "Train" },
  { href: "/progress", label: "Progress", shortLabel: "Progress", icon: ChartColumn, title: "Your progress" },
  { href: "/friends", label: "Friends", shortLabel: "Friends", icon: Users, title: "Friends" },
  { href: "/library", label: "Library", shortLabel: "Library", icon: BookOpen, title: "Exercise library" },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings, title: "Settings" },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

/** Sidebar, top bar, messages, and mobile navigation around every page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, ready, isDemo, accountLoading, authChecked, currentDate, notice, setNotice, saveError, savingSession, retryPendingSessions } = useFitTrack();

  if (!ready || !authChecked || (accountLoading && isDemo)) return <main className="app-loading"><BrandMark /><span>Getting your training space ready…</span></main>;
  if (!state.onboarded) return <Welcome />;
  const missedDays = unexplainedMissedDays(state.profile, state.sessions, currentDate);

  const active = navItems.find((item) => item.href === pathname);
  const pageTitle = active?.title ?? (pathname === "/sign-in" ? "Sign in" : pathname === "/streak" ? "Your streak" : "RozFit");
  const dueToday = state.profile.trainingDays.includes(weekdayOf(currentDate)) || Boolean(sessionForDate(state, currentDate));
  const saveLabel = isDemo
    ? accountLoading ? "Loading your account…" : "Saved on this device"
    : savingSession ? "Saving workout…" : saveError ? "Sync needs attention" : "Synced to your account";

  return (
    <div className="app-shell">
      {missedDays.length > 0 && <MissedDayPrompt dates={missedDays} />}
      <TourGuide blocked={missedDays.length > 0} />
      <LevelChangePopup />
      <GlassGlider />
      <aside className="sidebar">
        <Link className="brand" href="/">
          <BrandMark /><span><strong>RozFit</strong><small>Small steps, every day</small></span>
        </Link>
        <div className="side-caption">YOUR SPACE</div>
        <nav aria-label="Main navigation" className="side-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${active?.href === item.href ? "active" : ""}`} aria-current={active?.href === item.href ? "page" : undefined}>
              <Icon><item.icon aria-hidden="true" strokeWidth={2} /></Icon><span>{item.label}</span>{item.href === "/today" && dueToday && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card"><span className="support-icon">✦</span><strong>Small steps count</strong><p>Your plan adapts as you build a steady routine.</p></div>
          <Link className="profile-mini" href="/settings">
            <Avatar value={state.profile.avatar} name={state.profile.displayName} size={36} className="avatar" />
            <span className="profile-mini-text"><strong>{state.profile.displayName}</strong><small>{isDemo ? "Saved on this device" : state.userEmail ?? "Signed in"}</small></span>
            <span className="mini-dots">···</span>
          </Link>
        </div>
      </aside>

      <main className="main-area">
        {/* Home has no top bar: its hero carries the picture, greeting and date. */}
        {pathname === "/" ? <h1 className="sr-only">Home</h1> : <header className="topbar">
          <div><span className="eyebrow">{dateLabel(currentDate, { month: "long", day: "numeric", year: "numeric" })}</span><h1>{pageTitle}</h1></div>
          <div className="topbar-actions">{!isDemo && (savingSession || saveError) && <span className={`save-state ${saveError ? "sync-error" : "connected"}`}><span className="save-dot" />{saveLabel}</span>}{isDemo && hasSupabaseConfig() && pathname !== "/sign-in" && <Link className="button button-subtle topbar-sign-in" href="/sign-in">Sign in</Link>}<Link className="round-avatar has-picture" aria-label="Open settings" href="/settings"><Avatar value={state.profile.avatar} name={state.profile.displayName} size={36} /></Link></div>
        </header>}

        {/* Messages float at the top as small glass toasts; information closes by itself, sync errors stay. */}
        {(notice || saveError) && <div className="toasts">
          {notice && <div key={notice} role="status" className={`notice toast ${noticeIsProblem(notice) ? "warn" : "ok"}`} style={{ "--toast-time": `${noticeDuration(notice)}ms` } as React.CSSProperties}>
            <span className="toast-icon" aria-hidden="true">{noticeIsProblem(notice) ? <AlertCircle /> : <Check />}</span>
            <span className="toast-text">{notice}</span>
            <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => setNotice("")}><X aria-hidden="true" /></button>
            <span className="toast-timer" aria-hidden="true" />
          </div>}
          {saveError && <div role="alert" className="notice toast notice-error">
            <span className="toast-icon" aria-hidden="true"><CloudOff /></span>
            <span className="toast-text">{saveError}</span>
            <button type="button" className="retry-button" disabled={savingSession} onClick={retryPendingSessions}>{savingSession ? "Retrying…" : "Retry"}</button>
          </div>}
        </div>}

        {children}

        <footer className="app-footer"><span>RozFit · Small steps, every day</span><span>Rules {RULE_VERSION}</span></footer>
      </main>

      {/* Phone navigation: a floating glass pill for the main pages, and a round glass button for Settings. */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <div className="dock-pill">{navItems.filter((item) => item.href !== "/settings").map((item) => <Link key={item.href} href={item.href} className={active?.href === item.href ? "active" : ""} aria-label={item.label} aria-current={active?.href === item.href ? "page" : undefined}><Icon><item.icon aria-hidden="true" strokeWidth={1.8} /></Icon><small>{item.shortLabel}</small>{item.href === "/today" && dueToday && active?.href !== "/today" && <span className="dock-dot" aria-hidden="true" />}</Link>)}</div>
        <Link href="/settings" className={`dock-round ${active?.href === "/settings" ? "active" : ""}`} aria-label="Settings" aria-current={active?.href === "/settings" ? "page" : undefined}><Icon><Settings aria-hidden="true" strokeWidth={1.8} /></Icon></Link>
      </nav>
    </div>
  );
}
