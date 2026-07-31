import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { defaultConfig } from "../src/config.js";
import { discover } from "../src/discovery.js";
import { lint } from "../src/engine.js";
import { parseSkillFile } from "../src/parse.js";
import { corpusRules, fileRules } from "../src/rules/index.js";
import type { SkillEntry } from "../src/rules/types.js";

// dist/test/examples.test.js -> repo root is two levels up.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function lintDir(rel: string) {
  const { skills } = discover({
    paths: [join(repoRoot, rel)],
    projectOnly: false,
    personalOnly: false,
    cwd: repoRoot,
    home: repoRoot,
  });
  const entries: SkillEntry[] = skills.map((skill) => ({ skill, parsed: parseSkillFile(skill.filePath) }));
  return lint({ entries, config: defaultConfig(), fileRules, corpusRules });
}

test("examples/bad fires the implemented file rules, including a per-skill lesson each", () => {
  const result = lintDir("examples/bad");
  const ids = new Set(result.findings.map((f) => f.ruleId));
  for (const expected of [
    "SK001", "SK002", "SK004", "SK005", "SK006", "SK007",
    "SK010", "SK012", "SK014", "SK015", "SK016",
  ]) {
    assert.ok(ids.has(expected), `expected ${expected} to fire on examples/bad`);
  }
});

test("every finding carries a suggestion (acceptance criterion 4)", () => {
  const result = lintDir("examples/bad");
  assert.ok(result.findings.length > 0);
  for (const f of result.findings) {
    assert.ok(f.suggestion && f.suggestion.trim().length > 0, `${f.ruleId} has no suggestion`);
  }
});

test("examples/good has no errors or warnings from the implemented rules", () => {
  const result = lintDir("examples/good");
  assert.equal(result.counts.error, 0);
  assert.equal(result.counts.warn, 0);
});

test("malformed YAML in one skill does not stop the others being linted", () => {
  const result = lintDir("examples/bad");
  // broken-frontmatter reports SK002, and unrelated skills still report their own rules.
  assert.ok(result.findings.some((f) => f.ruleId === "SK002"));
  assert.ok(result.findings.some((f) => f.ruleId === "SK006")); // from no-description
  assert.equal(result.ruleErrors.length, 0);
});
