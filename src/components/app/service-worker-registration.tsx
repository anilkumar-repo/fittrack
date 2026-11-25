"use client";

import { useEffect } from "react";

/** Registers the offline cache in production builds only, so development always sees fresh code. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    // updateViaCache "none": the browser always checks the server for a newer sw.js, so a new release is picked up.
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registered) => { registration = registered; })
      .catch(() => { /* The app works normally without the offline cache. */ });
    // A Home Screen app can stay open for days: look for a new version each time it comes back to the front.
    const onVisible = () => { if (document.visibilityState === "visible") void registration?.update().catch(() => undefined); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
