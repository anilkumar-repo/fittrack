import Link from "next/link";
import { Rozi } from "@/components/app/rozi";
import type { RoziMood } from "@/lib/rozi";

/** A friendly empty screen: Rozi, one line of title, one of help, and an optional next step. */
export function EmptyState({ mood = "hello", title, text, action }: { mood?: RoziMood; title: string; text: string; action?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <div className="empty-state">
      <Rozi mood={mood} size={96} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (action.href
        ? <Link href={action.href} className="button button-primary">{action.label}</Link>
        : <button type="button" className="button button-primary" onClick={action.onClick}>{action.label}</button>)}
    </div>
  );
}
