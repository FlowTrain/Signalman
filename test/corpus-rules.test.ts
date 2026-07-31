import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultConfig } from "../src/config.js";
import { distinctivenessScores } from "../src/corpus.js";
import { parseSkillText } from "../src/parse.js";
import { sk101DuplicateName } from "../src/rules/sk101-duplicate-name.js";
import { sk102TriggerCollision } from "../src/rules/sk102-trigger-collision.js";
import { sk103Distinctiveness } from "../src/rules/sk103-distinctiveness.js";
import type { SkillEntry } from "../src/rules/types.js";

function entry(fmName: string, description: string, dir = fmName): SkillEntry {
  return {
    skill: { filePath: `/s/${dir}/SKILL.md`, dir: `/s/${dir}`, dirName: dir, fileName: "SKILL.md", root: "/" },
    parsed: parseSkillText(`---\nname: ${fmName}\ndescription: ${JSON.stringify(description)}\n---\nbody`),
  };
}

const cfg = defaultConfig();

test("SK101 flags every skill sharing a duplicate name", () => {
  const f = sk101DuplicateName.check({
    entries: [entry("dup", "a", "x"), entry("dup", "b", "y"), entry("unique", "c", "z")],
    config: cfg,
  });
  assert.equal(f.length, 2);
  assert.ok(f.every((x) => x.relatedFiles && x.relatedFiles.length === 1));
});

test("SK101 passes when every name is unique", () => {
  const f = sk101DuplicateName.check({ entries: [entry("a", "x"), entry("b", "y")], config: cfg });
  assert.deepEqual(f, []);
});

test("SK102 flags a colliding pair and names the shared terms", () => {
  const f = sk102TriggerCollision.check({
    entries: [
      entry("a", "Use when the user cleans a messy spreadsheet CSV by removing duplicate rows and columns."),
      entry("b", "Use when the user cleans a messy spreadsheet CSV by removing duplicate rows and headers."),
      entry("c", "Use when the user renders a 3D model from a triangle mesh file."),
    ],
    config: cfg,
  });
  assert.equal(f.length, 1);
  assert.match(f[0]!.message, /similarity 0\.\d\d/);
  assert.match(f[0]!.message, /spreadsheet|csv|clean/);
  assert.deepEqual(f[0]!.relatedFiles, ["/s/b/SKILL.md"]);
});

test("SK102 stays quiet when descriptions are distinct", () => {
  const f = sk102TriggerCollision.check({
    entries: [
      entry("a", "Use when the user fills a PDF form."),
      entry("b", "Use when the user drafts a git commit message."),
    ],
    config: cfg,
  });
  assert.deepEqual(f, []);
});

test("SK103 flags the skill built only from words the whole corpus shares", () => {
  const f = sk103Distinctiveness.check({
    entries: [
      entry("a", "Use when the user needs to process a data file with charts."),
      entry("b", "Use when the user needs to process a data file with tables."),
      entry("c", "Use when the user needs to process a data file with images."),
      entry("d", "Use when the user needs to process a data file."),
    ],
    config: cfg,
  });
  assert.equal(f.length, 1);
  assert.equal(f[0]!.file, "/s/d/SKILL.md");
  assert.match(f[0]!.message, /Low distinctiveness \(\d+\/100\)/);
});

test("distinctivenessScores memoizes per entries array (computed once per run)", () => {
  const entries = [
    entry("a", "Use when the user fills a PDF form."),
    entry("b", "Use when the user cleans a CSV file."),
    entry("c", "Use when the user drafts a git commit."),
  ];
  assert.equal(distinctivenessScores(entries), distinctivenessScores(entries));
});

test("SK103 skips a corpus too small to compare", () => {
  const f = sk103Distinctiveness.check({
    entries: [entry("a", "Use when the user fills a PDF form."), entry("b", "Use when the user cleans CSV.")],
    config: cfg,
  });
  assert.deepEqual(f, []);
});
