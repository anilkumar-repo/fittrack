"use client";

import { ACTIVITY_OPTIONS } from "@/lib/onboarding";
import { useCallback, useEffect, useState } from "react";
import { Droplets, Undo2 } from "lucide-react";
import { BOTTLE_ML, GLASS_ML, waterMood, waterTargetMl, type WaterMood } from "@/lib/wellness";
import { addCloudWater, loadCloudWater, removeCloudWater, type WaterLog } from "@/lib/supabase-repository";
import { hourIn, weekdayOf } from "@/lib/dates";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

const LOCAL_PREFIX = "rozfit-water-";

function readLocal(date: string): WaterLog[] {
  try { const raw = window.localStorage.getItem(`${LOCAL_PREFIX}${date}`); return raw ? JSON.parse(raw) as WaterLog[] : []; } catch { return []; }
}
function writeLocal(date: string, logs: WaterLog[]) {
  try { window.localStorage.setItem(`${LOCAL_PREFIX}${date}`, JSON.stringify(logs)); } catch { /* kept for this visit only */ }
}

const LINES: Record<WaterMood, string> = {
  great: "Hydration hero! Rozi is fully charged 💧",
  "on-track": "Right on pace. Keep sipping.",
  behind: "A little behind — one glass catches you up.",
  thirsty: "Rozi is thirsty! Grab a big glass.",
};

/** Home: today's water as a filling bottle. Target from body weight (+ workout days); Rozi reacts to your pace. */
export function WaterCard() {
  const { state, isDemo, browserClient, currentDate, setNotice } = useFitTrack();
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (isDemo || !browserClient) { setLogs(readLocal(currentDate)); setLoaded(true); return; }
    try { setLogs(await loadCloudWater(browserClient, currentDate)); } catch { setLogs(readLocal(currentDate)); }
    setLoaded(true);
  }, [isDemo, browserClient, currentDate]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const latestWeight = [...state.bodyWeightEntries].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)).at(-1)?.weightKg ?? null;
  const workoutDay = state.profile.trainingDays.includes(weekdayOf(currentDate)) || sessionForDate(state, currentDate)?.status === "completed";
  const target = waterTargetMl(latestWeight, workoutDay, ACTIVITY_OPTIONS.find((option) => option.id === state.profile.dailyActivity)?.waterMl ?? 0);
  const total = logs.reduce((sum, log) => sum + log.ml, 0);
  const mood = waterMood(total, target, hourIn(state.profile.timeZone));
  const share = Math.min(1, total / target);

  async function add(ml: number) {
    const optimistic: WaterLog = { id: `local-${Date.now()}`, ml, at: new Date().toISOString() };
    const next = [...logs, optimistic];
    setLogs(next);
    if (isDemo || !browserClient) { writeLocal(currentDate, next); return; }
    try {
      const saved = await addCloudWater(browserClient, currentDate, ml);
      setLogs((current) => current.map((log) => log.id === optimistic.id ? saved : log));
    } catch (error) {
      writeLocal(currentDate, next);
      setNotice(error instanceof Error ? error.message : "Water saved on this phone only for now.");
    }
  }

  async function undo() {
    const last = logs.at(-1);
    if (!last) return;
    const next = logs.slice(0, -1);
    setLogs(next);
    if (isDemo || !browserClient || last.id.startsWith("local-")) { writeLocal(currentDate, next); return; }
    await removeCloudWater(browserClient, last.id).catch(() => undefined);
  }

  return (
    <article className={`water-card panel ${mood}`} id="water" aria-label="Water today">
      <div className="water-bottle" role="img" aria-label={`${total} of ${target} ml`}>
        <span className="water-fill" style={{ height: `${Math.round(share * 100)}%` }}><span className="water-wave" /></span>
        <span className="water-cap" />
      </div>
      <div className="water-copy">
        <span className="water-tag"><Droplets aria-hidden="true" /> Water today</span>
        <strong>{loaded ? `${Number((total / 1000).toFixed(2))} / ${Number((target / 1000).toFixed(1))} L` : "…"}</strong>
        <small>{LINES[mood]}</small>
        <div className="water-buttons">
          <button type="button" className="button button-subtle" onClick={() => void add(GLASS_ML)}>+ Glass</button>
          <button type="button" className="button button-subtle" onClick={() => void add(BOTTLE_ML)}>+ Bottle</button>
          {logs.length > 0 && <button type="button" className="icon-button" aria-label="Undo last drink" onClick={() => void undo()}><Undo2 aria-hidden="true" /></button>}
        </div>
      </div>
      <Rozi mood={mood === "great" ? "cheer" : "water"} size={78} className="water-rozi" />
    </article>
  );
}
