"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { loopOrder, moveFrames, stretchPicture } from "@/lib/mobility";

/** How long each frame shows: the end positions hold a little longer than the in-between ones. */
const END_MS = 1100;
const MIDDLE_MS = 650;

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(REDUCED).matches;

/**
 * A stretch or mobility move's picture. When the move has frames (Phase 5) they cross-fade back and forth,
 * like a short clip; otherwise it's the still picture. `paused` holds the current frame (player paused);
 * people who ask their phone for reduced motion see the first frame only.
 */
export function MoveLoop({ id, alt, sizes, priority = false, paused = false }: { id: string; alt: string; sizes: string; priority?: boolean; paused?: boolean }) {
  const frames = useMemo(() => moveFrames(id), [id]);
  const order = useMemo(() => loopOrder(frames.length), [frames.length]);
  // The step belongs to one move: a new move starts again from the first frame.
  const [position, setPosition] = useState({ id, step: 0 });
  const step = position.id === id ? position.step : 0;
  const still = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

  const shown = still ? 0 : order[step % order.length];
  useEffect(() => {
    if (frames.length < 2 || paused || still) return;
    const atEnd = shown === 0 || shown === frames.length - 1;
    const timer = window.setTimeout(() => setPosition({ id, step: (step + 1) % order.length }), atEnd ? END_MS : MIDDLE_MS);
    return () => window.clearTimeout(timer);
  }, [id, step, shown, frames.length, order.length, paused, still]);

  if (frames.length < 2) return <Image src={stretchPicture(id)} alt={alt} width={840} height={420} priority={priority} sizes={sizes} />;
  return (
    <span className="move-loop" role="img" aria-label={`${alt}, moving picture`}>
      {frames.map((src, index) => <Image key={src} src={src} alt="" width={840} height={420} sizes={sizes} priority={priority} loading="eager" className={index === shown ? "" : "off"} />)}
    </span>
  );
}
