import assert from "node:assert/strict";
import { test } from "node:test";

import { matchesAnyGlob, matchesGlob } from "../src/glob.js";

test("** matches across path separators, and leading **/ is optional", () => {
  assert.ok(matchesGlob("test/fixtures/warn-only/x/SKILL.md", "**/fixtures/**"));
  assert.ok(matchesGlob("fixtures/x/SKILL.md", "**/fixtures/**"));
  assert.ok(matchesGlob("a/b/c.md", "**/*.md"));
});

test("* stays within a single segment", () => {
  assert.ok(matchesGlob("a.md", "*.md"));
  assert.equal(matchesGlob("a/b.md", "*.md"), false);
  assert.ok(matchesGlob("src/a.ts", "src/*.ts"));
  assert.equal(matchesGlob("src/a/b.ts", "src/*.ts"), false);
});

test("? matches a single non-separator character", () => {
  assert.ok(matchesGlob("ab", "a?"));
  assert.equal(matchesGlob("a/b", "a?"), false);
});

test("literal characters (including dots) are escaped", () => {
  assert.ok(matchesGlob("a.b", "a.b"));
  assert.equal(matchesGlob("axb", "a.b"), false);
});

test("matchesAnyGlob matches if any glob matches", () => {
  assert.ok(matchesAnyGlob("x/y.ts", ["*.md", "**/*.ts"]));
  assert.equal(matchesAnyGlob("x/y.js", ["*.md", "**/*.ts"]), false);
});
