"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Download, Share2, Smartphone } from "lucide-react";
import { Rozi } from "@/components/app/rozi";

/** Chrome on Android offers its own install prompt; the page keeps it to show an "Install now" button. */
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://rozfit-a.vercel.app").replace(/\/$/, "");

/**
 * How to put RozFit on a phone's Home Screen: a QR code of the app address to scan with another phone,
 * a Share button, an "Install now" button where the browser supports it, and step-by-step help.
 * (Until RozFit is published in the App Store / Play Store, this is how friends and clients install it.)
 */
export function InstallScreen() {
  const [qr, setQr] = useState("");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    void QRCode.toString(SITE, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b2424", light: "#ffffff" } }).then(setQr);
    const ua = navigator.userAgent;
    const timer = window.setTimeout(() => {
      setPlatform(/iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other");
      setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    }, 0);
    const keep = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", keep);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeinstallprompt", keep); };
  }, []);

  async function share() {
    const data = { title: "RozFit", text: "Train with me on RozFit — small steps, every day.", url: SITE };
    if (navigator.share) { await navigator.share(data).catch(() => undefined); return; }
    await navigator.clipboard?.writeText(SITE).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <section className="install-page">
      <article className="panel install-hero">
        <Rozi mood="hello" size={120} priority />
        <div>
          <h2>{installed ? "RozFit is on your Home Screen" : "Put RozFit on your phone"}</h2>
          <p>{installed ? "You’re using the installed app. Share the code below with friends." : "It installs like an app, opens full screen and can send reminders. No App Store needed."}</p>
        </div>
      </article>

      <article className="panel install-qr">
        <div className="qr-box" aria-label={`QR code for ${SITE}`} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="install-qr-copy">
          <h3>Scan to open RozFit</h3>
          <p>Point any phone camera at the code, or share the link.</p>
          <code>{SITE.replace(/^https:\/\//, "")}</code>
          <div className="install-buttons">
            <button type="button" className="button button-subtle" onClick={() => void share()}>{copied ? <><Check aria-hidden="true" /> Link copied</> : <><Share2 aria-hidden="true" /> Share link</>}</button>
            {prompt && !installed && <button type="button" className="button button-primary" onClick={() => void install()}><Download aria-hidden="true" /> Install now</button>}
          </div>
        </div>
      </article>

      <div className="install-steps">
        <article className={`panel install-os ${platform === "ios" ? "is-mine" : ""}`}>
          <h3><Smartphone aria-hidden="true" /> iPhone / iPad {platform === "ios" && <span className="install-yours">Your phone</span>}</h3>
          <ol>
            <li>Open the link in <strong>Safari</strong> (not Chrome or Instagram’s browser).</li>
            <li>Tap the <strong>Share</strong> button (square with an arrow up) at the bottom.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>. Open RozFit from the new icon.</li>
            <li>For reminders: open RozFit from the icon → Settings → Notifications → turn on (iOS 16.4 or newer).</li>
          </ol>
        </article>
        <article className={`panel install-os ${platform === "android" ? "is-mine" : ""}`}>
          <h3><Smartphone aria-hidden="true" /> Android {platform === "android" && <span className="install-yours">Your phone</span>}</h3>
          <ol>
            <li>Open the link in <strong>Chrome</strong>.</li>
            <li>Tap <strong>Install now</strong> above if you see it, or the <strong>⋮</strong> menu at the top right.</li>
            <li>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
            <li>Tap <strong>Install</strong>. RozFit appears with your other apps.</li>
            <li>For reminders: Settings → Notifications → turn on, then allow.</li>
          </ol>
        </article>
      </div>
      <p className="install-note">RozFit will move to the App Store and Google Play once it’s ready for everyone. Until then, this is how friends and clients install it.</p>
    </section>
  );
}
