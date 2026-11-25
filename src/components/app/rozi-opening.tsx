"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const SEEN_KEY = "rozfit-opening-seen";
const LETTERS = "ROZFIT".split("");
/** Plates go on from both ends inward, like loading a real bar: R, T, O, I, Z, F. */
const LOAD_ORDER = [0, 2, 4, 5, 3, 1];

type Mode = false | "full" | "plain";
let decided: Mode | undefined;
/** Decided once per page load: play on the first open of this session, or whenever the URL asks (`?opening`). */
function decide(): Mode {
  if (decided !== undefined) return decided;
  decided = false;
  try {
    const param = new URLSearchParams(window.location.search).get("opening");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return decided;
    if (param === null && window.sessionStorage.getItem(SEEN_KEY)) return decided;
    window.sessionStorage.setItem(SEEN_KEY, "1");
    decided = param === "plain" ? "plain" : "full";
  } catch { /* storage blocked: skip the opening rather than replay it on every page */ }
  return decided;
}
const noSubscribe = () => () => {};

/**
 * The opening (picked 2026-11-25, styles 13 + 3 + 6): the app icon you tapped opens up, Rozi lands with a squash, the
 * letters slide onto a barbell like weight plates, and the bar lifts. About 2.4 s, once per app open (per session), on
 * top of whatever is loading underneath. Skipped with reduced motion.
 * `?opening=plain` shows it without Rozi landing (13 + 6), `?opening` alone replays it; both are for comparing looks.
 */
export function RoziOpening() {
  // The server page already includes it, so it starts at the very first paint, straight after the iPhone launch
  // picture; the client then keeps or drops it (already seen this session, reduced motion).
  const mode = useSyncExternalStore(noSubscribe, decide, () => "full" as Mode);
  const [done, setDone] = useState(false);
  const show = done ? false : mode;
  // A timer, not animationend: the animation starts with the server page and can finish before React is listening.
  useEffect(() => {
    if (!mode) return;
    const timer = window.setTimeout(() => setDone(true), 2500);
    return () => window.clearTimeout(timer);
  }, [mode]);

  if (!show) return null;
  return (
    <div className={`rozi-opening ${show === "plain" ? "plain" : ""}`} aria-hidden="true">
      <picture className="ro-tile">
        <source srcSet="/icons/apple-touch-icon-dark.png" media="(prefers-color-scheme: dark)" />
        <img src="/icons/apple-touch-icon.png" alt="" width={180} height={180} />
      </picture>
      <div className="ro-stage">
        {/* eslint-disable-next-line @next/next/no-img-element -- same static Rozi as the loader */}
        <img className="ro-rozi" src="/rozi/hello.webp" alt="" width={140} height={140} fetchPriority="high" />
        <div className="ro-lift">
          <span className="ro-bar" />
          <div className="ro-plates">
            {LETTERS.map((letter, index) => (
              <span key={index} className={`${index < 3 ? "from-left" : "from-right"} ${index === 1 ? "accent" : ""}`}
                style={{ animationDelay: `${1 + LOAD_ORDER[index] * 0.09}s` }}>{letter}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
