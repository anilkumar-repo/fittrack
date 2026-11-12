"use client";

import { useEffect } from "react";

/** Registers the offline cache in production builds only, so development always sees fresh code. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* The app works normally without the offline cache. */ });
  }, []);
  return null;
}
