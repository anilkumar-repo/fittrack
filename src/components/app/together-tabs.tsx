"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChats } from "@/components/screens/chats-screen";

const TABS = [
  { href: "/friends", label: "Friends" },
  { href: "/feed", label: "Feed" },
  { href: "/chats", label: "Chats" },
  { href: "/buddies", label: "Buddies", title: "Train together" },
] as const;

/**
 * The Together hub (docs/UI_REDESIGN_PLAN.md, Phase 6): one row of tabs on top of Friends, Feed, Chats and Train
 * together, so the social pages feel like one place. Unread chats show on the Chats tab.
 */
export function TogetherTabs() {
  const pathname = usePathname();
  const { unread } = useChats();
  return (
    <nav className="segmented together-tabs" aria-label="Together">
      {TABS.map((tab) => {
        const on = pathname === tab.href;
        const label = "title" in tab ? tab.title : tab.label;
        return (
          <Link key={tab.href} href={tab.href} className={on ? "selected" : ""} aria-current={on ? "page" : undefined}
            aria-label={tab.href === "/chats" && unread ? `Chats, ${unread} unread` : label}>
            {tab.label}{tab.href === "/chats" && unread > 0 && <span className="tab-count">{unread > 9 ? "9+" : unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
