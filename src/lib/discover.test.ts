import assert from "node:assert/strict";
import test from "node:test";
import { isAdult, normalizeUsername, profileChecklist, relationAction, suggestUsername, usernameProblem } from "./discover.ts";

test("usernames: saved lower case without @, 3–20 letters/numbers/dots/underscores", () => {
  assert.equal(normalizeUsername("  @Anil.K "), "anil.k");
  assert.equal(usernameProblem(""), null);
  assert.equal(usernameProblem("ab"), "At least 3 characters.");
  assert.equal(usernameProblem("a".repeat(21)), "At most 20 characters.");
  assert.equal(usernameProblem("anil kumar"), "Only letters, numbers, dots and underscores.");
  assert.equal(usernameProblem("@Anil_K.2"), null);
});

test("username suggestion from the display name", () => {
  assert.equal(suggestUsername("Anil Kumar"), "anil.kumar");
  assert.equal(suggestUsername("  José  Ñúñez!! "), "jose.nunez");
  assert.equal(suggestUsername("Al"), "");
});

test("adults: 18 or older this year; unknown age is not an adult (same as the database)", () => {
  assert.equal(isAdult(2008, 2026), true);
  assert.equal(isAdult(2009, 2026), false);
  assert.equal(isAdult(undefined, 2026), false);
});

test("profile checklist", () => {
  const empty = profileChecklist({ workouts: 0, posts: 0 });
  assert.equal(empty.filter((item) => item.done).length, 0);
  const full = profileChecklist({ avatar: "rozi:cheer", username: "anil", bio: "Lifting", birthYear: 1994, workouts: 3, posts: 1 });
  assert.equal(full.every((item) => item.done), true);
  assert.equal(profileChecklist({ bio: "   ", workouts: 0, posts: 0 }).find((item) => item.id === "bio")?.done, false);
});

test("friend button for each relation", () => {
  assert.deepEqual(relationAction("none"), { label: "Add friend", action: "add" });
  assert.deepEqual(relationAction("requested"), { label: "Requested", action: "cancel" });
  assert.deepEqual(relationAction("incoming"), { label: "Accept", action: "accept" });
  assert.equal(relationAction("friend").action, "none");
});
