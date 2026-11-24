import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "glass" | "text";
type Size = "md" | "lg";

type Look = { variant?: Variant; size?: Size; block?: boolean; icon?: ReactNode; className?: string; children?: ReactNode };

function classes({ variant = "glass", size = "md", block, className }: Look) {
  return ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, block && "ui-button--block", className].filter(Boolean).join(" ");
}

/** The one button: primary (one per screen), glass, or text. The icon sits after the label. */
export function Button({ variant, size, block, icon, className, children, type = "button", ...rest }: Look & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Look>) {
  return (
    <button type={type} className={classes({ variant, size, block, className })} {...rest}>
      {children}
      {icon}
    </button>
  );
}

/** A link that looks like a Button. */
export function ButtonLink({ href, variant, size, block, icon, className, children }: Look & { href: string }) {
  return (
    <Link href={href} className={classes({ variant, size, block, className })}>
      {children}
      {icon}
    </Link>
  );
}
