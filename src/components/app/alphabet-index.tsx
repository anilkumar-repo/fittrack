"use client";

import { useRef, useState } from "react";

/**
 * A side A–Z strip, like the phone's Contacts: touch or drag along it and the list jumps to that letter.
 * The touched letter grows and a big bubble shows it, so you can see where your thumb is.
 * Each list item that starts a letter carries `id={letterAnchorId(prefix, letter)}`.
 */
export function letterAnchorId(prefix: string, letter: string): string {
  return `${prefix}-letter-${letter === "#" ? "num" : letter}`;
}

export function firstLetter(name: string): string {
  const letter = name.trim()[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(letter) ? letter : "#";
}

export function AlphabetIndex({ letters, prefix }: { letters: string[]; prefix: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  function pick(clientY: number) {
    const box = rail.current?.getBoundingClientRect();
    if (!box || !letters.length) return;
    const index = Math.min(letters.length - 1, Math.max(0, Math.floor(((clientY - box.top) / box.height) * letters.length)));
    const letter = letters[index];
    if (letter === active) return;
    setActive(letter);
    document.getElementById(letterAnchorId(prefix, letter))?.scrollIntoView({ block: "start" });
    navigator.vibrate?.(5);
  }

  if (letters.length < 3) return null;
  return (
    <div
      ref={rail}
      className={`alpha-rail ${active ? "touching" : ""}`}
      role="navigation"
      aria-label="Jump to letter"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pick(event.clientY); }}
      onPointerMove={(event) => { if (event.buttons || event.pointerType === "touch") pick(event.clientY); }}
      onPointerUp={() => window.setTimeout(() => setActive(null), 350)}
      onPointerCancel={() => setActive(null)}
    >
      {letters.map((letter) => (
        <button key={letter} type="button" className={letter === active ? "on" : ""} aria-label={`Jump to ${letter}`} onClick={() => document.getElementById(letterAnchorId(prefix, letter))?.scrollIntoView({ block: "start" })}>{letter}</button>
      ))}
      {active && <span className="alpha-bubble" aria-hidden="true">{active}</span>}
    </div>
  );
}
