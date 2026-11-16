"use client";

import { useEffect, useState } from "react";

const LINES = ["Rozi is warming up…", "Loading your plan…", "Checking your streak…", "Almost ready…"];

/**
 * The loading screen (picked 2026-11-16, style 1): Rozi bounces while its shadow squishes,
 * with a short line that changes every 1.6 seconds. Calm (no bounce) when the phone asks for reduced motion.
 */
export function RoziLoader() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setLine((current) => (current + 1) % LINES.length), 1600);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <main className="app-loading rozi-loader" role="status" aria-live="polite">
      <div className="rozi-bounce" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- static Rozi picture; must show before anything else loads */}
        <img src="/rozi/hello.webp" alt="" width={120} height={120} fetchPriority="high" />
        <span className="rozi-shadow" />
      </div>
      <span key={line} className="rozi-loader-line">{LINES[line]}</span>
    </main>
  );
}
