"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import type { BodyRegion, FigureChoice } from "@/lib/figure";

/** "side" is the recovery map's side view, only for figures in SIDE_VIEW_FIGURES (muscle-images.ts). */
type Side = "front" | "back" | "side";
const W = 489;
const H = 820;
/** Mask file name for each muscle group, and the sides it can be seen from. */
const FILES: Record<BodyRegion, { name: string; sides: Side[] }> = {
  shoulders: { name: "shoulders", sides: ["front", "back", "side"] }, chest: { name: "chest", sides: ["front", "side"] }, back: { name: "back", sides: ["back", "side"] },
  arms: { name: "arms", sides: ["front", "back", "side"] }, forearms: { name: "forearms", sides: ["front", "back", "side"] }, core: { name: "core", sides: ["front", "side"] },
  hips: { name: "glutes", sides: ["back", "side"] }, thighs: { name: "quads", sides: ["front", "side"] }, hamstrings: { name: "hamstrings", sides: ["back", "side"] }, calves: { name: "calves", sides: ["front", "back", "side"] },
};
const REGIONS = Object.keys(FILES) as BodyRegion[];
const maskUrl = (figure: FigureChoice, region: BodyRegion, side: Side) => `/figures/masks/v1/${figure}-${FILES[region].name}-${side}.webp`;

/** Mask pixels, loaded once per picture, so a tap can find which muscle is under the finger. */
const maskCache = new Map<string, Promise<Uint8ClampedArray | null>>();
function maskPixels(url: string): Promise<Uint8ClampedArray | null> {
  let hit = maskCache.get(url);
  if (!hit) {
    hit = new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(img, 0, 0, W, H);
        resolve(context.getImageData(0, 0, W, H).data);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    maskCache.set(url, hit);
  }
  return hit;
}

/**
 * The real anatomy picture (the same artwork as the exercise pictures) with each muscle group tinted by a
 * status colour through an exact mask, so the muscle detail and shading stay visible. Tap a muscle to pick it.
 * `tone` maps a muscle group to a status name (adds `tone-<name>`; colours live in globals.css).
 */
export function RealBody({ figure, side, tone, selected = [], onPick, label, priority = false, sizes = "(max-width: 700px) 50vw, 300px" }: {
  figure: FigureChoice; side: Side; tone: Partial<Record<BodyRegion, string>>; selected?: BodyRegion[];
  onPick?: (region: BodyRegion) => void; label?: string; priority?: boolean; sizes?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const visible = REGIONS.filter((region) => FILES[region].sides.includes(side) && tone[region]);

  // Warm the tap masks once the picture is on screen.
  useEffect(() => {
    if (!onPick) return;
    for (const region of REGIONS) if (FILES[region].sides.includes(side)) void maskPixels(maskUrl(figure, region, side));
  }, [figure, side, onPick]);

  const pick = useCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onPick || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * W);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * H);
    let best: BodyRegion | null = null;
    let bestAlpha = 60;
    for (const region of REGIONS) {
      if (!FILES[region].sides.includes(side)) continue;
      const data = await maskPixels(maskUrl(figure, region, side));
      // Look in a small circle so a near-miss on a thin muscle still counts.
      for (const [dx, dy] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const px = Math.min(W - 1, Math.max(0, x + dx));
        const py = Math.min(H - 1, Math.max(0, y + dy));
        const alpha = data ? data[(py * W + px) * 4 + 3] : 0;
        if (alpha > bestAlpha) { bestAlpha = alpha; best = region; }
      }
    }
    if (best) onPick(best);
  }, [figure, side, onPick]);

  return (
    <div ref={box} className={`real-body ${onPick ? "pickable" : ""}`} onClick={onPick ? (event) => void pick(event) : undefined} role={label ? "img" : undefined} aria-label={label}>
      <Image src={`/figures/v3/${figure}-base-${side}.webp`} alt="" width={W} height={H} sizes={sizes} priority={priority} className="real-body-base" />
      {visible.map((region, index) => {
        const url = maskUrl(figure, region, side);
        // --i staggers the fade-in, so the colours appear muscle by muscle (globals.css, Phase 5).
        return <span key={region} aria-hidden="true" className={`real-body-tint tone-${tone[region]} ${selected.includes(region) ? "picked" : ""}`} style={{ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, "--i": index } as React.CSSProperties} />;
      })}
    </div>
  );
}
