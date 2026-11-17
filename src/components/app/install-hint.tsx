"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Rozi } from "./rozi";
import { useScrollLock } from "./use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";

const SEEN_KEY = "rozfit-install-hint-v1";
/** Chrome on Android offers its own install prompt. */
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/**
 * The first time someone opens the link in a phone browser (not the installed app), a short sheet shows how
 * to add RozFit to the Home Screen. It can be skipped and doesn't come back; Profile → Install has the full guide.
 */
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useScrollLock(show);

  useEffect(() => {
    const keep = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", keep);
    const timer = window.setTimeout(() => {
      let seen = false;
      try { seen = window.localStorage.getItem(SEEN_KEY) === "1"; } catch { seen = true; }
      const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ua = navigator.userAgent;
      const phone = /iPhone|iPad|iPod|Android/.test(ua);
      setPlatform(/Android/.test(ua) ? "android" : "ios");
      // A moment after opening, so the page is there first.
      if (!seen && !installed && phone) setShow(true);
    }, 1200);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeinstallprompt", keep); };
  }, []);

  function close() {
    try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode: it may show again */ }
    setShow(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    close();
  }

  if (!show || typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop install-hint-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-hint-title" onClick={close}>
      <section className="modal install-hint" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={close} />
        <button type="button" className="modal-close" aria-label="Skip" onClick={close}><X aria-hidden="true" /></button>
        <Rozi mood="hello" size={96} eager />
        <h2 id="install-hint-title">Get the RozFit app</h2>
        <p>Add it to your Home Screen: it opens full screen, works offline and can send reminders. Takes 10 seconds.</p>
        {platform === "ios" ? (
          <ol className="install-hint-steps">
            <li><span><Share aria-hidden="true" /></span>Tap <strong>Share</strong> at the bottom of Safari</li>
            <li><span><SquarePlus aria-hidden="true" /></span>Choose <strong>Add to Home Screen</strong></li>
            <li><span>✓</span>Tap <strong>Add</strong>, then open RozFit from your Home Screen</li>
          </ol>
        ) : prompt ? (
          <button type="button" className="button button-primary full-width" onClick={() => void install()}><Download aria-hidden="true" /> Install RozFit</button>
        ) : (
          <ol className="install-hint-steps">
            <li><span>⋮</span>Tap the <strong>menu</strong> in Chrome</li>
            <li><span><Download aria-hidden="true" /></span>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong></li>
          </ol>
        )}
        <div className="install-hint-actions">
          <button type="button" className="button button-subtle" onClick={close}>Maybe later</button>
          <Link href="/install" className="button button-white" onClick={close}>Full guide</Link>
        </div>
      </section>
    </div>,
    document.body,
  );
}
