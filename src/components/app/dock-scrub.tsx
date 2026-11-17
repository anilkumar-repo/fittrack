"use client";

import { useEffect } from "react";

/** How far a finger moves before a press becomes a drag (a smaller move is still a normal tap). */
const DRAG_START = 8;
const EDGE = 4;

/**
 * Press-and-drag on the phone dock, like the iOS tab bar: pressing lifts the glass lens, sliding moves it
 * with the finger (the tab under it lights up, with a tiny vibration on phones that support it), and letting go
 * opens that tab. A plain tap still works exactly as before. The lens itself is the GlassGlider highlight.
 */
export function DockScrub() {
  useEffect(() => {
    let drag: { pill: HTMLElement; glider: HTMLElement; startX: number; pointerId: number; moving: boolean; hovered: HTMLAnchorElement | null } | null = null;
    let swallowClick = false;

    const links = (pill: HTMLElement) => [...pill.querySelectorAll<HTMLAnchorElement>(":scope > a")];

    function hover(next: HTMLAnchorElement | null) {
      if (!drag || drag.hovered === next) return;
      drag.hovered?.classList.remove("dock-hover");
      next?.classList.add("dock-hover");
      drag.hovered = next;
      try { navigator.vibrate?.(4); } catch { /* optional */ }
    }

    function follow(clientX: number) {
      if (!drag) return;
      const { pill, glider } = drag;
      const box = pill.getBoundingClientRect();
      const width = glider.offsetWidth;
      const x = Math.min(Math.max(clientX - box.left - width / 2, EDGE), box.width - width - EDGE);
      const y = glider.style.translate.split(" ")[1] ?? "0px";
      glider.style.translate = `${x}px ${y}`;
      // The tab whose middle is closest to the lens middle.
      const middle = box.left + x + width / 2;
      let best: HTMLAnchorElement | null = null, distance = Infinity;
      for (const link of links(pill)) {
        const r = link.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - middle);
        if (d < distance) { distance = d; best = link; }
      }
      hover(best);
    }

    function end(open: boolean) {
      if (!drag) return;
      const { pill, glider, moving, hovered } = drag;
      drag = null;
      pill.classList.remove("dock-pressing", "dock-dragging");
      hovered?.classList.remove("dock-hover");
      if (!moving) return;
      // Let GlassGlider glide the lens to the chosen tab (it animates when the position "changed").
      glider.dataset.pos = "drag";
      swallowClick = true; // the browser's own click after a drag must not open the tab the finger started on
      window.setTimeout(() => {
        swallowClick = false;
        if (open && hovered && hovered.getAttribute("aria-current") !== "page") hovered.click();
        // Nudge GlassGlider to re-place the lens (it listens for class changes).
        pill.classList.toggle("dock-settled");
      }, 0);
    }

    function onDown(event: PointerEvent) {
      if (event.button > 0 || !(event.target instanceof Element)) return;
      const pill = event.target.closest<HTMLElement>(".dock-pill");
      const glider = pill?.querySelector<HTMLElement>(":scope > .glider");
      if (!pill || !glider) return;
      drag = { pill, glider, startX: event.clientX, pointerId: event.pointerId, moving: false, hovered: null };
      pill.classList.add("dock-pressing");
    }
    function onMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.moving) {
        if (Math.abs(event.clientX - drag.startX) < DRAG_START) return;
        drag.moving = true;
        try { drag.pill.setPointerCapture(event.pointerId); } catch { /* still works without capture */ }
        drag.pill.classList.add("dock-dragging");
      }
      event.preventDefault();
      follow(event.clientX);
    }
    function onUp(event: PointerEvent) { if (drag && event.pointerId === drag.pointerId) end(true); }
    function onCancel(event: PointerEvent) { if (drag && event.pointerId === drag.pointerId) end(false); }
    function onClick(event: MouseEvent) {
      if (!swallowClick || !(event.target instanceof Element) || !event.target.closest(".dock-pill")) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClick = false;
    }

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
