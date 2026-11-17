"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Clock, ListChecks, Play } from "lucide-react";
import { AREA_LABELS, doseLabel, MOBILITY_MOVES, MOBILITY_ROUTINES, mobilityMove, mobilityRoutine, quickVersion, routineMinutes, routinesDoneOn, stretchPicture, type MobilityArea, type MobilityMove } from "@/lib/mobility";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { MobilityPlayer } from "@/components/app/mobility-player";
import { MobilitySuggestion } from "@/components/app/mobility-suggestion";
import { Rozi } from "@/components/app/rozi";
import { MoveVideo } from "@/components/app/move-video";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";

/** Stretch & mobility: today's pick, every routine, and every move by body area. "?routine=id" opens a routine. */
export function MobilityScreen() {
  const params = useSearchParams();
  const routineId = params.get("routine");
  const routine = routineId ? mobilityRoutine(routineId) : undefined;
  return routine ? <RoutineView key={routine.id} routineId={routine.id} autoplay={params.get("play") === "1"} quick={params.get("quick") === "1"} then={params.get("then")} /> : <MobilityHome />;
}

function MobilityHome() {
  const { currentDate } = useFitTrack();
  const [done, setDone] = useState<string[]>([]);
  const [move, setMove] = useState<MobilityMove | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setDone(routinesDoneOn(currentDate)), 0); return () => window.clearTimeout(timer); }, [currentDate]);
  const areas = useMemo(() => Object.keys(AREA_LABELS) as MobilityArea[], []);
  return (
    <section className="mobility-page">
      <article className="panel mobility-hero">
        <Rozi mood="mobility" size={110} priority />
        <div><h2>Stretch &amp; mobility</h2><p>Short guided routines — follow the pictures, Rozi keeps time. Stretch to mild tension, never pain.</p></div>
      </article>
      <MobilitySuggestion />
      <h3 className="mobility-heading">Routines</h3>
      <div className="routine-grid">
        {MOBILITY_ROUTINES.map((item) => (
          <Link key={item.id} href={`/mobility?routine=${item.id}`} className="routine-card">
            <span className="routine-art"><Image src={stretchPicture(item.moves[0])} alt="" width={420} height={210} sizes="(max-width: 700px) 50vw, 260px" /></span>
            <strong>{item.title}{done.includes(item.id) && <Check className="routine-done" aria-label="Done today" />}</strong>
            <small><Clock aria-hidden="true" /> {routineMinutes(item)} min · {item.moves.length} moves</small>
          </Link>
        ))}
      </div>
      <h3 className="mobility-heading">All moves</h3>
      <div className="move-areas">
        {areas.map((area) => {
          const moves = MOBILITY_MOVES.filter((item) => item.area === area);
          return (
            <details key={area} className="panel move-area">
              <summary><strong>{AREA_LABELS[area]}</strong><small>{moves.length} moves</small></summary>
              <div className="move-grid">{moves.map((item) => <button key={item.id} type="button" className="move-tile" onClick={() => setMove(item)}><Image src={stretchPicture(item.id)} alt="" width={420} height={210} sizes="(max-width: 700px) 50vw, 220px" loading="lazy" /><span>{item.name}</span></button>)}</div>
            </details>
          );
        })}
      </div>
      {move && <MoveSheet move={move} onClose={() => setMove(null)} />}
    </section>
  );
}

function MoveSheet({ move, onClose }: { move: MobilityMove; onClose: () => void }) {
  useScrollLock();
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={move.name} onClick={onClose}>
      <section className="modal move-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <Image src={stretchPicture(move.id)} alt={move.name} width={840} height={420} sizes="(max-width: 700px) 100vw, 560px" />
        <h2>{move.name}</h2>
        <p>{move.how}</p>
        <div className="chip-row"><span className="chip">{doseLabel(move)}</span><span className="chip">{move.works}</span></div>
        <MoveVideo move={move} />
        <p className="card-note">In: {MOBILITY_ROUTINES.filter((item) => item.moves.includes(move.id)).map((item) => item.title).join(", ")}</p>
      </section>
    </div>
  );
}

function RoutineView({ routineId, autoplay, quick, then }: { routineId: string; autoplay: boolean; quick: boolean; then: string | null }) {
  const router = useRouter();
  const { currentDate } = useFitTrack();
  const full = mobilityRoutine(routineId)!;
  // A warm-up from Train plays the quick version (first 5 moves).
  const routine = quick ? quickVersion(full) : full;
  const [playing, setPlaying] = useState(autoplay);
  const backTo = then && then.startsWith("/") ? then : "/mobility";
  return (
    <section className="mobility-page">
      <Link href="/mobility" className="text-button mobility-back"><ArrowLeft aria-hidden="true" /> All routines</Link>
      <article className="panel routine-hero">
        <Rozi mood={routine.mood} size={96} priority />
        <div>
          <h2>{routine.title}</h2>
          <p>{routine.blurb}</p>
          <div className="chip-row"><span className="chip"><Clock aria-hidden="true" /> {routineMinutes(routine)} min</span><span className="chip"><ListChecks aria-hidden="true" /> {routine.moves.length} moves</span></div>
          <small className="card-note">Best for: {routine.when}</small>
        </div>
      </article>
      <button type="button" className="button button-primary full-width routine-start" onClick={() => setPlaying(true)}><Play aria-hidden="true" /> Start routine</button>
      <ol className="routine-list">
        {routine.moves.map((id, i) => {
          const move = mobilityMove(id);
          if (!move) return null;
          return <li key={id}><span className="routine-num">{i + 1}</span><Image src={stretchPicture(id)} alt="" width={420} height={210} sizes="120px" loading="lazy" /><span><strong>{move.name}</strong><small>{doseLabel(move)} · {move.works}</small></span><MoveVideo move={move} compact /></li>;
        })}
      </ol>
      {playing && <MobilityPlayer routine={routine} date={currentDate} onClose={(finished) => { setPlaying(false); if (finished && then) router.push(backTo); }} />}
    </section>
  );
}
