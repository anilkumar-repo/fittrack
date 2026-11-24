import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** A row with optional leading visual and trailing value. A link, a button, or plain. */
export function ListRow({ title, detail, leading, trailing, href, onClick }: { title: string; detail?: string; leading?: ReactNode; trailing?: ReactNode; href?: string; onClick?: () => void }) {
  const tappable = Boolean(href || onClick);
  const body = (
    <>
      {leading && <span className="ui-row__leading">{leading}</span>}
      <span className="ui-row__text">
        <span className="ui-row__title">{title}</span>
        {detail && <span className="ui-row__detail">{detail}</span>}
      </span>
      {trailing
        ? <span className="ui-row__trailing">{trailing}</span>
        : tappable && <ChevronRight className="ui-row__chevron" size={18} aria-hidden="true" />}
    </>
  );
  if (href) return <Link href={href} className="ui-row ui-row--tap">{body}</Link>;
  if (onClick) return <button type="button" className="ui-row ui-row--tap" onClick={onClick}>{body}</button>;
  return <div className="ui-row">{body}</div>;
}
