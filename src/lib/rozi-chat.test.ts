import assert from "node:assert/strict";
import test from "node:test";
import { detectIntent, SUGGESTED_QUESTIONS } from "./rozi-chat.ts";

test("Rozi understands the common questions", () => {
  assert.equal(detectIntent("What's my workout today?"), "TODAY_WORKOUT");
  assert.equal(detectIntent("What am I training today"), "TODAY_WORKOUT");
  assert.equal(detectIntent("Show my next session"), "NEXT_WORKOUT");
  assert.equal(detectIntent("What did I train yesterday?"), "LAST_WORKOUT");
  assert.equal(detectIntent("Show my last workout"), "LAST_WORKOUT");
  assert.equal(detectIntent("How many workouts this week?"), "WEEKLY_WORKOUT_COUNT");
  assert.equal(detectIntent("How is my streak?"), "STREAK_STATUS");
  assert.equal(detectIntent("Am I getting stronger?"), "PROGRESS_CHECK");
  assert.equal(detectIntent("My hips feel tight"), "MOBILITY_RECOMMENDATION");
  assert.equal(detectIntent("How is my weight going"), "BODY_GOAL_PROGRESS");
  assert.equal(detectIntent("hey"), "HELLO");
  assert.equal(detectIntent("   "), "UNKNOWN");
  assert.equal(detectIntent("Tell me a joke"), "UNKNOWN");
  // Every suggestion button leads to a real answer.
  for (const question of SUGGESTED_QUESTIONS) assert.notEqual(detectIntent(question), "UNKNOWN", question);
});
