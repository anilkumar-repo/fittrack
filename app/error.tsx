"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    // After a new version goes live, an app that was already open can ask for code files of the old version that no
    // longer exist. That is not a real error: load the page fresh once (at most once a minute, so it can never loop).
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    if (!/ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed/i.test(text)) return;
    try {
      const last = Number(window.sessionStorage.getItem("rozfit-chunk-reload") ?? 0);
      if (Date.now() - last < 60_000) return;
      window.sessionStorage.setItem("rozfit-chunk-reload", String(Date.now()));
    } catch { /* private mode: still reload once */ }
    window.location.reload();
  }, [error]);
  return (
    <main className="app-message">
      {/* eslint-disable-next-line @next/next/no-img-element -- plain image so the error page never depends on anything that might have failed */}
      <img src="/icons/logo-r.webp" width={56} height={56} alt="RozFit" className="brand-mark brand-logo" />
      <h1>Something went wrong on this page.</h1>
      <p>Your saved workouts are not affected. Anything you were logging is kept on this device and will sync when the page loads again.</p>
      <div className="app-message-actions">
        <button className="button button-primary" onClick={() => retry()}>Try again</button>
        {/* A full page load, not a client transition, so a broken page starts clean. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="button button-subtle" href="/">Go to overview</a>
      </div>
    </main>
  );
}
