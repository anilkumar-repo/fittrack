"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

/**
 * Gooey search (2026-11-25), RozFit's take on Aceternity UI's "Gooey Input": a pill that, when tapped, stretches open
 * while a round search-icon bubble pulls away from it with a liquid "goo" join (an SVG blur + alpha-threshold filter).
 * Rebuilt with the app's CSS tokens and plain React instead of Tailwind + Motion (neither is in this project): the
 * widths, the 0.4 s springy curve, the bubble scaling in, and the goo filter follow the original. Reduced motion turns
 * the movement off. It stays open while it holds text; empty and blurred, it closes again.
 */
export function GooeySearch({
  value,
  onChange,
  placeholder,
  label,
  collapsedLabel = "Search",
  onSubmit,
  trailing,
  className = "",
  enterKeyHint = "search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** What a screen reader hears for the field. */
  label: string;
  /** The words on the closed pill. */
  collapsedLabel?: string;
  /** Enter or the keyboard's search key. */
  onSubmit?: () => void;
  /** Something to show inside the open field on the right (a clear or go button, a chip). */
  trailing?: ReactNode;
  className?: string;
  enterKeyHint?: "search" | "go" | "done";
}) {
  const filterId = `gooey-${useId().replace(/:/g, "")}`;
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(Boolean(value));
  // Text arriving from outside (a link with ?q=…, a restored search) opens the field.
  const isOpen = open || Boolean(value);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  return (
    <div className={`gooey-search ${isOpen ? "open" : ""} ${className}`}>
      <svg className="gooey-filter" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="gooey-stage" style={{ filter: `url(#${filterId})` }}>
        <span className="gooey-bubble" aria-hidden="true"><span><Search /></span></span>
        <div className="gooey-pill">
          {!isOpen && <button type="button" className="gooey-trigger" onClick={() => setOpen(true)} aria-label={label}>
            <Search aria-hidden="true" /><span>{collapsedLabel}</span>
          </button>}
          <form role="search" className="gooey-form" onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }} hidden={!isOpen}>
            <input ref={input} type="search" value={value} placeholder={placeholder} aria-label={label} enterKeyHint={enterKeyHint} autoComplete="off"
              onChange={(event) => onChange(event.target.value)}
              onBlur={() => { if (!value) setOpen(false); }} />
            {trailing}
          </form>
        </div>
      </div>
    </div>
  );
}
