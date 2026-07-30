import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { makeColors, resolveColor } from "../src/color.js";

const original = process.env["NO_COLOR"];
afterEach(() => {
  if (original === undefined) delete process.env["NO_COLOR"];
  else process.env["NO_COLOR"] = original;
});

test("explicit flag overrides everything", () => {
  process.env["NO_COLOR"] = "1";
  assert.equal(resolveColor(true, { isTTY: false }), true);
  assert.equal(resolveColor(false, { isTTY: true }), false);
});

test("NO_COLOR disables colour when present and non-empty", () => {
  process.env["NO_COLOR"] = "1";
  assert.equal(resolveColor(null, { isTTY: true }), false);
});

test("an empty NO_COLOR is ignored (per no-color.org)", () => {
  process.env["NO_COLOR"] = "";
  assert.equal(resolveColor(null, { isTTY: true }), true);
  assert.equal(resolveColor(null, { isTTY: false }), false);
});

test("without a flag or NO_COLOR, colour follows TTY", () => {
  delete process.env["NO_COLOR"];
  assert.equal(resolveColor(null, { isTTY: true }), true);
  assert.equal(resolveColor(null, { isTTY: false }), false);
});

test("makeColors(false) is a no-op; makeColors(true) wraps in escapes", () => {
  assert.equal(makeColors(false).green("x"), "x");
  assert.equal(makeColors(true).green("x"), "\x1b[32mx\x1b[39m");
});
