"use client";

import { useEffect, useRef } from "react";

/**
 * The grab handle at the top of a phone sheet. Put it as the first child of the sheet: it makes the
 * whole sheet draggable by its top edge, and a swipe down (far or fast enough) closes it. On wider
 * screens it hides itself and does nothing.
 */
/** True when the sheet, or a scrolling area inside it under the finger, isn't at its top. */
function scrolledUnder(target: HTMLElement, sheet: HTMLElement): boolean {
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
    if (node === sheet) break;
  }
  return false;
}

export function SheetGrip({ onClose }: { onClose: () => void }) {
  const grip = useRef<HTMLSpanElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const sheet = grip.current?.parentElement;
    if (!sheet) return;
    const phone = window.matchMedia("(max-width: 700px)");
    let startY = 0;
    let startTime = 0;
    let dragging = false;
    let dy = 0;

    function down(event: PointerEvent) {
      if (!phone.matches || !sheet) return;
      const top = sheet.getBoundingClientRect().top;
      // Only from the top strip, or anywhere when nothing under the finger is scrolled down — so pulling a list
      // back up scrolls the list (a list inside the sheet, like the exercise picker's, counts too).
      if (event.clientY - top > 64 && scrolledUnder(event.target as HTMLElement, sheet)) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, button, a, [role='slider']")) return;
      startY = event.clientY;
      startTime = performance.now();
      dragging = true;
      dy = 0;
    }
    function move(event: PointerEvent) {
      if (!dragging || !sheet) return;
      dy = Math.max(0, event.clientY - startY);
      if (dy > 4) {
        sheet.style.transition = "none";
        sheet.style.transform = `translateY(${dy}px)`;
      }
    }
    function up() {
      if (!dragging || !sheet) return;
      dragging = false;
      const speed = dy / Math.max(1, performance.now() - startTime);
      sheet.style.transition = "transform .28s cubic-bezier(.2, .9, .3, 1)";
      if (dy > 110 || (dy > 40 && speed > 0.6)) {
        sheet.style.transform = "translateY(110%)";
        window.setTimeout(() => close.current(), 220);
      } else {
        sheet.style.transform = "";
      }
    }
    sheet.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      sheet.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  return <span ref={grip} className="sheet-grip" aria-hidden="true" />;
}
