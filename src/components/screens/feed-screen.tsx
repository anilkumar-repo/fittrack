"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Camera, Flag, ImagePlus, MessageCircle, Send, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { Rozi } from "@/components/app/rozi";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { EmptyState } from "@/components/ui/empty-state";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { workoutCard } from "@/lib/chats";
import { agoLabel, CAPTION_MAX, COMMENT_MAX, countLabel, preparePhoto } from "@/lib/feed";
import {
  addComment, createPost, deleteComment, deletePost, loadFeed, loadPost, photoLinks, reportPost, setPostLike,
  type FeedComment, type FeedPost, type PostReportReason,
} from "@/lib/feed-repository";
import type { WorkoutSession } from "@/lib/types";
import { WorkoutCardView } from "./chats-screen";

const REPORT_REASONS: Array<{ id: PostReportReason; label: string }> = [
  { id: "harassment", label: "Harassment or bullying" }, { id: "inappropriate", label: "Inappropriate" }, { id: "spam", label: "Spam" },
  { id: "unsafe", label: "Unsafe advice" }, { id: "other", label: "Something else" },
];

/**
 * The feed: workouts you and your friends (and your Train together group) chose to post, newest first — a photo,
 * the workout card, a caption, 💪 likes and comments. Only friends see posts; never strangers.
 */
export function FeedScreen() {
  const { isDemo, browserClient, setNotice } = useFitTrack();
  const params = useSearchParams();
  const [posts, setPosts] = useState<FeedPost[] | null | undefined>(undefined);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(params.get("post"));

  const withPhotos = useCallback(async (list: FeedPost[]) => {
    if (!browserClient) return;
    const fresh = await photoLinks(browserClient, list.map((post) => post.photo ?? "").filter(Boolean));
    setLinks((current) => new Map([...current, ...fresh]));
  }, [browserClient]);

  const refresh = useCallback(async () => {
    if (isDemo || !browserClient) { setPosts(null); return; }
    try {
      const list = await loadFeed(browserClient);
      setPosts(list); setMore((list?.length ?? 0) === 20);
      if (list) void withPhotos(list);
    } catch { setPosts(null); }
  }, [isDemo, browserClient, withPhotos]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function older() {
    if (!browserClient || !posts?.length) return;
    const page = await loadFeed(browserClient, posts[posts.length - 1].at).catch(() => []);
    if (!page) return;
    setPosts([...posts, ...page.filter((post) => !posts.some((existing) => existing.id === post.id))]);
    setMore(page.length === 20);
    void withPhotos(page);
  }

  const update = (next: FeedPost | null, id: string) => setPosts((list) => list ? (next ? list.map((post) => post.id === id ? next : post) : list.filter((post) => post.id !== id)) : list);

  if (isDemo || !browserClient) return <section className="feed-page"><EmptyState mood="cheer" title="Sign in to see the feed" text="See the workouts your friends post — and cheer them on with a 💪." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (posts === undefined) return <section className="feed-page"><p className="card-note" role="status">Loading the feed…</p></section>;
  if (posts === null) return <section className="feed-page"><EmptyState mood="chat-thinking" title="Almost ready" text="The feed needs the latest update. Please check back soon." /></section>;

  return (
    <section className="feed-page">
      <p className="feed-note">Only your friends and your Train together group see these posts.</p>
      {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} photoUrl={post.photo ? links.get(post.photo) : undefined} onOpen={() => setOpen(post.id)}
        onChange={(next) => update(next, post.id)} onNotice={setNotice} />)
        : <div className="panel"><EmptyState mood="workout" title="Nothing here yet" text="Finish a workout and tap “Post to feed” — your friends’ posts show up here too." action={{ label: "Go to Train", href: "/today" }} /></div>}
      {more && <button type="button" className="button button-subtle feed-more" onClick={() => void older()}>Show older posts</button>}
      {open && <CommentsSheet postId={open} onClose={() => setOpen(null)} onChange={(next) => update(next, open)} />}
    </section>
  );
}

/** One post in the feed. */
function PostCard({ post, photoUrl, onOpen, onChange, onNotice }: { post: FeedPost; photoUrl?: string; onOpen: () => void; onChange: (post: FeedPost | null) => void; onNotice: (text: string) => void }) {
  const { state, browserClient, weightUnit } = useFitTrack();
  const mine = post.authorId === state.profile.id;
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function like() {
    if (!browserClient || busy) return;
    const on = !post.liked;
    onChange({ ...post, liked: on, likes: Math.max(0, post.likes + (on ? 1 : -1)) });
    try { const likes = await setPostLike(browserClient, post.id, on); onChange({ ...post, liked: on, likes }); }
    catch (cause) { onChange(post); onNotice(cause instanceof Error ? cause.message : "That didn’t work."); }
  }

  async function remove() {
    if (!browserClient || !window.confirm("Delete this post? Its photo, likes and comments go too.")) return;
    setBusy(true);
    try { await deletePost(browserClient, post.id); onChange(null); onNotice("Post deleted."); }
    catch (cause) { onNotice(cause instanceof Error ? cause.message : "That didn’t work."); setBusy(false); }
  }

  return (
    <article className="panel post-card">
      <header className="post-head">
        <Link href={`/people/${post.authorId}`} className="post-author-face" aria-label={`${post.author}’s profile`}><Avatar value={post.avatar} name={post.author} size={42} /></Link>
        <span><Link href={`/people/${post.authorId}`} className="post-author"><strong>{mine ? "You" : post.author}</strong></Link><small>{agoLabel(post.at)}</small></span>
        <button type="button" className="icon-button" aria-label="Post options" aria-expanded={menu} onClick={() => setMenu(!menu)}>···</button>
        {menu && <div className="chat-menu" role="menu">
          {mine ? <button type="button" role="menuitem" className="danger-text" disabled={busy} onClick={() => { setMenu(false); void remove(); }}><Trash2 aria-hidden="true" /> Delete post</button>
            : <button type="button" role="menuitem" onClick={() => { setMenu(false); setReporting(true); }}><Flag aria-hidden="true" /> Report post</button>}
        </div>}
      </header>
      {post.photo && <div className="post-photo">{photoUrl
        // eslint-disable-next-line @next/next/no-img-element -- short-lived private link, not optimisable by next/image
        ? <img src={photoUrl} alt={`Photo from ${post.author}’s workout`} loading="lazy" />
        : <span className="post-photo-wait" aria-hidden="true" />}</div>}
      {post.caption && <p className="post-caption">{post.caption}</p>}
      {post.card && <WorkoutCardView card={post.card} unit={weightUnit} />}
      <div className="post-actions">
        <button type="button" className={`post-like ${post.liked ? "on" : ""}`} aria-pressed={post.liked} aria-label={post.liked ? "Remove your 💪" : "Send 💪"} onClick={() => void like()}>
          <span aria-hidden="true">💪</span> {post.likes || ""}
        </button>
        <button type="button" className="post-comments-button" onClick={onOpen}><MessageCircle aria-hidden="true" /> {post.commentCount || ""}<span className="sr-only"> comments</span></button>
        {post.likes > 0 && <small>{countLabel(post.likes, "person sent 💪", "people sent 💪")}</small>}
      </div>
      {post.comments.length > 0 && <button type="button" className="post-preview" onClick={onOpen}>
        {post.comments.map((item) => <span key={item.id}><strong>{item.authorId === state.profile.id ? "You" : item.author.split(" ")[0]}</strong> {item.body}</span>)}
        {post.commentCount > post.comments.length && <small>View all {post.commentCount} comments</small>}
      </button>}
      {reporting && <ReportSheet postId={post.id} commentId={null} onClose={() => setReporting(false)} />}
    </article>
  );
}

/** All comments on a post, and the box to add one. */
function CommentsSheet({ postId, onClose, onChange }: { postId: string; onClose: () => void; onChange: (post: FeedPost | null) => void }) {
  const { state, browserClient } = useFitTrack();
  useScrollLock();
  const [post, setPost] = useState<FeedPost | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState<FeedComment | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const me = state.profile.id;

  useEffect(() => {
    if (!browserClient) return;
    let live = true;
    loadPost(browserClient, postId).then((found) => { if (live) setPost(found); }).catch(() => { if (live) setPost(null); });
    return () => { live = false; };
  }, [browserClient, postId]);

  async function send() {
    if (!browserClient || !post || busy) return;
    const body = text.trim();
    if (!body) return;
    setBusy(true); setError("");
    try {
      const added = await addComment(browserClient, post.id, body);
      const next = { ...post, comments: [...post.comments, { ...added, author: state.profile.displayName, ...(state.profile.avatar ? { avatar: state.profile.avatar } : {}) }], commentCount: post.commentCount + 1 };
      setPost(next); setText("");
      onChange({ ...next, comments: next.comments.slice(-2) });
      window.setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 50);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t send."); }
    finally { setBusy(false); }
  }

  async function remove(item: FeedComment) {
    if (!browserClient || !post) return;
    try {
      if (await deleteComment(browserClient, item.id)) {
        const next = { ...post, comments: post.comments.filter((entry) => entry.id !== item.id), commentCount: Math.max(0, post.commentCount - 1) };
        setPost(next); onChange({ ...next, comments: next.comments.slice(-2) });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work."); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Comments" onClick={onClose}>
      <section className="modal chat-sheet comments-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Comments</h2>
        {post === undefined ? <p role="status" className="card-note">Loading…</p> : post === null ? <p className="card-note">This post was deleted or isn’t shared with you.</p> : <>
          <p className="card-note">{post.authorId === me ? "Your" : `${post.author.split(" ")[0]}’s`} {post.card?.title ?? "workout"}</p>
          {post.comments.length ? <ul className="comment-list">{post.comments.map((item) => {
            const canDelete = item.authorId === me || post.authorId === me;
            return (
              <li key={item.id}>
                <Avatar value={item.avatar} name={item.author} size={34} />
                <span><strong>{item.authorId === me ? "You" : item.author}</strong> <small>{agoLabel(item.at)}</small><p>{item.body}</p></span>
                {canDelete ? <button type="button" className="icon-button" aria-label="Delete comment" onClick={() => void remove(item)}><Trash2 aria-hidden="true" /></button>
                  : <button type="button" className="icon-button" aria-label="Report comment" onClick={() => setReporting(item)}><Flag aria-hidden="true" /></button>}
              </li>
            );
          })}</ul> : <div className="chat-empty"><Rozi mood="chat-hello" size={90} eager /><p>No comments yet. Say something nice 💬</p></div>}
          <div ref={end} />
          <div className="comment-compose">
            <label className="msg-input"><span className="sr-only">Comment</span><textarea rows={1} maxLength={COMMENT_MAX + 50} value={text} placeholder="Add a comment" onChange={(event) => { setText(event.target.value); setError(""); }}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /></label>
            <button type="button" className="button button-primary chat-send" aria-label="Post comment" disabled={busy || !text.trim() || text.trim().length > COMMENT_MAX} onClick={() => void send()}><Send aria-hidden="true" /></button>
          </div>
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {reporting && post && <ReportSheet postId={post.id} commentId={reporting.id} onClose={() => setReporting(null)} />}
      </section>
    </div>,
    document.body,
  );
}

/** Report a post or a comment. */
function ReportSheet({ postId, commentId, onClose }: { postId: string; commentId: string | null; onClose: () => void }) {
  const { browserClient, setNotice } = useFitTrack();
  useScrollLock();
  const [reason, setReason] = useState<PostReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    if (!browserClient || !reason || busy) return;
    setBusy(true);
    try { await reportPost(browserClient, postId, commentId, reason, note); setNotice("Thanks — it was reported. You can also block this person from their chat."); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work."); setBusy(false); }
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop report-backdrop" role="dialog" aria-modal="true" aria-label="Report" onClick={onClose}>
      <section className="modal chat-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Report this {commentId ? "comment" : "post"}</h2>
        <div className="chip-row">{REPORT_REASONS.map((item) => <button key={item.id} type="button" className={`chip ${reason === item.id ? "chip-on" : ""}`} aria-pressed={reason === item.id} onClick={() => setReason(item.id)}>{item.label}</button>)}</div>
        <label className="field-label">More details <small className="field-hint">optional</small><textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button type="button" className="button button-primary full-width" disabled={busy || !reason} onClick={() => void send()}><Flag aria-hidden="true" /> Report</button>
        {error && <p role="alert" className="form-error">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}

/** "Post to feed" after a workout: the card, a caption and an optional photo. Nothing is shared until you tap Post. */
export function PostWorkoutSheet({ session, onClose, onPosted }: { session: WorkoutSession; onClose: () => void; onPosted: () => void }) {
  const { state, browserClient, setNotice, weightUnit } = useFitTrack();
  useScrollLock();
  const card = useMemo(() => workoutCard(session, state.sessions), [session, state.sessions]);
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("photo"); setError("");
    try { const small = await preparePhoto(file); setPhoto(small); setPreview(URL.createObjectURL(small)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That photo couldn’t be used."); }
    finally { setBusy(""); if (picker.current) picker.current.value = ""; }
  }

  async function post() {
    if (!browserClient || !card || busy) return;
    setBusy("post"); setError("");
    try {
      await createPost(browserClient, state.profile.id, { date: session.date, card, caption: caption.trim(), photo });
      setNotice("Posted! Your friends can see it in the feed.");
      onPosted(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t post. Try again."); setBusy(""); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Post to feed" onClick={onClose}>
      <section className="modal chat-sheet post-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Post to feed</h2>
        <p className="card-note">Your friends and your Train together group will see it. Never strangers.</p>
        {!card ? <p className="card-note">Finish at least one set to post this workout.</p> : <>
          <div className="post-photo-pick">
            {preview ? <div className="post-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the shrunk photo */}
              <img src={preview} alt="Your photo" />
              <button type="button" className="icon-button post-photo-remove" aria-label="Remove photo" onClick={() => { setPhoto(null); setPreview(""); }}><X aria-hidden="true" /></button>
            </div> : <button type="button" className="post-photo-add" disabled={busy === "photo"} onClick={() => picker.current?.click()}>
              {busy === "photo" ? <span role="status">Preparing photo…</span> : <><ImagePlus aria-hidden="true" /><span><strong>Add a photo</strong><small>Optional · gym selfie, the view, your progress</small></span><Camera aria-hidden="true" /></>}
            </button>}
            <input ref={picker} type="file" accept="image/*" hidden onChange={(event) => void pick(event.target.files?.[0])} />
          </div>
          <label className="field-label">Caption <small className="field-hint">optional</small>
            <textarea rows={2} maxLength={CAPTION_MAX} value={caption} placeholder="How did it go?" onChange={(event) => setCaption(event.target.value)} />
          </label>
          <WorkoutCardView card={card} unit={weightUnit} />
          <button type="button" className="button button-primary full-width" disabled={Boolean(busy)} onClick={() => void post()}>{busy === "post" ? "Posting…" : "Post"}</button>
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}
