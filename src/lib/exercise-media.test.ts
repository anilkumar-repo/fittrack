import assert from "node:assert/strict";
import test from "node:test";
import { getDemoVideoLink } from "./exercise-media.ts";

test("demo links search by exercise name and never invent a specific video", () => {
  const link = getDemoVideoLink({ id: "glute_bridge", name: "Glute bridge" });
  assert.equal(link.curated, false);
  assert.match(link.url, /^https:\/\/www\.youtube\.com\/results\?search_query=Glute%20bridge/);
});
