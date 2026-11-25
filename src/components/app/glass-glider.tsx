"use client";

import { useEffect } from "react";

/** Tab bars and menus whose chosen item gets a sliding glass highlight. */
const CONTAINERS = ".segmented, .library-chips, .filter-row, .dock-pill, .side-nav";
const CHOSEN = ":scope > .selected, :scope > .active, :scope > [aria-current='page']";
const SWELL: Keyframe[] = [{ scale: "1 1" }, { scale: "1.1 1.16", offset: 0.45 }, { scale: "0.98 0.97", offset: 0.8 }, { scale: "1 1" }];
const LABEL_POP: Keyframe[] = [{ transform: "scale(.9)" }, { transform: "scale(1.07)", offset: 0.6 }, { transform: "scale(1)" }];

function place(container: HTMLElement, firstPaint: boolean, reduceMotion: boolean) {
  let glider = container.querySelector<HTMLElement>(":scope > .glider");
  if (!glider) {
    glider = document.createElement("span");
    glider.className = "glider";
    glider.setAttribute("aria-hidden", "true");
    container.append(glider);
    container.dataset.glider = "on";
  }
  // Rows that fit the screen slide like the dock (DockScrub); wider rows keep their own sideways scroll (CSS reads this).
  const fits = container.scrollWidth <= container.clientWidth + 1 ? "yes" : "no";
  if (container.dataset.fits !== fits) container.dataset.fits = fits;
  const chosen = [...container.querySelectorAll<HTMLElement>(CHOSEN)].find((element) => element !== glider);
  if (!chosen || chosen.offsetWidth === 0) {
    glider.style.opacity = "0";
    glider.dataset.pos = "";
    return;
  }
  const pos = `${chosen.offsetLeft},${chosen.offsetTop},${chosen.offsetWidth},${chosen.offsetHeight}`;
  if (glider.dataset.pos === pos && glider.style.opacity === "1") return;
  const moved = Boolean(glider.dataset.pos) && !firstPaint && !reduceMotion;
  glider.dataset.pos = pos;
  if (!moved) glider.style.transition = "none";
  glider.style.width = `${chosen.offsetWidth}px`;
  glider.style.height = `${chosen.offsetHeight}px`;
  glider.style.translate = `${chosen.offsetLeft}px ${chosen.offsetTop}px`;
  glider.style.borderRadius = getComputedStyle(chosen).borderRadius;
  glider.style.opacity = "1";
  if (!moved) {
    void glider.offsetWidth; // apply the jump before turning transitions back on
    glider.style.transition = "";
    return;
  }
  // Zoom in while travelling, then settle down into place.
  glider.animate(SWELL, { duration: 520, easing: "cubic-bezier(.3, .7, .35, 1)" });
  chosen.animate(LABEL_POP, { duration: 420, easing: "cubic-bezier(.2, 1.2, .4, 1)" });
}

/**
 * Adds one sliding glass highlight to every tab bar, segmented control and menu on the page.
 * When the chosen item changes, the highlight glides over to it (zooming a little on the way)
 * instead of jumping. Works for any matching element, so new screens get it automatically.
 */
export function GlassGlider() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let firstPaint = true;
    const sizes = new ResizeObserver(() => schedule(true));
    const watched = new WeakSet<Element>();
    function syncAll(noMotion: boolean) {
      frame = 0;
      for (const container of document.querySelectorAll<HTMLElement>(CONTAINERS)) {
        if (!watched.has(container)) { watched.add(container); sizes.observe(container); }
        place(container, noMotion || firstPaint, reduceMotion.matches);
      }
      firstPaint = false;
    }
    let pendingNoMotion = false;
    function schedule(noMotion = false) {
      pendingNoMotion = pendingNoMotion || noMotion;
      if (frame) return;
      // A short timer (not requestAnimationFrame) so it also runs where frames are paused.
      frame = window.setTimeout(() => { const quiet = pendingNoMotion; pendingNoMotion = false; syncAll(quiet); }, 16);
    }
    const changes = new MutationObserver(() => schedule());
    changes.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-current", "aria-pressed"] });
    schedule(true);
    return () => { changes.disconnect(); sizes.disconnect(); if (frame) window.clearTimeout(frame); };
  }, []);
  return null;
}
