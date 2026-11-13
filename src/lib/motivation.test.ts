import assert from "node:assert/strict";
import test from "node:test";
import { MOTIVATION_LINES, motivationFor } from "./motivation.ts";

test("the daily motivation line stays the same all day and changes the next day", () => {
  assert.equal(motivationFor("2026-11-13"), motivationFor("2026-11-13"));
  assert.notEqual(motivationFor("2026-11-13"), motivationFor("2026-11-14"));
  const month = new Set(Array.from({ length: MOTIVATION_LINES.length }, (_, day) => motivationFor(`2026-12-${String(day + 1).padStart(2, "0")}`)));
  assert.equal(month.size, MOTIVATION_LINES.length);
});
