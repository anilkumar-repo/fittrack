import assert from "node:assert/strict";
import test from "node:test";
import { isAdultOn, needsBirthDate, normalizeUsername, profileChecklist, relationAction, suggestUsername, usernameProblem } from "./discover.ts";

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
  // A birth year alone only counts when it's certain: 19+ years ago.
  assert.equal(isAdultOn({ birthYear: 2007 }, "2026-01-01"), true);
  assert.equal(isAdultOn({ birthYear: 2008 }, "2026-11-18"), false, "born 2008 could still be 17 (December birthday)");
  assert.equal(isAdultOn({ birthYear: 2009 }, "2026-11-18"), false);
  assert.equal(isAdultOn({}, "2026-11-18"), false, "unknown counts as not adult");
  assert.equal(needsBirthDate({ birthYear: 2008 }, "2026-11-18"), true);
  assert.equal(needsBirthDate({ birthYear: 2007 }, "2026-11-18"), false);
  assert.equal(needsBirthDate({ birthYear: 2008, birthDate: "2008-12-20" }, "2026-11-18"), false);
});

test("a full date of birth decides exactly: 18th birthday yesterday, today, tomorrow", () => {
  assert.equal(isAdultOn({ birthYear: 2008, birthDate: "2008-11-17" }, "2026-11-18"), true, "yesterday");
  assert.equal(isAdultOn({ birthYear: 2008, birthDate: "2008-11-18" }, "2026-11-18"), true, "today");
  assert.equal(isAdultOn({ birthYear: 2008, birthDate: "2008-11-19" }, "2026-11-18"), false, "tomorrow");
  assert.equal(isAdultOn({ birthYear: 2008, birthDate: "2008-12-20" }, "2026-11-18"), false, "December birthday");
  // The date wins over a (wrong) year.
  assert.equal(isAdultOn({ birthYear: 1990, birthDate: "2010-01-01" }, "2026-11-18"), false);
  // 29 February: an adult on 1 March in a non-leap year.
  assert.equal(isAdultOn({ birthDate: "2008-02-29" }, "2026-02-28"), false);
  assert.equal(isAdultOn({ birthDate: "2008-02-29" }, "2026-03-01"), true);
  // Nonsense dates are ignored (then the year rule applies).
  assert.equal(isAdultOn({ birthYear: 2008, birthDate: "2008-02-31" }, "2026-11-18"), false);
  assert.equal(isAdultOn({ birthYear: 2000, birthDate: "not a date" }, "2026-11-18"), true);
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
