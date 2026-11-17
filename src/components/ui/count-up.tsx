"use client";

import { useEffect, useState } from "react";

/**
 * A number that counts up from 0 when it first appears (and glides to new values), like the
 * stats in the reference apps. Non-numbers and "reduce motion" show the value straight away.
 */
export function CountUp({ value, decimals = 0, duration = 700 }: { value: number; decimals?: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = shown;
    if (reduce || from === value) { const t = window.setTimeout(() => setShown(value), 0); return () => window.clearTimeout(t); }
    const started = Date.now();
    // setInterval, not requestAnimationFrame: it also runs in previews and background tabs.
    const timer = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t >= 1) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from whatever is on screen now
  }, [value, duration]);
  if (!Number.isFinite(value)) return <>{value}</>;
  return <>{shown.toFixed(decimals)}</>;
}
