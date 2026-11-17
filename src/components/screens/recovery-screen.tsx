"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { RealBody } from "@/components/app/real-body";
import { GROUP_ROUTINE, RecoveryLegend, recoveryTone, useRecovery } from "@/components/app/recovery-carousel";
import { Rozi } from "@/components/app/rozi";
import { dateLabel, shortDate } from "@/lib/dates";
import { mobilityRoutine, routineMinutes, stretchPicture } from "@/lib/mobility";
import { GROUP_LABELS, GROUP_REGIONS, MUSCLE_GROUPS, readyCount, recoveryLine, STATUS_LABELS, type MuscleGroup } from "@/lib/recovery";
import type { BodyRegion } from "@/lib/figure";

const BACK_ONLY = new Set<MuscleGroup>(["back"]);
const FRONT_ONLY = new Set<MuscleGroup>(["chest", "core"]);
const REGION_TO_GROUP = new Map<BodyRegion, MuscleGroup>(MUSCLE_GROUPS.flatMap((group) => GROUP_REGIONS[group].map((region) => [region, group] as const)));

/** The recovery map: front and back body coloured by how recovered each muscle group is. Tap a muscle for details. */
export function RecoveryScreen() {
  const { figure } = useFitTrack();
  const { recovery, today } = useRecovery();
  const [picked, setPickedGroup] = useState<MuscleGroup>(() => recovery.find((item) => item.status === "sore" || item.status === "fresh")?.group ?? "chest");
  const [side, setSide] = useState<"front" | "back">(() => BACK_ONLY.has(picked) ? "back" : "front");
  // Picking a muscle that can't be seen from this side turns the body around.
  function setPicked(group: MuscleGroup) {
    setPickedGroup(group);
    if (BACK_ONLY.has(group)) setSide("back");
    else if (FRONT_ONLY.has(group)) setSide("front");
  }
  const item = recovery.find((entry) => entry.group === picked)!;
  const routine = mobilityRoutine(GROUP_ROUTINE[picked]);
  const ready = readyCount(recovery);
  return (
    <section className="recovery-page">
      <article className="panel recovery-hero">
        <Rozi mood={ready === 6 ? "cheer" : recovery.some((entry) => entry.status === "sore") ? "recovery-ice" : "recovery-roller"} size={96} eager />
        <div><h2>{ready}/6 muscle groups ready</h2><p>{recoveryLine(recovery)}</p></div>
      </article>

      <article className="panel recovery-map">
        <div className="segmented recovery-side" role="tablist" aria-label="Body side">
          {(["front", "back"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={side === value} className={side === value ? "selected" : ""} onClick={() => setSide(value)}>{value === "front" ? "Front" : "Back"}</button>)}
        </div>
        <div className="real-solo">
          <RealBody key={side} figure={figure} side={side} tone={recoveryTone(recovery)} selected={GROUP_REGIONS[picked]} priority sizes="300px"
            onPick={(region) => { const group = REGION_TO_GROUP.get(region); if (group) setPicked(group); }} label={`Recovery map, ${side} view. Tap a muscle to see details.`} />
        </div>
        <small className="recovery-tap-hint">Tap a muscle</small>
        <RecoveryLegend />
      </article>

      <div className="segmented recovery-groups" role="tablist" aria-label="Muscle group">
        {MUSCLE_GROUPS.map((group) => {
          const status = recovery.find((entry) => entry.group === group)!.status;
          return <button key={group} type="button" role="tab" aria-selected={picked === group} className={picked === group ? "selected" : ""} onClick={() => setPicked(group)}><i className={`dot tone-${status}`} />{GROUP_LABELS[group]}</button>;
        })}
      </div>

      <article className="panel recovery-detail" aria-live="polite">
        <div className="recovery-detail-head"><h3>{GROUP_LABELS[picked]}</h3><span className={`status-chip tone-${item.status}`}>{STATUS_LABELS[item.status]}</span></div>
        {item.lastTrained ? <dl className="recovery-facts">
          <div><dt>Last trained</dt><dd>{item.daysSince === 0 ? "Today" : item.daysSince === 1 ? "Yesterday" : `${shortDate(item.lastTrained)} · ${item.daysSince} days ago`}</dd></div>
          <div><dt>Sets that day</dt><dd>{item.lastSets}</dd></div>
          <div><dt>Sets this week</dt><dd>{item.weekSets}</dd></div>
          <div><dt>{item.readyOn ? "Ready again" : "Status"}</dt><dd>{item.readyOn ? (item.readyOn <= today ? "Today" : dateLabel(item.readyOn, { weekday: "short", day: "numeric", month: "short" })) : "Good to train"}</dd></div>
        </dl> : <p className="card-note">Not trained yet. It lights up after a workout that works your {GROUP_LABELS[picked].toLowerCase()}.</p>}
        {item.exercises.length > 0 && <p className="card-note">Last time: {item.exercises.join(" · ")}</p>}
        {routine && <Link href={`/mobility?routine=${routine.id}`} className="suggest-card">
          <span className="suggest-art"><Image src={stretchPicture(routine.moves[0])} alt="" width={420} height={210} sizes="140px" /></span>
          <span className="suggest-copy"><small>Stretch for {GROUP_LABELS[picked].toLowerCase()}</small><strong>{routine.title} · {routineMinutes(routine)} min</strong><em>Gentle moves help it recover.</em></span>
          <ArrowRight aria-hidden="true" />
        </Link>}
      </article>

      <p className="recovery-note"><Info aria-hidden="true" /> A guide from your own logged sets and check-ins (about 2 days to recover, 3 after a big session), not a medical measurement. Pain always means a recovery day.</p>
      <Link href="/report" className="button button-subtle full-width">Your week with Rozi <ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}
