"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const SEEN_KEY = "rozfit-opening-seen";
const LETTERS = "ROZFIT".split("");
/** Plates go on from both ends inward, like loading a real bar: R, T, O, I, Z, F. */
const LOAD_ORDER = [0, 2, 4, 5, 3, 1];
/** A little past the CSS animation's 4.4 s, so it has fully faded before it's removed. */
const DURATION_MS = 4500;

let decided: boolean | undefined;
/** Decided once per page load: play on the first open of this session, or whenever the URL asks (`?opening`). */
function decide(): boolean {
  if (decided !== undefined) return decided;
  decided = false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return decided;
    const asked = new URLSearchParams(window.location.search).has("opening");
    if (!asked && window.sessionStorage.getItem(SEEN_KEY)) return decided;
    window.sessionStorage.setItem(SEEN_KEY, "1");
    decided = true;
  } catch { /* storage blocked: skip the opening rather than replay it on every page */ }
  return decided;
}
const noSubscribe = () => () => {};

/**
 * The opening (approved 2026-11-25): the bar draws out, R-O-Z-F-I-T slide on like weight plates from both ends
 * inward, Rozi rises from behind the name, rests his paws on top of the letters, blinks once, and it fades into the
 * app. 4.4 s, once per app open (per session), on top of whatever is loading underneath. Skipped with reduced motion.
 * `/?opening` replays it, for checking.
 * It's in the server page, so it starts at the very first paint; the client then keeps or drops it.
 */
export function RoziOpening() {
  const play = useSyncExternalStore(noSubscribe, decide, () => true);
  const [done, setDone] = useState(false);
  // A timer, not animationend: the animation starts with the server page and can finish before React is listening.
  useEffect(() => {
    if (!play) return;
    const timer = window.setTimeout(() => setDone(true), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [play]);

  if (!play || done) return null;
  return (
    <div className="rozi-opening" aria-hidden="true">
      <div className="ro-lift">
        {/* Rozi behind the plates, and his paws again in front of them, so they rest on top of the letters. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static cut-out, must show with the first paint */}
        <span className="ro-peek back"><span className="ro-rozi"><img src="/rozi/peek.webp" alt="" width={230} height={230} /><i className="ro-lid left" /><i className="ro-lid right" /></span></span>
        <span className="ro-bar" />
        <div className="ro-plates">
          {LETTERS.map((letter, index) => (
            <span key={index} className={`${index < 3 ? "from-left" : "from-right"} ${index === 1 ? "accent" : ""}`}
              style={{ animationDelay: `${0.45 + LOAD_ORDER[index] * 0.22}s` }}>{letter}</span>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- the same picture, paws only */}
        <span className="ro-peek paws"><span className="ro-rozi"><img src="/rozi/peek.webp" alt="" width={230} height={230} /></span></span>
      </div>
    </div>
  );
}
