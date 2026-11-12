"use client";

import Link from "next/link";
import { BookOpen, ChartColumn, Dumbbell, House, Settings, type LucideIcon } from "lucide-react";
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

  if (!ready || !authChecked || (accountLoading && isDemo)) return <main className="app-loading"><div className="brand-mark">F</div><span>Getting your training space ready…</span></main>;
  if (!state.onboarded) return <Welcome />;

  const active = navItems.find((item) => item.href === pathname);
  const pageTitle = active?.title ?? (pathname === "/sign-in" ? "Sign in" : "FitTrack");
  const dueToday = state.profile.trainingDays.includes(weekdayOf(currentDate)) || Boolean(sessionForDate(state, currentDate));
  const initial = state.profile.displayName.slice(0, 1).toUpperCase();
  const saveLabel = isDemo
    ? accountLoading ? "Loading your account…" : "Saved on this device"
    : savingSession ? "Saving workout…" : saveError ? "Sync needs attention" : "Synced to your account";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">F</span><span><strong>fittrack</strong><small>steady looks good on you</small></span>
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
            <span className="avatar">{initial}</span>
            <span className="profile-mini-text"><strong>{state.profile.displayName}</strong><small>{isDemo ? "Demo profile" : state.userEmail ?? "Connected"}</small></span>
            <span className="mini-dots">···</span>
          </Link>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          {pathname === "/" ? <h1 className="sr-only">Home</h1> : <div><span className="eyebrow">{dateLabel(currentDate, { month: "long", day: "numeric", year: "numeric" })}</span><h1>{pageTitle}</h1></div>}
          <div className="topbar-actions"><span className={`save-state ${isDemo ? "demo" : saveError ? "sync-error" : "connected"}`}><span className="save-dot" />{saveLabel}</span>{isDemo && hasSupabaseConfig() && pathname !== "/sign-in" && <Link className="button button-subtle topbar-sign-in" href="/sign-in">Sign in</Link>}<Link className="round-avatar" aria-label="Open settings" href="/settings">{initial}</Link></div>
        </header>

        {notice && <div role="status" className="notice"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
        {saveError && <div role="alert" className="notice notice-error"><span>{saveError}</span><button className="retry-button" disabled={savingSession} onClick={retryPendingSessions}>{savingSession ? "Retrying…" : "Retry sync"}</button></div>}

        {children}

        <footer className="app-footer"><span>FitTrack · Build a routine that fits your life</span><span>Rules {RULE_VERSION} <i>·</i> {isDemo ? "Demo mode" : "Supabase connected"}</span></footer>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <Link key={item.href} href={item.href} className={active?.href === item.href ? "active" : ""} aria-label={item.label} aria-current={active?.href === item.href ? "page" : undefined}><Icon><item.icon aria-hidden="true" strokeWidth={2} /></Icon><small>{item.shortLabel}</small></Link>)}</nav>
    </div>
  );
}
