"use client";

import { useEffect, useState } from "react";
import { useFitTrack } from "./fit-track-provider";

const RESEND_SECONDS = 60;

/**
 * Email sign-in with a one-time code typed into the app. The email also carries a link as a backup.
 * A code works inside the installed Home Screen app on iPhone, where a link would open Safari instead.
 * `beforeVerify` runs just before the code is checked (the welcome steps save their answers there).
 */
export function SignInForm({ beforeVerify, intro }: { beforeVerify?: () => void; intro?: string } = {}) {
  const { browserClient } = useFitTrack();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function sendCode(address: string) {
    if (!browserClient || busy) return;
    setBusy(true);
    setError("");
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`;
    const { error: sendError } = await browserClient.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
    setBusy(false);
    if (sendError) { setError(sendError.message); return; }
    setSentTo(address);
    setCode("");
    setWait(RESEND_SECONDS);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!browserClient || busy) return;
    const token = code.replace(/\D/g, "");
    if (token.length < 6) { setError("Enter the code from the email."); return; }
    setBusy(true);
    setError("");
    beforeVerify?.();
    const { error: verifyError } = await browserClient.auth.verifyOtp({ email: sentTo, token, type: "email" });
    setBusy(false);
    // On success the account loads and this screen is replaced, so there is nothing more to do here.
    if (verifyError) setError(/expired|invalid/i.test(verifyError.message) ? "That code didn’t work or has expired. Check it, or send a new one." : verifyError.message);
  }

  if (!browserClient) return <div className="setup-note">Account sync is not set up for this copy of RozFit. Your workouts are saved on this device.</div>;

  if (sentTo) {
    return (
      <form onSubmit={verify} className="sign-in-form">
        <div className="sign-in-sent" role="status">
          <strong>Check your email</strong>
          <p>We sent a code to {sentTo}. Type it below — or tap the link in the email on this phone.</p>
        </div>
        <label className="field-label">Code from the email
          <input className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" autoFocus />
        </label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button button-primary full-width" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
        <div className="sign-in-links">
          <button type="button" className="text-button" disabled={busy || wait > 0} onClick={() => void sendCode(sentTo)}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</button>
          <button type="button" className="text-button" onClick={() => { setSentTo(""); setError(""); }}>Use a different email</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void sendCode(email.trim()); }} className="sign-in-form">
      {intro && <p className="sign-in-intro">{intro}</p>}
      <label className="field-label">Email address<input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="button button-primary full-width" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
      <small>No password needed. New here? The same code creates your account.</small>
    </form>
  );
}
