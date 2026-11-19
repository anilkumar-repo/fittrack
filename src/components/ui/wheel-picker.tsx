"use client";

import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

const ROW = 44;

/**
 * An iPhone-style scrolling wheel: the row in the middle band is the value. Scroll, drag or use the
 * arrow keys. Rows fade and shrink away from the middle.
 */
export function WheelPicker<T extends string | number>({ items, value, onChange, format = String, label, width }: {
  items: T[]; value: T; onChange: (value: T) => void; format?: (value: T) => string; label: string; width?: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const lastRow = useRef<number | null>(null);
  const index = Math.max(0, items.indexOf(value));

  // Start on the current value.
  useEffect(() => {
    if (list.current) list.current.scrollTop = index * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first show; scrolling owns it after
  }, []);

  function onScroll() {
    const element = list.current;
    if (!element) return;
    paint(element);
    // A light tick as each row passes the middle band.
    const row = Math.round(element.scrollTop / ROW);
    if (lastRow.current !== null && lastRow.current !== row) haptic();
    lastRow.current = row;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const next = Math.min(items.length - 1, Math.max(0, Math.round(element.scrollTop / ROW)));
      if (items[next] !== value) onChange(items[next]);
    }, 90);
  }

  function step(delta: number) {
    const next = Math.min(items.length - 1, Math.max(0, index + delta));
    haptic();
    onChange(items[next]);
    list.current?.scrollTo({ top: next * ROW, behavior: "smooth" });
  }

  useEffect(() => { if (list.current) paint(list.current); }, []);

  return (
    <div className="wheel" style={width ? { width } : undefined}>
      <span className="wheel-band" aria-hidden="true" />
      <div
        ref={list}
        className="wheel-list"
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={`${label}-${index}`}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); step(1); }
          if (event.key === "ArrowUp") { event.preventDefault(); step(-1); }
        }}
      >
        <div style={{ height: ROW * 2 }} aria-hidden="true" />
        {items.map((item, i) => (
          <div key={String(item)} id={`${label}-${i}`} role="option" aria-selected={i === index} className="wheel-row" onClick={() => { onChange(item); list.current?.scrollTo({ top: i * ROW, behavior: "smooth" }); }}>{format(item)}</div>
        ))}
        <div style={{ height: ROW * 2 }} aria-hidden="true" />
      </div>
    </div>
  );
}

/** Rows look curved: the further from the middle, the smaller and fainter. */
function paint(element: HTMLDivElement) {
  const middle = element.scrollTop + element.clientHeight / 2;
  for (const row of element.querySelectorAll<HTMLElement>(".wheel-row")) {
    const distance = Math.min(2.6, Math.abs(row.offsetTop + ROW / 2 - middle) / ROW);
    row.style.opacity = String(1 - distance * 0.3);
    row.style.transform = `scale(${1 - distance * 0.09}) rotateX(${(row.offsetTop + ROW / 2 - middle) / ROW * -18}deg)`;
  }
}
