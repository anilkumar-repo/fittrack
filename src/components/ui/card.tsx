import type { HTMLAttributes } from "react";

/** A glass card. Never nest cards. */
export function Card({ as: Tag = "article", tone = "default", padding = "md", className, children, ...rest }: {
  as?: "article" | "section" | "div";
  tone?: "default" | "water" | "success" | "warning";
  padding?: "md" | "lg";
} & HTMLAttributes<HTMLElement>) {
  const cls = ["ui-card", tone !== "default" && `ui-card--${tone}`, `ui-card--pad-${padding}`, className].filter(Boolean).join(" ");
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
