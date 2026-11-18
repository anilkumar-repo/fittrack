"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandMark } from "./brand-mark";
import { MissedDayPrompt } from "./missed-day-prompt";
import { TourGuide } from "./tour-guide";
import { LevelChangePopup } from "./level-change";
import { GlassGlider } from "./glass-glider";
import { DockScrub } from "./dock-scrub";
import { ProfileGate } from "./profile-gate";
import { Avatar } from "./avatar";
import { unexplainedMissedDays } from "@/lib/missed-days";
import { AlertCircle, BookOpen, ChartColumn, Check, CloudOff, Dumbbell, House, MessageCircle, Settings, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { noticeDuration, noticeIsProblem } from "@/lib/notice";
import { usePathname, useRouter } from "next/navigation";
import { dateLabel, weekdayOf } from "@/lib/dates";
import { RULE_VERSION } from "@/lib/templates";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { START_TODAY_KEY, WANT_PUSH_KEY, Welcome } from "./welcome";
import { enablePush, syncPushOwner } from "@/lib/push-client";
import { joinCode, PENDING_JOIN_KEY } from "@/lib/trainers";
import { InstallHint } from "./install-hint";
import { RoziLoader } from "./rozi-loader";
import { useChats } from "@/components/screens/chats-screen";

const navItems: Array<{ href: string; label: string; shortLabel: string; icon: LucideIcon; title: string }> = [
  { href: "/", label: "Home", shortLabel: "Home", icon: House, title: "Home" },
  { href: "/today", label: "Train", shortLabel: "Train", icon: Dumbbell, title: "Train" },
  { href: "/progress", label: "Progress", shortLabel: "Progress", icon: ChartColumn, title: "Your progress" },
  { href: "/friends", label: "Friends", shortLabel: "Friends", icon: Users, title: "Friends" },
  { href: "/library", label: "Library", shortLabel: "Library", icon: BookOpen, title: "Exercise library" },
  { href: "/profile", label: "Profile", shortLabel: "Profile", icon: UserRound, title: "Your profile" },
  { href: "/rozi", label: "Ask Rozi", shortLabel: "Rozi", icon: MessageCircle, title: "Ask Rozi" },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings, title: "Settings" },
];

/** The phone dock: Library moves into Profile, Settings into Profile's menu, and Rozi takes the round corner button. */
const DOCK_HREFS = ["/", "/today", "/progress", "/friends", "/profile"];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

/** Sidebar, top bar, messages, and mobile navigation around every page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Unread chat messages (signed in only): a badge on the chat button and a dot on Friends.
  const { unread: unreadChats } = useChats();
  // Big page titles shrink into a frosted bar once the page scrolls (see "LIQUID GLASS 2" in globals.css).
  useEffect(() => {
    const root = document.documentElement;
    const update = () => root.classList.toggle("scrolled", window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);
  const { state, ready, isDemo, accountLoading, authChecked, currentDate, notice, setNotice, saveError, savingSession, retryPendingSessions, browserClient } = useFitTrack();
  const router = useRouter();
  // After setup: "First workout: Today" opens Train once, and "Allow notifications" is finished once signed in.
  useEffect(() => {
    if (!ready || !state.onboarded) return;
    try {
      if (window.localStorage.getItem(START_TODAY_KEY) === "1") {
        window.localStorage.removeItem(START_TODAY_KEY);
        router.push(state.profile.trainingDays.includes(weekdayOf(currentDate)) ? "/today" : "/today?extra=1");
      }
      if (!isDemo && browserClient && window.localStorage.getItem(WANT_PUSH_KEY) === "1" && "Notification" in window && Notification.permission === "granted") {
        window.localStorage.removeItem(WANT_PUSH_KEY);
        void enablePush(browserClient, state.profile.timeZone).then(() => setNotice("Reminders are on. Rozi will check in.")).catch(() => undefined);
      }
    } catch { /* storage blocked: nothing to do */ }
  }, [ready, state.onboarded, isDemo, browserClient, currentDate, state.profile.trainingDays, state.profile.timeZone, router, setNotice]);

  // Signed in on a phone that already allows notifications: make sure they're about this account
  // (another account may have signed in here before and still own this phone's reminders).
  const accountId = isDemo ? null : state.profile.id;
  useEffect(() => {
    if (!ready || !accountId || !browserClient || !state.onboarded) return;
    syncPushOwner(browserClient, state.profile.timeZone, accountId).catch(() => undefined);
  }, [ready, accountId, browserClient, state.onboarded, state.profile.timeZone]);

  // Gym QR (/join/<code>): remember the code, so someone who first has to set up RozFit or sign in comes back to it.
  useEffect(() => {
    if (!pathname?.startsWith("/join/")) return;
    const code = joinCode(pathname);
    try { if (code) window.localStorage.setItem(PENDING_JOIN_KEY, code); } catch { /* storage blocked */ }
  }, [pathname]);
  useEffect(() => {
    if (!ready || !state.onboarded || isDemo || pathname?.startsWith("/join/")) return;
    try {
      const pending = window.localStorage.getItem(PENDING_JOIN_KEY);
      if (pending) router.replace(`/join/${pending}`);
    } catch { /* storage blocked */ }
  }, [ready, state.onboarded, isDemo, pathname, router]);

  if (!ready || !authChecked || (accountLoading && isDemo)) return <RoziLoader />;
  if (!state.onboarded) return <><Welcome /><InstallHint /></>;
  const missedDays = unexplainedMissedDays(state.profile, state.sessions, currentDate);

  const active = navItems.find((item) => item.href === pathname);
  const pageTitle = active?.title ?? (pathname === "/sign-in" ? "Sign in" : pathname === "/streak" ? "Your streak" : pathname === "/install" ? "Install the app" : pathname === "/mobility" ? "Stretch & mobility" : pathname === "/recovery" ? "Recovery" : pathname === "/report" ? "Your week" : pathname === "/routines" ? "My routines" : pathname === "/clients" ? "My clients" : pathname === "/buddies" ? "Train together" : pathname === "/chats" ? "Chats" : pathname === "/feed" ? "Feed" : pathname?.startsWith("/chats/") ? "Chat" : pathname?.startsWith("/join/") ? "Add your trainer" : "RozFit");
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
      <DockScrub />
      {missedDays.length === 0 && <InstallHint />}
      {missedDays.length === 0 && <ProfileGate />}
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
          <div className="topbar-actions">{!isDemo && (savingSession || saveError) && <span className={`save-state ${saveError ? "sync-error" : "connected"}`}><span className="save-dot" />{saveLabel}</span>}{isDemo && hasSupabaseConfig() && pathname !== "/sign-in" && <Link className="button button-subtle topbar-sign-in" href="/sign-in">Sign in</Link>}{!isDemo && <Link className={`topbar-chat ${pathname?.startsWith("/chats") ? "active" : ""}`} href="/chats" aria-label={unreadChats ? `Chats, ${unreadChats} unread` : "Chats"}><MessageCircle aria-hidden="true" />{unreadChats > 0 && <span className="topbar-chat-badge" aria-hidden="true">{unreadChats > 9 ? "9+" : unreadChats}</span>}</Link>}<Link className="round-avatar has-picture" aria-label="Open your profile" href="/profile"><Avatar value={state.profile.avatar} name={state.profile.displayName} size={36} /></Link></div>
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
        <div className="dock-pill">{navItems.filter((item) => DOCK_HREFS.includes(item.href)).map((item) => {
          const on = active?.href === item.href || (item.href === "/profile" && (pathname === "/settings" || pathname === "/library")) || (item.href === "/friends" && (pathname?.startsWith("/chats") === true || pathname === "/buddies" || pathname === "/feed"));
          return <Link key={item.href} href={item.href} className={on ? "active" : ""} aria-label={item.label} aria-current={on ? "page" : undefined}><Icon>{item.href === "/profile" ? <Avatar value={state.profile.avatar} name={state.profile.displayName} size={24} className="dock-avatar" /> : <item.icon aria-hidden="true" strokeWidth={1.8} />}</Icon><small>{item.shortLabel}</small>{item.href === "/today" && dueToday && active?.href !== "/today" && <span className="dock-dot" aria-hidden="true" />}{item.href === "/friends" && unreadChats > 0 && <span className="dock-dot chat" aria-hidden="true" />}</Link>;
        })}</div>
        <Link href="/rozi" className={`dock-round dock-rozi ${active?.href === "/rozi" ? "active" : ""}`} aria-label="Ask Rozi" aria-current={active?.href === "/rozi" ? "page" : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- small static Rozi face */}
          <img src="/rozi/faces/v1/happy.webp" alt="" width={52} height={52} />
        </Link>
      </nav>
    </div>
  );
}
