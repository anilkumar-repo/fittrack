"use client";

import { useState } from "react";
import { useFitTrack } from "./fit-track-provider";

/** Email sign-in: RozFit sends a link, so there is no password to remember. */
export function SignInForm() {
  const { browserClient } = useFitTrack();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!browserClient || busy) return;
    setBusy(true);
    setError("");
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`;
    const { error: sendError } = await browserClient.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (sendError) setError(sendError.message);
    else setSentTo(email);
  }

  if (!browserClient) return <div className="setup-note">Account sync is not set up for this copy of RozFit. Your workouts are saved on this device.</div>;
  if (sentTo) {
    return (
      <div className="sign-in-sent" role="status">
        <strong>Check your inbox</strong>
        <p>We sent a sign-in link to {sentTo}. Open it on this device to finish signing in. It can take a minute to arrive.</p>
        <button type="button" className="text-button" onClick={() => setSentTo("")}>Use a different email</button>
      </div>
    );
  }
  return (
    <form onSubmit={sendLink} className="sign-in-form">
      <label className="field-label">Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="button button-primary full-width" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
      <small>No password needed. New here? The same link creates your account.</small>
    </form>
  );
}
