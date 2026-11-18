"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleCheck, Circle, Flame, Search, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { MessageButton } from "@/components/app/message-button";
import { Rozi } from "@/components/app/rozi";
import { EmptyState } from "@/components/ui/empty-state";
import { BIO_LIMIT, isAdult, normalizeUsername, profileChecklist, relationAction, suggestUsername, usernameProblem, type Relation } from "@/lib/discover";
import {
  cancelFriendRequest, loadFriendRequests, loadPersonProfile, respondFriendRequest, searchPeople, sendFriendRequest, setPublicProfile, suggestedPeople, usernameAvailable,
  type FriendRequests, type Person, type PersonProfile,
} from "@/lib/discover-repository";
import { photoLinks } from "@/lib/feed-repository";

/** Friend button logic shared by search rows and profile pages. Returns the new relation. */
function useFriendAction() {
  const { browserClient, setNotice } = useFitTrack();
  const [busy, setBusy] = useState("");
  const act = useCallback(async (person: Pick<Person, "id" | "name" | "relation" | "requestId">): Promise<Relation | null> => {
    if (!browserClient || busy) return null;
    const { action } = relationAction(person.relation);
    if (action === "none") return null;
    setBusy(person.id);
    try {
      if (action === "add") {
        const result = await sendFriendRequest(browserClient, person.id);
        setNotice(result === "requested" ? `Friend request sent to ${person.name.split(" ")[0]}.` : `You and ${person.name.split(" ")[0]} are friends now.`);
        return result === "requested" ? "requested" : "friend";
      }
      if (action === "cancel") { await cancelFriendRequest(browserClient, person.id); setNotice("Request cancelled."); return "none"; }
      // accept: an incoming request (the database also accepts when you send one back)
      if (person.requestId) await respondFriendRequest(browserClient, person.requestId, true);
      else await sendFriendRequest(browserClient, person.id);
      setNotice(`You and ${person.name.split(" ")[0]} are friends now.`);
      return "friend";
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t work. Try again."); return null; }
    finally { setBusy(""); }
  }, [browserClient, busy, setNotice]);
  return { act, busy };
}

/** One person in search, suggestions or requests. */
function PersonRow({ person, onChange, extra }: { person: Person; onChange: (next: Person) => void; extra?: React.ReactNode }) {
  const { act, busy } = useFriendAction();
  const { label, action } = relationAction(person.relation);
  return (
    <li className="person-row">
      <Link href={`/people/${person.id}`} className="person-link">
        <Avatar value={person.avatar} name={person.name} size={44} />
        <span><strong>{person.name}</strong><small>{[person.username ? `@${person.username}` : "", person.mutual ? `${person.mutual} mutual ${person.mutual === 1 ? "friend" : "friends"}` : ""].filter(Boolean).join(" · ") || " "}</small></span>
      </Link>
      {extra ?? (action === "none"
        ? <span className="person-state"><Check aria-hidden="true" /> {label}</span>
        : <button type="button" className={`button small ${action === "cancel" ? "button-subtle" : "button-primary"}`} disabled={busy === person.id}
          onClick={async () => { const next = await act(person); if (next) onChange({ ...person, relation: next }); }}>
          {action === "add" && <UserPlus aria-hidden="true" />}{label}
        </button>)}
    </li>
  );
}

/**
 * Find friends: search by name or @username (only people who chose to be findable — never under-18s), friend
 * requests waiting for you, and "People you may know" (friends of friends).
 */
export function DiscoverScreen() {
  const { state, isDemo, browserClient } = useFitTrack();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [suggested, setSuggested] = useState<Person[] | null | undefined>(undefined);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const { act, busy } = useFriendAction();

  const refresh = useCallback(async () => {
    if (isDemo || !browserClient) { setSuggested(null); return; }
    const [people, waiting] = await Promise.all([suggestedPeople(browserClient).catch(() => null), loadFriendRequests(browserClient)]);
    setSuggested(people); setRequests(waiting);
  }, [isDemo, browserClient]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  // Search as you type (after a short pause).
  useEffect(() => {
    if (!browserClient || isDemo) return;
    const text = query.trim();
    const timer = window.setTimeout(() => {
      if (text.length < 2) { setResults(null); return; }
      void searchPeople(browserClient, text).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, browserClient, isDemo]);

  if (isDemo || !browserClient) return <section className="discover-page"><EmptyState mood="chat-hello" title="Sign in to find friends" text="Search by name or @username and send friend requests." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (suggested === null) return <section className="discover-page"><EmptyState mood="chat-thinking" title="Almost ready" text="Finding friends needs the latest update. Please check back soon." /></section>;

  const replace = (list: Person[], next: Person) => list.map((item) => item.id === next.id ? next : item);
  const findable = state.profile.findable === true;

  return (
    <section className="discover-page">
      <label className="library-find"><Search aria-hidden="true" /><input type="search" value={query} placeholder="Search by name or @username" aria-label="Search people" onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X aria-hidden="true" /></button>}</label>
      {!findable && <p className="discover-note">You’re hidden from search. {isAdult(state.profile.birthYear, Number(currentYear())) ? <Link href="/profile">Turn on “Let people find me”</Link> : "People under 18 (or without a birth year) can’t be found — share your friend code instead."}</p>}

      {results !== null && <article className="panel">
        <div className="panel-title"><h3>Results</h3><span className="panel-count">{results.length}</span></div>
        {results.length ? <ul className="people-list">{results.map((person) => <PersonRow key={person.id} person={person} onChange={(next) => setResults(replace(results, next))} />)}</ul>
          : <p className="card-note">No one found. Only people who turned on “Let people find me” show up — you can also share your friend code from Friends.</p>}
      </article>}

      {requests.incoming.length > 0 && <article className="panel">
        <div className="panel-title"><h3>Friend requests</h3><span className="panel-count">{requests.incoming.length}</span></div>
        <ul className="people-list">{requests.incoming.map((person) => <PersonRow key={person.id} person={person} onChange={() => undefined} extra={
          <span className="person-actions">
            <button type="button" className="button button-primary small" disabled={busy === person.id} onClick={async () => { if (await act(person)) void refresh(); }}><Check aria-hidden="true" /> Accept</button>
            <button type="button" className="icon-button" aria-label={`Decline ${person.name}`} onClick={async () => { if (browserClient && person.requestId) { await respondFriendRequest(browserClient, person.requestId, false).catch(() => undefined); void refresh(); } }}><X aria-hidden="true" /></button>
          </span>} />)}</ul>
      </article>}

      <article className="panel">
        <div className="panel-title"><h3>People you may know</h3></div>
        {suggested === undefined ? <p className="card-note" role="status">Loading…</p> : suggested.length
          ? <ul className="people-list">{suggested.map((person) => <PersonRow key={person.id} person={person} onChange={(next) => setSuggested(replace(suggested, next))} />)}</ul>
          : <div className="discover-empty"><Rozi mood="chat-idea" size={84} eager /><p>Friends of your friends who can be found show up here. Add a few friends first — or search above.</p></div>}
      </article>

      {requests.outgoing.length > 0 && <article className="panel">
        <div className="panel-title"><h3>Requests you sent</h3><span className="panel-count">{requests.outgoing.length}</span></div>
        <ul className="people-list">{requests.outgoing.map((person) => <PersonRow key={person.id} person={person} onChange={() => void refresh()} />)}</ul>
      </article>}
    </section>
  );
}

const currentYear = () => new Date().getFullYear();

/** Someone's profile: name, picture, @username and bio; for friends (and you) streaks, this month and their posts. */
export function PersonScreen({ userId }: { userId: string }) {
  const { state, isDemo, browserClient } = useFitTrack();
  const router = useRouter();
  const [profile, setProfile] = useState<PersonProfile | null | undefined>(undefined);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const { act, busy } = useFriendAction();
  const target = userId === "me" ? state.profile.id : userId;

  useEffect(() => {
    if (isDemo || !browserClient) return;
    let live = true;
    loadPersonProfile(browserClient, target).then(async (found) => {
      if (!live) return;
      setProfile(found);
      if (found?.posts?.length) { const fresh = await photoLinks(browserClient, found.posts.map((post) => post.photo ?? "").filter(Boolean)); if (live) setLinks(fresh); }
    }).catch(() => { if (live) setProfile(null); });
    return () => { live = false; };
  }, [isDemo, browserClient, target]);

  if (isDemo || !browserClient) return <section className="person-page"><EmptyState mood="chat-hello" title="Sign in to see profiles" text="Profiles live in your account." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (profile === undefined) return <section className="person-page"><p className="card-note" role="status">Loading…</p></section>;
  if (profile === null) return <section className="person-page"><EmptyState mood="grumpy" title="Profile not available" text="This person can’t be found right now." action={{ label: "Find friends", href: "/discover" }} /></section>;

  const mine = profile.relation === "self";
  const { label, action } = relationAction(profile.relation);
  return (
    <section className="person-page">
      <button type="button" className="text-button person-back" onClick={() => router.back()}><ArrowLeft aria-hidden="true" /> Back</button>
      <article className="panel person-card">
        <Avatar value={profile.avatar} name={profile.name} size={88} />
        <h2>{profile.name}</h2>
        {profile.username && <p className="person-handle">@{profile.username}</p>}
        {profile.bio && <p className="person-bio">{profile.bio}</p>}
        <p className="person-meta">{profile.friends} {profile.friends === 1 ? "friend" : "friends"}{!mine && profile.mutual ? ` · ${profile.mutual} mutual` : ""}</p>
        <div className="person-actions">
          {mine ? <Link href="/profile" className="button button-subtle small">Edit profile</Link>
            : action === "none" ? <span className="person-state"><Check aria-hidden="true" /> {label}</span>
            : <button type="button" className={`button small ${action === "cancel" ? "button-subtle" : "button-primary"}`} disabled={busy === profile.id}
              onClick={async () => { const next = await act(profile); if (next) setProfile({ ...profile, relation: next }); }}>{action === "add" && <UserPlus aria-hidden="true" />}{label}</button>}
          {profile.relation === "friend" && <MessageButton userId={profile.id} />}
        </div>
      </article>

      {profile.stats ? <div className="person-stats">
        <div><strong><Flame aria-hidden="true" /> {profile.stats.streak}</strong><small>day streak</small></div>
        <div><strong>{profile.stats.month}</strong><small>workouts this month</small></div>
        <div><strong>{profile.stats.week}/{profile.stats.weekGoal}</strong><small>this week</small></div>
      </div> : !mine && profile.relation !== "friend" && <p className="card-note person-locked">Become friends to see {profile.name.split(" ")[0]}’s streak and workouts.</p>}

      {profile.posts && <article className="panel">
        <div className="panel-title"><h3>Posts</h3><span className="panel-count">{profile.postCount ?? profile.posts.length}</span></div>
        {profile.posts.length ? <ul className="post-grid">{profile.posts.map((post) => (
          <li key={post.id}><Link href={`/feed?post=${post.id}`} aria-label={`${post.title}, ${post.date}`}>
            {post.photo && links.get(post.photo)
              // eslint-disable-next-line @next/next/no-img-element -- short-lived private link
              ? <img src={links.get(post.photo)} alt="" loading="lazy" />
              : <span className="post-grid-title">{post.title}</span>}
            {post.likes > 0 && <small>💪 {post.likes}</small>}
          </Link></li>
        ))}</ul> : <p className="card-note">{mine ? "Post a workout from Train to see it here." : "No posts yet."}</p>}
      </article>}
    </section>
  );
}

/** On your Profile page: @username, bio, "Let people find me", and the "Complete your profile" checklist. */
export function PublicProfileCard() {
  const { state, getState, updateState, isDemo, browserClient, recordedSessions, setNotice } = useFitTrack();
  const profile = state.profile;
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState(0);
  const adult = isAdult(profile.birthYear, currentYear());
  const workouts = recordedSessions.filter((session) => session.status === "completed").length;
  const checklist = useMemo(() => profileChecklist({ avatar: profile.avatar, username: profile.username, bio: profile.bio, birthYear: profile.birthYear, workouts, posts }),
    [profile.avatar, profile.username, profile.bio, profile.birthYear, workouts, posts]);
  const done = checklist.filter((item) => item.done).length;

  useEffect(() => {
    if (isDemo || !browserClient) return;
    void loadPersonProfile(browserClient, profile.id).then((found) => setPosts(found?.postCount ?? 0)).catch(() => undefined);
  }, [isDemo, browserClient, profile.id]);

  // Is the typed username free? (checked after a short pause)
  useEffect(() => {
    const name = normalizeUsername(username);
    if (!browserClient || !editing || !name || usernameProblem(name) || name === profile.username) { const timer = window.setTimeout(() => setTaken(false), 0); return () => window.clearTimeout(timer); }
    const timer = window.setTimeout(() => void usernameAvailable(browserClient, name).then((free) => setTaken(!free)).catch(() => undefined), 350);
    return () => window.clearTimeout(timer);
  }, [username, browserClient, editing, profile.username]);

  if (isDemo || !browserClient) return null;

  async function save(next: { username: string; bio: string; findable: boolean }) {
    if (!browserClient || busy) return;
    setBusy(true);
    try {
      const saved = await setPublicProfile(browserClient, next);
      const current = getState();
      updateState({ ...current, profile: { ...current.profile, ...(saved.username ? { username: saved.username } : { username: undefined }), bio: saved.bio, findable: saved.findable } });
      if (next.findable && !saved.findable) setNotice("Saved. You can’t be found in search — that needs a birth year showing you’re 18 or older.");
      else setNotice("Profile saved.");
      setEditing(false);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t save."); }
    finally { setBusy(false); }
  }

  const problem = usernameProblem(username) ?? (taken ? "That username is taken." : null);
  return (
    <article className="panel public-profile">
      <div className="panel-title"><h3>Public profile</h3><Link href={`/people/${profile.id}`} className="text-button">View</Link></div>
      {editing ? <form className="public-profile-form" onSubmit={(event) => { event.preventDefault(); if (!problem) void save({ username, bio, findable: profile.findable === true }); }}>
        <label className="field-label">Username
          <span className="username-input"><span aria-hidden="true">@</span><input type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={21} value={username} placeholder={suggestUsername(profile.displayName) || "yourname"} onChange={(event) => setUsername(normalizeUsername(event.target.value))} /></span>
          {problem ? <small className="form-error">{problem}</small> : <small className="field-hint">Friends can find you by it. Letters, numbers, dots and underscores.</small>}
        </label>
        <label className="field-label">Bio <small className="field-hint">{bio.trim().length}/{BIO_LIMIT}</small>
          <textarea rows={2} maxLength={BIO_LIMIT} value={bio} placeholder="e.g. Lifting 3× a week, training for my first 5k" onChange={(event) => setBio(event.target.value)} />
        </label>
        <div className="account-card-actions">
          <button className="button button-primary small" disabled={busy || Boolean(problem)}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="text-button" onClick={() => { setEditing(false); setUsername(profile.username ?? ""); setBio(profile.bio ?? ""); }}>Cancel</button>
        </div>
      </form> : <button type="button" className="public-profile-view" onClick={() => { setUsername(profile.username ?? suggestUsername(profile.displayName)); setBio(profile.bio ?? ""); setEditing(true); }}>
        <strong>{profile.username ? `@${profile.username}` : "Choose a @username"}</strong>
        <span>{profile.bio || "Add a short bio"}</span>
        <small>Edit</small>
      </button>}

      <div className="settings-toggle-row">
        <span><strong>Let people find me</strong><small>{adult ? "Show your name, picture and @username in search and suggestions" : "Needs a birth year showing you’re 18 or older"}</small></span>
        <button type="button" role="switch" aria-checked={profile.findable === true} aria-label="Let people find me" className={`toggle ${profile.findable ? "on" : ""}`} disabled={busy || !adult}
          onClick={() => void save({ username: profile.username ?? "", bio: profile.bio ?? "", findable: !profile.findable })}><span /></button>
      </div>

      {done < checklist.length && <div className="profile-checklist">
        <div className="profile-checklist-head"><strong>Complete your profile</strong><span>{done}/{checklist.length}</span></div>
        <div className="friend-week" aria-hidden="true"><span style={{ width: `${(done / checklist.length) * 100}%` }} /></div>
        <ul>{checklist.map((item) => (
          <li key={item.id} className={item.done ? "done" : ""}>{item.done ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}
            {item.href && !item.done ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}</li>
        ))}</ul>
      </div>}
    </article>
  );
}
