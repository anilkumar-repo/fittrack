import type { ReactNode } from "react";

/** A static tag (muscle, filter). Not tappable. */
export function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "success" }) {
  return <span className={`ui-chip ui-chip--${tone}`}>{children}</span>;
}
