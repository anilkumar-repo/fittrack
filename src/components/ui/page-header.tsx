import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Screen heading: optional back button, eyebrow, the h1 title, and a trailing action. */
export function PageHeader({ eyebrow, title, action, back }: { eyebrow?: string; title: string; action?: ReactNode; back?: { href: string; label?: string } }) {
  return (
    <header className="ui-page-header">
      {back && (
        <Link href={back.href} className="ui-page-header__back" aria-label={back.label ?? "Back"}>
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
      )}
      <div className="ui-page-header__text">
        {eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="ui-page-header__title">{title}</h1>
      </div>
      {action && <div className="ui-page-header__action">{action}</div>}
    </header>
  );
}
