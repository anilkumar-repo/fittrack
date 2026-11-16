"use client";

import { useEffect } from "react";

let locks = 0;
let savedY = 0;

/**
 * Stops the page behind a full-screen sheet or player from scrolling (also on iPhone Safari, where
 * `overflow: hidden` alone is not enough). Nested sheets share one lock; the scroll position comes back on close.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const body = document.body;
    if (locks === 0) {
      savedY = window.scrollY;
      root.classList.add("scroll-locked");
      body.style.top = `-${savedY}px`;
    }
    locks += 1;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks > 0) return;
      root.classList.remove("scroll-locked");
      body.style.top = "";
      window.scrollTo(0, savedY);
    };
  }, [active]);
}
