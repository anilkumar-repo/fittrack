"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="app-message">
      <div className="brand-mark">F</div>
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
