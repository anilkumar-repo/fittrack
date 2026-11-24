"use client";

import { useRef, type KeyboardEvent } from "react";

/** 2-5 options; the selected one is a lighter pill. Left/right arrows move the selection. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (value: T) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className="ui-seg" role="tablist" aria-label={label}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? "ui-seg__tab ui-seg__tab--on" : "ui-seg__tab"}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.label}
            {o.count !== undefined && <span className="ui-seg__count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
