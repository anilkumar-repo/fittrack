import assert from "node:assert/strict";
import test from "node:test";
import { agoLabel, canPostDate, countLabel, fitInside } from "./feed.ts";

test("posting window: the last week (and tomorrow, for time zones), not older", () => {
  assert.equal(canPostDate("2026-11-18", "2026-11-18"), true);
  assert.equal(canPostDate("2026-11-11", "2026-11-18"), true);
  assert.equal(canPostDate("2026-11-10", "2026-11-18"), false);
  assert.equal(canPostDate("2026-11-19", "2026-11-18"), true);
  assert.equal(canPostDate("2026-11-20", "2026-11-18"), false);
});

test("photos fit inside 1600 px and are never enlarged", () => {
  assert.deepEqual(fitInside(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(fitInside(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(fitInside(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitInside(0, 600), { width: 0, height: 0 });
});

test("how long ago a post was made", () => {
  const now = new Date(2026, 10, 18, 15, 0);
  const at = (days: number, hours: number, minutes = 0) => new Date(2026, 10, 18 - days, hours, minutes).toISOString();
  assert.equal(agoLabel(at(0, 14, 59, ), now), "1 min");
  assert.equal(agoLabel(new Date(now.getTime() - 20_000).toISOString(), now), "Just now");
  assert.equal(agoLabel(at(0, 12), now), "3 h");
  assert.equal(agoLabel(at(1, 20), now), "Yesterday");
  assert.equal(agoLabel(at(3, 9), now), "Sun");
  assert.equal(agoLabel(at(20, 9), now), "Oct 29");
});

test("count labels", () => {
  assert.equal(countLabel(0, "comment", "comments", "No comments yet"), "No comments yet");
  assert.equal(countLabel(1, "like", "likes"), "1 like");
  assert.equal(countLabel(0, "like", "likes", ""), "");
  assert.equal(countLabel(4, "comment", "comments"), "4 comments");
});
