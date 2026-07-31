import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultConfig } from "../src/config.js";
import { parseSkillText } from "../src/parse.js";
import { sk007DescriptionTrigger as sk007 } from "../src/rules/sk007-description-trigger.js";
import type { FileContext } from "../src/rules/types.js";

function ctxFor(description: string): FileContext {
  const text = `---\nname: s\ndescription: ${JSON.stringify(description)}\n---\nbody`;
  return {
    skill: { filePath: "/s/SKILL.md", dir: "/s", dirName: "s", fileName: "SKILL.md", root: "/" },
    parsed: parseSkillText(text),
    config: defaultConfig(),
  };
}

const passes = [
  "Use when the user wants to clean, edit, or chart data in an .xlsx or .csv file.",
  "Use this when the user asks for a commit message.",
  "Whenever the user needs to convert a PDF.",
  "Reach for this when editing YAML config.",
  "Trigger this when a webhook fires.",
];

for (const desc of passes) {
  test(`SK007 passes a trigger-style description: "${desc.slice(0, 32)}…"`, () => {
    assert.deepEqual(sk007.check(ctxFor(desc)), []);
  });
}

test("SK007 errors on an identity-led description and reuses its words", () => {
  const f = sk007.check(ctxFor("A tool for working with spreadsheets."));
  assert.equal(f.length, 1);
  assert.equal(f[0]!.severity, undefined); // defaults to error, still config-overridable
  assert.match(f[0]!.suggestion, /Use when the user is working with spreadsheets/);
});

test("SK007 errors on a direct capability opening", () => {
  const f = sk007.check(ctxFor("Utilities for spreadsheets and CSV files."));
  assert.equal(f.length, 1);
  assert.match(f[0]!.suggestion, /Use when the user wants to work with spreadsheets/);
});

test("SK007 errors on a pure noun phrase ending in a capability noun", () => {
  const f = sk007.check(ctxFor("Spreadsheet utilities and helpers."));
  assert.equal(f.length, 1);
  assert.equal(f[0]!.severity, undefined);
  assert.match(f[0]!.suggestion, /spreadsheet/i);
});

test("SK007 matches the identity example from examples/bad", () => {
  const f = sk007.check(
    ctxFor("A collection of utilities for working with spreadsheets and tabular data."),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.suggestion, /spreadsheets and tabular data/);
});

test("SK007 still builds a rewrite from the author's words for a very vague description", () => {
  // "A tool." has no domain vocabulary, but the suggestion must still be a
  // trigger-style rewrite reusing its word, not a generic template.
  const f = sk007.check(ctxFor("A tool."));
  assert.equal(f.length, 1);
  assert.match(f[0]!.suggestion, /Use when the user wants to work with tool/);
  assert.doesNotMatch(f[0]!.suggestion, /name the task and the file types/); // the generic fallback
});

test("SK007 degrades to info (never error) when it is unsure", () => {
  const f = sk007.check(ctxFor("Fill and flatten PDF forms."));
  assert.equal(f.length, 1);
  assert.equal(f[0]!.severity, "info");
});

test("SK007 stays quiet when the description is missing or frontmatter is broken", () => {
  const noDesc = parseSkillText(`---\nname: s\n---\nbody`);
  assert.deepEqual(
    sk007.check({
      skill: { filePath: "/s/SKILL.md", dir: "/s", dirName: "s", fileName: "SKILL.md", root: "/" },
      parsed: noDesc,
      config: defaultConfig(),
    }),
    [],
  );
  const broken = parseSkillText(`---\nname: "oops\n---\nbody`);
  assert.deepEqual(
    sk007.check({
      skill: { filePath: "/s/SKILL.md", dir: "/s", dirName: "s", fileName: "SKILL.md", root: "/" },
      parsed: broken,
      config: defaultConfig(),
    }),
    [],
  );
});
