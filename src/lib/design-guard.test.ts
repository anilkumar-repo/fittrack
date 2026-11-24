import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Design guard (docs/DESIGN.md §9): app/globals.css may only use the design tokens for font sizes and radii, and its raw
// colours may only go down. Lower RAW_COLOUR_CEILING whenever a phase moves colours onto tokens; never raise it.
const RAW_COLOUR_CEILING = 457;
/** Display words (the giant "Day 1") are the only sizes outside the type scale. */
const DISPLAY_SIZES = new Set([54, 60, 64, 72]);

// Comments are not styles: strip them first, so a note that mentions a colour (or sits next to a token) never counts.
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
/** Declarations that aren't token definitions (`--name: value`). */
const declarations = css.split(/[;{}]/).map((part) => part.trim()).filter((part) => part && !/^--[a-z0-9-]+\s*:/.test(part));

test("font sizes use the type tokens (display words excepted)", () => {
  const raw = declarations.filter((part) => /^font-size\s*:\s*[0-9.]+px/.test(part))
    .filter((part) => !DISPLAY_SIZES.has(Number(part.match(/([0-9.]+)px/)?.[1])));
  assert.deepEqual(raw, [], "use var(--text-…) from docs/DESIGN.md §4");
});

test("single-value radii use the radius tokens", () => {
  const raw = declarations.filter((part) => /^border-radius\s*:\s*[0-9.]+px\s*(!important)?$/.test(part));
  assert.deepEqual(raw, [], "use var(--radius-…) from docs/DESIGN.md §5");
});

test("raw colours never grow (ratchet)", () => {
  const count = declarations.reduce((sum, part) => sum + (part.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)?.length ?? 0), 0);
  assert.ok(count <= RAW_COLOUR_CEILING, `${count} raw colours > ceiling ${RAW_COLOUR_CEILING}: use colour tokens instead`);
});

test("every token the CSS reads is defined", () => {
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)\s*\)/g)].map((match) => match[1]));
  // Set per element from components (style={{ "--fill": … }}), so they have no definition in the CSS.
  const setInline = new Set(["--fill", "--i", "--toast-time"]);
  const missing = [...used].filter((name) => !defined.has(name) && !setInline.has(name)).sort();
  assert.deepEqual(missing, [], "a var() without fallback must point at a defined token");
});
