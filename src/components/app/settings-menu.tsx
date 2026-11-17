"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Search, X, type LucideIcon } from "lucide-react";

export interface MenuItem {
  group: string;
  id: string;
  label: string;
  note: string;
  icon: LucideIcon;
  /** Icon tile colour, like iOS Settings. */
  color: string;
  value?: string;
  keywords?: string;
  /** Opens another page; otherwise the row opens `/settings?section=<id>` (or runs onClick). */
  href?: string;
  onClick?: () => void;
}

/** Settings as a grouped list (Account · Preferences · Trainers & safety · Help) with a search box. */
export function SettingsMenu({ items, profileCard }: { items: MenuItem[]; profileCard: ReactNode }) {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((item) => words.every((word) => `${item.label} ${item.note} ${item.keywords ?? ""}`.toLowerCase().includes(word)));
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <section className="settings settings-menu">
      {!query && profileCard}
      <label className="settings-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings" aria-label="Search settings" />{query && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><X aria-hidden="true" /></button>}</label>
      {groups.map((group) => {
        const rows = shown.filter((item) => item.group === group);
        if (!rows.length) return null;
        return (
          <div key={group} className="settings-menu-group">
            <h4>{group}</h4>
            <ul>{rows.map((item) => {
              const inner = <>
                <span className="menu-icon" style={{ background: item.color }}><item.icon aria-hidden="true" /></span>
                <span><strong>{item.label}</strong><small>{item.note}</small></span>
                <span className="menu-value">{item.value ?? ""}</span>
                <ChevronRight className="menu-chevron" aria-hidden="true" />
              </>;
              return <li key={item.id}>{item.onClick
                ? <button type="button" onClick={item.onClick}>{inner}</button>
                : <Link href={item.href ?? `/settings?section=${item.id}`}>{inner}</Link>}</li>;
            })}</ul>
          </div>
        );
      })}
      {!shown.length && <p className="settings-empty-search">Nothing matches “{query}”.</p>}
    </section>
  );
}
