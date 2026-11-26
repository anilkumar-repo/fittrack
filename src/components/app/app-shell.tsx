"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import { BrandMark } from "./brand-mark";
import { MissedDayPrompt } from "./missed-day-prompt";
import { TourGuide } from "./tour-guide";
import { LevelChangePopup } from "./level-change";
import { GlassGlider } from "./glass-glider";
import { DockScrub } from "./dock-scrub";
import { ProfileGate } from "./profile-gate";
import { Avatar } from "./avatar";
import { unexplainedMissedDays } from "@/lib/missed-days";
import { AlertCircle, ArrowLeft, ChartColumn, Check, ChevronUp, CloudOff, Dumbbell, House, MessageCircle, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { noticeDuration, noticeIsProblem } from "@/lib/notice";
import { usePathname, useRouter } from "next/navigation";
import { dateLabel, weekdayOf } from "@/lib/dates";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { START_TODAY_KEY, WANT_PUSH_KEY, Welcome } from "./welcome";
import { enablePush, syncPushOwner } from "@/lib/push-client";
import { joinCode, PENDING_JOIN_KEY } from "@/lib/trainers";
import { InstallHint } from "./install-hint";
import { RoziLoader } from "./rozi-loader";
import { useChats } from "@/components/screens/chats-screen";

/**
 * The four main tabs (docs/DESIGN.md §7): Today · Workouts · (Rozi) · Progress · Together. Each tab also lights up for
 * the pages that belong to it, so you always know where you are. Profile opens from your picture in the top bar.
 */
interface Tab { href: string; label: string; icon: LucideIcon; pages: string[] }
const TABS: Tab[] = [
  { href: "/", label: "Today", icon: House, pages: ["/", "/today"] },
  { href: "/library", label: "Workouts", icon: Dumbbell, pages: ["/library", "/routines", "/mobility"] },
  { href: "/progress", label: "Progress", icon: ChartColumn, pages: ["/progress", "/streak", "/recovery", "/report"] },
  { href: "/friends", label: "Together", icon: Users, pages: ["/friends", "/chats", "/feed", "/discover", "/buddies", "/people", "/clients", "/join"] },
];

function tabFor(pathname: string | null): Tab | undefined {
  const path = pathname ?? "/";
  return TABS.find((tab) => tab.pages.some((page) => page === "/" ? path === "/" || path === "/today" : path === page || path.startsWith(`${page}/`)));
}

/** Page titles in the top bar. */
const TITLES: Record<string, string> = {
  "/": "Today", "/today": "Train", "/library": "Workouts", "/routines": "My routines", "/mobility": "Stretch & mobility",
  "/progress": "Your progress", "/streak": "Your streak", "/recovery": "Recovery", "/report": "Your week",
  "/friends": "Together", "/chats": "Chats", "/feed": "Feed", "/discover": "Find friends", "/buddies": "Train together", "/clients": "My clients",
  "/profile": "Your profile", "/settings": "Settings", "/rozi": "Ask Rozi", "/install": "Install the app", "/sign-in": "Sign in",
};
function titleFor(pathname: string | null): string {
  const path = pathname ?? "/";
  if (TITLES[path]) return TITLES[path];
  if (path.startsWith("/people/")) return "Profile";
  if (path.startsWith("/chats/")) return "Chat";
  if (path.startsWith("/join/")) return "Add your trainer";
  return "RozFit";
}

/** Pages one level down get a back button to where they belong (not browser history, so it's predictable). */
const PARENTS: Record<string, string> = {
  "/today": "/", "/routines": "/library", "/mobility": "/library",
  "/streak": "/progress", "/recovery": "/progress", "/report": "/progress",
  // Feed, Chats and Train together are tabs of Together (Phase 6), so they need no back button.
  "/discover": "/friends", "/clients": "/friends",
  "/settings": "/profile", "/install": "/settings",
};
function parentFor(pathname: string | null): string | null {
  const path = pathname ?? "/";
  if (PARENTS[path]) return PARENTS[path];
  if (path.startsWith("/chats/")) return "/chats";
  if (path.startsWith("/people/")) return "/friends";
  return null;
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

/**
 * Which way a page change should slide: tabs follow their order in the dock (left/right), a page one level down comes
 * in from the right, and going back up comes in from the left.
 */
const SUB_TABS = ["/friends", "/feed", "/chats", "/buddies"];
/** Long list pages where the top bar slides away while scrolling down, like YouTube. */
const HIDE_BAR_PAGES = ["/library", "/progress", "/feed"];
function slideFor(from: string, to: string): number {
  const fromTab = TABS.indexOf(tabFor(from) as Tab);
  const toTab = TABS.indexOf(tabFor(to) as Tab);
  if (fromTab >= 0 && toTab >= 0 && fromTab !== toTab) return toTab > fromTab ? 1 : -1;
  // Sub-tabs (Together: Friends · Feed · Chats · Buddies) follow their order in the tab row too.
  const fromSub = SUB_TABS.indexOf(from);
  const toSub = SUB_TABS.indexOf(to);
  if (fromSub >= 0 && toSub >= 0) return toSub > fromSub ? 1 : -1;
  if (parentFor(from) === to || from.startsWith(`${to}/`)) return -1;
  return 1;
}

/** Sidebar, top bar, messages, and mobile navigation around every page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Unread chat messages (signed in only): a badge on the chat button and a dot on Friends.
  const { unread: unreadChats } = useChats();
  // Page transitions (2026-11-25): the new page fades and slides in from the side it comes from (slideFor). It
  // animates the page's own elements, never a wrapper, so layout rules that expect the page directly inside
  // .main-area keep working. A back swipe or the browser's back button already has its own slide on iPhone, so those
  // only get a short fade.
  const previousPath = useRef<string | null>(null);
  const historyMove = useRef(false);
  // The slide waiting for the new page's content; the content can arrive a moment after the address changes (after
  // loading), so new elements are animated when they show up, for up to 900 ms. Elements already animated are skipped.
  const pending = useRef<{ frames: Keyframe[]; duration: number; until: number } | null>(null);
  const animated = useRef(new WeakSet<Element>());
  useEffect(() => {
    const onPop = () => { historyMove.current = true; };
    window.addEventListener("popstate", onPop);
    const main = document.querySelector<HTMLElement>(".main-area");
    const isPagePart = (element: Element): element is HTMLElement => element instanceof HTMLElement && !element.matches(".topbar, .toasts, .sr-only, .together-tabs");
    // Whatever is on screen at the start counts as already shown.
    if (main) for (const child of main.children) animated.current.add(child);
    const watcher = new MutationObserver((changes) => {
      const plan = pending.current;
      if (!plan || performance.now() > plan.until) return;
      for (const change of changes) for (const node of change.addedNodes) {
        if (!isPagePart(node as Element) || animated.current.has(node as Element)) continue;
        animated.current.add(node as Element);
        (node as HTMLElement).animate(plan.frames, { duration: plan.duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
      }
    });
    if (main) watcher.observe(main, { childList: true });
    return () => { window.removeEventListener("popstate", onPop); watcher.disconnect(); };
  }, []);
  useLayoutEffect(() => {
    const from = previousPath.current;
    const to = pathname ?? "/";
    previousPath.current = to;
    const fromHistory = historyMove.current;
    historyMove.current = false;
    if (!from || from === to) return;
    const main = document.querySelector<HTMLElement>(".main-area");
    if (!main) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shift = reduce || fromHistory ? 0 : slideFor(from, to) * 28;
    const frames: Keyframe[] = shift ? [{ opacity: 0, transform: `translateX(${shift}px)` }, { opacity: 1, transform: "none" }] : [{ opacity: 0 }, { opacity: 1 }];
    const duration = shift ? 320 : 180;
    pending.current = { frames, duration, until: performance.now() + 900 };
    // The new page's elements already in place now; later ones are caught by the watcher above.
    for (const child of main.children) {
      if (!(child instanceof HTMLElement) || child.matches(".topbar, .toasts, .sr-only, .together-tabs") || animated.current.has(child)) continue;
      animated.current.add(child);
      child.animate(frames, { duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }
    // The top bar stays put; only its title cross-fades to the new page's name.
    main.querySelector(".topbar-text")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
  }, [pathname]);
  // Big page titles shrink into a frosted bar once the page scrolls (see "LIQUID GLASS 2" in globals.css).
  // "scrolled" (top bar shadow) and "dock-compact": like Instagram, the phone dock shrinks to a smaller pill while
  // you scroll down, and comes back to full size as soon as you scroll up or reach the top. Read once per frame.
  useEffect(() => {
    const root = document.documentElement;
    let last = window.scrollY;
    let barHeight = "";
    let frame = 0;
    const update = () => {
      frame = 0;
      // While a sheet is open the page is pinned (use-scroll-lock) and scrollY reads 0. Ignore that, or the top bar
      // jumps back to its big header behind the sheet and snaps small again on close (the "blink").
      if (root.classList.contains("scroll-locked")) return;
      const y = window.scrollY;
      root.classList.toggle("scrolled", y > 12);
      // The top bar's real height (it shrinks once the page scrolls), for things that stick under it, such as the
      // A–Z letter headers in Workouts. A fixed guess let them slide underneath the bar.
      // Written only when it changes: a new value on the root restyles the whole page, which made scrolling lag.
      const bar = document.querySelector<HTMLElement>(".topbar");
      const height = bar ? `${bar.offsetHeight}px` : "";
      if (bar && height !== barHeight) { barHeight = height; root.style.setProperty("--topbar-h", height); }
      const delta = y - last;
      if (y < 80 || delta < -6) root.classList.remove("dock-compact", "bar-hidden");
      else if (delta > 6) root.classList.add("dock-compact", "bar-hidden");
      if (Math.abs(delta) > 6 || y < 80) last = y;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    root.classList.remove("dock-compact");
    // The bar animates to its smaller size: measure again when that animation ends.
    const onBarResized = (event: TransitionEvent) => { if (event.target instanceof Element && event.target.matches(".topbar, .topbar *")) onScroll(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("transitionend", onBarResized);
    // YouTube-style (2026-11-25): on the long list pages the top bar slides away while you scroll down and comes back
    // as soon as you scroll up (CSS: html[data-hide-bar].bar-hidden). Other pages keep it pinned.
    if (HIDE_BAR_PAGES.includes(pathname ?? "")) root.dataset.hideBar = "on"; else delete root.dataset.hideBar;
    root.classList.remove("bar-hidden");
    return () => { root.classList.remove("bar-hidden"); delete root.dataset.hideBar; window.removeEventListener("scroll", onScroll); document.removeEventListener("transitionend", onBarResized); if (frame) window.cancelAnimationFrame(frame); root.classList.remove("dock-compact"); };
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
  // Onboarding gets the same sliding glass and press-and-slide as the app (unit switches, sex picker).
  if (!state.onboarded) return <><Welcome /><GlassGlider /><DockScrub /><InstallHint /></>;
  const missedDays = unexplainedMissedDays(state.profile, state.sessions, currentDate);

  const activeTab = tabFor(pathname);
  const pageTitle = titleFor(pathname);
  const parent = parentFor(pathname);
  const onProfile = pathname === "/profile" || pathname === "/settings";
  const dueToday = state.profile.trainingDays.includes(weekdayOf(currentDate)) || Boolean(sessionForDate(state, currentDate));
  const saveLabel = isDemo
    ? accountLoading ? "Loading your account…" : "Saved on this device"
    : savingSession ? "Saving workout…" : saveError ? "Sync needs attention" : "Synced to your account";

  return (
    <div className={`app-shell ${pathname === "/rozi" ? "rozi-mode" : ""}`}>
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
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={`nav-link ${activeTab?.href === tab.href ? "active" : ""}`} aria-current={activeTab?.href === tab.href ? "page" : undefined}>
              <Icon><tab.icon aria-hidden="true" strokeWidth={2} /></Icon><span>{tab.label}</span>{tab.href === "/" && dueToday && <span className="nav-dot" />}{tab.href === "/friends" && unreadChats > 0 && <span className="nav-dot" />}
            </Link>
          ))}
          <Link href="/rozi" className={`nav-link ${pathname === "/rozi" ? "active" : ""}`} aria-current={pathname === "/rozi" ? "page" : undefined}><Icon><MessageCircle aria-hidden="true" strokeWidth={2} /></Icon><span>Ask Rozi</span></Link>
          <Link href="/profile" className={`nav-link ${onProfile ? "active" : ""}`} aria-current={onProfile ? "page" : undefined}><Icon><UserRound aria-hidden="true" strokeWidth={2} /></Icon><span>Profile</span></Link>
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
          {parent && <Link className="icon-button topbar-back" href={parent} aria-label="Back"><ArrowLeft aria-hidden="true" /></Link>}<div className="topbar-text"><span className="eyebrow">{dateLabel(currentDate, { month: "long", day: "numeric", year: "numeric" })}</span><h1>{pageTitle}</h1></div>
          <div className="topbar-actions">{!isDemo && (savingSession || saveError) && <span className={`save-state ${saveError ? "sync-error" : "connected"}`}><span className="save-dot" />{saveLabel}</span>}{isDemo && hasSupabaseConfig() && pathname !== "/sign-in" && <Link className="button button-subtle topbar-sign-in" href="/sign-in">Sign in</Link>}{!onProfile && <Link className="round-avatar has-picture" aria-label="Open your profile" href="/profile"><Avatar value={state.profile.avatar} name={state.profile.displayName} size={36} /></Link>}</div>
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

      </main>

      {/* During a workout the dock slides away; this handle (shown only then) brings it back, or tucks it away again. */}
      <button type="button" className="dock-handle" aria-label="Show or hide the navigation" onClick={() => document.body.classList.toggle("dock-peek")}><ChevronUp aria-hidden="true" /></button>
      {/* Phone dock (docs/DESIGN.md §7): Today · Workouts · Rozi (raised, centre) · Progress · Together. It hides in Rozi
          chat and during a workout, and shrinks while you scroll down (see "dock-compact"). */}
      <nav className="mobile-nav" aria-label="Main" onClick={() => document.body.classList.remove("dock-peek")}>
        <div className="dock-pill">
          {TABS.slice(0, 2).map((tab) => <DockLink key={tab.href} tab={tab} on={activeTab?.href === tab.href} dot={tab.href === "/" && dueToday && pathname !== "/today"} />)}
          <Link href="/rozi" className={`dock-rozi dock-center ${pathname === "/rozi" ? "active" : ""}`} aria-label="Ask Rozi" aria-current={pathname === "/rozi" ? "page" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small static Rozi face */}
            <img src="/rozi/faces/v1/happy.webp" alt="" width={52} height={52} />
          </Link>
          {TABS.slice(2).map((tab) => <DockLink key={tab.href} tab={tab} on={activeTab?.href === tab.href} dot={tab.href === "/friends" && unreadChats > 0} chat />)}
        </div>
      </nav>
    </div>
  );
}

function DockLink({ tab, on, dot, chat = false }: { tab: Tab; on: boolean; dot: boolean; chat?: boolean }) {
  return (
    <Link href={tab.href} className={on ? "active" : ""} aria-label={tab.label} aria-current={on ? "page" : undefined}>
      <span className="nav-icon" aria-hidden="true"><tab.icon aria-hidden="true" strokeWidth={1.8} /></span>
      <small>{tab.label}</small>
      {dot && <span className={`dock-dot${chat ? " chat" : ""}`} aria-hidden="true" />}
    </Link>
  );
}
