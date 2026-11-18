import assert from "node:assert/strict";
import test from "node:test";
import { clampTimerTop, readTimerPlace, snapSide } from "./rest-timer-place.ts";

test("a dropped rest timer settles on the nearer side", () => {
  assert.equal(snapSide(10, 80, 375), "left");
  assert.equal(snapSide(260, 80, 375), "right");
  assert.equal(snapSide(147, 80, 375), "left"); // middle at 187, just left of 187.5
  assert.equal(snapSide(148, 80, 375), "right");
});

test("the rest timer always stays on screen", () => {
  assert.equal(clampTimerTop(-50, 72, 812), 56);
  assert.equal(clampTimerTop(900, 72, 812), 728);
  assert.equal(clampTimerTop(400, 72, 812), 400);
  // A phone turned sideways: a place saved lower than the new screen is pulled up.
  assert.equal(clampTimerTop(700, 122, 375), 241);
});

test("a remembered place is read safely", () => {
  assert.deepEqual(readTimerPlace('{"side":"left","top":300}'), { side: "left", top: 300 });
  assert.equal(readTimerPlace(null), null);
  assert.equal(readTimerPlace("not json"), null);
  assert.equal(readTimerPlace('{"side":"middle","top":300}'), null);
  assert.equal(readTimerPlace('{"side":"right","top":"300"}'), null);
});
