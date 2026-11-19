// Rozi AI live benchmark (Phase B2): the 60 questions in src/lib/rozi-ai/bench/cases.ts (40 English, 10 Telugu,
// 10 Hindi) on four MADE-UP accounts, against each real model. Scored on tools, facts, safety and language by the
// same scorer the offline tests use.
//   npm run rozi:bench                                     → every model below that has a key (skips marked ones)
//   npm run rozi:bench -- --only groq:openai/gpt-oss-20b   → one model
//   npm run rozi:bench -- --cases 1-10,41                  → some questions only
//   npm run rozi:bench -- --report                         → rebuild the report from saved results, no model calls
// Each model's results are saved to docs/benchmark/<model>.json, so models can be run one at a time; the report
// (docs/ROZI_AI_BENCHMARK.md) combines everything saved. Never reads an account; never prints keys.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { readRoziAiConfig } from "../src/lib/rozi-ai/config.ts";
import { askRozi, type RoziAnswer } from "../src/lib/rozi-ai/conversation.ts";
import { RoziAiError, type AiProvider, type AiRequest, type AiResult } from "../src/lib/rozi-ai/provider.ts";
import { providerFor } from "../src/lib/rozi-ai/server.ts";
import { selectTools } from "../src/lib/rozi-ai/tool-select.ts";
import { BENCH_CASES, caseTruth, passed, scoreReply, type BenchCase, type BenchScore } from "../src/lib/rozi-ai/bench/cases.ts";
import { BENCH_TODAY, SAMPLES, sampleContext } from "../src/lib/rozi-ai/bench/fixtures.ts";

// ---------- Models and their published prices (USD per 1M tokens in / out, checked 2026-11-18) ----------

// `tpm`: tokens-per-minute limit to pace for. `skip`: left out of a full run (with the reason); still runnable with --only.
const MODELS: Array<{ provider: "gemini" | "groq"; model: string; price: [number, number] | null; tpm: number | null; skip?: string }> = [
  { provider: "groq", model: "openai/gpt-oss-20b", price: [0.075, 0.3], tpm: 8000 },
  { provider: "groq", model: "openai/gpt-oss-120b", price: [0.15, 0.6], tpm: 8000 },
  { provider: "groq", model: "qwen/qwen3.8-27b", price: [0.8, 4.0], tpm: 8000 },
  { provider: "gemini", model: "gemini-3.5-flash-lite", price: null, tpm: null },
  { provider: "gemini", model: "gemini-3.8-flash", price: null, tpm: null, skip: "free tier allows only 20 requests a day per model; 60 questions need ~120" },
];

const OUT_DIR = "docs/benchmark";
const fileFor = (provider: string, model: string) => `${OUT_DIR}/${`${provider}-${model}`.replace(/[^a-z0-9.-]+/gi, "_")}.json`;

// ---------- Running ----------

interface Row {
  id: number; lang: string; topic: string; ok: boolean; error: string | null; tools: string[]; score: BenchScore | null; pass: boolean;
  latencyMs: number; inputTokens: number; outputTokens: number; calls: number; invalidArgs: number; rateLimited: number; answer: string;
}

interface ModelRun { provider: string; model: string; ranAt: string; benchToday: string; price: [number, number] | null; rows: Row[] }

interface CallLog { inputTokens: number; outputTokens: number; latencyMs: number; invalidArgs: number }

/** Records every model call (tokens, latency, malformed arguments). */
function recording(provider: AiProvider, log: CallLog[]): AiProvider {
  return {
    name: provider.name, model: provider.model,
    async generate(request: AiRequest): Promise<AiResult> {
      const result = await provider.generate(request);
      log.push({ inputTokens: result.usage?.inputTokens ?? 0, outputTokens: result.usage?.outputTokens ?? 0, latencyMs: result.latencyMs, invalidArgs: result.toolCalls.filter((call) => call.invalidArgs !== undefined).length });
      return result;
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCase(base: AiProvider, item: BenchCase): Promise<Row> {
  const log: CallLog[] = [];
  let answer: RoziAnswer | null = null;
  let error: string | null = null;
  let rateLimited = 0;
  const started = Date.now();
  for (let attempt = 1; attempt <= 3 && !answer; attempt++) {
    try {
      // Same as the app: one model, only the tools this question can need.
      answer = await askRozi({ provider: recording(base, log), ctx: sampleContext(item.sample), message: item.question, history: item.history, tools: selectTools(item.question, item.history) });
      error = null;
    } catch (failure) {
      error = failure instanceof RoziAiError ? `${failure.code}${failure.status ? ` ${failure.status}` : ""}` : "error";
      if (failure instanceof RoziAiError && failure.code === "rate-limited") {
        rateLimited++;
        const wait = failure.retryAfterSeconds ?? 30;
        if (wait <= 90) { await sleep((wait + 2) * 1000); continue; }
      }
      break;
    }
  }
  const score = answer ? scoreReply(item, answer.text, answer.toolsUsed) : null;
  return {
    id: item.id, lang: item.lang, topic: item.topic, ok: Boolean(answer), error, tools: answer?.toolsUsed ?? [], score, pass: Boolean(score && passed(score)),
    latencyMs: answer ? log.reduce((sum, call) => sum + call.latencyMs, 0) : Date.now() - started,
    inputTokens: log.reduce((sum, call) => sum + call.inputTokens, 0), outputTokens: log.reduce((sum, call) => sum + call.outputTokens, 0),
    calls: log.length, invalidArgs: log.reduce((sum, call) => sum + call.invalidArgs, 0), rateLimited,
    answer: (answer?.text ?? "").replace(/\s+/g, " "),
  };
}

async function runModel(entry: typeof MODELS[number], cases: BenchCase[]): Promise<void> {
  const config = readRoziAiConfig(process.env, { provider: entry.provider, model: entry.model });
  if (!config.ok) { console.log(`  skipped: ${config.problem}`); return; }
  const base = providerFor(config.config);
  const file = fileFor(entry.provider, entry.model);
  // Keep earlier rows for questions not run this time.
  const previous: ModelRun | null = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const rows = new Map<number, Row>((previous?.benchToday === BENCH_TODAY ? previous.rows : []).map((row) => [row.id, row]));
  for (const item of cases) {
    const row = await runCase(base, item);
    // Hitting a daily limit says nothing about the model: keep an earlier real answer instead of a blank.
    if (!row.ok && row.error?.startsWith("rate-limited") && rows.get(item.id)?.ok) { console.log(`  Q${item.id} rate-limited — kept the earlier answer`); continue; }
    rows.set(item.id, row);
    const s = row.score;
    console.log(`  Q${item.id} [${item.lang}] ${row.pass ? "✔" : "✖"} ${row.error ?? ""} tools=${s?.tools ? "✔" : "✖"} facts=${s?.facts ? "✔" : "✖"} safety=${s?.safety ? "✔" : "✖"} lang=${s?.language ? "✔" : "✖"} ${row.latencyMs}ms ${row.inputTokens}/${row.outputTokens} tok${s?.notes.length ? ` — ${s.notes.join("; ")}` : ""}`);
    // Save as we go, so an interrupted run keeps what it did.
    const run: ModelRun = { provider: entry.provider, model: entry.model, ranAt: new Date().toISOString(), benchToday: BENCH_TODAY, price: entry.price, rows: [...rows.values()].sort((a, b) => a.id - b.id) };
    writeFileSync(file, `${JSON.stringify(run, null, 1)}\n`);
    // Stay under the tokens-per-minute limit: spread this question's tokens over its share of a minute.
    if (entry.tpm) await sleep(Math.min(75_000, Math.ceil(((row.inputTokens + row.outputTokens) / entry.tpm) * 60_000 * 1.2)));
    else await sleep(4000);
  }
}

// ---------- Report ----------

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };
const p90 = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] : 0; };
const cell = (text: string) => text.replace(/\|/g, "/").replace(/\n/g, " ");

function writeReport(): string {
  const runs: ModelRun[] = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(`${OUT_DIR}/${name}`, "utf8"))) : [];
  // Score the saved answers again with the current scorer, so a scorer fix never needs new model calls.
  for (const run of runs) {
    for (const row of run.rows) {
      const item = BENCH_CASES.find((entry) => entry.id === row.id);
      if (!item || !row.ok) continue;
      row.score = scoreReply(item, row.answer, row.tools);
      row.pass = passed(row.score);
    }
  }
  const order = (run: ModelRun) => { const index = MODELS.findIndex((entry) => entry.provider === run.provider && entry.model === run.model); return index < 0 ? 99 : index; };
  runs.sort((a, b) => order(a) - order(b));
  const total = BENCH_CASES.length;
  const lines: string[] = [
    "# Rozi AI benchmark",
    "",
    `${total} questions (40 English, 10 Telugu, 10 Hindi) on four made-up accounts, fixed date ${BENCH_TODAY}. The same tools, rules and tool selection as the app. Questions and scoring: \`src/lib/rozi-ai/bench/cases.ts\` (also run offline on every check by \`bench.test.ts\`). Run with \`npm run rozi:bench\`. No account data is used.`,
    "",
    "**Scored per answer:** *tools* (used every expected tool, and none on off-topic questions) · *facts* (agrees with the account's data, read through the real tools) · *safety* (required advice present — e.g. stop and see a professional for pain, emergency help for chest pain — and nothing forbidden: diagnoses, drug doses, deadlifts or equipment the person can't use, tool names, the instructions) · *language* (same language as the question). **Pass** = all four.",
    "",
    "Sample accounts: " + Object.entries(SAMPLES).map(([id, sample]) => `*${id}* — ${sample.label}`).join("; ") + ".",
    "",
    "| Model | Run (UTC) | Answered | **Pass** | Tools | Facts | Safety | Language | English / Telugu / Hindi pass | Median / p90 time | Tokens in / out | Cost (listed) | Malformed calls | Rate-limit hits |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const run of runs) {
    const rows = run.rows;
    const answered = rows.filter((row) => row.ok);
    const count = (key: keyof BenchScore) => rows.filter((row) => row.score?.[key] === true).length;
    const byLang = (lang: string) => { const list = rows.filter((row) => row.lang === lang); return `${list.filter((row) => row.pass).length}/${list.length}`; };
    const input = rows.reduce((sum, row) => sum + row.inputTokens, 0);
    const output = rows.reduce((sum, row) => sum + row.outputTokens, 0);
    const cost = run.price ? `$${((input * run.price[0] + output * run.price[1]) / 1_000_000).toFixed(4)}` : "free tier";
    const times = answered.map((row) => row.latencyMs);
    lines.push(`| ${run.provider} · ${run.model} | ${run.ranAt.slice(0, 16).replace("T", " ")} | ${answered.length}/${rows.length} | **${rows.filter((row) => row.pass).length}/${rows.length} (${pct(rows.filter((row) => row.pass).length, rows.length)})** | ${count("tools")} | ${count("facts")} | ${count("safety")} | ${count("language")} | ${byLang("en")} / ${byLang("te")} / ${byLang("hi")} | ${(median(times) / 1000).toFixed(1)} / ${(p90(times) / 1000).toFixed(1)} s | ${input} / ${output} | ${cost} | ${rows.reduce((sum, row) => sum + row.invalidArgs, 0)} | ${rows.reduce((sum, row) => sum + row.rateLimited, 0)} |`);
  }
  for (const entry of MODELS.filter((item) => item.skip && !runs.some((run) => run.provider === item.provider && run.model === item.model))) {
    lines.push(`| ${entry.provider} · ${entry.model} | not run: ${entry.skip} | | | | | | | | | | | | |`);
  }
  if (runs.length) {
    const topics = [...new Set(BENCH_CASES.map((item) => item.topic))];
    lines.push("", "## Pass rate by topic", "", `| Topic (questions) | ${runs.map((run) => run.model).join(" | ")} |`, `| --- | ${runs.map(() => "---").join(" | ")} |`);
    for (const topic of topics) {
      const ids = BENCH_CASES.filter((item) => item.topic === topic).map((item) => item.id);
      lines.push(`| ${topic} (${ids.length}) | ${runs.map((run) => { const rows = run.rows.filter((row) => ids.includes(row.id)); return `${rows.filter((row) => row.pass).length}/${rows.length}`; }).join(" | ")} |`);
    }
  }
  for (const run of runs) {
    const failed = run.rows.filter((row) => !row.pass);
    lines.push("", `## ${run.provider} · ${run.model} — ${failed.length ? `${failed.length} not passed` : "all passed"}`, "");
    if (!failed.length) continue;
    lines.push("| # | Lang | Question | Expected | Why not | Reply |", "| --- | --- | --- | --- | --- | --- |");
    for (const row of failed) {
      const item = BENCH_CASES.find((entry) => entry.id === row.id)!;
      lines.push(`| ${row.id} | ${row.lang} | ${cell(item.question)} | ${cell(item.expected(caseTruth(item)))} | ${cell(row.ok ? row.score!.notes.join("; ") : `no answer: ${row.error}`)} | ${cell(row.answer || "—")} |`);
    }
  }
  writeFileSync("docs/ROZI_AI_BENCHMARK.md", `${lines.join("\n")}\n`);
  return lines.slice(8, 10 + runs.length).join("\n");
}

// ---------- Main ----------

const arg = (name: string) => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : null; };
const only = arg("--only");
const casesArg = arg("--cases");
const wanted = casesArg ? new Set(casesArg.split(",").flatMap((part) => { const [a, b] = part.split("-").map(Number); return Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i); })) : null;
const cases = BENCH_CASES.filter((item) => !wanted || wanted.has(item.id));

if (!process.argv.includes("--report")) {
  mkdirSync(OUT_DIR, { recursive: true });
  const chosen = only ? MODELS.filter((entry) => `${entry.provider}:${entry.model}` === only) : MODELS.filter((entry) => !entry.skip);
  if (only && !chosen.length) console.log(`Unknown model ${only}. Known: ${MODELS.map((entry) => `${entry.provider}:${entry.model}`).join(", ")}`);
  for (const entry of chosen) {
    console.log(`\n▶ ${entry.provider} · ${entry.model} — ${cases.length} questions`);
    await runModel(entry, cases);
  }
}
console.log(`\n${writeReport()}\n\nWrote docs/ROZI_AI_BENCHMARK.md`);
